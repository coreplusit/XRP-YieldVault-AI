import { NextResponse } from "next/server";
import { deriveAddress, verify } from "ripple-keypairs";
import { createClient } from "@supabase/supabase-js";

import { buildSessionMessage, utf8ToHex } from "@/lib/auth/sessionMessage";
import {
  createSyncProof,
  ensureSessionSecret,
  issueSessionToken,
} from "@/lib/auth/sessionToken";
import type { YieldVaultUser } from "@/lib/supabase/users";

export const dynamic = "force-dynamic";

interface SessionRequestBody {
  email?: unknown;
  xrplAddress?: unknown;
  publicKey?: unknown;
  issuedAt?: unknown;
  signature?: unknown;
}

const MAX_SKEW_MS = 2 * 60 * 1000;

/**
 * POST /api/auth/session
 * Verifies an XRPL signature, syncs public.users, and returns a session token.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: SessionRequestBody;
  try {
    body = (await request.json()) as SessionRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const xrplAddress =
    typeof body.xrplAddress === "string" ? body.xrplAddress.trim() : "";
  const publicKey =
    typeof body.publicKey === "string" ? body.publicKey.trim() : "";
  const signature =
    typeof body.signature === "string" ? body.signature.trim() : "";
  const issuedAt =
    typeof body.issuedAt === "number" ? body.issuedAt : Number.NaN;
  const email = typeof body.email === "string" ? body.email : null;

  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(xrplAddress)) {
    return NextResponse.json(
      { ok: false, error: "A valid XRPL classic address is required." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_SKEW_MS) {
    return NextResponse.json(
      { ok: false, error: "Session proof expired. Sign in again." },
      { status: 401 },
    );
  }

  const messageHex = utf8ToHex(buildSessionMessage(xrplAddress, issuedAt));
  let signatureOk = false;
  try {
    signatureOk = verify(messageHex, signature, publicKey);
  } catch {
    signatureOk = false;
  }

  let derivedAddress = "";
  try {
    derivedAddress = deriveAddress(publicKey);
  } catch {
    derivedAddress = "";
  }

  if (!signatureOk || derivedAddress !== xrplAddress) {
    return NextResponse.json(
      { ok: false, error: "XRPL signature did not match this address." },
      { status: 401 },
    );
  }

  try {
    const installed = await ensureSessionSecret();
    if (!installed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Session secret does not match the database. Clear private.session_secret and restart.",
        },
        { status: 503 },
      );
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Session secret setup failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("sync_web3auth_user", {
    p_email: email,
    p_xrpl_address: xrplAddress,
    p_proof: createSyncProof(xrplAddress),
  });

  if (error || !data) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "User sync failed.",
      },
      { status: 403 },
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  const user: YieldVaultUser = {
    id: String(row.id),
    email: row.email == null ? null : String(row.email),
    xrpl_address: String(row.xrpl_address),
    auth_provider:
      row.auth_provider === "native_wallet" ? "native_wallet" : "web3auth_google",
    created_at: String(row.created_at),
  };

  return NextResponse.json({
    ok: true,
    token: issueSessionToken(user.id, user.xrpl_address),
    user,
  });
}
