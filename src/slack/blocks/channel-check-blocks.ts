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

  // ── ALL CLEAR ─────────────────────────────────────
  if (total === 0) {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:white_check_mark:  *All clear* — scanned *${data.channelsScanned}* channels, no unanswered messages.`,
        },
      },
    );

    if (data.skippedChannels && data.skippedChannels > 0) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `:lock: ${data.skippedChannels} private channel(s) skipped` },
        ],
      });
    }

    return blocks;
  }

  // ── HEADER ────────────────────────────────────────
  const urgencyEmoji = total >= 10 ? ':rotating_light:' : total >= 5 ? ':warning:' : ':mailbox_with_mail:';

  blocks.push(
    {
      type: 'header',
      text: { type: 'plain_text', text: `${urgencyEmoji}  ${total} Unanswered Message${total !== 1 ? 's' : ''} Found`, emoji: true },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*${data.channelsScanned}* channels scanned  |  *${channels.length}* with unanswered messages` },
      ],
    },
    { type: 'divider' },
  );

  // ── CHANNEL SECTIONS ──────────────────────────────
  for (const ch of channels.slice(0, 10)) {
    // Channel header
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:speech_balloon:  <#${ch.channelId}>  ·  *${ch.messages.length}* unanswered`,
      },
    });

    // Messages as compact quote blocks
    const msgLines = ch.messages.slice(0, 5).map(m => {
      const preview = m.text.length > 100 ? m.text.substring(0, 100) + '…' : m.text;
      return `> <@${m.user}>  _${m.age}_\n> ${preview}`;
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: msgLines.join('\n\n'),
      },
    });

    if (ch.messages.length > 5) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `+ ${ch.messages.length - 5} more in this channel` },
        ],
      });
    }

    blocks.push({ type: 'divider' });
  }

  // ── OVERFLOW NOTE ─────────────────────────────────
  if (channels.length > 10) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `+ *${channels.length - 10}* more channels with unanswered messages` },
      ],
    });
  }

  // ── SKIP NOTE ─────────────────────────────────────
  if (data.skippedChannels && data.skippedChannels > 0) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `:lock: ${data.skippedChannels} private channel(s) skipped — invite the bot to access them` },
      ],
    });
  }

  return blocks;
}
