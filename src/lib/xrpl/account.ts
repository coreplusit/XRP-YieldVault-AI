import { appConfig } from "@/lib/config/env";

/** XRPL base account reserve kept spendable-safe for fees / account existence. */
export const XRPL_BASE_RESERVE_XRP = 10;

/** In-memory balance cache TTL — avoids re-hitting the proxy on every tab switch. */
const BALANCE_CACHE_TTL_MS = 45_000;

export interface XrplAccountBalance {
  address: string;
  balanceXrp: number;
  exists: boolean;
  sequence: number | null;
}

interface BalanceCacheEntry {
  data: XrplAccountBalance;
  expiresAt: number;
}

interface AccountInfoApiSuccess {
  ok: true;
  address: string;
  balanceXrp: number;
  exists: boolean;
  sequence: number | null;
}

interface AccountInfoApiFailure {
  ok: false;
  error?: string;
}

type AccountInfoApiResponse = AccountInfoApiSuccess | AccountInfoApiFailure;

const balanceCache = new Map<string, BalanceCacheEntry>();
const inflightBalance = new Map<string, Promise<XrplAccountBalance>>();

/**
 * Computes max spendable XRP after reserving the base account requirement.
 * @param balanceXrp - Current liquid XRP balance.
 * @param reserveXrp - Amount to keep reserved (default: base reserve).
 */
export function getMaxSpendableXrp(
  balanceXrp: number,
  reserveXrp: number = XRPL_BASE_RESERVE_XRP,
): number {
  if (!Number.isFinite(balanceXrp) || balanceXrp <= 0) {
    return 0;
  }
  const spendable = balanceXrp - reserveXrp;
  if (spendable <= 0) {
    return 0;
  }
  return Number(spendable.toFixed(6));
}

/**
 * Builds the XRPL explorer URL for a classic account address.
 * @param address - XRPL classic address (r...).
 */
export function getXrplExplorerAccountUrl(address: string): string {
  const network = appConfig.xrpl.network;
  if (network === "mainnet") {
    return `https://livenet.xrpl.org/accounts/${address}`;
  }
  if (network === "devnet") {
    return `https://devnet.xrpl.org/accounts/${address}`;
  }
  return `https://testnet.xrpl.org/accounts/${address}`;
}

/**
 * Clears cached balance for one address or the entire map.
 * @param address - Optional address to invalidate; omit to clear all.
 */
export function invalidateXrplBalanceCache(address?: string): void {
  if (address) {
    balanceCache.delete(address);
    return;
  }
  balanceCache.clear();
}

/**
 * Reads a non-expired cached balance without hitting the network.
 * @param address - XRPL classic address.
 */
export function getCachedXrplAccountBalance(
  address: string,
): XrplAccountBalance | null {
  const entry = balanceCache.get(address);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    balanceCache.delete(address);
    return null;
  }
  return entry.data;
}

/**
 * Fetches live XRP balance via the Next.js `/api/xrpl/account-info` proxy.
 * Public rippled HTTP endpoints omit CORS headers, so browsers must not call
 * them directly (that produces the opaque "Failed to fetch" error).
 * @param address - XRPL classic address to query.
 * @param options.force - Bypass cache and refetch from the ledger.
 */
export async function fetchXrplAccountBalance(
  address: string,
  options?: { force?: boolean },
): Promise<XrplAccountBalance> {
  if (!options?.force) {
    const cached = getCachedXrplAccountBalance(address);
    if (cached) return cached;

    const pending = inflightBalance.get(address);
    if (pending) return pending;
  }

  const request = fetchBalanceViaAppProxy(address).then((data) => {
    balanceCache.set(address, {
      data,
      expiresAt: Date.now() + BALANCE_CACHE_TTL_MS,
    });
    return data;
  });

  inflightBalance.set(address, request);
  try {
    return await request;
  } finally {
    inflightBalance.delete(address);
  }
}

/**
 * Calls the same-origin account-info API route (server talks to XRPL RPC).
 * @param address - XRPL classic address.
 */
async function fetchBalanceViaAppProxy(
  address: string,
): Promise<XrplAccountBalance> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch("/api/xrpl/account-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
      signal: controller.signal,
      cache: "no-store",
    });

    const payload = (await response.json()) as AccountInfoApiResponse;

    if (!response.ok || !payload.ok) {
      const detail =
        !payload.ok && payload.error
          ? payload.error
          : `Balance proxy HTTP ${response.status}`;
      throw new Error(detail);
    }

    return {
      address: payload.address,
      balanceXrp: payload.balanceXrp,
      exists: payload.exists,
      sequence: payload.sequence,
    };
  } catch (error: unknown) {
    if (
      (error instanceof DOMException || error instanceof Error) &&
      error.name === "AbortError"
    ) {
      throw new Error("XRPL balance request timed out.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Unable to reach the YieldVault XRPL proxy. Check that the dev server is running.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
