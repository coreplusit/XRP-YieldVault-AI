import { NextResponse } from "next/server";

import { verifySessionToken } from "@/lib/auth/sessionToken";
import { verifyFaucetProof } from "@/lib/auth/walletProof";
import { appConfig } from "@/lib/config/env";
import { getXrplFaucetUrl } from "@/lib/xrpl/escrow";

const recentClaims = new Map<string, number>();
const CLAIM_COOLDOWN_MS = 45_000;

interface FaucetRequestBody {
  address?: unknown;
  publicKey?: unknown;
  signature?: unknown;
  issuedAt?: unknown;
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

  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) {
    return NextResponse.json(
      { ok: false, error: "A valid XRPL classic address is required." },
      { status: 400 },
    );
  }

  const issuedAt =
    typeof body.issuedAt === "number" ? body.issuedAt : Number.NaN;
  const walletProofOk = verifyFaucetProof({
    address,
    publicKey: typeof body.publicKey === "string" ? body.publicKey.trim() : "",
    signature: typeof body.signature === "string" ? body.signature.trim() : "",
    issuedAt,
  });

  let sessionMatches = false;
  if (!walletProofOk) {
    try {
      const session = verifySessionToken(
        request.headers.get("x-yieldvault-session"),
      );
      sessionMatches = Boolean(session && session.xrplAddress === address);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Session secret is not configured.";
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
  }

  if (!walletProofOk && !sessionMatches) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sign in is required before claiming Testnet XRP.",
      },
      { status: 401 },
    );
  }

  const lastClaim = recentClaims.get(address) ?? 0;
  if (Date.now() - lastClaim < CLAIM_COOLDOWN_MS) {
    return NextResponse.json(
      { ok: false, error: "Please wait before claiming Testnet XRP again." },
      { status: 429 },
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

    recentClaims.set(address, Date.now());
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
