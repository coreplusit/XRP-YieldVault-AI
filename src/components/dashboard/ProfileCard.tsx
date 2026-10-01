"use client";

import {
  Droplets,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CopyButton } from "@/components/ui/CopyButton";
import { claimTestnetFaucet } from "@/lib/auth/sessionClient";
import { appConfig } from "@/lib/config/env";
import { useWeb3Auth } from "@/context/Web3AuthContext";
import type { VaultDepositStats } from "@/lib/supabase/deposits";
import type { YieldVaultUser } from "@/lib/supabase/users";
import { truncateXrplAddress } from "@/lib/web3auth/xrpl";
import {
  fetchXrplAccountBalance,
  getXrplExplorerAccountUrl,
  type XrplAccountBalance,
} from "@/lib/xrpl/account";

interface ProfileCardProps {
  email: string | null;
  name: string | null;
  xrplAddress: string;
  dbUser: YieldVaultUser | null;
  vaultStats: VaultDepositStats | null;
  /** Increment to force a balance re-fetch (e.g. after deposit). */
  balanceRefreshToken?: number;
  onToast: (title: string, description?: string, variant?: "success" | "error" | "info") => void;
  onBalanceRefreshed?: (balance: XrplAccountBalance) => void;
}

interface FaucetApiResponse {
  ok: boolean;
  amountXrp?: number;
  message?: string;
  error?: string;
}

/**
 * Maps Supabase auth_provider codes to human-readable labels.
 * @param provider - Stored auth provider enum value.
 */
function formatAuthProvider(
  provider: YieldVaultUser["auth_provider"] | null | undefined,
): string {
  if (provider === "web3auth_google") {
    return "Google / Web3Auth";
  }
  if (provider === "native_wallet") {
    return "Native XRP Wallet";
  }
  return "Web3Auth";
}

/**
 * Estimates simple accrued display yield from active deposits and vault APY.
 * @param totalDepositedXrp - Sum of active escrow principal.
 */
function estimateYieldGenerated(totalDepositedXrp: number): number {
  // Display estimate: prorated annual APY over the configured lock window.
  const fractionOfYear = appConfig.vault.lockDays / 365;
  return totalDepositedXrp * (appConfig.vault.apyPercent / 100) * fractionOfYear;
}

/**
 * Rich profile + security card with live XRPL balance, copy, faucet, and escrow stats.
 */
