export const REMINDER_TYPES = {
  FIFTY_PERCENT: '50_percent',
  TWENTY_FOUR_HOUR: '24_hour',
  OVERDUE: 'overdue',
  CUSTOM: 'custom',
} as const;

export const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

export const TASK_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const CHANNEL_TYPES = {
  CLIENT: 'client',
  INTERNAL: 'internal',
  PROJECT: 'project',
  GENERAL: 'general',
} as const;

export const APPROVAL_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const APPROVAL_TYPES = {
  CLIENT_MESSAGE: 'client_message',
  CHANNEL_POST: 'channel_post',
  TASK_UPDATE: 'task_update',
} as const;

export const INTENTS = {
  TASK_ASSIGN: 'TASK_ASSIGN',
  TASK_STATUS: 'TASK_STATUS',
  TASK_COMPLETE: 'TASK_COMPLETE',
  CONTENT_REWRITE: 'CONTENT_REWRITE',
  COMMUNICATION_SEND: 'COMMUNICATION_SEND',
  COMMUNICATION_DRAFT: 'COMMUNICATION_DRAFT',
  CHANNEL_CHECK: 'CHANNEL_CHECK',
  ESCALATION: 'ESCALATION',
  GENERAL_QUERY: 'GENERAL_QUERY',
} as const;

export const DEADLINE_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export const PRAYER_DEFER_MS = 30 * 60 * 1000; // 30 minutes
