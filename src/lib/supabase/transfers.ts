import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Row shape for `public.xrp_transfers`. */
export interface XrpTransfer {
  id: string;
  user_id: string;
  xrpl_tx_hash: string;
  destination_address: string;
  destination_tag: number | null;
  amount_xrp: number;
  status: "success" | "failed";
  created_at: string;
}

export interface InsertXrpTransferInput {
  userId: string;
  xrplTxHash: string;
  destinationAddress: string;
  destinationTag?: number | null;
  amountXrp: number;
  status?: "success" | "failed";
}

/**
 * Maps a PostgREST xrp_transfers row into XrpTransfer.
 * @param row - Untrusted row from Supabase.
 */
function mapTransferRow(row: Record<string, unknown>): XrpTransfer {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    xrpl_tx_hash: String(row.xrpl_tx_hash),
    destination_address: String(row.destination_address),
    destination_tag:
      row.destination_tag === null || row.destination_tag === undefined
        ? null
        : Number(row.destination_tag),
    amount_xrp: Number(row.amount_xrp),
    status: row.status === "failed" ? "failed" : "success",
    created_at: String(row.created_at),
  };
}

/**
 * Persists a successful XRPL Payment into Supabase for Transaction History.
 * @param input - User id, hash, destination, amount.
 */
export async function insertXrpTransfer(
  input: InsertXrpTransferInput,
): Promise<XrpTransfer> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("xrp_transfers")
    .insert({
      user_id: input.userId,
      xrpl_tx_hash: input.xrplTxHash,
      destination_address: input.destinationAddress,
      destination_tag: input.destinationTag ?? null,
      amount_xrp: input.amountXrp,
      status: input.status ?? "success",
    })
    .select(
      "id, user_id, xrpl_tx_hash, destination_address, destination_tag, amount_xrp, status, created_at",
    )
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save transfer log: ${error?.message ?? "unknown error"}. ` +
        "Apply supabase/migrations/006_xrp_transfers.sql if the table is missing.",
    );
  }

  return mapTransferRow(data as Record<string, unknown>);
}

/**
 * Loads outbound XRP transfers for a user (newest first).
 * @param userId - public.users.id
 */
export async function fetchUserXrpTransfers(
  userId: string,
): Promise<XrpTransfer[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("xrp_transfers")
    .select(
      "id, user_id, xrpl_tx_hash, destination_address, destination_tag, amount_xrp, status, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    // Soft-fail when migration 006 is not applied yet — History still works.
    if (
      error.message.toLowerCase().includes("does not exist") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return [];
    }
    throw new Error(`Failed to load transfers: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapTransferRow(row as Record<string, unknown>),
  );
}
