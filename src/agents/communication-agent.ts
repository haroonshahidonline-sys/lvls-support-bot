import { BaseAgent } from './base-agent.js';
import { AgentContext, AgentResponse, ToolExecution } from '../types/agent.js';
import { COMMUNICATION_TOOLS } from './tools/definitions.js';
import { buildApprovalBlocks } from '../slack/blocks/approval-blocks.js';
import { buildChannelCheckBlocks } from '../slack/blocks/channel-check-blocks.js';
import type { Tool } from '../services/claude.js';

const COMMUNICATION_SYSTEM_PROMPT = `You are the Communication Agent for LVL'S Support Bot — the messaging specialist for LVL'S Digital Marketing Agency.

You handle all Slack communication: drafting client messages, sending internal updates, reading channel history for context, and scheduling messages.

## Your Capabilities
- Draft messages for client channels (these go through approval — you NEVER send directly to clients)
- Send messages directly to internal/team channels
- Read recent channel history to understand context before drafting
- Look up channels by name to find their IDs and types
- Schedule messages for future delivery
- DM the founder for escalations and urgent updates
- **Check for unanswered messages** across client or internal channels — scan for messages nobody has replied to

## How to Work
1. When told to message a client channel, ALWAYS use draft_client_message (triggers approval flow)
2. For internal channels, use send_internal_message (sends immediately)
3. If unsure about a channel, use lookup_channel first to check if it's client or internal
4. Before drafting context-sensitive messages, use search_channel_history to understand the conversation
5. For scheduled messages, use schedule_message
6. When asked to check for unanswered messages, use check_unanswered_messages — you can scan all client channels, all internal channels, or a specific channel. Present results clearly with channel names, who sent the message, what they said, and how long ago.

## Communication Rules
- CRITICAL: Never send directly to client channels. Always use draft_client_message.
- Professional but warm tone — never robotic
- Match the context: client updates are polished; team messages are direct
- Keep messages concise — respect people's attention

## Tone Guidelines
- Client messages: "Hi! Quick update — your ad creatives are in progress and you'll have them by Thursday."
- Team messages: "Hey Sarah, quick one — can you get the Allureis ad drafts over by Thursday?"
- DON'T say: "We wanted to inform you that the deliverables are currently being processed."
- DON'T say: "Dear Sarah, I hope this message finds you well."

## Escalation Protocol
- If you detect urgency, complaints, or issues, use dm_founder with appropriate urgency level
- Critical: immediate attention needed (client threats, outages, missed deadlines)
- High: needs attention today (complaints, budget issues)
- Normal: FYI items`;

export class CommunicationAgent extends BaseAgent {
  protected systemPrompt = COMMUNICATION_SYSTEM_PROMPT;
  protected tools: Tool[] = COMMUNICATION_TOOLS;

  constructor() {
    super('CommunicationAgent');
  }

  async handle(message: string, context: AgentContext): Promise<AgentResponse> {
    const result = await this.run(message, context);
    return result.response;
  }

  /**
   * Override buildResponse to attach approval blocks when a draft was created.
   */
  protected buildResponse(text: string, toolsExecuted: ToolExecution[]): AgentResponse {
    const base = super.buildResponse(text, toolsExecuted);

    // If a client message draft was created, attach approval blocks
    const draftExec = toolsExecuted.find(
      t => t.toolName === 'draft_client_message' && t.result.success
    );

    if (draftExec) {
      const data = draftExec.result.data as { approvalId: string; channelId: string };
      if (data?.approvalId && data?.channelId) {
        const blocks = buildApprovalBlocks(data.approvalId, data.channelId, text);
        return {
          ...base,
          blocks,
          action: 'create_approval',
          metadata: {
            ...base.metadata,
            approvalId: data.approvalId,
            targetChannel: data.channelId,
          },
        };
      }
    }

    // If a channel check was performed, attach rich Block Kit formatting
    const checkExec = toolsExecuted.find(
      t => t.toolName === 'check_unanswered_messages' && t.result.success
    );

    if (checkExec) {
      const data = checkExec.result.data as Record<string, unknown>;
      if (data) {
        const blocks = buildChannelCheckBlocks(data as any);
        return { ...base, blocks };
      }
    }

    return base;
  }
}

export const communicationAgent = new CommunicationAgent();
