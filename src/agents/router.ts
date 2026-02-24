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

const ROUTER_SYSTEM_PROMPT = `You are the LVL'S Support Bot router. You serve a 5-person digital marketing agency specializing in Facebook ads.

Your ONLY job is to classify the founder's message into exactly one intent category and extract relevant parameters. Use the classify_intent tool to report your classification.

Categories:
- TASK_ASSIGN: The founder wants to assign a task to a team member.
  Patterns: "Assign X to Y", "Tell X to do Y by Z", "X needs to handle Y", "Create a task for X"
  Params: { assignee_name, task_description, deadline_raw, priority }

- TASK_STATUS: The founder asks about task status, pending items, workload, or what needs attention.
  Patterns: "What's pending for X?", "Status update", "What's overdue?", "Show me tasks due this week", "Anything that needs my attention?", "Check what's going on", "What do I need to do?", "Any updates?", "Check slack for me"
  Params: { person_name, scope: "person"|"all"|"overdue"|"this_week" }

- TASK_COMPLETE: The founder wants to mark a task as done.
  Patterns: "Mark X as done", "X finished the Y task", "Complete the Z task"
  Params: { task_search, person_name }

- CONTENT_REWRITE: The founder wants content rewritten or improved.
  Patterns: "Rewrite this:", "Make this more professional", "Improve this copy", "Write ad copy for"
  Params: { original_content, target_platform, tone, variations_count }

- COMMUNICATION_SEND: The founder wants to send a message to a channel or person.
  Patterns: "Send X a message saying Y", "Post in #channel", "Tell the client", "Reply to"
  Params: { target, message_content }

- COMMUNICATION_DRAFT: The founder wants a draft without sending.
  Patterns: "Draft a message for", "Write a response to", "Prepare a message"
  Params: { target, message_content }

- CHANNEL_CHECK: The founder wants to check channels for unanswered messages, unread activity, or see what needs a response.
  Patterns: "Check for unanswered messages", "Any unanswered messages?", "Check client channels", "What messages need a reply?", "Scan channels for me", "Any unread messages?", "Check if anyone messaged", "What's going on in the channels?", "Check slack channels", "Any clients waiting for a reply?"
  Params: { channel_name, scope: "all_client"|"all_internal"|"specific", hours_back }

- ESCALATION: Something urgent — a complaint, a crisis, or an issue needing immediate attention.
  Params: { summary, urgency: "high"|"critical" }

- GENERAL_QUERY: Anything else — questions, conversation, help, greetings.
  Params: { topic }

Use the classify_intent tool with your classification. Be decisive — pick the best matching intent.`;

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
