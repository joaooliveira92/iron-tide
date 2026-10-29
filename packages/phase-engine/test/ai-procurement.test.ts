import {} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  decodeStrict,
  PropulsionPlantCatalogueSchema,
  ShipHullFormCatalogueSchema,
} from "@bluewave/content-schema";
import { canonicalSerialize } from "@bluewave/deterministic";
import { CommandLifecycle } from "@bluewave/commands";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import {
  buildShipBuildingContent,
  type HullFormRecord,
  type PropulsionPlant,
  type ShipBuildingContent,
  type ShipBuildingData,
} from "@bluewave/ship-design";
import { runAiProcurementPhase } from "../src/aiProcurement.js";
import { fundDesignStudies } from "../src/designStudies.js";
import type { PhaseContext, SnapshotHandle } from "../src/pipeline.js";
import { readNavalProfileEntries, readReferenceDesignEntries } from "./helpers/contentFiles.js";
import { readComponentFiles } from "../../ship-design/test/helpers/componentFiles.js";
import { readAuthoredFile } from "@bluewave/test-support";

const root = join(__dirname, "..", "..", "..", "content", "production", "1880");
const load = (rel: string) => readAuthoredFile(join(root, rel)) as Record<string, unknown>;

const content: ShipBuildingContent = buildShipBuildingContent({
  components: readComponentFiles(root).components,
  plants: decodeStrict(PropulsionPlantCatalogueSchema, load("ship-building/plants.ts"))
    .plants as unknown as PropulsionPlant[],
  hullForms: decodeStrict(ShipHullFormCatalogueSchema, load("ship-building/hull-forms.ts"))
    .hullForms as HullFormRecord[],
  balance: load("ship-building/balance.ts") as ShipBuildingData["balance"],
  technologies: load("technologies.ts") as unknown as { id: string; year: number }[],
  navalProfiles: readNavalProfileEntries(),
  referenceDesigns: readReferenceDesignEntries(),
} satisfies ShipBuildingData);

const ledgerStub = { append: () => {} };

function makeContext(
  month: string,
  seed = "seed-1",
  nationId = "france",
  treasury = 2000,
): PhaseContext {
  const nation = {
    id: nationId,
    name: nationId,
    tag: nationId.slice(0, 3).toUpperCase(),
    treasury: SafeInt(treasury),
    income: SafeInt(100),
    expenses: SafeInt(20),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId,
      technologies: [],
      currentProjectTechId: undefined,
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: false,
    isAI: true,
  };
  const snapshot = {
    campaignId: "c1",
    rulesetVersion: "1.0",
    turnNumber: SafeInt(Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1),
    nations: new Map([[nationId, nation]]),
    designs: new Map(),
    designFamilies: new Map(),
  };
  let current = snapshot as unknown as CampaignSnapshot;
  const handle: SnapshotHandle = {
    get current() {
      return current;
    },
    set current(next) {
      current = next;
    },
    read: (field) => current[field],
    view: (overrides) => ({ ...current, ...overrides }),
    write: (field, value) => {
      current = { ...current, [field]: value } as CampaignSnapshot;
    },
  };
  return {
    snapshot: handle,
    rng: {
      seed: () => seed,
      engine: () => new RandomEngine(seed),
    },
    sourceSnapshot: current,
    slots: [{ nationId, type: "ai" }],
    commands: [],
    campaignMonth: month,
    turnNumber: snapshot.turnNumber,
    commandLedger: ledgerStub,
    eventLedger: ledgerStub,
    randomLedger: new RandomLedger(),
    financialLedger: ledgerStub,
    lifecycle: new CommandLifecycle(),
    collector: new DiagnosticCollector(),
    nextSeq: () => SafeInt(1),
    engineOptions: { shipBuilding: content },
  } as unknown as PhaseContext;
}

const france = (ctx: PhaseContext) =>
  ctx.snapshot.current["nations"].get("france") as unknown as {
    treasury: SafeInt;
    designStudies?: { designStudyId: string; status: string }[];
    constructionProjects: unknown[];
    procurementIntents?: {
      status: string;
      role: string;
      reason: string | null;
      designStudyId: string | null;
    }[];
  };

