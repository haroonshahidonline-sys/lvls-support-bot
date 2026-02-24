import { Job } from 'bullmq';
import * as taskService from '../../services/task-service.js';
import * as teamService from '../../services/team-service.js';
import * as auditService from '../../services/audit-service.js';
import { buildOverdueDigestBlocks } from '../../slack/blocks/reminder-blocks.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { App } from '@slack/bolt';

let slackApp: App | null = null;

export function setSlackApp(app: App): void {
  slackApp = app;
}

export async function processDeadlineCheck(job: Job): Promise<void> {
  logger.info('Running deadline check...');

  const overdueTasks = await taskService.getOverdueTasks();

  if (overdueTasks.length === 0) {
    logger.debug('No overdue tasks found');
    return;
  }

  // Resolve assignees
  const tasksWithAssignees = await Promise.all(
    overdueTasks.map(async (task) => {
      const assignee = task.assigned_to ? await teamService.getTeamMemberById(task.assigned_to) : null;
      return { task, assignee };
    })
  );

  // Mark all as overdue/flagged
  for (const { task } of tasksWithAssignees) {
    await taskService.markTaskOverdueFlagged(task.id);
  }

  if (!slackApp) {
    logger.error('Slack app not initialized for deadline checker');
    return;
  }

  // Send overdue digest to founder
  const blocks = buildOverdueDigestBlocks(tasksWithAssignees);

  try {
    await slackApp.client.chat.postMessage({
      token: config.SLACK_BOT_TOKEN,
      channel: config.FOUNDER_SLACK_ID,
      text: `You have ${overdueTasks.length} overdue task(s) that need attention.`,
      blocks: blocks as any[],
    });

    await auditService.logAudit({
      action: 'overdue_digest_sent',
      details: {
        taskCount: overdueTasks.length,
        taskIds: overdueTasks.map(t => t.id),
      },
    });

    logger.info({ count: overdueTasks.length }, 'Overdue digest sent to founder');
  } catch (err) {
    logger.error({ err }, 'Failed to send overdue digest');
    throw err;
  }
}
