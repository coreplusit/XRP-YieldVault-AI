"use client";

import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { CopyButton } from "@/components/ui/CopyButton";
import { TableSkeleton } from "@/components/ui/PageSkeleton";
import { useWeb3Auth } from "@/context/Web3AuthContext";
import {
  buildSampleInitializationEvents,
  fetchUserActivityTimeline,
  type ActivityActionType,
  type ActivityLogItem,
} from "@/lib/supabase/activity";
import { syncIncomingXrpTransfers } from "@/lib/supabase/transfers";
import { truncateTxHash, truncateXrplAddress } from "@/lib/web3auth/xrpl";
import {
  fetchAccountTransactions,
  mergeLedgerIntoActivity,
} from "@/lib/xrpl/accountTransactions";
import { getXrplExplorerTxUrl } from "@/lib/xrpl/escrow";

type HistoryFilter =
  | "all"
  | "deposit"
  | "sent"
  | "received"
  | "unlock"
  | "vote"
  | "delegation"
  | "sample";

const FILTERS: readonly { id: HistoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "received", label: "Received" },
  { id: "sent", label: "Sent" },
  { id: "deposit", label: "Escrow" },
  { id: "unlock", label: "Unlocks" },
  { id: "vote", label: "DAO Votes" },
  { id: "delegation", label: "Delegation" },
  { id: "sample", label: "Init" },
] as const;

/**
 * Maps an action type onto the History filter tabs.
 * @param item - Timeline row.
 * @param filter - Active filter tab.
 */
function matchesFilter(
  item: ActivityLogItem,
  filter: HistoryFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "deposit") return item.actionType === "Deposit";
  if (filter === "sent") {
    return item.actionType === "Sent" || item.actionType === "Withdraw";
  }
  if (filter === "received") return item.actionType === "Received";
  if (filter === "unlock") return item.actionType === "Escrow Unlock";
  if (filter === "vote") return item.actionType === "DAO Vote";
  if (filter === "delegation") return item.actionType === "Delegation";
  return item.source === "sample";
}

/**
 * Badge styles for action type chips.
 * @param actionType - Unified activity action.
 */
function actionBadgeClass(actionType: ActivityActionType): string {
  if (actionType === "Received") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  }
  if (actionType === "Sent" || actionType === "Withdraw") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  }
  if (actionType === "Deposit") {
    return "border-vault-teal/30 bg-vault-teal/10 text-vault-teal";
  }
  if (actionType === "Escrow Unlock") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  if (actionType === "DAO Vote") {
    return "border-vault-cyan/30 bg-vault-cyan/10 text-vault-cyan";
  }
  if (actionType === "Delegation") {
    return "border-violet-400/30 bg-violet-400/10 text-violet-200";
  }
  return "border-slate-500/40 bg-slate-500/10 text-slate-300";
}

/**
 * User-facing type label for the history table.
 * @param actionType - Unified activity action.
 */
function typeLabel(actionType: ActivityActionType): string {
  if (actionType === "Deposit") return "Escrow Deposit";
  if (actionType === "Sent" || actionType === "Withdraw") return "Sent";
  if (actionType === "Received") return "Received";
  return actionType;
}

/**
 * Transaction History — XRPL account_tx payments merged with Supabase logs.
 */
