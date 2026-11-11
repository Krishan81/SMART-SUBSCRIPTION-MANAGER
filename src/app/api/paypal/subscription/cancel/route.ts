
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    // Allow cancellation only in development demo mode.
    if (
      process.env.NODE_ENV !== "development" ||
      process.env.PAYPAL_DEMO_MODE !== "true"
    ) {
      return NextResponse.json(
        { success: false, message: "Demo mode is disabled." },
        { status: 404 }
      );
    }

    const body = await request.json();

    const email =
      typeof body.email === "string" ? body.email.trim() : "";

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

    // Find the subscriber and their demo subscription.
    const { data: subscriber, error: lookupError } = await supabase
      .from("subscribers")
      .select("id, email, paypal_subscription_id, status")
      .ilike("email", email)
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();

    if (lookupError) {
      console.error("Subscription lookup failed:", lookupError.message);
      throw lookupError;
    }

    if (!subscriber) {
      return NextResponse.json(
        { success: false, message: "Subscription not found." },
        { status: 404 }
      );
    }

    // Never use this demo endpoint to cancel real PayPal subscriptions.
    if (!subscriber.paypal_subscription_id.startsWith("DEMO-")) {
      return NextResponse.json(
        {
          success: false,
          message: "Only demo subscriptions can be cancelled here.",
        },
        { status: 403 }
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

    // Include ACTIVE in the update condition to avoid overwriting
    // a status that changed after the lookup.
    const { data: updatedSubscriber, error: updateError } = await supabase
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
      console.error("Subscription cancellation failed:", updateError.message);
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

    // Record the cancellation in the shared events table.
    const { error: eventError } = await supabase.from("events").insert({
      subscriber_id: subscriber.id,
      event_type: "DEMO.SUBSCRIPTION.CANCELLED",
      event_data: {
        subscriptionId,
        email: subscriber.email,
      },
    });

    if (eventError) {
      console.error("Cancellation event logging failed:", eventError.message);
      // The status has already changed, so do not report cancellation as
      // failed just because the separate audit event could not be recorded.
    }

    return NextResponse.json({
      success: true,
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
