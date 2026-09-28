import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { delegationFromDbRow } from "@/lib/supabase/governance";
import { fetchUserXrpTransfers } from "@/lib/supabase/transfers";

/** Unified activity action types for the Transaction History timeline. */
export type ActivityActionType =
  | "Deposit"
  | "Escrow Unlock"
  | "DAO Vote"
  | "Delegation"
  | "Withdraw"
  | "Account Created"
  | "Faucet";

export type ActivityStatus = "Validated" | "Success" | "Active" | "Sample";

export type ActivitySource = "live" | "sample";

/** One row in the unified investor activity timeline. */
export interface ActivityLogItem {
  id: string;
  occurredAt: string;
  actionType: ActivityActionType;
  /** Human-readable amount / VP / meta (e.g. "100 XRP", "10 VP · Yes"). */
  detail: string;
  status: ActivityStatus;
  /** XRPL tx hash when on-chain; null for off-chain / sample events. */
  txHash: string | null;
  /** Explorer URL when txHash is present. */
  explorerUrl: string | null;
  source: ActivitySource;
}

export interface UserActivityResult {
  items: ActivityLogItem[];
  liveCount: number;
  usedSampleFallback: boolean;
}

/**
 * Sample initialization events so new accounts never see an empty table.
 * @param createdAtIso - Anchor timestamp (usually user sync / now).
 */
export function buildSampleInitializationEvents(
  createdAtIso?: string,
): ActivityLogItem[] {
  const base = createdAtIso ? new Date(createdAtIso).getTime() : Date.now();
  const accountAt = new Date(base - 60_000).toISOString();
  const faucetAt = new Date(base - 30_000).toISOString();

  return [
    {
      id: "sample-account-created",
      occurredAt: accountAt,
      actionType: "Account Created",
      detail: "Account Created via Web3Auth",
      status: "Sample",
      txHash: null,
      explorerUrl: null,
      source: "sample",
    },
    {
      id: "sample-faucet-1000",
      occurredAt: faucetAt,
      actionType: "Faucet",
      detail: "Testnet Faucet Received 1000 XRP",
      status: "Sample",
      txHash: null,
      explorerUrl: null,
      source: "sample",
    },
  ];
}

/**
 * Loads vault deposits, DAO votes, and delegations for a user into one timeline.
 * Falls back to sample init events when the user has no live activity yet.
 * @param userId - public.users.id
 * @param options - Optional explorer URL builder + account created timestamp.
 */
export async function fetchUserActivityTimeline(
  userId: string,
  options?: {
    getExplorerTxUrl?: (txHash: string) => string;
    accountCreatedAt?: string | null;
  },
): Promise<UserActivityResult> {
  const supabase = getSupabaseBrowserClient();
  const getExplorerTxUrl = options?.getExplorerTxUrl;
  const items: ActivityLogItem[] = [];

  const [depositsRes, votesRes, delegationRes, transfers] = await Promise.all([
    supabase
      .from("vault_deposits")
      .select(
        "id, user_id, xrpl_tx_hash, amount_xrp, status, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_votes")
      .select("id, proposal_id, vote_option, voting_power, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_delegations")
      .select("user_id, delegate_type, delegate_address, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    fetchUserXrpTransfers(userId),
  ]);

  if (depositsRes.error) {
    throw new Error(
      `Failed to load deposits for history: ${depositsRes.error.message}`,
    );
  }
  if (votesRes.error) {
    throw new Error(
      `Failed to load votes for history: ${votesRes.error.message}`,
    );
  }
  if (delegationRes.error) {
    throw new Error(
      `Failed to load delegations for history: ${delegationRes.error.message}`,
    );
  }

  const voteRows = (votesRes.data ?? []) as Record<string, unknown>[];
  const proposalTitles = new Map<string, string>();
  if (voteRows.length > 0) {
    const proposalIds = [
      ...new Set(voteRows.map((row) => String(row.proposal_id))),
    ];
    const { data: proposals } = await supabase
      .from("proposals")
      .select("id, title")
      .in("id", proposalIds);
    for (const proposal of proposals ?? []) {
      const record = proposal as Record<string, unknown>;
      proposalTitles.set(String(record.id), String(record.title));
    }
  }

  for (const row of depositsRes.data ?? []) {
    const record = row as Record<string, unknown>;
    const status = String(record.status);
    const txHash = String(record.xrpl_tx_hash);
    const amount = Number(record.amount_xrp) || 0;
    const isUnlock = status === "unlocked" || status === "claimed";

    items.push({
      id: `deposit-${String(record.id)}`,
      occurredAt: String(record.created_at),
      actionType: isUnlock ? "Escrow Unlock" : "Deposit",
      detail: `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} XRP`,
      status: isUnlock ? "Success" : "Validated",
      txHash,
      explorerUrl: getExplorerTxUrl ? getExplorerTxUrl(txHash) : null,
      source: "live",
    });
  }

  for (const record of voteRows) {
    const voteOption = String(record.vote_option);
    const votingPower = Number(record.voting_power) || 0;
    const proposalTitle = proposalTitles.get(String(record.proposal_id));
    const titlePart = proposalTitle ? ` · ${proposalTitle}` : "";

    items.push({
      id: `vote-${String(record.id)}`,
      occurredAt: String(record.created_at),
      actionType: "DAO Vote",
      detail: `${votingPower.toLocaleString()} VP · ${voteOption}${titlePart}`,
      status: "Success",
      txHash: null,
      explorerUrl: null,
      source: "live",
    });
  }

  if (delegationRes.data) {
    const record = delegationRes.data as Record<string, unknown>;
    const mapped = delegationFromDbRow(
      String(record.delegate_type),
      record.delegate_address === null || record.delegate_address === undefined
        ? null
        : String(record.delegate_address),
      String(record.updated_at),
    );
    items.push({
      id: `delegation-${String(record.user_id)}`,
      occurredAt: String(record.updated_at),
      actionType: "Delegation",
      detail: mapped
        ? `VP → ${mapped.displayName}`
        : `VP delegated (${String(record.delegate_type)})`,
      status: "Success",
      txHash: null,
      explorerUrl: null,
      source: "live",
    });
  }

  for (const transfer of transfers) {
    const tagPart =
      transfer.destination_tag !== null
        ? ` · tag ${transfer.destination_tag}`
        : "";
    items.push({
      id: `transfer-${transfer.id}`,
      occurredAt: transfer.created_at,
      actionType: "Withdraw",
      detail: `${transfer.amount_xrp.toLocaleString(undefined, {
        maximumFractionDigits: 6,
      })} XRP → ${transfer.destination_address.slice(0, 8)}…${tagPart}`,
      status: transfer.status === "success" ? "Success" : "Validated",
      txHash: transfer.xrpl_tx_hash,
      explorerUrl: getExplorerTxUrl
        ? getExplorerTxUrl(transfer.xrpl_tx_hash)
        : null,
      source: "live",
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  const liveCount = items.length;
  if (liveCount === 0) {
    const samples = buildSampleInitializationEvents(
      options?.accountCreatedAt ?? undefined,
    );
    return {
      items: samples,
      liveCount: 0,
      usedSampleFallback: true,
    };
  }

  return {
    items,
    liveCount,
    usedSampleFallback: false,
  };
}
