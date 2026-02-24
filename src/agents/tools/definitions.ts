import type Anthropic from '@anthropic-ai/sdk';

type Tool = Anthropic.Messages.Tool;

// ============================================================
// TASK AGENT TOOLS
// ============================================================

export const TASK_TOOLS: Tool[] = [
  {
    name: 'create_task',
    description: 'Create a new task and assign it to a team member. This stores the task in the database and schedules reminders.',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee_name: { type: 'string', description: 'Name of the team member to assign the task to' },
        title: { type: 'string', description: 'Short, clear task title (under 100 chars)' },
        description: { type: 'string', description: 'Detailed description of what needs to be done' },
        deadline: { type: 'string', description: 'Deadline as ISO date string or natural language (e.g., "Friday", "2026-03-01", "in 3 days")' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'Task priority level' },
      },
      required: ['assignee_name', 'title', 'description'],
    },
  },
  {
    name: 'get_tasks',
    description: 'Query tasks from the database. Can filter by person, status, or deadline scope.',
    input_schema: {
      type: 'object' as const,
      properties: {
        person_name: { type: 'string', description: 'Filter by team member name. Omit to get all tasks.' },
        scope: { type: 'string', enum: ['active', 'overdue', 'this_week', 'all'], description: 'Scope of tasks to return. Default: active' },
      },
      required: [],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed. Cancels any pending reminders for the task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search_term: { type: 'string', description: 'Part of the task title to search for' },
        person_name: { type: 'string', description: 'Optional: narrow search to a specific person' },
      },
      required: ['search_term'],
    },
  },
  {
    name: 'post_to_slack',
    description: 'Post a formatted message or task card to a specific Slack channel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel_id: { type: 'string', description: 'Slack channel ID to post to' },
        message: { type: 'string', description: 'Message text to post' },
        mention_user_id: { type: 'string', description: 'Optional: Slack user ID to @mention in the message' },
      },
      required: ['channel_id', 'message'],
    },
  },
  {
    name: 'lookup_team_member',
    description: 'Find a team member by name. Returns their Slack user ID, role, and other info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name (or partial name) of the team member' },
      },
      required: ['name'],
    },
  },
];

// ============================================================
// CONTENT AGENT TOOLS
// ============================================================

export const CONTENT_TOOLS: Tool[] = [
  {
    name: 'rewrite_content',
    description: 'Rewrite content with a specific tone, platform, and style. Returns the rewritten version.',
    input_schema: {
      type: 'object' as const,
      properties: {
        original: { type: 'string', description: 'The original content to rewrite' },
        platform: { type: 'string', enum: ['facebook_ad', 'instagram', 'email', 'slack', 'whatsapp', 'linkedin', 'general'], description: 'Target platform' },
        tone: { type: 'string', enum: ['professional', 'casual', 'urgent', 'friendly', 'bold', 'minimal'], description: 'Desired tone' },
        instructions: { type: 'string', description: 'Any specific instructions (e.g., "make it shorter", "add a CTA")' },
      },
      required: ['original'],
    },
  },
  {
    name: 'generate_variations',
    description: 'Generate multiple distinct variations of content. Good for ad copy, subject lines, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'The base content to create variations of' },
        count: { type: 'number', description: 'Number of variations to generate (2-5). Default: 3' },
        platform: { type: 'string', description: 'Target platform for the variations' },
        angle: { type: 'string', description: 'Specific angle or hook to explore (e.g., "urgency", "social proof", "benefit-focused")' },
      },
      required: ['content'],
    },
  },
  {
    name: 'adapt_for_platform',
    description: 'Take existing content and adapt it for a different platform with proper formatting and length.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'The content to adapt' },
        from_platform: { type: 'string', description: 'Original platform (if known)' },
        to_platform: { type: 'string', description: 'Target platform to adapt for' },
      },
      required: ['content', 'to_platform'],
    },
  },
];

// ============================================================
// COMMUNICATION AGENT TOOLS
// ============================================================

export const COMMUNICATION_TOOLS: Tool[] = [
  {
    name: 'draft_client_message',
    description: 'Draft a message for a client channel. This does NOT send it — it creates an approval request for the founder.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel_name: { type: 'string', description: 'Client channel name or ID' },
        context: { type: 'string', description: 'What the message should be about' },
        tone: { type: 'string', enum: ['warm', 'professional', 'excited', 'apologetic', 'neutral'], description: 'Tone of the message' },
      },
      required: ['channel_name', 'context'],
    },
  },
  {
    name: 'send_internal_message',
    description: 'Send a message directly to an internal/team channel. No approval needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel_id: { type: 'string', description: 'Internal channel ID to send to' },
        message: { type: 'string', description: 'Message to send' },
        mention_user_id: { type: 'string', description: 'Optional: user to @mention' },
      },
      required: ['channel_id', 'message'],
    },
  },
  {
    name: 'search_channel_history',
    description: 'Read recent messages from a channel to understand context before drafting a response.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel_id: { type: 'string', description: 'Channel ID to read from' },
        limit: { type: 'number', description: 'Number of recent messages to read (default: 10)' },
      },
      required: ['channel_id'],
    },
  },
  {
    name: 'lookup_channel',
    description: 'Look up a channel by name to get its ID, type (client/internal), and whether it requires approval.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Channel name (or partial name) to search for' },
      },
      required: ['name'],
    },
  },
  {
    name: 'schedule_message',
    description: 'Schedule a message to be sent at a future time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel_id: { type: 'string', description: 'Channel to send to' },
        message: { type: 'string', description: 'Message content' },
        send_at: { type: 'string', description: 'When to send (ISO date or natural language like "tomorrow 9am")' },
      },
      required: ['channel_id', 'message', 'send_at'],
    },
  },
  {
    name: 'dm_founder',
    description: 'Send a direct message to the founder (Moe). Use for escalations, approvals, and urgent flags.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Message to send to the founder' },
        urgency: { type: 'string', enum: ['normal', 'high', 'critical'], description: 'Urgency level' },
      },
      required: ['message'],
    },
  },
  {
    name: 'check_unanswered_messages',
    description: 'Scan Slack channels for unanswered messages — messages with no thread replies. Can check a specific channel by name/ID, or scan all client channels at once.',
    input_schema: {
      type: 'object' as const,
      properties: {
        channel_name: { type: 'string', description: 'Specific channel name or ID to check. Omit to scan all client channels.' },
        scope: { type: 'string', enum: ['all_client', 'all_internal', 'specific'], description: 'Which channels to scan. Default: all_client' },
        hours_back: { type: 'number', description: 'How many hours back to look for unanswered messages. Default: 24' },
      },
      required: [],
    },
  },
];

// ============================================================
// ROUTER TOOLS (for classification only)
// ============================================================

export const ROUTER_TOOLS: Tool[] = [
  {
    name: 'classify_intent',
    description: 'Classify the user message into an intent category and extract parameters.',
    input_schema: {
      type: 'object' as const,
      properties: {
        intent: {
          type: 'string',
          enum: ['TASK_ASSIGN', 'TASK_STATUS', 'TASK_COMPLETE', 'CONTENT_REWRITE', 'COMMUNICATION_SEND', 'COMMUNICATION_DRAFT', 'CHANNEL_CHECK', 'ESCALATION', 'GENERAL_QUERY'],
          description: 'The classified intent',
        },
        confidence: { type: 'number', description: 'Confidence score 0.0-1.0' },
        params: {
          type: 'object',
          description: 'Extracted parameters relevant to the intent',
          properties: {},
          additionalProperties: true,
        },
      },
      required: ['intent', 'confidence', 'params'],
    },
  },
];
