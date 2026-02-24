import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { addDays, addHours, nextFriday, nextMonday, nextTuesday, nextWednesday, nextThursday, nextSaturday, nextSunday, isAfter, isBefore, startOfDay, endOfDay, differenceInMilliseconds } from 'date-fns';
import { config } from '../config/index.js';

const tz = config.TIMEZONE;

export function formatDate(date: Date): string {
  return formatInTimeZone(date, tz, 'EEEE, MMMM d, yyyy');
}

export function formatDateTime(date: Date): string {
  return formatInTimeZone(date, tz, 'EEEE, MMMM d, yyyy h:mm a zzz');
}

export function nowInTimezone(): Date {
  return toZonedTime(new Date(), tz);
}

export function parseDeadlineFromAgent(deadlineStr: string): Date | null {
  // The Claude agent will return ISO strings or relative descriptions
  // First try ISO parse
  const isoDate = new Date(deadlineStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const now = new Date();
  const lower = deadlineStr.toLowerCase().trim();

  // Handle relative expressions
  if (lower === 'today' || lower === 'end of day' || lower === 'eod') {
    return endOfDay(now);
  }
  if (lower === 'tomorrow') {
    return endOfDay(addDays(now, 1));
  }

  // Day name mapping
  const dayMap: Record<string, (date: Date) => Date> = {
    monday: nextMonday,
    tuesday: nextTuesday,
    wednesday: nextWednesday,
    thursday: nextThursday,
    friday: nextFriday,
    saturday: nextSaturday,
    sunday: nextSunday,
  };

  for (const [day, nextDayFn] of Object.entries(dayMap)) {
    if (lower.includes(day)) {
      return endOfDay(nextDayFn(now));
    }
  }

  // "in X hours"
  const hoursMatch = lower.match(/in\s+(\d+)\s+hours?/);
  if (hoursMatch) {
    return addHours(now, parseInt(hoursMatch[1]));
  }

  // "in X days"
  const daysMatch = lower.match(/in\s+(\d+)\s+days?/);
  if (daysMatch) {
    return endOfDay(addDays(now, parseInt(daysMatch[1])));
  }

  return null;
}

export function calculateReminderTimes(createdAt: Date, deadline: Date): { fiftyPercent: Date; twentyFourHour: Date } {
  const totalMs = differenceInMilliseconds(deadline, createdAt);
  const halfwayMs = totalMs / 2;

  const fiftyPercent = new Date(createdAt.getTime() + halfwayMs);
  const twentyFourHour = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);

  return { fiftyPercent, twentyFourHour };
}

export function isOverdue(deadline: Date): boolean {
  return isAfter(new Date(), deadline);
}

export function timeUntilDeadline(deadline: Date): string {
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) return 'overdue';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${hours}h`;
}
