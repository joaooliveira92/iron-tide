import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  FleetScreenProjection,
  TradeDutyOutcome,
  TradeDutyRequest,
} from "../../shared/fleet-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { ContentArtifact, contentArtifactLayer } from "../runtime/contentArtifact.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import { inspectFleetScreenProgram } from "./fleetCommands.js";
import { submitTradeDutyProgram } from "./tradeDutyCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../../..", "content", "generated", "1880");

const productionRuntime = ManagedRuntime.make(
  Layer.mergeAll(desktopMainLayer(), contentArtifactLayer()),
);

const withoutSection = Layer.effect(
  ContentArtifact,
  Effect.gen(function* () {
    const real = yield* ContentArtifact;
    return { ...real, loadTradeProtectionRules: () => Effect.succeed(undefined) };
  }),
).pipe(Layer.provide(contentArtifactLayer()));

const dormantRuntime = ManagedRuntime.make(Layer.mergeAll(desktopMainLayer(), withoutSection));

type TestRuntime = typeof productionRuntime;

async function run<A>(
  runtime: TestRuntime,
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<A>> {
  return projectCommandExit(
    await runtime.runPromiseExit(programFor(program)(payload)),
  ) as BridgeResult<A>;
}

describe("trade duty commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-trade-duty-"));
  });
  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  function registerSession(
    sessionId: string,
    { nationId = "uk", atWar = true, cruisers = true } = {},
  ): void {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    if (!output) throw new Error("production pack failed to compile");
    const snapshot: CampaignSnapshot = structuredClone(output.state.snapshot);
    if (cruisers) {
      const ship = snapshot.nations
        .get(nationId)!
        .fleets.flatMap((fleet) => fleet.ships)
        .find((entry) => entry.readiness === "ACTIVE")!;
      const design = snapshot.designs.get(ship.designVersionId)!;
      snapshot.designs.set(ship.designVersionId, { ...design, hullType: "light_cruiser" });
    }
    if (atWar) {
      const opponent = [...snapshot.nations.keys()].find((id) => id !== nationId)!;
      snapshot.wars.wars.push({
        id: "war-test",
        attackerSideId: "side-a",
        defenderSideId: "side-b",
        attackerSideMembers: [nationId],
        defenderSideMembers: [opponent],
        attackerWarScore: 0,
        defenderWarScore: 0,
        attackerId: nationId,
        defenderId: opponent,
        startDate: "1880-01",
        status: "ACTIVE",
      });
    }
    const state: CampaignState = {
      snapshot,
      envelope: createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot),
      rawHash: "",
    };
    const saveable = toSaveableState(state);
    const saveDir = resolve(saveRoot, sessionId);
    new SaveStore().save(saveable, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: nationId,
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: saveable,
    });
  }

  async function fleet(runtime: TestRuntime, sessionId: string): Promise<FleetScreenProjection> {
    const result = await run<FleetScreenProjection>(runtime, inspectFleetScreenProgram, sessionId);
    if (result.outcome !== "success") throw new Error(`inspect failed: ${result.reason}`);
    return result.value;
  }

  const setDuty = (
    runtime: TestRuntime,
    sessionId: string,
    revision: number,
    duty: TradeDutyRequest,
    shipIds: string[],
  ) =>
    run<TradeDutyOutcome>(runtime, submitTradeDutyProgram, {
      sessionId,
      expectedRevision: revision,
      transportRequestId: `req-${revision}-${duty}-${shipIds.join("-")}`,
      duty,
      shipIds,
    });

  async function commit(runtime: TestRuntime, sessionId: string, revision: number) {
    const result = await run<CommitMonthResponse>(runtime, commitMonthProgram, {
      sessionId,
      expectedRevision: revision,
      transportRequestId: `commit-${revision}`,
    });
    expect(result.outcome).toBe("success");
  }

  it("projects no trade readout and refuses the command while the section is dormant", async () => {
    registerSession("dormant");
    const projection = await fleet(dormantRuntime, "dormant");
    expect(projection.trade).toBeUndefined();
    const refused = await setDuty(dormantRuntime, "dormant", projection.revision, "RAIDER", [
      "any",
    ]);
    expect(refused).toMatchObject({ outcome: "rejected", reason: "TRADE_DUTY_DORMANT" });
  });

  it("flags that the 1880 ironclads cannot contribute to the quota or raid", async () => {
    registerSession("ironclads", { cruisers: false });
    const trade = (await fleet(productionRuntime, "ironclads")).trade!;
    expect(trade.quota).toBeGreaterThan(0);
    expect(trade.ships.some((ship) => ship.assignable)).toBe(true);
    expect(trade.ships.every((ship) => !ship.contributes && !ship.canRaid)).toBe(true);
  });

  it("reads the peacetime quota as not yet in force", async () => {
    registerSession("peace", { atWar: false });
    expect((await fleet(productionRuntime, "peace")).trade!.atWar).toBe(false);
  });

  it("projects the quota, its explanation and which ships count or can raid", async () => {
    registerSession("readout");
    const trade = (await fleet(productionRuntime, "readout")).trade!;
    expect(trade.atWar).toBe(true);
    expect(trade.quota).toBeGreaterThan(0);
    expect(trade.assigned).toBe(0);
    expect(trade.shortfall).toBe(trade.quota);
    expect(trade.shortfallBp).toBe(10_000);
    expect(trade.merchantPoolBp).toBe(10_000);
    expect(trade.quotaExplanation.formulaId).toBe("fleet_trade_quota");
    expect(Number(trade.quotaExplanation.result)).toBe(trade.quota);
    expect(trade.ships.some((ship) => ship.assignable)).toBe(true);
    expect(trade.ships.every((ship) => ship.duty === null && !ship.countsTowardQuota)).toBe(true);
  });

  it("assigns trade protection, counts it in the next assessment, and clears it again", async () => {
    registerSession("assign");
    const before = await fleet(productionRuntime, "assign");
    const candidates = before
      .trade!.ships.filter((ship) => ship.assignable)
      .map((ship) => ship.shipId);
    expect(candidates.length).toBeGreaterThan(0);

    const queued = await setDuty(
      productionRuntime,
      "assign",
      before.revision,
      "TRADE_PROTECTION",
      candidates,
    );
    expect(queued).toMatchObject({
      outcome: "success",
      value: { duty: "TRADE_PROTECTION", shipCount: candidates.length, appliedOnNextTurn: true },
    });
    await commit(productionRuntime, "assign", before.revision);

    const after = await fleet(productionRuntime, "assign");
    const nation = getCampaignSession("assign")!.state.snapshot.nations.get("uk")!;
    expect(after.trade!.assigned).toBeGreaterThan(0);
    expect(nation.tradeProtection).toMatchObject({
      quota: after.trade!.quota,
      assigned: after.trade!.assigned,
    });
    expect(Number(after.trade!.assignedExplanation.result)).toBe(after.trade!.assigned);
    const held = after.trade!.ships.filter((ship) => ship.duty === "TRADE_PROTECTION");
    expect(held.length).toBe(candidates.length);

    const cleared = await setDuty(
      productionRuntime,
      "assign",
      after.revision,
      "NONE",
      held.map((ship) => ship.shipId),
    );
    expect(cleared).toMatchObject({ outcome: "success", value: { duty: "NONE" } });
    await commit(productionRuntime, "assign", after.revision);
    const final = await fleet(productionRuntime, "assign");
    expect(final.trade!.assigned).toBe(0);
    expect(final.trade!.ships.every((ship) => ship.duty === null)).toBe(true);
  });

  it("assigns raiders and reports which ones can actually raid", async () => {
    registerSession("raid");
    const before = await fleet(productionRuntime, "raid");
    const ship = before.trade!.ships.find((entry) => entry.assignable && entry.canRaid);
    expect(ship).toBeDefined();
    const queued = await setDuty(productionRuntime, "raid", before.revision, "RAIDER", [
      ship!.shipId,
    ]);
    expect(queued.outcome).toBe("success");
    await commit(productionRuntime, "raid", before.revision);
    const after = await fleet(productionRuntime, "raid");
    expect(after.trade!.ships.find((entry) => entry.shipId === ship!.shipId)?.duty).toBe("RAIDER");
    expect(
      after.divisions.flatMap((d) => d.ships).find((s) => s.shipId === ship!.shipId)?.stationCode,
    ).toBe("RD");
  });

  it("refuses a batch containing a ship the nation does not own, naming the ship", async () => {
    registerSession("refuse");
    const before = await fleet(productionRuntime, "refuse");
    const refused = await setDuty(
      productionRuntime,
      "refuse",
      before.revision,
      "TRADE_PROTECTION",
      ["not-a-ship"],
    );
    expect(refused).toMatchObject({ outcome: "rejected", reason: "TRADE_DUTY_REJECTED" });
    expect(refused.outcome === "rejected" ? refused.diagnostics.join(" ") : "").toContain(
      "not-a-ship=NOT_OWNED",
    );
  });
});
