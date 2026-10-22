import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { applySubmitDesign } from "../src/commands.js";
import { gunDiffOf, rebuildArmamentFindings, rebuildBulgeRequired } from "../src/refitRules.js";
import { MonthExecutor } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot, makeShip } from "./battle-fixtures.js";
import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

const content = productionShipBuildingContent();
const reference = readReferenceDesignEntries();
const MONTH = "1880-01";

const baseDraft: Record<string, unknown> = {
  ...reference.find((d) => d.id === "devastator_1873")!.draft,
  nationId: ATTACKER_NATION,
};

const cruiserDraft: Record<string, unknown> = {
  ...reference.find((d) => d.id === "torpedo_cruiser_1880")!.draft,
  nationId: ATTACKER_NATION,
};

const revised = (patch: (d: Record<string, any>) => void): Record<string, unknown> => {
  const d = structuredClone(baseDraft) as Record<string, any>;
  patch(d);
  return d;
};

const swapGun = (instanceId: string, componentId: string): Record<string, unknown> =>
  revised((d) => {
    const p = d.placements.find((x: { instanceId: string }) => x.instanceId === instanceId);
    p.componentId = componentId;
  });

const removeMainGun = (): Record<string, unknown> =>
  revised((d) => {
    d.placements = d.placements.filter((p: { instanceId: string }) => p.instanceId !== "main_fwd");
  });

const sameCalibreRefresh = (): Record<string, unknown> => swapGun("main_fwd", "gun_rml_12in_25ton");

const tooLargeSecondary = (): Record<string, unknown> => {
  const d = structuredClone(cruiserDraft) as Record<string, any>;
  const p = d.placements.find((x: { instanceId: string }) => x.instanceId === "mg_fwd");
  p.componentId = "gun_rml_7in_7ton";
  return d;
};

const faster = (): Record<string, unknown> =>
  revised((d) => {
    d.machinery.installedKw += 100;
  });

const bulged = (): Record<string, unknown> =>
  revised((d) => {
    d.hull.targetDisplacementKg += 200_000;
  });

