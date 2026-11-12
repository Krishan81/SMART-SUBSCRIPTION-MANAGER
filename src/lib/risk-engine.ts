import {
  hasPayPalEvent,
  getSubscriberByPayPalId,
  getEvents,
  updateSubscriberByPayPalId,
  hasOpenAction,
  hasRecentAction,
  upsertSubscriber,
  createAction,
  createEvent,
} from './db';

import { analyzeSubscriberRiskWithGemini } from './gemini';
import { selectRetentionStrategy } from './retention-strategy';

import {
  isAllowedActionType,
} from '@/types/database';

import type {
  Subscriber,
  RiskAction,
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
  if (eventType.includes('ACTIVATED')) return 'ACTIVE';
  return 'PENDING';
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

  if (await hasPayPalEvent(paypalEventId)) {
    throw new Error('PayPal event has already been processed.');
  }

  // 1. Resolve the subscriber.
  let subscriber = await getSubscriberByPayPalId(paypalSubscriptionId);

  // 2. Register an unknown PayPal subscription.
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
    // 3. Synchronize subscription and payment lifecycle.
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
      eventType.includes('RE-ACTIVATED') ||
      eventType === 'PAYMENT.SALE.COMPLETED'
    ) {
      newStatus = 'ACTIVE';
    }

    const updates: Partial<Subscriber> = {};

    if (newStatus !== subscriber.status) {
      updates.status = newStatus;
    }

    const eventTime =
      getString(eventData.create_time) ||
      getString(eventData.update_time);

    if (eventType === 'PAYMENT.SALE.COMPLETED' && eventTime) {
      updates.last_payment_at = eventTime;
    }

    const billingInfo = eventData.billing_info;

    if (
      typeof billingInfo === 'object' &&
      billingInfo !== null &&
      !Array.isArray(billingInfo)
    ) {
      const nextBillingTime = getString(
        (billingInfo as Record<string, unknown>).next_billing_time
      );

      if (nextBillingTime) {
        updates.next_payment_at = nextBillingTime;
      }
    }

    if (Object.keys(updates).length > 0) {
      subscriber = await updateSubscriberByPayPalId(
        paypalSubscriptionId,
        updates
      );
    }
  }

  // 4. Load subscriber event history.
  const previousEvents = await getEvents(subscriber.id);

  const events = [
    {
      id: `incoming-${paypalEventId}`,
      subscriber_id: subscriber.id,
      event_type: eventType,
      event_data: eventData,
      paypal_event_id: paypalEventId,
      created_at: new Date().toISOString(),
    },
    ...previousEvents,
  ];

  // 5. Gemini analyzes churn risk.
  const analysis = await analyzeSubscriberRiskWithGemini(
    subscriber,
    events
  );

  const geminiAction = isAllowedActionType(
    analysis.recommended_action
  )
    ? analysis.recommended_action
    : 'none';

  // 6. Persist risk fields only. Preserve PayPal subscription data.
  const updatedSubscriber = await updateSubscriberByPayPalId(
    paypalSubscriptionId,
    {
      risk_score: analysis.risk_score,
      risk_level: analysis.risk_level,
      risk_reason: analysis.risk_reason,
      analysis_source: analysis.analysis_source,
      recommended_action: geminiAction,
    }
  );

  // 7. Select an action based on lifecycle and Gemini assessment.
  const decision = selectRetentionStrategy({
    status: updatedSubscriber.status,
    risk_level: updatedSubscriber.risk_level,
    recommended_action: geminiAction,
  });

  const selectedAction = decision.action;

  // Keep email content aligned with the final retention strategy.
  const emailTemplates: Record<string, string> = {
    fix_payment_nudge: `Hi ${updatedSubscriber.name},

We noticed a potential issue with your ${updatedSubscriber.plan} subscription. Please review your payment method through PayPal or contact our support team for assistance.

Best regards,
Customer Success`,
    discount_30: `Hi ${updatedSubscriber.name},

We value your ${updatedSubscriber.plan} subscription. Please contact our team to learn whether any retention offers are available to you.

Best regards,
Retention Team`,
    pause_offer: `Hi ${updatedSubscriber.name},

We would like to help you review the available options for your ${updatedSubscriber.plan} subscription. Please contact our support team if you would like assistance.

Best regards,
Customer Success`,
    none: '',
  };

  const actionEmailContent =
    selectedAction === geminiAction && analysis.email_content.trim()
      ? analysis.email_content
      : emailTemplates[selectedAction] ?? '';

  let createdAction: RiskAction | undefined;

  // 8. Avoid inappropriate, duplicate, or recently repeated actions.
  if (selectedAction !== 'none') {
    const alreadyOpen = await hasOpenAction(
      updatedSubscriber.id,
      selectedAction
    );

    if (alreadyOpen) {
      // Existing pending/approved action is already handling this strategy.
    } else {
      const recentlyUsed = await hasRecentAction(
        updatedSubscriber.id,
        selectedAction,
        7
      );

      if (!recentlyUsed) {
        createdAction = await createAction({
          subscriber_id: updatedSubscriber.id,
          action_type: selectedAction,
          status: 'PENDING',
          email_content: actionEmailContent,
        });
      }
    }
  }

  // 9. Persist the PayPal event after successful processing.
  await createEvent({
    subscriber_id: updatedSubscriber.id,
    event_type: eventType,
    event_data: eventData,
    paypal_event_id: paypalEventId,
  });

  return {
    subscriber: updatedSubscriber,
    analysis: {
      ...analysis,
      recommended_action: selectedAction,
      email_content: actionEmailContent,
    },
    action: createdAction,
  };
}
