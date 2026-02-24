import {
  callClaudeWithTools,
  callClaude,
  extractText,
  extractToolUse,
  type Tool,
  type ContentBlock,
  type ClaudeMessage,
} from '../services/claude.js';
import { executeTool, type ToolResult } from './tools/executor.js';
import { AgentContext, AgentResponse, AgentRunResult, ToolExecution } from '../types/agent.js';
import { logger } from '../utils/logger.js';

const MAX_TOOL_TURNS = 10; // Safety limit to prevent infinite loops

export abstract class BaseAgent {
  protected abstract systemPrompt: string;
  protected abstract tools: Tool[];
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Build context prefix from the AgentContext — gives Claude awareness
   * of the current channel, user, and constraints.
   */
  protected buildContextPrefix(context: AgentContext): string {
    return [
      `[Channel: ${context.channelId}${context.isClientChannel ? ' (CLIENT CHANNEL — requires approval)' : ''}]`,
      `[Channel type: ${context.channelType}]`,
      `[User: ${context.userId}]`,
      context.threadTs ? `[Thread: ${context.threadTs}]` : '',
      `[Current time: ${new Date().toISOString()}]`,
    ].filter(Boolean).join(' ');
  }

  /**
   * Run the agent with an agentic loop:
   * 1. Send message to Claude with tools
   * 2. If Claude returns tool_use blocks → execute them → feed results back
   * 3. Repeat until Claude returns a final text response (stop_reason = "end_turn")
   * 4. Return the final text + all tool executions
   */
  async run(message: string, context: AgentContext): Promise<AgentRunResult> {
    const contextPrefix = this.buildContextPrefix(context);
    const toolsExecuted: ToolExecution[] = [];
    const totalTokens = { input: 0, output: 0 };
    let turns = 0;

    // Build initial messages
    const messages: ClaudeMessage[] = [
      { role: 'user', content: `${contextPrefix}\n\n${message}` },
    ];

    logger.info({ agent: this.name, messageLength: message.length }, `${this.name} starting agentic run`);

    while (turns < MAX_TOOL_TURNS) {
      turns++;

      const response = await callClaudeWithTools({
        systemPrompt: this.systemPrompt,
        messages,
        tools: this.tools,
        maxTokens: 4096,
      });

      totalTokens.input += response.usage.inputTokens;
      totalTokens.output += response.usage.outputTokens;

      const toolUseBlocks = extractToolUse(response.content);
      const textContent = extractText(response.content);

      // If no tool_use blocks, Claude is done — return the text response
      if (toolUseBlocks.length === 0 || response.stopReason === 'end_turn') {
        logger.info({
          agent: this.name,
          turns,
          toolsUsed: toolsExecuted.length,
          totalTokens,
        }, `${this.name} completed`);

        return {
          response: this.buildResponse(textContent, toolsExecuted),
          toolsExecuted,
          totalTokens,
          turns,
        };
      }

      // Claude wants to use tools — execute each one
      logger.debug({
        agent: this.name,
        turn: turns,
        toolCalls: toolUseBlocks.map(b => b.name),
      }, `${this.name} executing tools`);

      // Add the assistant's response (with tool_use) to conversation
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      // Execute all tool calls and build tool_result blocks
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const toolBlock of toolUseBlocks) {
        const toolInput = toolBlock.input as Record<string, unknown>;

        logger.debug({
          agent: this.name,
          tool: toolBlock.name,
          input: toolInput,
        }, `Executing tool: ${toolBlock.name}`);

        let result: ToolResult;
        try {
          result = await executeTool(toolBlock.name, toolInput);
        } catch (err) {
          result = {
            success: false,
            data: null,
            message: `Tool execution error: ${(err as Error).message}`,
          };
          logger.error({ err, tool: toolBlock.name }, 'Tool execution failed');
        }

        toolsExecuted.push({
          toolName: toolBlock.name,
          toolInput,
          result,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        });

        logger.debug({
          agent: this.name,
          tool: toolBlock.name,
          success: result.success,
          message: result.message,
        }, `Tool result: ${toolBlock.name}`);
      }

      // Feed tool results back to Claude
      messages.push({
        role: 'user',
        content: toolResults as any,
      });
    }

    // Safety: hit max turns
    logger.warn({ agent: this.name, maxTurns: MAX_TOOL_TURNS }, `${this.name} hit max tool turns`);
    return {
      response: {
        text: `I completed ${toolsExecuted.length} action(s) but hit the maximum number of steps. Here's what I did:\n${toolsExecuted.map(t => `- ${t.toolName}: ${t.result.message}`).join('\n')}`,
        action: 'none',
      },
      toolsExecuted,
      totalTokens,
      turns,
    };
  }

  /**
   * Simple text call without tools — used for general queries and follow-ups.
   */
  async chat(message: string, context: AgentContext): Promise<string> {
    const contextPrefix = this.buildContextPrefix(context);
    return callClaude({
      systemPrompt: this.systemPrompt,
      messages: [{ role: 'user', content: `${contextPrefix}\n\n${message}` }],
    });
  }

  /**
   * Build the final AgentResponse from the text and tool executions.
   * Subclasses can override this to customize response building.
   */
  protected buildResponse(text: string, toolsExecuted: ToolExecution[]): AgentResponse {
    // Detect action from tool executions
    let action: AgentResponse['action'] = 'none';
    let metadata: Record<string, unknown> = {};
    let blocks: unknown[] | undefined;

    for (const exec of toolsExecuted) {
      if (exec.toolName === 'create_task' && exec.result.success) {
        action = 'create_task';
        metadata = { ...metadata, ...exec.result.data as Record<string, unknown> };
      } else if (exec.toolName === 'draft_client_message' && exec.result.success) {
        action = 'create_approval';
        metadata = { ...metadata, ...exec.result.data as Record<string, unknown> };
      } else if (exec.toolName === 'send_internal_message' && exec.result.success) {
        action = 'send_message';
        metadata = { ...metadata, ...exec.result.data as Record<string, unknown> };
      } else if (exec.toolName === 'post_to_slack' && exec.result.success) {
        action = 'send_message';
        metadata = { ...metadata, ...exec.result.data as Record<string, unknown> };
      }
    }

    return { text, blocks, action, metadata };
  }

  /**
   * Abstract handle method kept for backward compatibility with router.
   */
  abstract handle(message: string, context: AgentContext): Promise<AgentResponse>;
}
