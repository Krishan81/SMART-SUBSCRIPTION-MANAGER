import type { RiskLevel } from "@/types/subscriber";

type Props = { level: RiskLevel; score?: number };

const STYLES: Record<RiskLevel, string> = {
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200",
  HIGH: "bg-red-50 text-red-700 ring-red-200",
};

export default function RiskBadge({ level, score }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[level]}`}
    >
      {level}
      {score !== undefined && <span className="font-semibold">{score}</span>}
    </span>
  );
}
