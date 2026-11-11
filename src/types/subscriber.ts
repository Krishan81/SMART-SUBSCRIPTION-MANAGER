// Shared frontend types. Field names match the Supabase tables (snake_case)
// so real API responses can be used without any mapping.

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type ActionType =
  | "fix_payment_nudge"
  | "discount_30"
  | "pause_offer"
  | "none";

// pending           = AI recommended it, owner has not decided yet
// approved          = owner approved and it is done (e.g. email draft ready)
// awaiting_customer = owner approved, but PayPal needs the customer to accept
// rejected          = owner said no
export type ActionStatus =
  | "pending"
  | "approved"
  | "awaiting_customer"
  | "rejected";

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  paypal_subscription_id: string;
  plan: string;
  status: string; // ACTIVE | SUSPENDED | CANCELLED
  risk_score: number;
  risk_level: RiskLevel;
  risk_reason: string;
  recommended_action: ActionType;
  created_at: string;
}

export interface SubscriberEvent {
  id: string;
  subscriber_id: string;
  event_type: string; // PayPal event name, e.g. BILLING.SUBSCRIPTION.PAYMENT.FAILED
  event_data: Record<string, unknown> | null;
  created_at: string;
}

export interface RetentionAction {
  id: string;
  subscriber_id: string;
  action_type: ActionType;
  status: ActionStatus;
  email_content: string | null;
  created_at: string;
}

export interface DashboardStats {
  mrr: number;
  activeSubscribers: number;
  atRisk: number;
  failedPayments: number;
}

// ---- Small helpers used by the UI ----

export const FAILED_PAYMENT_EVENT = "BILLING.SUBSCRIPTION.PAYMENT.FAILED";

// Same thresholds as the project brief
export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

// Used only to estimate monthly revenue on the dashboard
export const PLAN_PRICES: Record<string, number> = { Basic: 5, Pro: 10 };

export const ACTION_LABELS: Record<ActionType, string> = {
  fix_payment_nudge: "Payment fix nudge",
  discount_30: "30% discount offer",
  pause_offer: "Pause offer",
  none: "No action needed",
};

export const ACTION_DESCRIPTIONS: Record<ActionType, string> = {
  fix_payment_nudge:
    "Email the customer a friendly reminder to update their payment method.",
  discount_30:
    "Offer 30% off to keep this customer. PayPal needs the customer to accept the new price.",
  pause_offer:
    "Offer a pause instead of a cancellation. PayPal needs the customer to confirm.",
  none: "This subscriber looks healthy. Nothing to do right now.",
};

export const EVENT_LABELS: Record<string, string> = {
  "BILLING.SUBSCRIPTION.ACTIVATED": "Subscription activated",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED": "Payment failed",
  "BILLING.SUBSCRIPTION.SUSPENDED": "Subscription suspended",
  "BILLING.SUBSCRIPTION.CANCELLED": "Subscription cancelled",
  "BILLING.SUBSCRIPTION.UPDATED": "Subscription updated",
  "PAYMENT.SALE.COMPLETED": "Payment received",
  RETENTION_ACTION_APPROVED: "Retention action approved",
  RETENTION_ACTION_REJECTED: "Retention action rejected",
};
