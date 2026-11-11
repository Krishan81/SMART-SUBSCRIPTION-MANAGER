import ActionCard from "./ActionCard";
import EventTimeline from "./EventTimeline";
import RiskBadge from "./RiskBadge";
import type { RetentionAction, Subscriber, SubscriberEvent } from "@/types/subscriber";

type Props = {
  subscriber: Subscriber | null;
  events: SubscriberEvent[];
  action: RetentionAction | null;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSimulateFailedPayment: () => void;
};

const BAR_COLOR = { LOW: "bg-emerald-500", MEDIUM: "bg-amber-500", HIGH: "bg-red-500" };

export default function SubscriberDetails({
  subscriber,
  events,
  action,
  busy,
  onApprove,
  onReject,
  onSimulateFailedPayment,
}: Props) {
  if (!subscriber) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">
          Select a subscriber to see their risk analysis and payment history.
        </p>
      </div>
    );
  }

  const isCancelled = subscriber.status === "CANCELLED";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{subscriber.name}</h2>
            <p className="text-sm text-slate-500">
              {subscriber.plan} plan &middot; {subscriber.email}
            </p>
          </div>
          <RiskBadge level={subscriber.risk_level} />
        </div>

        {/* Risk meter: the one visual to look at */}
        <div className="mt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-slate-900">{subscriber.risk_score}</span>
            <span className="text-sm text-slate-500">out of 100 churn risk</span>
          </div>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={subscriber.risk_score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Churn risk score"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${BAR_COLOR[subscriber.risk_level]}`}
              style={{ width: `${subscriber.risk_score}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-700">{subscriber.risk_reason}</p>
        </div>
      </div>

      <ActionCard
        recommended={subscriber.recommended_action}
        action={action}
        busy={busy}
        onApprove={onApprove}
        onReject={onReject}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="mb-3 font-semibold text-slate-900">Event history</h3>
        <EventTimeline events={events} />
      </div>

      {!isCancelled && (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 sm:p-5">
          <p className="text-sm font-medium text-amber-900">Demo tools</p>
          <p className="mt-0.5 text-sm text-amber-800">
            Real payment failures are hard to trigger in the PayPal sandbox. This button adds a
            simulated failed payment for the demo.
          </p>
          <button
            onClick={onSimulateFailedPayment}
            disabled={busy}
            className="mt-3 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            Simulate failed payment
          </button>
        </div>
      )}
    </div>
  );
}
