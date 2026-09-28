"use client";

import {
  FilePlus2,
  Landmark,
  Loader2,
  RefreshCw,
  Scale,
  Share2,
  Vote,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DelegateVotingPowerModal } from "@/components/governance/DelegateVotingPowerModal";
import {
  SubmitProposalModal,
  type SubmitProposalFormValues,
} from "@/components/governance/SubmitProposalModal";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { useVotingDelegation } from "@/hooks/useVotingDelegation";
import { useVaultData } from "@/context/VaultDataContext";
import { useWeb3Auth } from "@/context/Web3AuthContext";
import { appConfig } from "@/lib/config/env";
import { INVESTOR_TOOLTIPS } from "@/lib/copy/investorTooltips";
import type { DelegatePresetId } from "@/lib/governance/delegation";
import { INITIAL_GOVERNANCE_STATS } from "@/lib/governance/sample";
import {
  castGovernanceVote,
  computeVotingPower,
  fetchGovernanceProposals,
  insertGovernanceProposal,
  type GovernanceProposal,
  type UiProposalStatus,
  type VoteOption,
} from "@/lib/supabase/governance";
import { truncateXrplAddress } from "@/lib/web3auth/xrpl";

/**
 * Maps proposal status to badge label + styles.
 * @param status - UI proposal status.
 */
function statusBadge(status: UiProposalStatus): {
  label: string;
  className: string;
} {
  if (status === "active") {
    return {
      label: "Active",
      className: "border-vault-cyan/30 bg-vault-cyan/10 text-vault-cyan",
    };
  }
  if (status === "quorum") {
    return {
      label: "Quorum Reached",
      className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    };
  }
  if (status === "rejected") {
    return {
      label: "Rejected",
      className: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    };
  }
  return {
    label: "Passed",
    className: "border-vault-teal/30 bg-vault-teal/10 text-vault-teal",
  };
}

/**
 * DAO Governance dashboard — Supabase-backed proposals, votes, and delegation.
 */
