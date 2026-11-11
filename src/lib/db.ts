import { supabaseAdmin as supabase, isSupabaseServiceConfigured as isSupabaseConfigured } from './supabase-admin';
import { Subscriber, SubscriberEvent, RiskAction, AllowedActionType, ActionStatus } from '@/types/database';

// In-memory fallback store when Supabase is not configured
class MockDB {
  subscribers: Subscriber[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      paypal_subscription_id: 'I-SUB-PAYPAL-101',
      plan: 'Enterprise Pro',
      status: 'PAYMENT_FAILED',
      risk_score: 85,
      risk_level: 'Critical',
      risk_reason: '2 consecutive payment failures in last 7 days. Card expired.',
      recommended_action: 'fix_payment_nudge',
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Sarah Connor',
      email: 'sarah.c@example.com',
      paypal_subscription_id: 'I-SUB-PAYPAL-102',
      plan: 'Pro Monthly',
      status: 'SUSPENDED',
      risk_score: 72,
      risk_level: 'High',
      risk_reason: 'Billing failure and plan downgrade attempt after price revision.',
      recommended_action: 'discount_30',
      created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Michael Scott',
      email: 'm.scott@dundermifflin.com',
      paypal_subscription_id: 'I-SUB-PAYPAL-103',
      plan: 'Pro Annual',
      status: 'ACTIVE',
      risk_score: 45,
      risk_level: 'Medium',
      risk_reason: 'Subscriber disabled auto-renew in PayPal account settings.',
      recommended_action: 'pause_offer',
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Elena Rostova',
      email: 'elena.rostova@techcorp.io',
      paypal_subscription_id: 'I-SUB-PAYPAL-104',
      plan: 'Enterprise Pro',
      status: 'ACTIVE',
      risk_score: 12,
      risk_level: 'Low',
      risk_reason: 'Consistent on-time payment history for 12 months.',
      recommended_action: 'none',
      created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  events: SubscriberEvent[] = [
    {
      id: 'e-1',
      subscriber_id: '11111111-1111-1111-1111-111111111111',
      event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
      event_data: { amount: 199.00, currency: 'USD', reason: 'EXPIRED_CARD' },
      paypal_event_id: 'WH-EVT-001',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'e-2',
      subscriber_id: '11111111-1111-1111-1111-111111111111',
      event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
      event_data: { amount: 199.00, currency: 'USD', reason: 'INSUFFICIENT_FUNDS' },
      paypal_event_id: 'WH-EVT-002',
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      id: 'e-3',
      subscriber_id: '22222222-2222-2222-2222-222222222222',
      event_type: 'BILLING.SUBSCRIPTION.SUSPENDED',
      event_data: { reason: 'PAYMENT_RETRY_EXHAUSTED' },
      paypal_event_id: 'WH-EVT-003',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'e-4',
      subscriber_id: '33333333-3333-3333-3333-333333333333',
      event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
      event_data: { reason: 'CUSTOMER_CANCELLED' },
      paypal_event_id: 'WH-EVT-004',
      created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
  ];

  actions: RiskAction[] = [
    {
      id: 'a-1',
      subscriber_id: '11111111-1111-1111-1111-111111111111',
      action_type: 'fix_payment_nudge',
      status: 'PENDING',
      email_content: 'Hi Alex, We noticed your recent payment attempt for your Enterprise Pro subscription was unsuccessful due to card expiration. Please update your payment details to avoid service disruption.',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'a-2',
      subscriber_id: '22222222-2222-2222-2222-222222222222',
      action_type: 'discount_30',
      status: 'PENDING',
      email_content: 'Hi Sarah, We value you as a subscriber! We are offering an exclusive 30% discount on your next 3 billing cycles if you reactivate your Pro Monthly subscription today.',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];
}


function assertMockFallbackAllowed(): void {
  if (isSupabaseConfigured || process.env.NODE_ENV === 'production') {
    throw new Error(
      'Supabase operation failed or is not configured. Mock fallback is disabled.'
    );
  }
}

const mockDb = new MockDB();

export async function getSubscribers(): Promise<Subscriber[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .order('risk_score', { ascending: false });
    if (!error && data) return data as Subscriber[];
  }
  assertMockFallbackAllowed();
  return [...mockDb.subscribers].sort((a, b) => b.risk_score - a.risk_score);
}

export async function getSubscriberById(id: string): Promise<Subscriber | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return (data as Subscriber | null) ?? null;
  }

  assertMockFallbackAllowed();
  return mockDb.subscribers.find((s) => s.id === id || s.paypal_subscription_id === id) || null;
}

export async function getSubscriberByPayPalId(paypalId: string): Promise<Subscriber | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('paypal_subscription_id', paypalId)
      .maybeSingle();

    if (error) throw error;
    return (data as Subscriber | null) ?? null;
  }

  assertMockFallbackAllowed();
  return mockDb.subscribers.find((s) => s.paypal_subscription_id === paypalId) || null;
}

