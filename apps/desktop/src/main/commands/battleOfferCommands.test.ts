import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignState, CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { ResolveTurnResult } from "../../shared/campaign-command-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { loadPendingTurn, PENDING_TURN_FILENAME, savePendingTurn } from "../pendingTurn.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import type { CommandProgram } from "../runtime/commandProgram.js";
import { ContentArtifact, contentArtifactLayer } from "../runtime/contentArtifact.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import {
  abandonPendingTurnProgram,
  resolveTurnProgram,
  submitOfferResponseProgram,
} from "./resolveTurn.js";

// T-1 03 (#112): the desktop command path of a battle offer, over the compiled production campaign with a war injected
// into the session snapshot. The mechanics run under a FIXTURE-CLASS section supplied through the ContentArtifact test
// seam, exactly as the DecisionSource seam supplies decisions; the production pack now authors its own section (T-1 09,
// ADR-0254), which the "production" and "dormant" cases below exercise through the real and the section-less artifact.
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");
const SEED = "offer-command-seed-0123456789abcdef";
const AREA = "eng_home_coast";

const withOffers = Layer.effect(
  ContentArtifact,
  Effect.gen(function* () {
    const real = yield* ContentArtifact;
    return { ...real, loadBattleOfferRules: () => Effect.succeed(FIXTURE_BATTLE_OFFER_RULES) };
  }),
).pipe(Layer.provide(contentArtifactLayer()));

const offerRuntime = ManagedRuntime.make(Layer.mergeAll(desktopMainLayer(), withOffers));
const withoutSection = Layer.effect(
  ContentArtifact,
  Effect.gen(function* () {
    const real = yield* ContentArtifact;
    return { ...real, loadBattleOfferRules: () => Effect.succeed(undefined) };
  }),
).pipe(Layer.provide(contentArtifactLayer()));
const dormantRuntime = ManagedRuntime.make(Layer.mergeAll(desktopMainLayer(), withoutSection));
const productionRuntime = ManagedRuntime.make(desktopMainLayer());

async function run(
  runtime: typeof offerRuntime,
  program: CommandProgram,
  payload: unknown,
): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload)));
}

/** uk and france each field two 200-firepower ships in one area, at war. */
function warSnapshot(base: CampaignSnapshot): CampaignSnapshot {
  const nations = new Map<string, NationState>(base.nations);
  for (const id of ["uk", "france"]) {
    const nation = nations.get(id);
    if (!nation) throw new Error(`production nation ${id} missing`);
    const ships = nation.fleets
      .flatMap((fleet) => fleet.ships)
      .slice(0, 2)
      .map((ship) => ({
        ...ship,
        locationAreaId: AREA,
        firepower: SafeInt(200),
        hitPoints: ship.maxHitPoints,
        isUnderConstruction: false,
        readiness: "ACTIVE" as const,
        crewQuality: SafeInt(100),
      }));
    nations.set(id, {
      ...nation,
      fleets: [
        { id: `fleet-${id}`, nationId: id, name: `${id} fleet`, ships, locationAreaId: AREA },
      ],
    });
  }
  return {
    ...base,
    nations,
    wars: {
      ...base.wars,
      wars: [
        {
          id: "war_offer",
          attackerSideId: "side_a",
          defenderSideId: "side_d",
          attackerSideMembers: ["uk"],
          defenderSideMembers: ["france"],
          attackerWarScore: 0,
          defenderWarScore: 0,
          attackerId: "uk",
          defenderId: "france",
          startDate: "1880-01",
          status: "ACTIVE",
        },
      ],
      battles: [],
    },
  };
}

