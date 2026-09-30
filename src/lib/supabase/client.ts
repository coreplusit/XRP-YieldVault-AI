import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a browser-side Supabase client using the public anon key.
 * Safe to use in Client Components (`"use client"`).
 * @throws When NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || url.trim() === "") {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local and restart the dev server.",
    );
  }

  if (!anonKey || anonKey.trim() === "") {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to .env.local and restart the dev server.",
    );
  }

  const headers: Record<string, string> = {};
  if (sessionToken) {
    headers["x-yieldvault-session"] = sessionToken;
  }

  return createClient(url.trim(), anonKey.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { headers },
  });
}

/** Lazy singleton browser client for shared client-side usage. */
let browserClient: SupabaseClient | null = null;
let sessionToken: string | null = null;

/**
 * Returns the wallet-backed session token attached to Supabase requests.
 */
export function getYieldVaultSessionToken(): string | null {
  return sessionToken;
}

/**
 * Attaches or clears the session token and rebuilds the browser client.
 * @param token - Token from POST /api/auth/session, or null on logout.
 */
export function applyYieldVaultSession(token: string | null): void {
  sessionToken = token;
  browserClient = null;
}

/**
 * Returns a shared browser Supabase client instance.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient();
  }
  return browserClient;
}
