import { getSubscriberById, getSubscriberByPayPalId, getEvents, upsertSubscriber, createAction } from './db';
import { analyzeSubscriberRiskWithGemini } from './gemini';
import { Subscriber, SubscriberEvent, RiskAction, isAllowedActionType } from '@/types/database';

export async function processEventAndRecomputeRisk(
  paypalSubscriptionId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  paypalEventId?: string
): Promise<{ subscriber: Subscriber; analysis: any; action?: RiskAction }> {
  // 1. Identify subscriber by PayPal subscription ID
  let subscriber = await getSubscriberByPayPalId(paypalSubscriptionId);

  if (!subscriber) {
    // If subscriber doesn't exist yet, auto-provision a default subscriber record
    subscriber = await upsertSubscriber({
      name: (eventData.subscriber_name as string) || (eventData.payer_email as string)?.split('@')[0] || 'PayPal Subscriber',
      email: (eventData.payer_email as string) || `subscriber_${Date.now()}@example.com`,
      paypal_subscription_id: paypalSubscriptionId,
      plan: (eventData.plan_name as string) || 'Standard Subscription',
      status: eventType.includes('CANCELLED') ? 'CANCELLED' : eventType.includes('FAILED') ? 'PAYMENT_FAILED' : 'ACTIVE',
      risk_score: 20,
      risk_level: 'Low',
      risk_reason: 'Newly registered via webhook event.',
      recommended_action: 'none',
    });
  } else {
    // Update subscriber status based on event type
    let newStatus = subscriber.status;
    if (eventType.includes('CANCELLED')) newStatus = 'CANCELLED';
    else if (eventType.includes('FAILED') || eventType.includes('DENIED')) newStatus = 'PAYMENT_FAILED';
    else if (eventType.includes('SUSPENDED')) newStatus = 'SUSPENDED';
    else if (eventType.includes('COMPLETED') || eventType.includes('ACTIVATED')) newStatus = 'ACTIVE';

    if (newStatus !== subscriber.status) {
      subscriber = await upsertSubscriber({
        ...subscriber,
        status: newStatus,
      });
    }
  }

  // 2. Save event in events table
  const { createEvent } = await import('./db');
  await createEvent({
    subscriber_id: subscriber.id,
    event_type: eventType,
    event_data: eventData,
    paypal_event_id: paypalEventId || 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
  });

  // 3. Fetch all timeline events for this subscriber
  const events = await getEvents(subscriber.id);

  // 4. Trigger Gemini AI / Heuristic risk analysis
  const analysis = await analyzeSubscriberRiskWithGemini(subscriber, events);

  // Strict validation of recommended action
  const validAction = isAllowedActionType(analysis.recommended_action)
    ? analysis.recommended_action
    : 'none';

  // 5. Update subscriber risk score, level, reason, and recommended action
  const updatedSubscriber = await upsertSubscriber({
    id: subscriber.id,
    paypal_subscription_id: subscriber.paypal_subscription_id,
    risk_score: analysis.risk_score,
    risk_level: analysis.risk_level,
    risk_reason: analysis.risk_reason,
    recommended_action: validAction,
  });

  // 6. If recommended action is not 'none', create a PENDING action in actions table (Admin must approve!)
  let createdAction: RiskAction | undefined;
  if (validAction !== 'none') {
    createdAction = await createAction({
      subscriber_id: updatedSubscriber.id,
      action_type: validAction,
      status: 'PENDING',
      email_content: analysis.email_content,
    });
  }

  return {
    subscriber: updatedSubscriber,
    analysis,
    action: createdAction,
  };
}
