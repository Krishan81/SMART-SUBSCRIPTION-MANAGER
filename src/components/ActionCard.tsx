import { ACTION_DESCRIPTIONS, ACTION_LABELS } from "@/types/subscriber";
import type { ActionStatus, ActionType, RetentionAction } from "@/types/subscriber";

type Props = {
  recommended: ActionType;
  action: RetentionAction | null; // null = owner hasn't decided yet
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
};

const STATUS_UI: Record<ActionStatus, { text: string; style: string }> = {
  pending: { text: "Waiting for your approval", style: "bg-slate-100 text-slate-700" },
  approved: { text: "Approved. Email draft is ready.", style: "bg-emerald-50 text-emerald-700" },
  awaiting_customer: {
    text: "Approved. Waiting for the customer to accept in PayPal.",
    style: "bg-amber-50 text-amber-800",
  },
  rejected: { text: "Rejected", style: "bg-slate-100 text-slate-600" },
};

export default function ActionCard({ recommended, action, busy, onApprove, onReject }: Props) {
  const status: ActionStatus = action?.status ?? "pending";
  const ui = STATUS_UI[status];
  const canDecide = recommended !== "none" && status === "pending";

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 sm:p-5">
      <p className="text-sm text-slate-500">AI recommendation</p>
      <h3 className="mt-0.5 text-lg font-semibold text-slate-900">
        {ACTION_LABELS[recommended]}
      </h3>
      <p className="mt-1 text-sm text-slate-600">{ACTION_DESCRIPTIONS[recommended]}</p>

      {recommended !== "none" && (
        <p className={`mt-3 inline-block rounded-md px-2.5 py-1 text-sm font-medium ${ui.style}`}>
          {ui.text}
        </p>
      )}

      {canDecide && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onApprove}
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
          >
            {busy ? "Working..." : "Approve action"}
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}

      {action?.email_content && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-slate-700">Generated email</p>
          <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-sans text-sm leading-relaxed text-slate-700">
            {action.email_content}
          </pre>
        </div>
      )}
    </div>
  );
}