describe("battle offer commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-battle-offer-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  function registerWarSession(sessionId: string, saveDir: string) {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");
    const base = toSaveableState(output.state);
    const snapshot = warSnapshot(base.snapshot);
    const envelope = createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot);
    const state: CampaignState = toSaveableState({ snapshot, envelope, rawHash: base.rawHash });
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: SEED,
      month: { month: 1, year: 1880 },
      state,
    });
  }

  /** Re-register a session from its on-disk save, as an app reload would. */
  function reload(sessionId: string, saveDir: string) {
    const loaded = new SaveStore().load(saveDir, new DiagnosticCollector());
    if (!loaded) throw new Error("save failed to reload");
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: SEED,
      month: { month: 1, year: 1880 },
      state: loaded,
    });
  }

  const resolveTurn = async (runtime: typeof offerRuntime, sessionId: string) => {
    const result = (await run(runtime, resolveTurnProgram, {
      sessionId,
      expectedRevision: 0,
      transportRequestId: "req",
    })) as BridgeResult<ResolveTurnResult>;
    if (result.outcome !== "success") throw new Error(`resolveTurn ${result.outcome}`);
    return result.value;
  };

  const submit = (sessionId: string, fields: Record<string, unknown>) =>
    run(offerRuntime, submitOfferResponseProgram, {
      sessionId,
      expectedRevision: 0,
      transportRequestId: "req",
      ...fields,
    });

  async function suspendAtOffer(sessionId: string, saveDir: string) {
    registerWarSession(sessionId, saveDir);
    const value = await resolveTurn(offerRuntime, sessionId);
    if (value.status !== "suspended" || value.request?.kind !== "offer") {
      throw new Error(`expected an offer, got ${JSON.stringify(value).slice(0, 200)}`);
    }
    return value.request;
  }

  it("suspends a war month at an offer and persists the pending turn", async () => {
    const saveDir = join(saveRoot, "suspend");
    const request = await suspendAtOffer("s-suspend", saveDir);
    expect(request).toMatchObject({
      kind: "offer",
      missionType: "FLEET_BATTLE",
      acceptanceClass: "OPTIONAL",
      areaId: AREA,
      attackerId: "uk",
      defenderId: "france",
      playerSide: "ATTACKER",
      supportForcePresent: false,
      estimate: { model: "PERTURBED" },
    });
    expect(request.playerForce?.length).toBeGreaterThan(0);
    expect(JSON.stringify(request)).not.toMatch(/inputHash|manifest|seed/i);
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(true);
    expect(loadPendingTurn(saveDir)?.outstanding).toMatchObject({
      kind: "offer",
      phase: "battle_resolution",
      ordinal: 0,
      subjectKey: request.battleId,
    });
  });

  it("raises an offer from the section the production pack authors, with a perturbed strength-only estimate", async () => {
    registerWarSession("s-production", join(saveRoot, "production"));
    const value = await resolveTurn(productionRuntime, "s-production");
    expect(value.status).toBe("suspended");
    if (value.status !== "suspended") return;
    expect(value.request?.kind).toBe("offer");
    expect(value.request).toMatchObject({ estimate: { model: "PERTURBED" } });
  });

  it("is dormant with the section removed: the pre-existing battle request, never an offer", async () => {
    const saveDir = join(saveRoot, "dormant");
    registerWarSession("s-dormant", saveDir);
    const value = await resolveTurn(dormantRuntime, "s-dormant");
    expect(value.status).toBe("suspended");
    if (value.status !== "suspended") return;
    expect(value.request?.kind).toBe("battle");
  });

  for (const response of ["accept", "delegate"] as const) {
    it(`${response} resumes the month to the state of the non-offered run`, async () => {
      const saveDir = join(saveRoot, response);
      const request = await suspendAtOffer(`s-${response}`, saveDir);
      const answered = await submit(`s-${response}`, {
        interruptionId: request.interruptionId,
        battleId: request.battleId,
        response,
      });
      expect(answered.outcome).toBe("success");
      if (answered.outcome !== "success") return;
      expect((answered.value as ResolveTurnResult).status).toBe("completed");
      expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(false);

      const controlDir = join(saveRoot, `${response}-control`);
      registerWarSession("s-control", controlDir);
      const control = await run(offerRuntime, commitMonthProgram, {
        sessionId: "s-control",
        expectedRevision: 0,
        transportRequestId: "req",
      });
      expect(control.outcome).toBe("success");
      expect(JSON.stringify(getCampaignSession(`s-${response}`)!.state.snapshot)).toBe(
        JSON.stringify(getCampaignSession("s-control")!.state.snapshot),
      );
    });
  }

  it("resumes to the identical offer after a reload", async () => {
    const saveDir = join(saveRoot, "reload");
    const first = await suspendAtOffer("s-reload", saveDir);
    reload("s-reload", saveDir);
    const again = await resolveTurn(offerRuntime, "s-reload");
    expect(again.status === "suspended" ? again.request : null).toEqual(first);
  });

  it("refuses stale, wrong-battle, duplicate and surplus-key answers with typed reasons, leaving the offer pending", async () => {
    const saveDir = join(saveRoot, "refuse");
    const request = await suspendAtOffer("s-refuse", saveDir);
    const before = readFileSync(join(saveDir, PENDING_TURN_FILENAME), "utf8");
    const refused = async (fields: Record<string, unknown>) => {
      const result = await submit("s-refuse", fields);
      expect(result.outcome).toBe("error");
      expect(readFileSync(join(saveDir, PENDING_TURN_FILENAME), "utf8")).toBe(before);
      return result.outcome === "error" ? result.reason : "";
    };
    const base = { interruptionId: request.interruptionId, battleId: request.battleId };
    expect(await refused({ ...base, interruptionId: "stale", response: "accept" })).toBe(
      "OfferResponseStale",
    );
    expect(await refused({ ...base, battleId: "other", response: "accept" })).toBe(
      "OfferResponseWrongBattle",
    );
    expect(await refused({ ...base, response: "accept", surprise: 1 })).toBe("INVALID_PAYLOAD");

    const accepted = await submit("s-refuse", { ...base, response: "accept" });
    expect(accepted.outcome).toBe("success");
    const duplicate = await submit("s-refuse", { ...base, response: "accept" });
    expect(duplicate.outcome).toBe("error");
  });

  it("declines the battle: a declined record, released ships, the lowered war score and the turn message", async () => {
    const saveDir = join(saveRoot, "decline");
    const request = await suspendAtOffer("s-decline", saveDir);
    const answered = await submit("s-decline", {
      interruptionId: request.interruptionId,
      battleId: request.battleId,
      response: "decline",
    });
    expect(answered.outcome).toBe("success");
    if (answered.outcome !== "success") return;
    const value = answered.value as ResolveTurnResult;
    expect(value.status).toBe("completed");
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(false);

    const snapshot = getCampaignSession("s-decline")!.state.snapshot;
    // The declined record, once, with the fixture rule's cost (FLEET_BATTLE 4) and no opponent credit.
    expect(snapshot.wars.declinedBattles).toHaveLength(1);
    expect(snapshot.wars.declinedBattles?.[0]).toMatchObject({
      battleId: request.battleId,
      nationId: "uk",
      missionType: "FLEET_BATTLE",
      areaId: AREA,
      victoryPointCost: 4,
      opponentCredit: 0,
    });
    // The battle never resolved, the war score fell, and no ship stays reserved or damaged.
    expect(snapshot.wars.battles.map((b) => b.phase)).toEqual(["declined"]);
    expect(snapshot.wars.wars[0]).toMatchObject({ attackerWarScore: -4, defenderWarScore: 0 });
    const ships = [...snapshot.nations.values()].flatMap((n) => n.fleets.flatMap((f) => f.ships));
    expect(ships.some((ship) => ship.inBattleId !== undefined)).toBe(false);
    expect(ships.every((ship) => ship.hitPoints === ship.maxHitPoints)).toBe(true);

    // The player-visible turn message reports the decline and its victory-point cost.
    if (value.status !== "completed") return;
    const message = value.summary.messages.find(
      (m) => m.bodyKey === "messages.battle.declined.body",
    );
    expect(message?.interpolation).toMatchObject({
      battleId: request.battleId,
      areaId: AREA,
      victoryPointCost: 4,
    });

    // The save restores the record exactly.
    const loaded = new SaveStore().load(saveDir, new DiagnosticCollector());
    expect(JSON.stringify(loaded?.snapshot.wars.declinedBattles)).toBe(
      JSON.stringify(snapshot.wars.declinedBattles),
    );
  });

  it("refuses a decline of an operationally unavoidable offer with the typed refusal, leaving the offer pending", async () => {
    const saveDir = join(saveRoot, "unavoidable");
    const request = await suspendAtOffer("s-unavoidable", saveDir);
    const pending = loadPendingTurn(saveDir)!;
    savePendingTurn(saveDir, {
      ...pending,
      outstanding: { ...pending.outstanding!, acceptanceClass: "OPERATIONALLY_UNAVOIDABLE" },
    });
    const before = readFileSync(join(saveDir, PENDING_TURN_FILENAME), "utf8");
    const refused = await submit("s-unavoidable", {
      interruptionId: request.interruptionId,
      battleId: request.battleId,
      response: "decline",
    });
    expect(refused.outcome).toBe("error");
    expect(refused.outcome === "error" ? refused.reason : "").toBe("BATTLE_DECLINE_NOT_ALLOWED");
    expect(readFileSync(join(saveDir, PENDING_TURN_FILENAME), "utf8")).toBe(before);
    expect(
      getCampaignSession("s-unavoidable")!.state.snapshot.wars.declinedBattles,
    ).toBeUndefined();
  });

  it("abandoning the pending turn discards the offer with no state change", async () => {
    const saveDir = join(saveRoot, "abandon");
    await suspendAtOffer("s-abandon", saveDir);
    const before = getCampaignSession("s-abandon")!.state.rawHash;
    const result = await run(offerRuntime, abandonPendingTurnProgram, "s-abandon");
    expect(result.outcome).toBe("success");
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(false);
    expect(getCampaignSession("s-abandon")!.state.rawHash).toBe(before);
  });
});
