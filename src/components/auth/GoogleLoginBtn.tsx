"use client";

import { ArrowRight, Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { useWeb3Auth } from "@/context/Web3AuthContext";
import { truncateXrplAddress } from "@/lib/web3auth/xrpl";

/**
 * Google / Gmail login button powered by Web3Auth (non-custodial XRPL key).
 * Shows loading, error, and connected profile/address states.
 * Successful login navigates straight to `/dashboard`.
 */
export function GoogleLoginBtn() {
  const router = useRouter();
  const {
    isInitializing,
    isLoggingIn,
    isConnected,
    error,
    session,
    loginWithGoogle,
    logout,
  } = useWeb3Auth();

  /** Handles Google login click, then enters the vault console. */
  const handleLogin = useCallback(async (): Promise<void> => {
    const ok = await loginWithGoogle();
    if (ok) {
      router.push("/dashboard");
    }
  }, [loginWithGoogle, router]);

  /** Handles logout click. */
  const handleLogout = useCallback((): void => {
    void logout();
  }, [logout]);

  if (isConnected && session) {
    return (
      <div className="glass-panel flex w-full max-w-md flex-col gap-3 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-[0.15em] text-vault-cyan">
              Connected · Non-Custodial
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white">
              {session.email ?? session.name ?? "Web3Auth User"}
            </p>
            <p className="mt-1 font-mono text-xs text-vault-muted">
              XRPL: {truncateXrplAddress(session.xrplAddress)}
            </p>
            {session.dbUser ? (
              <p className="mt-1 text-xs text-vault-teal">Synced with Supabase</p>
            ) : (
              <p className="mt-1 text-xs text-amber-400">
                Auth OK — DB sync pending / blocked by RLS
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-800/60 px-3 text-xs text-vault-muted transition-colors hover:border-vault-cyan/40 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Logout
          </button>
        </div>
        <Link
          href="/dashboard"
          prefetch
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-vault-teal/30 bg-vault-teal/10 text-sm font-medium text-vault-teal transition-colors hover:bg-vault-teal/20"
        >
          Go to Dashboard
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {error ? (
          <p className="text-xs text-amber-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const isBusy = isInitializing || isLoggingIn;
  const label = isInitializing
    ? "Initializing Web3Auth…"
    : isLoggingIn
      ? "Signing in with Google…"
      : "Sign in with Google (Non-Custodial)";

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          void handleLogin();
        }}
        disabled={isBusy}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white px-6 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-700" aria-hidden="true" />
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
        {label}
      </button>
      {error ? (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
