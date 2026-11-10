import { NextRequest, NextResponse } from 'next/server';
import { verifyPayPalWebhookSignature } from '@/lib/paypal';
import { processEventAndRecomputeRisk } from '@/lib/risk-engine';
import { getEvents } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    const headersRecord: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersRecord[key] = value;
    });

    const webhookId = process.env.PAYPAL_WEBHOOK_ID || 'your-paypal-webhook-id';

    // Verify signature
    const isValid = verifyPayPalWebhookSignature(headersRecord, rawBody, webhookId);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid PayPal webhook signature' }, { status: 401 });
    }

    const eventType = payload.event_type || 'BILLING.SUBSCRIPTION.UPDATED';
    const paypalEventId = payload.id || 'evt-' + Date.now();
    const resource = payload.resource || {};

    // Extract subscription ID from PayPal webhook payload structure
    const subscriptionId =
      resource.billing_agreement_id ||
      resource.id ||
      resource.subscription_id ||
      'I-SUB-PAYPAL-101';

    // Idempotency check: check if event already exists
    const existingEvents = await getEvents();
    const alreadyProcessed = existingEvents.some((e) => e.paypal_event_id === paypalEventId);

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
