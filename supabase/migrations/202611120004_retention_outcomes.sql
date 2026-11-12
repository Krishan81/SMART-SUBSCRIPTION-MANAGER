-- Track actual retention outcomes separately from email acceptance.
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'UNKNOWN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'actions'::regclass
      AND conname = 'actions_outcome_check'
  ) THEN
    ALTER TABLE actions
      ADD CONSTRAINT actions_outcome_check
      CHECK (outcome IN ('RETAINED', 'CHURNED', 'UNCONFIRMED', 'UNKNOWN'));
  END IF;
END $$;
