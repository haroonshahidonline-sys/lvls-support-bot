CREATE TABLE IF NOT EXISTS approvals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                VARCHAR(30) NOT NULL
                        CHECK (type IN ('client_message', 'channel_post', 'task_update')),
    requested_by        VARCHAR(20),
    approver            UUID REFERENCES team_members(id),
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
    payload             JSONB NOT NULL,
    target_channel      VARCHAR(20),
    slack_message_ts    VARCHAR(30),
    approved_at         TIMESTAMPTZ,
    rejected_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status) WHERE status = 'pending';
