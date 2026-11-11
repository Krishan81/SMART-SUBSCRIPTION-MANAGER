import 'server-only';

type RetentionEmailInput = {
  actionId: string;
  to: string;
  subject: string;
  content: string;
};

type RetentionEmailResult = {
  success: true;
  emailId: string;
};

export async function sendRetentionEmail(
  input: RetentionEmailInput
): Promise<RetentionEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RETENTION_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('Email provider is not configured.');
  }

  if (
    !input.actionId.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to) ||
    !input.subject.trim() ||
    !input.content.trim()
  ) {
    throw new Error('Invalid retention email details.');
  }

  if (
    input.subject.length > 200 ||
    input.content.length > 10000
  ) {
    throw new Error('Retention email exceeds permitted limits.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `retention-${input.actionId}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.content,
    }),
    cache: 'no-store',
  });

  const result: unknown = await response.json();

  if (!response.ok) {
    throw new Error(`Email delivery failed (${response.status}).`);
  }

  if (
    !result ||
    typeof result !== 'object' ||
    !('id' in result) ||
    typeof result.id !== 'string'
  ) {
    throw new Error('Email provider returned an invalid response.');
  }

  return {
    success: true,
    emailId: result.id,
  };
}
