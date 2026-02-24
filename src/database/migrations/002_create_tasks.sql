CREATE TABLE IF NOT EXISTS tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    assigned_to         UUID REFERENCES team_members(id),
    assigned_by         UUID REFERENCES team_members(id),
    channel_id          VARCHAR(20),
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
    priority            VARCHAR(10) DEFAULT 'normal'
                        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    deadline            TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    reminder_50_sent    BOOLEAN DEFAULT FALSE,
    reminder_24h_sent   BOOLEAN DEFAULT FALSE,
    overdue_flagged     BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
