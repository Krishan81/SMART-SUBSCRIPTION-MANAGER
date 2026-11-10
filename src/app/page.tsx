"use client";

import { useState } from "react";

type Subscription = {
  id: string;
  paypalSubscriptionId: string;
  paypalPlanId: string;
  status: string;
  startDate: string | null;
  nextBillingDate: string | null;
  createdAt: string;
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [planId, setPlanId] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [hasLoadedSubscriptions, setHasLoadedSubscriptions] = useState(false);

  async function loadSubscriptions(emailToLoad = email) {
    const cleanEmail = emailToLoad.trim();

    if (!cleanEmail) {
      setMessage("Please enter your email address first.");
      return;
    }

    setLoadingSubscriptions(true);

    try {
      const response = await fetch(
        `/api/paypal/subscription?email=${encodeURIComponent(cleanEmail)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load subscriptions.");
      }

      setSubscriptions(data.subscriptions ?? []);
      setHasLoadedSubscriptions(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load subscriptions."
      );
    } finally {
      setLoadingSubscriptions(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/paypal/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim(),
          planId: planId.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to create subscription.");
      }

      if (data.demoMode) {
        await loadSubscriptions(email);
        setMessage(
          "Demo subscription activated successfully! No real payment was collected."
        );
        return;
      }

      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
        return;
      }

      setMessage(data.message || "Subscription request completed.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function cancelSubscription(subscriptionId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this demo subscription?"
    );

    if (!confirmed) return;

    setCancellingId(subscriptionId);
    setMessage("");

    try {
      const response = await fetch("/api/paypal/subscription/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          subscriptionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Cancellation failed.");
      }

      await loadSubscriptions(email);
      setMessage(data.message || "Demo subscription cancelled successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel the subscription."
      );
    } finally {
      setCancellingId(null);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "Not available";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const activeCount = subscriptions.filter(
    (subscription) => subscription.status === "ACTIVE"
  ).length;

  const pendingCount = subscriptions.filter((subscription) =>
    ["PENDING", "APPROVAL_PENDING"].includes(subscription.status)
  ).length;

  const demoCount = subscriptions.filter((subscription) =>
    subscription.paypalSubscriptionId.startsWith("DEMO-")
  ).length;

  const summaryCards = [
    {
      title: "Total Subscriptions",
      count: subscriptions.length,
      color: "text-blue-600",
    },
    {
      title: "Active",
      count: activeCount,
      color: "text-green-700",
    },
    {
      title: "Pending",
      count: pendingCount,
      color: "text-amber-700",
    },
    {
      title: "Demo Subscriptions",
      count: demoCount,
      color: "text-purple-600",
    },
  ];

  return (
    <main className="min-h-screen bg-white px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-7">
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Smart Subscription Manager
          </h1>
          <p className="mt-2 text-slate-600">
            Manage and monitor your subscriptions in one place.
          </p>
        </header>

        <section className="rounded-xl border border-amber-500 bg-amber-50 p-4 text-amber-800">
          <h2 className="font-bold">Development Demo Mode</h2>
          <p className="mt-2">
            Demo subscriptions do not collect real payments or activate a real
            PayPal billing agreement.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 p-6 shadow-sm sm:p-8">
          <h2 className="mb-6 text-2xl font-bold">
            Create a Subscription
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block font-medium"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email address"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block font-medium"
              >
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter your phone number"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="planId"
                className="mb-2 block font-medium"
              >
                PayPal Plan ID
              </label>
              <input
                id="planId"
                type="text"
                value={planId}
                onChange={(event) => setPlanId(event.target.value)}
                placeholder="Enter your PayPal Plan ID"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Creating Subscription..."
                : "Create Demo Subscription"}
            </button>
          </form>

          {message && (
            <div
              role="status"
              aria-live="polite"
              className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
            >
              {message}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold">My Subscriptions</h2>
            <p className="mt-2 text-slate-500">
              Enter your email above, then load your saved subscriptions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSubscriptions()}
            disabled={loadingSubscriptions}
            className="rounded-lg border border-slate-300 px-5 py-3 font-medium transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingSubscriptions
              ? "Loading Subscriptions..."
              : "Refresh Subscriptions"}
          </button>

          {hasLoadedSubscriptions && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-xl border border-slate-200 p-5"
                  >
                    <p className="text-sm font-medium text-slate-500">
                      {card.title}
                    </p>
                    <p className={`mt-2 text-3xl font-bold ${card.color}`}>
                      {card.count}
                    </p>
                  </div>
                ))}
              </div>

              {subscriptions.length === 0 ? (
                <div className="rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                  No subscriptions found for this email address.
                </div>
              ) : (
                <div className="space-y-4">
                  {subscriptions.map((subscription) => {
                    const isDemo =
                      subscription.paypalSubscriptionId.startsWith("DEMO-");

                    const isCancelling =
                      cancellingId === subscription.paypalSubscriptionId;

                    return (
                      <article
                        key={subscription.id}
                        className="rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold">
                              {isDemo
                                ? "Demo Subscription"
                                : "PayPal Subscription"}
                            </h3>
                            <p className="mt-1 break-all text-sm text-slate-500">
                              {subscription.paypalSubscriptionId}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${
                              subscription.status === "ACTIVE"
                                ? "bg-green-100 text-green-800"
                                : subscription.status === "CANCELLED"
                                  ? "bg-red-100 text-red-800"
                                  : subscription.status === "APPROVAL_PENDING" ||
                                      subscription.status === "PENDING"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {subscription.status.replaceAll("_", " ")}
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-slate-500">PayPal Plan ID</p>
                            <p className="mt-1 break-all font-medium">
                              {subscription.paypalPlanId}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">Start Date</p>
                            <p className="mt-1 font-medium">
                              {formatDate(subscription.startDate)}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">Next Billing Date</p>
                            <p className="mt-1 font-medium">
                              {formatDate(subscription.nextBillingDate)}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500">Created</p>
                            <p className="mt-1 font-medium">
                              {formatDate(subscription.createdAt)}
                            </p>
                          </div>
                        </div>

                        {isDemo && subscription.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() =>
                              cancelSubscription(
                                subscription.paypalSubscriptionId
                              )
                            }
                            disabled={isCancelling}
                            className="mt-5 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isCancelling
                              ? "Cancelling..."
                              : "Cancel Subscription"}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        <footer className="border-t border-slate-200 pt-5 text-center text-sm text-slate-500">
          Smart Subscription Manager · Development Demo
        </footer>
      </div>
    </main>
  );
}
