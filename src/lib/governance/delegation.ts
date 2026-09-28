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

export const COMMUNITY_DELEGATES: readonly CommunityDelegateOption[] = [
  {
    id: "treasury-ai",
    name: "Treasury Strategy AI Delegate",
    tagline: "Votes to maximize sustainable APY and treasury depth.",
    address: "rYieldVaultTreasuryAI111111111111",
  },
  {
    id: "yield-community",
    name: "Yield Optimiser Community Delegate",
    tagline: "Community steward focused on depositor net returns.",
    address: "rYieldVaultCommunityDel2222222222",
  },
  {
    id: "safety-council",
    name: "Protocol Safety Council",
    tagline: "Conservative votes favoring risk controls and escrow integrity.",
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
 * Reads delegation from localStorage (browser only).
 */
export function readStoredDelegation(): VotingDelegation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DELEGATION_STORAGE_KEY);
    if (!raw) return null;
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
 * Persists delegation to localStorage and notifies listeners.
 * @param delegation - Delegation snapshot to store, or null to clear.
 */
export function writeStoredDelegation(
  delegation: VotingDelegation | null,
): void {
  if (typeof window === "undefined") return;
  if (delegation === null) {
    window.localStorage.removeItem(DELEGATION_STORAGE_KEY);
  } else {
    window.localStorage.setItem(
      DELEGATION_STORAGE_KEY,
      JSON.stringify(delegation),
    );
  }
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
