"use client";

import { AlertTriangle, Loader2, Lock, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { IProvider } from "@web3auth/base";

import { appConfig } from "@/lib/config/env";
import { insertVaultDeposit } from "@/lib/supabase/deposits";
import { getXrplWalletFromProvider } from "@/lib/web3auth/xrpl";
import {
  getMaxSpendableXrp,
  XRPL_BASE_RESERVE_XRP,
} from "@/lib/xrpl/account";
import { submitVaultEscrowDeposit } from "@/lib/xrpl/escrow";

import type { OnChainProof } from "@/components/vault/OnChainProofBanner";

interface DepositFormProps {
  userId: string;
  provider: IProvider;
  /** Live XRPL balance in XRP; null while still loading. */
  userXrpBalance: number | null;
  onDepositSuccess: (proof: OnChainProof) => void;
  /** Pulse and focus the amount field — it is the next onboarding step. */
  highlightAmount?: boolean;
  onToast?: (
    title: string,
    description?: string,
    variant?: "success" | "error" | "info",
  ) => void;
}

/**
 * Vault deposit form — signs EscrowCreate on XRPL and syncs to Supabase.
 * Client-side balance guards prevent tecUNFUNDED ledger errors.
 */
export function DepositForm({
  userId,
  provider,
  userXrpBalance,
  onDepositSuccess,
  highlightAmount = false,
  onToast,
}: DepositFormProps) {
  const suggestedXrp = useMemo(() => {
    const price = appConfig.vault.xrpUsdPrice;
    if (!Number.isFinite(price) || price <= 0) {
      return 100;
    }
    return Number((appConfig.vault.minDepositUsd / price).toFixed(4));
  }, []);

  const [amount, setAmount] = useState<string>("90");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const parsedAmount = useMemo(() => {
    const value = Number(amount);
    return Number.isFinite(value) ? value : NaN;
  }, [amount]);

  const balanceKnown = userXrpBalance !== null;
  const balanceXrp = userXrpBalance ?? 0;

  const maxSpendableXrp = useMemo(
    () => getMaxSpendableXrp(balanceXrp),
    [balanceXrp],
  );

  const isInsufficientBalance = useMemo(() => {
    if (!balanceKnown || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return false;
    }
    return parsedAmount > balanceXrp;
  }, [balanceKnown, balanceXrp, parsedAmount]);

  const isOverMaxSpendable = useMemo(() => {
    if (!balanceKnown || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return false;
    }
    // Soft guard: amount fits balance but would leave less than base reserve.
    return parsedAmount > maxSpendableXrp && parsedAmount <= balanceXrp;
  }, [balanceKnown, balanceXrp, maxSpendableXrp, parsedAmount]);

  const canSubmit =
    !isSubmitting &&
    balanceKnown &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    !isInsufficientBalance &&
    parsedAmount <= maxSpendableXrp;

  /**
   * Fills the deposit field with ~$100 XRP, or max spendable if that exceeds balance.
   */
  const handleQuickHundred = useCallback((): void => {
    setError(null);

    if (!balanceKnown) {
      setAmount(String(suggestedXrp));
      onToast?.(
        "Balance still loading",
        "Using the $100 estimate. Confirm balance before depositing.",
        "info",
      );
      return;
    }

    if (suggestedXrp <= maxSpendableXrp) {
      setAmount(String(suggestedXrp));
      return;
    }

    if (maxSpendableXrp <= 0) {
      setAmount("0");
      onToast?.(
        "Insufficient spendable balance",
        `Keep at least ${XRPL_BASE_RESERVE_XRP} XRP reserved. Fund your account first.`,
        "error",
      );
      return;
    }

    setAmount(String(maxSpendableXrp));
    onToast?.(
      "Adjusted to max spendable",
      `$100 ≈ ${suggestedXrp} XRP exceeds your balance (${balanceXrp} XRP). Filled ${maxSpendableXrp} XRP (balance − ${XRPL_BASE_RESERVE_XRP} XRP reserve).`,
      "info",
    );
  }, [
    balanceKnown,
    balanceXrp,
    maxSpendableXrp,
    onToast,
    suggestedXrp,
  ]);

  /**
   * Signs EscrowCreate with the Web3Auth-derived XRPL wallet, then persists the deposit.
   */
  const handleDeposit = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid XRP amount greater than zero.");
      return;
    }

    if (!balanceKnown) {
      setError("Waiting for live XRPL balance. Please try again in a moment.");
      return;
    }

    if (parsedAmount > balanceXrp) {
      setError(
        `Insufficient Balance. You have ${balanceXrp} XRP, but trying to lock ${parsedAmount} XRP.`,
      );
      return;
    }

    if (parsedAmount > maxSpendableXrp) {
      setError(
        `Leave at least ${XRPL_BASE_RESERVE_XRP} XRP reserved. Max spendable is ${maxSpendableXrp} XRP.`,
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStatusMessage("Preparing XRPL EscrowCreate…");

    try {
      const wallet = await getXrplWalletFromProvider(provider);
      setStatusMessage("Submitting escrow to XRPL ledger…");

      const result = await submitVaultEscrowDeposit({
        wallet,
        amountXrp: parsedAmount,
        lockDays: appConfig.vault.lockDays,
      });

      setStatusMessage("Saving deposit to Supabase…");
      await insertVaultDeposit({
        userId,
        amountXrp: result.amountXrp,
        xrplTxHash: result.txHash,
        escrowCondition: `FinishAfter:${result.finishAfterIso}`,
        status: "active",
      });

      setStatusMessage("Escrow validated on XRPL.");
      onDepositSuccess({
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        amountXrp: result.amountXrp,
      });
    } catch (depositError: unknown) {
      const message =
        depositError instanceof Error
          ? depositError.message
          : "Deposit failed. Please try again.";
      setError(message);
      setStatusMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    balanceKnown,
    balanceXrp,
    maxSpendableXrp,
    onDepositSuccess,
    parsedAmount,
    provider,
    userId,
  ]);

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Yield Vault Deposit
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Lock XRP in Native Escrow
          </h2>
          <p className="mt-2 text-sm text-vault-muted">
            Creates an on-chain EscrowCreate time-lock for{" "}
            {appConfig.vault.lockDays} days at {appConfig.vault.apyPercent}% APY
            display rate.
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-vault-teal/30 bg-vault-teal/10 text-vault-teal">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/60 bg-vault-bg/40 px-3 py-2 text-xs">
          <span className="text-vault-muted">Available balance</span>
          <span className="font-mono text-vault-text">
            {balanceKnown
              ? `${balanceXrp.toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })} XRP`
              : "Loading…"}
          </span>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-vault-muted">
            Deposit Amount (XRP)
          </span>
          {highlightAmount ? (
            <span
              id="vault-escrow-amount-hint"
              className="mt-1 block text-xs text-vault-teal"
            >
              Next step: lock 100 XRP to unlock 100 Voting Power.
            </span>
          ) : null}
          <div className="mt-2 flex gap-2">
            <input
              id="vault-escrow-amount"
              type="number"
              min="0"
              step="0.0001"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError(null);
              }}
              disabled={isSubmitting}
              aria-describedby={
                highlightAmount ? "vault-escrow-amount-hint" : undefined
              }
              className={`h-12 w-full rounded-xl border bg-vault-bg/70 px-4 font-mono text-sm text-white outline-none transition-colors placeholder:text-vault-muted focus:border-vault-cyan/50 ${
                isInsufficientBalance
                  ? "border-rose-500/50"
                  : highlightAmount
                    ? "onboarding-pulse border-vault-teal/70"
                    : "border-slate-800/60"
              }`}
              placeholder="0.0000"
            />
            <button
              type="button"
              onClick={handleQuickHundred}
              disabled={isSubmitting}
              className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              ${appConfig.vault.minDepositUsd} eq.
            </button>
          </div>
          <p className="mt-2 text-xs text-vault-muted">
            ≈ ${appConfig.vault.minDepositUsd} ≈ {suggestedXrp} XRP at $
            {appConfig.vault.xrpUsdPrice}/XRP (estimate). Max spendable:{" "}
            {balanceKnown ? `${maxSpendableXrp} XRP` : "—"} (keeps{" "}
            {XRPL_BASE_RESERVE_XRP} XRP reserve).
          </p>
        </label>

        {isInsufficientBalance ? (
          <div
            className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>
              Insufficient Balance. You have {balanceXrp} XRP, but trying to lock{" "}
              {parsedAmount} XRP.
            </p>
          </div>
        ) : null}

        {isOverMaxSpendable ? (
          <div
            className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
            role="status"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>
              Leave at least {XRPL_BASE_RESERVE_XRP} XRP reserved for account
              requirements. Max spendable is {maxSpendableXrp} XRP.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            void handleDeposit();
          }}
          disabled={!canSubmit}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon text-sm font-semibold text-vault-bg shadow-neon transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Depositing…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" aria-hidden="true" />
              Deposit to Yield Vault
            </>
          )}
        </button>

        {statusMessage ? (
          <p className="text-xs text-vault-teal">{statusMessage}</p>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            <p>{error}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
