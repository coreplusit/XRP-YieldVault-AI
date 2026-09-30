import type { XrplNetwork } from "@/types";

/**
 * Runtime configuration. XRPL endpoints are hard-locked to Testnet in this file.
 * Other public constants come from environment variables — never hardcode them in components.
 *
 * NOTE: NEXT_PUBLIC_* values must be read with static `process.env.NEXT_PUBLIC_*`
 * property access so Next.js can inline them into the client bundle.
 */
export interface AppConfig {
  appName: string;
  xrpl: {
    network: XrplNetwork;
    wsUrl: string;
    jsonRpcUrl: string;
  };
  vault: {
    apyPercent: number;
    lockMonths: number;
    lockDays: number;
    minDepositUsd: number;
    xrpUsdPrice: number;
    votingPowerPerDeposit: number;
    /** Guided Testnet faucet claim shown in onboarding (XRP). */
    faucetClaimXrp: number;
  };
  ai: {
    provider: string;
  };
}

/**
 * Hard-locked XRPL Testnet WebSocket. Every `xrpl.Client` connection uses this.
 * Port 51233 is the Testnet WebSocket endpoint.
 */
export const XRPL_TESTNET_WS_URL = "wss://s.altnet.rippletest.net:51233";

/**
 * Hard-locked XRPL Testnet JSON-RPC.
 * Port 51234 is the HTTP API on the same Testnet cluster. Port 51233 is WebSocket-only.
 */
export const XRPL_TESTNET_JSON_RPC_URL = "https://s.altnet.rippletest.net:51234";

/**
 * Parses a numeric public environment variable from a static env value.
 * @param raw - Raw string from a statically accessed env var.
 * @param fallback - Numeric fallback when unset or invalid.
 */
function parseNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Singleton application configuration. XRPL endpoints are locked to Testnet. */
export const appConfig: AppConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "XRP YieldVault AI",
  xrpl: {
    network: "testnet" satisfies XrplNetwork,
    wsUrl: XRPL_TESTNET_WS_URL,
    jsonRpcUrl: XRPL_TESTNET_JSON_RPC_URL,
  },
  vault: {
    apyPercent: parseNumber(process.env.NEXT_PUBLIC_VAULT_APY_PERCENT, 15),
    lockMonths: parseNumber(process.env.NEXT_PUBLIC_VAULT_LOCK_MONTHS, 3),
    lockDays: parseNumber(process.env.NEXT_PUBLIC_VAULT_LOCK_DAYS, 30),
    minDepositUsd: parseNumber(process.env.NEXT_PUBLIC_MIN_DEPOSIT_USD, 100),
    xrpUsdPrice: parseNumber(process.env.NEXT_PUBLIC_XRP_USD_PRICE, 0.55),
    votingPowerPerDeposit: parseNumber(
      process.env.NEXT_PUBLIC_VOTING_POWER_PER_DEPOSIT,
      1,
    ),
    faucetClaimXrp: 200,
  },
  ai: {
    provider: process.env.NEXT_PUBLIC_AI_PROVIDER?.trim() || "grok",
  },
};
