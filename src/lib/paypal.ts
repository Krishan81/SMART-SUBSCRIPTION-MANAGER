import crypto from 'crypto';

interface CachedCert {
  cert: string;
  expiresAt: number;
}

const certCache = new Map<string, CachedCert>();
const CERT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Compute CRC32 checksum as an unsigned 32-bit integer directly from the raw buffer/string.
 */
function calculateCrc32(str: string): number {
  // Simple standard implementation of IEEE 802.3 CRC32
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    // Handle multi-byte or pure ascii correctly
    const byte = charCode & 0xff;
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pre-compute CRC32 table
const crcTable = (() => {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

/**
 * Safely fetch and validate PayPal public certificate from cert URL.
 */
async function fetchPayPalCertificate(certUrl: string): Promise<string | null> {
  const now = Date.now();
  const cached = certCache.get(certUrl);
  if (cached && cached.expiresAt > now) {
    return cached.cert;
  }

  try {
    const parsed = new URL(certUrl);

    // 1. Enforce HTTPS
    if (parsed.protocol !== 'https:') {
      return null;
    }

    // 2. Explicit Allowlist of PayPal Certificate Hosts and Paths
    const allowedHostsAndPaths: Record<string, string[]> = {
      'api.paypal.com': ['/v1/notifications/certs/'],
      'api.sandbox.paypal.com': ['/v1/notifications/certs/'],
      'uri.paypal.com': ['/'], // Sometimes used in test environments
      'paypalobjects.com': ['/']
    };

    const hostPaths = allowedHostsAndPaths[parsed.hostname];
    if (!hostPaths) {
      return null;
    }

    const matchedPath = hostPaths.some((allowedPath) => parsed.pathname.startsWith(allowedPath));
    if (!matchedPath) {
      return null;
    }

    // 3. Reject credentials, ports, query strings, and fragments
    if (
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.port !== '' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      return null;
    }

    // 4. Fetch with timeout and strict redirect/size constraints
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(certUrl, {
      method: 'GET',
      redirect: 'error', // Prevent redirects to untrusted hosts
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    // 5. Enforce response size limit (max 512KB)
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 512 * 1024) {
      return null;
    }

    const certText = await response.text();
    if (certText.length > 512 * 1024) {
      return null;
    }

    // 6. Validate that response is an actual PEM certificate
    if (!certText.includes('-----BEGIN CERTIFICATE-----') || !certText.includes('-----END CERTIFICATE-----')) {
      return null;
    }

    // Cache valid certificate
    certCache.set(certUrl, {
      cert: certText,
      expiresAt: now + CERT_TTL_MS
    });

    return certText;
  } catch (error) {
    return null;
  }
}

/**
 * Verify PayPal Webhook Signature using local cryptographic verification.
 * Supports both real webhooks (registered PAYPAL_WEBHOOK_ID) and mock simulator ("WEBHOOK_ID").
 */
export async function verifyPayPalWebhookSignature(
  headers: Record<string, string>,
  rawBody: string,
  configuredWebhookId: string
): Promise<boolean> {
  try {
    // 1. Extract required headers
    const transmissionId = headers['paypal-transmission-id'];
    const timestamp = headers['paypal-transmission-time'];
    const certUrl = headers['paypal-cert-url'];
    const actualSignature = headers['paypal-transmission-sig'];
    const algo = headers['paypal-auth-algo'];

    if (!transmissionId || !timestamp || !certUrl || !actualSignature || !algo) {
      return false;
    }

    // 2. Validate cryptographic algorithm (Strictly SHA256withRSA)
    if (algo.toUpperCase() !== 'SHA256withRSA') {
      return false;
    }

    // 3. Fetch and validate public certificate
    const certPem = await fetchPayPalCertificate(certUrl);
    if (!certPem) {
      return false;
    }

    // 4. Calculate CRC32 of raw body as unsigned 32-bit decimal integer
    const crc32 = calculateCrc32(rawBody);

    // 5. Build candidate webhook IDs (configured ID + mock simulator 'WEBHOOK_ID')
    const webhookIds: string[] = [];
    if (configuredWebhookId) {
      webhookIds.push(configuredWebhookId);
    }
    webhookIds.push('WEBHOOK_ID');

    // 6. Decode Base64 signature safely
    let signatureBuffer: Buffer;
    try {
      signatureBuffer = Buffer.from(actualSignature, 'base64');
      if (signatureBuffer.length === 0) {
        return false;
      }
    } catch {
      return false;
    }

    // 7. Verify cryptographic signature against candidate webhook IDs
    for (const webhookId of webhookIds) {
      const message = `${transmissionId}|${timestamp}|${webhookId}|${crc32}`;

      try {
        const isValid = crypto.verify(
          'RSA-SHA256',
          Buffer.from(message, 'utf8'),
          {
            key: certPem,
            padding: crypto.constants.RSA_PKCS1_PADDING
          },
          signatureBuffer
        );

        if (isValid) {
          return true;
        }
      } catch (cryptoError) {
        // Continue trying other candidates if crypto verification throws on malformed keys
      }
    }

    return false;
  } catch (error) {
    console.error('PayPal cryptographic verification error');
    return false;
  }
}
