/**
 * Display-only governance constants (totals not yet derived from ledger).
 * Proposal/vote types live in `@/lib/supabase/governance`.
 */

export interface GovernanceStats {
  totalStakedVault: number;
  userVotingPower: number;
  activeProposalCount: number;
}

/** Placeholder TVL-style metric until $VAULT staking is on-chain. */
export const INITIAL_GOVERNANCE_STATS: GovernanceStats = {
  totalStakedVault: 1_250_000,
  userVotingPower: 100,
  activeProposalCount: 2,
};
