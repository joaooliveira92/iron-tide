import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { HULL_TYPE_FOR_SHIP_TYPE } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { constructionProjectIdForCommand } from "@bluewave/campaign-engine";
import { classifyShip, roleEligibility } from "@bluewave/combat";
import { SafeInt } from "@bluewave/contracts";
import { DESIGN_22_EARLY } from "@bluewave/ship-design";
import { MonthExecutor, placeConstructionOrder } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot } from "./battle-fixtures.js";

import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

const content = productionShipBuildingContent();
const reference = readReferenceDesignEntries();
const draftOf = (id: string): Record<string, unknown> => ({
  ...reference.find((d) => d.id === id)!.draft,
  nationId: ATTACKER_NATION,
});

const STARTERS = [
  ["B", "alexandra_1877"],
  ["CA", "starter_armoured_cruiser_1880"],
  ["CL", "starter_protected_cruiser_1880"],
  ["DD", "starter_torpedo_gunboat_1880"],
  ["KE", "starter_corvette_1880"],
  ["AMC", "starter_armed_liner_1880"],
] as const;

function snapshotIn(year: number, month = 6): CampaignSnapshot {
  return {
    ...makeBattleSnapshot({ areas: ["a-1"], wars: [] }),
    startYear: year,
    startMonth: month,
  };
}

function submit(
  snapshot: CampaignSnapshot,
  draft: unknown,
  hullType: string,
  id = "des_test",
): CommandEnvelope<CommandBody> {
  return {
    commandId: `sd-${id}`,
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey: `ik-${id}`,
    timestamp: "test",
    body: {
      type: "SubmitDesign",
      nationId: ATTACKER_NATION,
      designVersionId: id,
      designFamilyId: "fam_test",
      className: "Test class",
      hullType,
      machineryType: "locomotive_boiler",
      draft,
    },
  };
}

function run(
  snapshot: CampaignSnapshot,
  commands: CommandEnvelope<CommandBody>[],
  withContent = true,
) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    snapshot,
    commands,
    "design-seed",
    collector,
    undefined,
    withContent ? { shipBuilding: content } : undefined,
  );
  return {
    result,
    collector,
    designs: result.finalSnapshot.designs,
    families: result.finalSnapshot.designFamilies,
  };
}

type Design = CampaignSnapshot["designs"] extends Map<string, infer D> ? D : never;

function withDesigns(): CampaignSnapshot {
  const snapshot = snapshotIn(1880, 1);
  let current = snapshot;
  for (const [i, [type, id]] of STARTERS.entries()) {
    const out = run(current, [
      submit(current, draftOf(id), HULL_TYPE_FOR_SHIP_TYPE[type], `des_${type.toLowerCase()}_${i}`),
    ]);
    if (!out.designs.has(`des_${type.toLowerCase()}_${i}`))
      throw new Error(JSON.stringify(out.collector.all.map((x) => x.code + x.message)));
    current = out.result.finalSnapshot;
  }
  return { ...current, startYear: 1880, startMonth: 1 };
}
const MONTH = { year: 1880, month: 1 };
const ship = (n: number, designVersionId: string, over: Record<string, unknown> = {}) =>
  ({
    id: `s${n}`,
    name: `s${n}`,
    classId: "c",
    nationId: ATTACKER_NATION,
    locationAreaId: "a-1",
    designVersionId,
    isUnderConstruction: false,
    ...over,
  }) as never;
const withFleet = (base: CampaignSnapshot, ships: unknown[], projects: unknown[] = []) => {
  const nation = base.nations.get(ATTACKER_NATION)!;
  return {
    ...base,
    nations: new Map([
      ...base.nations,
      [
        ATTACKER_NATION,
        {
          ...nation,
          fleets: [{ id: "f", nationId: ATTACKER_NATION, name: "f", ships, locationAreaId: "a-1" }],
          constructionProjects: projects,
        },
      ],
    ]),
  } as unknown as CampaignSnapshot;
};
const amcProject = (n: number, status = "ACTIVE") => ({
  id: `con_amc_${n}`,
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: `ship_amc_${n}`,
  designVersionId: "des_amc_5",
  totalWork: 10,
  completedWork: 0,
  paidWork: 0,
  status,
  startedAt: "1880-01",
});
const order = (snapshot: CampaignSnapshot, designVersionId: string, extra: object = {}) =>
  placeConstructionOrder(
    snapshot,
    { nationId: ATTACKER_NATION, commandId: "cmd-1", designVersionId, month: MONTH, ...extra },
    content,
  );

