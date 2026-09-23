"use client";

import { useAuth } from "@/hooks/use-auth";

/**
 * Thin wrapper around the unified AuthContext.
 * 
 * Previously this hook made 4+ sequential DB queries to resolve staff name.
 * Now it simply reads from the AuthContext which already has displayName/initials
 * resolved via a single RPC call (get_complete_user_context).
 * 
 * The `injectedEmail` parameter is kept for API compatibility but is ignored —
 * the AuthContext always resolves based on the logged-in user's email.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useCurrentStaff(_injectedEmail?: string | null) {
  const { displayName, initials, isLoading } = useAuth();

  return {
    displayName: displayName || null,
    initials,
    isLoading,
  };
}
