import type { KnownBlock } from '@slack/types';

interface UnansweredMessage {
  user: string;
  text: string;
  ts: string;
  age: string;
}

interface ChannelResult {
  channel: string;
  channelId: string;
  messages: UnansweredMessage[];
}

interface CheckResult {
  channelsScanned: number;
  skippedChannels?: number;
  totalUnanswered?: number;
  unansweredByChannel?: ChannelResult[];
}

export function buildChannelCheckBlocks(data: CheckResult): KnownBlock[] {
  const blocks: KnownBlock[] = [];
  const total = data.totalUnanswered || 0;
  const channels = data.unansweredByChannel || [];

  if (total === 0) {
    // Clean "all clear" message
    blocks.push(
      {
        type: 'header',
        text: { type: 'plain_text', text: ':white_check_mark:  All Clear', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Scanned *${data.channelsScanned}* channel(s) — no unanswered messages found.`,
        },
      },
    );

    if (data.skippedChannels && data.skippedChannels > 0) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `:lock: _${data.skippedChannels} private channel(s) skipped — invite the bot to access them_` },
        ],
      });
    }

    return blocks;
  }

  // Header with count
  blocks.push(
    {
      type: 'header',
      text: { type: 'plain_text', text: `:mailbox_with_mail:  ${total} Unanswered Message${total !== 1 ? 's' : ''}`, emoji: true },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Scanned *${data.channelsScanned}* channel(s) | *${channels.length}* need attention` },
      ],
    },
    { type: 'divider' },
  );

  // Each channel with its unanswered messages
  for (const ch of channels.slice(0, 10)) { // Limit to 10 channels for Block Kit
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:speech_balloon:  *<#${ch.channelId}>*  —  ${ch.messages.length} unanswered`,
      },
    });

    // Show up to 5 messages per channel
    const msgLines = ch.messages.slice(0, 5).map(m => {
      const preview = m.text.length > 120 ? m.text.substring(0, 120) + '...' : m.text;
      return `>  <@${m.user}> _(${m.age})_: ${preview}`;
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: msgLines.join('\n'),
      },
    });

    if (ch.messages.length > 5) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `_...and ${ch.messages.length - 5} more in this channel_` },
        ],
      });
    }
  }

  if (channels.length > 10) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `_...and ${channels.length - 10} more channel(s) with unanswered messages_` },
      ],
    });
  }

  if (data.skippedChannels && data.skippedChannels > 0) {
    blocks.push(
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `:lock: _${data.skippedChannels} private channel(s) skipped — invite the bot to access them_` },
        ],
      },
    );
  }

  return blocks;
}
