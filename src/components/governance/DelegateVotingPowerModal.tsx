"use client";

import { Bot, Check, Loader2, UserRound, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from "react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { INVESTOR_TOOLTIPS } from "@/lib/copy/investorTooltips";
import {
  COMMUNITY_DELEGATES,
  type DelegatePresetId,
  type VotingDelegation,
} from "@/lib/governance/delegation";
import { truncateXrplAddress } from "@/lib/web3auth/xrpl";

interface DelegateVotingPowerModalProps {
  open: boolean;
  votingPower: number;
  currentDelegation: VotingDelegation | null;
  onClose: () => void;
  onConfirm: (
    presetId: DelegatePresetId,
    customAddress?: string,
  ) => void | Promise<void>;
  onRevoke?: () => void | Promise<void>;
}

/**
 * Modal to delegate VP to a community / AI strategy or a custom XRPL address.
 */
export function DelegateVotingPowerModal({
  open,
  votingPower,
  currentDelegation,
  onClose,
  onConfirm,
  onRevoke,
}: DelegateVotingPowerModalProps) {
  const titleId = useId();
  const [presetId, setPresetId] = useState<DelegatePresetId>("treasury-ai");
  const [customAddress, setCustomAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setPresetId(currentDelegation?.presetId ?? "treasury-ai");
    setCustomAddress(
      currentDelegation?.presetId === "custom"
        ? currentDelegation.address
        : "",
    );
    setError(null);
    setIsSubmitting(false);
  }, [currentDelegation, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setIsSubmitting(true);
      setError(null);
      try {
        await onConfirm(
          presetId,
          presetId === "custom" ? customAddress : undefined,
        );
        onClose();
      } catch (submitError: unknown) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Delegation failed.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [customAddress, onClose, onConfirm, presetId],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-panel max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl p-4 shadow-glass sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
              Delegation
            </p>
            <h2
              id={titleId}
              className="mt-1 flex items-center gap-2 text-xl font-semibold text-white"
            >
              Delegate Voting Power
              <InfoTooltip
                label="What is voting power delegation?"
                content={INVESTOR_TOOLTIPS.delegation}
              />
            </h2>
            <p className="mt-1 text-xs text-vault-muted">
              Assign {votingPower.toLocaleString()} VP. Your escrowed XRP stays
              locked on XRPL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-vault-muted hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <fieldset className="space-y-2">
            <legend className="text-xs text-vault-muted">
              Community Delegate / AI Delegate Strategy
            </legend>
            {COMMUNITY_DELEGATES.map((option) => {
              const selected = presetId === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                    selected
                      ? "border-vault-teal/40 bg-vault-teal/10"
                      : "border-slate-800/60 bg-vault-bg/40 hover:border-vault-cyan/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="delegate-preset"
                    className="mt-1"
                    checked={selected}
                    onChange={() => setPresetId(option.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <Bot className="h-3.5 w-3.5 text-vault-teal" aria-hidden="true" />
                      {option.name}
                      {selected ? (
                        <Check className="h-3.5 w-3.5 text-vault-teal" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-vault-muted">
                      {option.tagline}
                    </span>
                  </span>
                </label>
              );
            })}

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                presetId === "custom"
                  ? "border-vault-cyan/40 bg-vault-cyan/10"
                  : "border-slate-800/60 bg-vault-bg/40 hover:border-vault-cyan/30"
              }`}
            >
              <input
                type="radio"
                name="delegate-preset"
                className="mt-1"
                checked={presetId === "custom"}
                onChange={() => setPresetId("custom")}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  <UserRound className="h-3.5 w-3.5 text-vault-cyan" aria-hidden="true" />
                  Custom XRPL Address
                </span>
                <span className="mt-1 block text-xs text-vault-muted">
                  Enter any classic address you trust to vote on your behalf.
                </span>
              </span>
            </label>
          </fieldset>

          {presetId === "custom" ? (
            <label className="block text-xs text-vault-muted">
              Delegate XRPL Address
              <input
                type="text"
                value={customAddress}
                onChange={(event) => setCustomAddress(event.target.value)}
                placeholder="r..."
                className="mt-2 h-11 w-full rounded-xl border border-slate-800/60 bg-vault-bg/70 px-3 font-mono text-sm text-white outline-none focus:border-vault-cyan/40"
                required
              />
            </label>
          ) : null}

          {currentDelegation ? (
            <p className="rounded-xl border border-slate-800/60 bg-vault-bg/40 px-3 py-2 text-xs text-vault-muted">
              Currently delegated to{" "}
              <span className="text-white">{currentDelegation.displayName}</span>
              {" · "}
              <span className="font-mono">
                {truncateXrplAddress(currentDelegation.address, 8, 6)}
              </span>
            </p>
          ) : null}

          {error ? <p className="text-xs text-rose-300">{error}</p> : null}

          <div className="flex flex-wrap justify-between gap-2 pt-1">
            {currentDelegation && onRevoke ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  void (async () => {
                    setIsSubmitting(true);
                    setError(null);
                    try {
                      await onRevoke();
                      onClose();
                    } catch (revokeError: unknown) {
                      setError(
                        revokeError instanceof Error
                          ? revokeError.message
                          : "Failed to revoke delegation.",
                      );
                    } finally {
                      setIsSubmitting(false);
                    }
                  })();
                }}
                className="rounded-xl border border-slate-800/60 px-4 py-2.5 text-sm text-vault-muted hover:text-rose-300 disabled:opacity-50"
              >
                Revoke
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-800/60 px-4 py-2.5 text-sm text-vault-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-neon px-4 py-2.5 text-sm font-semibold text-vault-bg disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Confirm Delegation
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
