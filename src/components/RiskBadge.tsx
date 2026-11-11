import { RiskLevel } from '@/types/database';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
}

export default function RiskBadge({ level, score }: RiskBadgeProps) {
  const styles: Record<RiskLevel, { bg: string; text: string; border: string; label: string }> = {
    Low: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', label: 'Low' },
    Medium: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', label: 'Medium' },
    High: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', label: 'High' },
    Critical: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', label: 'Critical' },
  };

  const s = styles[level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text} ${s.border}`}
      title={score !== undefined ? `Risk score: ${score}/100` : undefined}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          level === 'Critical' ? 'bg-red-500' :
          level === 'High' ? 'bg-orange-500' :
          level === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
      />
      {s.label}
    </span>
  );
}