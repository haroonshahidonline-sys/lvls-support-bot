import { App } from '@slack/bolt';
import * as taskService from '../../services/task-service.js';
import * as teamService from '../../services/team-service.js';
import * as channelService from '../../services/channel-service.js';
import * as approvalService from '../../services/approval-service.js';
import * as reminderService from '../../services/reminder-service.js';
import * as auditService from '../../services/audit-service.js';
import { parseDeadlineFromAgent, formatDate, timeUntilDeadline } from '../../utils/date-helpers.js';
import { buildTaskCard } from '../../slack/blocks/task-blocks.js';
import { buildApprovalBlocks } from '../../slack/blocks/approval-blocks.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

let slackApp: App | null = null;

export function setSlackApp(app: App): void {
  slackApp = app;
}

export type ToolResult = {
  success: boolean;
  data: unknown;
  message: string;
};

// ============================================================
// TASK TOOLS EXECUTION
// ============================================================

export async function executeCreateTask(input: {
  assignee_name: string;
  title: string;
  description: string;
  deadline?: string;
  priority?: string;
}): Promise<ToolResult> {
  const member = await teamService.getTeamMemberByName(input.assignee_name);
  if (!member) {
    return { success: false, data: null, message: `Team member "${input.assignee_name}" not found. Available members can be looked up with lookup_team_member.` };
  }

  const founder = await teamService.getFounder();
  let deadline: Date | null = null;
  if (input.deadline) {
    deadline = parseDeadlineFromAgent(input.deadline);
  }

  const task = await taskService.createTask({
    title: input.title,
    description: input.description,
    assigned_to: member.id,
    assigned_by: founder?.id,
    priority: input.priority || 'normal',
    deadline: deadline || undefined,
  });

  if (deadline) {
    await reminderService.createRemindersForTask(task.id, task.created_at, deadline);
  }

  await auditService.logAudit({
    action: 'task_created',
    actor: config.FOUNDER_SLACK_ID,
    details: { taskId: task.id, assignee: member.name, title: task.title },
  });

  // Post task card to Slack
  if (slackApp) {
    const blocks = buildTaskCard(task, member, deadline);
    const deadlineText = deadline ? `Deadline: ${formatDate(deadline)}.` : 'No deadline set.';
    try {
      await slackApp.client.chat.postMessage({
        token: config.SLACK_BOT_TOKEN,
        channel: task.channel_id || config.FOUNDER_SLACK_ID,
        text: `<@${member.slack_user_id}> — New Task: ${task.title}. ${deadlineText}`,
        blocks: blocks as any[],
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to post task card to Slack');
    }
  }

  return {
    success: true,
    data: { taskId: task.id, assignee: member.name, assigneeSlackId: member.slack_user_id, deadline: deadline?.toISOString() },
    message: `Task "${task.title}" assigned to ${member.name}${deadline ? ` — due ${formatDate(deadline)}` : ''}. Reminders scheduled.`,
  };
}

export async function executeGetTasks(input: {
  person_name?: string;
  scope?: string;
}): Promise<ToolResult> {
  const scope = input.scope || 'active';
  let tasks;
  let label: string;

  if (scope === 'overdue') {
    tasks = await taskService.getOverdueTasks();
    label = 'Overdue tasks';
  } else if (scope === 'this_week') {
    tasks = await taskService.getTasksDueThisWeek();
    label = 'Tasks due this week';
  } else if (input.person_name) {
    const member = await teamService.getTeamMemberByName(input.person_name);
    if (!member) return { success: false, data: null, message: `Team member "${input.person_name}" not found.` };
    tasks = await taskService.getTasksByAssignee(member.id);
    label = `Active tasks for ${member.name}`;
  } else {
    tasks = await taskService.getAllActiveTasks();
    label = 'All active tasks';
  }

  const members = await teamService.getAllTeamMembers();
  const memberMap = new Map(members.map(m => [m.id, m]));

  const taskList = tasks.map(t => ({
    id: t.id.substring(0, 8),
    title: t.title,
    assignee: t.assigned_to ? memberMap.get(t.assigned_to)?.name || 'Unknown' : 'Unassigned',
    status: t.status,
    deadline: t.deadline ? formatDate(t.deadline) : 'No deadline',
    timeLeft: t.deadline ? timeUntilDeadline(t.deadline) : null,
    priority: t.priority,
  }));

  return {
    success: true,
    data: taskList,
    message: `${label}: ${tasks.length} task(s) found.`,
  };
}

export async function executeCompleteTask(input: {
  search_term: string;
  person_name?: string;
}): Promise<ToolResult> {
  let assigneeId: string | undefined;
  if (input.person_name) {
    const member = await teamService.getTeamMemberByName(input.person_name);
    assigneeId = member?.id;
  }

  const task = await taskService.findTaskByTitleSearch(input.search_term, assigneeId);
  if (!task) return { success: false, data: null, message: `No active task found matching "${input.search_term}".` };

  await taskService.updateTaskStatus(task.id, 'completed');
  await reminderService.cancelRemindersForTask(task.id);

  await auditService.logAudit({
    action: 'task_completed',
    actor: config.FOUNDER_SLACK_ID,
    details: { taskId: task.id, title: task.title },
  });

  return {
    success: true,
    data: { taskId: task.id, title: task.title },
    message: `Task "${task.title}" marked as complete. Reminders cancelled.`,
  };
}

export async function executeLookupTeamMember(input: { name: string }): Promise<ToolResult> {
  const member = await teamService.getTeamMemberByName(input.name);
  if (!member) {
    const all = await teamService.getAllTeamMembers();
    return {
      success: false,
      data: { available: all.map(m => m.name) },
      message: `No member found matching "${input.name}". Available: ${all.map(m => m.name).join(', ')}`,
    };
  }
  return {
    success: true,
    data: { id: member.id, name: member.name, slackId: member.slack_user_id, role: member.role },
    message: `Found: ${member.name} (${member.role}) — Slack ID: ${member.slack_user_id}`,
  };
}

export async function executePostToSlack(input: {
  channel_id: string;
  message: string;
  mention_user_id?: string;
}): Promise<ToolResult> {
  if (!slackApp) return { success: false, data: null, message: 'Slack app not initialized.' };

  const text = input.mention_user_id
    ? `<@${input.mention_user_id}> ${input.message}`
    : input.message;

  try {
    await slackApp.client.chat.postMessage({
      token: config.SLACK_BOT_TOKEN,
      channel: input.channel_id,
      text,
    });
    return { success: true, data: null, message: `Message posted to <#${input.channel_id}>.` };
  } catch (err) {
    return { success: false, data: null, message: `Failed to post: ${(err as Error).message}` };
  }
}

// ============================================================
// COMMUNICATION TOOLS EXECUTION
// ============================================================

export async function executeDraftClientMessage(input: {
  channel_name: string;
  context: string;
  tone?: string;
}): Promise<ToolResult> {
  // Resolve channel
  const channelConfig = await channelService.getChannelConfig(input.channel_name);
  const channelId = channelConfig?.channel_id || input.channel_name;

  const approval = await approvalService.createApproval({
    type: 'client_message',
    requested_by: 'bot',
    payload: {
      draft_message: '', // Will be filled by the agent's response
      target_channel: channelId,
      original_instruction: input.context,
      tone: input.tone || 'warm',
    },
    target_channel: channelId,
  });

  return {
    success: true,
    data: { approvalId: approval.id, channelId, requiresApproval: true },
    message: `Approval request created for client channel <#${channelId}>. Draft the message and it will be sent to the founder for approval.`,
  };
}

export async function executeSendInternalMessage(input: {
  channel_id: string;
  message: string;
  mention_user_id?: string;
}): Promise<ToolResult> {
  // Verify it's not a client channel
  const channelConfig = await channelService.getChannelConfig(input.channel_id);
  if (channelConfig?.channel_type === 'client') {
    return { success: false, data: null, message: 'This is a client channel — use draft_client_message instead. Client channels require founder approval.' };
  }

  return executePostToSlack(input);
}

export async function executeSearchChannelHistory(input: {
  channel_id: string;
  limit?: number;
}): Promise<ToolResult> {
  if (!slackApp) return { success: false, data: null, message: 'Slack app not initialized.' };

  try {
    const result = await slackApp.client.conversations.history({
      token: config.SLACK_BOT_TOKEN,
      channel: input.channel_id,
      limit: input.limit || 10,
    });

    const messages = (result.messages || []).map(m => ({
      user: (m as any).user,
      text: (m as any).text?.substring(0, 300),
      ts: m.ts,
    }));

    return {
      success: true,
      data: messages,
      message: `Retrieved ${messages.length} recent messages from <#${input.channel_id}>.`,
    };
  } catch (err) {
    return { success: false, data: null, message: `Failed to read channel: ${(err as Error).message}` };
  }
}

export async function executeLookupChannel(input: { name: string }): Promise<ToolResult> {
  // Search by channel name in our database
  const { query } = await import('../../database/connection.js');
  const result = await query(
    `SELECT * FROM channels_config WHERE LOWER(channel_name) LIKE LOWER($1) OR LOWER(client_name) LIKE LOWER($1)`,
    [`%${input.name}%`]
  );

  if (result.rows.length === 0) {
    return { success: false, data: null, message: `No channel found matching "${input.name}".` };
  }

  const ch = result.rows[0] as any;
  return {
    success: true,
    data: { channelId: ch.channel_id, name: ch.channel_name, type: ch.channel_type, clientName: ch.client_name, requiresApproval: ch.requires_approval },
    message: `Found: #${ch.channel_name} (${ch.channel_type}${ch.requires_approval ? ', approval required' : ''})`,
  };
}

export async function executeScheduleMessage(input: {
  channel_id: string;
  message: string;
  send_at: string;
}): Promise<ToolResult> {
  if (!slackApp) return { success: false, data: null, message: 'Slack app not initialized.' };

  const sendAt = parseDeadlineFromAgent(input.send_at);
  if (!sendAt) return { success: false, data: null, message: `Could not parse date: "${input.send_at}"` };

  try {
    await slackApp.client.chat.scheduleMessage({
      token: config.SLACK_BOT_TOKEN,
      channel: input.channel_id,
      text: input.message,
      post_at: Math.floor(sendAt.getTime() / 1000),
    });
    return { success: true, data: null, message: `Message scheduled for ${formatDate(sendAt)} in <#${input.channel_id}>.` };
  } catch (err) {
    return { success: false, data: null, message: `Failed to schedule: ${(err as Error).message}` };
  }
}

export async function executeDmFounder(input: {
  message: string;
  urgency?: string;
}): Promise<ToolResult> {
  if (!slackApp) return { success: false, data: null, message: 'Slack app not initialized.' };

  const urgencyPrefix: Record<string, string> = {
    normal: '',
    high: ':warning: *HIGH PRIORITY* — ',
    critical: ':rotating_light: *CRITICAL* — ',
  };
  const prefix = urgencyPrefix[input.urgency || 'normal'] || '';

  try {
    await slackApp.client.chat.postMessage({
      token: config.SLACK_BOT_TOKEN,
      channel: config.FOUNDER_SLACK_ID,
      text: `${prefix}${input.message}`,
    });
    return { success: true, data: null, message: 'DM sent to founder.' };
  } catch (err) {
    return { success: false, data: null, message: `Failed to DM founder: ${(err as Error).message}` };
  }
}

// ============================================================
// CHANNEL CHECK TOOLS EXECUTION
// ============================================================

export async function executeCheckUnansweredMessages(input: {
  channel_name?: string;
  scope?: string;
  hours_back?: number;
}): Promise<ToolResult> {
  if (!slackApp) return { success: false, data: null, message: 'Slack app not initialized.' };

  const hoursBack = input.hours_back || 24;
  const oldest = Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000).toString();
  const scope = input.scope || (input.channel_name ? 'specific' : 'all_client');

  // Resolve which channels to scan
  let channelsToScan: { id: string; name: string; type: string }[] = [];

  if (scope === 'specific' && input.channel_name) {
    // Look up specific channel
    const channelConfig = await channelService.getChannelConfig(input.channel_name);
    if (channelConfig) {
      channelsToScan.push({ id: channelConfig.channel_id, name: channelConfig.channel_name || channelConfig.channel_id, type: channelConfig.channel_type });
    } else {
      // Try using it as a channel ID directly
      channelsToScan.push({ id: input.channel_name, name: input.channel_name, type: 'unknown' });
    }
  } else {
    // Query all channels of the requested type from DB
    const { query: dbQuery } = await import('../../database/connection.js');
    const channelType = scope === 'all_internal' ? 'internal' : 'client';
    const result = await dbQuery(
      `SELECT channel_id, channel_name, channel_type FROM channels_config WHERE channel_type = $1`,
      [channelType]
    );
    channelsToScan = result.rows.map((r: any) => ({ id: r.channel_id, name: r.channel_name, type: r.channel_type }));
  }

  if (channelsToScan.length === 0) {
    return { success: false, data: null, message: 'No channels found to scan.' };
  }

  const unansweredByChannel: {
    channel: string;
    channelId: string;
    messages: { user: string; text: string; ts: string; age: string }[];
  }[] = [];

  let totalUnanswered = 0;

  for (const ch of channelsToScan) {
    try {
      const history = await slackApp.client.conversations.history({
        token: config.SLACK_BOT_TOKEN,
        channel: ch.id,
        oldest,
        limit: 50,
      });

      const unanswered: { user: string; text: string; ts: string; age: string }[] = [];

      for (const msg of history.messages || []) {
        const m = msg as any;
        // Skip bot messages, subtypes (joins, topic changes, etc.), and threaded replies
        if (m.subtype || m.bot_id || m.thread_ts !== undefined) continue;
        // Skip messages that already have replies
        if (m.reply_count && m.reply_count > 0) continue;

        const msgAge = Date.now() / 1000 - parseFloat(m.ts);
        const hoursAgo = Math.round(msgAge / 3600);
        const ageLabel = hoursAgo < 1 ? 'less than 1h ago' : `${hoursAgo}h ago`;

        unanswered.push({
          user: m.user || 'unknown',
          text: (m.text || '').substring(0, 200),
          ts: m.ts,
          age: ageLabel,
        });
      }

      if (unanswered.length > 0) {
        totalUnanswered += unanswered.length;
        unansweredByChannel.push({
          channel: ch.name,
          channelId: ch.id,
          messages: unanswered,
        });
      }
    } catch (err) {
      logger.warn({ err, channel: ch.name }, 'Failed to read channel for unanswered check');
      // Continue scanning other channels
    }
  }

  if (totalUnanswered === 0) {
    return {
      success: true,
      data: { channelsScanned: channelsToScan.length, unanswered: [] },
      message: `Scanned ${channelsToScan.length} channel(s) — no unanswered messages found in the last ${hoursBack} hours.`,
    };
  }

  return {
    success: true,
    data: { channelsScanned: channelsToScan.length, totalUnanswered, unansweredByChannel },
    message: `Found ${totalUnanswered} unanswered message(s) across ${unansweredByChannel.length} channel(s) in the last ${hoursBack} hours.`,
  };
}

// ============================================================
// TOOL DISPATCH
// ============================================================

export async function executeTool(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
  switch (toolName) {
    // Task tools
    case 'create_task': return executeCreateTask(input as any);
    case 'get_tasks': return executeGetTasks(input as any);
    case 'complete_task': return executeCompleteTask(input as any);
    case 'post_to_slack': return executePostToSlack(input as any);
    case 'lookup_team_member': return executeLookupTeamMember(input as any);

    // Communication tools
    case 'draft_client_message': return executeDraftClientMessage(input as any);
    case 'send_internal_message': return executeSendInternalMessage(input as any);
    case 'search_channel_history': return executeSearchChannelHistory(input as any);
    case 'lookup_channel': return executeLookupChannel(input as any);
    case 'schedule_message': return executeScheduleMessage(input as any);
    case 'dm_founder': return executeDmFounder(input as any);
    case 'check_unanswered_messages': return executeCheckUnansweredMessages(input as any);

    // Content tools are handled differently (they return Claude text, not DB actions)
    case 'rewrite_content':
    case 'generate_variations':
    case 'adapt_for_platform':
      return { success: true, data: input, message: 'Content tool — handled by agent text response.' };

    // Router
    case 'classify_intent':
      return { success: true, data: input, message: 'Classification complete.' };

    default:
      return { success: false, data: null, message: `Unknown tool: ${toolName}` };
  }
}
