import {
  getSubscriberByPayPalId,
  hasPayPalEvent,
  getEvents,
  getActions,
  upsertSubscriber,
  createAction,
  createEvent,
} from './db';

import { analyzeSubscriberRiskWithGemini } from './gemini';

import {
  Subscriber,
  RiskAction,
  isAllowedActionType,
  RiskAnalysisResult,
} from '@/types/database';


type EventData = Record<string, unknown>;

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}

function getInitialStatus(eventType: string): Subscriber['status'] {
  if (eventType.includes('CANCELLED')) return 'CANCELLED';
  if (eventType.includes('FAILED') || eventType.includes('DENIED')) {
    return 'PAYMENT_FAILED';
  }
  if (eventType.includes('SUSPENDED')) return 'SUSPENDED';
  return 'ACTIVE';
}

export async function processEventAndRecomputeRisk(
  paypalSubscriptionId: string,
  eventType: string,
  eventData: EventData,
  paypalEventId: string
): Promise<{
  subscriber: Subscriber;
  analysis: RiskAnalysisResult;
  action?: RiskAction;
}> {
  if (!paypalSubscriptionId.trim() || !paypalEventId.trim()) {
    throw new Error('A valid PayPal subscription ID and event ID are required.');
  }

  // Avoid repeating work when PayPal retries an already persisted event.
  const alreadyProcessed = await hasPayPalEvent(paypalEventId);

  if (alreadyProcessed) {
    throw new Error('PayPal event has already been processed.');
  }

  // 1. Find the subscriber associated with the real PayPal subscription.
  let subscriber = await getSubscriberByPayPalId(paypalSubscriptionId);

  // 2. Register a new subscriber if this subscription is not yet known.
  if (!subscriber) {
    const email = getString(eventData.payer_email);

    subscriber = await upsertSubscriber({
      name:
        getString(eventData.subscriber_name) ||
        email?.split('@')[0] ||
        'PayPal Subscriber',
      email: email || `paypal_${paypalSubscriptionId}@example.invalid`,
      paypal_subscription_id: paypalSubscriptionId,
      plan: getString(eventData.plan_name) || 'Standard Subscription',
      status: getInitialStatus(eventType),
      risk_score: 20,
      risk_level: 'Low',
      risk_reason: 'Newly registered via PayPal webhook.',
      recommended_action: 'none',
    });
  } else {
    // 3. Update subscriber status from the PayPal event.
    let newStatus = subscriber.status;

    if (eventType.includes('CANCELLED')) {
      newStatus = 'CANCELLED';
    } else if (
      eventType.includes('FAILED') ||
      eventType.includes('DENIED')
    ) {
      newStatus = 'PAYMENT_FAILED';
    } else if (eventType.includes('SUSPENDED')) {
      newStatus = 'SUSPENDED';
    } else if (
      eventType.includes('ACTIVATED') ||
      eventType.includes('RE-ACTIVATED')
    ) {
      newStatus = 'ACTIVE';
    }

    if (newStatus !== subscriber.status) {
      subscriber = await upsertSubscriber({
        ...subscriber,
        status: newStatus,
      });
    }
  }

  // 4. Load history and include the incoming event in this analysis.
  const previousEvents = await getEvents(subscriber.id);

  const events = [
    {
      id: 'incoming-' + paypalEventId,
      subscriber_id: subscriber.id,
      event_type: eventType,
      event_data: eventData,
      paypal_event_id: paypalEventId,
      created_at: new Date().toISOString(),
    },
    ...previousEvents,
  ];

  // 5. Recalculate risk using the updated timeline.
  const analysis = await analyzeSubscriberRiskWithGemini(
    subscriber,
    events
  );

  const validAction = isAllowedActionType(
    analysis.recommended_action
  )
    ? analysis.recommended_action
    : 'none';

  // 6. Persist the Gemini risk assessment.
  const updatedSubscriber = await upsertSubscriber({
    id: subscriber.id,
    paypal_subscription_id: subscriber.paypal_subscription_id,
    risk_score: analysis.risk_score,
    risk_level: analysis.risk_level,
    risk_reason: analysis.risk_reason,
    recommended_action: validAction,
  });

  // 7. Create an action awaiting administrator approval.
  let createdAction: RiskAction | undefined;

  if (validAction !== 'none') {
    const existingActions = await getActions();

    const existingPendingAction = existingActions.find(
      (existing) =>
        existing.subscriber_id === updatedSubscriber.id &&
        existing.action_type === validAction &&
        existing.status === 'PENDING'
    );

    if (existingPendingAction) {
      createdAction = existingPendingAction;
    } else {
      createdAction = await createAction({
        subscriber_id: updatedSubscriber.id,
        action_type: validAction,
        status: 'PENDING',
        email_content: analysis.email_content,
      });
    }
  }

  // 7. Persist the event only after risk processing succeeds.
  await createEvent({
    subscriber_id: updatedSubscriber.id,
    event_type: eventType,
    event_data: eventData,
    paypal_event_id: paypalEventId,
  });

  return {
    subscriber: updatedSubscriber,
    analysis,
    action: createdAction,
  };
}
