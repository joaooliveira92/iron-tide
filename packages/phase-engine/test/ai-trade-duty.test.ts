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

function run(from: CampaignSnapshot, seed = "ai-trade-duty", rules = TRADE_RULES) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(from, [], seed, collector, undefined, {
    playerNationId: "GBR",
    tradeProtection: rules,
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

  it("releases duty mid-war once the enemy fields no raider and no submarine (#1089)", () => {
    const from = scenario([french("f1", { stationAssignment: "TRADE_PROTECTION" })], {
      gbrShips: [tradeShip("gbr-dd", "d-dd")],
    });
    const result = run(from);
    expect(dutyOf(result.finalSnapshot)).toEqual({ f1: undefined });
    expect(result.collector.errors).toEqual([]);
  });
});

const SUBMARINE_RULES: typeof TRADE_RULES = {
  ...TRADE_RULES,
  submarineThreat: {
    hullType: "submarine",
    quotaPerBoatBp: 10_000,
    attackBp: 0,
    lossPerHitBp: 500,
    blockadeReductionBp: 5000,
  },
};

const ASW_DESIGNS = [
  tradeDesign("d-dd", "destroyer"),
  tradeDesign("d-dd-asw", "destroyer", { capabilities: [{ kind: "asw_attack", level: 2 }] }),
  tradeDesign("d-cp", "protected_cruiser"),
  tradeDesign("d-ss", "submarine"),
];

describe("#1094: surplus release keeps anti-submarine escorts", () => {
  const aswScenario = tradeSnapshot({
    gbrShips: [tradeShip("gbr-sub", "d-ss")],
    designs: ASW_DESIGNS,
    fra: {
      fleets: [
        {
          id: "fleet-z",
          nationId: "FRA",
          name: "z",
          locationAreaId: "a-2",
          ships: [tradeShip("z1", "d-dd-asw", { locationAreaId: "a-2" }, "FRA")],
        },
        {
          id: "fleet-a",
          nationId: "FRA",
          name: "a",
          locationAreaId: "a-2",
          ships: ["a1", "a2", "a3"].map((id) =>
            tradeShip(id, "d-dd", { locationAreaId: "a-2" }, "FRA"),
          ),
        },
      ],
    },
  });

  it("keeps the anti-submarine escort on duty across two months under a submarine quota of 2", () => {
    const first = run(aswScenario, "ai-trade-duty-m1", SUBMARINE_RULES);
    expect(dutyOf(first.finalSnapshot)).toEqual({
      z1: "TRADE_PROTECTION",
      a1: "TRADE_PROTECTION",
      a2: "TRADE_PROTECTION",
      a3: "TRADE_PROTECTION",
    });
    const second = run(first.finalSnapshot, "ai-trade-duty-m2", SUBMARINE_RULES);
    expect(dutyOf(second.finalSnapshot)).toMatchObject({ z1: "TRADE_PROTECTION" });
    expect(first.collector.errors).toEqual([]);
    expect(second.collector.errors).toEqual([]);
  });
});