describe("placeConstructionOrder is the only way a new-ship project enters a snapshot", () => {
  const base = withDesigns();

  it("adds one planned project for a legal design and leaves the input snapshot untouched", () => {
    const before = base.nations.get(ATTACKER_NATION)!.constructionProjects.length;
    const r = order(base, "des_dd_3");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project).toMatchObject({ designVersionId: "des_dd_3", status: "PLANNED" });
    expect(base.nations.get(ATTACKER_NATION)!.constructionProjects).toHaveLength(before);
    expect(r.snapshot.nations.get(ATTACKER_NATION)!.constructionProjects).toHaveLength(before + 1);
  });

  it("refuses an unknown design and another nation's design", () => {
    expect(order(base, "nope")).toMatchObject({ ok: false, reason: "UNKNOWN_DESIGN" });
    const foreign = {
      ...base,
      designs: new Map(base.designs).set("des_foreign", {
        ...base.designs.get("des_dd_3")!,
        designVersionId: "des_foreign",
        nationId: "someone-else",
      }),
    } as CampaignSnapshot;
    expect(order(foreign, "des_foreign")).toMatchObject({
      ok: false,
      reason: "DESIGN_NOT_FOR_PLAYER",
    });
  });

  it.each(["BB", "BC", "CV", "SUPER_BATTLESHIP"])(
    "refuses a stored design whose draft is now a %s: a design filed or edited past the designer cannot be built",
    (category) => {
      const good = base.designs.get("des_b_0")! as Design & {
        sourceDraft: Record<string, unknown>;
      };
      const draft = good.sourceDraft as { requirement: Record<string, unknown> };
      const tampered = {
        ...good,
        designVersionId: "des_tampered",
        sourceDraft: { ...draft, requirement: { ...draft.requirement, category } },
      };
      const snapshot = {
        ...base,
        designs: new Map(base.designs).set("des_tampered", tampered),
      } as CampaignSnapshot;
      const r = order(snapshot, "des_tampered");
      expect(r).toMatchObject({ ok: false, reason: "DESIGN_REVALIDATION_FAILED" });
    },
  );

  it("refuses a design that needs content the engine was not given", () => {
    const r = placeConstructionOrder(
      base,
      { nationId: ATTACKER_NATION, commandId: "c", designVersionId: "des_dd_3", month: MONTH },
      undefined,
    );
    expect(r).toMatchObject({ ok: false, reason: "DESIGN_REVALIDATION_UNAVAILABLE" });
  });

  it("refuses a design whose era is after the campaign year, and admits it once the era is reached", () => {
    const future = {
      ...base.designs.get("des_dd_3")!,
      designVersionId: "des_future",
      designFamilyId: "fam_future",
    };
    const snapshot = {
      ...base,
      designs: new Map(base.designs).set("des_future", future),
      designFamilies: new Map(base.designFamilies).set("fam_future", {
        designFamilyId: "fam_future",
        nationId: ATTACKER_NATION,
        rootDesignVersionId: "des_future",
        memberDesignVersionIds: ["des_future"],
        familyCreationMonth: "1906-02",
      }),
    } as CampaignSnapshot;
    expect(order(snapshot, "des_future")).toMatchObject({
      ok: false,
      reason: "DESIGN_NOT_YET_AVAILABLE",
    });
    const atEra = placeConstructionOrder(
      snapshot,
      {
        nationId: ATTACKER_NATION,
        commandId: "cmd-era",
        designVersionId: "des_future",
        month: { year: 1906, month: 2 },
      },
      content,
    );
    expect(atEra.ok).toBe(true);
  });

  it("limits AMC orders to 20 % of operational cruisers, minimum two, counting queued AMC", () => {
    const amc = base.designs.get("des_amc_5")!;
    expect(amc.hullType).toBe("armed_merchant_cruiser");
    expect(order(withFleet(base, [], []), "des_amc_5").ok).toBe(true);
    expect(order(withFleet(base, [], [amcProject(0)]), "des_amc_5").ok).toBe(true);
    const third = order(withFleet(base, [], [amcProject(0), amcProject(1)]), "des_amc_5");
    expect(third).toMatchObject({ ok: false, reason: "AMC_FLEET_LIMIT_EXCEEDED" });
    const launched = order(
      withFleet(base, [ship(1, "des_amc_5"), ship(2, "des_amc_5")], [amcProject(0, "COMPLETED")]),
      "des_amc_5",
    );
    expect(launched).toMatchObject({ ok: false, reason: "AMC_FLEET_LIMIT_EXCEEDED" });
  });

  it("counts only commissioned, operational CA and CL toward the allowance", () => {
    const cl = "des_cl_2";
    const ca = "des_ca_1";
    const fourteen = Array.from({ length: 14 }, (_, i) => ship(i, i % 2 === 0 ? cl : ca));
    const two = [ship(100, "des_amc_5"), ship(101, "des_amc_5")];
    expect(order(withFleet(base, [...fourteen, ...two]), "des_amc_5").ok).toBe(false);
    const fifteen = [...fourteen, ship(14, cl)];
    expect(order(withFleet(base, [...fifteen, ...two]), "des_amc_5").ok).toBe(true);
    const notActive = [
      ...fourteen,
      ship(14, cl, { isUnderConstruction: true }),
      ship(15, cl, { availability: "UNAVAILABLE" }),
    ];
    expect(order(withFleet(base, [...notActive, ...two]), "des_amc_5").ok).toBe(false);
    const others = [...fourteen, ship(20, "des_dd_3"), ship(21, "des_ke_4"), ship(22, "des_b_0")];
    expect(order(withFleet(base, [...others, ...two]), "des_amc_5").ok).toBe(false);
  });

  it("after losses leave the fleet above the limit, nothing is disbanded and only new orders are refused", () => {
    const cruisers = Array.from({ length: 15 }, (_, i) => ship(i, "des_cl_2"));
    const fourAmc = Array.from({ length: 4 }, (_, i) => ship(100 + i, "des_amc_5"));
    const snapshot = withFleet(base, [...cruisers, ...fourAmc]);
    expect(order(snapshot, "des_amc_5")).toMatchObject({
      ok: false,
      reason: "AMC_FLEET_LIMIT_EXCEEDED",
    });
    expect(order(snapshot, "des_dd_3").ok).toBe(true);
  });

  it("limits fast AMC separately: 25 % of the AMC fleet, minimum one, at 22 knots", () => {
    const fastDesign = {
      ...base.designs.get("des_amc_5")!,
      designVersionId: "des_amc_fast",
      normalizedSpeedUms: SafeInt(DESIGN_22_EARLY.amcFastSpeedUms),
    };
    const snapshot = {
      ...base,
      designs: new Map(base.designs).set("des_amc_fast", fastDesign),
    } as CampaignSnapshot;
    const oneFast = [ship(1, "des_amc_fast")];
    expect(order(withFleet(snapshot, oneFast), "des_amc_fast")).toMatchObject({
      ok: false,
      reason: "AMC_FAST_LIMIT_EXCEEDED",
    });
    expect(order(withFleet(snapshot, []), "des_amc_fast").ok).toBe(true);
  });

  it("takes the allowance from ruleset data, not from a constant in the policy", () => {
    const relaxed = {
      ...content,
      environmentFor: (month: string) => {
        const env = content.environmentFor(month);
        return {
          ...env,
          ctx: {
            ...env.ctx,
            balance: {
              ...env.ctx.balance,
              classification: { ...DESIGN_22_EARLY, amcFleetMinAllowance: 3 },
            },
          },
        };
      },
    };
    const snapshot = withFleet(base, [], [amcProject(0), amcProject(1)]);
    expect(order(snapshot, "des_amc_5").ok).toBe(false);
    const r = placeConstructionOrder(
      snapshot,
      { nationId: ATTACKER_NATION, commandId: "c", designVersionId: "des_amc_5", month: MONTH },
      relaxed,
    );
    expect(r.ok).toBe(true);
  });

  it("replacing an order does not count the replaced project and removes it in the same step", () => {
    const snapshot = withFleet(
      base,
      [],
      [
        { ...amcProject(0), id: constructionProjectIdForCommand("cmd-old-a") },
        { ...amcProject(1), id: constructionProjectIdForCommand("cmd-old-b") },
      ],
    );
    expect(order(snapshot, "des_amc_5").ok).toBe(false);
    const r = order(snapshot, "des_amc_5", { replacingCommandId: "cmd-old-a" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.snapshot.nations.get(ATTACKER_NATION)!.constructionProjects.map((p) => p.id);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(constructionProjectIdForCommand("cmd-old-a"));
    expect(ids).toContain(constructionProjectIdForCommand("cmd-old-b"));
  });
});

describe("hull types map to the combat classifier's canonical type", () => {
  it.each(Object.entries(HULL_TYPE_FOR_SHIP_TYPE))("%s -> %s", (type, hullType) => {
    const design = {
      designVersionId: "d",
      hullType,
      normalizedDisplacementKg: 12_000_000,
      normalizedArmorUm: 400_000,
      mainGunsCaliber: 305_000,
      normalizedSpeedUms: 5_000_000,
    } as never;
    expect(classifyShip(design)).toBe(type);
  });
});

describe("the AMC's auxiliary contract in fleet organisation (DESIGN-26 section 14)", () => {
  it("serves in patrol and independent roles only", () => {
    expect(roleEligibility("PATROL", "AMC")).toBe(true);
    expect(roleEligibility("INDEPENDENT", "AMC")).toBe(true);
    for (const role of ["CORE", "SUPPORT", "SCOUT", "SCREEN"] as const)
      expect(roleEligibility(role, "AMC")).toBe(false);
  });
});
