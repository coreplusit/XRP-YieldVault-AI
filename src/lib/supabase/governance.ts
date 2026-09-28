import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { appConfig } from "@/lib/config/env";
import {
  COMMUNITY_DELEGATES,
  type DelegatePresetId,
  type VotingDelegation,
} from "@/lib/governance/delegation";

/** DB proposal status values from migration 004. */
export type DbProposalStatus =
  | "active"
  | "passed"
  | "rejected"
  | "quorum_reached";

/** UI-facing status (maps quorum_reached → quorum). */
export type UiProposalStatus = "active" | "passed" | "rejected" | "quorum";

export type VoteOption = "yes" | "no" | "abstain";

export type ProposalCategory =
  | "Yield Strategy"
  | "Fees"
  | "Treasury"
  | "Parameter"
  | "Other";

export type DbDelegateType =
  | "ai_delegate"
  | "community_delegate"
  | "custom_address";

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  category: string;
  status: UiProposalStatus;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  endsAt: string;
  endsInDays: number;
  userVote: VoteOption | null;
}

export interface SubmitProposalInput {
  title: string;
  category: string;
  description: string;
  durationDays: number;
}

export interface CastVoteInput {
  proposalId: string;
  userId: string;
  voteOption: VoteOption;
  votingPower: number;
}

export interface UpsertDelegationInput {
  userId: string;
  presetId: DelegatePresetId;
  address: string;
}

/**
 * Maps DB status to UI badge status.
 * @param status - Raw proposals.status value.
 */
export function mapDbStatusToUi(status: string): UiProposalStatus {
  if (status === "quorum_reached") return "quorum";
  if (status === "passed") return "passed";
  if (status === "rejected") return "rejected";
  return "active";
}

/**
 * Days remaining until ends_at (floored, min 0).
 * @param endsAt - ISO timestamp.
 */
export function daysUntil(endsAt: string): number {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return 0;
  const diffMs = end - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Computes Voting Power from active escrow deposit count.
 * @param activeDepositCount - Count of active vault_deposits rows.
 */
export function computeVotingPower(activeDepositCount: number): number {
  if (!Number.isFinite(activeDepositCount) || activeDepositCount <= 0) {
    return 0;
  }
  return activeDepositCount * appConfig.vault.votingPowerPerDeposit;
}

/**
 * Maps UI preset id → DB delegate_type.
 * @param presetId - Local preset identifier.
 */
export function presetToDbDelegateType(
  presetId: DelegatePresetId,
): DbDelegateType {
  if (presetId === "custom") return "custom_address";
  if (presetId === "treasury-ai") return "ai_delegate";
  return "community_delegate";
}

/**
 * Reconstructs a VotingDelegation view-model from a DB row.
 * @param delegateType - DB delegate_type.
 * @param delegateAddress - Stored XRPL / persona address.
 * @param updatedAt - Row updated_at.
 */
export function delegationFromDbRow(
  delegateType: string,
  delegateAddress: string | null,
  updatedAt: string,
): VotingDelegation | null {
  const address = (delegateAddress ?? "").trim();
  if (!address && delegateType !== "custom_address") {
    return null;
  }

  if (delegateType === "custom_address") {
    if (!address) return null;
    return {
      presetId: "custom",
      displayName: "Custom XRPL Delegate",
      address,
      delegatedAt: updatedAt,
    };
  }

  const preset = COMMUNITY_DELEGATES.find((item) => item.address === address);
  if (preset) {
    return {
      presetId: preset.id,
      displayName: preset.name,
      address: preset.address,
      delegatedAt: updatedAt,
    };
  }

  if (delegateType === "ai_delegate") {
    const ai = COMMUNITY_DELEGATES.find((item) => item.id === "treasury-ai");
    return {
      presetId: "treasury-ai",
      displayName: ai?.name ?? "Treasury Strategy AI Delegate",
      address: address || ai?.address || "",
      delegatedAt: updatedAt,
    };
  }

  return {
    presetId: "yield-community",
    displayName: "Community Delegate",
    address,
    delegatedAt: updatedAt,
  };
}

/**
 * Maps a proposals row (+ optional user vote) into UI GovernanceProposal.
 * @param row - Raw proposal row.
 * @param userVote - Current user's vote option if any.
 */
function mapProposalRow(
  row: Record<string, unknown>,
  userVote: VoteOption | null,
): GovernanceProposal {
  const endsAt = String(row.ends_at);
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    category: String(row.category),
    status: mapDbStatusToUi(String(row.status)),
    yesVotes: Number(row.yes_votes) || 0,
    noVotes: Number(row.no_votes) || 0,
    abstainVotes: Number(row.abstain_votes) || 0,
    endsAt,
    endsInDays: daysUntil(endsAt),
    userVote,
  };
}

/**
 * Fetches all proposals and attaches the current user's votes when userId set.
 * @param userId - Optional public.users.id for vote hydration.
 */
