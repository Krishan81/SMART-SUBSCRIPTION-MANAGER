import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: string;
  subtitle?: string;
}

export default function StatCard({ label, value, icon, accent = 'text-blue-600 dark:text-blue-400', subtitle }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}