describe("AI procurement lifecycle", () => {
  it("a fleet deficit produces a design study, and no order exists before approval", () => {
    const ctx = makeContext("1880-01");
    runAiProcurementPhase(ctx);
    const n = france(ctx);
    expect(n.procurementIntents?.length).toBe(1);
    expect(n.procurementIntents![0]!.status).toBe("STUDY_SUBMITTED");
    expect(n.designStudies?.length).toBe(1);
    expect(n.constructionProjects.length).toBe(0);
  });

  it("repeated planning does not duplicate the study", () => {
    const ctx = makeContext("1880-01");
    runAiProcurementPhase(ctx);
    const afterFirst = france(ctx).designStudies?.length;
    runAiProcurementPhase(ctx);
    expect(france(ctx).designStudies?.length).toBe(afterFirst);
    expect(france(ctx).procurementIntents?.length).toBe(1);
  });

  it("approval after the established study duration leads to placeConstructionOrder", () => {
    const ctx = makeContext("1880-01");
    runAiProcurementPhase(ctx);
    const study = france(ctx).designStudies![0]!;
    let months = 0;
    while (
      france(ctx).designStudies!.find((s) => s.designStudyId === study.designStudyId)!.status !==
      "COMPLETED"
    ) {
      fundDesignStudies(ctx);
      months++;
      expect(months).toBeLessThanOrEqual(10);
    }
    expect(months).toBeGreaterThanOrEqual(1);
    (ctx as { campaignMonth: string }).campaignMonth = "1880-06";
    runAiProcurementPhase(ctx);
    const n = france(ctx);
    expect(n.procurementIntents![0]!.status).toBe("ORDER_PLACED");
    expect(n.constructionProjects.length).toBe(1);
  });

  it("is deterministic for the same snapshot and seed", () => {
    const a = makeContext("1880-01");
    const b = makeContext("1880-01");
    runAiProcurementPhase(a);
    runAiProcurementPhase(b);
    expect(canonicalSerialize(france(a).procurementIntents)).toBe(
      canonicalSerialize(france(b).procurementIntents),
    );
  });

  it("another project satisfying the deficit cancels unnecessary procurement", () => {
    const ctx = makeContext("1880-01");
    runAiProcurementPhase(ctx);
    const study = france(ctx).designStudies![0]!;
    while (
      france(ctx).designStudies!.find((s) => s.designStudyId === study.designStudyId)!.status !==
      "COMPLETED"
    )
      fundDesignStudies(ctx);
    const n = france(ctx);
    const role = n.procurementIntents![0]!.role;
    const snapshot = ctx.snapshot.current as unknown as {
      designs: Map<string, unknown>;
      nations: Map<string, { fleets: unknown[] }>;
    };
    const design = {
      designVersionId: "des_satisfy",
      nationId: "france",
      hullType: role === "DD" ? "destroyer" : "protected_cruiser",
    };
    snapshot.designs.set("des_satisfy", design);
    snapshot.nations.get("france")!.fleets = [
      {
        id: "f1",
        nationId: "france",
        name: "F",
        locationAreaId: "a",
        ships: Array.from({ length: 12 }, (_, i) => ({
          id: `s${String(i)}`,
          designVersionId: "des_satisfy",
          isUnderConstruction: false,
        })),
      },
    ];
    (ctx as { campaignMonth: string }).campaignMonth = "1880-06";
    runAiProcurementPhase(ctx);
    const intent = france(ctx).procurementIntents!.find((i) => i.role === role)!;
    expect(intent.status).toBe("CANCELLED");
    expect(intent.reason).toBe("deficit_satisfied");
  });

  it("a nation too poor to build produces a structured decline rather than an exception", () => {
    const ctx = makeContext("1880-01");
    (france(ctx) as { treasury: SafeInt }).treasury = SafeInt(0);
    expect(() => runAiProcurementPhase(ctx)).not.toThrow();
    expect(france(ctx).designStudies ?? []).toHaveLength(0);
    expect(france(ctx).procurementIntents ?? []).toHaveLength(0);
  });
});

describe("live AI procurement simulation (2 nations x 3 seeds x 3 budgets x 36 months)", () => {
  const NATIONS = ["uk", "france", "germany"] as const;
  const SEEDS = ["alpha", "bravo", "charlie"] as const;
  const BUDGETS = [200, 800, 2000] as const;
  interface Result {
    studies: number;
    orders: number;
    cancelled: number;
    expired: number;
    exceptions: number;
    timeline: string;
  }
  function run(nationId: string, seed: string, treasury: number): Result {
    const ctx = makeContext("1880-01", seed, nationId, treasury);
    const counts: Result = {
      studies: 0,
      orders: 0,
      cancelled: 0,
      expired: 0,
      exceptions: 0,
      timeline: "",
    };
    for (let m = 0; m < 36; m++) {
      const year = 1880 + Math.floor(m / 12);
      const mon = (m % 12) + 1;
      (ctx as { campaignMonth: string }).campaignMonth =
        `${String(year)}-${String(mon).padStart(2, "0")}`;
      (ctx as { turnNumber: ReturnType<typeof SafeInt> }).turnNumber = SafeInt(m);
      try {
        runAiProcurementPhase(ctx);
        fundDesignStudies(ctx);
      } catch {
        counts.exceptions++;
      }
      const n = ctx.snapshot.current["nations"].get(nationId);
      counts.studies = (n?.designStudies ?? []).length;
      counts.orders = n?.constructionProjects.length ?? 0;
      counts.cancelled = (n?.procurementIntents ?? []).filter(
        (i) => i.status === "CANCELLED",
      ).length;
      counts.expired = (n?.procurementIntents ?? []).filter((i) => i.status === "EXPIRED").length;
      counts.timeline += `${String(n?.constructionProjects.length ?? 0)}:${String((n?.designStudies ?? []).length)}|`;
    }
    return counts;
  }

  const cached = new Map<string, Result>();
  function runCached(nationId: string, seed: string, treasury: number): Result {
    const key = `${nationId}:${seed}:${String(treasury)}`;
    let result = cached.get(key);
    if (result === undefined) {
      result = run(nationId, seed, treasury);
      cached.set(key, result);
    }
    return result;
  }

  it(
    "runs 36 months with zero unhandled exceptions for every nation/seed/budget",
    { timeout: 120000 },
    () => {
      for (const nation of NATIONS)
        for (const seed of SEEDS)
          for (const b of BUDGETS) {
            const r = runCached(nation, seed, b);
            expect(r.exceptions, `${nation} ${seed} ${String(b)}`).toBe(0);
          }
    },
  );

  it("the sweep submits studies and places orders", { timeout: 120000 }, () => {
    const results = NATIONS.flatMap((n) =>
      SEEDS.flatMap((s) => BUDGETS.map((b) => runCached(n, s, b))),
    );
    expect(results.some((r) => r.studies > 0)).toBe(true);
    expect(results.some((r) => r.orders > 0)).toBe(true);
  });

  it("replays identically for the same nation, seed and budget", () => {
    const a = run("france", "alpha", 800);
    const b = run("france", "alpha", 800);
    expect(b.timeline).toBe(a.timeline);
    expect(b.orders).toBe(a.orders);
    expect(b.studies).toBe(a.studies);
  });
});
