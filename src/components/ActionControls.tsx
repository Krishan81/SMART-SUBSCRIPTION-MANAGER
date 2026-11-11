'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  actionId: string;
  status: string;
};

export default function ActionControls({ actionId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function updateStatus(nextStatus: 'APPROVED' | 'REJECTED') {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not update action.');
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (status === 'APPROVED') {
    return (
      <div>
        <span>Approved — awaiting email execution.</span>
        <p>Email delivery is not yet enabled.</p>
      </div>
    );
  }

  if (status !== 'PENDING') {
    return <span>{status}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => updateStatus('APPROVED')}
        className="rounded bg-green-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Approve'}
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={() => updateStatus('REJECTED')}
        className="rounded bg-red-600 px-3 py-2 text-white disabled:opacity-50"
      >
        Reject
      </button>

      {error && (
        <p className="w-full text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
