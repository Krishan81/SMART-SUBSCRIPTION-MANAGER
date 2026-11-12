import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import type { NextRequest } from 'next/server';

type PayPalSubscribeResponse =
  | { success: true; approvalUrl: string }
  | { success: false; error: string };

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has a PayPal subscription
    const { data: existingSubscriber } = await supabase
      .from('subscribers')
      .select('*')
      .eq('email', user.email!)
      .maybeSingle();

    if (existingSubscriber && existingSubscriber.paypal_subscription_id) {
      return NextResponse.json(
        { success: false, error: 'You already have a PayPal subscription.' },
        { status: 400 }
      );
    }

    const planId = process.env.PAYPAL_PLAN_ID;
    if (!planId) {
      console.error('PAYPAL_PLAN_ID not configured');
      return NextResponse.json(
        { success: false, error: 'Payment configuration missing.' },
        { status: 500 }
      );
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const baseUrl = process.env.PAYPAL_API_BASE_URL || 'https://api-m.sandbox.paypal.com';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: 'PayPal credentials not configured.' },
        { status: 500 }
      );
    }

    // Get OAuth token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('PayPal OAuth error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to obtain PayPal access token.' },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid PayPal token response.' },
        { status: 500 }
      );
    }

    // Create PayPal subscription
    const subscriptionCreateResponse = await fetch(`${baseUrl}/v1/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
      }),
    });

    if (!subscriptionCreateResponse.ok) {
      const errorText = await subscriptionCreateResponse.text();
      console.error('PayPal subscription creation error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to create PayPal subscription.' },
        { status: 500 }
      );
    }

    const subscriptionData = await subscriptionCreateResponse.json();
    const paypalSubscriptionId = subscriptionData.id;

    if (!paypalSubscriptionId) {
      return NextResponse.json(
        { success: false, error: 'No subscription ID returned from PayPal.' },
        { status: 500 }
      );
    }

    // Update or create subscriber with PayPal subscription ID
    const subscriberData = {
      paypal_subscription_id: paypalSubscriptionId,
      plan: subscriptionData.plan_id || planId,
    };

    if (existingSubscriber) {
      await supabase
        .from('subscribers')
        .update(subscriberData)
        .eq('id', existingSubscriber.id);
    } else {
      await supabase
        .from('subscribers')
        .insert({
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email!.split('@')[0] || 'User',
          paypal_subscription_id: paypalSubscriptionId,
          plan: planId,
          status: 'ACTIVE',
          risk_score: 20,
          risk_level: 'Low',
          risk_reason: 'New subscription via PayPal.',
          recommended_action: 'none',
        });
    }

    // Build PayPal approval URL
    const approvalUrl = `${baseUrl}/v1/payments/subscriptions/${paypalSubscriptionId}/authorize`;

    return NextResponse.json({
      success: true,
      approvalUrl,
    });
  } catch (error: unknown) {
    console.error('PayPal subscribe error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
      );
  }
}