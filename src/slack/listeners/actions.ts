import { App } from '@slack/bolt';
import * as approvalService from '../../services/approval-service.js';
import * as auditService from '../../services/audit-service.js';
import { buildApprovalResultBlocks } from '../blocks/approval-blocks.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { handleError } from '../../utils/error-handler.js';

export function registerActionListeners(app: App): void {
  // Approve button
  app.action('approval_approve', async ({ ack, body, client }) => {
    await ack();

    try {
      const action = (body as any).actions?.[0];
      const approvalId = action?.value;

      if (!approvalId) {
        logger.error('No approval ID found in action');
        return;
      }

      const approval = await approvalService.approveApproval(approvalId);
      if (!approval) {
        logger.error({ approvalId }, 'Approval not found');
        return;
      }

      const payload = approval.payload;
      const targetChannel = payload.target_channel as string;
      const message = payload.draft_message as string;

      // Send the approved message to the target channel
      await client.chat.postMessage({
        token: config.SLACK_BOT_TOKEN,
        channel: targetChannel,
        text: message,
      });

      // Update the approval message to show it was approved
      const resultBlocks = buildApprovalResultBlocks(targetChannel, 'approved', message);

      if (approval.slack_message_ts && (body as any).channel?.id) {
        await client.chat.update({
          token: config.SLACK_BOT_TOKEN,
          channel: (body as any).channel.id,
          ts: approval.slack_message_ts,
          text: 'Approved and sent',
          blocks: resultBlocks as any[],
        });
      }

      await auditService.logAudit({
        action: 'message_approved',
        actor: (body as any).user?.id,
        details: { approvalId, targetChannel, messagePreview: message.substring(0, 100) },
        channel_id: targetChannel,
      });

      logger.info({ approvalId, targetChannel }, 'Message approved and sent');
    } catch (err) {
      logger.error({ err }, 'Error handling approval');
    }
  });

  // Edit button — opens modal with pre-filled draft
  app.action('approval_edit', async ({ ack, body, client }) => {
    await ack();

    try {
      const action = (body as any).actions?.[0];
      const approvalId = action?.value;

      if (!approvalId) return;

      const approval = await approvalService.getApprovalById(approvalId);
      if (!approval) return;

      const draftMessage = approval.payload.draft_message as string;

      await client.views.open({
        trigger_id: (body as any).trigger_id,
        view: {
          type: 'modal',
          callback_id: 'approval_edit_submit',
          private_metadata: approvalId,
          title: { type: 'plain_text', text: 'Edit Message' },
          submit: { type: 'plain_text', text: 'Update & Approve' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Target:* <#${approval.target_channel}>`,
              },
            },
            {
              type: 'input',
              block_id: 'message_input',
              label: { type: 'plain_text', text: 'Message' },
              element: {
                type: 'plain_text_input',
                action_id: 'message_text',
                multiline: true,
                initial_value: draftMessage,
              },
            },
          ],
        },
      });
    } catch (err) {
      logger.error({ err }, 'Error opening edit modal');
    }
  });

  // Modal submission — edit and approve
  app.view('approval_edit_submit', async ({ ack, body, view, client }) => {
    await ack();

    try {
      const approvalId = view.private_metadata;
      const editedMessage = view.state.values.message_input.message_text.value;

      if (!approvalId || !editedMessage) return;

      // Update the payload with edited message
      const approval = await approvalService.getApprovalById(approvalId);
      if (!approval) return;

      const updatedPayload = { ...approval.payload, draft_message: editedMessage };
      await approvalService.updateApprovalPayload(approvalId, updatedPayload);

      // Auto-approve after edit
      const approved = await approvalService.approveApproval(approvalId);
      if (!approved) return;

      const targetChannel = approved.payload.target_channel as string;

      // Send the edited message
      await client.chat.postMessage({
        token: config.SLACK_BOT_TOKEN,
        channel: targetChannel,
        text: editedMessage,
      });

      // Update the original approval message
      if (approved.slack_message_ts) {
        const resultBlocks = buildApprovalResultBlocks(targetChannel, 'approved', editedMessage);

        // Find the DM channel — we need the founder's DM channel
        const founderDm = await client.conversations.open({
          token: config.SLACK_BOT_TOKEN,
          users: config.FOUNDER_SLACK_ID,
        });

        if (founderDm.channel?.id) {
          await client.chat.update({
            token: config.SLACK_BOT_TOKEN,
            channel: founderDm.channel.id,
            ts: approved.slack_message_ts,
            text: 'Edited, approved, and sent',
            blocks: resultBlocks as any[],
          });
        }
      }

      await auditService.logAudit({
        action: 'message_edited_and_approved',
        actor: body.user.id,
        details: { approvalId, targetChannel, editedMessage: editedMessage.substring(0, 100) },
        channel_id: targetChannel,
      });

      logger.info({ approvalId, targetChannel }, 'Message edited, approved, and sent');
    } catch (err) {
      logger.error({ err }, 'Error handling edit submission');
    }
  });

  // Reject button
  app.action('approval_reject', async ({ ack, body, client }) => {
    await ack();

    try {
      const action = (body as any).actions?.[0];
      const approvalId = action?.value;

      if (!approvalId) return;

      const approval = await approvalService.rejectApproval(approvalId);
      if (!approval) return;

      const targetChannel = approval.target_channel || '';

      // Update the approval message
      const resultBlocks = buildApprovalResultBlocks(targetChannel, 'rejected');

      if (approval.slack_message_ts && (body as any).channel?.id) {
        await client.chat.update({
          token: config.SLACK_BOT_TOKEN,
          channel: (body as any).channel.id,
          ts: approval.slack_message_ts,
          text: 'Rejected',
          blocks: resultBlocks as any[],
        });
      }

      await auditService.logAudit({
        action: 'message_rejected',
        actor: (body as any).user?.id,
        details: { approvalId, targetChannel },
        channel_id: targetChannel,
      });

      logger.info({ approvalId }, 'Message rejected');
    } catch (err) {
      logger.error({ err }, 'Error handling rejection');
    }
  });
}
