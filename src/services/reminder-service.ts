import { query } from '../database/connection.js';
import { Reminder } from '../types/task.js';
import { calculateReminderTimes } from '../utils/date-helpers.js';

export async function createRemindersForTask(
  taskId: string,
  createdAt: Date,
  deadline: Date
): Promise<Reminder[]> {
  const { fiftyPercent, twentyFourHour } = calculateReminderTimes(createdAt, deadline);
  const reminders: Reminder[] = [];
  const now = new Date();

  // Only create reminders that are in the future
  if (fiftyPercent > now) {
    const r1 = await query<Reminder>(
      `INSERT INTO reminders (task_id, type, scheduled_for)
       VALUES ($1, '50_percent', $2)
       RETURNING *`,
      [taskId, fiftyPercent]
    );
    reminders.push(r1.rows[0]);
  }

  if (twentyFourHour > now) {
    const r2 = await query<Reminder>(
      `INSERT INTO reminders (task_id, type, scheduled_for)
       VALUES ($1, '24_hour', $2)
       RETURNING *`,
      [taskId, twentyFourHour]
    );
    reminders.push(r2.rows[0]);
  }

  return reminders;
}

export async function getUnsentReminders(): Promise<Reminder[]> {
  const result = await query<Reminder>(
    `SELECT * FROM reminders
     WHERE sent = FALSE AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC`
  );
  return result.rows;
}

export async function markReminderSent(reminderId: string): Promise<void> {
  await query(
    'UPDATE reminders SET sent = TRUE, sent_at = NOW() WHERE id = $1',
    [reminderId]
  );
}

export async function updateReminderJobId(reminderId: string, jobId: string): Promise<void> {
  await query(
    'UPDATE reminders SET bullmq_job_id = $1 WHERE id = $2',
    [jobId, reminderId]
  );
}

export async function cancelRemindersForTask(taskId: string): Promise<void> {
  await query(
    'UPDATE reminders SET sent = TRUE WHERE task_id = $1 AND sent = FALSE',
    [taskId]
  );
}
