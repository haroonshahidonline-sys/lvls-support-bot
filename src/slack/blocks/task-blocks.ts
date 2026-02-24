import { Task } from '../../types/task.js';
import { TeamMember } from '../../types/team.js';
import { formatDate, timeUntilDeadline } from '../../utils/date-helpers.js';
import type { KnownBlock } from '@slack/types';

export function buildTaskCard(task: Task, assignee: TeamMember, deadline: Date | null): KnownBlock[] {
  const deadlineText = deadline
    ? `${formatDate(deadline)} (${timeUntilDeadline(deadline)})`
    : 'No deadline set';

  const priorityEmoji: Record<string, string> = {
    low: ':white_circle:',
    normal: ':large_blue_circle:',
    high: ':large_orange_circle:',
    urgent: ':red_circle:',
  };

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'New Task Assigned', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Assigned to:*\n<@${assignee.slack_user_id}>` },
        { type: 'mrkdwn', text: `*Priority:*\n${priorityEmoji[task.priority] || ':white_circle:'} ${task.priority}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Task:*\n${task.title}` },
    },
    ...(task.description ? [{
      type: 'section' as const,
      text: { type: 'mrkdwn' as const, text: `*Details:*\n${task.description}` },
    }] : []),
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Deadline:*\n${deadlineText}` },
        { type: 'mrkdwn', text: `*Status:*\n${task.status}` },
      ],
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Task ID: \`${task.id.substring(0, 8)}\` | Let me know once you've started!` },
      ],
    },
    { type: 'divider' },
  ];
}
