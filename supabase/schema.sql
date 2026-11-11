-- ================================================================
-- SUBSCRIPTION RISK MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Author: STUDENT 4 — DATABASE / INTEGRATION LEAD
-- Target DB: Supabase PostgreSQL
-- File: supabase/schema.sql
-- ================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------
-- 1. SUBSCRIBERS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    paypal_subscription_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level TEXT NOT NULL DEFAULT 'Low' CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
    risk_reason TEXT,
    recommended_action TEXT CHECK (recommended_action IS NULL OR recommended_action IN ('fix_payment_nudge', 'discount_30', 'pause_offer', 'none')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_paypal_id ON subscribers(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_risk_level ON subscribers(risk_level);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);

-- ----------------------------------------------------------------
-- 2. EVENTS TABLE (PayPal Webhook & System Timeline)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    paypal_event_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for event timeline lookups & duplicate detection
CREATE INDEX IF NOT EXISTS idx_events_subscriber_id ON events(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_events_paypal_event_id ON events(paypal_event_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- ----------------------------------------------------------------
-- 3. ACTIONS TABLE (Recovery & Churn Prevention Actions)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('fix_payment_nudge', 'discount_30', 'pause_offer', 'none')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'EXECUTED', 'REJECTED')),
    email_content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

-- Indexes for action filtering & queue management
CREATE INDEX IF NOT EXISTS idx_actions_subscriber_id ON actions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_action_type ON actions(action_type);

-- ----------------------------------------------------------------
-- TRIGGER: Automatically update `updated_at` on subscribers
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscribers_updated_at ON subscribers;
CREATE TRIGGER trigger_subscribers_updated_at
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- Remove permissive public write access policies
DROP POLICY IF EXISTS "Allow public write access to subscribers" ON subscribers;
DROP POLICY IF EXISTS "Allow public write access to events" ON events;
DROP POLICY IF EXISTS "Allow public write access to actions" ON actions;
-- Keep read access as needed (or remove if strictly internal)
DROP POLICY IF EXISTS "Allow public read access to subscribers" ON subscribers;
DROP POLICY IF EXISTS "Allow public read access to events" ON events;
DROP POLICY IF EXISTS "Allow public read access to actions" ON actions;

-- ----------------------------------------------------------------
-- SEED DATA (For Testing and End-to-End Demonstration)
-- ----------------------------------------------------------------
INSERT INTO subscribers (id, name, email, paypal_subscription_id, plan, status, risk_score, risk_level, risk_reason, recommended_action, created_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Alex Johnson', 'alex.johnson@example.com', 'I-SUB-PAYPAL-101', 'Enterprise Pro', 'PAYMENT_FAILED', 85, 'Critical', '2 consecutive payment failures in last 7 days. Card expired.', 'fix_payment_nudge', NOW() - INTERVAL '10 days'),
    ('22222222-2222-2222-2222-222222222222', 'Sarah Connor', 'sarah.c@example.com', 'I-SUB-PAYPAL-102', 'Pro Monthly', 'SUSPENDED', 72, 'High', 'Billing failure and plan downgrade attempt after price revision.', 'discount_30', NOW() - INTERVAL '25 days'),
    ('33333333-3333-3333-3333-333333333333', 'Michael Scott', 'm.scott@dundermifflin.com', 'I-SUB-PAYPAL-103', 'Pro Annual', 'ACTIVE', 45, 'Medium', 'Subscriber disabled auto-renew in PayPal account settings.', 'pause_offer', NOW() - INTERVAL '60 days'),
    ('44444444-4444-4444-4444-444444444444', 'Elena Rostova', 'elena.rostova@techcorp.io', 'I-SUB-PAYPAL-104', 'Enterprise Pro', 'ACTIVE', 12, 'Low', 'Consistent on-time payment history for 12 months.', 'none', NOW() - INTERVAL '120 days')
ON CONFLICT (paypal_subscription_id) DO NOTHING;

INSERT INTO events (subscriber_id, event_type, event_data, paypal_event_id, created_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', '{"amount": 199.00, "currency": "USD", "reason": "EXPIRED_CARD"}'::jsonb, 'WH-EVT-001', NOW() - INTERVAL '3 days'),
    ('11111111-1111-1111-1111-111111111111', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', '{"amount": 199.00, "currency": "USD", "reason": "INSUFFICIENT_FUNDS"}'::jsonb, 'WH-EVT-002', NOW() - INTERVAL '1 day'),
    ('22222222-2222-2222-2222-222222222222', 'BILLING.SUBSCRIPTION.SUSPENDED', '{"reason": "PAYMENT_RETRY_EXHAUSTED"}'::jsonb, 'WH-EVT-003', NOW() - INTERVAL '2 days'),
    ('33333333-3333-3333-3333-333333333333', 'BILLING.SUBSCRIPTION.CANCELLED', '{"reason": "CUSTOMER_CANCELLED"}'::jsonb, 'WH-EVT-004', NOW() - INTERVAL '4 hours')
ON CONFLICT (paypal_event_id) DO NOTHING;

INSERT INTO actions (subscriber_id, action_type, status, email_content, created_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'fix_payment_nudge', 'PENDING', 'Hi Alex, We noticed your recent payment attempt for your Enterprise Pro subscription was unsuccessful due to card expiration. Please update your payment details to avoid service disruption.', NOW() - INTERVAL '1 day'),
    ('22222222-2222-2222-2222-222222222222', 'discount_30', 'PENDING', 'Hi Sarah, We value you as a subscriber! We are offering an exclusive 30% discount on your next 3 billing cycles if you reactivate your Pro Monthly subscription today.', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;
