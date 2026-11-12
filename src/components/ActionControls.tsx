'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Shield, LogOut, AlertCircle, CheckCircle } from 'lucide-react';

type Props = {
  actionId: string;
  status: string;
};

export default function ActionControls({ actionId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check admin authorization on mount using browser client
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    async function checkAdminStatus() {
      // Use browser client - check if user exists and has app_metadata role
      if (!supabase) {
        setIsAdmin(false);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setIsAdmin(false);
        return;
      }

      // Check app_metadata for admin role (client-side check; final auth enforced server-side)
      const userRole = user.app_metadata?.role;
      setIsAdmin(userRole === 'admin');
    }

    checkAdminStatus();
  }, [supabase]);

  async function updateStatus(nextStatus: 'APPROVED' | 'REJECTED') {
    // Verify admin before allowing update
    // Note: Final admin authorization enforced server-side via API routes
    if (!isAdmin) {
      setError('Administrator privileges required for this action.');
      setLoading(false);
      return;
    }

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

  // If user is not admin, show disabled/readonly state
  if (!isAdmin) {
    return (
      <div className="flex flex-wrap gap-2">
        <span
          className="rounded bg-gray-300 px-3 py-2 text-gray-600 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Approve'}
        </span>

        <span
          className="rounded bg-gray-300 px-3 py-2 text-gray-600 disabled:opacity-50"
        >
          Reject
        </span>
      </div>
    );
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