"use client";

import { Loader2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from "react";

import type { ProposalCategory } from "@/lib/supabase/governance";

export interface SubmitProposalFormValues {
  title: string;
  category: ProposalCategory;
  description: string;
  durationDays: number;
}

interface SubmitProposalModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: SubmitProposalFormValues) => void | Promise<void>;
}

const CATEGORIES: readonly ProposalCategory[] = [
  "Yield Strategy",
  "Fees",
  "Treasury",
  "Parameter",
  "Other",
] as const;

/**
 * Clean modal form for submitting a Phase-1 governance proposal (local state).
 */
export function SubmitProposalModal({
  open,
  onClose,
  onSubmit,
}: SubmitProposalModalProps) {
  const titleId = useId();
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<ProposalCategory>("Yield Strategy");
  const [description, setDescription] = useState<string>("");
  const [durationDays, setDurationDays] = useState<string>("7");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCategory("Yield Strategy");
    setDescription("");
    setDurationDays("7");
    setError(null);
    setIsSubmitting(false);
  }, [open]);

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
      const trimmedTitle = title.trim();
      const trimmedDescription = description.trim();
      const days = Number(durationDays);

      if (trimmedTitle.length < 8) {
        setError("Title must be at least 8 characters.");
        return;
      }
      if (trimmedDescription.length < 20) {
        setError("Description must be at least 20 characters.");
        return;
      }
      if (!Number.isFinite(days) || days < 1 || days > 30) {
        setError("Duration must be between 1 and 30 days.");
        return;
      }

      setIsSubmitting(true);
      setError(null);
      try {
        await onSubmit({
          title: trimmedTitle,
          category,
          description: trimmedDescription,
          durationDays: days,
        });
        onClose();
      } catch (submitError: unknown) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to submit proposal.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [category, description, durationDays, onClose, onSubmit, title],
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
        className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-glass"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
              Governance
            </p>
            <h2 id={titleId} className="mt-1 text-xl font-semibold text-white">
              Submit Proposal
            </h2>
            <p className="mt-1 text-xs text-vault-muted">
              Phase 1 drafts are stored locally for UI preview.
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
          <label className="block text-xs text-vault-muted">
            Title
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Increase escrow lock to 45 days"
              className="mt-2 h-11 w-full rounded-xl border border-slate-800/60 bg-vault-bg/70 px-3 text-sm text-white outline-none focus:border-vault-cyan/40"
              required
            />
          </label>

          <label className="block text-xs text-vault-muted">
            Category
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as ProposalCategory)
              }
              className="mt-2 h-11 w-full rounded-xl border border-slate-800/60 bg-vault-bg/70 px-3 text-sm text-white outline-none focus:border-vault-cyan/40"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-vault-muted">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Explain the change, rationale, and expected impact…"
              className="mt-2 w-full rounded-xl border border-slate-800/60 bg-vault-bg/70 px-3 py-2.5 text-sm text-white outline-none focus:border-vault-cyan/40"
              required
            />
          </label>

          <label className="block text-xs text-vault-muted">
            Target Duration (days)
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={durationDays}
              onChange={(event) => setDurationDays(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-800/60 bg-vault-bg/70 px-3 font-mono text-sm text-white outline-none focus:border-vault-cyan/40"
              required
            />
          </label>

          {error ? <p className="text-xs text-rose-300">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
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
              Submit Proposal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
