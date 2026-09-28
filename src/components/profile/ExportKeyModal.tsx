"use client";

import { AlertTriangle, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { useCallback, useState } from "react";
import type { IProvider } from "@web3auth/base";

import { CopyButton } from "@/components/ui/CopyButton";
import { getXrplWalletFromProvider } from "@/lib/web3auth/xrpl";

interface ExportKeyModalProps {
  open: boolean;
  provider: IProvider;
  onClose: () => void;
  onToast: (title: string, description?: string, variant?: "success" | "error" | "info") => void;
}

/**
 * Security confirmation modal for exporting the deterministic XRPL wallet secret.
 */
export function ExportKeyModal({
  open,
  provider,
  onClose,
  onToast,
}: ExportKeyModalProps) {
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [secretKind, setSecretKind] = useState<"seed" | "privateKey" | null>(
    null,
  );
  const [revealed, setRevealed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /** Resets modal local state and closes. */
  const handleClose = useCallback((): void => {
    setAcknowledged(false);
    setSecret(null);
    setSecretKind(null);
    setRevealed(false);
    setError(null);
    onClose();
  }, [onClose]);

  /**
   * Derives and reveals the XRPL family seed (preferred) or private key.
   */
  const handleExport = useCallback(async (): Promise<void> => {
    if (!acknowledged) {
      setError("Confirm that you understand the risk before exporting.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const wallet = await getXrplWalletFromProvider(provider);
      if (wallet.seed) {
        setSecret(wallet.seed);
        setSecretKind("seed");
      } else {
        setSecret(wallet.privateKey);
        setSecretKind("privateKey");
      }
      setRevealed(true);
      onToast(
        "Secret exported locally",
        "Never share this value. It grants full control of your XRPL funds.",
        "info",
      );
    } catch (exportError: unknown) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "Failed to export wallet secret.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [acknowledged, onToast, provider]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-key-title"
    >
      <div className="glass-panel w-full max-w-lg rounded-2xl border-amber-400/30 p-6 shadow-glass">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="export-key-title"
                className="text-lg font-semibold text-white"
              >
                Export Wallet Secret Key
              </h2>
              <p className="mt-1 text-sm text-vault-muted">
                Self-custody export for your Web3Auth-derived XRPL wallet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-vault-muted hover:text-white"
            aria-label="Close export modal"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            Anyone with this secret can move your XRP. Never screenshot, chat,
            or store it in plaintext online. YieldVault never uploads this key.
          </p>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800/60 bg-vault-bg/40 px-3 py-3 text-sm text-vault-muted">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1"
          />
          <span>
            I understand this reveals my self-custody secret and I will keep it
            offline and private.
          </span>
        </label>

        {secret ? (
          <div className="mt-4 rounded-xl border border-slate-800/60 bg-vault-bg/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                {secretKind === "seed" ? "XRPL Family Seed" : "XRPL Private Key"}
              </p>
              <button
                type="button"
                onClick={() => setRevealed((value) => !value)}
                className="inline-flex items-center gap-1 text-xs text-vault-cyan"
              >
                {revealed ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {revealed ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-2 break-all font-mono text-sm text-white">
              {revealed ? secret : "•".repeat(Math.min(secret.length, 48))}
            </p>
            <div className="mt-3">
              <CopyButton
                value={secret}
                label="Copy secret"
                onCopied={() =>
                  onToast("Secret copied", "Clear your clipboard after storing offline.")
                }
              />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              void handleExport();
            }}
            disabled={!acknowledged || isLoading}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-amber-400/90 text-sm font-semibold text-vault-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Deriving secret…" : "Reveal Secret Key"}
          </button>
        )}

        {error ? (
          <p className="mt-3 text-xs text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
