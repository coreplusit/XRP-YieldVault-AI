import {
  Client,
  isoTimeToRippleTime,
  type EscrowCreate,
  type Wallet,
  xrpToDrops,
} from "xrpl";

import { appConfig } from "@/lib/config/env";

export interface EscrowDepositParams {
  wallet: Wallet;
  amountXrp: number;
  lockDays: number;
}

export interface EscrowDepositResult {
  txHash: string;
  explorerUrl: string;
  finishAfterIso: string;
  amountXrp: number;
  account: string;
}

/**
 * Builds the official XRPL explorer URL for a transaction hash.
 * @param txHash - Validated ledger transaction hash.
 */
export function getXrplExplorerTxUrl(txHash: string): string {
  const network = appConfig.xrpl.network;
  if (network === "mainnet") {
    return `https://livenet.xrpl.org/transactions/${txHash}`;
  }
  if (network === "devnet") {
    return `https://devnet.xrpl.org/transactions/${txHash}`;
  }
  return `https://testnet.xrpl.org/transactions/${txHash}`;
}

/**
 * Returns the XRPL Testnet faucet URL for funding underfunded accounts.
 */
export function getXrplFaucetUrl(): string {
  return "https://faucet.altnet.rippletest.net/accounts";
}

/**
 * Submits a native XRPL EscrowCreate (self-destination time-lock) via WebSocket.
 * @param params - Signing wallet, XRP amount, and lock duration in days.
 * @throws When the account is unfunded, amount is invalid, or ledger rejects the tx.
 */
export async function submitVaultEscrowDeposit(
  params: EscrowDepositParams,
): Promise<EscrowDepositResult> {
  const { wallet, amountXrp, lockDays } = params;

  if (!Number.isFinite(amountXrp) || amountXrp <= 0) {
    throw new Error("Deposit amount must be a positive XRP value.");
  }

  if (!Number.isFinite(lockDays) || lockDays <= 0) {
    throw new Error("Lock period must be a positive number of days.");
  }

  const finishAfterDate = new Date(
    Date.now() + lockDays * 24 * 60 * 60 * 1000,
  );

  const client = new Client(appConfig.xrpl.wsUrl);

  try {
    await client.connect();

    const accountInfo = await client.request({
      command: "account_info",
      account: wallet.classicAddress,
      ledger_index: "validated",
    }).catch(() => null);

    if (!accountInfo) {
      throw new Error(
        `XRPL account ${wallet.classicAddress} is not funded on ${appConfig.xrpl.network}. ` +
          `Fund it via the Testnet faucet, then retry.`,
      );
    }

    const escrowTx: EscrowCreate = {
      TransactionType: "EscrowCreate",
      Account: wallet.classicAddress,
      Destination: wallet.classicAddress,
      Amount: xrpToDrops(amountXrp),
      FinishAfter: isoTimeToRippleTime(finishAfterDate),
    };

    const prepared = await client.autofill(escrowTx);
    const signed = wallet.sign(prepared);
    const submitted = await client.submitAndWait(signed.tx_blob);

    const txHash =
      typeof submitted.result.hash === "string" ? submitted.result.hash : null;

    if (!txHash) {
      throw new Error("Escrow submitted but XRPL returned no transaction hash.");
    }

    const meta = submitted.result.meta;
    const engineResult =
      typeof meta === "object" &&
      meta !== null &&
      "TransactionResult" in meta &&
      typeof (meta as { TransactionResult?: unknown }).TransactionResult ===
        "string"
        ? (meta as { TransactionResult: string }).TransactionResult
        : null;

    if (engineResult && engineResult !== "tesSUCCESS") {
      throw new Error(`EscrowCreate failed on ledger: ${engineResult}`);
    }

    return {
      txHash,
      explorerUrl: getXrplExplorerTxUrl(txHash),
      finishAfterIso: finishAfterDate.toISOString(),
      amountXrp,
      account: wallet.classicAddress,
    };
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}
