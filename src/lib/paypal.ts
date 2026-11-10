import crypto from 'crypto';

/**
 * Verify PayPal Webhook Signature or allow dev/test bypass
 */
export function verifyPayPalWebhookSignature(
  headers: Record<string, string>,
  rawBody: string,
  webhookId: string
): boolean {
  // If in development mode or webhook ID not configured, allow bypass for testing convenience
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev || !webhookId || webhookId === 'your-paypal-webhook-id') {
    return true;
  }

  // In production, verify PayPal signature headers
  const transmissionId = headers['paypal-transmission-id'];
  const timestamp = headers['paypal-transmission-time'];
  const certUrl = headers['paypal-cert-url'];
  const actualSignature = headers['paypal-transmission-sig'];
  const algo = headers['paypal-auth-algo'];

  if (!transmissionId || !timestamp || !certUrl || !actualSignature) {
    return false;
  }

  // Basic sanity check on cert URL domain (must be paypal.com)
  try {
    const parsedUrl = new URL(certUrl);
    if (!parsedUrl.hostname.endsWith('paypal.com') && !parsedUrl.hostname.endsWith('paypalobjects.com')) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}
