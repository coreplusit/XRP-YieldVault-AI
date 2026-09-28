import { DELEGATION_STORAGE_KEY } from "@/lib/governance/delegation";

/** localStorage keys wiped by Pitch Mode “Reset Demo State”. */
export const PITCH_DEMO_STORAGE_KEYS = [
  DELEGATION_STORAGE_KEY,
  "yieldvault.pitch.widget.open",
  "yieldvault.pitch.step",
] as const;

/**
 * Clears pitch / delegation local state so demos can restart cleanly.
 * Dispatches the delegation-change event so hooks refresh instantly.
 */
export function resetPitchDemoState(): void {
  if (typeof window === "undefined") return;

  for (const key of PITCH_DEMO_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }

  window.dispatchEvent(new Event("yieldvault-delegation-change"));
  window.dispatchEvent(new Event("yieldvault-pitch-reset"));
}
