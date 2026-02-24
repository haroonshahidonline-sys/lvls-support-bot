import type { KnownBlock } from '@slack/types';

export function buildApprovalBlocks(
  approvalId: string,
  targetChannel: string,
  draftMessage: string
): KnownBlock[] {
  // Indent the draft message for quoting
  const quotedMessage = draftMessage.split('\n').map(line => `> ${line}`).join('\n');

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Approval Required', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Target channel:* <#${targetChannel}>`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Draft message:*\n${quotedMessage}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve', emoji: true },
          style: 'primary',
          action_id: 'approval_approve',
          value: approvalId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Edit', emoji: true },
          action_id: 'approval_edit',
          value: approvalId,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject', emoji: true },
          style: 'danger',
          action_id: 'approval_reject',
          value: approvalId,
        },
      ],
    },
  ];
}

export function buildApprovalResultBlocks(
  targetChannel: string,
  status: 'approved' | 'rejected',
  message?: string
): KnownBlock[] {
  const emoji = status === 'approved' ? ':white_check_mark:' : ':x:';
  const statusText = status === 'approved' ? 'Approved and sent' : 'Rejected';

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${statusText}* — Target: <#${targetChannel}>${message ? `\n> ${message.substring(0, 200)}` : ''}`,
      },
    },
  ];
}
