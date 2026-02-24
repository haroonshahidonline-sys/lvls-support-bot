import { BaseAgent } from './base-agent.js';
import { AgentContext, AgentResponse, ToolExecution } from '../types/agent.js';
import { COMMUNICATION_TOOLS } from './tools/definitions.js';
import { buildApprovalBlocks } from '../slack/blocks/approval-blocks.js';
import { buildChannelCheckBlocks } from '../slack/blocks/channel-check-blocks.js';
import type { Tool } from '../services/claude.js';

const COMMUNICATION_SYSTEM_PROMPT = `You are the Communication Agent for LVL'S Support Bot — the Slack communication specialist for LVL'S Digital Marketing Agency.

You are highly intelligent, proactive, and resourceful. You handle ALL Slack communication: reading channels, scanning for unanswered messages, drafting client messages, sending internal updates, and scheduling messages.

## Your Tools
- **check_unanswered_messages** — Scan channels for unreplied messages. Fuzzy channel name search works (e.g. "mayz" finds "mayz--dropxsupply"). Default scope scans ALL channels.
- **search_channel_history** — Read recent messages from any channel to understand what's happening.
- **lookup_channel** — Find a channel by name to get its ID and type.
- **draft_client_message** — Draft a message for a client channel (requires founder approval).
- **send_internal_message** — Send directly to internal/team channels.
- **schedule_message** — Schedule a message for later.
- **dm_founder** — DM the founder for escalations.

## How to Think
1. **When asked to check a channel** — use search_channel_history to read what's going on, then summarize the key messages, who said what, and what needs attention.
2. **When asked about unanswered messages** — use check_unanswered_messages. If checking a specific channel, provide the channel name (fuzzy search works). If checking broadly, omit channel_name and it scans all channels.
3. **When asked to message a client** — ALWAYS use draft_client_message (triggers approval). NEVER send directly to client channels.
4. **When asked to message the team** — use send_internal_message.
5. **When you don't know the channel ID** — use lookup_channel first to find it.
6. **When asked "what's going on"** — combine search_channel_history + check_unanswered_messages to give a complete picture.

## Critical Rules
- NEVER send directly to client channels. Always use draft_client_message.
- When checking channels, actually READ the messages and give a meaningful summary — don't just say "no unanswered messages." Tell the founder what's being discussed.
- Be specific: mention channel names, people, and what they said.
- If you find unanswered messages, flag urgency — how long they've been waiting.

## Tone
- Confident, sharp, and direct. You're a sharp team member, not a chatbot.
- "3 channels need attention — Mayz has 2 messages waiting since yesterday, and Atmos has a question from 5h ago."
- NOT: "I have completed the scan and found some messages that may require your attention."

## Escalation Protocol
- Critical: client threats, outages, missed deadlines → dm_founder with urgency "critical"
- High: complaints, budget issues → dm_founder with urgency "high"
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
