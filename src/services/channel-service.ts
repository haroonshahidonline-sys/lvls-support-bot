import { query } from '../database/connection.js';
import { ChannelConfig } from '../types/team.js';

export async function getChannelConfig(channelId: string): Promise<ChannelConfig | null> {
  const result = await query<ChannelConfig>(
    'SELECT * FROM channels_config WHERE channel_id = $1',
    [channelId]
  );
  return result.rows[0] || null;
}

export async function upsertChannelConfig(channel: {
  channel_id: string;
  channel_name?: string;
  channel_type: string;
  client_name?: string;
  requires_approval?: boolean;
}): Promise<ChannelConfig> {
  const result = await query<ChannelConfig>(
    `INSERT INTO channels_config (channel_id, channel_name, channel_type, client_name, requires_approval)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (channel_id) DO UPDATE SET
       channel_name = EXCLUDED.channel_name,
       channel_type = EXCLUDED.channel_type,
       client_name = EXCLUDED.client_name,
       requires_approval = EXCLUDED.requires_approval,
       updated_at = NOW()
     RETURNING *`,
    [
      channel.channel_id,
      channel.channel_name || null,
      channel.channel_type,
      channel.client_name || null,
      channel.requires_approval ?? false,
    ]
  );
  return result.rows[0];
}

export async function isClientChannel(channelId: string): Promise<boolean> {
  const config = await getChannelConfig(channelId);
  return config?.channel_type === 'client';
}

export async function requiresApproval(channelId: string): Promise<boolean> {
  const config = await getChannelConfig(channelId);
  return config?.requires_approval ?? false;
}
