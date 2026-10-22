import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { tacticalTimePolicyId } from "./tacticalTime.js";

export interface TacticalClockParams {
  battleId: string;
  battleStartCampaignTime: string;
  maximumBattleMinutes?: number;
  tacticalTimePolicyVersion?: string;
}
export interface TacticalClockSnapshot {
  battleId: string;
  battleStartCampaignTime: string;
  maximumBattleMinutes: number;
  tacticalTimePolicyVersion: string;
  currentBattleMinute: number;
  currentSubstep: number;
  pauseState: boolean;
  commandCutoffState: boolean;
  clockHash: string;
}

export class TacticalClock {
  readonly battleId: string;
  readonly battleStartCampaignTime: string;
  readonly maximumBattleMinutes: number;
  readonly tacticalTimePolicyVersion: string;
  currentBattleMinute = 0;
  currentSubstep = 0;
  pauseState = false;
  commandCutoffState = false;
  clockHash: string;

  constructor(p: TacticalClockParams) {
    if (!p.battleId || !p.battleStartCampaignTime)
      throw new BluewaveError("INVALID_TACTICAL_CLOCK", { code: "INVALID_TACTICAL_CLOCK", p });
    this.battleId = p.battleId;
    this.battleStartCampaignTime = p.battleStartCampaignTime;
    this.maximumBattleMinutes = p.maximumBattleMinutes ?? 360;
    if (!Number.isInteger(this.maximumBattleMinutes) || this.maximumBattleMinutes <= 0)
      throw new BluewaveError("INVALID_TACTICAL_CLOCK", { code: "INVALID_TACTICAL_CLOCK", p });
    this.tacticalTimePolicyVersion = p.tacticalTimePolicyVersion ?? tacticalTimePolicyId;
    this.clockHash = this.computeHash();
  }
  get elapsedTacticalMilliseconds(): number {
    return this.currentBattleMinute * 60_000 + this.currentSubstep * 1_000;
  }
  get tacticalTimePolicyId(): string {
    return this.tacticalTimePolicyVersion;
  }

  advanceSubstep(): void {
    if (this.pauseState) return;
    if (this.currentSubstep < 59) this.currentSubstep++;
    else {
      this.currentSubstep = 0;
      this.currentBattleMinute++;
    }
    this.commandCutoffState = false;
    this.clockHash = this.computeHash();
  }
  setPause(p: boolean) {
    this.pauseState = p;
    this.clockHash = this.computeHash();
  }
  toImmutableProjection(): Readonly<TacticalClockSnapshot> {
    return Object.freeze({
      battleId: this.battleId,
      battleStartCampaignTime: this.battleStartCampaignTime,
      maximumBattleMinutes: this.maximumBattleMinutes,
      tacticalTimePolicyVersion: this.tacticalTimePolicyVersion,
      currentBattleMinute: this.currentBattleMinute,
      currentSubstep: this.currentSubstep,
      pauseState: this.pauseState,
      commandCutoffState: this.commandCutoffState,
      clockHash: this.clockHash,
    });
  }

  computeHash(): string {
    return sha256Hex(
      canonicalSerialize({
        battleId: this.battleId,
        minute: this.currentBattleMinute,
        substep: this.currentSubstep,
        elapsed: this.elapsedTacticalMilliseconds,
        start: this.battleStartCampaignTime,
        maxMinutes: this.maximumBattleMinutes,
        pause: this.pauseState,
        policy: this.tacticalTimePolicyVersion,
      }),
    );
  }
}
