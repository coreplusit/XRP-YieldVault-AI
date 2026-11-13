import { WEB3AUTH_NETWORK } from "@web3auth/modal";

/**
 * Resolves the public Web3Auth client ID from environment.
 * @throws When NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is missing.
 */
export function getWeb3AuthClientId(): string {
  const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
  if (!clientId || clientId.trim() === "") {
    throw new Error(
      "Missing NEXT_PUBLIC_WEB3AUTH_CLIENT_ID. Add it to .env.local and restart the dev server.",
    );
  }
  return clientId.trim();
}

/**
 * Sapphire Devnet — keep this stable so Google identities map to the same
 * XRPL addresses they had under the previous SDK.
 */
export const WEB3AUTH_NETWORK_TARGET = WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;
