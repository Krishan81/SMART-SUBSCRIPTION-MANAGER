
import { NextRequest, NextResponse } from "next/server";
import { getPayPalAccessToken } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";

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

    const transmissionId = request.headers.get(
      "paypal-transmission-id"
    );
    const transmissionTime = request.headers.get(
      "paypal-transmission-time"
    );
    const certUrl = request.headers.get("paypal-cert-url");
    const authAlgo = request.headers.get("paypal-auth-algo");
    const transmissionSig = request.headers.get(
      "paypal-transmission-sig"
    );

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

    if (!eventType || !resource) {
      return NextResponse.json(
        { success: false, message: "Incomplete PayPal event" },
        { status: 400 }
      );
    }

    // Subscription lifecycle events identify the subscription
    // through resource.id.
    const subscriptionEvents: Record<string, string> = {
      "BILLING.SUBSCRIPTION.ACTIVATED": "ACTIVE",
      "BILLING.SUBSCRIPTION.SUSPENDED": "SUSPENDED",
      "BILLING.SUBSCRIPTION.CANCELLED": "CANCELLED",
    };

    if (subscriptionEvents[eventType]) {
      const paypalSubscriptionId = resource.id;

      if (!paypalSubscriptionId) {
        return NextResponse.json(
          { success: false, message: "Missing subscription ID" },
          { status: 400 }
        );
      }

      const subscription = await prisma.subscription.findUnique({
        where: { paypalSubscriptionId },
      });

      if (!subscription) {
        console.error(
          "Subscription not found for PayPal event:",
          event.id
        );

        // Acknowledge the verified event to avoid endless retries.
        // The event should be investigated in the server logs.
        return NextResponse.json({
          success: true,
          received: true,
          verified: true,
          processed: false,
          message: "Subscription not found",
          event_type: eventType,
        });
      }

      await prisma.subscription.update({
        where: { paypalSubscriptionId },
        data: {
          status: subscriptionEvents[eventType],
        },
      });
    } else if (eventType === "BILLING.SUBSCRIPTION.UPDATED") {
      const paypalSubscriptionId = resource.id;

      if (!paypalSubscriptionId) {
        return NextResponse.json(
          { success: false, message: "Missing subscription ID" },
          { status: 400 }
        );
      }

      const allowedStatuses = [
        "APPROVAL_PENDING",
        "APPROVED",
        "ACTIVE",
        "SUSPENDED",
        "CANCELLED",
        "EXPIRED",
      ];

      const status = resource.status?.toUpperCase();

      if (status && allowedStatuses.includes(status)) {
        await prisma.subscription.updateMany({
          where: { paypalSubscriptionId },
          data: { status },
        });
      }
    } else if (eventType === "PAYMENT.SALE.COMPLETED") {
      const paymentId = resource.id;
      const paypalSubscriptionId = resource.billing_agreement_id;
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

      const subscription = await prisma.subscription.findUnique({
        where: { paypalSubscriptionId },
      });

      if (!subscription) {
        console.error("Payment references an unknown subscription");

        return NextResponse.json({
          success: true,
          received: true,
          verified: true,
          processed: false,
          message: "Subscription not found for payment",
          event_type: eventType,
        });
      }

      const paidAtValue =
        resource.create_time ?? event.create_time;

      const paidAt = paidAtValue
        ? new Date(paidAtValue)
        : new Date();

      await prisma.payment.upsert({
        where: { paypalPaymentId: paymentId },
        update: {
          amount,
          currency,
          status: "COMPLETED",
          paidAt,
        },
        create: {
          paypalPaymentId: paymentId,
          amount,
          currency,
          status: "COMPLETED",
          paidAt,
          subscriptionId: subscription.id,
        },
      });
    } else if (
      eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED"
    ) {
      // A failed payment is not necessarily a suspended subscription.
      // Persisting this event requires a webhook/event-history table.
      console.log("Verified PayPal payment failure:", event.id);
    } else {
      console.log("Unhandled PayPal event:", eventType);
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
