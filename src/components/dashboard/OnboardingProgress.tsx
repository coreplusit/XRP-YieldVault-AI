"use client";

import { Check, Lock, Rocket } from "lucide-react";
import Link from "next/link";

import { appConfig } from "@/lib/config/env";

export type OnboardingStepState = "complete" | "current" | "locked";

interface OnboardingStep {
  id: string;
  label: string;
  state: OnboardingStepState;
}

interface OnboardingProgressProps {
  walletReady: boolean;
  escrowComplete: boolean;
}

/**
 * Four-step dashboard journey: login, activate, escrow, governance.
 */
export function OnboardingProgress({
  walletReady,
  escrowComplete,
}: OnboardingProgressProps) {
  const claimXrp = appConfig.vault.faucetClaimXrp;
  const steps: OnboardingStep[] = [
    { id: "login", label: "Google Login", state: "complete" },
    {
      id: "activate",
      label: `Claim ${claimXrp} XRP`,
      state: walletReady ? "complete" : "current",
    },
    {
      id: "escrow",
      label: `Lock ${claimXrp} XRP`,
      state: !walletReady ? "locked" : escrowComplete ? "complete" : "current",
    },
    {
      id: "dao",
      label: `${claimXrp} VP Governance`,
      state: escrowComplete ? "current" : "locked",
    },
  ];

  return (
    <section
      className="glass-panel mb-6 rounded-2xl p-4 sm:p-5"
      aria-label="Onboarding progress"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vault-cyan">
            Your journey
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white">
            Activate, lock escrow, then vote
          </h2>
        </div>
      </div>
      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const current = step.state === "current";
          const complete = step.state === "complete";
          return (
            <li
              key={step.id}
              className={`rounded-xl border px-3 py-3 ${
                complete
                  ? "border-vault-teal/40 bg-vault-teal/10"
                  : current
                    ? "onboarding-pulse border-vault-cyan/50 bg-vault-cyan/10"
                    : "border-slate-800/70 bg-vault-bg/30 opacity-70"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    complete
                      ? "bg-vault-teal text-vault-bg"
                      : current
                        ? "bg-vault-cyan text-vault-bg"
                        : "border border-slate-700 text-vault-muted"
                  }`}
                  aria-hidden="true"
                >
                  {complete ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : step.state === "locked" ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </span>
                <p className="text-[10px] uppercase tracking-wider text-vault-muted">
                  Step {index + 1}
                </p>
              </div>
              <p className="mt-2 text-sm font-medium text-white">{step.label}</p>
              <p className="mt-0.5 text-[11px] text-vault-muted">
                {complete
                  ? "Completed"
                  : current && step.id === "activate"
                    ? `Claim ${claimXrp} Testnet XRP`
                    : current && step.id === "escrow"
                      ? `Unlocks ${claimXrp} VP`
                      : current
                        ? "Active"
                        : step.id === "dao"
                          ? `Locked until ${claimXrp} XRP escrow`
                          : "Locked"}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface EscrowUnlockedBannerProps {
  amountXrp: number;
  votingPower: number;
}

/**
 * Shown after a confirmed escrow so the next click is DAO governance.
 */
export function EscrowUnlockedBanner({
  amountXrp,
  votingPower,
}: EscrowUnlockedBannerProps) {
  const amountLabel = amountXrp.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
  const vpLabel = votingPower.toLocaleString();

  return (
    <section
      className="mb-6 rounded-2xl border border-vault-teal/40 bg-vault-teal/10 px-4 py-4 sm:px-5"
      role="status"
      aria-label="Escrow unlocked voting power"
    >
      <p className="text-sm font-semibold text-white sm:text-base">
        {amountLabel} XRP locked in native escrow. You unlocked {vpLabel}{" "}
        Voting Power (VP). Shape the protocol&apos;s future now.
      </p>
      <Link
        href="/dao-governance"
        prefetch
        className="onboarding-pulse mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-neon px-5 text-sm font-semibold text-vault-bg shadow-neon transition-all hover:brightness-110"
      >
        <Rocket className="h-4 w-4" aria-hidden="true" />
        Proceed to DAO Governance
      </Link>
    </section>
  );
}
