import { App } from '@slack/bolt';
import { config } from '../config/index.js';
import * as channelService from './channel-service.js';
import { logger } from '../utils/logger.js';

let slackApp: App | null = null;

export function setSlackApp(app: App): void {
  slackApp = app;
}

/**
 * Join a single channel by ID. Safe to call if already a member.
 */
export async function joinChannel(channelId: string): Promise<boolean> {
  if (!slackApp) return false;

  try {
    await slackApp.client.conversations.join({
      token: config.SLACK_BOT_TOKEN,
      channel: channelId,
    });
    return true;
  } catch (err) {
    const msg = (err as Error).message || '';
    // already_in_channel is fine, method_not_supported_for_channel_type means it's a DM/private
    if (msg.includes('already_in_channel')) return true;
    if (msg.includes('method_not_supported_for_channel_type') || msg.includes('channel_not_found') || msg.includes('is_archived')) {
      return false;
    }
    logger.debug({ err, channelId }, 'Could not join channel');
    return false;
  }
}

/**
 * Join ALL public channels in the workspace on startup.
 * Also registers any unknown channels in the DB.
 */
export async function joinAllChannels(): Promise<{ joined: number; alreadyIn: number; skipped: number }> {
  if (!slackApp) return { joined: 0, alreadyIn: 0, skipped: 0 };

  let joined = 0;
  let alreadyIn = 0;
  let skipped = 0;
  let cursor: string | undefined;

  try {
    do {
      const result = await slackApp.client.conversations.list({
        token: config.SLACK_BOT_TOKEN,
        types: 'public_channel',
        exclude_archived: true,
        limit: 200,
        cursor,
      });

      for (const channel of result.channels || []) {
        const chId = channel.id!;
        const chName = (channel as any).name || 'unknown';

        if ((channel as any).is_member) {
          alreadyIn++;
        } else {
          const success = await joinChannel(chId);
          if (success) {
            joined++;
          } else {
            skipped++;
            continue;
          }
        }

        // Register in DB if not already there
        const existing = await channelService.getChannelConfig(chId);
        if (!existing) {
          // Auto-detect channel type from name
          let channelType = 'general';
          let clientName: string | undefined;
          let requiresApproval = false;

          if (chName.startsWith('client_') || chName.startsWith('client-')) {
            channelType = 'client';
            requiresApproval = true;
            // Extract client name: "client_allureis-foundation" → "Allureis Foundation"
            const raw = chName.replace(/^client[_-]/, '').replace(/-(?:foundation|momentum|domination|standard|marketing|trial)$/, '');
            clientName = raw.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          } else if (chName.startsWith('team_') || chName.startsWith('team-')) {
            channelType = 'internal';
          }

          await channelService.upsertChannelConfig({
            channel_id: chId,
            channel_name: chName,
            channel_type: channelType,
            client_name: clientName,
            requires_approval: requiresApproval,
          });
        }
      }

      cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor);

    logger.info({ joined, alreadyIn, skipped }, 'Channel auto-join complete');
    return { joined, alreadyIn, skipped };

  } catch (err) {
    logger.error({ err }, 'Failed to auto-join channels');
    return { joined, alreadyIn, skipped };
  }
}
