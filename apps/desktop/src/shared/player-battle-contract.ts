import type { PlayerBattleView } from "@bluewave/combat/battleResolution";

export interface PlayerBattleDivisionOrderDto {
  readonly divisionId: string;
  readonly stance: "ENGAGE" | "HOLD" | "WITHDRAW";
  readonly speedPercent: number;
}

export interface PlayerBattleResultDto {
  readonly battleId: string;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly attackerLosses: readonly string[];
  readonly defenderLosses: readonly string[];
  readonly damageReport: Readonly<Record<string, number>>;
}

export interface StartPlayerBattleResult {
  readonly view: PlayerBattleView;
  readonly sessionHash: string;
  readonly resumed: boolean;
  readonly lastOrders: readonly PlayerBattleDivisionOrderDto[];
}

export interface AdvancePlayerBattleResult {
  readonly view: PlayerBattleView;
  readonly sessionHash: string;
  readonly result: PlayerBattleResultDto | null;
}

export interface FinishPlayerBattleResult {
  readonly result: PlayerBattleResultDto;
}
