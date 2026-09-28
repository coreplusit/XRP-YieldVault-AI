"use client";

import Link from "next/link";
import { Loader2, Percent, RefreshCw, Timer, UserRound, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GovernanceNudgeCard } from "@/components/dashboard/GovernanceNudgeCard";
import { SecurityBadgesCard } from "@/components/dashboard/SecurityBadgesCard";
import { AccountActivationCard } from "@/components/account/AccountActivationCard";
import { DelegateVotingPowerModal } from "@/components/governance/DelegateVotingPowerModal";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import {
  OnChainProofBanner,
  type OnChainProof,
} from "@/components/vault/OnChainProofBanner";
import { DepositForm } from "@/components/vault/DepositForm";
import { useVotingDelegation } from "@/hooks/useVotingDelegation";
import { useVaultData } from "@/context/VaultDataContext";
import { useWeb3Auth } from "@/context/Web3AuthContext";
import { appConfig } from "@/lib/config/env";
import { INVESTOR_TOOLTIPS } from "@/lib/copy/investorTooltips";
import type { DelegatePresetId } from "@/lib/governance/delegation";
import {
  computeVotingPower,
  fetchGovernanceProposals,
} from "@/lib/supabase/governance";
import { truncateXrplAddress } from "@/lib/web3auth/xrpl";

/**
 * Dashboard console — vault stats + escrow deposit (profile moved to /profile).
 * Ledger data comes from VaultDataProvider cache for instant tab switches.
 */
