import RiskBadge from "./RiskBadge";
import { ACTION_LABELS } from "@/types/subscriber";
import type { Subscriber } from "@/types/subscriber";

type Props = {
  subscribers: Subscriber[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function SubscriberTable({ subscribers, selectedId, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <h2 className="font-semibold text-slate-900">Subscribers</h2>
        <p className="text-sm text-slate-500">Highest risk first. Select one to see details.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium sm:px-5">Name</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Risk</th>
              <th className="px-4 py-2.5 font-medium">AI recommendation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subscribers.map((s) => {
              const selected = s.id === selectedId;
              return (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(s.id);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={selected}
                  className={`cursor-pointer outline-none transition-colors focus-visible:bg-indigo-50 ${
                    selected ? "bg-indigo-50" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-3 sm:px-5">
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-400">
                      {s.status === "ACTIVE" ? s.email : s.status.toLowerCase()}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.plan}</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={s.risk_level} score={s.risk_score} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {ACTION_LABELS[s.recommended_action]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
