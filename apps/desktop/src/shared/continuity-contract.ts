export interface LoadCampaignResponse {
  readonly sessionId: string;
  readonly packagePath: string;
  readonly campaignIdentity: string;
  readonly activeRevision: number;
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

export interface RecentCampaignEntry {
  readonly packagePath: string;
  readonly campaignIdentity: string;
  readonly activeRevision: number;
  readonly lastOpened: number;
  readonly available: boolean;
}
