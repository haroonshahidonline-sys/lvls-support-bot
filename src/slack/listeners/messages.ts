import { App } from '@slack/bolt';
import { orchestrate } from '../../agents/orchestrator.js';
import { founderOnly } from '../middleware/founder-only.js';
import { channelGuard } from '../middleware/channel-guard.js';
import { AgentContext } from '../../types/agent.js';
import { config } from '../../config/index.js';
import { handleError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';

export function registerMessageListeners(app: App): void {
  // DM handler — founder commands
  app.message(founderOnly, channelGuard, async ({ message, say, context }) => {
    const msg = message as { text?: string; user?: string; channel?: string; ts?: string; thread_ts?: string; subtype?: string };

    // Ignore bot messages, message edits, etc.
    if (msg.subtype || !msg.text) return;

    const agentContext: AgentContext = {
      channelId: msg.channel || '',
      channelType: context.channelType || 'dm',
      userId: msg.user || '',
      threadTs: msg.thread_ts || msg.ts,
      isClientChannel: context.isClientChannel || false,
      requiresApproval: context.requiresApproval || false,
      messageText: msg.text,
    };

    try {
      logger.info({
        user: msg.user,
        channel: msg.channel,
        textPreview: msg.text.substring(0, 100),
      }, 'Processing message');

      // Run the orchestrator — it classifies + dispatches to the right agent autonomously
      const response = await orchestrate(msg.text, agentContext);

      // Handle the response based on action
      if (response.action === 'send_message' && response.metadata?.targetChannel) {
        // Agent already sent to the target channel via tools — confirm to founder
        await say({
          text: response.text || `Message sent to <#${response.metadata.targetChannel}>.`,
          thread_ts: msg.thread_ts || msg.ts,
        });
      } else if (response.action === 'create_approval' && response.blocks) {
        // Send approval request to founder DM with interactive buttons
        const result = await say({
          text: response.text,
          blocks: response.blocks as any[],
          thread_ts: msg.thread_ts || msg.ts,
        });
        // Store the message ts for later updating when founder clicks approve/reject
        if (result && response.metadata?.approvalId) {
          const { updateApprovalMessageTs } = await import('../../services/approval-service.js');
          await updateApprovalMessageTs(response.metadata.approvalId as string, (result as any).ts);
        }
      } else {
        // Regular response (task confirmation, status report, content, general chat)
        await say({
          text: response.text,
          blocks: response.blocks as any[] | undefined,
          thread_ts: msg.thread_ts || msg.ts,
        });
      }

    } catch (err) {
      logger.error({ err, user: msg.user, channel: msg.channel }, 'Message handling failed');
      const errorMessage = handleError(err, 'message-handler');
      await say({ text: errorMessage, thread_ts: msg.thread_ts || msg.ts });
    }
  });
}
