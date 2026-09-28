/**
 * Database / Supabase connectivity verification script.
 *
 * Usage:
 *   npm run db:test
 *
 * Requires `.env.local` with:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - DATABASE_URL
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const { Client } = pg;

/**
 * Loads KEY=VALUE pairs from `.env.local` into process.env (without overwriting existing).
 * @param {string} filePath
 */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * @param {string} key
 * @returns {string}
 */
function requireEnv(key) {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

async function testPostgresConnection() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    // Prefer IPv4 — WSL/container networks often cannot reach Supabase over IPv6
    family: 4,
  });

  console.log("→ Testing direct PostgreSQL connection (DATABASE_URL)...");
  await client.connect();

  const result = await client.query("SELECT NOW() AS now, version() AS version");
  const row = result.rows[0];
  if (!row) {
    throw new Error("PostgreSQL query returned no rows");
  }

  console.log("  ✓ Connected to PostgreSQL");
  console.log(`  ✓ Server time: ${new Date(row.now).toISOString()}`);
  console.log(`  ✓ Version: ${String(row.version).split("\n")[0]}`);

  const tables = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('users', 'vault_deposits', 'dao_votes')
     ORDER BY table_name`,
  );

  if (tables.rows.length === 0) {
    console.log(
      "  ⚠ Tables users / vault_deposits / dao_votes not found yet — run the migration SQL next.",
    );
  } else {
    console.log(
      `  ✓ Found tables: ${tables.rows.map((t) => t.table_name).join(", ")}`,
    );
  }

  await client.end();
}

async function testSupabaseClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  console.log("→ Testing Supabase JS client (REST API)...");
  console.log(`  URL: ${url}`);

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Supabase auth probe failed: ${sessionError.message}`);
  }
  console.log("  ✓ Supabase Auth API reachable");

  const { error: queryError } = await supabase.from("users").select("id").limit(1);

  if (!queryError) {
    console.log("  ✓ PostgREST query to public.users succeeded");
    return;
  }

  const message = queryError.message.toLowerCase();
  const isMissingTable =
    message.includes("does not exist") ||
    message.includes("could not find") ||
    queryError.code === "PGRST205" ||
    queryError.code === "42P01";

  if (isMissingTable) {
    console.log(
      "  ⚠ PostgREST reachable, but public.users is missing — apply supabase/migrations/001_initial_schema.sql",
    );
    return;
  }

  throw new Error(
    `Supabase PostgREST probe failed: [${queryError.code}] ${queryError.message}`,
  );
}

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  loadEnvFile(envPath);

  console.log("\n=== XRP YieldVault AI — Database Connection Test ===\n");

  let postgresOk = false;
  let supabaseOk = false;
  /** @type {string | null} */
  let postgresError = null;
  /** @type {string | null} */
  let supabaseError = null;

  try {
    await testPostgresConnection();
    postgresOk = true;
  } catch (error) {
    postgresError = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ PostgreSQL failed: ${postgresError}`);
  }

  console.log("");

  try {
    await testSupabaseClient();
    supabaseOk = true;
  } catch (error) {
    supabaseError = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ Supabase client failed: ${supabaseError}`);
  }

  console.log("");

  if (postgresOk && supabaseOk) {
    console.log("=== Connection test completed successfully ===\n");
    return;
  }

  if (supabaseOk && !postgresOk) {
    console.log("=== Partial success ===");
    console.log("  ✓ Supabase REST/Auth API is reachable");
    console.log("  ✗ Direct PostgreSQL (port 5432) is unreachable from this host");
    console.log("  → Root cause often: db.*.supabase.co is IPv6-only (no A record).");
    console.log("  → Apply migrations via Supabase Dashboard → SQL Editor, or use the");
    console.log("    Session/Transaction pooler URI (IPv4) from Project Settings → Database.\n");
    process.exit(0);
  }

  console.error("=== Connection test failed ===");
  if (postgresError) console.error(`  PostgreSQL: ${postgresError}`);
  if (supabaseError) console.error(`  Supabase: ${supabaseError}`);
  console.error("");
  process.exit(1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("\n✗ Connection test failed:");
  console.error(`  ${message}\n`);
  process.exit(1);
});
