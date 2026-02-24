import { query } from '../database/connection.js';

export async function logAudit(entry: {
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
  channel_id?: string;
}): Promise<void> {
  await query(
    `INSERT INTO audit_log (action, actor, details, channel_id)
     VALUES ($1, $2, $3, $4)`,
    [
      entry.action,
      entry.actor || null,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.channel_id || null,
    ]
  );
}
