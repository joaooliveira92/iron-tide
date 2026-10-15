import type {
  RecoverCampaignResponse,
  ReplayCampaignResponse,
  VerifyCampaignResponse,
} from "../../../shared/continuity-contract.js";

export interface RecentFile {
  readonly path: string;
  readonly campaignIdentity: string;
  readonly activeRevision: number;
  readonly lastOpened: number;
}

export type OperationKind = "verify" | "replay" | "recover";

export type OperationResult =
  | { readonly kind: "verify"; readonly response: VerifyCampaignResponse }
  | { readonly kind: "replay"; readonly response: ReplayCampaignResponse }
  | { readonly kind: "recover"; readonly response: RecoverCampaignResponse }
  | { readonly kind: "error"; readonly message: string };