export function GovernanceClient() {
  const { isInitializing, isConnected, session } = useWeb3Auth();
  const { stats } = useVaultData();
  const userId = session?.dbUser?.id ?? null;

  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [delegateModalOpen, setDelegateModalOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const { delegation, delegate, clearDelegation, syncError } =
    useVotingDelegation(userId);

  const userVotingPower = useMemo(
    () => computeVotingPower(stats?.activeDepositCount ?? 0),
    [stats?.activeDepositCount],
  );

  const activeCount = useMemo(
    () =>
      proposals.filter(
        (proposal) =>
          proposal.status === "active" || proposal.status === "quorum",
      ).length,
    [proposals],
  );

  const showToast = useCallback(
    (
      title: string,
      description?: string,
      variant: ToastMessage["variant"] = "success",
    ): void => {
      setToast({ id: `${Date.now()}`, title, description, variant });
    },
    [],
  );

  const loadProposals = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const next = await fetchGovernanceProposals(userId);
      setProposals(next);
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load proposals.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isConnected) return;
    void loadProposals();
  }, [isConnected, loadProposals]);

  const handleVote = useCallback(
    async (proposalId: string, vote: VoteOption): Promise<void> => {
      if (!userId) {
        showToast(
          "Sync required",
          "Complete Supabase user sync before voting.",
          "error",
        );
        return;
      }
      if (userVotingPower <= 0) {
        showToast(
          "No Voting Power",
          "Active escrow deposits are required to cast VP.",
          "error",
        );
        return;
      }

      setVotingProposalId(proposalId);
      try {
        const updated = await castGovernanceVote({
          proposalId,
          userId,
          voteOption: vote,
          votingPower: userVotingPower,
        });
        setProposals((current) =>
          current.map((proposal) =>
            proposal.id === proposalId ? updated : proposal,
          ),
        );
        showToast(
          vote === "yes"
            ? "Voted Yes"
            : vote === "no"
              ? "Voted No"
              : "Abstained",
          `${userVotingPower} VP recorded on-chain in Supabase.`,
        );
      } catch (error: unknown) {
        showToast(
          "Vote failed",
          error instanceof Error ? error.message : "Could not cast vote.",
          "error",
        );
      } finally {
        setVotingProposalId(null);
      }
    },
    [showToast, userId, userVotingPower],
  );

  const handleSubmitProposal = useCallback(
    async (values: SubmitProposalFormValues): Promise<void> => {
      const created = await insertGovernanceProposal({
        title: values.title,
        category: values.category,
        description: values.description,
        durationDays: values.durationDays,
      });
      setProposals((current) => [created, ...current]);
      showToast("Proposal submitted", `"${values.title}" is now live.`);
    },
    [showToast],
  );

  const handleDelegateConfirm = useCallback(
    async (
      presetId: DelegatePresetId,
      customAddress?: string,
    ): Promise<void> => {
      const next = await delegate(presetId, customAddress);
      showToast(
        "Voting power delegated",
        `Delegated to ${next.displayName}. Escrowed funds were not moved.`,
      );
    },
    [delegate, showToast],
  );

  const handleRevokeDelegation = useCallback(async (): Promise<void> => {
    await clearDelegation();
    showToast("Delegation revoked", "You control your Voting Power again.");
  }, [clearDelegation, showToast]);

  if (isInitializing || !isConnected || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-vault-cyan" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            DAO
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Governance</h1>
          <p className="mt-1 max-w-2xl text-sm text-vault-muted">
            Vote on protocol parameters, fees, and treasury allocations.
            Proposals and votes sync to Supabase; escrowed XRP stays
            non-custodial on XRPL.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadProposals()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800/60 px-4 py-2.5 text-sm text-vault-muted transition-colors hover:border-vault-cyan/30 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-neon px-4 py-2.5 text-sm font-semibold text-vault-bg shadow-neon-sm transition-all hover:brightness-110"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Submit Proposal
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="glass-panel rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-vault-teal/20 bg-vault-teal/5 text-vault-teal">
              <Landmark className="h-4 w-4" aria-hidden="true" />
            </div>
            <InfoTooltip
              label="What is staking?"
              content={INVESTOR_TOOLTIPS.staking}
            />
          </div>
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-vault-muted">
            Total Staked $VAULT
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {INITIAL_GOVERNANCE_STATS.totalStakedVault.toLocaleString()}
          </p>
        </article>

        <article className="glass-panel rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-vault-cyan/20 bg-vault-cyan/5 text-vault-cyan">
              <Scale className="h-4 w-4" aria-hidden="true" />
            </div>
            <InfoTooltip
              label="How is voting power calculated?"
              content={INVESTOR_TOOLTIPS.votingPower(
                appConfig.vault.votingPowerPerDeposit,
              )}
            />
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-vault-muted">
            Your Voting Power
            <InfoTooltip
              label="What is voting power delegation?"
              content={INVESTOR_TOOLTIPS.delegation}
            />
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {userVotingPower.toLocaleString()}{" "}
            <span className="text-sm text-vault-muted">VP</span>
          </p>
          <button
            type="button"
            onClick={() => setDelegateModalOpen(true)}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800/60 px-3 py-2 text-xs text-vault-muted transition-colors hover:border-vault-cyan/30 hover:text-white sm:w-auto sm:justify-start sm:py-1.5"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delegate Voting Power
          </button>
          {delegation ? (
            <p className="mt-2 break-words text-xs text-vault-teal">
              Delegated to: {delegation.displayName}
              <span className="mt-0.5 block font-mono text-[10px] text-vault-muted">
                {truncateXrplAddress(delegation.address, 8, 6)}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-vault-muted">Self-voting (no delegate)</p>
          )}
          {syncError ? (
            <p className="mt-1 text-[11px] text-amber-200">{syncError}</p>
          ) : null}
        </article>

        <article className="glass-panel rounded-2xl p-5">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/5 text-amber-200">
            <Vote className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-vault-muted">
            Active Community Proposals
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {activeCount}
          </p>
        </article>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Active Proposals
          </p>
          <InfoTooltip
            label="What are proposals?"
            content={INVESTOR_TOOLTIPS.proposals}
          />
        </div>

        {isLoading && proposals.length === 0 ? (
          <div className="glass-panel flex items-center justify-center gap-2 rounded-2xl px-4 py-16 text-sm text-vault-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading proposals from Supabase…
          </div>
        ) : loadError && proposals.length === 0 ? (
          <div className="glass-panel rounded-2xl px-4 py-10 text-center">
            <p className="text-sm text-rose-300">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadProposals()}
              className="mt-4 text-xs text-vault-cyan hover:underline"
            >
              Retry
            </button>
          </div>
        ) : proposals.length === 0 ? (
          <p className="glass-panel rounded-2xl px-4 py-16 text-center text-sm text-vault-muted">
            No proposals yet. Submit the first community motion.
          </p>
        ) : (
          <ul className="space-y-4">
            {proposals.map((proposal) => {
              const badge = statusBadge(proposal.status);
              const canVote =
                proposal.status === "active" || proposal.status === "quorum";
              const total =
                proposal.yesVotes +
                  proposal.noVotes +
                  proposal.abstainVotes || 1;
              const yesPct = (proposal.yesVotes / total) * 100;
              const noPct = (proposal.noVotes / total) * 100;
              const abstainPct = (proposal.abstainVotes / total) * 100;
              const isVoting = votingProposalId === proposal.id;

              return (
                <li
                  key={proposal.id}
                  className="glass-panel rounded-2xl p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span className="rounded-full border border-slate-800/60 px-2.5 py-0.5 text-[11px] text-vault-muted">
                          {proposal.category}
                        </span>
                        {proposal.endsInDays > 0 ? (
                          <span className="font-mono text-[11px] text-vault-muted">
                            Ends in {proposal.endsInDays}d
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-vault-muted">
                            Voting closed
                          </span>
                        )}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-white">
                        {proposal.title}
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-vault-muted">
                        {proposal.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-vault-muted">
                      <span className="text-vault-teal">
                        Yes {yesPct.toFixed(0)}%
                      </span>
                      <span className="text-rose-300">
                        No {noPct.toFixed(0)}%
                      </span>
                      <span>Abstain {abstainPct.toFixed(0)}%</span>
                    </div>
                    <div
                      className="flex h-3 min-w-0 overflow-hidden rounded-full border border-slate-800/60 bg-vault-bg/50"
                      role="img"
                      aria-label={`Yes ${yesPct.toFixed(0)}%, No ${noPct.toFixed(0)}%, Abstain ${abstainPct.toFixed(0)}%`}
                    >
                      <div
                        className="bg-vault-teal transition-all duration-500"
                        style={{ width: `${yesPct}%` }}
                      />
                      <div
                        className="bg-rose-400/80 transition-all duration-500"
                        style={{ width: `${noPct}%` }}
                      />
                      <div
                        className="bg-slate-500/70 transition-all duration-500"
                        style={{ width: `${abstainPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!canVote || isVoting}
                      onClick={() => void handleVote(proposal.id, "yes")}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        proposal.userVote === "yes"
                          ? "border-vault-teal/40 bg-vault-teal/15 text-vault-teal"
                          : "border-slate-800/60 text-vault-muted hover:border-vault-teal/30 hover:text-vault-teal"
                      }`}
                    >
                      Vote Yes
                    </button>
                    <button
                      type="button"
                      disabled={!canVote || isVoting}
                      onClick={() => void handleVote(proposal.id, "no")}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        proposal.userVote === "no"
                          ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
                          : "border-slate-800/60 text-vault-muted hover:border-rose-400/30 hover:text-rose-300"
                      }`}
                    >
                      Vote No
                    </button>
                    <button
                      type="button"
                      disabled={!canVote || isVoting}
                      onClick={() => void handleVote(proposal.id, "abstain")}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        proposal.userVote === "abstain"
                          ? "border-slate-400/40 bg-slate-400/10 text-slate-200"
                          : "border-slate-800/60 text-vault-muted hover:border-slate-400/30 hover:text-slate-200"
                      }`}
                    >
                      Abstain
                    </button>
                    {isVoting ? (
                      <Loader2
                        className="h-4 w-4 animate-spin text-vault-cyan"
                        aria-hidden="true"
                      />
                    ) : null}
                    {proposal.userVote ? (
                      <span className="text-xs text-vault-muted">
                        Your vote:{" "}
                        <span className="text-white capitalize">
                          {proposal.userVote}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SubmitProposalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitProposal}
      />
      <DelegateVotingPowerModal
        open={delegateModalOpen}
        votingPower={
          userVotingPower || appConfig.vault.votingPowerPerDeposit
        }
        currentDelegation={delegation}
        onClose={() => setDelegateModalOpen(false)}
        onConfirm={handleDelegateConfirm}
        onRevoke={handleRevokeDelegation}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
