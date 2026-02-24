export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  channel_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  deadline: Date | null;
  completed_at: Date | null;
  reminder_50_sent: boolean;
  reminder_24h_sent: boolean;
  overdue_flagged: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Reminder {
  id: string;
  task_id: string;
  type: '50_percent' | '24_hour' | 'overdue' | 'custom';
  scheduled_for: Date;
  sent: boolean;
  sent_at: Date | null;
  bullmq_job_id: string | null;
  created_at: Date;
}
