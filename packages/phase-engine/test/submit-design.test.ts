import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { CommandLifecycle } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { buildWorkshopView, treasuryCostUnits, type DesignDraft } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot } from "./battle-fixtures.js";

import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

const content = productionShipBuildingContent();
const reference = readReferenceDesignEntries();
const havockDraft: Record<string, unknown> = {
  ...reference.find((d) => d.id === "havock_like")!.draft,
  nationId: ATTACKER_NATION,
};

function snapshotIn(year: number, month = 6): CampaignSnapshot {
  return {
    ...makeBattleSnapshot({ areas: ["a-1"], wars: [] }),
    startYear: year,
    startMonth: month,
  };
}

function submit(
  snapshot: CampaignSnapshot,
  draft: unknown = havockDraft,
  id = "des_test_destroyer",
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
      designFamilyId: "fam_test_destroyer",
      className: "Test class",
      hullType: "destroyer",
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

describe("SubmitDesign through the month", () => {
  it("keeps the submitted draft with the design so it can be revised later (ADR-0070)", () => {
    const snapshot = snapshotIn(1895);
    const { designs } = run(snapshot, [submit(snapshot)]);
    const d = designs.get("des_test_destroyer")!;
    expect(d.sourceDraft).toEqual(havockDraft);
    expect(d.sourceDraft).not.toBe(havockDraft);
  });

  it("records a colonial-service fitting on the compiled design version, and only then (S-5, spec #73 R4)", () => {
    const snapshot = snapshotIn(1895);
    const fitted = { ...havockDraft, colonialServiceFitted: true };
    const withFit = run(snapshot, [submit(snapshot, fitted)]).designs.get("des_test_destroyer")!;
    expect(withFit.colonialServiceFitted).toBe(true);
    expect((withFit.sourceDraft as Record<string, unknown>)["colonialServiceFitted"]).toBe(true);
    const plain = run(snapshot, [submit(snapshot)]).designs.get("des_test_destroyer")!;
    expect("colonialServiceFitted" in plain).toBe(false);
    expect(withFit.normalizedDisplacementKg).toBe(plain.normalizedDisplacementKg);
  });

  it("compiles a valid design and adds it, with its family, to the snapshot", () => {
    const snapshot = snapshotIn(1895);
    const { designs, families, collector } = run(snapshot, [submit(snapshot)]);
    const d = designs.get("des_test_destroyer")!;
    expect(d).toBeDefined();
    expect(d.nationId).toBe(ATTACKER_NATION);
    expect(Number(d.normalizedSpeedUms)).toBeGreaterThan(25 * 514_444);
    expect(Number(d.normalizedDisplacementKg)).toBeGreaterThan(250_000);
    expect(Number(d.hitPoints)).toBeGreaterThanOrEqual(1);
    expect(d.torpedoArmament?.[0]).toMatchObject({
      mountType: "ABOVE_WATER_TRAINABLE",
      tubeCount: 2,
    });
    expect(d.compiledHash).toMatch(/^[0-9a-f]{64}$/);
    expect(families.get("fam_test_destroyer")!.memberDesignVersionIds).toEqual([
      "des_test_destroyer",
    ]);
    expect(collector.all.filter((x) => x.code === "DESIGN_REJECTED")).toEqual([]);
  });

  it("rejects a design whose technology does not exist yet, leaving the snapshot untouched", () => {
    const snapshot = snapshotIn(1885);
    const { designs, collector } = run(snapshot, [submit(snapshot)]);
    expect(designs.has("des_test_destroyer")).toBe(false);
    const rejected = collector.all.find((x) => x.code === "DESIGN_REJECTED");
    expect(rejected?.message).toContain("TECH_UNAVAILABLE");
  });

  it("rejects an overweight design with every blocking finding named", () => {
    const snapshot = snapshotIn(1895);
    const heavy = {
      ...havockDraft,
      machinery: { ...(havockDraft.machinery as object), fuelCapacityKg: 400_000 },
    };
    const { designs, collector } = run(snapshot, [submit(snapshot, heavy)]);
    expect(designs.has("des_test_destroyer")).toBe(false);
    expect(collector.all.find((x) => x.code === "DESIGN_REJECTED")?.message).toContain(
      "OVERWEIGHT_UNRECOVERABLE",
    );
  });

  it("skips the command with a diagnostic when the engine has no ship-building content", () => {
    const snapshot = snapshotIn(1895);
    const { designs, collector } = run(snapshot, [submit(snapshot)], false);
    expect(designs.has("des_test_destroyer")).toBe(false);
    expect(collector.all.some((x) => x.code === "SHIP_BUILDING_CONTENT_MISSING")).toBe(true);
  });

  it("is deterministic: the same command on the same snapshot gives identical snapshots", () => {
    const snapshot = snapshotIn(1895);
    const a = run(snapshot, [submit(snapshot)]);
    const b = run(snapshot, [submit(snapshot)]);
    expect(sha256Hex(canonicalSerialize(a.result.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(b.result.finalSnapshot)),
    );
  });

  it("a second design in the same family joins it", () => {
    const snapshot = snapshotIn(1895);
    const first = run(snapshot, [submit(snapshot)]);
    const next = first.result.finalSnapshot;
    const second = run(next, [submit(next, havockDraft, "des_test_destroyer_b")]);
    expect(second.families.get("fam_test_destroyer")!.memberDesignVersionIds).toEqual([
      "des_test_destroyer",
      "des_test_destroyer_b",
    ]);
  });
});

describe("SubmitDesign lifecycle validation", () => {
  const snapshot = snapshotIn(1895);
  const code = (cmd: CommandEnvelope<CommandBody>) => {
    const outcome = new CommandLifecycle().validate(cmd, snapshot);
    if (outcome.ok) return "OK";
    return outcome.outcome.type === "rejected" ? outcome.outcome.diagnostic.code : "OTHER";
  };
  const withBody = (patch: Record<string, unknown>) => {
    const base = submit(snapshot);
    return {
      ...base,
      body: { ...(base.body as object), ...patch },
    } as unknown as CommandEnvelope<CommandBody>;
  };
  it("accepts a well-formed submission (the authoritative compile is not done at issue time)", () => {
    expect(code(submit(snapshot))).toBe("OK");
  });
  it("rejects unknown nations, bad ids, empty names, duplicates, malformed drafts and another nation's draft", () => {
    expect(code(withBody({ nationId: "XXX" }))).toBe("INVALID_NATION_ID");
    expect(code(withBody({ designVersionId: "Bad Id" }))).toBe("INVALID_COMMAND_PAYLOAD");
    expect(code(withBody({ className: "  " }))).toBe("INVALID_COMMAND_PAYLOAD");
    expect(code(withBody({ draft: { nationId: ATTACKER_NATION } }))).toBe(
      "INVALID_COMMAND_PAYLOAD",
    );
    expect(code(withBody({ draft: { ...havockDraft, nationId: "FRA" } }))).toBe(
      "INVALID_COMMAND_PAYLOAD",
    );
    const existing = [...snapshot.designs.keys()][0];
    if (existing)
      expect(code(withBody({ designVersionId: existing }))).toBe("INVALID_COMMAND_PAYLOAD");
  });
});

describe("construction price of a designed ship (ADR-0074)", () => {
  it("is the cost model's price in treasury units, the same figure the Drawing Board forecasts", () => {
    const snapshot = snapshotIn(1895);
    const { designs } = run(snapshot, [submit(snapshot)]);
    const d = designs.get("des_test_destroyer")!;
    const env = content.environmentFor("1895-07");
    const forecast = buildWorkshopView(havockDraft as unknown as DesignDraft, env).forecast
      .costMicro;
    expect(Number(d.constructionCostUnits)).toBe(
      treasuryCostUnits(forecast, content.treasuryUnitMicro),
    );
    expect(Number(d.constructionCostUnits)).toBeGreaterThan(0);
  });

  it("prices an equipped ship above a bare hull of the same weight class, which displacement alone cannot", () => {
    const snapshot = snapshotIn(1895);
    const { designs } = run(snapshot, [submit(snapshot)]);
    const d = designs.get("des_test_destroyer")!;
    const byDisplacement = Math.round(Number(d.normalizedDisplacementKg) / 100_000);
    expect(Number(d.constructionCostUnits)).not.toBe(byDisplacement);
  });
});

describe("construction plan of a designed ship (ADR-0077)", () => {
  const submitted = () => {
    const snapshot = snapshotIn(1895);
    return run(snapshot, [submit(snapshot)]).designs.get("des_test_destroyer")!;
  };
  it("carries packages that sum to the construction cost in units, with the yard the forecast chooses", () => {
    const d = submitted();
    const plan = d.constructionPlan!;
    expect(plan).toBeDefined();
    expect(plan.packages.reduce((a, p) => a + Number(p.totalWork), 0)).toBe(
      Number(d.constructionCostUnits),
    );
    const env = content.environmentFor("1895-07");
    const forecast = buildWorkshopView(havockDraft as unknown as DesignDraft, env).forecast;
    expect(plan.yardId).toBe(forecast.yardId);
  });
  it("keeps the package shape the engine needs: ids, lines, dependencies and per-line capacity", () => {
    const plan = submitted().constructionPlan!;
    const ids = new Set(plan.packages.map((p) => p.id));
    expect(ids.size).toBe(plan.packages.length);
    for (const p of plan.packages) for (const dep of p.dependsOn) expect(ids.has(dep)).toBe(true);
    expect(plan.packages.map((p) => p.kind)).toContain("HULL");
    expect(Object.values(plan.capacityUnits).every((v) => Number(v) >= 0)).toBe(true);
    expect(Math.max(...Object.values(plan.capacityUnits).map(Number))).toBeGreaterThan(0);
  });
  it("is deterministic across two runs of the same command", () => {
    expect(JSON.stringify(submitted().constructionPlan)).toBe(
      JSON.stringify(submitted().constructionPlan),
    );
  });
});
