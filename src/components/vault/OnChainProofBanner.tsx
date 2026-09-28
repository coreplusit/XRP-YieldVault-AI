"use client";

import { CheckCircle2, Copy, ExternalLink, X } from "lucide-react";
import { useCallback, useState } from "react";

import { truncateTxHash } from "@/lib/web3auth/xrpl";

export interface OnChainProof {
  txHash: string;
  explorerUrl: string;
  amountXrp: number;
}

interface OnChainProofBannerProps {
  proof: OnChainProof | null;
  onDismiss: () => void;
}

/**
 * Floating bottom-right banner showing live XRPL transaction verification.
 */
export function OnChainProofBanner({
  proof,
  onDismiss,
}: OnChainProofBannerProps) {
  const [copied, setCopied] = useState<boolean>(false);

  /** Copies the full transaction hash to the clipboard. */
  const handleCopy = useCallback(async (): Promise<void> => {
    if (!proof) return;
    try {
      await navigator.clipboard.writeText(proof.txHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [proof]);

  if (!proof) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-6 right-6 z-50 w-[min(100vw-2rem,22rem)] animate-in fade-in slide-in-from-bottom-4"
      aria-live="polite"
      aria-label="On-chain proof"
    >
      <div className="glass-panel relative overflow-hidden rounded-2xl border-vault-teal/30 p-4 shadow-neon-sm">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-vault-teal/10 via-transparent to-vault-cyan/10"
          aria-hidden="true"
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-vault-teal"
              aria-hidden="true"
            />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vault-cyan">
                On-Chain Proof
              </p>
              <p className="mt-0.5 text-sm font-semibold text-white">
                Escrow locked · {proof.amountXrp} XRP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1 text-vault-muted transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Dismiss on-chain proof"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="relative mt-4 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-vault-teal/30 bg-vault-teal/10 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vault-teal opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vault-teal" />
            </span>
            <span className="text-xs font-medium text-vault-teal">
              Validated on XRPL Ledger
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-800/60 bg-vault-bg/60 px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs text-vault-text">
              {truncateTxHash(proof.txHash)}
            </code>
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-vault-muted transition-colors hover:bg-white/5 hover:text-vault-cyan"
              aria-label="Copy transaction hash"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <a
            href={proof.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-vault-cyan/30 bg-vault-cyan/5 px-3 py-2.5 text-sm font-medium text-vault-cyan transition-colors hover:bg-vault-cyan/10"
          >
            Verify on XRPL Explorer
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </aside>
  );
}
