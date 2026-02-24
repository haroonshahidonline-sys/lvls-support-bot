import { Task } from '../../types/task.js';
import { TeamMember } from '../../types/team.js';
import { timeUntilDeadline, formatDate } from '../../utils/date-helpers.js';
import type { KnownBlock } from '@slack/types';

export function buildStatusBlocks(
  header: string,
  tasks: Task[],
  memberMap: Map<string, TeamMember>
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${header} (${tasks.length})`, emoji: true },
    },
    { type: 'divider' },
  ];

  const statusEmoji: Record<string, string> = {
    pending: ':hourglass:',
    in_progress: ':arrow_forward:',
    overdue: ':rotating_light:',
    completed: ':white_check_mark:',
    cancelled: ':no_entry_sign:',
  };

  for (const task of tasks.slice(0, 15)) { // Limit to 15 to stay within Block Kit limits
    const assignee = task.assigned_to ? memberMap.get(task.assigned_to) : null;
    const assigneeText = assignee ? `<@${assignee.slack_user_id}>` : 'Unassigned';
    const deadlineText = task.deadline ? `Due: ${formatDate(task.deadline)} (${timeUntilDeadline(task.deadline)})` : 'No deadline';
    const emoji = statusEmoji[task.status] || ':question:';

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${task.title}*\n${assigneeText} | ${deadlineText} | Status: _${task.status}_`,
      },
    });
  }

  if (tasks.length > 15) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `_...and ${tasks.length - 15} more tasks_` },
      ],
    });
  }

  return blocks;
}
