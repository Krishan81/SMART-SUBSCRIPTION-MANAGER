'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Subscriber } from '@/types/database';

interface RiskTrendChartProps {
  subscribers: Subscriber[];
}

export default function RiskTrendChart({ subscribers }: RiskTrendChartProps) {
  const now = new Date();

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - index));
    const dateStr = date.toISOString().slice(0, 10);

    return {
      date: dateStr,
      count: subscribers.filter(
        (subscriber) =>
          new Date(subscriber.created_at).toISOString().slice(0, 10) === dateStr
      ).length,
    };
  });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Risk Trend (7-day)
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        New subscriber registrations over time
      </p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-700" />
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#f4f4f5',
              }}
            />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
