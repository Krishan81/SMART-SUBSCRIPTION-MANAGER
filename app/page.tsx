
"use client";

import { useState } from "react";

type Subscriber = {
  name: string;
  plan: string;
  tenure_months: number;
  successful_payments: number;
  failed_payments: number;
  recent_events: string[];
};

type Analysis = {
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  recommended_action: string;
};

const subscribers: Subscriber[] = [
  {
    name: "Sarah Johnson",
    plan: "Pro",
    tenure_months: 4,
    successful_payments: 3,
    failed_payments: 2,
    recent_events: ["Two recent payment failures"],
  },
  {
    name: "Alex Smith",
    plan: "Basic",
    tenure_months: 18,
    successful_payments: 18,
    failed_payments: 0,
    recent_events: [],
  },
];

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState("");

  const subscriber = subscribers[selected];

  async function analyzeRisk() {
    setLoading(true);
    setError("");
    setAnalysis(null);
    setEmail("");

    try {
      const response = await fetch("/api/ai/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriber),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Risk analysis failed.");
      }

      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function generateEmail() {
    if (!analysis) return;

    setEmailLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subscriber.name,
          plan: subscriber.plan,
          reason: analysis.reason,
          recommended_action: analysis.recommended_action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Email generation failed.");
      }

      setEmail(data.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">

        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-indigo-400">
              AI POWERED SUBSCRIPTION MANAGEMENT
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Smart Subscription Manager
            </h1>
            <p className="mt-2 text-slate-400">
              Monitor subscribers and predict churn with Gemini AI.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-400">AI ENGINE</p>
            <p className="font-semibold text-emerald-400">
              Gemini Connected
            </p>
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Subscribers</p>
            <p className="mt-3 text-3xl font-bold">2</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">AI Risk Analysis</p>
            <p className="mt-3 text-3xl font-bold text-indigo-400">Active</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">AI Email Generation</p>
            <p className="mt-3 text-3xl font-bold text-emerald-400">Ready</p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-5 text-xl font-semibold">
              Subscriber Details
            </h2>

            <label className="mb-2 block text-sm text-slate-400">
              Select subscriber
            </label>

            <select
              value={selected}
              onChange={(e) => {
                setSelected(Number(e.target.value));
                setAnalysis(null);
                setEmail("");
                setError("");
              }}
              className="mb-6 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none"
            >
              <option value={0}>Sarah Johnson</option>
              <option value={1}>Alex Smith</option>
            </select>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400">Customer</p>
                <p className="font-semibold">{subscriber.name}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400">Subscription Plan</p>
                <p className="font-semibold">{subscriber.plan}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-800 p-3">
                  <p className="text-xs text-slate-400">Tenure</p>
                  <p className="mt-1 text-xl font-bold">
                    {subscriber.tenure_months}
                  </p>
                  <p className="text-xs text-slate-400">months</p>
                </div>

                <div className="rounded-xl bg-slate-800 p-3">
                  <p className="text-xs text-slate-400">Successful</p>
                  <p className="mt-1 text-xl font-bold text-emerald-400">
                    {subscriber.successful_payments}
                  </p>
                  <p className="text-xs text-slate-400">payments</p>
                </div>

                <div className="rounded-xl bg-slate-800 p-3">
                  <p className="text-xs text-slate-400">Failed</p>
                  <p className="mt-1 text-xl font-bold text-red-400">
                    {subscriber.failed_payments}
                  </p>
                  <p className="text-xs text-slate-400">payments</p>
                </div>
              </div>
            </div>

            <button
              onClick={analyzeRisk}
              disabled={loading}
              className="mt-7 w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Analyzing with Gemini..." : "Analyze Churn Risk"}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-5 text-xl font-semibold">
              AI Risk Analysis
            </h2>

            {!analysis && !loading && (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <p className="text-4xl">✦</p>
                <p className="mt-4 font-medium">No analysis yet</p>
                <p className="mt-2 text-sm text-slate-400">
                  Select a subscriber and click Analyze Churn Risk.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex min-h-64 items-center justify-center text-indigo-400">
                Gemini is analyzing subscriber data...
              </div>
            )}

            {analysis && (
              <div>
                <p className="text-sm text-slate-400">Churn Risk Score</p>

                <div className="my-3 flex items-center gap-4">
                  <span className="text-5xl font-bold">
                    {analysis.risk_score}
                  </span>
                  <span className="text-slate-400">/ 100</span>

                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold ${
                      analysis.risk_level === "HIGH"
                        ? "bg-red-500/20 text-red-400"
                        : analysis.risk_level === "MEDIUM"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {analysis.risk_level} RISK
                  </span>
                </div>

                <div className="mb-6 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${analysis.risk_score}%` }}
                  />
                </div>

                <p className="text-sm text-slate-400">AI Explanation</p>
                <p className="mt-2 leading-relaxed text-slate-200">
                  {analysis.reason}
                </p>

                <div className="mt-5 rounded-xl bg-slate-800 p-4">
                  <p className="text-sm text-slate-400">
                    Recommended Action
                  </p>
                  <p className="mt-2 font-semibold text-indigo-400">
                    {analysis.recommended_action}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {analysis && (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">
              AI Retention Email
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Generate a personalized email based on the AI analysis.
            </p>

            <button
              onClick={generateEmail}
              disabled={emailLoading}
              className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {emailLoading ? "Generating email..." : "Generate Email"}
            </button>

            {email && (
              <div className="mt-5 whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-950 p-5 leading-relaxed text-slate-200">
                {email}
                <p className="mt-5 border-t border-slate-700 pt-4 text-sm font-semibold text-yellow-400">
                  Demo only: Review and approve this email before sending.
                  No email has been sent.
                </p>
              </div>
            )}
          </section>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
          Smart Subscription Manager · Powered by Gemini AI
        </footer>
      </div>
    </main>
  );
}
