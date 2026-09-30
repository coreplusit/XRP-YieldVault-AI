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
  /** Present after migration 007. Legacy rows are outgoing. */
  direction: "sent" | "received";
  counterparty_address: string | null;
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
    direction: row.direction === "received" ? "received" : "sent",
    counterparty_address:
      typeof row.counterparty_address === "string"
        ? row.counterparty_address
        : null,
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
      "id, user_id, xrpl_tx_hash, destination_address, destination_tag, amount_xrp, status, created_at, direction, counterparty_address",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const message = error.message.toLowerCase();
    // Soft-fail when migration 006 is not applied yet — History still works.
    if (
      message.includes("does not exist") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return [];
    }
    // Migration 007 not applied yet — reload without the new columns.
    if (
      message.includes("direction") ||
      message.includes("counterparty_address") ||
      error.code === "42703"
    ) {
      const legacy = await supabase
        .from("xrp_transfers")
        .select(
          "id, user_id, xrpl_tx_hash, destination_address, destination_tag, amount_xrp, status, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (legacy.error) {
        throw new Error(`Failed to load transfers: ${legacy.error.message}`);
      }
      return (legacy.data ?? []).map((row) =>
        mapTransferRow(row as Record<string, unknown>),
      );
    }
    throw new Error(`Failed to load transfers: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapTransferRow(row as Record<string, unknown>),
  );
}

export interface IncomingTransferLog {
  hash: string;
  counterparty: string;
  amountXrp: number;
  occurredAt: string;
}

/**
 * Inserts incoming Payments that are on the ledger but missing from xrp_transfers.
 * Duplicate hashes are ignored. Schema-without-direction falls back to a legacy insert.
 * @param userId - public.users.id
 * @param incoming - Received payments parsed from account_tx.
 * @param knownHashes - Hashes already stored for this user.
 */
export async function syncIncomingXrpTransfers(
  userId: string,
  incoming: readonly IncomingTransferLog[],
  knownHashes: ReadonlySet<string>,
): Promise<void> {
  const missing = incoming.filter(
    (entry) => entry.hash && !knownHashes.has(entry.hash),
  );
  if (missing.length === 0) return;

  const supabase = getSupabaseBrowserClient();
  const rows = missing.map((entry) => ({
    user_id: userId,
    xrpl_tx_hash: entry.hash,
    destination_address: entry.counterparty,
    destination_tag: null,
    amount_xrp: entry.amountXrp,
    status: "success" as const,
    created_at: entry.occurredAt,
    direction: "received" as const,
    counterparty_address: entry.counterparty,
  }));

  const primary = await supabase
    .from("xrp_transfers")
    .upsert(rows, { onConflict: "xrpl_tx_hash", ignoreDuplicates: true });

  if (!primary.error) return;

  const message = primary.error.message.toLowerCase();
  const missingColumn =
    message.includes("direction") ||
    message.includes("counterparty_address") ||
    primary.error.code === "42703";
  if (!missingColumn) {
    console.warn(
      "[History] Incoming transfer sync skipped:",
      primary.error.message,
    );
    return;
  }

  const legacyRows = rows.map(
    ({ direction: _direction, counterparty_address: _counterparty, ...row }) =>
      row,
  );
  const legacy = await supabase
    .from("xrp_transfers")
    .upsert(legacyRows, { onConflict: "xrpl_tx_hash", ignoreDuplicates: true });
  if (legacy.error) {
    console.warn(
      "[History] Incoming transfer sync skipped:",
      legacy.error.message,
    );
  }
}
