import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Row shape for `public.users` matching the initial migration. */
export interface YieldVaultUser {
  id: string;
  email: string | null;
  xrpl_address: string;
  auth_provider: "web3auth_google" | "native_wallet";
  created_at: string;
}

export interface SyncWeb3AuthUserInput {
  email: string | null;
  xrplAddress: string;
}

/**
 * Maps a PostgREST users row into YieldVaultUser.
 * @param row - Untrusted row from Supabase.
 */
function mapUserRow(row: Record<string, unknown>): YieldVaultUser {
  return {
    id: String(row.id),
    email:
      row.email === null || row.email === undefined
        ? null
        : String(row.email),
    xrpl_address: String(row.xrpl_address),
    auth_provider: row.auth_provider as YieldVaultUser["auth_provider"],
    created_at: String(row.created_at),
  };
}

/**
 * Upserts a Web3Auth Google user into Supabase `users`.
 * Looks up by `xrpl_address` first, then by `email`, and inserts when missing.
 * Retries lookup on unique-constraint races.
 * @param input - Email and deterministic XRPL address from Web3Auth.
 * @returns The existing or newly created user row.
 */
export async function syncWeb3AuthUser(
  input: SyncWeb3AuthUserInput,
): Promise<YieldVaultUser> {
  const supabase = getSupabaseBrowserClient();
  const email = input.email?.trim().toLowerCase() || null;
  const xrplAddress = input.xrplAddress.trim();

  if (!xrplAddress) {
    throw new Error("Cannot sync user without an XRPL address.");
  }

  const { data: byAddress, error: byAddressError } = await supabase
    .from("users")
    .select("id, email, xrpl_address, auth_provider, created_at")
    .eq("xrpl_address", xrplAddress)
    .maybeSingle();

  if (byAddressError) {
    throw new Error(
      `Supabase lookup by xrpl_address failed: ${byAddressError.message}`,
    );
  }

  if (byAddress) {
    return mapUserRow(byAddress as Record<string, unknown>);
  }

  if (email) {
    const { data: byEmail, error: byEmailError } = await supabase
      .from("users")
      .select("id, email, xrpl_address, auth_provider, created_at")
      .eq("email", email)
      .maybeSingle();

    if (byEmailError) {
      throw new Error(`Supabase lookup by email failed: ${byEmailError.message}`);
    }

    if (byEmail) {
      return mapUserRow(byEmail as Record<string, unknown>);
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      email,
      xrpl_address: xrplAddress,
      auth_provider: "web3auth_google",
    })
    .select("id, email, xrpl_address, auth_provider, created_at")
    .single();

  if (!insertError && inserted) {
    return mapUserRow(inserted as Record<string, unknown>);
  }

  // Unique race or RLS: re-read by address / email before failing hard.
  const { data: racedByAddress } = await supabase
    .from("users")
    .select("id, email, xrpl_address, auth_provider, created_at")
    .eq("xrpl_address", xrplAddress)
    .maybeSingle();

  if (racedByAddress) {
    return mapUserRow(racedByAddress as Record<string, unknown>);
  }

  if (email) {
    const { data: racedByEmail } = await supabase
      .from("users")
      .select("id, email, xrpl_address, auth_provider, created_at")
      .eq("email", email)
      .maybeSingle();
    if (racedByEmail) {
      return mapUserRow(racedByEmail as Record<string, unknown>);
    }
  }

  const detail = insertError?.message ?? "unknown error";
  const rlsHint =
    detail.toLowerCase().includes("row-level security") ||
    detail.toLowerCase().includes("permission denied") ||
    detail.toLowerCase().includes("42501")
      ? " Apply supabase/migrations/002_web3auth_user_sync_policy.sql in the Supabase SQL Editor."
      : "";

  throw new Error(`Supabase user sync failed: ${detail}.${rlsHint}`);
}
