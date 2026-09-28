/**
 * Shared application type definitions for XRP YieldVault AI.
 */

/** Supported XRPL network environments. */
export type XrplNetwork = "mainnet" | "testnet" | "devnet";

/** User authentication method on the platform. */
export type AuthMethod = "web3auth_google" | "native_wallet";

/** Persisted platform user row (Supabase `users`). */
export interface PlatformUser {
  id: string;
  email: string | null;
  xrplAddress: string;
  authProvider: AuthMethod;
  createdAt: string;
}

/** DAO treasury strategy risk tier. */
export type RiskProfile = "very-low" | "medium" | "high";

/** DAO strategy option presented in the governance portal. */
export interface DaoStrategy {
  id: string;
  name: string;
  estimatedApyMin: number;
  estimatedApyMax: number;
  riskProfile: RiskProfile;
  revenueSource: string;
}

/** Vault deposit state tracked against on-chain escrow verification. */
export interface VaultDepositState {
  isDeposited: boolean;
  amountXrp: number;
  lockMonths: number;
  apyPercent: number;
  votingPower: number;
  escrowTxHash: string | null;
}

/** AI assistant query categories surfaced on the dashboard. */
export type AiQueryCategory = "earnings" | "risk" | "governance";
