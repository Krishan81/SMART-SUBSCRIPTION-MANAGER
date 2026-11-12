'use client';

import { supabase } from '@/lib/supabase-client';

export default function SignOutButton() {
  const handleSignOut = async () => {
    await supabase?.auth?.signOut();
    window.location.reload();
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-400 dark:hover:text-blue-300"
    >
      Sign Out
    </button>
  );
}