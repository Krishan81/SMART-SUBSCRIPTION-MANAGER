import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function demoModeEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.PAYPAL_DEMO_MODE === "true"
  );
}

// GET: Load payment history for a user's demo subscriptions
export async function GET(request: NextRequest) {
  if (!demoModeEnabled()) {
    return NextResponse.json(
      { success: false, message: "Demo payments are disabled" },
      { status: 403 }
    );
  }

  try {
    const email = request.nextUrl.searchParams.get("email")?.trim();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email address is required" },
        { status: 400 }
      );
    }

    const { data: subscriber, error: subscriberError } = await supabase
      .from("subscribers")
      .select("id, paypal_subscription_id")
      .ilike("email", email)
      .maybeSingle();

    if (subscriberError) {
      console.error("Unable to find subscriber:", subscriberError.message);
      throw subscriberError;
    }

    if (!subscriber) {
      return NextResponse.json({
        success: true,
        payments: [],
        diagnostic: {
          userFound: false,
          demoSubscriptionCount: 0,
          paymentCount: 0,
        },
      });
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(
        "id, paypal_payment_id, paypal_subscription_id, amount, currency, status, paid_at, created_at"
      )
      .eq("subscriber_id", subscriber.id)
      .like("paypal_payment_id", "DEMO-PAY-%")
      .order("created_at", { ascending: false });

    if (paymentsError) {
      console.error("Unable to query payments:", paymentsError.message);
      throw paymentsError;
    }

    const paymentList = payments ?? [];
    const demoSubscriptionCount =
      subscriber.paypal_subscription_id?.startsWith("DEMO-") ? 1 : 0;

    return NextResponse.json({
      success: true,
      payments: paymentList.map((payment) => ({
        id: payment.id,
        paymentId: payment.paypal_payment_id,
        amount: String(payment.amount),
        currency: payment.currency,
        status: payment.status,
        paidAt: payment.paid_at,
        createdAt: payment.created_at,
        subscriptionId: payment.paypal_subscription_id,
        simulated: payment.paypal_payment_id.startsWith("DEMO-PAY-"),
      })),
      diagnostic: {
        userFound: true,
        demoSubscriptionCount,
        paymentCount: paymentList.length,
      },
    });
  } catch (error) {
    console.error("Unable to load demo payment history:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load payment history" },
      { status: 500 }
    );
  }
}

// POST: Simulate a successful or failed demo payment
export async function POST(request: NextRequest) {
  if (!demoModeEnabled()) {
    return NextResponse.json(
      { success: false, message: "Demo payments are disabled" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const subscriptionId =
      typeof body.subscriptionId === "string"
        ? body.subscriptionId.trim()
        : "";

    const outcome = body.outcome;
    const amountString = String(body.amount ?? "10.00");

    if (!subscriptionId.startsWith("DEMO-")) {
      return NextResponse.json(
        { success: false, message: "A valid demo subscription is required" },
        { status: 400 }
      );
    }

    if (outcome !== "SUCCESS" && outcome !== "FAILED") {
      return NextResponse.json(
        { success: false, message: "Outcome must be SUCCESS or FAILED" },
        { status: 400 }
      );
    }

    if (
      !/^\d{1,7}(\.\d{1,2})?$/.test(amountString) ||
      Number(amountString) <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid positive amount" },
        { status: 400 }
      );
    }

    const { data: subscriber, error: subscriberError } = await supabase
      .from("subscribers")
      .select("id, paypal_subscription_id")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();

    if (subscriberError) {
      console.error("Unable to find demo subscription:", subscriberError.message);
      throw subscriberError;
    }

    if (!subscriber) {
      return NextResponse.json(
        { success: false, message: "Demo subscription not found" },
        { status: 404 }
      );
    }

    const isSuccessful = outcome === "SUCCESS";

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        subscriber_id: subscriber.id,
        paypal_payment_id: `DEMO-PAY-${randomUUID()}`,
        paypal_subscription_id: subscriptionId,
        amount: amountString,
        currency: "USD",
        status: isSuccessful ? "COMPLETED" : "FAILED",
        paid_at: isSuccessful ? new Date().toISOString() : null,
      })
      .select(
        "id, paypal_payment_id, paypal_subscription_id, amount, currency, status, paid_at"
      )
      .single();

    if (paymentError) {
      console.error("Unable to save demo payment:", paymentError.message);
      throw paymentError;
    }

    return NextResponse.json(
      {
        success: true,
        simulated: true,
        message: isSuccessful
          ? "Demo successful payment saved"
          : "Demo failed payment saved",
        payment: {
          id: payment.id,
          paymentId: payment.paypal_payment_id,
          amount: String(payment.amount),
          currency: payment.currency,
          status: payment.status,
          paidAt: payment.paid_at,
          subscriptionId: payment.paypal_subscription_id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Demo payment simulation failed:", error);

    return NextResponse.json(
      { success: false, message: "Could not save demo payment" },
      { status: 500 }
    );
  }
}