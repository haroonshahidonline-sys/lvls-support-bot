import {
  callClaudeWithTools,
  extractToolUse,
  extractText,
  type ClaudeMessage,
} from '../services/claude.js';
import { ROUTER_TOOLS } from './tools/definitions.js';
import { AgentContext, RouterResult, Intent } from '../types/agent.js';
import { INTENTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const ROUTER_SYSTEM_PROMPT = `You are the LVL'S Support Bot router. You serve a 5-person digital marketing agency with 40+ client Slack channels.

Your ONLY job: classify the founder's message into one intent and extract parameters. Use classify_intent.

## IMPORTANT ROUTING RULES
- If the message mentions checking, reading, or looking at a **Slack channel** → CHANNEL_CHECK
- If the message mentions **messages, replies, what's happening in channels** → CHANNEL_CHECK
- If the message asks about **tasks, assignments, deadlines, what's pending** → TASK_STATUS
- CHANNEL_CHECK is for anything about Slack channels/messages. TASK_STATUS is for task database queries only.
- When a channel name is mentioned (even partial like "mayz" or "atmos"), extract it as channel_name parameter.

Categories:

- TASK_ASSIGN: Assign a task to a team member.
  Patterns: "Assign X to Y", "Tell X to do Y by Z", "Create a task for X"
  Params: { assignee_name, task_description, deadline_raw, priority }

- TASK_STATUS: Check task status, workload, or overdue items from the task database.
  Patterns: "What's pending for X?", "Status update", "What's overdue?", "Tasks due this week"
  Params: { person_name, scope: "person"|"all"|"overdue"|"this_week" }

- TASK_COMPLETE: Mark a task as done.
  Patterns: "Mark X as done", "X finished the Y task"
  Params: { task_search, person_name }

- CONTENT_REWRITE: Rewrite or improve content/copy.
  Patterns: "Rewrite this", "Make this more professional", "Write ad copy for"
  Params: { original_content, target_platform, tone, variations_count }

- COMMUNICATION_SEND: Send a message to a channel or person NOW.
  Patterns: "Send X a message saying Y", "Post in #channel", "Tell the client"
  Params: { target, message_content }

- COMMUNICATION_DRAFT: Draft a message without sending.
  Patterns: "Draft a message for", "Write a response to", "Prepare a message"
  Params: { target, message_content }

- CHANNEL_CHECK: Check Slack channels — read messages, find unanswered messages, see what's going on, get recent activity. This is the go-to for ANY request about reading or checking Slack channels.
  Patterns: "Check for unanswered messages", "Check the X channel", "What's going on in X?", "Any messages in X?", "Read the last messages in X", "Scan channels", "Any unread messages?", "Check if anyone messaged", "I need recent messages", "What's happening in the channels?", "Any clients waiting?", "Check slack for me", "Can you check X channel"
  Params: { channel_name (if specific channel mentioned), scope: "all"|"all_client"|"all_internal"|"specific", hours_back }

- ESCALATION: Something urgent — complaints, crises, immediate issues.
  Params: { summary, urgency: "high"|"critical" }

- GENERAL_QUERY: Greetings, questions, help, or anything that doesn't fit above.
  Params: { topic }

Be decisive. When in doubt between GENERAL_QUERY and CHANNEL_CHECK, prefer CHANNEL_CHECK if anything about channels/messages is mentioned.`;

/**
 * Router Agent — uses Claude tool_use to classify messages into intents.
 * This is lighter than the full agentic loop since it only needs one tool call.
 */
export async function classifyMessage(message: string, context: AgentContext): Promise<RouterResult> {
  const contextPrefix = [
    `[Channel: ${context.channelId}${context.isClientChannel ? ' (CLIENT CHANNEL)' : ''}]`,
    `[Channel type: ${context.channelType}]`,
    `[User: ${context.userId}]`,
  ].join(' ');

  const messages: ClaudeMessage[] = [
    { role: 'user', content: `${contextPrefix}\n\n${message}` },
  ];

  try {
    const response = await callClaudeWithTools({
      systemPrompt: ROUTER_SYSTEM_PROMPT,
      messages,
      tools: ROUTER_TOOLS,
      maxTokens: 512,
    });

    const toolUseBlocks = extractToolUse(response.content);

    if (toolUseBlocks.length > 0 && toolUseBlocks[0].name === 'classify_intent') {
      const classification = toolUseBlocks[0].input as {
        intent: string;
        confidence: number;
        params: Record<string, unknown>;
      };

      // Validate intent
      const validIntents = Object.values(INTENTS);
      if (!validIntents.includes(classification.intent as Intent)) {
        logger.warn({ classification }, 'Router returned unknown intent, defaulting to GENERAL_QUERY');
        return { intent: INTENTS.GENERAL_QUERY, confidence: 0.5, params: { topic: message } };
      }

      logger.info({
        intent: classification.intent,
        confidence: classification.confidence,
      }, 'Message classified');

      return {
        intent: classification.intent as Intent,
        confidence: classification.confidence,
        params: classification.params || {},
      };
    }

    // Fallback: Claude responded with text instead of tool_use
    const text = extractText(response.content);
    logger.warn({ text: text.substring(0, 200) }, 'Router did not use classify_intent tool, falling back');
    return { intent: INTENTS.GENERAL_QUERY, confidence: 0.3, params: { topic: message } };

  } catch (err) {
    logger.error({ err }, 'Router classification failed');
    return { intent: INTENTS.GENERAL_QUERY, confidence: 0.3, params: { topic: message } };
  }
}
