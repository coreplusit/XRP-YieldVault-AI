import {
  CHAIN_NAMESPACES,
  WEB3AUTH_NETWORK,
  type CustomChainConfig,
} from "@web3auth/modal";

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

/** XRPL Testnet chain id used by Embedded Wallets (Web3Auth) v11. */
export const XRPL_TESTNET_CHAIN_ID = "0x6";

/**
 * XRPL Testnet chain config for XrplPrivateKeyProvider.
 * wsTarget / rpcTarget are Web3Auth transport endpoints; app ledger calls still
 * use the hard-locked Testnet URLs in src/lib/config/env.ts.
 */
export function getXrplTestnetChainConfig(): CustomChainConfig {
  return {
    chainNamespace: CHAIN_NAMESPACES.XRPL,
    chainId: XRPL_TESTNET_CHAIN_ID,
    rpcTarget: "https://testnet-ripple-node.tor.us",
    wsTarget: "wss://s.altnet.rippletest.net:51233",
    displayName: "XRPL Testnet",
    ticker: "XRP",
    tickerName: "XRP Ledger",
    decimals: 6,
    blockExplorerUrl: "https://testnet.xrpl.org",
    logo: "",
    isTestnet: true,
  };
}
