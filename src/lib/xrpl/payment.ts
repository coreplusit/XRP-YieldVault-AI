import {
  Client,
  type Payment,
  type Wallet,
  xrpToDrops,
} from "xrpl";

import { appConfig } from "@/lib/config/env";
import { getXrplExplorerTxUrl } from "@/lib/xrpl/escrow";

export interface XrpPaymentParams {
  wallet: Wallet;
  destination: string;
  amountXrp: number;
  /** Optional exchange destination tag (uint32). */
  destinationTag?: number | null;
}

export interface XrpPaymentResult {
  txHash: string;
  explorerUrl: string;
  amountXrp: number;
  destination: string;
  destinationTag: number | null;
  account: string;
}

/**
 * Submits an on-chain XRPL Payment (withdraw / send XRP).
 * @param params - Signing wallet, destination, amount, optional destination tag.
 */
export async function submitXrpPayment(
  params: XrpPaymentParams,
): Promise<XrpPaymentResult> {
  const { wallet, amountXrp } = params;
  const destination = params.destination.trim();
  const destinationTag =
    params.destinationTag === undefined || params.destinationTag === null
      ? null
      : params.destinationTag;

  if (!Number.isFinite(amountXrp) || amountXrp <= 0) {
    throw new Error("Send amount must be a positive XRP value.");
  }

  if (!destination.startsWith("r") || destination.length < 25) {
    throw new Error("Enter a valid XRPL classic destination address (r…).");
  }

  if (destination === wallet.classicAddress) {
    throw new Error("Destination cannot be your own wallet address.");
  }

  if (destinationTag !== null) {
    if (
      !Number.isInteger(destinationTag) ||
      destinationTag < 0 ||
      destinationTag > 4_294_967_295
    ) {
      throw new Error(
        "Destination Tag must be an integer between 0 and 4294967295.",
      );
    }
  }

  const client = new Client(appConfig.xrpl.wsUrl);

  try {
    await client.connect();

    const accountInfo = await client
      .request({
        command: "account_info",
        account: wallet.classicAddress,
        ledger_index: "validated",
      })
      .catch(() => null);

    if (!accountInfo) {
      throw new Error(
        `XRPL account ${wallet.classicAddress} is not funded on ${appConfig.xrpl.network}. ` +
          `Fund it via the Testnet faucet, then retry.`,
      );
    }

    const paymentTx: Payment = {
      TransactionType: "Payment",
      Account: wallet.classicAddress,
      Destination: destination,
      Amount: xrpToDrops(amountXrp),
      ...(destinationTag !== null ? { DestinationTag: destinationTag } : {}),
    };

    const prepared = await client.autofill(paymentTx);
    const signed = wallet.sign(prepared);
    const submitted = await client.submitAndWait(signed.tx_blob);

    const txHash =
      typeof submitted.result.hash === "string" ? submitted.result.hash : null;

    if (!txHash) {
      throw new Error("Payment submitted but XRPL returned no transaction hash.");
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
      throw new Error(`Payment failed on ledger: ${engineResult}`);
    }

    return {
      txHash,
      explorerUrl: getXrplExplorerTxUrl(txHash),
      amountXrp,
      destination,
      destinationTag,
      account: wallet.classicAddress,
    };
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}
