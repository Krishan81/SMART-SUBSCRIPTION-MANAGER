
import { NextRequest, NextResponse } from "next/server";
import { createPayPalSubscription } from "@/lib/paypal";
import { supabase } from "@/lib/supabase";

function demoModeEnabled() {
  return (
    process.env.PAYPAL_DEMO_MODE === "true" &&
    (process.env.NODE_ENV === "development" ||
      process.env.VERCEL === "1")
  );
}

export async function GET(request: NextRequest) {
  try {
    if (!demoModeEnabled()) {
      return NextResponse.json(
        { success: false, message: "Not available" },
        { status: 404 }
      );
    }

    const email = new URL(request.url)
      .searchParams.get("email")
      ?.trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("subscribers")
      .select(
        "id, email, name, paypal_subscription_id, plan, status, created_at"
      )
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Supabase subscription lookup failed:", error.message);
      throw error;
    }

    const subscriptions = data
      ? [
          {
            id: data.id,
            paypalSubscriptionId: data.paypal_subscription_id,
            paypalPlanId: data.plan,
            status: data.status,
            startDate: null,
            nextBillingDate: null,
            createdAt: data.created_at,
          },
        ]
      : [];

    return NextResponse.json({ success: true, subscriptions });
  } catch (error) {
    console.error("Failed to fetch subscriptions:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : email.split("@")[0];

    const planId =
      typeof body.planId === "string"
        ? body.planId.trim()
        : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (!/^\+?[0-9\s().-]{7,20}$/.test(phone)) {
      return NextResponse.json(
        { success: false, message: "A valid phone number is required" },
        { status: 400 }
      );
    }

    if (!planId) {
      return NextResponse.json(
        { success: false, message: "planId is required" },
        { status: 400 }
      );
    }

    const isDemoMode = demoModeEnabled();

    let subscriptionId: string;
    let status: string;
    let approvalUrl: string | undefined;

    if (isDemoMode) {
      // Simulate an active subscription; no PayPal request is made.
      subscriptionId = `DEMO-${crypto.randomUUID()}`;
      status = "ACTIVE";
    } else {
      const subscription = await createPayPalSubscription(planId);

      if (!subscription.id) {
        throw new Error("PayPal did not return a subscription ID");
      }

      const approvalLink = subscription.links?.find(
        (link: { rel: string; href: string }) =>
          link.rel === "approve"
      );

      if (!approvalLink?.href) {
        throw new Error("PayPal did not return an approval URL");
      }

      subscriptionId = subscription.id;
      status = subscription.status ?? "PENDING";
      approvalUrl = approvalLink.href;
    }

    const { data: subscriber, error } = await supabase
      .from("subscribers")
      .upsert(
        {
          email,
          name,
          paypal_subscription_id: subscriptionId,
          plan: planId,
          status,
        },
        { onConflict: "email" }
      )
      .select(
        "id, email, paypal_subscription_id, plan, status"
      )
      .single();

    if (error) {
      console.error("Supabase subscriber save failed:", error.message);
      throw error;
    }

    const { error: eventError } = await supabase
      .from("events")
      .insert({
        subscriber_id: subscriber.id,
        event_type: isDemoMode
          ? "DEMO.SUBSCRIPTION.CREATED"
          : "PAYPAL.SUBSCRIPTION.CREATED",
        event_data: {
          paypalSubscriptionId: subscriptionId,
          planId,
          status,
        },
      });

    if (eventError) {
      console.error(
        "Failed to record subscription event:",
        eventError.message
      );
    }

    return NextResponse.json({
      success: true,
      demoMode: isDemoMode,
      subscriptionId: subscriber.paypal_subscription_id,
      status: subscriber.status,
      ...(approvalUrl ? { approvalUrl } : {}),
      ...(isDemoMode
        ? {
            message:
              "Demo subscription activated successfully. No payment was collected.",
          }
        : {}),
    });
  } catch (error) {
    console.error("Subscription creation failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create subscription",
      },
      { status: 500 }
    );
  }
}
