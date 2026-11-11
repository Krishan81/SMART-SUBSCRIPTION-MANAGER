import { EVENT_LABELS } from "@/types/subscriber";
import type { SubscriberEvent } from "@/types/subscriber";

function dotColor(eventType: string): string {
  if (eventType.includes("FAILED")) return "bg-red-500";
  if (eventType.includes("SUSPENDED") || eventType.includes("CANCELLED")) return "bg-amber-500";
  if (
    eventType.includes("COMPLETED") ||
    eventType.includes("ACTIVATED") ||
    eventType.includes("APPROVED")
  )
    return "bg-emerald-500";
  return "bg-slate-400";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Props = { events: SubscriberEvent[] };

// Expects events newest first (the service already sorts them this way)
export default function EventTimeline({ events }: Props) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No events yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor(e.event_type)}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              {EVENT_LABELS[e.event_type] ?? e.event_type}
              {e.event_data?.simulated === true && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800">
                  simulated
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400">{formatDate(e.created_at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
