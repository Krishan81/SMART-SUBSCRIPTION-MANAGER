import type { AllowedActionType, RiskLevel, Subscriber } from '@/types/database';

export interface RetentionDecision {
  action: AllowedActionType;
  reason: string;
}

export function selectRetentionStrategy(
  subscriber: Pick<Subscriber, 'status' | 'risk_level' | 'recommended_action'>
): RetentionDecision {
  switch (subscriber.status) {
    case 'CANCELLED':
      return {
        action: 'none',
        reason: 'Subscription is cancelled; active-subscription retention is not applicable.',
      };

    case 'PAYMENT_FAILED':
      return {
        action: 'fix_payment_nudge',
        reason: 'Payment failure requires payment recovery.',
      };

    case 'SUSPENDED':
      return {
        action: 'pause_offer',
        reason: 'Suspended subscription requires a reactivation-focused intervention.',
      };

    case 'PENDING':
      return {
        action: 'none',
        reason: 'Subscription approval is still pending.',
      };

    case 'ACTIVE':
      break;

    case 'IN_RECOVERY':
      return {
        action: 'fix_payment_nudge',
        reason: 'Subscription is undergoing payment recovery.',
      };

    default:
      return {
        action: 'none',
        reason: 'No eligible subscription lifecycle action.',
      };
  }

  const riskActions: Record<RiskLevel, AllowedActionType> = {
    Low: 'none',
    Medium: subscriber.recommended_action === 'none'
      ? 'none'
      : subscriber.recommended_action ?? 'none',
    High: subscriber.recommended_action === 'none'
      ? 'discount_30'
      : subscriber.recommended_action ?? 'discount_30',
    Critical: 'discount_30',
  };

  const action = riskActions[subscriber.risk_level];

  return {
    action,
    reason: action === 'none'
      ? 'No intervention is currently justified by the risk assessment.'
      : 'Strategy selected using subscription status and churn risk.',
  };
}
