import { Task } from '../../types/task.js';
import { TeamMember } from '../../types/team.js';
import { formatDate, timeUntilDeadline } from '../../utils/date-helpers.js';
import type { KnownBlock } from '@slack/types';

export function buildReminderBlocks(
  task: Task,
  assignee: TeamMember,
  reminderType: '50_percent' | '24_hour' | 'overdue'
): KnownBlock[] {
  const typeLabels: Record<string, string> = {
    '50_percent': ':hourglass_flowing_sand: Halfway Reminder',
    '24_hour': ':warning: 24-Hour Reminder',
    overdue: ':rotating_light: Overdue Alert',
  };

  const label = typeLabels[reminderType] || 'Reminder';
  const deadlineText = task.deadline ? formatDate(task.deadline) : 'No deadline';
  const remaining = task.deadline ? timeUntilDeadline(task.deadline) : 'N/A';

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: label, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<@${assignee.slack_user_id}> — *${task.title}*`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Deadline:*\n${deadlineText}` },
        { type: 'mrkdwn', text: `*Time remaining:*\n${remaining}` },
      ],
    },
    ...(task.description ? [{
      type: 'context' as const,
      elements: [
        { type: 'mrkdwn' as const, text: task.description.substring(0, 200) },
      ],
    }] : []),
    { type: 'divider' },
  ];
}

export function buildOverdueDigestBlocks(
  tasks: Array<{ task: Task; assignee: TeamMember | null }>
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: ':rotating_light: Overdue Tasks Digest', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `You have *${tasks.length}* overdue task${tasks.length > 1 ? 's' : ''}:`,
      },
    },
    { type: 'divider' },
  ];

  for (const { task, assignee } of tasks.slice(0, 10)) {
    const assigneeText = assignee ? `<@${assignee.slack_user_id}>` : 'Unassigned';
    const deadlineText = task.deadline ? formatDate(task.deadline) : 'No deadline';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:red_circle: *${task.title}*\nAssigned to: ${assigneeText} | Was due: ${deadlineText}`,
      },
    });
  }

  return blocks;
}
