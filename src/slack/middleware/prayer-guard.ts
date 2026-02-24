import { Middleware, SlackEventMiddlewareArgs } from '@slack/bolt';
import { shouldDeferMessage, getNextAvailableTime } from '../../services/prayer-time-service.js';
import { formatDateTime } from '../../utils/date-helpers.js';
import { logger } from '../../utils/logger.js';

export const prayerGuard: Middleware<SlackEventMiddlewareArgs<'message'>> = async ({ message, say, next }) => {
  // Prayer guard only defers non-urgent automated messages
  // The founder can still interact during prayer times — this mainly affects
  // outbound messages to team members and reminders
  // For now, we just attach the flag and let individual handlers decide
  await next();
};

// Helper for use by agents and workers — they check this before sending
export function checkPrayerTimeForSending(): { shouldDefer: boolean; nextAvailable: Date | null } {
  if (shouldDeferMessage()) {
    const nextAvailable = getNextAvailableTime();
    logger.info({ nextAvailable }, 'Message deferred due to prayer time');
    return { shouldDefer: true, nextAvailable };
  }
  return { shouldDefer: false, nextAvailable: null };
}
