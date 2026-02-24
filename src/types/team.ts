export interface TeamMember {
  id: string;
  name: string;
  slack_user_id: string;
  role: string | null;
  is_founder: boolean;
  timezone: string;
  created_at: Date;
}

export interface ChannelConfig {
  id: string;
  channel_id: string;
  channel_name: string | null;
  channel_type: 'client' | 'internal' | 'project' | 'general';
  client_name: string | null;
  requires_approval: boolean;
  created_at: Date;
  updated_at: Date;
}
