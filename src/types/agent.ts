import { INTENTS } from '../config/constants.js';

export type Intent = (typeof INTENTS)[keyof typeof INTENTS];

export interface RouterResult {
  intent: Intent;
  confidence: number;
  params: Record<string, unknown>;
}

export interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentContext {
  channelId: string;
  channelType: string;
  userId: string;
  threadTs?: string;
  isClientChannel: boolean;
  requiresApproval: boolean;
  messageText: string;
  /** Previous messages in this thread (for conversation continuity) */
  threadHistory?: ThreadMessage[];
}

export interface AgentResponse {
  text: string;
  blocks?: unknown[];
  action?: 'send_message' | 'create_approval' | 'create_task' | 'none';
  metadata?: Record<string, unknown>;
}

export interface ToolExecution {
  toolName: string;
  toolInput: Record<string, unknown>;
  result: {
    success: boolean;
    data: unknown;
    message: string;
  };
}

export interface AgentRunResult {
  /** Final text response from the agent */
  response: AgentResponse;
  /** All tools the agent executed during this run */
  toolsExecuted: ToolExecution[];
  /** Total tokens used */
  totalTokens: { input: number; output: number };
  /** Number of agentic turns (Claude calls) */
  turns: number;
}