export function HistoryClient() {
  const { isConnected, isInitializing, session, ensureDbUser } =
    useWeb3Auth();

  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [liveCount, setLiveCount] = useState<number>(0);
  const [usedSampleFallback, setUsedSampleFallback] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [isFilterPending, startFilterTransition] = useTransition();

  const loadActivity = useCallback(async (): Promise<void> => {
    setLoadError(null);

    let userId = session?.dbUser?.id ?? null;
    let createdAt = session?.dbUser?.created_at ?? undefined;

    if (!userId) {
      const synced = await ensureDbUser();
      userId = synced?.id ?? null;
      createdAt = synced?.created_at ?? createdAt;
    }

    if (!userId) {
      const samples = buildSampleInitializationEvents(
        new Date().toISOString(),
      );
      setItems(samples);
      setLiveCount(0);
      setUsedSampleFallback(true);
      setSyncWarning(
        "Supabase user sync is still pending. Apply supabase/migrations/002_web3auth_user_sync_policy.sql in the SQL Editor if RLS blocks inserts, then hit Refresh Logs.",
      );
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setSyncWarning(null);
    try {
      const result = await fetchUserActivityTimeline(userId, {
        getExplorerTxUrl: getXrplExplorerTxUrl,
        accountCreatedAt: createdAt,
      });
      let nextItems = result.items;
      const address = session?.xrplAddress;
      if (address) {
        try {
          const ledger = await fetchAccountTransactions(address);
          nextItems = mergeLedgerIntoActivity(
            result.items,
            ledger,
            getXrplExplorerTxUrl,
          );
          const knownHashes = new Set(
            result.items
              .map((item) => item.txHash)
              .filter((hash): hash is string => Boolean(hash)),
          );
          await syncIncomingXrpTransfers(
            userId,
            ledger
              .filter((entry) => entry.kind === "received" && entry.counterparty)
              .map((entry) => ({
                hash: entry.hash,
                counterparty: entry.counterparty ?? "",
                amountXrp: entry.amountXrp,
                occurredAt: entry.occurredAt,
              })),
            knownHashes,
          );
        } catch (ledgerError: unknown) {
          setSyncWarning(
            ledgerError instanceof Error
              ? `On-chain history is unavailable (${ledgerError.message}). Showing saved logs.`
              : "On-chain history is unavailable. Showing saved logs.",
          );
        }
      }
      const liveItems = nextItems.filter((item) => item.source === "live");
      setItems(liveItems.length > 0 ? liveItems : nextItems);
      setLiveCount(liveItems.length);
      setUsedSampleFallback(liveItems.length === 0);
    } catch (fetchError: unknown) {
      setLoadError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load transaction history.",
      );
      setItems([]);
      setLiveCount(0);
      setUsedSampleFallback(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [
    ensureDbUser,
    session?.dbUser?.created_at,
    session?.dbUser?.id,
    session?.xrplAddress,
  ]);

  useEffect(() => {
    if (!isConnected) return;
    setIsLoading(true);
    void loadActivity();
  }, [isConnected, loadActivity]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    await loadActivity();
  }, [loadActivity]);

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [filter, items],
  );

  const filterCounts = useMemo(() => {
    return {
      all: items.length,
      deposit: items.filter((item) => item.actionType === "Deposit").length,
      sent: items.filter(
        (item) => item.actionType === "Sent" || item.actionType === "Withdraw",
      ).length,
      received: items.filter((item) => item.actionType === "Received").length,
      unlock: items.filter((item) => item.actionType === "Escrow Unlock")
        .length,
      vote: items.filter((item) => item.actionType === "DAO Vote").length,
      delegation: items.filter((item) => item.actionType === "Delegation")
        .length,
      sample: items.filter((item) => item.source === "sample").length,
    };
  }, [items]);

  if (isInitializing || !isConnected) {
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
            Ledger
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Transaction History
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-vault-muted">
            Live XRPL payments (sent and received), escrow deposits, and DAO
            activity for this wallet. Incoming transfers are saved to your
            transaction log on load.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing || isLoading}
          className="inline-flex items-center gap-2 rounded-full border border-slate-800/60 px-4 py-2 text-sm text-vault-muted transition-colors hover:border-vault-cyan/30 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing || isLoading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh Logs
        </button>
      </div>

      {syncWarning ? (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-xs text-amber-100">
          <p>{syncWarning}</p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="mt-2 text-vault-cyan hover:underline"
          >
            Retry sync
          </button>
        </div>
      ) : null}

      {usedSampleFallback && !syncWarning ? (
        <p className="mb-4 rounded-xl border border-slate-800/60 bg-vault-surface/40 px-4 py-3 text-xs text-vault-muted">
          No on-chain or governance activity yet — showing sample initialization
          events. Deposit XRP or vote in Governance to replace these with live
          logs.
        </p>
      ) : null}

      <div
        className="mb-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Activity type filter"
      >
        {FILTERS.map((item) => {
          const active = filter === item.id;
          if (item.id === "sample" && filterCounts.sample === 0) {
            return null;
          }
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                startFilterTransition(() => {
                  setFilter(item.id);
                });
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                active
                  ? "border-vault-teal/40 bg-vault-teal/10 text-white"
                  : "border-slate-800/60 text-vault-muted hover:border-vault-cyan/30 hover:text-white"
              }`}
            >
              {item.label}
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                  active
                    ? "bg-vault-teal/20 text-vault-teal"
                    : "bg-slate-800/80 text-vault-muted"
                }`}
              >
                {filterCounts[item.id]}
              </span>
            </button>
          );
        })}
      </div>

      <section
        className={`glass-panel overflow-hidden rounded-2xl ${
          isFilterPending ? "opacity-70" : ""
        }`}
      >
        {isLoading && items.length === 0 ? (
          <TableSkeleton rows={6} />
        ) : loadError && items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-rose-300">{loadError}</p>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="mt-4 text-xs text-vault-cyan hover:underline"
            >
              Retry
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-vault-muted">
            No {filter === "all" ? "" : `${filter} `}activity to show
            {liveCount > 0 ? " for this filter." : "."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800/60 bg-vault-bg/50 text-[10px] uppercase tracking-wider text-vault-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Amount (XRP)</th>
                  <th className="px-4 py-3 font-medium">Counterparty</th>
                  <th className="px-4 py-3 font-medium">Transaction Hash</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-800/40 last:border-0"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-vault-muted">
                      {new Date(item.occurredAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${actionBadgeClass(item.actionType)}`}
                      >
                        {typeLabel(item.actionType)}
                      </span>
                    </td>
                    <td className="max-w-[14rem] px-4 py-3 text-xs">
                      <span
                        className={`line-clamp-2 font-mono ${
                          item.flow === "in"
                            ? "text-emerald-300"
                            : item.flow === "out"
                              ? "text-amber-200"
                              : "text-white"
                        }`}
                      >
                        {item.detail}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-vault-muted">
                      {item.counterparty ? (
                        <span title={item.counterparty}>
                          {item.flow === "in" ? "From " : item.flow === "out" ? "To " : ""}
                          {truncateXrplAddress(item.counterparty, 6, 4)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.txHash ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-vault-muted">
                            {truncateTxHash(item.txHash)}
                          </span>
                          <CopyButton
                            value={item.txHash}
                            label="Copy"
                            className="shrink-0"
                          />
                          {item.explorerUrl ? (
                            <a
                              href={item.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-vault-cyan/30 bg-vault-cyan/5 px-2.5 py-1.5 text-xs text-vault-cyan transition-colors hover:bg-vault-cyan/10"
                            >
                              Explorer
                              <ExternalLink
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-vault-muted">
                          {item.source === "sample"
                            ? "Off-chain (sample)"
                            : "Off-chain (Supabase)"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