const envelope = (
  snapshot: CampaignSnapshot,
  body: CommandBody,
  id: string,
): CommandEnvelope<CommandBody> => ({
  commandId: `c-${id}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
  idempotencyKey: `ik-${id}`,
  timestamp: "test",
  body,
});

function snapshotWithBuiltShip(): CampaignSnapshot {
  const start: CampaignSnapshot = {
    ...makeBattleSnapshot({ areas: ["a-1"], wars: [] }),
    startYear: 1880,
    startMonth: 1,
  };
  const collector = new DiagnosticCollector();
  const withDesign = applySubmitDesign(
    start,
    {
      type: "SubmitDesign",
      nationId: ATTACKER_NATION,
      designVersionId: "des_base",
      designFamilyId: "fam_reb",
      className: "Rebuild class",
      hullType: "pre_dreadnought",
      machineryType: "compound_cylindrical",
      draft: baseDraft,
    },
    content,
    MONTH,
    collector,
  );
  expect(collector.errors).toEqual([]);
  const nation = withDesign.nations.get(ATTACKER_NATION)!;
  const first = nation.fleets[0]!;
  const ship = makeShip("s1", "des_base", ATTACKER_NATION);
  const withShip: NationState = {
    ...nation,
    fleets: [{ ...first, ships: [ship] }, ...nation.fleets.slice(1)],
  };
  return { ...withDesign, nations: new Map([...withDesign.nations, [ATTACKER_NATION, withShip]]) };
}

function startRebuild(
  snapshot: CampaignSnapshot,
  draft: Record<string, unknown>,
  rebuildKind?: "BULGE",
) {
  const collector = new DiagnosticCollector();
  const command = envelope(
    snapshot,
    {
      type: "StartRebuild",
      nationId: ATTACKER_NATION,
      shipId: "s1",
      projectId: "rb_new",
      newDesignVersionId: "des_new",
      draft,
      ...(rebuildKind === undefined ? {} : { rebuildKind }),
    },
    "rb",
  );
  const result = new MonthExecutor().execute(
    snapshot,
    [command],
    "rebuild-refit",
    collector,
    undefined,
    {
      shipBuilding: content,
    },
  );
  return { snapshot: result.finalSnapshot, collector };
}

const messages = (c: DiagnosticCollector) => c.all.map((x) => `${x.code}: ${x.message}`).join("\n");
const hasProject = (s: CampaignSnapshot) =>
  s.nations.get(ATTACKER_NATION)!.constructionProjects.some((p) => p.id === "rb_new");

describe("gunDiffOf (the armament-change rule set's diff)", () => {
  it("sees an in-place gun swap as a removal and an addition", () => {
    const env = content.environmentFor(MONTH).ctx;
    const diff = gunDiffOf(baseDraft as never, sameCalibreRefresh() as never, env.catalogue, null);
    expect(diff.removed.map((g) => g.caliberUm)).toEqual([305_000]);
    expect(diff.added.map((g) => g.caliberUm)).toEqual([305_000]);
  });

  it("leaves a design with no gun change empty", () => {
    const env = content.environmentFor(MONTH).ctx;
    expect(gunDiffOf(baseDraft as never, faster() as never, env.catalogue, null)).toEqual({
      removed: [],
      added: [],
    });
  });
});

describe("rebuildBulgeRequired (SB3-R25)", () => {
  it("is true when the rebuild does not grow the hull and false when it does", () => {
    expect(rebuildBulgeRequired(baseDraft as never, faster() as never)).toBe(true);
    expect(rebuildBulgeRequired(baseDraft as never, bulged() as never)).toBe(false);
  });
});

describe("armament changes in the live rebuild path (SB3-R26)", () => {
  it("refuses an above-6-in main gun removed with no replacement, with the armament finding", () => {
    const snapshot = snapshotWithBuiltShip();
    const { snapshot: after, collector } = startRebuild(snapshot, removeMainGun());
    expect(messages(collector)).toContain("ARMAMENT_MAIN_GUN_UNCHANGEABLE");
    expect(collector.errors.map((e) => e.code)).toContain("REBUILD_REJECTED");
    expect(hasProject(after)).toBe(false);
    expect(after.designs.has("des_new")).toBe(false);
  });

  it("accepts a same-calibre main refresh", () => {
    const snapshot = snapshotWithBuiltShip();
    const { snapshot: after, collector } = startRebuild(snapshot, sameCalibreRefresh());
    expect(messages(collector)).not.toMatch(/ARMAMENT_/);
    expect(collector.errors).toEqual([]);
    expect(hasProject(after)).toBe(true);
  });
});

describe("BULGE rebuild in the live rebuild path (SB3-R25)", () => {
  it("refuses a BULGE whose hull did not grow, with REBUILD_BULGE_REQUIRED", () => {
    const snapshot = snapshotWithBuiltShip();
    const { snapshot: after, collector } = startRebuild(snapshot, faster(), "BULGE");
    expect(collector.errors.map((e) => e.code)).toContain("REBUILD_BULGE_REQUIRED");
    expect(hasProject(after)).toBe(false);
  });

  it("accepts a BULGE that grows the hull", () => {
    const snapshot = snapshotWithBuiltShip();
    const { snapshot: after, collector } = startRebuild(snapshot, bulged(), "BULGE");
    expect(collector.errors).toEqual([]);
    expect(hasProject(after)).toBe(true);
  });
});

describe("rebuildArmamentFindings is the shared rule set", () => {
  it("returns nothing when no guns change, and the BLOCKING finding for an illegal swap", () => {
    const none = rebuildArmamentFindings(baseDraft as never, faster() as never, content, MONTH);
    expect(none).toEqual([]);
    const illegal = rebuildArmamentFindings(
      baseDraft as never,
      removeMainGun() as never,
      content,
      MONTH,
    );
    expect(illegal.map((f) => f.id)).toContain("ARMAMENT_MAIN_GUN_UNCHANGEABLE");
    expect(illegal.every((f) => f.severity === "BLOCKING")).toBe(true);
  });

  it("refuses a secondary changed to a gun above 6 inches", () => {
    const illegal = rebuildArmamentFindings(
      cruiserDraft as never,
      tooLargeSecondary() as never,
      content,
      MONTH,
    );
    expect(illegal.map((f) => f.id)).toEqual(["ARMAMENT_SECONDARY_TOO_LARGE"]);
  });
});
