import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

// ── Runtime model switching ──────────────────────────────────
const AVAILABLE_MODELS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-20250514',
  haiku: 'claude-haiku-4-5-20251001',
};

let activeModel: string = config.CLAUDE_MODEL;

export function getActiveModel(): string {
  return activeModel;
}

export function getActiveModelName(): string {
  for (const [name, id] of Object.entries(AVAILABLE_MODELS)) {
    if (id === activeModel) return name;
  }
  return activeModel;
}

export function setModel(modelNameOrId: string): { success: boolean; model: string; message: string } {
  const lower = modelNameOrId.toLowerCase().trim();

  // Check by short name first (sonnet, opus, haiku)
  if (AVAILABLE_MODELS[lower]) {
    activeModel = AVAILABLE_MODELS[lower];
    return { success: true, model: activeModel, message: `Switched to *${lower}* (\`${activeModel}\`)` };
  }

  // Check by full model ID
  const match = Object.entries(AVAILABLE_MODELS).find(([_, id]) => id === lower);
  if (match) {
    activeModel = match[1];
    return { success: true, model: activeModel, message: `Switched to *${match[0]}* (\`${activeModel}\`)` };
  }

  const available = Object.keys(AVAILABLE_MODELS).join(', ');
  return { success: false, model: activeModel, message: `Unknown model "${modelNameOrId}". Available: ${available}` };
}

export function getAvailableModels(): Record<string, string> {
  return { ...AVAILABLE_MODELS };
}

export type ContentBlock = Anthropic.Messages.ContentBlock;
export type ToolUseBlock = Anthropic.Messages.ToolUseBlock;
export type TextBlock = Anthropic.Messages.TextBlock;
export type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;
export type MessageParam = Anthropic.Messages.MessageParam;
export type Tool = Anthropic.Messages.Tool;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[] | ToolResultBlockParam[];
}

export interface ClaudeOptions {
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeToolOptions extends ClaudeOptions {
  tools: Tool[];
}

export interface ClaudeToolResponse {
  content: ContentBlock[];
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Simple text call to Claude (no tools). Used for general queries and content generation.
 */
export async function callClaude(options: ClaudeOptions): Promise<string> {
  const { systemPrompt, messages, maxTokens = 1024, temperature = 0.3 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: activeModel,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: messages as MessageParam[],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      logger.debug({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }, 'Claude API call completed');

      return textBlock.text;
    } catch (err) {
      lastError = err as Error;
      logger.warn({ attempt: attempt + 1, error: (err as Error).message }, 'Claude API call failed, retrying...');

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Claude API call failed after retries');
}

/**
 * Call Claude with tools enabled. Returns raw content blocks so the caller
 * can inspect tool_use vs text blocks and run the agentic loop.
 */
export async function callClaudeWithTools(options: ClaudeToolOptions): Promise<ClaudeToolResponse> {
  const { systemPrompt, messages, tools, maxTokens = 4096, temperature = 0.3 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: activeModel,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        tools,
        messages: messages as MessageParam[],
      });

      logger.debug({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
        contentBlocks: response.content.length,
      }, 'Claude tool_use API call completed');

      return {
        content: response.content,
        stopReason: response.stop_reason,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (err) {
      lastError = err as Error;
      logger.warn({ attempt: attempt + 1, error: (err as Error).message }, 'Claude tool_use call failed, retrying...');

      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Claude tool_use call failed after retries');
}

/**
 * Call Claude expecting JSON response (no tools). Used for simple structured extraction.
 */
export async function callClaudeJSON<T>(options: ClaudeOptions): Promise<T> {
  const response = await callClaude({
    ...options,
    systemPrompt: options.systemPrompt + '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences, no additional text.',
  });

  // Strip markdown code fences if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Re-prompt once for valid JSON
    logger.warn({ response: cleaned.substring(0, 200) }, 'Claude returned invalid JSON, re-prompting');

    const retryResponse = await callClaude({
      ...options,
      messages: [
        ...options.messages,
        { role: 'assistant', content: response },
        { role: 'user', content: 'Your previous response was not valid JSON. Please respond with ONLY valid JSON, no markdown or extra text.' },
      ],
    });

    let retryCleaned = retryResponse.trim();
    if (retryCleaned.startsWith('```json')) retryCleaned = retryCleaned.slice(7);
    else if (retryCleaned.startsWith('```')) retryCleaned = retryCleaned.slice(3);
    if (retryCleaned.endsWith('```')) retryCleaned = retryCleaned.slice(0, -3);
    retryCleaned = retryCleaned.trim();

    return JSON.parse(retryCleaned) as T;
  }
}

/**
 * Extract text from content blocks, ignoring tool_use blocks.
 */
export function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

/**
 * Extract tool_use blocks from content.
 */
export function extractToolUse(content: ContentBlock[]): ToolUseBlock[] {
  return content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
}
