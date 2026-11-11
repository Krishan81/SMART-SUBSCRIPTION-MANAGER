"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import StatsCard from "@/components/StatsCard";
import SubscriberTable from "@/components/SubscriberTable";
import SubscriberDetails from "@/components/SubscriberDetails";
import {
  USE_MOCK,
  approveAction,
  getDashboardStats,
  getSubscriberAction,
  getSubscriberEvents,
  getSubscribers,
  rejectAction,
  resetDemoData,
  simulateFailedPayment,
} from "@/services/subscribers";
import type {
  DashboardStats,
  RetentionAction,
  Subscriber,
  SubscriberEvent,
} from "@/types/subscriber";

export default function DashboardPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<SubscriberEvent[]>([]);
  const [action, setAction] = useState<RetentionAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = subscribers.find((s) => s.id === selectedId) ?? null;

  const loadDashboard = useCallback(async () => {
    const [subs, st] = await Promise.all([getSubscribers(), getDashboardStats()]);
    setSubscribers(subs);
    setStats(st);
  }, []);

  const loadDetails = useCallback(async (id: string) => {
    const [ev, act] = await Promise.all([getSubscriberEvents(id), getSubscriberAction(id)]);
    setEvents(ev);
    setAction(act);
  }, []);

  const showError = (e: unknown) =>
    setError(e instanceof Error ? e.message : "Something went wrong");

  useEffect(() => {
    loadDashboard().catch(showError);
  }, [loadDashboard]);

  useEffect(() => {
    if (selectedId) loadDetails(selectedId).catch(showError);
  }, [selectedId, loadDetails]);

  // Runs a backend call, then refreshes the dashboard and the selected subscriber
  async function run(task: () => Promise<unknown>) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await task();
      await Promise.all([loadDashboard(), loadDetails(selectedId)]);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    await resetDemoData();
    setSelectedId(null);
    setEvents([]);
    setAction(null);
    setError(null);
    await loadDashboard();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar mockMode={USE_MOCK} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Retention dashboard</h1>
            <p className="text-sm text-slate-500">
              See who might cancel and approve a safe way to keep them.
            </p>
          </div>
          {USE_MOCK && (
            <button
              onClick={handleReset}
              className="text-sm text-slate-500 underline hover:text-slate-800"
            >
              Reset demo data
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatsCard
            title="Monthly recurring revenue"
            value={stats ? `$${stats.mrr}` : "..."}
            hint="Active subscribers only"
          />
          <StatsCard title="Active subscribers" value={stats?.activeSubscribers ?? "..."} />
          <StatsCard
            title="Subscribers at risk"
            value={stats?.atRisk ?? "..."}
            hint="Risk score 40 or higher"
            tone="warning"
          />
          <StatsCard title="Failed payments" value={stats?.failedPayments ?? "..."} tone="danger" />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SubscriberTable
              subscribers={subscribers}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="lg:col-span-2">
            <SubscriberDetails
              subscriber={selected}
              events={events}
              action={action}
              busy={busy}
              onApprove={() =>
                selected && run(() => approveAction(selected.id, selected.recommended_action))
              }
              onReject={() =>
                selected && run(() => rejectAction(selected.id, selected.recommended_action))
              }
              onSimulateFailedPayment={() => selected && run(() => simulateFailedPayment(selected.id))}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
