import { NextResponse } from "next/server";

import { appConfig } from "@/lib/config/env";
import { getXrplFaucetUrl } from "@/lib/xrpl/escrow";

interface FaucetRequestBody {
  address?: unknown;
}

interface FaucetSuccessBody {
  account?: {
    classicAddress?: string;
    address?: string;
  };
  amount?: number;
  balance?: number;
}

/**
 * POST /api/xrpl/faucet
 * Proxies funding requests to the official XRPL Testnet faucet (avoids browser CORS).
 * Body: `{ "address": "r..." }`
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: FaucetRequestBody;

  try {
    body = (await request.json()) as FaucetRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body. Expected { address: string }." },
      { status: 400 },
    );
  }

  const address =
    typeof body.address === "string" ? body.address.trim() : "";

  if (!address.startsWith("r") || address.length < 25) {
    return NextResponse.json(
      { ok: false, error: "A valid XRPL classic address is required." },
      { status: 400 },
    );
  }

  try {
    const faucetResponse = await fetch(getXrplFaucetUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        destination: address,
        userAgent: "xrp-yieldvault-ai/dashboard",
      }),
      cache: "no-store",
    });

    const contentType = faucetResponse.headers.get("Content-Type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload: unknown = isJson
      ? await faucetResponse.json()
      : await faucetResponse.text();

    if (!faucetResponse.ok) {
      const detail =
        typeof payload === "string"
          ? payload
          : JSON.stringify(payload);
      return NextResponse.json(
        {
          ok: false,
          error: `Faucet request failed (${faucetResponse.status}): ${detail.slice(0, 280)}`,
        },
        { status: 502 },
      );
    }

    const data = (payload ?? {}) as FaucetSuccessBody;
    const fundedAddress =
      data.account?.classicAddress ?? data.account?.address ?? address;
    const amountXrp = appConfig.vault.faucetClaimXrp;

    return NextResponse.json({
      ok: true,
      address: fundedAddress,
      amountXrp,
      ledgerAmount:
        typeof data.amount === "number"
          ? data.amount
          : typeof data.balance === "number"
            ? data.balance
            : null,
      message: `Account Activated! ${amountXrp} Testnet XRP added to your wallet.`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Faucet request failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
