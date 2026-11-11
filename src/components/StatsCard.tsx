type Props = {
  title: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger";
};

const VALUE_COLOR = {
  default: "text-slate-900",
  warning: "text-amber-600",
  danger: "text-red-600",
};

export default function StatsCard({ title, value, hint, tone = "default" }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-1 text-2xl font-semibold sm:text-3xl ${VALUE_COLOR[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
