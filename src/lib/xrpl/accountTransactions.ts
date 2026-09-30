import { Client, dropsToXrp, rippleTimeToISOTime } from "xrpl";

import { appConfig } from "@/lib/config/env";
import type { ActivityLogItem } from "@/lib/supabase/activity";

export type LedgerActivityKind = "sent" | "received" | "escrow";

/** One validated XRPL Payment or EscrowCreate involving the user's account. */
export interface LedgerActivity {
  hash: string;
  kind: LedgerActivityKind;
  amountXrp: number;
  /** Sender for incoming payments, destination for outgoing, null for self-escrow. */
  counterparty: string | null;
  occurredAt: string;
}

interface AccountTxEntry {
  tx?: Record<string, unknown>;
  tx_json?: Record<string, unknown>;
  hash?: string;
  meta?: Record<string, unknown> | string;
  validated?: boolean;
  close_time_iso?: string;
}

/**
 * Reads a native XRP drops string. Issued-currency amounts are objects and are skipped.
 * @param value - XRPL Amount field or delivered_amount.
 */
function readDrops(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  return null;
}

/**
 * Converts drops to a finite XRP number.
 * @param drops - Integer drops string.
 */
function dropsToXrpNumber(drops: string): number | null {
  const xrp = Number(dropsToXrp(drops));
  if (!Number.isFinite(xrp) || xrp <= 0) return null;
  return xrp;
}

/**
 * Formats an XRP amount for the history amount column.
 * @param amountXrp - Positive XRP value.
 * @param kind - Payment direction or escrow.
 */
export function formatLedgerAmount(
  amountXrp: number,
  kind: LedgerActivityKind,
): string {
  const formatted = amountXrp.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
  if (kind === "received") return `+${formatted} XRP`;
  if (kind === "sent") return `-${formatted} XRP`;
  return `${formatted} XRP`;
}

/**
 * Parses one account_tx row into a payment or escrow activity item.
 * @param entry - Raw account_tx transaction wrapper.
 * @param account - Logged-in classic address.
 */
function parseAccountTxEntry(
  entry: AccountTxEntry,
  account: string,
): LedgerActivity | null {
  if (entry.validated === false) return null;

  const body = entry.tx_json ?? entry.tx ?? {};
  const meta =
    typeof entry.meta === "object" && entry.meta !== null ? entry.meta : null;
  const engineResult =
    typeof entry.meta === "string"
      ? entry.meta
      : typeof meta?.TransactionResult === "string"
        ? meta.TransactionResult
        : null;
  if (engineResult && engineResult !== "tesSUCCESS") return null;

  const transactionType = String(body.TransactionType ?? "");
  const hash = String(entry.hash ?? body.hash ?? "");
  if (!hash) return null;

  const drops =
    readDrops(meta?.delivered_amount) ??
    readDrops(meta?.DeliveredAmount) ??
    readDrops(body.Amount);
  if (!drops) return null;
  const amountXrp = dropsToXrpNumber(drops);
  if (amountXrp === null) return null;

  let occurredAt = new Date().toISOString();
  if (typeof entry.close_time_iso === "string" && entry.close_time_iso) {
    occurredAt = entry.close_time_iso;
  } else if (typeof body.date === "number") {
    occurredAt = rippleTimeToISOTime(body.date);
  }

  const txAccount = String(body.Account ?? "");
  const destination =
    typeof body.Destination === "string" ? body.Destination : null;

  if (transactionType === "Payment") {
    if (txAccount === account) {
      return {
        hash,
        kind: "sent",
        amountXrp,
        counterparty: destination,
        occurredAt,
      };
    }
    if (destination === account) {
      return {
        hash,
        kind: "received",
        amountXrp,
        counterparty: txAccount || null,
        occurredAt,
      };
    }
    return null;
  }

  if (transactionType === "EscrowCreate" && txAccount === account) {
    return {
      hash,
      kind: "escrow",
      amountXrp,
      counterparty: destination && destination !== account ? destination : null,
      occurredAt,
    };
  }

  return null;
}

