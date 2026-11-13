import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot } from "./battle-fixtures.js";

const newConstruction = (over: Partial<ConstructionProject> = {}): ConstructionProject => ({
  id: "con-batch-1",
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: "class-dv-att-a",
  designVersionId: "dv-att-a",
  totalWork: SafeInt(10),
  completedWork: SafeInt(10),
  paidWork: SafeInt(10),
  status: "ACTIVE",
  startedAt: "1879-11",
  shipName: "HMS Delivered",
  batchOrdinal: 1,
  buildMonths: 3,
  yardId: "yard_a",
  ...over,
});

function snapshotWith(project: ConstructionProject): CampaignSnapshot {
  const base: CampaignSnapshot = {
    ...makeBattleSnapshot({ areas: ["a-1"], wars: [] }),
    startYear: 1880,
    startMonth: 1,
  };
  const nation = base.nations.get(ATTACKER_NATION)!;
  return {
    ...base,
    nations: new Map([
      ...base.nations,
      [ATTACKER_NATION, { ...nation, constructionProjects: [project] }],
    ]),
  };
}

const run = (snapshot: CampaignSnapshot) =>
  new MonthExecutor().execute(snapshot, [], "ship-delivered", new DiagnosticCollector());

const withNation = (snapshot: CampaignSnapshot, patch: Partial<NationState>): CampaignSnapshot => {
  const nation = snapshot.nations.get(ATTACKER_NATION)!;
  return {
    ...snapshot,
    nations: new Map([...snapshot.nations, [ATTACKER_NATION, { ...nation, ...patch }]]),
  };
};

const fleetsOf = (snapshot: CampaignSnapshot) => snapshot.nations.get(ATTACKER_NATION)!.fleets;
const newlyDelivered = (snapshot: CampaignSnapshot) =>
  fleetsOf(snapshot).filter((f) => f.name === "Newly delivered");
const secondProject = newConstruction({
  id: "con-batch-2",
  shipName: "HMS Second",
  batchOrdinal: 2,
});

describe("ShipDelivered placement", () => {
  it("lands the ship in a Newly delivered fleet at the home port", () => {
    const result = run(withNation(snapshotWith(newConstruction()), { homeAreaId: "a-home" }));
    const delivered = fleetsOf(result.finalSnapshot).find((f) =>
      f.ships.some((s) => s.id === "ship-con-batch-1"),
    )!;
    expect(delivered).toMatchObject({
      id: `fleet-${ATTACKER_NATION}-delivered-a-home`,
      nationId: ATTACKER_NATION,
      name: "Newly delivered",
      locationAreaId: "a-home",
    });
    expect(delivered.ships.map((s) => s.id)).toEqual(["ship-con-batch-1"]);
    expect(delivered.ships[0]!.locationAreaId).toBe("a-home");
    const defaultFleet = fleetsOf(result.finalSnapshot).find(
      (f) => f.id === `fleet-${ATTACKER_NATION}`,
    )!;
    expect(defaultFleet.ships.some((s) => s.id === "ship-con-batch-1")).toBe(false);
  });

  it("falls back to the existing fleet's area when the nation has no home area", () => {
    const base = snapshotWith(newConstruction());
    const area = fleetsOf(base)[0]!.locationAreaId;
    const [delivered] = newlyDelivered(run(base).finalSnapshot);
    expect(delivered!.locationAreaId).toBe(area);
    expect(delivered!.id).toBe(`fleet-${ATTACKER_NATION}-delivered-${area}`);
  });

  it("reuses the Newly delivered fleet for a later delivery at the same port", () => {
    const first = run(withNation(snapshotWith(newConstruction()), { homeAreaId: "a-home" }));
    const again = withNation(first.finalSnapshot, { constructionProjects: [secondProject] });
    const fleets = newlyDelivered(run(again).finalSnapshot);
    expect(fleets).toHaveLength(1);
    expect(fleets[0]!.ships.map((s) => s.id)).toEqual(["ship-con-batch-1", "ship-con-batch-2"]);
  });

  it("opens a second Newly delivered fleet when the first has moved away", () => {
    const first = run(withNation(snapshotWith(newConstruction()), { homeAreaId: "a-home" }));
    const moved = fleetsOf(first.finalSnapshot).map((f) =>
      f.name === "Newly delivered" ? { ...f, locationAreaId: "a-1" } : f,
    );
    const again = withNation(first.finalSnapshot, {
      fleets: moved,
      constructionProjects: [secondProject],
    });
    expect(
      newlyDelivered(run(again).finalSnapshot).map((f) => [f.id, f.locationAreaId, f.ships.length]),
    ).toEqual([
      [`fleet-${ATTACKER_NATION}-delivered-a-home`, "a-1", 1],
      [`fleet-${ATTACKER_NATION}-delivered-a-home-2`, "a-home", 1],
    ]);
  });
});

describe("ShipDelivered", () => {
  it("is appended exactly once when a new construction project completes", () => {
    const result = run(snapshotWith(newConstruction()));
    const delivered = result.eventLedger.all.filter((e) => e.eventType === "ShipDelivered");
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.body).toEqual({
      kind: "ShipDelivered",
      projectId: "con-batch-1",
      nationId: ATTACKER_NATION,
      shipId: "ship-con-batch-1",
      shipName: "HMS Delivered",
      classId: expect.any(String),
      designVersionId: "dv-att-a",
      deliveredMonth: "1880-02",
      yardId: "yard_a",
      plannedMonths: 3,
      actualMonths: 4,
    });
    const fleetShips = result.finalSnapshot.nations
      .get(ATTACKER_NATION)!
      .fleets.flatMap((f) => f.ships);
    expect(fleetShips.some((s) => s.id === "ship-con-batch-1")).toBe(true);
  });

  it("carries the foreign builder and omits absent yard and planned months", () => {
    const result = run(
      snapshotWith(
        newConstruction({
          yardId: undefined,
          buildMonths: undefined,
          foreignBuilderNationId: "FRA",
          startedAt: "1880-01",
        }),
      ),
    );
    const body = result.eventLedger.all.find((e) => e.eventType === "ShipDelivered")!.body;
    expect(body).toMatchObject({ builderNationId: "FRA", actualMonths: 2 });
    expect(body).not.toHaveProperty("yardId");
    expect(body).not.toHaveProperty("plannedMonths");
  });

  it("is not appended again once the project is completed", () => {
    const first = run(snapshotWith(newConstruction()));
    const second = new MonthExecutor().execute(
      first.finalSnapshot,
      [],
      "ship-delivered",
      new DiagnosticCollector(),
    );
    expect(second.eventLedger.all.filter((e) => e.eventType === "ShipDelivered")).toHaveLength(0);
  });

  it("is not appended while the project is unfinished", () => {
    const unfinished = run(snapshotWith(newConstruction({ completedWork: SafeInt(0) })));
    expect(unfinished.eventLedger.all.some((e) => e.eventType === "ShipDelivered")).toBe(false);
  });

  it("is deterministic", () => {
    const a = run(snapshotWith(newConstruction()));
    const b = run(snapshotWith(newConstruction()));
    expect(a.eventLedger.all).toEqual(b.eventLedger.all);
  });
});
