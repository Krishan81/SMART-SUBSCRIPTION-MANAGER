import type { Subscriber, SubscriberEvent } from "@/types/subscriber";

const SALE = "PAYMENT.SALE.COMPLETED";
const FAIL = "BILLING.SUBSCRIPTION.PAYMENT.FAILED";
const ACTIVATED = "BILLING.SUBSCRIPTION.ACTIVATED";

export const mockSubscribers: Subscriber[] = [
  {
    id: "sub_sarah",
    name: "Sarah Johnson",
    email: "sarah.johnson@example.com",
    paypal_subscription_id: "I-SARAH000001",
    plan: "Pro",
    status: "ACTIVE",
    risk_score: 87,
    risk_level: "HIGH",
    risk_reason:
      "Two recent payment failures indicate high involuntary churn risk.",
    recommended_action: "fix_payment_nudge",
    created_at: "2026-07-10T09:00:00Z",
  },
  {
    id: "sub_mike",
    name: "Mike Chen",
    email: "mike.chen@example.com",
    paypal_subscription_id: "I-MIKE0000002",
    plan: "Pro",
    status: "ACTIVE",
    risk_score: 12,
    risk_level: "LOW",
    risk_reason: "Eleven on-time payments and no failures. Very stable.",
    recommended_action: "none",
    created_at: "2025-12-02T09:00:00Z",
  },
  {
    id: "sub_priya",
    name: "Priya Patel",
    email: "priya.patel@example.com",
    paypal_subscription_id: "I-PRIYA000003",
    plan: "Basic",
    status: "ACTIVE",
    risk_score: 58,
    risk_level: "MEDIUM",
    risk_reason:
      "Downgraded from Pro and had one failed payment. Showing signs of reduced engagement.",
    recommended_action: "pause_offer",
    created_at: "2026-03-18T09:00:00Z",
  },
  {
    id: "sub_alex",
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    paypal_subscription_id: "I-ALEX0000004",
    plan: "Pro",
    status: "ACTIVE",
    risk_score: 52,
    risk_level: "MEDIUM",
    risk_reason:
      "Plan was changed twice in a month, which often comes before cancelling.",
    recommended_action: "discount_30",
    created_at: "2026-05-05T09:00:00Z",
  },
  {
    id: "sub_dana",
    name: "Dana Whitfield",
    email: "dana.whitfield@example.com",
    paypal_subscription_id: "I-DANA0000005",
    plan: "Basic",
    status: "CANCELLED",
    risk_score: 95,
    risk_level: "HIGH",
    risk_reason: "Subscription was cancelled after repeated failed payments.",
    recommended_action: "none",
    created_at: "2026-02-01T09:00:00Z",
  },
];

let n = 0;
const ev = (
  subscriber_id: string,
  event_type: string,
  created_at: string
): SubscriberEvent => ({
  id: `evt_${++n}`,
  subscriber_id,
  event_type,
  event_data: null,
  created_at,
});

export const mockEvents: SubscriberEvent[] = [
  // Sarah: 3 successful payments, then 2 failures
  ev("sub_sarah", ACTIVATED, "2026-07-10T09:00:00Z"),
  ev("sub_sarah", SALE, "2026-07-10T09:01:00Z"),
  ev("sub_sarah", SALE, "2026-08-10T09:01:00Z"),
  ev("sub_sarah", SALE, "2026-09-10T09:01:00Z"),
  ev("sub_sarah", FAIL, "2026-10-10T09:01:00Z"),
  ev("sub_sarah", FAIL, "2026-11-03T09:01:00Z"),
  // Mike
  ev("sub_mike", ACTIVATED, "2025-12-02T09:00:00Z"),
  ev("sub_mike", SALE, "2026-09-02T09:01:00Z"),
  ev("sub_mike", SALE, "2026-10-02T09:01:00Z"),
  ev("sub_mike", SALE, "2026-11-02T09:01:00Z"),
  // Priya
  ev("sub_priya", ACTIVATED, "2026-03-18T09:00:00Z"),
  ev("sub_priya", SALE, "2026-08-18T09:01:00Z"),
  ev("sub_priya", "BILLING.SUBSCRIPTION.UPDATED", "2026-09-12T09:00:00Z"),
  ev("sub_priya", FAIL, "2026-10-18T09:01:00Z"),
  ev("sub_priya", SALE, "2026-10-20T09:01:00Z"),
  // Alex
  ev("sub_alex", ACTIVATED, "2026-05-05T09:00:00Z"),
  ev("sub_alex", SALE, "2026-10-05T09:01:00Z"),
  ev("sub_alex", "BILLING.SUBSCRIPTION.UPDATED", "2026-10-21T09:00:00Z"),
  ev("sub_alex", "BILLING.SUBSCRIPTION.UPDATED", "2026-11-01T09:00:00Z"),
  // Dana
  ev("sub_dana", ACTIVATED, "2026-02-01T09:00:00Z"),
  ev("sub_dana", FAIL, "2026-08-01T09:01:00Z"),
  ev("sub_dana", FAIL, "2026-09-01T09:01:00Z"),
  ev("sub_dana", "BILLING.SUBSCRIPTION.CANCELLED", "2026-09-15T09:00:00Z"),
];
