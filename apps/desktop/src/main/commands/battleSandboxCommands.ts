import { campaignMonthId } from "@bluewave/campaign";
import type { CampaignSnapshot, NationState, WarDeclaration } from "@bluewave/campaign";
import type { BattleManifest, BattleResolution } from "@bluewave/campaign-engine";
import { generateBattles, resolveBattleAuto } from "@bluewave/combat";
import { SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { resolveCampaignBattleReadiness, resolveShipStrength } from "@bluewave/phase-engine";
import { Effect, Option } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  GenerateBattleResult,
  ResolveBattleResult,
  SeedCampaignBattleDrillResult,
} from "../../shared/campaign-command-contract.js";
import {
  BattleIdPayloadSchema,
  GenerateBattlePayloadSchema,
  ResolveTacticalBattlePayloadSchema,
  SeedCampaignBattleDrillPayloadSchema,
} from "../../shared/campaignCommandSchemas.js";
import { isBattleSandboxEnabled } from "../debugGate.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { withSchema } from "../runtime/commandProgram.js";
import { toSaveableState } from "../saveHelpers.js";

/**
 * Debug-only Tactical Sandbox commands (ADR-0057), as native `CommandProgram`s
 * (INC-5; ADR-0159).
 *
 * The sandbox must be able to show a battle on demand, but a real campaign can
 * never reach contact: `generateBattles` only yields a mission when both sides
 * of a war have ships in the SAME area, and movement is not implemented in the
 * desktop app. So generation runs on an EPHEMERAL COPY of the session snapshot
 * in which the war's attacker fleets have been placed in a shared area. The
 * session's own snapshot, its hash, its saves and the pending-command queue are
 * never read for write or mutated (R3) — everything here is observational.
 *
 * Generation and auto-resolution call the SAME engine entry points, with the
 * same versions and seed shape, as the month executor's `battle_generation` /
 * `battle_resolution` phases (`phase-engine/src/month.ts`), so a sandbox result
 * matches what a real turn would produce for the same ships.
 *
 * The debug gate (`isBattleSandboxEnabled`) and every session read/register go
 * through the service graph; there is no injected `*Deps` object anymore.
 */

// `@bluewave/combat`'s root re-exports the legacy resolver `BattleManifest` under this
// name, shadowing the B-1 generation manifest, so derive the real one from its producer.
type CombatManifest = ReturnType<typeof generateBattles>["manifests"][number];

/** What the sandbox keeps between `generateBattle` and `resolveBattle`. */
interface StoredBattle {
  readonly sessionId: string;
  readonly snapshot: CampaignSnapshot;
  readonly manifest: CombatManifest;
  readonly campaignMonth: string;
  readonly seed: string;
}

/**
 * The engine's eligibility floors (`FLEET_BATTLE_MIN_STRENGTH` 300 /
 * `CRUISER_BATTLE_MIN_STRENGTH` 150) are compared with summed `ship.firepower`,
 * which is ~16-24 per 1880 ship — so a real turn can never generate a battle
 * with today's content (finding in `.scratch/desktop-ui-audit`). The sandbox
 * multiplies strength by this factor for the ELIGIBILITY check only; the
 * resolution itself uses the ships unchanged. Pass `strengthScale: 1` to see
 * the real behaviour.
 */
export const SANDBOX_DEFAULT_STRENGTH_SCALE = 100;

const MAX_STORED_BATTLES = 32;
const stored = new Map<string, StoredBattle>();

function storeKey(sessionId: string, battleId: string): string {
  return `${sessionId}::${battleId}`;
}

/**
 * Drops entries whose session has closed, then caps the store so a long debug
 * session cannot grow it without bound. Session liveness is read through the
 * service graph (`CampaignSessionStore`), never the module singleton.
 */
function pruneStored(sessions: CampaignSessionStore["Service"]): Effect.Effect<void> {
  return Effect.gen(function* () {
    for (const [key, entry] of stored) {
      if (Option.isNone(yield* Effect.option(sessions.get(entry.sessionId)))) stored.delete(key);
    }
    while (stored.size >= MAX_STORED_BATTLES) {
      const oldest = stored.keys().next().value;
      if (oldest === undefined) break;
      stored.delete(oldest);
    }
  });
}

export function clearBattleSandboxForTest(): void {
  stored.clear();
}

function rejected(reason: string, ...diagnostics: string[]): BridgeResult<never> {
  return { outcome: "rejected", reason, diagnostics };
}

