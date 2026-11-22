import type { CampaignSnapshot, Ship } from "@bluewave/campaign";
import type { WarDeclarationRules } from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { TRADE_RULES, tradeDesign, tradeShip, tradeSnapshot } from "./fixtures/trade-protection.js";

const WAR_RULES: WarDeclarationRules = {
  sectionVersion: 1,
  tensionThreshold: 5,
  minimumNavalStrengthRatioBp: 5000,
  provenance: TRADE_RULES.provenance,
};

const french = (id: string, over: Partial<Ship> = {}) =>
  tradeShip(id, "d-dd", { locationAreaId: "a-2", ...over }, "FRA");

const britishRaider = tradeShip("gbr-raider", "d-cp", { stationAssignment: "RAIDER" });

function scenario(fraShips: Ship[], extra: { atWar?: boolean; gbrShips?: Ship[] } = {}) {
  return tradeSnapshot({
    gbrShips: extra.gbrShips ?? [britishRaider],
    ...(extra.atWar === undefined ? {} : { atWar: extra.atWar }),
    fra: {
      fleets: [
        { id: "fleet-FRA", nationId: "FRA", name: "FRA", locationAreaId: "a-2", ships: fraShips },
      ],
    },
  });
}

function run(from: CampaignSnapshot, seed = "ai-trade-duty") {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(from, [], seed, collector, undefined, {
    playerNationId: "GBR",
    tradeProtection: TRADE_RULES,
    warDeclaration: WAR_RULES,
  });
  return Object.assign(result, { collector });
}

const fraShips = (s: CampaignSnapshot) => s.nations.get("FRA")!.fleets.flatMap((f) => f.ships);
const dutyOf = (s: CampaignSnapshot) =>
  Object.fromEntries(fraShips(s).map((ship) => [ship.id, ship.stationAssignment]));

describe("#1069: AI assigns trade protection duty", () => {
  it("escorts an idle fleet when at war and exposed to a raider, emitting assignment events", () => {
    const from = scenario([french("f1"), french("f2"), french("f3"), french("f4")]);
    const result = run(from);
    expect(dutyOf(result.finalSnapshot)).toEqual({
      f1: "TRADE_PROTECTION",
      f2: "TRADE_PROTECTION",
      f3: "TRADE_PROTECTION",
      f4: "TRADE_PROTECTION",
    });
    const events = result.eventLedger.all.filter(
      (e) => e.body.kind === "ShipStationAssignmentChanged",
    );
    expect(events.map((e) => (e.body as { nationId: string }).nationId)).toEqual([
      "FRA",
      "FRA",
      "FRA",
      "FRA",
    ]);
    expect(result.collector.errors).toEqual([]);
  });

  it("assigns nothing when at peace", () => {
    const result = run(scenario([french("f1"), french("f2")], { atWar: false }));
    expect(Object.values(dutyOf(result.finalSnapshot))).toEqual([undefined, undefined]);
  });

  it("assigns nothing when the enemy fields no raider and no submarine", () => {
    const result = run(
      scenario([french("f1"), french("f2")], {
        gbrShips: [tradeShip("gbr-dd", "d-dd")],
      }),
    );
    expect(Object.values(dutyOf(result.finalSnapshot))).toEqual([undefined, undefined]);
  });

  it("leaves a fleet that cannot contribute untouched", () => {
    const from = tradeSnapshot({
      gbrShips: [britishRaider],
      designs: [tradeDesign("d-dd", "destroyer"), tradeDesign("d-bb", "battleship")],
      fra: {
        fleets: [
          {
            id: "fleet-FRA",
            nationId: "FRA",
            name: "FRA",
            locationAreaId: "a-2",
            ships: [french("bb1", { designVersionId: "d-bb" })],
          },
        ],
      },
    });
    const result = run(from);
    expect(dutyOf(result.finalSnapshot)).toEqual({ bb1: undefined });
  });

  it("is identical across two runs of the same seed", () => {
    const from = scenario([french("f1"), french("f2"), french("f3"), french("f4")]);
    expect(run(from).finalSnapshot).toEqual(run(from).finalSnapshot);
  });

  it("releases duty when the war is over so the fleet can sail again", () => {
    const from = scenario([french("f1", { stationAssignment: "TRADE_PROTECTION" })], {
      atWar: false,
    });
    const result = run(from);
    expect(dutyOf(result.finalSnapshot)).toEqual({ f1: undefined });
  });
});
