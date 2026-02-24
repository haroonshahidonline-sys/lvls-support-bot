import { App } from '@slack/bolt';
import * as channelService from '../../services/channel-service.js';
import { logger } from '../../utils/logger.js';

export function registerEventListeners(app: App): void {
  // When the bot joins a new channel, auto-register it as unknown type
  app.event('member_joined_channel', async ({ event, client }) => {
    try {
      // Check if the bot itself joined
      const botInfo = await client.auth.test();
      if (event.user !== botInfo.user_id) return;

      // Get channel info
      const channelInfo = await client.conversations.info({ channel: event.channel });
      const channelName = (channelInfo.channel as any)?.name || 'unknown';

      // Auto-register with default type
      const existing = await channelService.getChannelConfig(event.channel);
      if (!existing) {
        await channelService.upsertChannelConfig({
          channel_id: event.channel,
          channel_name: channelName,
          channel_type: 'general', // Default — founder can reconfigure
        });
        logger.info({ channelId: event.channel, channelName }, 'Auto-registered new channel');
      }
    } catch (err) {
      logger.error({ err }, 'Error handling member_joined_channel');
    }
  });
}
