/**
 * Phase-1 voting power delegation types + local persistence helpers.
 * Delegation never moves escrowed XRP — it only redirects VP weight.
 */

export type DelegatePresetId =
  | "treasury-ai"
  | "yield-community"
  | "safety-council"
  | "custom";

export interface CommunityDelegateOption {
  id: Exclude<DelegatePresetId, "custom">;
  name: string;
  tagline: string;
  /** Display-only XRPL classic address for the delegate persona. */
  address: string;
}

export interface VotingDelegation {
  presetId: DelegatePresetId;
  displayName: string;
  /** XRPL address when custom or preset-backed. */
  address: string;
  delegatedAt: string;
}

export const DELEGATION_STORAGE_KEY = "yieldvault.vp.delegation.v1";

/**
 * Cached snapshot for useSyncExternalStore. JSON.parse returns a new object
 * on every read, which React treats as a changed snapshot and loops.
 */
let cachedRaw: string | null = null;
let cachedSnapshot: VotingDelegation | null = null;
let delegationCacheReady = false;

export const COMMUNITY_DELEGATES: readonly CommunityDelegateOption[] = [
  {
    id: "treasury-ai",
    name: "Treasury Strategy AI Delegate",
    tagline: "Votes to maximize sustainable APY and treasury depth.",
    address: "rYieldVaultTreasuryAI111111111111",
  },
  {
    id: "yield-community",
    name: "XRPL Foundation Delegate",
    tagline: "Ecosystem representative aligned with XRPL standards.",
    address: "rYieldVaultCommunityDel2222222222",
  },
  {
    id: "safety-council",
    name: "YieldVault Council",
    tagline: "Protocol council focused on escrow integrity and yield policy.",
    address: "rYieldVaultSafetyCouncil33333333",
  },
] as const;

/**
 * Validates a loose XRPL classic address shape for custom delegation.
 * @param address - Candidate address.
 */
export function isValidClassicAddress(address: string): boolean {
  const trimmed = address.trim();
  return (
    trimmed.startsWith("r") &&
    trimmed.length >= 25 &&
    trimmed.length <= 35 &&
    /^r[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)
  );
}

/**
 * Parses a stored delegation payload into a snapshot, or null when invalid.
 * @param raw - localStorage JSON string, or null when unset.
 */
function parseStoredDelegation(raw: string | null): VotingDelegation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VotingDelegation;
    if (
      !parsed ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.address !== "string" ||
      typeof parsed.presetId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Reads delegation from localStorage (browser only).
 * Returns the same object until the stored string changes.
 */
export function readStoredDelegation(): VotingDelegation | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DELEGATION_STORAGE_KEY);
  if (delegationCacheReady && raw === cachedRaw) {
    return cachedSnapshot;
  }
  cachedRaw = raw;
  cachedSnapshot = parseStoredDelegation(raw);
  delegationCacheReady = true;
  return cachedSnapshot;
}

/**
 * Persists delegation to localStorage and notifies listeners.
 * @param delegation - Delegation snapshot to store, or null to clear.
 */
export function writeStoredDelegation(
  delegation: VotingDelegation | null,
): void {
  if (typeof window === "undefined") return;
  const raw = delegation === null ? null : JSON.stringify(delegation);
  if (delegationCacheReady && raw === cachedRaw) return;

  if (raw === null) {
    window.localStorage.removeItem(DELEGATION_STORAGE_KEY);
    cachedSnapshot = null;
  } else {
    window.localStorage.setItem(DELEGATION_STORAGE_KEY, raw);
    cachedSnapshot = delegation;
  }
  cachedRaw = raw;
  delegationCacheReady = true;
  window.dispatchEvent(new Event("yieldvault-delegation-change"));
}

/**
 * Builds a VotingDelegation from a preset or custom address.
 * @param presetId - Selected preset or custom.
 * @param customAddress - Required when presetId is custom.
 */
export function buildDelegation(
  presetId: DelegatePresetId,
  customAddress?: string,
): VotingDelegation {
  if (presetId === "custom") {
    const address = (customAddress ?? "").trim();
    if (!isValidClassicAddress(address)) {
      throw new Error("Enter a valid XRPL classic address (r…).");
    }
    return {
      presetId: "custom",
      displayName: "Custom XRPL Delegate",
      address,
      delegatedAt: new Date().toISOString(),
    };
  }

  const preset = COMMUNITY_DELEGATES.find((item) => item.id === presetId);
  if (!preset) {
    throw new Error("Unknown community delegate.");
  }

  return {
    presetId: preset.id,
    displayName: preset.name,
    address: preset.address,
    delegatedAt: new Date().toISOString(),
  };
}