/**
 * Loads validated account history from the configured XRPL node.
 * @param account - Classic address of the logged-in wallet.
 */
export async function fetchAccountTransactions(
  account: string,
): Promise<LedgerActivity[]> {
  const client = new Client(appConfig.xrpl.wsUrl);
  const collected: LedgerActivity[] = [];
  const seen = new Set<string>();

  try {
    await client.connect();
    let marker: unknown;
    for (let page = 0; page < 3; page += 1) {
      const response = await client.request({
        command: "account_tx",
        account,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 100,
        forward: false,
        ...(marker ? { marker } : {}),
      });
      const result = response.result as {
        transactions?: AccountTxEntry[];
        marker?: unknown;
        error?: string;
      };
      if (result.error === "actNotFound") return [];

      for (const entry of result.transactions ?? []) {
        const parsed = parseAccountTxEntry(entry, account);
        if (!parsed || seen.has(parsed.hash)) continue;
        seen.add(parsed.hash);
        collected.push(parsed);
      }

      if (!result.marker) break;
      marker = result.marker;
    }
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }

  return collected;
}

/**
 * Merges live account_tx rows into the Supabase timeline.
 * Chain payments replace matching withdraw logs. Escrow hashes already stored
 * as deposits are kept once.
 * @param items - Supabase activity rows.
 * @param ledger - Parsed account_tx rows.
 * @param getExplorerTxUrl - Explorer link builder.
 */
export function mergeLedgerIntoActivity(
  items: ActivityLogItem[],
  ledger: LedgerActivity[],
  getExplorerTxUrl: (txHash: string) => string,
): ActivityLogItem[] {
  const ledgerHashes = new Set(ledger.map((entry) => entry.hash));
  const merged = items.filter((item) => {
    if (!item.txHash || !ledgerHashes.has(item.txHash)) return true;
    // Chain is the source of truth for payments. Keep non-payment rows
    // (votes have no hash; deposits stay unless the chain row is the escrow).
    const chain = ledger.find((entry) => entry.hash === item.txHash);
    if (!chain) return true;
    if (chain.kind === "escrow" && item.actionType === "Deposit") return true;
    if (chain.kind === "sent" || chain.kind === "received") {
      return (
        item.actionType !== "Withdraw" &&
        item.actionType !== "Sent" &&
        item.actionType !== "Received"
      );
    }
    return true;
  });

  const existingHashes = new Set(
    merged
      .map((item) => item.txHash)
      .filter((hash): hash is string => Boolean(hash)),
  );

  for (const entry of ledger) {
    if (entry.kind === "escrow") {
      if (existingHashes.has(entry.hash)) continue;
      merged.push({
        id: `ledger-escrow-${entry.hash}`,
        occurredAt: entry.occurredAt,
        actionType: "Deposit",
        detail: formatLedgerAmount(entry.amountXrp, "escrow"),
        status: "Validated",
        txHash: entry.hash,
        explorerUrl: getExplorerTxUrl(entry.hash),
        source: "live",
        counterparty: entry.counterparty,
        flow: "neutral",
      });
      existingHashes.add(entry.hash);
      continue;
    }

    if (existingHashes.has(entry.hash)) continue;
    merged.push({
      id: `ledger-${entry.kind}-${entry.hash}`,
      occurredAt: entry.occurredAt,
      actionType: entry.kind === "received" ? "Received" : "Sent",
      detail: formatLedgerAmount(entry.amountXrp, entry.kind),
      status: "Validated",
      txHash: entry.hash,
      explorerUrl: getExplorerTxUrl(entry.hash),
      source: "live",
      counterparty: entry.counterparty,
      flow: entry.kind === "received" ? "in" : "out",
    });
    existingHashes.add(entry.hash);
  }

  merged.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  return merged;
}
