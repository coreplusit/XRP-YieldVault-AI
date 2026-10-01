"use client";

import { sign } from "ripple-keypairs";
import type { IProvider } from "@web3auth/base";

import {
  buildFaucetMessage,
  buildSessionMessage,
  utf8ToHex,
} from "@/lib/auth/sessionMessage";
import {
  applyYieldVaultSession,
  getYieldVaultSessionToken,
} from "@/lib/supabase/client";
import type { YieldVaultUser } from "@/lib/supabase/users";
import { getXrplWalletFromProvider } from "@/lib/web3auth/xrpl";

interface SessionApiResponse {
  ok: boolean;
  error?: string;
  token?: string;
  user?: YieldVaultUser;
}

/**
 * Claims Testnet XRP for the connected wallet.
 * Sends a fresh XRPL signature so the faucet does not depend on the Supabase session token.
 * @param provider - Connected Web3Auth provider.
 * @param address - Classic address shown in the UI.
 */
export async function claimTestnetFaucet(
  provider: IProvider,
  address: string,
): Promise<Response> {
  const wallet = await getXrplWalletFromProvider(provider);
  if (wallet.classicAddress !== address) {
    throw new Error("Connected wallet does not match this account.");
  }

  const issuedAt = Date.now();
  const signature = sign(
    utf8ToHex(buildFaucetMessage(address, issuedAt)),
    wallet.privateKey,
  );

  return fetch("/api/xrpl/faucet", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...yieldVaultSessionHeaders(),
    },
    body: JSON.stringify({
      address,
      issuedAt,
      publicKey: wallet.publicKey,
      signature,
    }),
  });
}

/**
 * Headers for app API routes that require a wallet-backed session.
 */
export function yieldVaultSessionHeaders(): Record<string, string> {
  const token = getYieldVaultSessionToken();
  if (!token) return {};
  return { "x-yieldvault-session": token };
}

/**
 * Signs a fresh login proof, syncs public.users, and attaches the session
 * token to later Supabase and faucet requests.
 * @param provider - Connected Web3Auth provider.
 * @param email - Google email when Web3Auth returned one.
 */
export async function establishYieldVaultSession(
  provider: IProvider,
  email: string | null,
): Promise<YieldVaultUser> {
  const wallet = await getXrplWalletFromProvider(provider);
  const issuedAt = Date.now();
  const message = buildSessionMessage(wallet.classicAddress, issuedAt);
  const signature = sign(utf8ToHex(message), wallet.privateKey);

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      xrplAddress: wallet.classicAddress,
      publicKey: wallet.publicKey,
      issuedAt,
      signature,
    }),
  });

  const payload = (await response.json()) as SessionApiResponse;
  if (!response.ok || !payload.ok || !payload.token || !payload.user) {
    throw new Error(payload.error ?? "Could not establish a YieldVault session.");
  }

  applyYieldVaultSession(payload.token);
  return payload.user;
}
