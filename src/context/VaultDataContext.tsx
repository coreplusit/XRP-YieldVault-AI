"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useWeb3Auth } from "@/context/Web3AuthContext";
import {
  getVaultDepositStats,
  type VaultDepositStats,
} from "@/lib/supabase/deposits";
import {
  fetchXrplAccountBalance,
  getCachedXrplAccountBalance,
  invalidateXrplBalanceCache,
  type XrplAccountBalance,
} from "@/lib/xrpl/account";

/** Soft TTL for vault stats / balance in the shared app shell (ms). */
const VAULT_DATA_TTL_MS = 45_000;

interface VaultDataContextValue {
  balance: XrplAccountBalance | null;
  isBalanceLoading: boolean;
  balanceError: string | null;
  stats: VaultDepositStats | null;
  isStatsLoading: boolean;
  statsError: string | null;
  lastBalanceAt: number | null;
  lastStatsAt: number | null;
  refreshBalance: (force?: boolean) => Promise<void>;
  refreshStats: (force?: boolean) => Promise<void>;
  refreshAll: (force?: boolean) => Promise<void>;
}

const VaultDataContext = createContext<VaultDataContextValue | null>(null);

interface VaultDataProviderProps {
  children: ReactNode;
}

/**
 * Shared XRPL + Supabase vault data for authenticated console routes.
 * Survives soft navigations under AppLayout so tab switches stay instant.
 */
export function VaultDataProvider({ children }: VaultDataProviderProps) {
  const { session, isConnected } = useWeb3Auth();
  const xrplAddress = session?.xrplAddress ?? null;
  const userId = session?.dbUser?.id ?? null;

  const [balance, setBalance] = useState<XrplAccountBalance | null>(() =>
    xrplAddress ? getCachedXrplAccountBalance(xrplAddress) : null,
  );
  const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [lastBalanceAt, setLastBalanceAt] = useState<number | null>(null);

  const [stats, setStats] = useState<VaultDepositStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [lastStatsAt, setLastStatsAt] = useState<number | null>(null);

  const lastBalanceAtRef = useRef<number | null>(null);
  const lastStatsAtRef = useRef<number | null>(null);
  const balanceAddressRef = useRef<string | null>(null);
  const statsUserIdRef = useRef<string | null>(null);
  const hasBalanceRef = useRef<boolean>(Boolean(balance));
  const hasStatsRef = useRef<boolean>(false);

  useEffect(() => {
    hasBalanceRef.current = balance !== null;
  }, [balance]);

  useEffect(() => {
    hasStatsRef.current = stats !== null;
  }, [stats]);

  const refreshBalance = useCallback(
    async (force: boolean = false): Promise<void> => {
      if (!xrplAddress) {
        setBalance(null);
        setBalanceError(null);
        setLastBalanceAt(null);
        lastBalanceAtRef.current = null;
        balanceAddressRef.current = null;
        return;
      }

      const isSameAddress = balanceAddressRef.current === xrplAddress;
      const isFresh =
        isSameAddress &&
        hasBalanceRef.current &&
        lastBalanceAtRef.current !== null &&
        Date.now() - lastBalanceAtRef.current < VAULT_DATA_TTL_MS;

      if (!force && isFresh) {
        return;
      }

      if (!force) {
        const cached = getCachedXrplAccountBalance(xrplAddress);
        if (cached) {
          setBalance(cached);
          setBalanceError(null);
          balanceAddressRef.current = xrplAddress;
          const now = Date.now();
          lastBalanceAtRef.current = now;
          setLastBalanceAt(now);
          return;
        }
      }

      setIsBalanceLoading(true);
      setBalanceError(null);
      try {
        const next = await fetchXrplAccountBalance(xrplAddress, { force });
        setBalance(next);
        balanceAddressRef.current = xrplAddress;
        const now = Date.now();
        lastBalanceAtRef.current = now;
        setLastBalanceAt(now);
      } catch (error: unknown) {
        setBalanceError(
          error instanceof Error ? error.message : "Failed to fetch balance.",
        );
      } finally {
        setIsBalanceLoading(false);
      }
    },
    [xrplAddress],
  );

  const refreshStats = useCallback(
    async (force: boolean = false): Promise<void> => {
      if (!userId) {
        setStats(null);
        setStatsError(null);
        setLastStatsAt(null);
        lastStatsAtRef.current = null;
        statsUserIdRef.current = null;
        return;
      }

      const isSameUser = statsUserIdRef.current === userId;
      const isFresh =
        isSameUser &&
        hasStatsRef.current &&
        lastStatsAtRef.current !== null &&
        Date.now() - lastStatsAtRef.current < VAULT_DATA_TTL_MS;

      if (!force && isFresh) {
        return;
      }

      setIsStatsLoading(true);
      setStatsError(null);
      try {
        const next = await getVaultDepositStats(userId);
        setStats(next);
        statsUserIdRef.current = userId;
        const now = Date.now();
        lastStatsAtRef.current = now;
        setLastStatsAt(now);
      } catch (error: unknown) {
        setStatsError(
          error instanceof Error
            ? error.message
            : "Failed to load vault deposits.",
        );
      } finally {
        setIsStatsLoading(false);
      }
    },
    [userId],
  );

  const refreshAll = useCallback(
    async (force: boolean = false): Promise<void> => {
      if (force && xrplAddress) {
        invalidateXrplBalanceCache(xrplAddress);
      }
      await Promise.all([refreshBalance(force), refreshStats(force)]);
    },
    [refreshBalance, refreshStats, xrplAddress],
  );

  useEffect(() => {
    if (!isConnected) return;
    void refreshAll(false);
  }, [isConnected, xrplAddress, userId, refreshAll]);

  const value = useMemo<VaultDataContextValue>(
    () => ({
      balance,
      isBalanceLoading,
      balanceError,
      stats,
      isStatsLoading,
      statsError,
      lastBalanceAt,
      lastStatsAt,
      refreshBalance,
      refreshStats,
      refreshAll,
    }),
    [
      balance,
      balanceError,
      isBalanceLoading,
      isStatsLoading,
      lastBalanceAt,
      lastStatsAt,
      refreshAll,
      refreshBalance,
      refreshStats,
      stats,
      statsError,
    ],
  );

  return (
    <VaultDataContext.Provider value={value}>{children}</VaultDataContext.Provider>
  );
}

/**
 * Access cached vault ledger + deposit data from any authenticated console page.
 */
export function useVaultData(): VaultDataContextValue {
  const context = useContext(VaultDataContext);
  if (!context) {
    throw new Error("useVaultData must be used within VaultDataProvider.");
  }
  return context;
}
