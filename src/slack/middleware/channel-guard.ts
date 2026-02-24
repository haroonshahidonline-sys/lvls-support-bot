import { Middleware, SlackEventMiddlewareArgs } from '@slack/bolt';
import * as channelService from '../../services/channel-service.js';
import { logger } from '../../utils/logger.js';

// Extend the context to include channel metadata
declare module '@slack/bolt' {
  interface Context {
    channelType?: string;
    isClientChannel?: boolean;
    requiresApproval?: boolean;
  }
}

export const channelGuard: Middleware<SlackEventMiddlewareArgs<'message'>> = async ({ message, context, next }) => {
  const msg = message as { channel?: string };
  const channelId = msg.channel;

  if (channelId) {
    const channelConfig = await channelService.getChannelConfig(channelId);

    context.channelType = channelConfig?.channel_type || 'unknown';
    context.isClientChannel = channelConfig?.channel_type === 'client';
    context.requiresApproval = channelConfig?.requires_approval || false;
  } else {
    context.channelType = 'dm';
    context.isClientChannel = false;
    context.requiresApproval = false;
  }

  await next();
};
