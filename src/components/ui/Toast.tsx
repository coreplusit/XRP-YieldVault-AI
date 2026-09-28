"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "error" | "info";
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Lightweight toast notification for copy / faucet feedback.
 */
export function Toast({ toast, onDismiss, durationMs = 2600 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [durationMs, onDismiss, toast]);

  if (!toast) {
    return null;
  }

  const variant = toast.variant ?? "success";
  const borderClass =
    variant === "error"
      ? "border-rose-500/40"
      : variant === "info"
        ? "border-vault-cyan/40"
        : "border-vault-teal/40";

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[60] w-[min(100vw-2rem,22rem)] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div
        className={`glass-panel flex items-start gap-3 rounded-2xl border ${borderClass} px-4 py-3 shadow-neon-sm`}
      >
        <CheckCircle2
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            variant === "error" ? "text-rose-400" : "text-vault-teal"
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-xs text-vault-muted">{toast.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-vault-muted hover:text-white"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
