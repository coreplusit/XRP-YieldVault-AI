"use client";

import { QRCodeSVG } from "qrcode.react";
import {
  Droplets,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Send,
  Shield,
  Wallet,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { WithdrawModal } from "@/components/modals/WithdrawModal";
import { ExportKeyModal } from "@/components/profile/ExportKeyModal";
import { AccountActivationCard } from "@/components/account/AccountActivationCard";
import { CopyButton } from "@/components/ui/CopyButton";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { useVaultData } from "@/context/VaultDataContext";
import { useWeb3Auth } from "@/context/Web3AuthContext";
import { yieldVaultSessionHeaders } from "@/lib/auth/sessionClient";
import { appConfig } from "@/lib/config/env";
import type { YieldVaultUser } from "@/lib/supabase/users";
import { truncateTxHash, truncateXrplAddress } from "@/lib/web3auth/xrpl";
import { getXrplExplorerAccountUrl } from "@/lib/xrpl/account";

interface FaucetApiResponse {
  ok: boolean;
  amountXrp?: number;
  message?: string;
  error?: string;
}

/**
 * Maps stored auth provider to a user-facing badge label.
 * @param provider - Supabase auth_provider value.
 */
function formatAuthProvider(
  provider: YieldVaultUser["auth_provider"] | null | undefined,
): string {
  if (provider === "web3auth_google") return "Google / Web3Auth";
  if (provider === "native_wallet") return "Native XRP Wallet";
  return "Web3Auth";
}

/**
 * Dedicated Profile & Security page — uses shared VaultData cache for balance.
 */
export function ProfileClient() {
  const { session, provider, isConnected, isInitializing } = useWeb3Auth();
  const {
    balance,
    isBalanceLoading,
    balanceError,
    refreshBalance,
  } = useVaultData();

  const [isFunding, setIsFunding] = useState<boolean>(false);
  const [exportOpen, setExportOpen] = useState<boolean>(false);
  const [withdrawOpen, setWithdrawOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback(
    (
      title: string,
      description?: string,
      variant: ToastMessage["variant"] = "success",
    ): void => {
      setToast({ id: `${Date.now()}`, title, description, variant });
    },
    [],
  );

  const explorerUrl = useMemo(() => {
    if (!session) return "";
    return getXrplExplorerAccountUrl(session.xrplAddress);
  }, [session]);

  const handleRefreshBalance = useCallback(async (): Promise<void> => {
    await refreshBalance(true);
    showToast("Balance refreshed", "Latest XRPL ledger balance loaded.");
  }, [refreshBalance, showToast]);

  const handleFundAccount = useCallback(async (): Promise<void> => {
    if (!session) return;
    if (appConfig.xrpl.network === "mainnet") {
      showToast("Faucet unavailable", "Cannot fund mainnet accounts.", "error");
      return;
    }

    setIsFunding(true);
    try {
      const response = await fetch("/api/xrpl/faucet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...yieldVaultSessionHeaders(),
        },
        body: JSON.stringify({ address: session.xrplAddress }),
      });
      const payload = (await response.json()) as FaucetApiResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Faucet funding failed.");
      }
      showToast(
        "Account Activated!",
        payload.message ??
          `${payload.amountXrp ?? appConfig.vault.faucetClaimXrp} Testnet XRP added to your wallet.`,
      );
      window.setTimeout(() => void refreshBalance(true), 2500);
      window.setTimeout(() => void refreshBalance(true), 6000);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Faucet funding failed.";
      showToast("Funding failed", message, "error");
    } finally {
      setIsFunding(false);
    }
  }, [refreshBalance, session, showToast]);

  const handleWithdrawSuccess = useCallback(
    (payload: {
      txHash: string;
      explorerUrl: string;
      amountXrp: number;
      destination: string;
    }): void => {
      showToast(
        "XRP sent",
        `${payload.amountXrp} XRP → ${truncateXrplAddress(payload.destination)} · ${truncateTxHash(payload.txHash)}`,
      );
      void refreshBalance(true);
      window.setTimeout(() => void refreshBalance(true), 2500);
    },
    [refreshBalance, showToast],
  );

  if (isInitializing || !isConnected || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-vault-cyan" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Account
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Profile & Security</h1>
          <p className="mt-1 text-sm text-vault-muted">
            Manage your Google identity, XRPL self-custody wallet, and sessions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefreshBalance()}
          disabled={isBalanceLoading}
          className="inline-flex items-center gap-2 rounded-full border border-slate-800/60 px-4 py-2 text-sm text-vault-muted transition-colors hover:border-vault-cyan/30 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isBalanceLoading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {balanceError ? (
        <p className="mb-4 text-xs text-rose-300">{balanceError}</p>
      ) : null}

      <AccountActivationCard
        xrplAddress={session.xrplAddress}
        balanceXrp={balance?.balanceXrp ?? null}
        isBalanceLoading={isBalanceLoading}
        onCopied={() =>
          showToast(
            "Address copied",
            "Paste it in Binance / WazirX to deposit activation XRP.",
            "info",
          )
        }
        onFaucetSuccess={(amountXrp) => {
          showToast(
            "Account Activated!",
            `${amountXrp} Testnet XRP added to your wallet.`,
          );
          void refreshBalance(true);
          window.setTimeout(() => void refreshBalance(true), 2500);
          window.setTimeout(() => void refreshBalance(true), 6000);
        }}
        onFaucetError={(message) => {
          showToast("Faucet funding failed", message, "error");
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="glass-panel rounded-2xl p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            User Overview
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-neon text-lg font-bold text-vault-bg">
              {(session.name ?? session.email ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-white">
                {session.name ?? "YieldVault User"}
              </h2>
              <p className="truncate text-sm text-vault-muted">
                {session.email ?? "No email on file"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800/60 bg-vault-bg/40 p-4">
              <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                Auth Provider
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-vault-teal/30 bg-vault-teal/10 px-3 py-1 text-xs text-vault-teal">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                {formatAuthProvider(session.dbUser?.auth_provider)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/60 bg-vault-bg/40 p-4">
              <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                Live Balance
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono text-xl font-semibold text-white">
                  {isBalanceLoading && !balance
                    ? "…"
                    : (balance?.balanceXrp ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}{" "}
                  <span className="text-sm text-vault-muted">XRP</span>
                </p>
                <button
                  type="button"
                  onClick={() => void handleRefreshBalance()}
                  className="rounded-lg p-1 text-vault-muted hover:text-vault-cyan"
                  aria-label="Refresh balance"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isBalanceLoading ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleFundAccount()}
              disabled={isFunding || appConfig.xrpl.network === "mainnet"}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-vault-teal/40 bg-vault-teal/10 text-sm font-semibold text-vault-teal hover:bg-vault-teal/20 disabled:opacity-60"
            >
              {isFunding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Funding…
                </>
              ) : (
                <>
                  <Droplets className="h-4 w-4" aria-hidden="true" />
                  Claim {appConfig.vault.faucetClaimXrp} Free Testnet XRP & Activate
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setWithdrawOpen(true)}
              disabled={!provider || (balance?.balanceXrp ?? 0) <= 0}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon text-sm font-semibold text-vault-bg shadow-neon-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Withdraw / Send XRP
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            XRPL Wallet Details
          </p>
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-800/60 bg-white p-4">
            <QRCodeSVG
              value={session.xrplAddress}
              size={168}
              level="M"
              includeMargin
              bgColor="#ffffff"
              fgColor="#0B0F17"
            />
            <p className="mt-2 text-center text-[11px] text-gray-600">
              Scan to receive Testnet XRP
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800/60 bg-vault-bg/50 p-4">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-4 w-4 text-vault-teal" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                  Full Address
                </p>
                <p className="mt-1 break-all font-mono text-sm text-white">
                  {session.xrplAddress}
                </p>
                <p className="mt-1 font-mono text-xs text-vault-muted">
                  {truncateXrplAddress(session.xrplAddress, 10, 8)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton
                    value={session.xrplAddress}
                    label="Copy address"
                    onCopied={() =>
                      showToast("Copied!", "XRPL address copied to clipboard.")
                    }
                  />
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-vault-cyan/30 bg-vault-cyan/5 px-2.5 py-1.5 text-xs text-vault-cyan hover:bg-vault-cyan/10"
                  >
                    Explorer
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="glass-panel rounded-2xl p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Self-Custody Security
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Export Wallet Secret Key
          </h2>
          <p className="mt-2 text-sm text-vault-muted">
            Reveal your deterministic XRPL family seed / private key derived from
            Web3Auth. Use only for offline backup.
          </p>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={!provider}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 text-sm font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Export Wallet Secret Key
          </button>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Connected Sessions
          </p>
          <ul className="mt-4 space-y-3">
            <li className="rounded-xl border border-slate-800/60 bg-vault-bg/40 px-4 py-3">
              <p className="text-sm font-medium text-white">Web3Auth Session</p>
              <p className="mt-1 text-xs text-vault-muted">
                Status:{" "}
                <span className="text-vault-teal">Active · Sapphire Devnet</span>
              </p>
            </li>
            <li className="rounded-xl border border-slate-800/60 bg-vault-bg/40 px-4 py-3">
              <p className="text-sm font-medium text-white">Supabase Profile</p>
              <p className="mt-1 text-xs text-vault-muted">
                {session.dbUser
                  ? `Synced · ID ${session.dbUser.id.slice(0, 8)}…`
                  : "Pending sync"}
              </p>
            </li>
            <li className="rounded-xl border border-slate-800/60 bg-vault-bg/40 px-4 py-3">
              <p className="text-sm font-medium text-white">XRPL Account</p>
              <p className="mt-1 text-xs text-vault-muted">
                {balance?.exists
                  ? `Funded on ${appConfig.xrpl.network}`
                  : isBalanceLoading
                    ? "Checking ledger…"
                    : "Not funded yet"}
              </p>
            </li>
          </ul>
        </section>
      </div>

      {provider ? (
        <ExportKeyModal
          open={exportOpen}
          provider={provider}
          onClose={() => setExportOpen(false)}
          onToast={showToast}
        />
      ) : null}
      {provider ? (
        <WithdrawModal
          open={withdrawOpen}
          provider={provider}
          userId={session.dbUser?.id ?? null}
          liveBalanceXrp={balance?.balanceXrp ?? null}
          onClose={() => setWithdrawOpen(false)}
          onSuccess={handleWithdrawSuccess}
        />
      ) : null}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
