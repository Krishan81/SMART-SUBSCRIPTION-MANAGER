import Link from 'next/link';
import RiskBadge from './RiskBadge';
import { Subscriber, ALLOWED_ACTION_TYPES } from '@/types/database';

interface SubscriberCardProps {
  subscriber: Subscriber;
}

export default function SubscriberCard({ subscriber }: SubscriberCardProps) {
  const actionLabels: Record<string, string> = {
    fix_payment_nudge: 'Payment Nudge',
    discount_30: '30% Discount',
    pause_offer: 'Plan Pause',
    none: 'No Action',
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-emerald-600 dark:text-emerald-400',
    SUSPENDED: 'text-amber-600 dark:text-amber-400',
    CANCELLED: 'text-red-600 dark:text-red-400',
    PAYMENT_FAILED: 'text-red-600 dark:text-red-400',
    IN_RECOVERY: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {subscriber.name}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{subscriber.email}</p>
        </div>
        <RiskBadge level={subscriber.risk_level} score={subscriber.risk_score} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {subscriber.plan}
        </span>
        <span className={`font-medium ${statusColors[subscriber.status] || 'text-zinc-600'}`}>
          {subscriber.status.replace('_', ' ')}
        </span>
        <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {subscriber.paypal_subscription_id}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Risk Score</span>
          <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
            {subscriber.risk_score}/100
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              subscriber.risk_score >= 85 ? 'bg-red-500' :
              subscriber.risk_score >= 60 ? 'bg-orange-500' :
              subscriber.risk_score >= 30 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${subscriber.risk_score}%` }}
          />
        </div>
      </div>

      {subscriber.risk_reason && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          {subscriber.risk_reason}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Recommended:{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {actionLabels[subscriber.recommended_action || 'none']}
          </span>
        </span>
        <Link
          href={`/subscribers/${subscriber.id}`}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View timeline →
        </Link>
      </div>
    </div>
  );
}