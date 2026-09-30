"use client";

import { useCallback, useEffect, useState } from "react";

import { useWeb3Auth } from "@/context/Web3AuthContext";

const FRESH_EMAIL_COOKIE = "yieldvault_dev_fresh_email";
const AUTH_STORAGE_HINTS = ["web3auth", "openlogin", "torus", "@web3auth"];

/**
 * Set to false to hide the floating toolbar even while `next dev` is running.
 */
const DEV_USER_SWITCHER_ENABLED = true;

/**
 * Renders only in local development, and only while the flag above is true.
 */
export function shouldShowDevUserSwitcher(): boolean {
  return DEV_USER_SWITCHER_ENABLED && process.env.NODE_ENV === "development";
}

/**
 * Drops Web3Auth / OpenLogin IndexedDB so a reload starts as a logged-out user.
 */
async function clearWeb3AuthIndexedDb(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const names = new Set<string>([
    "openlogin-store",
    "web3auth",
    "@toruslabs/openlogin",
  ]);

  if (typeof indexedDB.databases === "function") {
    const databases = await indexedDB.databases();
    for (const database of databases) {
      if (database.name) names.add(database.name);
    }
  }

  await Promise.all(
    [...names].map(
      (name) =>
        new Promise<void>((resolve) => {
          const lower = name.toLowerCase();
          const matches = AUTH_STORAGE_HINTS.some((hint) =>
            lower.includes(hint.replace("@", "")),
          );
          if (!matches && !lower.includes("openlogin") && !lower.includes("torus")) {
            resolve();
            return;
          }
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        }),
    ),
  );
}

/**
 * Removes auth-bridge cookies without touching the dev-only fresh-email note.
 */
function clearAuthCookies(): void {
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const name = part.split("=")[0]?.trim();
    if (!name || name === FRESH_EMAIL_COOKIE) continue;
    const lower = name.toLowerCase();
    if (!AUTH_STORAGE_HINTS.some((hint) => lower.includes(hint))) continue;
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
}

function readFreshEmailCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${FRESH_EMAIL_COOKIE}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Floating local/testnet control for replaying first-time onboarding
 * and forcing a Supabase re-fetch without signing out.
 */
export function DevUserSwitcher() {
  const { logout } = useWeb3Auth();
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState<"fresh" | "reset" | null>(null);

  useEffect(() => {
    setLastEmail(readFreshEmailCookie());
  }, []);

  const handleFreshSignup = useCallback(async (): Promise<void> => {
    setBusy("fresh");
    const email = `dev+test_${Date.now()}@gmail.com`;

    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard can be denied; the cookie still records the alias.
    }

    document.cookie = `${FRESH_EMAIL_COOKIE}=${encodeURIComponent(email)}; path=/; max-age=86400; SameSite=Lax`;

    try {
      await logout();
    } catch {
      // Storage wipe below still drops the cached session.
    }

    window.localStorage.clear();
    window.sessionStorage.clear();
    clearAuthCookies();
    await clearWeb3AuthIndexedDb();
    window.location.replace("/");
  }, [logout]);

  const handleHardReset = useCallback((): void => {
    setBusy("reset");

    const isAuthKey = (key: string): boolean => {
      const lower = key.toLowerCase();
      return AUTH_STORAGE_HINTS.some((hint) => lower.includes(hint));
    };

    for (const store of [window.localStorage, window.sessionStorage]) {
      const keys: string[] = [];
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (key && !isAuthKey(key)) keys.push(key);
      }
      for (const key of keys) {
        store.removeItem(key);
      }
    }

    window.dispatchEvent(new Event("yieldvault-delegation-change"));
    window.dispatchEvent(new Event("yieldvault-pitch-reset"));
    window.location.reload();
  }, []);

  if (!shouldShowDevUserSwitcher()) return null;

  return (
    <aside
      className="pointer-events-auto fixed bottom-3 right-3 z-[60] flex max-w-[calc(100vw-1.5rem)] items-center gap-1.5 rounded-full border border-slate-700/70 bg-vault-bg/85 px-2 py-1.5 shadow-lg backdrop-blur-md"
      aria-label="Developer test user switcher"
    >
      <span className="shrink-0 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-vault-muted">
        Dev
      </span>
      <button
        type="button"
        onClick={() => void handleFreshSignup()}
        disabled={busy !== null}
        title={
          lastEmail
            ? `Last fresh alias copied for signup: ${lastEmail}`
            : "Generate a timestamp email, clear the Web3Auth session, and reload logged out"
        }
        className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/10 px-3 text-[11px] font-semibold text-amber-100 transition-colors hover:bg-amber-400/20 disabled:opacity-60"
      >
        {busy === "fresh" ? "Resetting session…" : "⚡ Simulates New Fresh Signup"}
      </button>
      <button
        type="button"
        onClick={handleHardReset}
        disabled={busy !== null}
        title="Clear app cache and reload. Web3Auth identity stays signed in."
        className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-slate-700/80 bg-slate-900/50 px-3 text-[11px] font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800/70 disabled:opacity-60"
      >
        {busy === "reset"
          ? "Clearing cache…"
          : "🧹 Clear Local Cache & Hard Reset"}
      </button>
    </aside>
  );
}
