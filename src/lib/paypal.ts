type PayPalVerificationHeaders = {
  'paypal-auth-algo'?: string;
  'paypal-cert-url'?: string;
  'paypal-transmission-id'?: string;
  'paypal-transmission-sig'?: string;
  'paypal-transmission-time'?: string;
};

export async function verifyPayPalWebhookSignature(
  headers: Record<string, string>,
  rawBody: string,
  webhookId: string
): Promise<boolean> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

  if (!clientId || !clientSecret || !webhookId) {
    throw new Error('PayPal server credentials are not configured.');
  }

  if (environment !== 'sandbox' && environment !== 'live') {
    throw new Error('Invalid PAYPAL_ENVIRONMENT configuration.');
  }

  let webhookEvent: unknown;

  try {
    webhookEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const paypalHeaders = headers as PayPalVerificationHeaders;

  const {
    'paypal-auth-algo': authAlgo,
    'paypal-cert-url': certUrl,
    'paypal-transmission-id': transmissionId,
    'paypal-transmission-sig': transmissionSig,
    'paypal-transmission-time': transmissionTime,
  } = paypalHeaders;

  if (
    !authAlgo ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !transmissionTime
  ) {
    return false;
  }

  const baseUrl =
    environment === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64');

  const tokenResponse = await fetch(
    `${baseUrl}/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
    }
  );

  if (!tokenResponse.ok) {
    throw new Error('PayPal OAuth authentication failed.');
  }

  const tokenData = await tokenResponse.json();

  if (typeof tokenData.access_token !== 'string') {
    throw new Error('PayPal did not return a valid access token.');
  }

  const verificationResponse = await fetch(
    `${baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
      cache: 'no-store',
    }
  );

  if (!verificationResponse.ok) {
    throw new Error('PayPal webhook verification request failed.');
  }

  const verification = await verificationResponse.json();

  return verification.verification_status === 'SUCCESS';
}
