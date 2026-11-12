import { connection } from 'next/server';
import { Suspense } from 'react';
import { Metadata } from 'next';
import { getSubscribers, getActions } from '@/lib/db';
import StatCard from '@/components/StatCard';
import SubscriberCard from '@/components/SubscriberCard';
import RiskDistributionChart from '@/components/RiskDistributionChart';
import RiskTrendChart from '@/components/RiskTrendChart';
import { AlertTriangle, Users, Shield, Activity, LogOut } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase-server';
import SignOutButton from '@/components/SignOutButton';

export const metadata: Metadata = {
  title: 'Subscription Risk Dashboard',
  description: 'AI-powered subscription risk management system',
};

// Helper: get current user from Supabase auth, or null if not authenticated
async function getCurrentUser() {
  try {
    const supabase = await createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user || null;
  } catch {
    return null;
  }
}

async function DashboardContent() {
  await connection();
  const [subscribers, actions] = await Promise.all([getSubscribers(), getActions()]);

  const total = subscribers.length;
  const critical = subscribers.filter((s) => s.risk_level === 'Critical').length;
  const high = subscribers.filter((s) => s.risk_level === 'High').length;
  const pendingActions = actions.filter((a) => a.status === 'PENDING').length;
  const avgRisk = total > 0 ? Math.round(subscribers.reduce((sum, s) => sum + s.risk_score, 0) / total) : 0;

  return (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Subscribers"
          value={total}
          icon={<Users className="h-5 w-5" />}
          accent="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Average Risk Score"
          value={avgRisk}
          icon={<Activity className="h-5 w-5" />}
          accent={avgRisk >= 60 ? 'text-red-600 dark:text-red-400' : avgRisk >= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
          subtitle="0 (healthy) to 100 (critical)"
        />
        <StatCard
          label="Critical / High Risk"
          value={critical + high}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="text-red-600 dark:text-red-400"
          subtitle={`${critical} critical, ${high} high`}
        />
        <StatCard
          label="Pending Actions"
          value={pendingActions}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="text-amber-600 dark:text-amber-400"
          subtitle="Require admin approval"
        />
      </div>

      {/* Charts Row */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RiskDistributionChart subscribers={subscribers} />
        <RiskTrendChart subscribers={subscribers} />
      </div>

      {/* Subscribers Grid */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Subscriber Risk Overview</h2>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subscribers.map((subscriber) => (
            <SubscriberCard key={subscriber.id} subscriber={subscriber} />
          ))}
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="space-y-4">
        <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Subscription Risk Management
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                AI-powered risk scoring · PayPal webhook integration · Gemini analysis
              </p>
            </div>
            <Suspense fallback={<div className="h-8 w-24 rounded bg-zinc-200 animate-pulse" />}>
              <SignOutButton />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </main>
    </div>
  );
}