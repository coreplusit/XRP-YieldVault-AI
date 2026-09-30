/**
 * Canonical message the wallet signs before the server issues a session token.
 * @param xrplAddress - Classic address that must match the signature.
 * @param issuedAt - Unix milliseconds chosen by the client.
 */
export function buildSessionMessage(
  xrplAddress: string,
  issuedAt: number,
): string {
  return `yieldvault-session:${issuedAt}:${xrplAddress}`;
}

/**
 * UTF-8 to hex without Node Buffer so the browser and server match.
 * @param value - Plain message string.
 */
export function utf8ToHex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