function debugOnly(): BridgeResult<never> | null {
  return isBattleSandboxEnabled()
    ? null
    : {
        outcome: "rejected",
        reason: "DEBUG_ONLY",
        diagnostics: ["The Tactical Sandbox is only available in a debug build."],
      };
}

// ephemeral co-location (pure)

function liveAreas(nation: NationState | undefined): Set<string> {
  const areas = new Set<string>();
  for (const fleet of nation?.fleets ?? []) {
    for (const ship of fleet.ships) {
      if (!ship.isUnderConstruction) areas.add(ship.locationAreaId);
    }
  }
  return areas;
}

/**
 * `resolveBattleAuto` fails closed on a committed ship with no compiled design,
 * and the engine's eligibility check never looks for one. Production data now
 * links every starting ship, but a save or future content can still carry a
 * design-less ship; on the temporary copy such ships are treated as unavailable,
 * and reported, rather than aborting the run.
 */
export function excludeUndesignedShips(snapshot: CampaignSnapshot): {
  readonly snapshot: CampaignSnapshot;
  readonly excluded: readonly string[];
} {
  const excluded: string[] = [];
  const nations = new Map(snapshot.nations);
  for (const [nationId, nation] of snapshot.nations) {
    let changed = false;
    const fleets = nation.fleets.map((fleet) => ({
      ...fleet,
      ships: fleet.ships.map((ship) => {
        if (ship.isUnderConstruction || snapshot.designs.has(ship.designVersionId)) return ship;
        excluded.push(ship.id);
        changed = true;
        return { ...ship, isUnderConstruction: true };
      }),
    }));
    if (changed) nations.set(nationId, { ...nation, fleets });
  }
  return excluded.length === 0
    ? { snapshot, excluded }
    : { snapshot: { ...snapshot, nations }, excluded: excluded.sort() };
}

export interface ColocationResult {
  readonly snapshot: CampaignSnapshot;
  readonly areaId: string;
  /** True when the attacker had to be moved; false when both sides already shared the area. */
  readonly moved: boolean;
}

/**
 * Returns a snapshot in which the war's attacker and defender share an area.
 * If they already do, the input is returned unchanged. Otherwise every
 * completed attacker ship and fleet is relocated to `areaId` (default: the
 * first area, in sorted order, where the defender has ships). Never mutates
 * the input.
 */
export function colocateWarSides(
  snapshot: CampaignSnapshot,
  attackerId: string,
  defenderId: string,
  requestedAreaId: string | undefined,
): ColocationResult | { readonly error: string; readonly detail: string } {
  const attacker = snapshot.nations.get(attackerId);
  const defender = snapshot.nations.get(defenderId);
  const attackerAreas = liveAreas(attacker);
  const defenderAreas = liveAreas(defender);
  if (attackerAreas.size === 0) {
    return { error: "NO_ATTACKER_FORCES", detail: `${attackerId} has no completed ships.` };
  }
  if (defenderAreas.size === 0) {
    return { error: "NO_DEFENDER_FORCES", detail: `${defenderId} has no completed ships.` };
  }

  // Already in contact (and, if an area was asked for, in that area): nothing to move.
  const shared = [...attackerAreas].filter((a) => defenderAreas.has(a)).sort();
  if (shared.length > 0 && (requestedAreaId === undefined || shared.includes(requestedAreaId))) {
    return { snapshot, areaId: requestedAreaId ?? (shared[0] as string), moved: false };
  }

  if (requestedAreaId !== undefined && !defenderAreas.has(requestedAreaId)) {
    return {
      error: "AREA_NOT_DEFENDED",
      detail: `${defenderId} has no ships in ${requestedAreaId}; pick an area where it does.`,
    };
  }
  const target = requestedAreaId ?? ([...defenderAreas].sort()[0] as string);

  const nations = new Map(snapshot.nations);
  nations.set(attackerId, {
    ...(attacker as NationState),
    fleets: (attacker as NationState).fleets.map((fleet) => ({
      ...fleet,
      locationAreaId: target,
      ships: fleet.ships.map((ship) =>
        ship.isUnderConstruction ? ship : { ...ship, locationAreaId: target },
      ),
    })),
  });
  return { snapshot: { ...snapshot, nations }, areaId: target, moved: true };
}

