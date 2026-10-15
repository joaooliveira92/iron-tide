import type { CampaignState } from "@bluewave/campaign";

/**
 * In-memory registry from `sessionId` to the live campaign a `compileCampaign`
 * or (later ticket) `loadCampaign` opened. Electron's main process is a
 * single long-lived Node process for the app's lifetime, so a module-level
 * `Map` is the idiomatic store here — no persistence of its own; the
 * authoritative record on disk is always the `SaveStore` package at
 * `saveDir`. `inspectCampaign` (ticket 12) reads from this registry;
 * `commitMonth`/`closeCampaign` (later tickets) will update/remove from it.
 */
export interface CampaignSessionRecord {
  readonly sessionId: string;
  readonly saveDir: string;
  readonly playerSlotId: string;
  /**
   * The player-chosen `CampaignConfiguration.campaignSeed` from `compileCampaign`
   * (ticket 12) — kept on the session record (not just consumed at compile
   * time) so `commitMonth` (ticket 13) has a stable, non-ambient root to
   * derive each month's deterministic `MonthExecutor` random seed from
   * (ENGINEERING-CONTRACT "Determinism": no `Math.random()`/wall-clock in
   * authoritative packages). `CampaignSnapshot.campaignId` was considered
   * and rejected for this — it's derived from the content pack's name alone
   * (`packages/campaign/src/compiler.ts`), so two different playthroughs of
   * the same pack would collide on it and produce identical battle/research
   * random outcomes forever, which `campaignSeed` exists specifically to
   * avoid.
   */
  readonly campaignSeed: string;
  readonly month: { readonly month: number; readonly year: number };
  readonly state: CampaignState;
}

const sessions = new Map<string, CampaignSessionRecord>();

export function registerCampaignSession(record: CampaignSessionRecord): void {
  sessions.set(record.sessionId, record);
}

export function getCampaignSession(sessionId: string): CampaignSessionRecord | undefined {
  return sessions.get(sessionId);
}

export function removeCampaignSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/** Test-only: clears every registered session so test files don't leak state into each other. */
export function clearCampaignSessionsForTest(): void {
  sessions.clear();
}
