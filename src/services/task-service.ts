import { query } from '../database/connection.js';
import { Task } from '../types/task.js';

export async function createTask(task: {
  title: string;
  description?: string;
  assigned_to?: string;
  assigned_by?: string;
  channel_id?: string;
  priority?: string;
  deadline?: Date;
}): Promise<Task> {
  const result = await query<Task>(
    `INSERT INTO tasks (title, description, assigned_to, assigned_by, channel_id, priority, deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      task.title,
      task.description || null,
      task.assigned_to || null,
      task.assigned_by || null,
      task.channel_id || null,
      task.priority || 'normal',
      task.deadline || null,
    ]
  );
  return result.rows[0];
}

export async function getTaskById(id: string): Promise<Task | null> {
  const result = await query<Task>('SELECT * FROM tasks WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getTasksByAssignee(assigneeId: string, statusFilter?: string): Promise<Task[]> {
  if (statusFilter) {
    const result = await query<Task>(
      'SELECT * FROM tasks WHERE assigned_to = $1 AND status = $2 ORDER BY deadline ASC NULLS LAST',
      [assigneeId, statusFilter]
    );
    return result.rows;
  }
  const result = await query<Task>(
    `SELECT * FROM tasks WHERE assigned_to = $1 AND status NOT IN ('completed', 'cancelled') ORDER BY deadline ASC NULLS LAST`,
    [assigneeId]
  );
  return result.rows;
}

export async function getAllActiveTasks(): Promise<Task[]> {
  const result = await query<Task>(
    `SELECT * FROM tasks WHERE status NOT IN ('completed', 'cancelled') ORDER BY deadline ASC NULLS LAST`
  );
  return result.rows;
}

export async function getOverdueTasks(): Promise<Task[]> {
  const result = await query<Task>(
    `SELECT * FROM tasks
     WHERE status IN ('pending', 'in_progress')
       AND deadline IS NOT NULL
       AND deadline < NOW()
       AND overdue_flagged = FALSE
     ORDER BY deadline ASC`
  );
  return result.rows;
}

export async function getTasksDueThisWeek(): Promise<Task[]> {
  const result = await query<Task>(
    `SELECT * FROM tasks
     WHERE status NOT IN ('completed', 'cancelled')
       AND deadline IS NOT NULL
       AND deadline <= NOW() + INTERVAL '7 days'
     ORDER BY deadline ASC`
  );
  return result.rows;
}

export async function updateTaskStatus(taskId: string, status: string): Promise<Task | null> {
  const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
  const result = await query<Task>(
    `UPDATE tasks SET status = $1, completed_at = ${completedAt}, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, taskId]
  );
  return result.rows[0] || null;
}

export async function markTaskOverdueFlagged(taskId: string): Promise<void> {
  await query('UPDATE tasks SET overdue_flagged = TRUE, status = $1, updated_at = NOW() WHERE id = $2', ['overdue', taskId]);
}

export async function markReminder50Sent(taskId: string): Promise<void> {
  await query('UPDATE tasks SET reminder_50_sent = TRUE, updated_at = NOW() WHERE id = $1', [taskId]);
}

export async function markReminder24hSent(taskId: string): Promise<void> {
  await query('UPDATE tasks SET reminder_24h_sent = TRUE, updated_at = NOW() WHERE id = $1', [taskId]);
}

export async function findTaskByTitleSearch(searchTerm: string, assigneeId?: string): Promise<Task | null> {
  if (assigneeId) {
    const result = await query<Task>(
      `SELECT * FROM tasks WHERE assigned_to = $1 AND LOWER(title) LIKE LOWER($2) AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC LIMIT 1`,
      [assigneeId, `%${searchTerm}%`]
    );
    return result.rows[0] || null;
  }
  const result = await query<Task>(
    `SELECT * FROM tasks WHERE LOWER(title) LIKE LOWER($1) AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC LIMIT 1`,
    [`%${searchTerm}%`]
  );
  return result.rows[0] || null;
}