/**
 * The documented drill strength scale for the Campaign Battle Drill: mirrors
 * `SANDBOX_DEFAULT_STRENGTH_SCALE` (the engine's 300/150 eligibility floors
 * exceed what shipped 1880 ships sum to). It is applied to the belligerents'
 * committed `firepower` so the REAL `battle_generation` month phase admits a
 * battle; tactical auto-resolution reads ship designs, not `firepower`, so the
 * resolution itself is unchanged by the scale.
 */
export const DRILL_STRENGTH_SCALE = SANDBOX_DEFAULT_STRENGTH_SCALE;

/**
 * Multiplies the `firepower` of every completed belligerent ship in `areaId` by
 * `scale` (eligibility-only; see {@link DRILL_STRENGTH_SCALE}). Pure: never
 * mutates the input.
 */
export function scaleBelligerentFirepower(
  snapshot: CampaignSnapshot,
  nationIds: readonly string[],
  areaId: string,
  scale: number,
): CampaignSnapshot {
  const nations = new Map(snapshot.nations);
  let changed = false;
  for (const nationId of nationIds) {
    const nation = nations.get(nationId);
    if (!nation) continue;
    const fleets = nation.fleets.map((fleet) => ({
      ...fleet,
      ships: fleet.ships.map((ship) => {
        if (ship.isUnderConstruction || ship.locationAreaId !== areaId) return ship;
        changed = true;
        return { ...ship, firepower: SafeInt((ship.firepower as number) * scale) };
      }),
    }));
    nations.set(nationId, { ...nation, fleets });
  }
  return changed ? { ...snapshot, nations } : snapshot;
}

// mapping engine -> renderer shapes
function toRendererManifest(
  snapshot: CampaignSnapshot,
  manifest: CombatManifest,
  month: { readonly month: number; readonly year: number },
): BattleManifest {
  const shipOwner = new Map<string, string>();
  for (const [nationId, nation] of snapshot.nations) {
    for (const fleet of nation.fleets) {
      for (const ship of fleet.ships) shipOwner.set(ship.id, nationId);
    }
  }
  const divisionOfShip = new Map<string, string>();
  for (const division of manifest.tacticalDivisions) {
    for (const unitId of division.orderedTacticalUnitIds) {
      divisionOfShip.set(unitId, division.tacticalDivisionId);
    }
  }
  const sideFor = (sideId: "attacker" | "defender", nationId: string) => ({
    sideId,
    nationId,
    participants: manifest.persistentAssets
      .filter((shipId) => shipOwner.get(shipId) === nationId)
      .map((shipId) => ({
        shipId,
        divisionId: divisionOfShip.get(shipId) ?? "",
        nationId,
      })),
  });
  return {
    battleId: manifest.battleId,
    warId: manifest.warId,
    missionType: manifest.missionType,
    areaId: manifest.areaId,
    month,
    sides: [sideFor("attacker", manifest.attackerId), sideFor("defender", manifest.defenderId)],
    // Element instantiation (coastal/submarine/mine/air/...) is not evaluated by
    // the desktop sandbox; labelled as such rather than shown as real zeros.
    elementInstantiation: {
      step: "instantiate",
      outcome: "noop",
      reason: "NOT_EVALUATED_BY_DESKTOP_SANDBOX",
      coastalElementCount: 0,
      coastalElementReason: "",
      submarineElementCount: 0,
      submarineElementReason: "",
      mineElementCount: 0,
      mineElementReason: "",
      airElementCount: 0,
      airElementReason: "",
      missileElementCount: 0,
      missileElementReason: "",
      samCiwsElementCount: 0,
      samCiwsElementReason: "",
      jetElementCount: 0,
      jetElementReason: "",
      radarElementCount: 0,
      radarElementReason: "",
      ewElementCount: 0,
      ewElementReason: "",
    },
    manifestHash: manifest.manifestHash,
  };
}

/**
 * The player's first active war, for callers that do not name one (the
 * Simulation Battle Arena). Deterministic: filtered to wars the player is a
 * party to and ordered by war id, so the same campaign always resolves the same
 * war.
 */
