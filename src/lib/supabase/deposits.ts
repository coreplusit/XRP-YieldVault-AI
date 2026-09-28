import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type VaultDepositStatus = "active" | "unlocked" | "claimed";

/** Row shape for `public.vault_deposits`. */
export interface VaultDeposit {
  id: string;
  user_id: string;
  xrpl_tx_hash: string;
  amount_xrp: number;
  escrow_condition: string | null;
  status: VaultDepositStatus;
  created_at: string;
}

export interface InsertVaultDepositInput {
  userId: string;
  amountXrp: number;
  xrplTxHash: string;
  escrowCondition?: string | null;
  status?: VaultDepositStatus;
}

export interface VaultDepositStats {
  totalDepositedXrp: number;
  activeDepositCount: number;
  deposits: VaultDeposit[];
}

/**
 * Maps a raw Supabase vault_deposits row into a typed VaultDeposit.
 * @param row - Untrusted row from PostgREST.
 */
function mapDepositRow(row: Record<string, unknown>): VaultDeposit {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    xrpl_tx_hash: String(row.xrpl_tx_hash),
    amount_xrp: Number(row.amount_xrp),
    escrow_condition:
      row.escrow_condition === null || row.escrow_condition === undefined
        ? null
        : String(row.escrow_condition),
    status: row.status as VaultDepositStatus,
    created_at: String(row.created_at),
  };
}

/**
 * Inserts a validated on-chain escrow deposit into Supabase.
 * @param input - User id, XRP amount, and XRPL transaction hash.
 */
export async function insertVaultDeposit(
  input: InsertVaultDepositInput,
): Promise<VaultDeposit> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("vault_deposits")
    .insert({
      user_id: input.userId,
      amount_xrp: input.amountXrp,
      xrpl_tx_hash: input.xrplTxHash,
      escrow_condition: input.escrowCondition ?? null,
      status: input.status ?? "active",
    })
    .select(
      "id, user_id, xrpl_tx_hash, amount_xrp, escrow_condition, status, created_at",
    )
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save vault deposit: ${error?.message ?? "unknown error"}. ` +
        "Apply supabase/migrations/003_vault_deposits_write_policy.sql if RLS blocks inserts.",
    );
  }

  return mapDepositRow(data as Record<string, unknown>);
}

/**
 * Fetches all vault deposits and aggregate stats for a user.
 * Includes active + matured/claimed rows so History filters work end-to-end.
 * @param userId - Supabase `users.id`.
 */
export async function getVaultDepositStats(
  userId: string,
): Promise<VaultDepositStats> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("vault_deposits")
    .select(
      "id, user_id, xrpl_tx_hash, amount_xrp, escrow_condition, status, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load vault deposits: ${error.message}`);
  }

  const deposits = (data ?? []).map((row) =>
    mapDepositRow(row as Record<string, unknown>),
  );

  const activeDeposits = deposits.filter((deposit) => deposit.status === "active");
  const totalDepositedXrp = activeDeposits.reduce(
    (sum, deposit) => sum + deposit.amount_xrp,
    0,
  );

  return {
    totalDepositedXrp,
    activeDepositCount: activeDeposits.length,
    deposits,
  };
}
