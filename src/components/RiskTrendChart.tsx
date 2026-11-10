'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Subscriber } from '@/types/database';
import { useState, useEffect } from 'react';

interface RiskTrendChartProps {
  subscribers: Subscriber[];
}

export default function RiskTrendChart({ subscribers }: RiskTrendChartProps) {
  const [days, setDays] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    // Compute days client-side only to avoid static prerender errors with new Date()
    const daysArr: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = subscribers.filter((s) => {
        const created = new Date(s.created_at);
        return created.toISOString().slice(0, 10) === dateStr;
      }).length;
      daysArr.push({ date: dateStr, count });
    }
    setDays(daysArr);
  }, [subscribers]);

  // Show loading state while data is being computed client-side
  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Risk Trend (7-day)</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">New subscriber registrations over time</p>
        <div className="mt-4 h-64 flex items-center justify-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading chart data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Risk Trend (7-day)</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">New subscriber registrations over time</p>
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