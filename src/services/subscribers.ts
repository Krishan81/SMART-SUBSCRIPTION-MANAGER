// ONE place where the frontend gets its data.
//
// Components never call fetch() themselves. They call the functions below.
// While USE_MOCK is true, everything runs on in-memory demo data.
// To connect the real backend, set USE_MOCK = false and fill in the
// "real API" branch of each function (marked TODO).

import {
  ACTION_LABELS,
  FAILED_PAYMENT_EVENT,
  PLAN_PRICES,
  riskLevelFromScore,
} from "@/types/subscriber";
import type {
  ActionType,
  DashboardStats,
  RetentionAction,
  Subscriber,
  SubscriberEvent,
} from "@/types/subscriber";
import { mockEvents, mockSubscribers } from "./mockData";

export const USE_MOCK = true;

// ---------- in-memory mock store (resets on page refresh) ----------
let subs: Subscriber[] = structuredClone(mockSubscribers);
let events: SubscriberEvent[] = structuredClone(mockEvents);
let actions: RetentionAction[] = [];
let idCounter = 1000;
const newId = (prefix: string) => `${prefix}_${++idCounter}`;
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));

function notConnected(fn: string): never {
  throw new Error(`Real API not connected yet for ${fn}()`);
}

function buildMockEmail(sub: Subscriber, type: ActionType): string | null {
  const first = sub.name.split(" ")[0];
  switch (type) {
    case "fix_payment_nudge":
      return `Subject: Quick fix needed for your ${sub.plan} subscription

Hi ${first},

We couldn't process your latest payment, so your ${sub.plan} plan is at risk of being paused. It usually takes less than a minute to fix: open PayPal and update your payment method.

Thanks for being part of the community. We'd hate to lose you.

The Team`;
    case "discount_30":
      return `Subject: A thank-you offer: 30% off your ${sub.plan} plan

Hi ${first},

We appreciate you being a subscriber. As a thank-you, we'd like to offer you 30% off your next billing cycles. Approve the new price in PayPal and the discount applies right away.

The Team`;
    case "pause_offer":
      return `Subject: Need a break? Pause instead of cancelling

Hi ${first},

If things are busy right now, you can pause your ${sub.plan} subscription and pick it back up whenever you're ready. Confirm the pause in PayPal and we'll keep your spot.

The Team`;
    default:
      return null;
  }
}

// ---------- public functions used by the UI ----------

export async function getSubscribers(): Promise<Subscriber[]> {
  if (USE_MOCK) {
    await wait(200);
    return [...subs].sort((a, b) => b.risk_score - a.risk_score);
  }
  // TODO real API: fetch the subscribers list from Student 4's route
  return notConnected("getSubscribers");
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (USE_MOCK) {
    const active = subs.filter((s) => s.status === "ACTIVE");
    return {
      mrr: active.reduce((sum, s) => sum + (PLAN_PRICES[s.plan] ?? 0), 0),
      activeSubscribers: active.length,
      atRisk: subs.filter(
        (s) => s.status !== "CANCELLED" && s.risk_score >= 40
      ).length,
      failedPayments: events.filter((e) => e.event_type === FAILED_PAYMENT_EVENT)
        .length,
    };
  }
  // TODO real API
  return notConnected("getDashboardStats");
}

export async function getSubscriberEvents(
  subscriberId: string
): Promise<SubscriberEvent[]> {
  if (USE_MOCK) {
    await wait(150);
    return events
      .filter((e) => e.subscriber_id === subscriberId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  // TODO real API
  return notConnected("getSubscriberEvents");
}

// Latest action for this subscriber, or null if the owner hasn't decided yet
export async function getSubscriberAction(
  subscriberId: string
): Promise<RetentionAction | null> {
  if (USE_MOCK) {
    const mine = actions
      .filter((a) => a.subscriber_id === subscriberId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return mine[0] ?? null;
  }
  // TODO real API
  return notConnected("getSubscriberAction");
}

export async function approveAction(
  subscriberId: string,
  actionType: ActionType
): Promise<RetentionAction> {
  if (USE_MOCK) {
    await wait(700);
    const sub = subs.find((s) => s.id === subscriberId);
    if (!sub) throw new Error("Subscriber not found");
    const now = new Date().toISOString();
    const action: RetentionAction = {
      id: newId("act"),
      subscriber_id: subscriberId,
      action_type: actionType,
      // Discount and pause need the customer to confirm in PayPal,
      // so we show "awaiting customer" instead of pretending it finished.
      status: actionType === "fix_payment_nudge" ? "approved" : "awaiting_customer",
      email_content: buildMockEmail(sub, actionType),
      created_at: now,
    };
    actions.push(action);
    events.push({
      id: newId("evt"),
      subscriber_id: subscriberId,
      event_type: "RETENTION_ACTION_APPROVED",
      event_data: { action_type: actionType, label: ACTION_LABELS[actionType] },
      created_at: now,
    });
    return action;
  }

  // Real API: this matches the shared contract POST /api/actions.
  // ASSUMPTION: the route responds with the saved action row. Confirm with Student 4.
  const res = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscriber_id: subscriberId, action_type: actionType }),
  });
  if (!res.ok) throw new Error(`Approve failed (${res.status})`);
  return (await res.json()) as RetentionAction;
}

export async function rejectAction(
  subscriberId: string,
  actionType: ActionType
): Promise<RetentionAction> {
  if (USE_MOCK) {
    await wait(400);
    const now = new Date().toISOString();
    const action: RetentionAction = {
      id: newId("act"),
      subscriber_id: subscriberId,
      action_type: actionType,
      status: "rejected",
      email_content: null,
      created_at: now,
    };
    actions.push(action);
    events.push({
      id: newId("evt"),
      subscriber_id: subscriberId,
      event_type: "RETENTION_ACTION_REJECTED",
      event_data: { action_type: actionType },
      created_at: now,
    });
    return action;
  }
  // TODO real API: there is no reject endpoint in the shared contract yet.
  return notConnected("rejectAction");
}

// Demo button: pretend PayPal reported another failed payment.
// In mock mode the new score is a simple bump. In the real version the
// backend would store the event and run the Gemini risk analysis.
export async function simulateFailedPayment(subscriberId: string): Promise<void> {
  if (USE_MOCK) {
    await wait(600);
    const sub = subs.find((s) => s.id === subscriberId);
    if (!sub) throw new Error("Subscriber not found");
    events.push({
      id: newId("evt"),
      subscriber_id: subscriberId,
      event_type: FAILED_PAYMENT_EVENT,
      event_data: { simulated: true },
      created_at: new Date().toISOString(),
    });
    const score = Math.min(95, sub.risk_score + 20);
    sub.risk_score = score;
    sub.risk_level = riskLevelFromScore(score);
    sub.recommended_action = score >= 70 ? "fix_payment_nudge" : "pause_offer";
    sub.risk_reason =
      "Another failed payment was just recorded. Repeated failures usually mean the card on file is no longer valid.";
    actions = actions.filter((a) => a.subscriber_id !== subscriberId);
    return;
  }
  // TODO real API: needs a backend endpoint for the demo simulation
  // (not in the shared contract yet; ask Student 2 / Student 4).
  return notConnected("simulateFailedPayment");
}

export async function resetDemoData(): Promise<void> {
  subs = structuredClone(mockSubscribers);
  events = structuredClone(mockEvents);
  actions = [];
}