export async function upsertSubscriber(sub: Partial<Subscriber>): Promise<Subscriber> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('subscribers')
      .upsert(sub, { onConflict: 'paypal_subscription_id' })
      .select()
      .single();
    if (!error && data) return data as Subscriber;
  }
  assertMockFallbackAllowed();

  // Mock fallback upsert
  const existingIndex = mockDb.subscribers.findIndex(
    (s) => s.paypal_subscription_id === sub.paypal_subscription_id || s.id === sub.id
  );

  if (existingIndex >= 0) {
    mockDb.subscribers[existingIndex] = {
      ...mockDb.subscribers[existingIndex],
      ...sub,
      updated_at: new Date().toISOString(),
    };
    return mockDb.subscribers[existingIndex];
  } else {
    const newSub: Subscriber = {
      id: sub.id || 'sub-' + Math.random().toString(36).substring(2, 9),
      name: sub.name || 'New Subscriber',
      email: sub.email || 'subscriber@example.com',
      paypal_subscription_id: sub.paypal_subscription_id || 'I-SUB-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      plan: sub.plan || 'Pro Monthly',
      status: sub.status || 'ACTIVE',
      risk_score: sub.risk_score ?? 10,
      risk_level: sub.risk_level || 'Low',
      risk_reason: sub.risk_reason || 'Initial registration',
      recommended_action: sub.recommended_action || 'none',
      created_at: sub.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockDb.subscribers.unshift(newSub);
    return newSub;
  }
}

export async function hasPayPalEvent(paypalEventId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('paypal_event_id', paypalEventId)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  assertMockFallbackAllowed();
  return mockDb.events.some(
    (event) => event.paypal_event_id === paypalEventId
  );
}

export async function getEvents(subscriberId?: string): Promise<SubscriberEvent[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('events').select('*').order('created_at', { ascending: false });
    if (subscriberId) {
      query = query.eq('subscriber_id', subscriberId);
    }
    const { data, error } = await query;
    if (!error && data) return data as SubscriberEvent[];
  }
  assertMockFallbackAllowed();

  if (subscriberId) {
    return mockDb.events.filter((e) => e.subscriber_id === subscriberId);
  }
  return [...mockDb.events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createEvent(
  event: Omit<SubscriberEvent, 'id' | 'created_at'>
): Promise<SubscriberEvent> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && event.paypal_event_id) {
        const { data: existing, error: lookupError } = await supabase
          .from('events')
          .select()
          .eq('paypal_event_id', event.paypal_event_id)
          .maybeSingle();

        if (lookupError) throw lookupError;
        if (existing) return existing as SubscriberEvent;
      }

      throw error;
    }

    if (!data) {
      throw new Error('Event insert returned no record.');
    }

    return data as SubscriberEvent;
  }

  assertMockFallbackAllowed();

  if (
    event.paypal_event_id &&
    mockDb.events.some(
      (existing) => existing.paypal_event_id === event.paypal_event_id
    )
  ) {
    return mockDb.events.find(
      (existing) => existing.paypal_event_id === event.paypal_event_id
    )!;
  }

  const newEvent: SubscriberEvent = {
    id: 'evt-' + Math.random().toString(36).substring(2, 9),
    subscriber_id: event.subscriber_id,
    event_type: event.event_type,
    event_data: event.event_data,
    paypal_event_id: event.paypal_event_id,
    created_at: new Date().toISOString(),
  };

  mockDb.events.unshift(newEvent);
  return newEvent;
}

export async function getActions(): Promise<RiskAction[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('actions')
      .select('*, subscriber:subscribers(*)')
      .order('created_at', { ascending: false });
    if (!error && data) return data as RiskAction[];
  }
  assertMockFallbackAllowed();

  return [...mockDb.actions]
    .map((a) => ({
      ...a,
      subscriber: mockDb.subscribers.find((s) => s.id === a.subscriber_id),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createAction(action: {
  subscriber_id: string;
  action_type: AllowedActionType;
  status?: ActionStatus;
  email_content: string;
}): Promise<RiskAction> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('actions')
      .insert({
        subscriber_id: action.subscriber_id,
        action_type: action.action_type,
        status: action.status || 'PENDING',
        email_content: action.email_content,
      })
      .select('*, subscriber:subscribers(*)')
      .single();
    if (!error && data) return data as RiskAction;
  }
  assertMockFallbackAllowed();

  const newAction: RiskAction = {
    id: 'act-' + Math.random().toString(36).substring(2, 9),
    subscriber_id: action.subscriber_id,
    action_type: action.action_type,
    status: action.status || 'PENDING',
    email_content: action.email_content,
    created_at: new Date().toISOString(),
    subscriber: mockDb.subscribers.find((s) => s.id === action.subscriber_id),
  };
  mockDb.actions.unshift(newAction);
  return newAction;
}

export async function updateActionStatus(
  actionId: string,
  status: 'APPROVED' | 'EXECUTED' | 'REJECTED'
): Promise<RiskAction | null> {
  if (isSupabaseConfigured && supabase) {
    const updatePayload: { status: string; executed_at?: string } = { status };
    if (status === 'EXECUTED') {
      updatePayload.executed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('actions')
      .update(updatePayload)
      .eq('id', actionId)
      .eq('status', status === 'EXECUTED' ? 'APPROVED' : 'PENDING')
      .select('*, subscriber:subscribers(*)')
      .maybeSingle();

    if (error) throw error;
    return (data as RiskAction | null) ?? null;
  }

  assertMockFallbackAllowed();

  const action = mockDb.actions.find((a) => a.id === actionId);
  if (!action) return null;
  const expectedStatus = status === 'EXECUTED' ? 'APPROVED' : 'PENDING';
  if (action.status !== expectedStatus) return null;

  action.status = status;
  if (status === 'EXECUTED') {
    action.executed_at = new Date().toISOString();
  }

  return {
    ...action,
    subscriber: mockDb.subscribers.find((s) => s.id === action.subscriber_id),
  };
}

