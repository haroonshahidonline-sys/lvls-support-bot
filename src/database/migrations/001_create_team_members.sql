CREATE TABLE IF NOT EXISTS team_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    slack_user_id   VARCHAR(20) NOT NULL UNIQUE,
    role            VARCHAR(50),
    is_founder      BOOLEAN DEFAULT FALSE,
    timezone        VARCHAR(50) DEFAULT 'America/New_York',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