export function ProfileCard({
  email,
  name,
  xrplAddress,
  dbUser,
  vaultStats,
  balanceRefreshToken = 0,
  onToast,
  onBalanceRefreshed,
}: ProfileCardProps) {
  const { provider } = useWeb3Auth();
  const [balance, setBalance] = useState<XrplAccountBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(true);
  const [isFunding, setIsFunding] = useState<boolean>(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const explorerUrl = useMemo(
    () => getXrplExplorerAccountUrl(xrplAddress),
    [xrplAddress],
  );

  const yieldGenerated = useMemo(
    () => estimateYieldGenerated(vaultStats?.totalDepositedXrp ?? 0),
    [vaultStats?.totalDepositedXrp],
  );

  /**
   * Loads live account balance from XRPL Testnet.
   */
  const refreshBalance = useCallback(async (): Promise<void> => {
    setIsLoadingBalance(true);
    setBalanceError(null);
    try {
      const next = await fetchXrplAccountBalance(xrplAddress);
      setBalance(next);
      onBalanceRefreshed?.(next);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch XRPL balance.";
      setBalanceError(message);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [onBalanceRefreshed, xrplAddress]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance, balanceRefreshToken]);

  /**
   * Calls the dashboard faucet proxy to fund this address with Testnet XRP.
   */
  const handleFundAccount = useCallback(async (): Promise<void> => {
    if (appConfig.xrpl.network === "mainnet") {
      onToast(
        "Faucet unavailable",
        "Testnet faucet cannot fund mainnet accounts.",
        "error",
      );
      return;
    }

    if (!provider) {
      onToast(
        "Funding failed",
        "Sign in is required before claiming Testnet XRP.",
        "error",
      );
      return;
    }

    setIsFunding(true);
    try {
      const response = await claimTestnetFaucet(provider, xrplAddress);

      const payload = (await response.json()) as FaucetApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Faucet funding failed.");
      }

      onToast(
        "Account Activated!",
        payload.message ??
          `${payload.amountXrp ?? appConfig.vault.faucetClaimXrp} Testnet XRP added to your wallet.`,
        "success",
      );

      // Faucet credit can take a few seconds to appear in account_info.
      window.setTimeout(() => {
        void refreshBalance();
      }, 2500);
      window.setTimeout(() => {
        void refreshBalance();
      }, 6000);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Faucet funding failed.";
      onToast("Funding failed", message, "error");
    } finally {
      setIsFunding(false);
    }
  }, [onToast, provider, refreshBalance, xrplAddress]);

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            User Profile & Security
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {email ?? name ?? "Authenticated User"}
          </h2>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-800/60 bg-vault-bg/50 px-3 py-1">
            <Shield className="h-3.5 w-3.5 text-vault-teal" aria-hidden="true" />
            <span className="text-xs text-vault-muted">
              Auth:{" "}
              <span className="text-vault-text">
                {formatAuthProvider(dbUser?.auth_provider)}
              </span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshBalance();
          }}
          disabled={isLoadingBalance}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800/60 text-vault-muted transition-colors hover:text-vault-cyan disabled:opacity-50"
          aria-label="Refresh XRPL balance"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoadingBalance ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-slate-800/60 bg-vault-bg/40 p-4">
          <p className="text-[10px] uppercase tracking-wider text-vault-muted">
            Live XRPL Balance
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {isLoadingBalance && !balance ? (
              <span className="inline-flex items-center gap-2 text-sm text-vault-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading…
              </span>
            ) : (
              <>
                {(balance?.balanceXrp ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                <span className="text-sm text-vault-muted">XRP</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-vault-muted">
            {balance?.exists === false
              ? "Account not funded yet on Testnet"
              : `Network: ${appConfig.xrpl.network}`}
          </p>
        </article>

        <article className="rounded-xl border border-slate-800/60 bg-vault-bg/40 p-4">
          <p className="text-[10px] uppercase tracking-wider text-vault-muted">
            Escrow Stats
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {vaultStats?.activeDepositCount ?? 0}{" "}
            <span className="text-sm font-normal text-vault-muted">
              active escrows
            </span>
          </p>
          <p className="mt-1 text-xs text-vault-muted">
            Yield generated (est.):{" "}
            <span className="font-mono text-vault-teal">
              {yieldGenerated.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              XRP
            </span>
          </p>
        </article>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800/60 bg-vault-bg/50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-vault-teal/30 bg-vault-teal/10 text-vault-teal">
            <Wallet className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-vault-muted">
              On-Chain Address
            </p>
            <p className="mt-1 break-all font-mono text-sm text-white">
              {xrplAddress}
            </p>
            <p className="mt-1 font-mono text-xs text-vault-muted">
              Truncated: {truncateXrplAddress(xrplAddress, 10, 8)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton
                value={xrplAddress}
                label="Copy address"
                onCopied={() =>
                  onToast("Copied!", "XRPL wallet address copied to clipboard.")
                }
              />
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-vault-cyan/30 bg-vault-cyan/5 px-2.5 py-1.5 text-xs text-vault-cyan transition-colors hover:bg-vault-cyan/10"
              >
                Explorer
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          void handleFundAccount();
        }}
        disabled={isFunding || appConfig.xrpl.network === "mainnet"}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-vault-teal/40 bg-vault-teal/10 text-sm font-semibold text-vault-teal transition-all hover:bg-vault-teal/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isFunding ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Funding via Testnet Faucet…
          </>
        ) : (
          <>
            <Droplets className="h-4 w-4" aria-hidden="true" />
            Claim {appConfig.vault.faucetClaimXrp} Free Testnet XRP & Activate
          </>
        )}
      </button>

      {balanceError ? (
        <p className="mt-3 text-xs text-rose-300">{balanceError}</p>
      ) : null}

      {!dbUser ? (
        <p className="mt-3 text-xs text-amber-400">
          Supabase user sync pending — deposits require a synced user row.
        </p>
      ) : null}
    </section>
  );
}
