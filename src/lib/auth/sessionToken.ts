import { createHmac, timingSafeEqual } from "crypto";

import { createClient } from "@supabase/supabase-js";

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

export interface YieldVaultSessionClaims {
  userId: string;
  xrplAddress: string;
  expiresAt: number;
}

/**
 * Server-only secret shared with private.session_secret.
 */
export function getSessionSecret(): string {
  const secret = process.env.YIELDVAULT_SESSION_SECRET?.trim() ?? "";
  if (secret.length < 16) {
    throw new Error(
      "Missing YIELDVAULT_SESSION_SECRET (min 16 chars). Add it to .env.local and restart.",
    );
  }
  return secret;
}

/**
 * Installs the server secret in Postgres when the row is empty.
 * Returns false when a different secret is already stored.
 */
export async function ensureSessionSecret(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key are required to install the session secret.");
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("install_session_secret", {
    p_secret: getSessionSecret(),
  });

  if (error) {
    throw new Error(
      `Could not install session secret. Apply supabase/migrations/008_session_rls.sql. (${error.message})`,
    );
  }

  return data === true;
}

/**
 * HMAC the wallet address so sync_web3auth_user rejects unsigned callers.
 * @param xrplAddress - Classic address being synced.
 */
export function createSyncProof(xrplAddress: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(`sync:${xrplAddress}`)
    .digest("hex");
}

/**
 * Issues a token of the form userId.address.expiry.hmac.
 */
export function issueSessionToken(
  userId: string,
  xrplAddress: string,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${userId}.${xrplAddress}.${expiresAt}`;
  const sig = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

/**
 * Verifies a session token. Returns null when missing, expired, or forged.
 * @param token - x-yieldvault-session header value.
 */
export function verifySessionToken(
  token: string | null | undefined,
): YieldVaultSessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, xrplAddress, expText, sig] = parts;
  if (!userId || !xrplAddress || !expText || !sig) return null;

  const expiresAt = Number(expText);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const payload = `${userId}.${xrplAddress}.${expText}`;
  const expected = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const sigBuf = Buffer.from(sig, "utf8");
  if (expectedBuf.length !== sigBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, sigBuf)) return null;

  return { userId, xrplAddress, expiresAt };
}
