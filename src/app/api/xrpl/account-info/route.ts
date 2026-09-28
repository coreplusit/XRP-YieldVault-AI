import { NextResponse } from "next/server";

import { appConfig } from "@/lib/config/env";

interface AccountInfoRequestBody {
  address?: unknown;
}

interface AccountInfoRpcResponse {
  result?: {
    account_data?: {
      Balance?: string;
      Sequence?: number;
    };
    error?: string;
    error_code?: number;
    status?: string;
  };
  error?: {
    message?: string;
  };
}

interface BalancePayload {
  ok: true;
  address: string;
  balanceXrp: number;
  exists: boolean;
  sequence: number | null;
}

/**
 * Converts XRPL drops to XRP.
 * @param drops - Balance string in drops.
 */
function dropsToXrpNumber(drops: string): number {
  return Number(drops) / 1_000_000;
}

/**
 * Validates an XRPL classic address shape.
 * @param address - Candidate address.
 */
function isClassicAddress(address: string): boolean {
  return address.startsWith("r") && address.length >= 25 && address.length <= 35;
}

/**
 * Queries XRPL JSON-RPC `account_info` from the server (avoids browser CORS).
 * @param address - XRPL classic address.
 */
async function queryAccountInfo(
  address: string,
): Promise<Omit<BalancePayload, "ok">> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(appConfig.xrpl.jsonRpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        method: "account_info",
        params: [
          {
            account: address,
            ledger_index: "validated",
          },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`XRPL JSON-RPC HTTP ${response.status}`);
    }

    const payload = (await response.json()) as AccountInfoRpcResponse;
    const result = payload.result;

    if (
      result?.error === "actNotFound" ||
      result?.error_code === 19 ||
      (payload.error && !result?.account_data)
    ) {
      return {
        address,
        balanceXrp: 0,
        exists: false,
        sequence: null,
      };
    }

    const drops = result?.account_data?.Balance;
    if (!drops) {
      return {
        address,
        balanceXrp: 0,
        exists: false,
        sequence: null,
      };
    }

    const sequence = result.account_data?.Sequence;

    return {
      address,
      balanceXrp: dropsToXrpNumber(drops),
      exists: true,
      sequence: typeof sequence === "number" ? sequence : null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST /api/xrpl/account-info
 * Server-side XRPL balance proxy — browsers cannot call public rippled HTTP
 * endpoints directly because they omit CORS headers ("Failed to fetch").
 * Body: `{ "address": "r..." }`
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: AccountInfoRequestBody;

  try {
    body = (await request.json()) as AccountInfoRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body. Expected { address: string }." },
      { status: 400 },
    );
  }

  const address =
    typeof body.address === "string" ? body.address.trim() : "";

  if (!isClassicAddress(address)) {
    return NextResponse.json(
      { ok: false, error: "A valid XRPL classic address is required." },
      { status: 400 },
    );
  }

  try {
    const balance = await queryAccountInfo(address);
    const payload: BalancePayload = { ok: true, ...balance };
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "XRPL balance request timed out."
          : error.message
        : "Failed to fetch XRPL account info.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
