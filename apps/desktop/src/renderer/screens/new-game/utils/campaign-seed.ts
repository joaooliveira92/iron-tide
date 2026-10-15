/**
 * Default campaign seed for a fresh campaign. The engine's canonical
 * `CampaignConfiguration` contract requires a 32-lowercase-hex u128 seed
 * (DESIGN-03 §3), so this derives one from 16 random bytes rather than a
 * human-readable tag.
 */
export function defaultCampaignSeed(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
