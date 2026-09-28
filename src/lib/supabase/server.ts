import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a server-side Supabase client using the public anon key.
 * Prefer this in Server Components, Route Handlers, and Server Actions.
 * @throws When NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || url.trim() === "") {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local and restart the server.",
    );
  }

  if (!anonKey || anonKey.trim() === "") {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Add it to .env.local and restart the server.",
    );
  }

  return createClient(url.trim(), anonKey.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
