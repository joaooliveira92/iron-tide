/**
 * "Package" = `@bluewave/persistence`'s `SaveStore` save directory — not
 * the older `.bluewave` content-authoring format in `main/project.ts`.
 * Grounded in `desktop-mvp` map ticket 08 and, for exact field names,
 * `OperationStatus.tsx` (the real consumer).
 */

export interface LoadCampaignResponse {
  readonly sessionId: string;
  readonly packagePath: string;
  readonly campaignIdentity: string; // CampaignSnapshot.campaignId
  readonly activeRevision: number; // CampaignSnapshot.turnNumber
}

export interface VerifyCampaignResponse {
  readonly valid: boolean;
  readonly campaignIdentity: string;
  readonly activeRevision: number;
  readonly issues: readonly string[];
}

export interface ReplayedRevision {
  readonly revision: number;
  readonly matched: boolean;
  readonly expectedHash: string;
  readonly actualHash: string;
}

export interface ReplayCampaignResponse {
  readonly matched: boolean;
  readonly revisions: readonly ReplayedRevision[];
}

export interface RecoverCampaignResponse {
  readonly recovered: boolean;
  readonly activeRevision: number | null;
  readonly notes: readonly string[];
}

/** One entry of the main-process recent-campaigns list. */
export interface RecentCampaignEntry {
  readonly packagePath: string;
  readonly campaignIdentity: string;
  readonly activeRevision: number;
  readonly lastOpened: number;
  /** False when the package directory no longer exists on disk. */
  readonly available: boolean;
}
