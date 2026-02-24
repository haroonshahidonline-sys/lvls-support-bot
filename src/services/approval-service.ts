import { query } from '../database/connection.js';
import { Approval } from '../types/approval.js';

export async function createApproval(approval: {
  type: string;
  requested_by?: string;
  approver?: string;
  payload: Record<string, unknown>;
  target_channel?: string;
  slack_message_ts?: string;
}): Promise<Approval> {
  const result = await query<Approval>(
    `INSERT INTO approvals (type, requested_by, approver, payload, target_channel, slack_message_ts)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      approval.type,
      approval.requested_by || null,
      approval.approver || null,
      JSON.stringify(approval.payload),
      approval.target_channel || null,
      approval.slack_message_ts || null,
    ]
  );
  return result.rows[0];
}

export async function getApprovalById(id: string): Promise<Approval | null> {
  const result = await query<Approval>(
    'SELECT * FROM approvals WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function getPendingApprovals(): Promise<Approval[]> {
  const result = await query<Approval>(
    `SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function approveApproval(id: string): Promise<Approval | null> {
  const result = await query<Approval>(
    `UPDATE approvals SET status = 'approved', approved_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

export async function rejectApproval(id: string, reason?: string): Promise<Approval | null> {
  const result = await query<Approval>(
    `UPDATE approvals SET status = 'rejected', rejected_at = NOW(), rejection_reason = $2 WHERE id = $1 RETURNING *`,
    [id, reason || null]
  );
  return result.rows[0] || null;
}

export async function updateApprovalPayload(id: string, payload: Record<string, unknown>): Promise<Approval | null> {
  const result = await query<Approval>(
    `UPDATE approvals SET payload = $2 WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(payload)]
  );
  return result.rows[0] || null;
}

export async function updateApprovalMessageTs(id: string, messageTs: string): Promise<void> {
  await query('UPDATE approvals SET slack_message_ts = $2 WHERE id = $1', [id, messageTs]);
}
