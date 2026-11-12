
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function demoModeEnabled() {
  return (
    process.env.PAYPAL_DEMO_MODE === "true" &&
    (process.env.NODE_ENV === "development" ||
      process.env.VERCEL === "1")
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!demoModeEnabled()) {
      return NextResponse.json(
        { success: false, message: "Demo mode is disabled." },
        { status: 404 }
      );
    }

    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const subscriptionId =
      typeof body.subscriptionId === "string"
        ? body.subscriptionId.trim()
        : "";

    if (!email || !subscriptionId) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and subscription ID are required.",
        },
        { status: 400 }
      );
    }

    // Only demo subscriptions can be cancelled by this endpoint.
    if (!subscriptionId.startsWith("DEMO-")) {
      return NextResponse.json(
        {
          success: false,
          message: "Only demo subscriptions can be cancelled here.",
        },
        { status: 403 }
      );
    }

    const { data: subscriber, error: lookupError } =
      await supabase
        .from("subscribers")
        .select("id, email, paypal_subscription_id, status")
        .ilike("email", email)
        .eq("paypal_subscription_id", subscriptionId)
        .maybeSingle();

    if (lookupError) {
      console.error(
        "Subscription lookup failed:",
        lookupError.message
      );
      throw lookupError;
    }

    if (!subscriber) {
      return NextResponse.json(
        { success: false, message: "Subscription not found." },
        { status: 404 }
      );
    }

    if (subscriber.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Only active demo subscriptions can be cancelled.",
        },
        { status: 400 }
      );
    }

    const { data: updatedSubscriber, error: updateError } =
      await supabase
        .from("subscribers")
        .update({
          status: "CANCELLED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriber.id)
        .eq("status", "ACTIVE")
        .select("id")
        .maybeSingle();

    if (updateError) {
      console.error(
        "Subscription cancellation failed:",
        updateError.message
      );
      throw updateError;
    }

    if (!updatedSubscriber) {
      return NextResponse.json(
        {
          success: false,
          message: "Subscription is no longer active.",
        },
        { status: 409 }
      );
    }

    const { error: eventError } = await supabase
      .from("events")
      .insert({
        subscriber_id: subscriber.id,
        event_type: "DEMO.SUBSCRIPTION.CANCELLED",
        event_data: {
          subscriptionId,
          email: subscriber.email,
        },
      });

    if (eventError) {
      console.error(
        "Cancellation event logging failed:",
        eventError.message
      );
    }

    return NextResponse.json({
      success: true,
      demoMode: true,
      message: "Demo subscription cancelled successfully.",
    });
  } catch (error) {
    console.error("Demo cancellation error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to cancel the subscription.",
      },
      { status: 500 }
    );
  }
}
