import { SubscriberEvent } from '@/types/database';

interface TimelineProps {
  events: SubscriberEvent[];
}

const eventColors: Record<string, string> = {
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED': 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  'BILLING.SUBSCRIPTION.SUSPENDED': 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  'BILLING.SUBSCRIPTION.CANCELLED': 'text-red-700 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800',
  'BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  'BILLING.SUBSCRIPTION.ACTIVATED': 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
};

function getEventColor(eventType: string): string {
  for (const key in eventColors) {
    if (eventType.includes(key.split('.')[1])) {
      return eventColors[key];
    }
  }
  return 'text-zinc-600 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700';
}

export default function Timeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      {events.map((event, index) => {
        const colorClass = getEventColor(event.event_type);
        const date = new Date(event.created_at);
        const dateStr = date.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit',
        });

        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white dark:bg-zinc-900">
                <div className={`h-2.5 w-2.5 rounded-full ${colorClass.split(' ')[0].replace('text-', 'bg-')}`} />
              </div>
              {index < events.length - 1 && (
                <div className="mt-1 h-8 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
              )}
            </div>
            <div className="flex-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                    {event.event_type}
                  </span>
                </div>
                <span className="whitespace-nowrap text-xs text-zinc-400 dark:text-zinc-500">
                  {dateStr} · {timeStr}
                </span>
              </div>
              {event.paypal_event_id && (
                <p className="mt-1 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  PayPal Event ID: {event.paypal_event_id}
                </p>
              )}
              <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {JSON.stringify(event.event_data, null, 2)}
              </pre>
            </div>
          </div>
        );
      })}
    </div>
  );
}