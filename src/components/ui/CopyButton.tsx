"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

interface CopyButtonProps {
  value: string;
  label?: string;
  onCopied?: () => void;
  className?: string;
}

/**
 * One-click clipboard copy control with temporary visual confirmation.
 */
export function CopyButton({
  value,
  label = "Copy",
  onCopied,
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState<boolean>(false);

  /** Copies `value` to the clipboard and surfaces brief feedback. */
  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, [onCopied, value]);

  return (
    <button
      type="button"
      onClick={() => {
        void handleCopy();
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-800/60 bg-white/5 px-2.5 py-1.5 text-xs text-vault-muted transition-colors hover:border-vault-cyan/40 hover:text-vault-cyan ${className}`}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-vault-teal" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied!" : label}
    </button>
  );
}
