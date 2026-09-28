import type { IProvider } from "@web3auth/base";
import { Wallet } from "xrpl";

const PRIVATE_KEY_METHODS = ["private_key", "eth_private_key"] as const;

/**
 * Lowercases an unknown error into a comparable message string.
 * @param error - Unknown thrown value.
 */
function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  if (typeof error === "string") {
    return error.toLowerCase();
  }
  try {
    return JSON.stringify(error).toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Returns true when an error is injected-wallet / MetaMask extension noise.
 * These are unrelated to XRPL + Google OpenLogin and must not surface as overlays.
 * @param error - Unknown thrown value.
 */
export function isInjectedWalletExtensionError(error: unknown): boolean {
  const message = normalizeErrorMessage(error);
  let stack = "";
  if (error instanceof Error && error.stack) {
    stack = error.stack.toLowerCase();
  } else if (error && typeof error === "object" && "stack" in error) {
    stack = String((error as { stack?: unknown }).stack ?? "").toLowerCase();
  }

  const haystack = `${message} ${stack}`;
  return (
    haystack.includes("failed to connect to metamask") ||
    haystack.includes("metamask") ||
    haystack.includes("nkbihfbeogaeaoehlefnkodbefgpgknn") ||
    // Legacy typo kept for older cached helpers / logs
    haystack.includes("nkbihfbeogaeaoehlefhkodbefgpgknn") ||
    haystack.includes("chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn") ||
    haystack.includes("eth_requestaccounts") ||
    haystack.includes("already processing eth_requestaccounts") ||
    haystack.includes("provider is not set") ||
    haystack.includes("no ethereum provider") ||
    haystack.includes("inpage.js")
  );
}

/**
 * Returns true when an error is a non-critical Web3Auth / JSON-RPC mismatch.
 * @param error - Unknown thrown value from a provider request.
 */
export function isBenignProviderRpcError(error: unknown): boolean {
  const message = normalizeErrorMessage(error);
  return (
    isInjectedWalletExtensionError(error) ||
    message.includes("response has no error or result") ||
    message.includes("could not find result") ||
    message.includes("xrpl_getaccounts") ||
    message.includes("internal error") ||
    message.includes("unauthorized") ||
    message.includes("eip1559")
  );
}

/**
 * Returns true when the user cancelled / closed the auth popup or flow.
 * @param error - Unknown thrown value from connectTo / login.
 */
export function isUserCancellationError(error: unknown): boolean {
  const message = normalizeErrorMessage(error);
  return (
    message.includes("user closed") ||
    message.includes("user cancelled") ||
    message.includes("user canceled") ||
    message.includes("login popup has been closed") ||
    message.includes("popup has been closed") ||
    message.includes("window is closed") ||
    message.includes("operation cancelled") ||
    message.includes("operation canceled") ||
    message.includes("user denied") ||
    message.includes("login denied") ||
    message.includes("user rejected the request")
  );
}

/**
 * True when Web3Auth init hits a leftover/expired local session.
 * Common when the user is logged out but browser storage still has an old key.
 * @param error - Unknown thrown value or console argument.
 */
export function isStaleWeb3AuthSessionError(error: unknown): boolean {
  const message = normalizeErrorMessage(error);
  return (
    message.includes("session expired") ||
    message.includes("invalid public key") ||
    message.includes("session expired or invalid public key")
  );
}

/**
 * True when an auth-bridge error should be swallowed (no Next.js red overlay).
 * @param error - Unknown thrown value.
 */
export function isIgnorableAuthBridgeError(error: unknown): boolean {
  return (
    isBenignProviderRpcError(error) ||
    isUserCancellationError(error) ||
    isInjectedWalletExtensionError(error) ||
    isStaleWeb3AuthSessionError(error)
  );
}

/**
 * Drops leftover Web3Auth / OpenLogin browser storage so init can start clean.
 * Safe to call when the user is logged out.
 */
export function clearStaleWeb3AuthStorage(): void {
  if (typeof window === "undefined") return;

  const hints = ["web3auth", "openlogin", "torus", "@web3auth"];
  const stores = [window.localStorage, window.sessionStorage];

  for (const store of stores) {
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (!key) continue;
      const lower = key.toLowerCase();
      if (hints.some((hint) => lower.includes(hint))) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      store.removeItem(key);
    }
  }
}

/**
 * Safely requests a method from the Web3Auth provider, swallowing benign RPC mismatches.
 * @param provider - Active Web3Auth provider.
 * @param method - JSON-RPC method name.
 */
async function safeProviderRequest(
  provider: IProvider,
  method: string,
): Promise<unknown> {
  try {
    return await provider.request({ method });
  } catch (error: unknown) {
    if (isBenignProviderRpcError(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads the secp256k1 private key hex from the Web3Auth provider.
 * Prefers `private_key`, then falls back to `eth_private_key`.
 * @param provider - Active Web3Auth provider after successful login.
 */
export async function getWeb3AuthPrivateKeyHex(
  provider: IProvider,
): Promise<string> {
  for (const method of PRIVATE_KEY_METHODS) {
    const value = await safeProviderRequest(provider, method);
    if (typeof value === "string" && value.trim() !== "") {
      return value.replace(/^0x/i, "").trim();
    }
  }

  throw new Error(
    "Unable to derive XRPL address: private key unavailable from Web3Auth provider.",
  );
}

/**
 * Converts a hex string into a Uint8Array.
 * @param hex - Even-length hex string without `0x` prefix.
 */
function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Builds a signing-capable XRPL Wallet from the Web3Auth private key.
 * @param provider - Active Web3Auth provider after successful login.
 */
export async function getXrplWalletFromProvider(
  provider: IProvider,
): Promise<Wallet> {
  const privateKeyHex = await getWeb3AuthPrivateKeyHex(provider);

  if (privateKeyHex.length < 32) {
    throw new Error(
      "Unable to derive XRPL wallet: private key entropy too short.",
    );
  }

  const entropy = hexToBytes(privateKeyHex.slice(0, 32));
  if (entropy.length !== 16) {
    throw new Error("Unable to derive XRPL wallet: invalid entropy length.");
  }

  return Wallet.fromEntropy(entropy);
}

/**
 * Derives a deterministic XRPL classic address from the Web3Auth private key.
 * @param provider - Active Web3Auth provider after successful login.
 */
export async function deriveXrplAddressFromProvider(
  provider: IProvider,
): Promise<string> {
  const wallet = await getXrplWalletFromProvider(provider);
  return wallet.classicAddress;
}

/**
 * Truncates an XRPL classic address for compact UI display.
 * @param address - Full classic address (r...).
 * @param leading - Characters to keep at the start.
 * @param trailing - Characters to keep at the end.
 */
export function truncateXrplAddress(
  address: string,
  leading = 6,
  trailing = 4,
): string {
  if (address.length <= leading + trailing + 3) {
    return address;
  }
  return `${address.slice(0, leading)}…${address.slice(-trailing)}`;
}

/**
 * Truncates an XRPL transaction hash for compact UI display.
 * @param hash - Full hex transaction hash.
 * @param leading - Characters to keep at the start.
 * @param trailing - Characters to keep at the end.
 */
export function truncateTxHash(
  hash: string,
  leading = 4,
  trailing = 4,
): string {
  const clean = hash.trim();
  if (clean.length <= leading + trailing + 3) {
    return clean;
  }
  return `${clean.slice(0, leading)}…${clean.slice(-trailing)}`;
}
