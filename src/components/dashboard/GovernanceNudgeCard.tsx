"use client";

import Link from "next/link";
import { Landmark, Share2, Vote } from "lucide-react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { INVESTOR_TOOLTIPS } from "@/lib/copy/investorTooltips";

interface GovernanceNudgeCardProps {
  votingPower: number;
  activeProposalCount: number;
  isDelegated: boolean;
  delegateName?: string | null;
  onQuickDelegate: () => void;
}

/**
 * Subtle dashboard banner nudging passive depositors toward governance.
 */
export function GovernanceNudgeCard({
  votingPower,
  activeProposalCount,
  isDelegated,
  delegateName,
  onQuickDelegate,
}: GovernanceNudgeCardProps) {
  return (
    <section className="glass-panel mb-6 rounded-2xl border-vault-teal/20 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-vault-teal/30 bg-vault-teal/10 text-vault-teal">
              <Landmark className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
              Governance Nudge
            </p>
            <InfoTooltip
              label="What is voting power delegation?"
              content={INVESTOR_TOOLTIPS.delegation}
            />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-vault-text">
            You have{" "}
            <span className="font-semibold text-white">
              {votingPower.toLocaleString()} Voting Power
            </span>{" "}
            active from your Escrow deposit! Participate in{" "}
            <span className="font-semibold text-white">
              {activeProposalCount} active community proposal
              {activeProposalCount === 1 ? "" : "s"}
            </span>{" "}
            or delegate your vote.
          </p>
          {isDelegated && delegateName ? (
            <p className="mt-2 break-words text-xs text-vault-teal">
              Delegated to: {delegateName}
            </p>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href="/governance"
            prefetch
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-vault-teal/40 bg-vault-teal/10 px-4 py-2.5 text-sm font-medium text-vault-teal transition-colors hover:bg-vault-teal/20"
          >
            <Vote className="h-4 w-4" aria-hidden="true" />
            Vote in Governance
          </Link>
          <button
            type="button"
            onClick={onQuickDelegate}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800/60 px-4 py-2.5 text-sm font-medium text-vault-muted transition-colors hover:border-vault-cyan/30 hover:text-white"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Quick Delegate
          </button>
        </div>
      </div>
    </section>
  );
}
