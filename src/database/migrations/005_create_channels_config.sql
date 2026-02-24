CREATE TABLE IF NOT EXISTS channels_config (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id          VARCHAR(20) NOT NULL UNIQUE,
    channel_name        VARCHAR(100),
    channel_type        VARCHAR(20) NOT NULL
                        CHECK (channel_type IN ('client', 'internal', 'project', 'general')),
    client_name         VARCHAR(100),
    requires_approval   BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
