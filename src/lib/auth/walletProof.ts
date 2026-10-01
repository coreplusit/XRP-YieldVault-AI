import { deriveAddress, verify } from "ripple-keypairs";

import { buildFaucetMessage, utf8ToHex } from "@/lib/auth/sessionMessage";

const MAX_SKEW_MS = 2 * 60 * 1000;

export interface FaucetWalletProof {
  address: string;
  publicKey: string;
  signature: string;
  issuedAt: number;
}

/**
 * Confirms the claim was signed by the key for this classic address.
 * @param proof - Address, public key, signature, and timestamp from the browser.
 */
export function verifyFaucetProof(proof: FaucetWalletProof): boolean {
  if (!Number.isFinite(proof.issuedAt)) return false;
  if (Math.abs(Date.now() - proof.issuedAt) > MAX_SKEW_MS) return false;
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(proof.address)) return false;

  let derived = "";
  try {
    derived = deriveAddress(proof.publicKey);
  } catch {
    return false;
  }
  if (derived !== proof.address) return false;

  try {
    return verify(
      utf8ToHex(buildFaucetMessage(proof.address, proof.issuedAt)),
      proof.signature,
      proof.publicKey,
    );
  } catch {
    return false;
  }
}
