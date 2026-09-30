"use client";

import { Check, Handshake, Loader2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from "react";

import {
  COMMUNITY_DELEGATES,
  isValidClassicAddress,
  type DelegatePresetId,
  type VotingDelegation,
} from "@/lib/governance/delegation";
import { truncateXrplAddress } from "@/lib/web3auth/xrpl";

const TOP_DELEGATE_IDS = ["yield-community", "safety-council"] as const;

interface DelegateModalProps {
  open: boolean;
  votingPower: number;
  currentDelegation: VotingDelegation | null;
  /** Set when opened from a specific proposal card. */
  proposalTitle?: string | null;
  onClose: () => void;
  onConfirm: (
    presetId: DelegatePresetId,
    customAddress?: string,
  ) => void | Promise<void>;
  onRevoke?: () => void | Promise<void>;
}

/**
 * Delegate voting power to a community representative or a custom XRPL address.
 * Does not move escrowed XRP. Persisted by the parent via `user_delegations`.
 */
export function DelegateModal({
  open,
  votingPower,
  currentDelegation,
  proposalTitle = null,
  onClose,
  onConfirm,
  onRevoke,
}: DelegateModalProps) {
  const titleId = useId();
  const [presetId, setPresetId] = useState<DelegatePresetId>("yield-community");
  const [customAddress, setCustomAddress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const topDelegates = COMMUNITY_DELEGATES.filter((item) =>
    (TOP_DELEGATE_IDS as readonly string[]).includes(item.id),
  );
  const vpLabel = Math.max(0, votingPower).toLocaleString();

  useEffect(() => {
    if (!open) return;
    setPresetId(currentDelegation?.presetId ?? "yield-community");
    setCustomAddress(
      currentDelegation?.presetId === "custom" ? currentDelegation.address : "",
    );
    setError(null);
    setIsSubmitting(false);
  }, [currentDelegation, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isSubmitting, onClose, open]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setError(null);

      if (presetId === "custom" && !isValidClassicAddress(customAddress)) {
        setError("Enter a valid XRPL classic address starting with r…");
        return;
      }

      setIsSubmitting(true);
      try {
        await onConfirm(
          presetId,
          presetId === "custom" ? customAddress.trim() : undefined,
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
        className="glass-panel max-h-[min(92vh,44rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700/60 p-5 shadow-glass"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vault-cyan">
              Voting power
            </p>
            <h2
              id={titleId}
              className="mt-1 flex items-center gap-2 text-lg font-semibold text-white"
            >
              <Handshake className="h-5 w-5 text-vault-teal" aria-hidden="true" />
              Delegate Voting Power
            </h2>
            {proposalTitle ? (
              <p className="mt-1 text-xs text-vault-muted">
                Applies to this proposal and your other active votes:{" "}
                <span className="text-white">{proposalTitle}</span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-700/60 p-1.5 text-vault-muted hover:text-white disabled:opacity-50"
            aria-label="Close delegation modal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-vault-muted">
              Top Community Delegates
            </p>
            <div className="mt-2 grid gap-2">
              {topDelegates.map((delegate) => {
                const selected = presetId === delegate.id;
                return (
                  <button
                    key={delegate.id}
                    type="button"
                    onClick={() => setPresetId(delegate.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-vault-teal/50 bg-vault-teal/10"
                        : "border-slate-800/60 bg-vault-bg/40 hover:border-vault-cyan/30"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? "border-vault-teal bg-vault-teal text-vault-bg"
                          : "border-slate-600"
                      }`}
                      aria-hidden="true"
                    >
                      {selected ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">
                        {delegate.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-vault-muted">
                        {delegate.tagline}
                      </span>
                      <span className="mt-1 block font-mono text-[11px] text-vault-cyan">
                        {truncateXrplAddress(delegate.address, 8, 6)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="delegate-custom-address"
              className="text-[11px] uppercase tracking-wider text-vault-muted"
            >
              Delegate to Representative Address
            </label>
            <input
              id="delegate-custom-address"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="r…"
              value={customAddress}
              onChange={(event) => {
                setCustomAddress(event.target.value);
                setPresetId("custom");
              }}
              onFocus={() => setPresetId("custom")}
              disabled={isSubmitting}
              className={`mt-1.5 w-full rounded-xl border bg-vault-bg/60 px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-slate-600 ${
                presetId === "custom"
                  ? "border-vault-cyan/50"
                  : "border-slate-800/60"
              }`}
            />
          </div>

          <p className="rounded-xl border border-slate-800/60 bg-vault-bg/40 px-3 py-2.5 text-xs leading-relaxed text-vault-muted">
            Delegating allows your chosen representative to vote using your{" "}
            {vpLabel} VP without transferring your XRP. You retain 100% custody
            and can revoke delegation anytime.
          </p>

          {error ? (
            <p className="text-xs text-rose-300" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-neon text-sm font-semibold text-vault-bg shadow-neon-sm hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving delegation…
                </>
              ) : (
                <>
                  <Handshake className="h-4 w-4" aria-hidden="true" />
                  Confirm Delegation
                </>
              )}
            </button>
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
                          : "Could not revoke delegation.",
                      );
                    } finally {
                      setIsSubmitting(false);
                    }
                  })();
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-700/70 px-4 text-sm text-vault-muted hover:text-white disabled:opacity-60"
              >
                Revoke
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
