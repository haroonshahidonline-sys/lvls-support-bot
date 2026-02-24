import { Middleware, SlackEventMiddlewareArgs } from '@slack/bolt';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export const founderOnly: Middleware<SlackEventMiddlewareArgs<'message'>> = async ({ message, next }) => {
  // Allow messages from the founder only for command processing
  const msg = message as { user?: string };
  if (msg.user !== config.FOUNDER_SLACK_ID) {
    logger.debug({ user: msg.user }, 'Non-founder message, skipping command processing');
    return; // Silently ignore non-founder messages
  }
  await next();
};
