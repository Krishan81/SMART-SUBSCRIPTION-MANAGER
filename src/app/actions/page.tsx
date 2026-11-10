import { Suspense } from 'react';
import { Metadata } from 'next';
import { getActions } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Recovery Actions | Subscription Risk Dashboard',
  description: 'Approve and execute recovery actions for at-risk subscribers',
};

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
  EXECUTED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
  REJECTED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
};

const actionLabels: Record<string, string> = {
  fix_payment_nudge: 'Payment Nudge',
  discount_30: '30% Discount',
  pause_offer: 'Plan Pause',
  none: 'No Action',
};

async function ActionsContent() {
  const actions = await getActions();

  if (actions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
        <p className="text-zinc-500 dark:text-zinc-400">No recovery actions found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Subscriber
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Action Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Executed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Email Content
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {actions.map((action) => (
            <tr key={action.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <td className="px-6 py-4">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {action.subscriber?.name || 'Unknown'}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {action.subscriber?.email}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                {actionLabels[action.action_type] || action.action_type}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    statusStyles[action.status] || ''
                  }`}
                >
                  {action.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                {new Date(action.created_at).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                {action.executed_at ? new Date(action.executed_at).toLocaleString() : '—'}
              </td>
              <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="max-w-xs truncate" title={action.email_content || ''}>
                  {action.email_content || 'No email content'}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-64 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export default function ActionsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Recovery Actions
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Approve and execute recovery actions for at-risk subscribers
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Suspense fallback={<ActionsSkeleton />}>
          <ActionsContent />
        </Suspense>
      </main>
    </div>
  );
}
