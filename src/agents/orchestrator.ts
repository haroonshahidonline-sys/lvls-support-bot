import { classifyMessage } from './router.js';
import { taskAgent } from './task-agent.js';
import { contentAgent } from './content-agent.js';
import { communicationAgent } from './communication-agent.js';
import { callClaude, setModel, getActiveModelName, getAvailableModels } from '../services/claude.js';
import { AgentContext, AgentResponse, AgentRunResult } from '../types/agent.js';
import { INTENTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

// Pattern: "switch to opus", "use sonnet", "model opus", "switch model to haiku"
const MODEL_SWITCH_PATTERN = /^(?:switch\s+(?:to\s+|model\s+(?:to\s+)?)?|use\s+|model\s+)(\w+)\s*$/i;
const MODEL_STATUS_PATTERN = /^(?:what\s+model|which\s+model|current\s+model|model\s*\?)\s*$/i;

const GENERAL_SYSTEM_PROMPT = `You are LVL'S Support, the AI assistant for LVL'S Digital Marketing Agency. You operate inside Slack as the founder's right-hand assistant.

You're sharp, confident, and proactive. Not robotic — you speak like a smart team member.

LVL'S specializes in Facebook ads + Content Studio (UGC + professional ad content). 5-person team, 40+ active clients.

You ARE fully connected to this Slack workspace and can:
- Assign tasks with deadlines and auto-reminders
- Check task status and flag overdue items
- Read any Slack channel and summarize what's happening
- Scan all channels for unanswered messages
- Rewrite marketing copy and generate ad variations
- Draft and send messages (client = approval required, internal = direct)
- Schedule messages and DM team members

When asked to do something actionable, say "I'll handle that — just tell me to [specific action]" instead of listing what you could theoretically do. Be concise and helpful. Greet warmly when greeted.`;

/**
 * Main orchestrator — classifies the message, dispatches to the right agent,
 * and returns the final response.
 */
export async function orchestrate(message: string, context: AgentContext): Promise<AgentResponse> {
  // Step 0: Check for model switch commands (handled before routing)
  const modelSwitch = MODEL_SWITCH_PATTERN.exec(message.trim());
  if (modelSwitch) {
    const result = setModel(modelSwitch[1]);
    logger.info({ model: result.model, success: result.success }, 'Model switch requested');
    return { text: result.message, action: 'none' };
  }

  const modelStatus = MODEL_STATUS_PATTERN.test(message.trim());
  if (modelStatus) {
    const current = getActiveModelName();
    const available = Object.keys(getAvailableModels()).join(', ');
    return {
      text: `Currently using *${current}*. Available models: ${available}.\n\nSay "switch to opus" or "use sonnet" to change.`,
      action: 'none',
    };
  }

  // Step 1: Classify the message intent
  const classification = await classifyMessage(message, context);

  logger.info({
    intent: classification.intent,
    confidence: classification.confidence,
    params: classification.params,
  }, 'Orchestrator: message classified');

  // Step 2: Dispatch to the right agent
  // Each agent now runs autonomously with tools — we pass the original message
  // plus the router's extracted params as context
  const enrichedMessage = buildEnrichedMessage(message, classification.params);

  let result: AgentRunResult | null = null;

  switch (classification.intent) {
    case INTENTS.TASK_ASSIGN:
    case INTENTS.TASK_STATUS:
    case INTENTS.TASK_COMPLETE:
      result = await taskAgent.run(enrichedMessage, context);
      break;

    case INTENTS.CONTENT_REWRITE:
      result = await contentAgent.run(enrichedMessage, context);
      break;

    case INTENTS.COMMUNICATION_SEND:
    case INTENTS.COMMUNICATION_DRAFT:
    case INTENTS.CHANNEL_CHECK:
      result = await communicationAgent.run(enrichedMessage, context);
      break;

    case INTENTS.ESCALATION: {
      // For escalations, use the communication agent to DM the founder
      const summary = classification.params.summary as string || message;
      const urgency = classification.params.urgency as string || 'high';
      const escalationMessage = `ESCALATION detected. The founder said: "${message}"\n\nSummary: ${summary}\nUrgency: ${urgency}\n\nUse dm_founder to alert the founder about this escalation, then respond confirming what you did.`;
      result = await communicationAgent.run(escalationMessage, context);
      break;
    }

    case INTENTS.GENERAL_QUERY:
    default: {
      // General queries go through simple Claude (no tools needed)
      // Include thread history for conversation continuity
      const generalMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (context.threadHistory && context.threadHistory.length > 0) {
        generalMessages.push(...context.threadHistory);
      }
      generalMessages.push({ role: 'user', content: message });

      const generalResponse = await callClaude({
        systemPrompt: GENERAL_SYSTEM_PROMPT,
        messages: generalMessages,
      });
      return { text: generalResponse, action: 'none' };
    }
  }

  if (result) {
    logger.info({
      intent: classification.intent,
      toolsUsed: result.toolsExecuted.map(t => t.toolName),
      turns: result.turns,
      tokens: result.totalTokens,
    }, 'Orchestrator: agent run complete');

    return result.response;
  }

  return { text: 'Something went wrong processing your request. Please try again.', action: 'none' };
}

/**
 * Build an enriched message that includes the original text plus
 * any parameters the router extracted, giving the agent more context.
 */
function buildEnrichedMessage(originalMessage: string, params: Record<string, unknown>): string {
  const paramEntries = Object.entries(params).filter(([_, v]) => v != null);

  if (paramEntries.length === 0) {
    return originalMessage;
  }

  const paramStr = paramEntries
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
    .join('\n');

  return `${originalMessage}\n\n[Router extracted parameters:\n${paramStr}\n]`;
}