export function DashboardClient() {
  const { isInitializing, isConnected, session, provider } = useWeb3Auth();
  const {
    balance,
    isBalanceLoading,
    stats,
    isStatsLoading,
    statsError,
    refreshAll,
    refreshBalance,
  } = useVaultData();
  const { delegation, delegate, clearDelegation } = useVotingDelegation(
    session?.dbUser?.id,
  );

  const [proof, setProof] = useState<OnChainProof | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [delegateModalOpen, setDelegateModalOpen] = useState<boolean>(false);
  const [activeProposalCount, setActiveProposalCount] = useState<number>(0);

  const activeDepositCount = stats?.activeDepositCount ?? 0;
  const userVotingPower = useMemo(
    () => computeVotingPower(activeDepositCount),
    [activeDepositCount],
  );

  useEffect(() => {
    let cancelled = false;
    const loadActiveCount = async (): Promise<void> => {
      try {
        const proposals = await fetchGovernanceProposals(session?.dbUser?.id);
        if (cancelled) return;
        setActiveProposalCount(
          proposals.filter(
            (proposal) =>
              proposal.status === "active" || proposal.status === "quorum",
          ).length,
        );
      } catch {
        if (!cancelled) setActiveProposalCount(0);
      }
    };
    if (isConnected) {
      void loadActiveCount();
    }
    return () => {
      cancelled = true;
    };
  }, [isConnected, session?.dbUser?.id]);

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

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await refreshAll(true);
      showToast("Ledger refreshed", "Balance and vault stats updated.");
    } catch {
      showToast("Refresh failed", "Could not refresh ledger data.", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshAll, showToast]);

  const handleDepositSuccess = useCallback(
    (nextProof: OnChainProof): void => {
      setProof(nextProof);
      void refreshAll(true);
      showToast(
        "Escrow validated",
        `Locked ${nextProof.amountXrp} XRP on XRPL.`,
        "success",
      );
    },
    [refreshAll, showToast],
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
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <Loader2 className="h-5 w-5 animate-spin text-vault-cyan" aria-hidden="true" />
      </div>
    );
  }

  const userId = session.dbUser?.id;
  const userXrpBalance = balance?.balanceXrp ?? null;
  const balancePending = isBalanceLoading && userXrpBalance === null;
  const showGovernanceNudge = activeDepositCount > 0 && userVotingPower > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Yield Vault
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-vault-muted">
            Deposit into native XRPL escrows on {appConfig.xrpl.network}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-full border border-slate-800/60 px-4 py-2 text-sm text-vault-muted transition-colors hover:border-vault-cyan/30 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <Link
            href="/profile"
            prefetch
            className="inline-flex items-center gap-2 rounded-full border border-slate-800/60 px-4 py-2 text-sm text-vault-muted transition-colors hover:border-vault-cyan/30 hover:text-white"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Profile & Security
          </Link>
        </div>
      </div>

      {showGovernanceNudge ? (
        <GovernanceNudgeCard
          votingPower={userVotingPower}
          activeProposalCount={activeProposalCount}
          isDelegated={Boolean(delegation)}
          delegateName={delegation?.displayName ?? null}
          onQuickDelegate={() => setDelegateModalOpen(true)}
        />
      ) : null}

      <AccountActivationCard
        xrplAddress={session.xrplAddress}
        balanceXrp={userXrpBalance}
        isBalanceLoading={isBalanceLoading}
        onCopied={() =>
          showToast(
            "Address copied",
            "Paste it in Binance / WazirX to deposit activation XRP.",
            "info",
          )
        }
        onFaucetSuccess={(amountXrp) => {
          showToast(
            "Account Activated!",
            `${amountXrp} Testnet XRP added.`,
          );
          void refreshBalance(true);
          window.setTimeout(() => void refreshBalance(true), 2500);
          window.setTimeout(() => void refreshBalance(true), 6000);
        }}
        onFaucetError={(message) => {
          showToast("Faucet funding failed", message, "error");
        }}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <article className="glass-panel rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-vault-cyan/20 bg-vault-cyan/5 text-vault-cyan">
              <Percent className="h-4 w-4" aria-hidden="true" />
            </div>
            <InfoTooltip
              label="What is the 15% APY base rate?"
              content={INVESTOR_TOOLTIPS.apyBaseRate(appConfig.vault.apyPercent)}
            />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-vault-muted">
            APY Base Rate
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {appConfig.vault.apyPercent}%
          </p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-vault-teal/20 bg-vault-teal/5 text-vault-teal">
              <Timer className="h-4 w-4" aria-hidden="true" />
            </div>
            <InfoTooltip
              label="What is escrow time-lock?"
              content={INVESTOR_TOOLTIPS.escrowTimeLock(appConfig.vault.lockDays)}
            />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-vault-muted">
            Escrow Time-Lock
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {appConfig.vault.lockDays} Days
          </p>
        </article>
        <article className="glass-panel rounded-2xl p-5">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-vault-cyan/20 bg-vault-cyan/5 text-vault-cyan">
            <Wallet className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-vault-muted">
            Total Deposited
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            {(stats?.totalDepositedXrp ?? 0).toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })}{" "}
            <span className="text-sm text-vault-muted">XRP</span>
          </p>
          <p className="mt-1 text-xs text-vault-muted">
            {isStatsLoading && !stats
              ? "Loading…"
              : `${stats?.activeDepositCount ?? 0} active escrows`}
          </p>
        </article>
      </div>

      {statsError ? (
        <p className="mb-4 text-xs text-rose-300">{statsError}</p>
      ) : null}

      <div className="mb-6">
        <SecurityBadgesCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {userId && provider ? (
          <DepositForm
            userId={userId}
            provider={provider}
            userXrpBalance={userXrpBalance}
            onDepositSuccess={handleDepositSuccess}
            onToast={showToast}
          />
        ) : (
          <div className="glass-panel rounded-2xl p-6 text-sm text-vault-muted">
            Complete Supabase user sync before depositing. Visit{" "}
            <Link href="/profile" prefetch className="text-vault-cyan underline">
              Profile
            </Link>{" "}
            or sign in again.
          </div>
        )}

        <section className="glass-panel rounded-2xl p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
            Wallet Snapshot
          </p>
          <p className="mt-3 font-mono text-sm text-white">
            {truncateXrplAddress(session.xrplAddress, 10, 8)}
          </p>
          <p className="mt-2 text-xs text-vault-muted">
            Available:{" "}
            <span className="font-mono text-vault-text">
              {balancePending
                ? "Loading…"
                : userXrpBalance === null
                  ? "—"
                  : `${userXrpBalance.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })} XRP`}
            </span>
          </p>
          <p className="mt-4 text-xs text-vault-muted">
            Fund via faucet, export keys, and view QR on the{" "}
            <Link href="/profile" prefetch className="text-vault-cyan underline">
              Profile & Security
            </Link>{" "}
            page.
          </p>
        </section>
      </div>

      {stats &&
      stats.deposits.filter((deposit) => deposit.status === "active").length >
        0 ? (
        <section className="glass-panel mt-6 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vault-cyan">
              Recent Escrows
            </p>
            <Link
              href="/history"
              prefetch
              className="text-xs text-vault-cyan hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {stats.deposits
              .filter((deposit) => deposit.status === "active")
              .slice(0, 5)
              .map((deposit) => (
                <li
                  key={deposit.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-vault-bg/40 px-3 py-2.5 text-sm"
                >
                  <span className="font-mono text-white">
                    {deposit.amount_xrp} XRP
                  </span>
                  <span className="truncate font-mono text-xs text-vault-muted">
                    {truncateXrplAddress(deposit.xrpl_tx_hash, 6, 4)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <DelegateVotingPowerModal
        open={delegateModalOpen}
        votingPower={userVotingPower || appConfig.vault.votingPowerPerDeposit}
        currentDelegation={delegation}
        onClose={() => setDelegateModalOpen(false)}
        onConfirm={handleDelegateConfirm}
        onRevoke={handleRevokeDelegation}
      />
      <OnChainProofBanner proof={proof} onDismiss={() => setProof(null)} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
