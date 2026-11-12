import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

export function isRetentionAuthorized(req: NextRequest): boolean {
  const secret = process.env.RETENTION_EXECUTION_SECRET;

  if (!secret) return false;

  const supplied = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}
