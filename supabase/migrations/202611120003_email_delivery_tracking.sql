-- Track email provider acceptance separately from recipient delivery.
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS email_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS email_accepted_at TIMESTAMPTZ;
