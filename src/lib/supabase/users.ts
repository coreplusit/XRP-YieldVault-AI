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
 * Browser inserts into public.users are closed.
 * Login goes through POST /api/auth/session after an XRPL signature.
 * @param _input - Unused. Kept so older call sites fail with a clear message.
 */
export async function syncWeb3AuthUser(
  _input: SyncWeb3AuthUserInput,
): Promise<YieldVaultUser> {
  throw new Error(
    "Direct user sync is disabled. Sign in so the app can call /api/auth/session.",
  );
}
