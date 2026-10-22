import type { CampaignState } from "@bluewave/campaign";

export interface CampaignSessionRecord {
  readonly sessionId: string;
  readonly saveDir: string;
  readonly playerSlotId: string;
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

export function clearCampaignSessionsForTest(): void {
  sessions.clear();
}
