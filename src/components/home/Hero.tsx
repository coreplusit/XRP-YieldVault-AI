"use client";

import {
  ArrowRight,
  ChevronRight,
  Loader2,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { useWeb3Auth } from "@/context/Web3AuthContext";

/**
 * Hero section — primary value proposition, CTAs, and onboarding card.
 */
export function Hero() {
  const router = useRouter();
  const { isConnected, isInitializing, isLoggingIn, loginWithGoogle } =
    useWeb3Auth();
  const [isEntering, setIsEntering] = useState<boolean>(false);

  const authBusy = isInitializing || isLoggingIn || isEntering;

  /** Scrolls to governance / features section. */
  const handleExploreStrategies = useCallback((): void => {
    document.getElementById("governance")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  /**
   * Completes Web3Auth Google sign-in, then enters the vault console.
   */
  const enterAppAfterAuth = useCallback(async (): Promise<void> => {
    if (isConnected) {
      router.push("/dashboard");
      return;
    }

    setIsEntering(true);
    try {
      const ok = await loginWithGoogle();
      if (ok) {
        router.push("/dashboard");
      }
    } finally {
      setIsEntering(false);
    }
  }, [isConnected, loginWithGoogle, router]);

  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-32 top-0 h-[500px] w-[500px] rounded-full bg-vault-teal/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-32 bottom-0 h-[400px] w-[400px] rounded-full bg-vault-cyan/5 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-vault-teal/30 bg-vault-teal/5 px-4 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-vault-teal" aria-hidden="true" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-vault-teal">
                Native XRPL Escrow Protocol
              </span>
            </div>

            <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
              Automated Yield &{" "}
              <span className="text-gradient-neon">Transparent Governance</span>{" "}
              on XRP Ledger
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-vault-muted">
              Lock $100 XRP in native on-chain escrows. Experience non-custodial
              security, predictable 15% APY yield strategies, and decentralized
              voting.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              {isConnected ? (
                <Link
                  href="/dashboard"
                  prefetch
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-neon px-7 text-sm font-semibold text-vault-bg shadow-neon transition-all hover:brightness-110"
                >
                  Launch Vault App
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void enterAppAfterAuth();
                  }}
                  disabled={authBusy}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-neon px-7 text-sm font-semibold text-vault-bg shadow-neon transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      Launch Vault App
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleExploreStrategies}
                className="glass-panel inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 text-sm font-medium text-vault-text transition-all hover:border-vault-cyan/40 hover:text-white"
              >
                Explore Yield Strategies
                <ChevronRight className="h-4 w-4 text-vault-cyan" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 shadow-glass">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-vault-cyan">
              Quick Start
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Choose your entry path
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-vault-muted">
              Seamless Web2 or Web3 onboarding — both routes grant full vault
              access and DAO voting power.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  void enterAppAfterAuth();
                }}
                disabled={authBusy}
                className="group flex w-full items-center gap-4 rounded-xl border border-slate-800/60 bg-white/5 p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
                  {authBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-700" aria-hidden="true" />
                  ) : (
                    <GoogleIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Web2 — Google / Email</p>
                  <p className="text-xs text-vault-muted">One-click sign-in with Google or email</p>
                </div>
                <ChevronRight
                  className="h-4 w-4 text-vault-muted transition-transform group-hover:translate-x-0.5 group-hover:text-vault-cyan"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  void enterAppAfterAuth();
                }}
                disabled={authBusy}
                className="group flex w-full items-center gap-4 rounded-xl border border-vault-teal/20 bg-vault-teal/5 p-4 text-left transition-all hover:border-vault-teal/40 hover:bg-vault-teal/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-wallet">
                  <Wallet className="h-5 w-5 text-vault-bg" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Web3 — XRP Wallet</p>
                  <p className="text-xs text-vault-muted">
                    Connect via Web3Auth non-custodial XRPL key
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 text-vault-muted transition-transform group-hover:translate-x-0.5 group-hover:text-vault-teal"
                  aria-hidden="true"
                />
              </button>

              <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-800/40 bg-vault-bg/50 px-3 py-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-vault-muted" aria-hidden="true" />
                <p className="text-xs text-vault-muted">
                  Email-only path available after Google sign-in
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
