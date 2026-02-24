import { query } from '../database/connection.js';
import { TeamMember } from '../types/team.js';

export async function getTeamMemberBySlackId(slackId: string): Promise<TeamMember | null> {
  const result = await query<TeamMember>(
    'SELECT * FROM team_members WHERE slack_user_id = $1',
    [slackId]
  );
  return result.rows[0] || null;
}

export async function getTeamMemberByName(name: string): Promise<TeamMember | null> {
  const result = await query<TeamMember>(
    'SELECT * FROM team_members WHERE LOWER(name) LIKE LOWER($1)',
    [`%${name}%`]
  );
  return result.rows[0] || null;
}

export async function getTeamMemberById(id: string): Promise<TeamMember | null> {
  const result = await query<TeamMember>(
    'SELECT * FROM team_members WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function getAllTeamMembers(): Promise<TeamMember[]> {
  const result = await query<TeamMember>('SELECT * FROM team_members ORDER BY name');
  return result.rows;
}

export async function getFounder(): Promise<TeamMember | null> {
  const result = await query<TeamMember>(
    'SELECT * FROM team_members WHERE is_founder = TRUE LIMIT 1'
  );
  return result.rows[0] || null;
}

export async function upsertTeamMember(member: {
  name: string;
  slack_user_id: string;
  role?: string;
  is_founder?: boolean;
  timezone?: string;
}): Promise<TeamMember> {
  const result = await query<TeamMember>(
    `INSERT INTO team_members (name, slack_user_id, role, is_founder, timezone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (slack_user_id) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       is_founder = EXCLUDED.is_founder,
       timezone = EXCLUDED.timezone
     RETURNING *`,
    [member.name, member.slack_user_id, member.role || null, member.is_founder || false, member.timezone || 'America/New_York']
  );
  return result.rows[0];
}
