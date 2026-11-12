import { NextRequest, NextResponse } from 'next/server';
import { verifyPayPalWebhookSignature } from '@/lib/paypal';
import { processEventAndRecomputeRisk } from '@/lib/risk-engine';
import { hasPayPalEvent } from '@/lib/db';

type RecordData = Record<string, unknown>;

function isRecord(value: unknown): value is RecordData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    let payload: unknown;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload.' },
        { status: 400 }
      );
    }

    if (!isRecord(payload)) {
      return NextResponse.json(
        { error: 'Invalid PayPal webhook payload.' },
        { status: 400 }
      );
    }

    const headersRecord: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersRecord[key] = value;
    });

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      console.error('PAYPAL_WEBHOOK_ID is not configured');
      return NextResponse.json(
        { error: 'PayPal webhook configuration is missing.' },
        { status: 500 }
      );
    }

    const isValid = await verifyPayPalWebhookSignature(
      headersRecord,
      rawBody,
      webhookId
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid PayPal webhook signature.' },
        { status: 401 }
      );
    }

    const eventType = payload.event_type;
    const paypalEventId = payload.id;
    const resource = payload.resource;

    if (
      typeof eventType !== 'string' ||
      typeof paypalEventId !== 'string' ||
      !isRecord(resource)
    ) {
      return NextResponse.json(
        { error: 'Required PayPal event fields are missing.' },
        { status: 400 }
      );
    }

    const supportedEvents = [
      'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.CREATED',
      'BILLING.SUBSCRIPTION.ACTIVATED',
      'BILLING.SUBSCRIPTION.SUSPENDED',
      'PAYMENT.SALE.COMPLETED',
      'PAYMENT.SALE.DENIED',
    ];

    if (!supportedEvents.includes(eventType)) {
      return NextResponse.json({
        status: 'success',
        message: 'Event ignored.',
      });
    }

    const supplementaryData = isRecord(resource.supplementary_data)
      ? resource.supplementary_data
      : {};

    const relatedIds = isRecord(supplementaryData.related_ids)
      ? supplementaryData.related_ids
      : {};

    const subscriptionId =
      resource.billing_agreement_id ||
      relatedIds.subscription_id ||
      resource.subscription_id ||
      (eventType.startsWith('BILLING.SUBSCRIPTION.')
        ? resource.id
        : undefined);

    if (
      typeof subscriptionId !== 'string' ||
      !subscriptionId.trim()
    ) {
      return NextResponse.json(
        {
          status: 'ignored',
          message: 'Event does not contain a recognizable subscription ID.',
        },
        { status: 200 }
      );
    }

    const alreadyProcessed = await hasPayPalEvent(paypalEventId);

    if (alreadyProcessed) {
      return NextResponse.json({
        status: 'success',
        message: 'Event already processed.',
      });
    }

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
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === 'PayPal event has already been processed.'
    ) {
      return NextResponse.json({
        status: 'success',
        message: 'Event already processed.',
      });
    }

    console.error('PayPal Webhook Error:', error);

    return NextResponse.json(
      { error: 'Internal webhook processing failed.' },
      { status: 500 }
    );
  }
}