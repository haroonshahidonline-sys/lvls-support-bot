import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const connection = {
  host: new URL(config.REDIS_URL).hostname || 'localhost',
  port: parseInt(new URL(config.REDIS_URL).port || '6379'),
};

// Reminder queue
export const reminderQueue = new Queue('reminders', { connection });

// Deadline checker queue (repeatable job)
export const deadlineQueue = new Queue('deadline-checks', { connection });

export function createReminderWorker(processor: (job: Job) => Promise<void>): Worker {
  const worker = new Worker('reminders', processor, {
    connection,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, jobName: job.name }, 'Reminder job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err }, 'Reminder job failed');
  });

  return worker;
}

export function createDeadlineWorker(processor: (job: Job) => Promise<void>): Worker {
  const worker = new Worker('deadline-checks', processor, {
    connection,
    concurrency: 1,
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Deadline check completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Deadline check failed');
  });

  return worker;
}

export async function scheduleReminder(
  reminderId: string,
  taskId: string,
  reminderType: string,
  delayMs: number
): Promise<string | undefined> {
  const job = await reminderQueue.add(
    'send-reminder',
    { reminderId, taskId, reminderType },
    { delay: Math.max(0, delayMs), attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
  return job.id;
}

export async function startDeadlineChecker(): Promise<void> {
  // Add a repeatable job that runs every 15 minutes
  await deadlineQueue.add(
    'check-deadlines',
    {},
    {
      repeat: {
        every: 15 * 60 * 1000, // 15 minutes
      },
    }
  );
  logger.info('Deadline checker scheduled (every 15 minutes)');
}
