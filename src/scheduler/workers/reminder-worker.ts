import { Job } from 'bullmq';
import * as taskService from '../../services/task-service.js';
import * as teamService from '../../services/team-service.js';
import * as reminderService from '../../services/reminder-service.js';
import * as auditService from '../../services/audit-service.js';
import { checkPrayerTimeForSending } from '../../slack/middleware/prayer-guard.js';
import { buildReminderBlocks } from '../../slack/blocks/reminder-blocks.js';
import { scheduleReminder } from '../queue.js';
import { config } from '../../config/index.js';
import { PRAYER_DEFER_MS } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';
import { App } from '@slack/bolt';

let slackApp: App | null = null;

export function setSlackApp(app: App): void {
  slackApp = app;
}

export async function processReminder(job: Job): Promise<void> {
  const { reminderId, taskId, reminderType } = job.data;

  // Check prayer time
  const prayerCheck = checkPrayerTimeForSending();
  if (prayerCheck.shouldDefer) {
    logger.info({ reminderId, nextAvailable: prayerCheck.nextAvailable }, 'Deferring reminder due to prayer time');
    // Re-schedule with 30 min delay
    await scheduleReminder(reminderId, taskId, reminderType, PRAYER_DEFER_MS);
    return;
  }

  // Get the task
  const task = await taskService.getTaskById(taskId);
  if (!task) {
    logger.warn({ taskId }, 'Task not found for reminder, skipping');
    return;
  }

  // Skip if task is already completed or cancelled
  if (task.status === 'completed' || task.status === 'cancelled') {
    logger.info({ taskId, status: task.status }, 'Task already done, skipping reminder');
    await reminderService.markReminderSent(reminderId);
    return;
  }

  // Get the assignee
  if (!task.assigned_to) {
    logger.warn({ taskId }, 'Task has no assignee, skipping reminder');
    return;
  }

  const assignee = await teamService.getTeamMemberById(task.assigned_to);
  if (!assignee) {
    logger.warn({ taskId, assignedTo: task.assigned_to }, 'Assignee not found, skipping reminder');
    return;
  }

  if (!slackApp) {
    logger.error('Slack app not initialized for reminder worker');
    return;
  }

  // Build reminder message
  const blocks = buildReminderBlocks(task, assignee, reminderType);

  // Determine where to send
  const channel = task.channel_id || assignee.slack_user_id;

  // Send the reminder
  try {
    await slackApp.client.chat.postMessage({
      token: config.SLACK_BOT_TOKEN,
      channel,
      text: `Reminder: "${task.title}" — ${reminderType === '50_percent' ? 'Halfway through the deadline' : reminderType === '24_hour' ? 'Due in 24 hours' : 'Overdue!'}`,
      blocks: blocks as any[],
    });

    // Mark as sent
    await reminderService.markReminderSent(reminderId);

    // Update task flags
    if (reminderType === '50_percent') {
      await taskService.markReminder50Sent(taskId);
    } else if (reminderType === '24_hour') {
      await taskService.markReminder24hSent(taskId);
    }

    await auditService.logAudit({
      action: 'reminder_sent',
      details: { taskId, reminderId, reminderType, assignee: assignee.name },
      channel_id: channel,
    });

    logger.info({ reminderId, taskId, reminderType, assignee: assignee.name }, 'Reminder sent');
  } catch (err) {
    logger.error({ err, reminderId, taskId }, 'Failed to send reminder');
    throw err; // BullMQ will retry
  }
}
