'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Subscriber } from '@/types/database';

interface RiskDistributionChartProps {
  subscribers: Subscriber[];
}

const COLORS: Record<string, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#dc2626',
};

export default function RiskDistributionChart({ subscribers }: RiskDistributionChartProps) {
  const data = [
    { level: 'Critical', count: subscribers.filter((s) => s.risk_level === 'Critical').length, color: COLORS.Critical },
    { level: 'High', count: subscribers.filter((s) => s.risk_level === 'High').length, color: COLORS.High },
    { level: 'Medium', count: subscribers.filter((s) => s.risk_level === 'Medium').length, color: COLORS.Medium },
    { level: 'Low', count: subscribers.filter((s) => s.risk_level === 'Low').length, color: COLORS.Low },
  ];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Risk Distribution</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Subscribers by risk level</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" className="dark:stroke-zinc-700" />
            <XAxis dataKey="level" tick={{ fill: '#71717a', fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                color: '#f4f4f5',
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}