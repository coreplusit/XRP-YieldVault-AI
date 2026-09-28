import type { CustomChainConfig } from "@web3auth/base";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";

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

/** Sapphire Devnet — required for localhost origins during development. */
export const WEB3AUTH_NETWORK_TARGET = WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;

/**
 * Chain config for CommonPrivateKeyProvider (key transport only).
 *
 * Uses `CHAIN_NAMESPACES.OTHER` so Web3Auth does NOT spin up the Ethereum
 * TransactionFormatter / EIP-1559 RPC probes that break Google login when
 * public RPCs are rate-limited or return empty JSON-RPC bodies.
 *
 * `rpcTarget` is a placeholder required by the type — it is never called during auth.
 */
export function getPrivateKeyTransportChainConfig(): CustomChainConfig {
  return {
    chainNamespace: CHAIN_NAMESPACES.OTHER,
    // Non-mainnet id so MetaMask does not treat this origin as Ethereum L1.
    chainId: "0x539",
    rpcTarget: "https://localhost",
    displayName: "XRPL Key Transport (no EVM RPC)",
    ticker: "XRP",
    tickerName: "XRP Ledger Key Transport",
    decimals: 6,
    isTestnet: true,
  };
}
