import { logger } from './logger.js';

export class BotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BotError';
  }
}

export function handleError(error: unknown, context?: string): string {
  if (error instanceof BotError) {
    logger.error({ code: error.code, context: error.context, recoverable: error.recoverable }, `[${context}] ${error.message}`);
    return error.recoverable
      ? `Something went wrong: ${error.message}. I'll try to recover.`
      : `I ran into an issue: ${error.message}. Let me flag this for review.`;
  }

  if (error instanceof Error) {
    logger.error({ stack: error.stack }, `[${context}] Unexpected error: ${error.message}`);
    return 'Something went wrong processing your request. I\'ve logged the error for review.';
  }

  logger.error({ error }, `[${context}] Unknown error`);
  return 'An unexpected error occurred. I\'ve logged it for review.';
}
