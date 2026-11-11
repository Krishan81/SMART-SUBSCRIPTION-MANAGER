import { NextRequest, NextResponse } from 'next/server';
import { verifyPayPalWebhookSignature } from '@/lib/paypal';
import { processEventAndRecomputeRisk } from '@/lib/risk-engine';
import { eventExists } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const headersRecord: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersRecord[key] = value;
    });

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      console.error('PAYPAL_WEBHOOK_ID is not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify signature
    const isValid = await verifyPayPalWebhookSignature(headersRecord, rawBody, webhookId);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid PayPal webhook signature' }, { status: 401 });
    }

    const eventType = payload.event_type;

    // Supported event types allowlist
    const supportedEvents = [
      'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.CREATED',
      'BILLING.SUBSCRIPTION.ACTIVATED',
      'BILLING.SUBSCRIPTION.SUSPENDED',
      'PAYMENT.SALE.COMPLETED',
      'PAYMENT.SALE.DENIED'
    ];

    if (!eventType || !supportedEvents.includes(eventType)) {
      console.log(`Ignoring unsupported event type: ${eventType}`);
      return NextResponse.json({ status: 'success', message: 'Event ignored' });
    }

    const paypalEventId = payload.id;
    if (!paypalEventId) {
      return NextResponse.json({ error: 'Missing PayPal event ID' }, { status: 400 });
    }

    const resource = payload.resource || {};

    // Extract subscription ID from PayPal webhook payload structure
    const subscriptionId =
      resource.billing_agreement_id ||
      resource.id ||
      resource.subscription_id;

    if (!subscriptionId) {
      console.error('Could not extract subscription ID from webhook resource');
      return NextResponse.json({ error: 'Missing subscription ID in event resource' }, { status: 422 });
    }

    // Idempotency check: check if event already exists
    const alreadyProcessed = await eventExists(paypalEventId);

    if (alreadyProcessed) {
      return NextResponse.json({ status: 'success', message: 'Event already processed (idempotent)' });
    }

    // Process through risk engine
    const result = await processEventAndRecomputeRisk(
      subscriptionId,
      eventType,
      {
        ...resource,
        summary: payload.summary,
        create_time: payload.create_time,
      },
      paypalEventId
    );

    return NextResponse.json({
      status: 'success',
      event_type: eventType,
      subscriber: result.subscriber.name,
      risk_score: result.subscriber.risk_score,
      risk_level: result.subscriber.risk_level,
      recommended_action: result.subscriber.recommended_action,
      action_created: Boolean(result.action),
    });
  } catch (error: any) {
    console.error('PayPal Webhook Error:', error);
    return NextResponse.json({ error: error.message || 'Internal webhook error' }, { status: 500 });
  }
}