function pickPlayerActiveWar(
  wars: readonly WarDeclaration[],
  playerSlotId: string,
): WarDeclaration | undefined {
  return wars
    .filter(
      (war) =>
        (war.status === "ACTIVE" || war.status === "DECLARED_NOT_ACTIVE") &&
        (war.attackerSideMembers.includes(playerSlotId) ||
          war.defenderSideMembers.includes(playerSlotId)),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

/**
 * Generates an engagement on an ephemeral, co-located copy of the session's
 * snapshot (ADR-0057) as a native `CommandProgram`. Reachable-mission
 * generation draws no randomness (month.ts, B-1), so `randomDecisions` is empty,
 * and the campaign snapshot, its hash, its saves and the command queue are never
 * touched (R3).
 */
export const generateBattleProgram = withSchema(GenerateBattlePayloadSchema, (payload) =>
  Effect.gen(function* () {
    const blocked = debugOnly();
    if (blocked) return blocked;

    const sessions = yield* CampaignSessionStore;
    const record = yield* sessions.get(payload.sessionId);

    const snapshot = record.state.snapshot;
    const war =
      payload.warId !== undefined
        ? snapshot.wars.wars.find((w) => w.id === payload.warId)
        : pickPlayerActiveWar(snapshot.wars.wars, record.playerSlotId);
    if (!war) {
      const known = snapshot.wars.wars.map((w) => w.id);
      return rejected(
        "WAR_NOT_FOUND",
        payload.warId !== undefined
          ? `No war ${payload.warId} in this campaign.`
          : `No active war for ${record.playerSlotId}.`,
        known.length === 0
          ? "No wars exist yet — declare war on the Diplomacy screen and advance a month first."
          : `Known wars: ${known.join(", ")}`,
      );
    }
    if (war.status !== "ACTIVE" && war.status !== "DECLARED_NOT_ACTIVE") {
      return rejected("WAR_NOT_ACTIVE", `War ${war.id} is ${war.status}.`);
    }

    const designed = excludeUndesignedShips(snapshot);
    const colocated = colocateWarSides(
      designed.snapshot,
      war.attackerId,
      war.defenderId,
      payload.areaId,
    );
    if ("error" in colocated) return rejected(colocated.error, colocated.detail);

    const campaignMonth = campaignMonthId(
      snapshot.startYear,
      snapshot.startMonth,
      snapshot.turnNumber as number,
    );
    const seed = `${record.campaignSeed}:month:${String(snapshot.turnNumber)}`;
    const working = colocated.snapshot;
    const strengthScale = payload.strengthScale ?? SANDBOX_DEFAULT_STRENGTH_SCALE;

    const generation = generateBattles({
      snapshot: working,
      campaignMonth,
      campaignSeed: seed,
      rngVersion: "1",
      formulaVersion: "1",
      rulesetVersion: snapshot.rulesetVersion,
      contentVersion: "0.1.0",
      resolveStrength: (shipId) => resolveShipStrength(working, shipId) * strengthScale,
      resolveShipType: () => "BB",
      resolveReadiness: (shipId) => resolveCampaignBattleReadiness(working, shipId),
    });

    const index = generation.manifests.findIndex(
      (m) => m.warId === war.id && m.areaId === colocated.areaId,
    );
    const manifest = generation.manifests[index];
    if (manifest === undefined) {
      return rejected(
        "NO_ELIGIBLE_BATTLE",
        `The engine produced no battle for ${war.id} in ${colocated.areaId}.`,
        strengthScale === 1
          ? "Strength scale is 1 (real values): the engine's 300/150 strength floors exceed what 1880 ships sum to, so this is expected."
          : "Rejected opportunities: " + generation.rejections.join(", "),
      );
    }

    yield* pruneStored(sessions);
    stored.set(storeKey(payload.sessionId, manifest.battleId), {
      sessionId: payload.sessionId,
      snapshot: working,
      manifest,
      campaignMonth,
      seed,
    });

    const value: GenerateBattleResult = {
      manifest: toRendererManifest(working, manifest, record.month),
      // Reachable-mission generation draws no randomness (month.ts, B-1).
      randomDecisions: [],
    };
    return {
      outcome: "success" as const,
      value,
      diagnostics: [
        ...(colocated.moved
          ? [
              `Sandbox scenario: ${war.attackerId}'s fleets were placed in ${colocated.areaId} on a temporary copy; the campaign itself is unchanged.`,
            ]
          : []),
        ...(designed.excluded.length > 0
          ? [
              `Sandbox scenario: ${designed.excluded.join(", ")} treated as unavailable on the temporary copy — no compiled design (content data defect).`,
            ]
          : []),
        ...(strengthScale > 1
          ? [
              `Sandbox scenario: ship strength is scaled x${strengthScale} for the engine's eligibility floors only (real turns cannot reach them with current content).`,
            ]
          : []),
      ],
    };
  }),
);

/**
 * Auto-resolves a previously generated battle into a partitioned, deterministic
 * result, as a native `CommandProgram`. The sandbox applies no campaign state,
 * so the reported war score change is always 0.
 */
export const resolveBattleProgram = withSchema(BattleIdPayloadSchema, (payload) =>
  Effect.gen(function* () {
    const blocked = debugOnly();
    if (blocked) return blocked;

    const sessions = yield* CampaignSessionStore;
    yield* sessions.get(payload.sessionId);

    const entry = stored.get(storeKey(payload.sessionId, payload.battleId));
    if (!entry) {
      return rejected(
        "BATTLE_NOT_GENERATED",
        `Battle ${payload.battleId} has not been generated in this session. Generate an engagement first.`,
      );
    }

    const { snapshot, manifest } = entry;
    const attacker = snapshot.nations.get(manifest.attackerId);
    const defender = snapshot.nations.get(manifest.defenderId);
    const strategicWeather = snapshot.strategicWeather.find((s) => s.areaId === manifest.areaId);
    if (!attacker || !defender) {
      return rejected("NATION_NOT_FOUND", "A battle participant is no longer in the campaign.");
    }
    if (!strategicWeather) {
      return rejected(
        "NO_STRATEGIC_WEATHER",
        `No committed strategic weather for ${manifest.areaId}. Weather is generated when a month is advanced; advance a month and try again.`,
      );
    }

    let result: ReturnType<typeof resolveBattleAuto>;
    try {
      result = resolveBattleAuto({
        battleId: manifest.battleId,
        areaId: manifest.areaId,
        campaignMonth: entry.campaignMonth,
        manifest,
        attacker: {
          nationId: attacker.id,
          ships: attacker.fleets.flatMap((f) => f.ships),
          designs: snapshot.designs,
          divisions: attacker.divisions,
        },
        defender: {
          nationId: defender.id,
          ships: defender.fleets.flatMap((f) => f.ships),
          designs: snapshot.designs,
          divisions: defender.divisions,
        },
        strategicWeather,
        campaignSeed: entry.seed,
        rulesetVersion: snapshot.rulesetVersion,
        formulaVersion: manifest.formulaVersion,
        rngVersion: manifest.rngVersion,
      });
    } catch (error) {
      // Engine failures are fail-closed with a stable code; surface it verbatim.
      const code =
        error !== null && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "BATTLE_AUTO_RESOLUTION_FAILED";
      return rejected(code, error instanceof Error ? error.message : "Auto-resolution failed.");
    }

    const shipsOf = (survivors: readonly string[], sunk: readonly string[]) => ({
      ships: [
        ...survivors.map((shipId) => ({ shipId, outcome: "survived" })),
        ...sunk.map((shipId) => ({ shipId, outcome: "sunk" })),
      ].sort((a, b) => a.shipId.localeCompare(b.shipId)),
    });
    const resolution: BattleResolution = {
      battleId: manifest.battleId,
      missionOutcome: { winner: result.winnerId, outcomeKind: result.battleEndReason },
      // The sandbox applies no campaign state, so no war score is computed.
      warScoreChange: 0,
      attacker: shipsOf(result.attackerSurvivorIds, result.attackerSunkIds),
      defender: shipsOf(result.defenderSurvivorIds, result.defenderSunkIds),
    };
    const value: ResolveBattleResult = { resolution };
    return {
      outcome: "success" as const,
      value,
      diagnostics: [
        "Sandbox result: no campaign state was changed, so war score change is reported as 0.",
      ],
    };
  }),
);

/**
 * Debug-only Campaign Battle Drill (the desktop E2E acceptance slice), as a
 * native `CommandProgram`. Unlike the observational sandbox commands above,
 * this one INTENTIONALLY mutates the live session: it prepares the snapshot so
 * the REAL month phases (`battle_generation` order 7.5 + `battle_resolution`
 * order 8) generate and resolve a battle on the next month advance, applying
 * real consequences (war score, per-ship losses, battle history).
 *
 * It never fabricates a battle or its outcome: generation is left to the month's
 * own `generateBattles` call. The drill only does what a real turn cannot do with
 * today's content:
 *   - co-locates the war's completed fleets (`colocateWarSides`) — movement is
 *     not implemented in the desktop app;
 *   - scales the belligerents' committed `firepower` for the engine's 300/150
 *     eligibility floors (`DRILL_STRENGTH_SCALE`) — production ships sum below
 *     them;
 *   - marks ships with no compiled design as unavailable (the same
 *     `excludeUndesignedShips` used by the sandbox) so tactical auto-resolution
 *     can promote every participant.
 *
 * Gated by `isBattleSandboxEnabled()` and validated at the IPC boundary; a
 * normal build rejects with `DEBUG_ONLY`. The prepared snapshot is registered
 * as the live session state through `CampaignSessionStore`, never the module
 * singleton.
 */
export const seedCampaignBattleDrillProgram = withSchema(
  SeedCampaignBattleDrillPayloadSchema,
  (payload) =>
    Effect.gen(function* () {
      const blocked = debugOnly();
      if (blocked) return blocked;

      const sessions = yield* CampaignSessionStore;
      const record = yield* sessions.get(payload.sessionId);

      const snapshot = record.state.snapshot;
      const war =
        payload.warId !== undefined
          ? snapshot.wars.wars.find((w) => w.id === payload.warId)
          : pickPlayerActiveWar(snapshot.wars.wars, record.playerSlotId);
      if (!war) {
        return rejected(
          "WAR_NOT_FOUND",
          payload.warId !== undefined
            ? `No war ${payload.warId} in this campaign.`
            : `No active war for ${record.playerSlotId}.`,
        );
      }
      if (war.status !== "ACTIVE" && war.status !== "DECLARED_NOT_ACTIVE") {
        return rejected("WAR_NOT_ACTIVE", `War ${war.id} is ${war.status}.`);
      }

      const designed = excludeUndesignedShips(snapshot);
      const colocated = colocateWarSides(
        designed.snapshot,
        war.attackerId,
        war.defenderId,
        undefined,
      );
      if ("error" in colocated) return rejected(colocated.error, colocated.detail);

      const prepared = scaleBelligerentFirepower(
        colocated.snapshot,
        [war.attackerId, war.defenderId],
        colocated.areaId,
        DRILL_STRENGTH_SCALE,
      );

      // Persist the prepared snapshot as the live session state (re-hashing the
      // envelope the same way `commitMonth` does), so the next real month advance
      // executes against it.
      const envelope = createEnvelope("campaign-snapshot", prepared.compatibilityVersion, prepared);
      const nextState = toSaveableState({
        snapshot: prepared,
        envelope,
        rawHash: record.state.rawHash,
      });
      yield* sessions.register({ ...record, state: nextState });

      const value: SeedCampaignBattleDrillResult = {
        warId: war.id,
        areaId: colocated.areaId,
        strengthScale: DRILL_STRENGTH_SCALE,
        moved: colocated.moved,
        excludedShipIds: designed.excluded,
      };
      return {
        outcome: "success" as const,
        value,
        diagnostics: [
          ...(colocated.moved
            ? [
                `Drill: ${war.attackerId}'s completed fleets were placed in ${colocated.areaId} (movement is not implemented).`,
              ]
            : []),
          ...(designed.excluded.length > 0
            ? [
                `Drill: ${designed.excluded.join(", ")} treated as unavailable — no compiled design (content data defect).`,
              ]
            : []),
          `Drill: belligerent firepower scaled x${DRILL_STRENGTH_SCALE} for the engine's eligibility floors only (real turns cannot reach them with current content).`,
        ],
      };
    }),
);

/**
 * The tactical minute-by-minute loop (generation -> movement -> gunnery ->
 * battle-end, driven by scripted orders) has no engine orchestrator yet: that
 * chaining is B-6's job (`.scratch/cli-battle-debug-surface/map.md`). Reject
 * honestly instead of fabricating an outcome. The payload's `scriptedOrders`
 * narrowing is the accepted INC-3 seam (a debug-gated boundary).
 */
export const resolveTacticalBattleProgram = withSchema(
  ResolveTacticalBattlePayloadSchema,
  (_payload) =>
    Effect.sync(
      () =>
        debugOnly() ??
        rejected(
          "TACTICAL_RESOLUTION_UNAVAILABLE",
          "Scripted tactical resolution needs the engine's tactical-loop orchestrator (B-6), which does not exist yet. Use auto-resolve.",
        ),
    ),
);

export const replayBattleBoundaryProgram = withSchema(BattleIdPayloadSchema, (_payload) =>
  Effect.sync(
    () =>
      debugOnly() ??
      rejected(
        "BOUNDARY_REPLAY_UNAVAILABLE",
        "Battle-boundary replay depends on the tactical-loop orchestrator (B-6), which does not exist yet.",
      ),
  ),
);
