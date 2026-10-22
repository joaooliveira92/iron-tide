import type {
  BattleManifest,
  BattleResolution,
  OpeningBriefingProjection,
  PlayerProjection,
  RandomDecisionRecord,
  TacticalBattleOutcome,
} from "@bluewave/campaign-engine";
import type { BattleHistoryView, StrategicMapView } from "@bluewave/campaign-engine";
import type { BridgeResult } from "./bridge-contract.js";
import type { CampaignCommandMap, CampaignCommandName } from "./campaign-command-descriptors.js";

export type { CampaignCommandMap, CampaignCommandName } from "./campaign-command-descriptors.js";

export interface GenerateBattleResult {
  readonly manifest: BattleManifest;
  readonly randomDecisions: readonly RandomDecisionRecord[];
}

export interface ResolveBattleResult {
  readonly resolution: BattleResolution;
}

export interface ResolveTacticalBattleResult {
  readonly outcome: TacticalBattleOutcome;
  readonly randomDecisions?: readonly RandomDecisionRecord[];
}

export interface SeedCampaignBattleDrillResult {
  readonly warId: string;
  readonly areaId: string;
  readonly strengthScale: number;
  readonly moved: boolean;
  readonly excludedShipIds: readonly string[];
}

export interface CompileCampaignResult {
  readonly sessionId: string;
}

export interface InspectCampaignResult {
  readonly projection: PlayerProjection;
}

export interface InspectOpeningBriefingResult {
  readonly projection: OpeningBriefingProjection;
}

export interface InspectMapResult {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
  readonly playerNationId: string;
  readonly strategic: StrategicMapView;
}

export interface InspectBattleHistoryResult {
  readonly revision: number;
  readonly history: BattleHistoryView;
}

export interface CopyCampaignResult {
  readonly revision: number;
  readonly location: string;
}

export interface SaveCampaignResult {
  readonly revision: number;
}

export type CommitMonthPayload = CampaignCommandMap["commitMonth"]["payload"];
export type GenerateBattlePayload = CampaignCommandMap["generateBattle"]["payload"];
export type ResolveBattlePayload = CampaignCommandMap["resolveBattle"]["payload"];
export type ResolveTacticalBattlePayload = CampaignCommandMap["resolveTacticalBattle"]["payload"];
export type ReplayBattleBoundaryPayload = CampaignCommandMap["replayBattleBoundary"]["payload"];
export type SeedCampaignBattleDrillPayload =
  CampaignCommandMap["seedCampaignBattleDrill"]["payload"];
export type WriteUiStatePayload = CampaignCommandMap["writeUiState"]["payload"];
export type AnswerDecisionPayload = CampaignCommandMap["answerDecision"]["payload"];
export type SubmitBattleResultPayload = CampaignCommandMap["submitBattleResult"]["payload"];
export type StartPlayerBattlePayload = CampaignCommandMap["startPlayerBattle"]["payload"];
export type AdvancePlayerBattlePayload = CampaignCommandMap["advancePlayerBattle"]["payload"];
export type FinishPlayerBattlePayload = CampaignCommandMap["finishPlayerBattle"]["payload"];
export type SubmitOfferResponsePayload = CampaignCommandMap["submitOfferResponse"]["payload"];

export interface CampaignCommandClient {
  execute<N extends CampaignCommandName>(
    command: N,
    payload: CampaignCommandMap[N]["payload"],
  ): Promise<BridgeResult<CampaignCommandMap[N]["result"]>>;
}
