import { App } from '@slack/bolt';
import * as channelService from '../../services/channel-service.js';
import { joinChannel } from '../../services/channel-join-service.js';
import { logger } from '../../utils/logger.js';

/**
 * Detect channel type from name and return config fields.
 */
function detectChannelType(channelName: string) {
  let channelType = 'general';
  let clientName: string | undefined;
  let requiresApproval = false;

  if (channelName.startsWith('client_') || channelName.startsWith('client-')) {
    channelType = 'client';
    requiresApproval = true;
    const raw = channelName.replace(/^client[_-]/, '').replace(/-(?:foundation|momentum|domination|standard|marketing|trial)$/, '');
    clientName = raw.split(/[-_]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } else if (channelName.startsWith('team_') || channelName.startsWith('team-')) {
    channelType = 'internal';
  }

  return { channelType, clientName, requiresApproval };
}

export function registerEventListeners(app: App): void {
  // When the bot joins a new channel, auto-register it
  app.event('member_joined_channel', async ({ event, client }) => {
    try {
      const botInfo = await client.auth.test();
      if (event.user !== botInfo.user_id) return;

      const channelInfo = await client.conversations.info({ channel: event.channel });
      const channelName = (channelInfo.channel as any)?.name || 'unknown';
      const { channelType, clientName, requiresApproval } = detectChannelType(channelName);

      const existing = await channelService.getChannelConfig(event.channel);
      if (!existing) {
        await channelService.upsertChannelConfig({
          channel_id: event.channel,
          channel_name: channelName,
          channel_type: channelType,
          client_name: clientName,
          requires_approval: requiresApproval,
        });
        logger.info({ channelId: event.channel, channelName, channelType }, 'Auto-registered new channel');
      }
    } catch (err) {
      logger.error({ err }, 'Error handling member_joined_channel');
    }
  });

  // When a new channel is created in the workspace, auto-join it
  app.event('channel_created', async ({ event }) => {
    try {
      const ch = (event as any).channel;
      const channelId = ch?.id;
      const channelName = ch?.name || 'unknown';

      if (!channelId) return;

      const success = await joinChannel(channelId);
      if (success) {
        const { channelType, clientName, requiresApproval } = detectChannelType(channelName);

        await channelService.upsertChannelConfig({
          channel_id: channelId,
          channel_name: channelName,
          channel_type: channelType,
          client_name: clientName,
          requires_approval: requiresApproval,
        });

        logger.info({ channelId, channelName, channelType }, 'Auto-joined and registered new channel');
      }
    } catch (err) {
      logger.error({ err }, 'Error handling channel_created');
    }
  });
}