export async function fetchGovernanceProposals(
  userId?: string | null,
): Promise<GovernanceProposal[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("proposals")
    .select(
      "id, title, category, description, status, yes_votes, no_votes, abstain_votes, created_at, ends_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load proposals: ${error.message}. Apply supabase/migrations/004_dao_governance.sql if missing.`,
    );
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const voteByProposal = new Map<string, VoteOption>();

  if (userId && rows.length > 0) {
    const ids = rows.map((row) => String(row.id));
    const { data: votes, error: votesError } = await supabase
      .from("user_votes")
      .select("proposal_id, vote_option")
      .eq("user_id", userId)
      .in("proposal_id", ids);

    if (votesError) {
      throw new Error(`Failed to load user votes: ${votesError.message}`);
    }

    for (const vote of votes ?? []) {
      const record = vote as Record<string, unknown>;
      const option = String(record.vote_option) as VoteOption;
      if (option === "yes" || option === "no" || option === "abstain") {
        voteByProposal.set(String(record.proposal_id), option);
      }
    }
  }

  return rows.map((row) =>
    mapProposalRow(row, voteByProposal.get(String(row.id)) ?? null),
  );
}

/**
 * Inserts a new active proposal with ends_at = now + durationDays.
 * @param input - Title, category, description, duration.
 */
export async function insertGovernanceProposal(
  input: SubmitProposalInput,
): Promise<GovernanceProposal> {
  const supabase = getSupabaseBrowserClient();
  const endsAt = new Date(
    Date.now() + input.durationDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      title: input.title,
      category: input.category,
      description: input.description,
      status: "active",
      yes_votes: 0,
      no_votes: 0,
      abstain_votes: 0,
      ends_at: endsAt,
    })
    .select(
      "id, title, category, description, status, yes_votes, no_votes, abstain_votes, created_at, ends_at",
    )
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to submit proposal: ${error?.message ?? "unknown error"}`,
    );
  }

  return mapProposalRow(data as Record<string, unknown>, null);
}

/**
 * Casts or changes a vote via atomic RPC (migration 005).
 * Upserts user_votes and adjusts proposal tallies in one transaction.
 * Enforces one vote per user via UNIQUE(proposal_id, user_id).
 * @param input - Proposal, user, option, and VP weight.
 */
export async function castGovernanceVote(
  input: CastVoteInput,
): Promise<GovernanceProposal> {
  if (input.votingPower <= 0) {
    throw new Error(
      "You need active escrow deposits to cast Voting Power. Deposit from the Dashboard first.",
    );
  }

  const supabase = getSupabaseBrowserClient();
  const vp = Number(input.votingPower);

  const { data, error } = await supabase.rpc("cast_governance_vote", {
    p_proposal_id: input.proposalId,
    p_user_id: input.userId,
    p_vote_option: input.voteOption,
    p_voting_power: vp,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "You already voted on this proposal. Refresh and try changing your vote.",
      );
    }
    const message = error.message ?? "unknown error";
    if (
      message.includes("Could not find the function") ||
      (message.includes("cast_governance_vote") &&
        message.toLowerCase().includes("schema cache"))
    ) {
      throw new Error(
        `Vote RPC missing: apply supabase/migrations/005_cast_governance_vote_rpc.sql. (${message})`,
      );
    }
    throw new Error(`Failed to cast vote: ${message}`);
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as Record<
    string,
    unknown
  >[];
  const row = rows[0];
  if (!row) {
    throw new Error("Vote succeeded but no proposal row was returned.");
  }

  const userVoteRaw = String(row.user_vote ?? input.voteOption);
  const userVote: VoteOption =
    userVoteRaw === "yes" || userVoteRaw === "no" || userVoteRaw === "abstain"
      ? userVoteRaw
      : input.voteOption;

  return mapProposalRow(row, userVote);
}

/**
 * Loads the user's persisted delegation from user_delegations.
 * @param userId - public.users.id.
 */
export async function fetchUserDelegation(
  userId: string,
): Promise<VotingDelegation | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("user_delegations")
    .select("user_id, delegate_type, delegate_address, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load delegation: ${error.message}`);
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return delegationFromDbRow(
    String(row.delegate_type),
    row.delegate_address === null || row.delegate_address === undefined
      ? null
      : String(row.delegate_address),
    String(row.updated_at),
  );
}

/**
 * Upserts voting-power delegation for a user.
 * @param input - User id, preset, and address.
 */
export async function upsertUserDelegation(
  input: UpsertDelegationInput,
): Promise<VotingDelegation> {
  const supabase = getSupabaseBrowserClient();
  const delegateType = presetToDbDelegateType(input.presetId);

  const { data, error } = await supabase
    .from("user_delegations")
    .upsert(
      {
        user_id: input.userId,
        delegate_type: delegateType,
        delegate_address: input.address,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id, delegate_type, delegate_address, updated_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save delegation: ${error?.message ?? "unknown error"}`,
    );
  }

  const row = data as Record<string, unknown>;
  const mapped = delegationFromDbRow(
    String(row.delegate_type),
    row.delegate_address === null || row.delegate_address === undefined
      ? null
      : String(row.delegate_address),
    String(row.updated_at),
  );

  if (!mapped) {
    throw new Error("Delegation saved but could not be mapped for display.");
  }
  return mapped;
}

/**
 * Removes the user's delegation row.
 * @param userId - public.users.id.
 */
export async function deleteUserDelegation(userId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("user_delegations")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to revoke delegation: ${error.message}`);
  }
}
