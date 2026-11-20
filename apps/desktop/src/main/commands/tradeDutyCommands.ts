import {
  buildFleetTradeProjection,
  type FleetDivisionView,
  type FleetTradeProjection,
} from "@bluewave/campaign-engine";
import {
  nationIsAtWar,
  TRADE_DUTY_DORMANT,
  type TradeDutyDesign,
  type TradeProtectionRules,
} from "@bluewave/campaign";
import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { TradeDutyOutcome } from "../../shared/fleet-contract.js";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import type { CommandHandler } from "../runtime/commandProgram.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";
import { submitPlayerCommand } from "./playerCommandSupport.js";

export function tradeProjectionFor(
  record: CampaignSessionRecord,
  rules: TradeProtectionRules | undefined,
  divisions: readonly FleetDivisionView[],
): FleetTradeProjection | undefined {
  const snapshot = record.state.snapshot;
  const nation = snapshot.nations.get(record.playerSlotId);
  if (rules === undefined || nation === undefined) return undefined;
  const designs = new Map<string, TradeDutyDesign>();
  for (const [id, design] of snapshot.designs) {
    designs.set(id, {
      hullType: design.hullType,
      normalizedSpeedUms: Number(design.normalizedSpeedUms),
      ...(design.shortRange === true ? { shortRange: true as const } : {}),
    });
  }
  const shipNames = new Map(
    divisions.flatMap((division) =>
      division.ships.map((ship) => [ship.shipId, ship.name] as const),
    ),
  );
  return buildFleetTradeProjection({
    rules,
    nation,
    designs,
    atWar: nationIsAtWar(snapshot.wars.wars, nation.id),
    shipNames,
  });
}

export const submitTradeDutyProgram: CommandHandler<"submitTradeDuty"> = (payload) =>
  Effect.gen(function* () {
    const contentArtifact = yield* ContentArtifact;
    if ((yield* contentArtifact.loadTradeProtectionRules()) === undefined) {
      return {
        outcome: "rejected" as const,
        reason: TRADE_DUTY_DORMANT,
        diagnostics: ["Trade duty is not available in this campaign"],
      };
    }
    const queued = yield* submitPlayerCommand({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      transportRequestId: payload.transportRequestId,
      build: (record) => {
        const shipIds = [...payload.shipIds];
        return {
          body: {
            type: "SetTradeDuty" as const,
            nationId: record.playerSlotId,
            shipIds,
            duty: payload.duty,
          },
          discriminator: `${payload.duty}\u0000${[...shipIds].sort().join("\u0000")}`,
        };
      },
    });
    const result: BridgeResult<TradeDutyOutcome> =
      queued.outcome === "success"
        ? {
            ...queued,
            value: {
              commandId: queued.value.commandId,
              duty: payload.duty,
              shipCount: payload.shipIds.length,
              appliedOnNextTurn: true,
            },
          }
        : queued;
    return result;
  });
