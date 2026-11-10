export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type AllowedActionType = 'fix_payment_nudge' | 'discount_30' | 'pause_offer' | 'none';

export type ActionStatus = 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED';

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  paypal_subscription_id: string;
  plan: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'PAYMENT_FAILED' | 'IN_RECOVERY';
  risk_score: number; // 0 to 100
  risk_level: RiskLevel;
  risk_reason: string | null;
  recommended_action: AllowedActionType | null;
  created_at: string;
  updated_at?: string;
}

export interface SubscriberEvent {
  id: string;
  subscriber_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  paypal_event_id?: string;
  created_at: string;
}

export interface RiskAction {
  id: string;
  subscriber_id: string;
  action_type: AllowedActionType;
  status: ActionStatus;
  email_content: string | null;
  created_at: string;
  executed_at?: string | null;
  subscriber?: Subscriber;
}

export interface RiskAnalysisResult {
  risk_score: number;
  risk_level: RiskLevel;
  risk_reason: string;
  recommended_action: AllowedActionType;
  email_content: string;
}

export const ALLOWED_ACTION_TYPES: AllowedActionType[] = [
  'fix_payment_nudge',
  'discount_30',
  'pause_offer',
  'none',
];

export function isAllowedActionType(action: string): action is AllowedActionType {
  return ALLOWED_ACTION_TYPES.includes(action as AllowedActionType);
}
