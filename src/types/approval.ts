export interface Approval {
  id: string;
  type: 'client_message' | 'channel_post' | 'task_update';
  requested_by: string | null;
  approver: string | null;
  status: 'pending' | 'approved' | 'rejected';
  payload: {
    draft_message: string;
    target_channel: string;
    original_instruction: string;
    [key: string]: unknown;
  };
  target_channel: string | null;
  slack_message_ts: string | null;
  approved_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
}
