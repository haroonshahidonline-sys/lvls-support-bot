CREATE TABLE IF NOT EXISTS reminders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('50_percent', '24_hour', 'overdue', 'custom')),
    scheduled_for   TIMESTAMPTZ NOT NULL,
    sent            BOOLEAN DEFAULT FALSE,
    sent_at         TIMESTAMPTZ,
    bullmq_job_id   VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_for) WHERE sent = FALSE;
