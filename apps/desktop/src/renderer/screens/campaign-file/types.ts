import type {
  RecoverCampaignResponse,
  ReplayCampaignResponse,
  VerifyCampaignResponse,
} from "../../../shared/continuity-contract.js";

export type OperationKind = "verify" | "replay" | "recover";

export type OperationResult =
  | { readonly kind: "verify"; readonly response: VerifyCampaignResponse }
  | { readonly kind: "replay"; readonly response: ReplayCampaignResponse }
  | { readonly kind: "recover"; readonly response: RecoverCampaignResponse }
  | { readonly kind: "error"; readonly message: string };
