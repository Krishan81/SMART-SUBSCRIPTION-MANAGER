import { NextRequest, NextResponse } from "next/server";
import { getPayPalAccessToken } from "@/lib/paypal";
import { supabase } from "@/lib/supabase";
import { eventExists } from "@/lib/db";
import { processEventAndRecomputeRisk } from "@/lib/risk-engine";

type PayPalEvent = {
  id?: string;
  event_type?: string;
  create_time?: string;
  resource?: {
    id?: string;
    status?: string;
    billing_agreement_id?: string;
    amount?: {
      total?: string;
      currency?: string;
    };
    create_time?: string;
  };
};

const subscriptionStatuses: Record<string, string> = {
  "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
  "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
  "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
};

const allowedStatuses = [
  "APPROVAL_PENDING",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
  "EXPIRED",
];

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    let event: PayPalEvent;

    try {
      event = JSON.parse(rawBody) as PayPalEvent;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Verify the PayPal webhook signature.
    const transmissionId = request.headers.get("paypal-transmission-id");
    const transmissionTime = request.headers.get("paypal-transmission-time");
    const certUrl = request.headers.get("paypal-cert-url");
    const authAlgo = request.headers.get("paypal-auth-algo");
    const transmissionSig = request.headers.get("paypal-transmission-sig");

    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing PayPal verification headers",
        },
        { status: 401 }
      );
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const baseUrl = process.env.PAYPAL_BASE_URL;

    if (!webhookId || !baseUrl) {
      console.error("PayPal webhook configuration is missing");

      return NextResponse.json(
        {
          success: false,
          message: "Webhook verification is not configured",
        },
        { status: 500 }
      );
    }

    const accessToken = await getPayPalAccessToken();

    const verifyResponse = await fetch(
      `${baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: event,
        }),
      }
    );

    if (!verifyResponse.ok) {
      console.error("PayPal signature verification request failed");

      return NextResponse.json(
        { success: false, message: "Verification request failed" },
        { status: 502 }
      );
    }

    const verification = await verifyResponse.json();

    if (verification.verification_status !== "SUCCESS") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid PayPal webhook signature",
        },
        { status: 401 }
      );
    }

    const eventType = event.event_type;
    const resource = event.resource;

    if (!eventType || !resource || !event.id) {
      return NextResponse.json(
        { success: false, message: "Incomplete PayPal event" },
        { status: 400 }
      );
    }

    // Acknowledge completed deliveries without processing them twice.
    if (await eventExists(event.id)) {
      return NextResponse.json({
        success: true,
        received: true,
        verified: true,
        duplicate: true,
      });
    }

    // Resolve the relevant subscription ID from the event.
    const paypalSubscriptionId =
      eventType.startsWith("BILLING.SUBSCRIPTION.")
        ? resource.id
        : resource.billing_agreement_id;

    if (
      eventType.startsWith("BILLING.SUBSCRIPTION.") &&
      !paypalSubscriptionId
    ) {
      return NextResponse.json(
        { success: false, message: "Missing subscription ID" },
        { status: 400 }
      );
    }

    let subscriber: { id: string; paypal_subscription_id: string } | null =
      null;

    if (paypalSubscriptionId) {
      const { data, error } = await supabase
        .from("subscribers")
        .select("id, paypal_subscription_id")
        .eq("paypal_subscription_id", paypalSubscriptionId)
        .maybeSingle();

      if (error) {
        console.error("Unable to find subscriber:", error.message);
        throw error;
      }

      subscriber = data;
    }

    if (!subscriber) {
      console.error("No subscriber found for PayPal event:", {
        eventId: event.id,
        eventType,
        paypalSubscriptionId,
      });

      // Acknowledge the verified event so PayPal does not retry forever.
      // Investigate unknown subscription IDs in the server logs.
      return NextResponse.json({
        success: true,
        received: true,
        verified: true,
        processed: false,
        message: "Subscriber not found",
        event_type: eventType,
      });
    }

    // Update subscription lifecycle status.
    if (subscriptionStatuses[eventType]) {
      const { error } = await supabase
        .from("subscribers")
        .update({
          status: subscriptionStatuses[eventType],
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriber.id);

      if (error) {
        console.error("Unable to update subscriber status:", error.message);
        throw error;
      }
    } else if (eventType === "BILLING.SUBSCRIPTION.UPDATED") {
      const status = resource.status?.toUpperCase();

      if (status && allowedStatuses.includes(status)) {
        const { error } = await supabase
          .from("subscribers")
          .update({
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscriber.id);

        if (error) {
          console.error("Unable to update subscriber:", error.message);
          throw error;
        }
      }
    }

    // Save completed PayPal payments.
    if (eventType === "PAYMENT.SALE.COMPLETED") {
      const paymentId = resource.id;
      const amount = resource.amount?.total;
      const currency = resource.amount?.currency;

      if (
        !paymentId ||
        !paypalSubscriptionId ||
        !amount ||
        !currency ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) < 0
      ) {
        return NextResponse.json(
          { success: false, message: "Incomplete payment details" },
          { status: 400 }
        );
      }

      const paidAtValue = resource.create_time ?? event.create_time;
      const parsedPaidAt = paidAtValue ? new Date(paidAtValue) : new Date();

      if (Number.isNaN(parsedPaidAt.getTime())) {
        return NextResponse.json(
          { success: false, message: "Invalid payment date" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("payments")
        .upsert(
          {
            subscriber_id: subscriber.id,
            paypal_payment_id: paymentId,
            paypal_subscription_id: paypalSubscriptionId,
            amount,
            currency,
            status: "COMPLETED",
            paid_at: parsedPaidAt.toISOString(),
          },
          { onConflict: "paypal_payment_id" }
        );

      if (error) {
        console.error("Unable to save PayPal payment:", error.message);
        throw error;
      }
    }

    // Run AI risk analysis after subscription/payment updates succeed.
    if (paypalSubscriptionId) {
      await processEventAndRecomputeRisk(
        paypalSubscriptionId,
        eventType,
        {
          ...(resource as Record<string, unknown>),
          summary: (event as PayPalEvent & { summary?: string }).summary,
          create_time: event.create_time,
        },
        event.id
      );
    }

    // Record lifecycle, payment, failure and other recognized events.
    const { error: eventError } = await supabase
      .from("events")
      .upsert(
        {
          subscriber_id: subscriber.id,
          event_type: eventType,
          event_data: event,
          paypal_event_id: event.id ?? null,
        },
        {
          onConflict: "paypal_event_id",
          ignoreDuplicates: true,
        }
      );

    if (eventError) {
      console.error("Unable to save PayPal event:", eventError.message);
      throw eventError;
    }

    return NextResponse.json({
      success: true,
      received: true,
      verified: true,
      event_type: eventType,
    });
  } catch (error) {
    console.error("PayPal webhook processing failed:", error);

    return NextResponse.json(
      { success: false, message: "Webhook processing failed" },
      { status: 500 }
    );
  }
}