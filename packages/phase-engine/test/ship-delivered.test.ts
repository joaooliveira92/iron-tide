import type { CampaignSnapshot, ConstructionProject } from "@bluewave/campaign";
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
