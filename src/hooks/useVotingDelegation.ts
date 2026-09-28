"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  buildDelegation,
  type DelegatePresetId,
  readStoredDelegation,
  type VotingDelegation,
  writeStoredDelegation,
} from "@/lib/governance/delegation";
import {
  deleteUserDelegation,
  fetchUserDelegation,
  upsertUserDelegation,
} from "@/lib/supabase/governance";

/**
 * Subscribe to local delegation cache changes (same-tab + storage events).
 * @param onStoreChange - Listener invoked when delegation updates.
 */
function subscribeDelegation(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener("yieldvault-delegation-change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("yieldvault-delegation-change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getDelegationSnapshot(): VotingDelegation | null {
  return readStoredDelegation();
}

function getServerDelegationSnapshot(): VotingDelegation | null {
  return null;
}

/**
 * Voting-power delegation synced to Supabase `user_delegations` with
 * localStorage cache for instant cross-route UI (Dashboard nudge + Governance).
 * @param userId - public.users.id when Web3Auth/Supabase sync is ready.
 */
export function useVotingDelegation(userId: string | null | undefined): {
  delegation: VotingDelegation | null;
  isSyncing: boolean;
  syncError: string | null;
  delegate: (
    presetId: DelegatePresetId,
    customAddress?: string,
  ) => Promise<VotingDelegation>;
  clearDelegation: () => Promise<void>;
  isHydrated: boolean;
} {
  const delegation = useSyncExternalStore(
    subscribeDelegation,
    getDelegationSnapshot,
    getServerDelegationSnapshot,
  );

  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const hydrate = async (): Promise<void> => {
      setIsSyncing(true);
      setSyncError(null);
      try {
        const remote = await fetchUserDelegation(userId);
        if (cancelled) return;
        writeStoredDelegation(remote);
      } catch (error: unknown) {
        if (cancelled) return;
        setSyncError(
          error instanceof Error
            ? error.message
            : "Failed to sync delegation from Supabase.",
        );
        // Keep any local cache as graceful fallback.
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const delegate = useCallback(
    async (
      presetId: DelegatePresetId,
      customAddress?: string,
    ): Promise<VotingDelegation> => {
      const next = buildDelegation(presetId, customAddress);
      writeStoredDelegation(next);

      if (userId) {
        setIsSyncing(true);
        setSyncError(null);
        try {
          const saved = await upsertUserDelegation({
            userId,
            presetId: next.presetId,
            address: next.address,
          });
          writeStoredDelegation(saved);
          return saved;
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to persist delegation.";
          setSyncError(message);
          throw error;
        } finally {
          setIsSyncing(false);
        }
      }

      return next;
    },
    [userId],
  );

  const clearDelegation = useCallback(async (): Promise<void> => {
    writeStoredDelegation(null);
    if (!userId) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      await deleteUserDelegation(userId);
    } catch (error: unknown) {
      setSyncError(
        error instanceof Error
          ? error.message
          : "Failed to revoke delegation in Supabase.",
      );
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [userId]);

  return {
    delegation,
    isSyncing,
    syncError,
    delegate,
    clearDelegation,
    isHydrated,
  };
}
