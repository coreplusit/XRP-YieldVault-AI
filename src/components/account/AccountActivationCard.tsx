"use client";

import {
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";

import { appConfig } from "@/lib/config/env";

const FAUCET_CLAIM_XRP = appConfig.vault.faucetClaimXrp;

/** Mainnet account-activation reserve messaging (XRPL base reserve). */
export const XRPL_ACTIVATION_RESERVE_XRP = 1;

interface FaucetApiResponse {
  ok: boolean;
  amountXrp?: number;
  message?: string;
  error?: string;
}

interface AccountActivationCardProps {
  xrplAddress: string;
  /** Live balance; null while still loading. */
  balanceXrp: number | null;
  isBalanceLoading?: boolean;
  /** Optional callback after address is copied. */
  onCopied?: () => void;
  /**
   * Called after a successful Testnet faucet claim so parents can refresh
   * LIVE BALANCE and show toast notifications.
   */
  onFaucetSuccess?: (amountXrp: number) => void;
  onFaucetError?: (message: string) => void;
  /**
   * Amount just credited by the faucet before the live balance refresh lands.
   * Keeps the success state visible immediately after activation.
   */
  celebratedBalanceXrp?: number | null;
  /** When set, an activated wallet shows the escrow CTA instead of a compact badge. */
  onLockEscrow?: () => void;
  /** Pulse the faucet claim button — it is the next required action. */
  emphasizeClaim?: boolean;
  className?: string;
}

/**
 * Onboarding card explaining XRPL base-reserve activation + deposit CTAs.
 * Option C funds the wallet via the Testnet faucet for instant activation.
 * Collapses to an “Account Active” badge once live balance is greater than 0 XRP.
 */
export function AccountActivationCard({
  xrplAddress,
  balanceXrp,
  isBalanceLoading = false,
  onCopied,
  onFaucetSuccess,
  onFaucetError,
  celebratedBalanceXrp = null,
  onLockEscrow,
  emphasizeClaim = false,
  className = "",
}: AccountActivationCardProps) {
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [copyDone, setCopyDone] = useState<boolean>(false);
  const [isFunding, setIsFunding] = useState<boolean>(false);
  const [fundError, setFundError] = useState<string | null>(null);

  const balanceKnown = balanceXrp !== null;
  const liveBalance =
    balanceKnown && balanceXrp > 0
      ? balanceXrp
      : celebratedBalanceXrp !== null && celebratedBalanceXrp > 0
        ? celebratedBalanceXrp
        : null;
  const isActivated = liveBalance !== null && liveBalance > 0;
  const isTestnet = appConfig.xrpl.network !== "mainnet";

  const handleCopyAddress = useCallback(async (): Promise<void> => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(xrplAddress);
      setCopyDone(true);
      onCopied?.();
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = xrplAddress;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopyDone(true);
      onCopied?.();
      window.setTimeout(() => setCopyDone(false), 2000);
    } finally {
      setIsCopying(false);
    }
  }, [onCopied, xrplAddress]);

  const handleClaimTestnetXrp = useCallback(async (): Promise<void> => {
    if (!isTestnet) {
      const message = "Testnet faucet is unavailable on mainnet.";
      setFundError(message);
      onFaucetError?.(message);
      return;
    }

    setIsFunding(true);
    setFundError(null);

    try {
      const response = await fetch("/api/xrpl/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: xrplAddress }),
      });
      const payload = (await response.json()) as FaucetApiResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Faucet funding failed.");
      }

      const amountXrp = payload.amountXrp ?? FAUCET_CLAIM_XRP;
      onFaucetSuccess?.(amountXrp);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Faucet funding failed.";
      setFundError(message);
      onFaucetError?.(message);
    } finally {
      setIsFunding(false);
    }
  }, [isTestnet, onFaucetError, onFaucetSuccess, xrplAddress]);

  if (
    !balanceKnown &&
    isBalanceLoading &&
    !(celebratedBalanceXrp !== null && celebratedBalanceXrp > 0)
  ) {
    return (
      <div
        className={`glass-panel mb-6 flex items-center gap-3 rounded-2xl border border-slate-800/60 px-4 py-3 text-sm text-vault-muted ${className}`}
      >
        <Loader2
          className="h-4 w-4 animate-spin text-vault-cyan"
          aria-hidden="true"
        />
        Checking XRPL account activation…
      </div>
    );
  }

  if (isActivated && onLockEscrow && liveBalance !== null) {
    const shownBalance = liveBalance.toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
    return (
      <section
        className={`mb-6 overflow-hidden rounded-2xl border border-vault-teal/40 bg-vault-teal/10 px-4 py-4 sm:px-5 ${className}`}
        role="status"
        aria-label="Account activated"
      >
        <p className="text-sm font-semibold text-white sm:text-base">
          Account Activated! {FAUCET_CLAIM_XRP} Testnet XRP added to your
          wallet.
        </p>
        <p className="mt-1 text-xs text-vault-muted">
          Next, lock 100 XRP in the vault escrow. That unlocks 100 Voting Power
          (VP) for DAO governance. Live balance: {shownBalance} XRP.
        </p>
        <button
          type="button"
          onClick={onLockEscrow}
          className="onboarding-pulse mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon text-sm font-semibold text-vault-bg shadow-neon transition-all hover:brightness-110 sm:w-auto sm:px-5"
        >
          Step 3: Lock 100 XRP in Escrow
        </button>
      </section>
    );
  }

  if (isActivated && liveBalance !== null) {
    return (
      <div
        className={`mb-6 flex items-start gap-3 rounded-2xl border border-vault-teal/30 bg-vault-teal/10 px-4 py-3 ${className}`}
        role="status"
      >
        <CheckCircle2
          className="mt-0.5 h-4 w-4 shrink-0 text-vault-teal"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Account Active</p>
          <p className="mt-0.5 text-xs text-vault-muted">
            Live balance{" "}
            <span className="font-mono text-vault-teal">
              {liveBalance.toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })}{" "}
              XRP
            </span>{" "}
            — base reserve is covered. You can deposit into vault escrows.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className={`glass-panel mb-6 overflow-hidden rounded-2xl border border-amber-400/25 ${className}`}
      aria-label="XRPL account activation"
    >
      <div className="border-b border-amber-400/15 bg-amber-400/5 px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-200">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">
              Account Activation
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              XRPL Base Reserve
            </p>
            <p className="mt-1 text-xs leading-relaxed text-vault-muted">
              To fully activate your account on Mainnet,{" "}
              <span className="font-mono text-amber-100">
                {XRPL_ACTIVATION_RESERVE_XRP} XRP
              </span>{" "}
              is required for on-chain reserve. On Testnet, use Option C to claim{" "}
              {FAUCET_CLAIM_XRP} XRP and activate.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {isTestnet ? (
          <div className="rounded-xl border border-vault-teal/40 bg-gradient-to-br from-vault-teal/15 via-vault-cyan/10 to-transparent p-4 shadow-neon-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-vault-teal/40 bg-vault-teal/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-vault-teal">
                Option C · Instant Testnet
              </span>
              <Zap className="h-4 w-4 text-vault-cyan" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-white">
              Claim {FAUCET_CLAIM_XRP} Free Testnet XRP & Activate
            </p>
            <p className="mt-1 text-xs text-vault-muted">
              Primary quick-action for testing — adds {FAUCET_CLAIM_XRP} Testnet
              XRP so you can lock it in escrow and unlock {FAUCET_CLAIM_XRP} VP.
            </p>
            <button
              type="button"
              onClick={() => void handleClaimTestnetXrp()}
              disabled={isFunding}
              className={`mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon text-sm font-semibold text-vault-bg shadow-neon-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 ${
                emphasizeClaim ? "onboarding-pulse" : ""
              }`}
            >
              {isFunding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Funding account with Testnet XRP…
                </>
              ) : (
                <>⚡ Claim {FAUCET_CLAIM_XRP} Free Testnet XRP & Activate</>
              )}
            </button>
            {fundError ? (
              <p className="mt-2 text-xs text-rose-300" role="alert">
                {fundError}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800/60 bg-vault-bg/40 px-3 py-2 text-xs text-vault-muted">
            Instant faucet (Option C) is disabled on mainnet. Use Option A or B
            to fund the {XRPL_ACTIVATION_RESERVE_XRP} XRP base reserve.
          </p>
        )}

        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vault-muted">
          Mainnet guidance
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleCopyAddress()}
            disabled={isCopying || isFunding}
            className="group flex flex-col items-start gap-2 rounded-xl border border-slate-800/60 bg-vault-bg/40 p-4 text-left transition-colors hover:border-vault-cyan/40 hover:bg-vault-cyan/5 disabled:opacity-60"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-vault-cyan/30 bg-vault-cyan/10 text-vault-cyan">
                {copyDone ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span className="rounded-full border border-slate-700/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-vault-muted">
                Option A
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              Deposit {XRPL_ACTIVATION_RESERVE_XRP} XRP from Binance/WazirX
            </p>
            <p className="text-xs text-vault-muted">
              Copies your full XRPL address so you can withdraw from an exchange.
            </p>
            <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-vault-cyan">
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copyDone ? "Address copied" : "Copy wallet address"}
            </span>
          </button>

          <a
            href="https://www.moonpay.com/buy/xrp"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-start gap-2 rounded-xl border border-slate-800/60 bg-vault-bg/40 p-4 text-left transition-colors hover:border-vault-teal/40 hover:bg-vault-teal/5"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-vault-teal/30 bg-vault-teal/10 text-vault-teal">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="rounded-full border border-slate-700/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-vault-muted">
                Option B
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              Buy {XRPL_ACTIVATION_RESERVE_XRP} XRP via Card
            </p>
            <p className="text-xs text-vault-muted">
              Opens MoonPay / Transak-style on-ramp (widget placeholder).
            </p>
            <span className="mt-1 text-xs font-medium text-vault-teal">
              Continue to card purchase →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
