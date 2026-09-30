"use client";

import { Loader2, Send, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { IProvider } from "@web3auth/base";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { isValidClassicAddress } from "@/lib/governance/delegation";
import { insertXrpTransfer } from "@/lib/supabase/transfers";
import { getXrplWalletFromProvider } from "@/lib/web3auth/xrpl";
import {
  getMaxSpendableXrp,
  XRPL_BASE_RESERVE_XRP,
} from "@/lib/xrpl/account";
import { submitXrpPayment } from "@/lib/xrpl/payment";

export interface WithdrawSuccessPayload {
  txHash: string;
  explorerUrl: string;
  amountXrp: number;
  destination: string;
}

interface WithdrawModalProps {
  open: boolean;
  provider: IProvider;
  userId: string | null;
  /** Live XRPL balance in XRP; null while loading. */
  liveBalanceXrp: number | null;
  onClose: () => void;
  onSuccess: (payload: WithdrawSuccessPayload) => void;
}

/**
 * Modal to withdraw / send XRP via an on-chain XRPL Payment.
 */
export function WithdrawModal({
  open,
  provider,
  userId,
  liveBalanceXrp,
  onClose,
  onSuccess,
}: WithdrawModalProps) {
  const titleId = useId();
  const [destination, setDestination] = useState<string>("");
  const [destinationTag, setDestinationTag] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setDestination("");
    setDestinationTag("");
    setAmount("");
    setError(null);
    setStatusMessage(null);
    setIsSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isSubmitting, onClose, open]);

  const balanceKnown = liveBalanceXrp !== null;
  const balanceXrp = liveBalanceXrp ?? 0;
  const maxSpendableXrp = useMemo(
    () => getMaxSpendableXrp(balanceXrp),
    [balanceXrp],
  );

  const parsedAmount = useMemo(() => {
    const value = Number(amount);
    return Number.isFinite(value) ? value : NaN;
  }, [amount]);

  const handleMax = useCallback((): void => {
    setError(null);
    if (!balanceKnown) {
      setError("Live balance is still loading. Try again in a moment.");
      return;
    }
    if (maxSpendableXrp <= 0) {
      setError(
        `No spendable XRP. Keep at least ${XRPL_BASE_RESERVE_XRP} XRP reserved.`,
      );
      setAmount("0");
      return;
    }
    setAmount(String(maxSpendableXrp));
  }, [balanceKnown, maxSpendableXrp]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setError(null);

      const dest = destination.trim();
      if (!isValidClassicAddress(dest)) {
        setError("Enter a valid XRPL classic address starting with r…");
        return;
      }

      let tag: number | null = null;
      const tagRaw = destinationTag.trim();
      if (tagRaw !== "") {
        const parsedTag = Number(tagRaw);
        if (
          !Number.isInteger(parsedTag) ||
          parsedTag < 0 ||
          parsedTag > 4_294_967_295
        ) {
          setError("Destination Tag must be an integer (0 – 4294967295).");
          return;
        }
        tag = parsedTag;
      }

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError("Enter a valid XRP amount greater than zero.");
        return;
      }

      if (!balanceKnown) {
        setError("Waiting for live XRPL balance.");
        return;
      }

      if (parsedAmount > balanceXrp) {
        setError(
          `Insufficient balance. You have ${balanceXrp} XRP available.`,
        );
        return;
      }

      if (parsedAmount > maxSpendableXrp) {
        setError(
          `Leave at least ${XRPL_BASE_RESERVE_XRP} XRP reserved. Max is ${maxSpendableXrp} XRP.`,
        );
        return;
      }

      if (!userId) {
        setError(
          "Supabase user sync is pending. Refresh the page and try again.",
        );
        return;
      }

      setIsSubmitting(true);
      setStatusMessage("Preparing XRPL Payment…");

      try {
        const wallet = await getXrplWalletFromProvider(provider);
        setStatusMessage("Submitting Payment to XRPL ledger…");

        const result = await submitXrpPayment({
          wallet,
          destination: dest,
          amountXrp: parsedAmount,
          destinationTag: tag,
        });

        setStatusMessage("Saving transfer to transaction logs…");
        try {
          await insertXrpTransfer({
            userId,
            xrplTxHash: result.txHash,
            destinationAddress: result.destination,
            destinationTag: result.destinationTag,
            amountXrp: result.amountXrp,
          });
        } catch (logError: unknown) {
          // On-chain success still counts — surface log persistence as soft warning.
          console.warn(
            "[WithdrawModal] Transfer log insert failed:",
            logError instanceof Error ? logError.message : logError,
          );
        }

        onSuccess({
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          amountXrp: result.amountXrp,
          destination: result.destination,
        });
        onClose();
      } catch (submitError: unknown) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to send XRP.",
        );
      } finally {
        setIsSubmitting(false);
        setStatusMessage(null);
      }
    },
    [
      balanceKnown,
      balanceXrp,
      destination,
      destinationTag,
      maxSpendableXrp,
      onClose,
      onSuccess,
      parsedAmount,
      provider,
      userId,
    ],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-panel w-full max-w-md rounded-2xl border border-slate-700/60 p-5 shadow-glass"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vault-cyan">
              XRPL Payment
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-semibold text-white">
              Withdraw / Send XRP
            </h2>
            <p className="mt-1 text-xs text-vault-muted">
              Live balance:{" "}
              <span className="font-mono text-white">
                {balanceKnown
                  ? `${balanceXrp.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })} XRP`
                  : "…"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-700/60 p-1.5 text-vault-muted transition-colors hover:border-vault-cyan/40 hover:text-white disabled:opacity-50"
            aria-label="Close withdraw modal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label
              htmlFor="withdraw-destination"
              className="text-[11px] uppercase tracking-wider text-vault-muted"
            >
              Destination XRPL Address
            </label>
            <input
              id="withdraw-destination"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="r…"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-xl border border-slate-800/60 bg-vault-bg/60 px-3 py-2.5 font-mono text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-vault-cyan/40"
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="withdraw-tag"
                className="text-[11px] uppercase tracking-wider text-vault-muted"
              >
                Destination Tag
              </label>
              <InfoTooltip
                label="What is a Destination Tag?"
                content="Exchanges often require a Destination Tag (memo ID) so they can credit the correct user account. Leave blank for personal wallets. Sending to an exchange without the correct tag can result in lost funds."
              />
              <span className="text-[10px] text-vault-muted">(optional)</span>
            </div>
            <input
              id="withdraw-tag"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 123456"
              value={destinationTag}
              onChange={(event) => setDestinationTag(event.target.value)}
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-xl border border-slate-800/60 bg-vault-bg/60 px-3 py-2.5 font-mono text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-vault-cyan/40"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="withdraw-amount"
                className="text-[11px] uppercase tracking-wider text-vault-muted"
              >
                Amount (XRP)
              </label>
              <button
                type="button"
                onClick={handleMax}
                disabled={isSubmitting || !balanceKnown}
                className="rounded-lg border border-vault-teal/30 bg-vault-teal/10 px-2 py-0.5 text-[11px] font-medium text-vault-teal transition-colors hover:bg-vault-teal/20 disabled:opacity-50"
              >
                Max
              </button>
            </div>
            <input
              id="withdraw-amount"
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-xl border border-slate-800/60 bg-vault-bg/60 px-3 py-2.5 font-mono text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-vault-cyan/40"
            />
            <p className="mt-1.5 text-[11px] text-vault-muted">
              Max spendable ≈ {maxSpendableXrp.toLocaleString()} XRP (keeps{" "}
              {XRPL_BASE_RESERVE_XRP} XRP reserve)
            </p>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          ) : null}

          {statusMessage ? (
            <p className="flex items-center gap-2 text-xs text-vault-cyan">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {statusMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon text-sm font-semibold text-vault-bg shadow-neon-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                Confirm Send
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
