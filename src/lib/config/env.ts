import type { XrplNetwork } from "@/types";

/**
 * Runtime configuration sourced from environment variables.
 * All public constants and network endpoints must be defined here — never hardcoded in components.
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
  };
  ai: {
    provider: string;
  };
}

const VALID_NETWORKS: readonly XrplNetwork[] = ["mainnet", "testnet", "devnet"];

/**
 * Validates and normalizes the XRPL network identifier from env.
 * @param value - Raw network string from NEXT_PUBLIC_XRPL_NETWORK.
 */
function parseXrplNetwork(value: string | undefined, fallback: XrplNetwork): XrplNetwork {
  const normalized = (value ?? fallback).toLowerCase() as XrplNetwork;
  if (!VALID_NETWORKS.includes(normalized)) {
    throw new Error(
      `Invalid NEXT_PUBLIC_XRPL_NETWORK: "${value ?? ""}". Expected one of: ${VALID_NETWORKS.join(", ")}`,
    );
  }
  return normalized;
}

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

/**
 * Resolves a required static env value or throws with a descriptive error.
 * @param value - Statically accessed NEXT_PUBLIC_* value.
 * @param key - Variable name used in the error message.
 */
function resolveRequired(value: string | undefined, key: string): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${key}. Add it to .env.local and restart the dev server.`,
    );
  }
  return value.trim();
}

/** Singleton application configuration resolved from `.env.local`. */
export const appConfig: AppConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "XRP YieldVault AI",
  xrpl: {
    network: parseXrplNetwork(process.env.NEXT_PUBLIC_XRPL_NETWORK, "testnet"),
    wsUrl: resolveRequired(
      process.env.NEXT_PUBLIC_XRPL_WS_URL,
      "NEXT_PUBLIC_XRPL_WS_URL",
    ),
    jsonRpcUrl: resolveRequired(
      process.env.NEXT_PUBLIC_XRPL_JSON_RPC_URL,
      "NEXT_PUBLIC_XRPL_JSON_RPC_URL",
    ),
  },
  vault: {
    apyPercent: parseNumber(process.env.NEXT_PUBLIC_VAULT_APY_PERCENT, 15),
    lockMonths: parseNumber(process.env.NEXT_PUBLIC_VAULT_LOCK_MONTHS, 3),
    lockDays: parseNumber(process.env.NEXT_PUBLIC_VAULT_LOCK_DAYS, 30),
    minDepositUsd: parseNumber(process.env.NEXT_PUBLIC_MIN_DEPOSIT_USD, 100),
    xrpUsdPrice: parseNumber(process.env.NEXT_PUBLIC_XRP_USD_PRICE, 0.55),
    votingPowerPerDeposit: parseNumber(
      process.env.NEXT_PUBLIC_VOTING_POWER_PER_DEPOSIT,
      100,
    ),
  },
  ai: {
    provider: process.env.NEXT_PUBLIC_AI_PROVIDER?.trim() || "grok",
  },
};
