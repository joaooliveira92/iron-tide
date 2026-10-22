import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { hashSnapshot, MonthExecutor } from "../src/index.js";
import { ATTACKER_NATION, makeBattleSnapshot } from "./battle-fixtures.js";

import {
  productionShipBuildingContent,
  readReferenceDesignEntries,
} from "./helpers/contentFiles.js";

const content = productionShipBuildingContent({ withStudyRules: true });
const reference = readReferenceDesignEntries();
const havockDraft: Record<string, unknown> = {
  ...reference.find((d) => d.id === "havock_like")!.draft,
  nationId: ATTACKER_NATION,
};

const snapshot0: CampaignSnapshot = {
  ...makeBattleSnapshot({ areas: ["a-1"], wars: [] }),
  startYear: 1895,
  startMonth: 6,
};

function submit(
  snapshot: CampaignSnapshot,
  id: string,
  draft: Record<string, unknown> = havockDraft,
  familyId = "fam_test_destroyer",
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
      designFamilyId: familyId,
      className: `Class ${id}`,
      hullType: "destroyer",
      machineryType: "locomotive_boiler",
      draft,
    },
  };
}

function month(snapshot: CampaignSnapshot, commands: CommandEnvelope<CommandBody>[] = []) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(
    snapshot,
    commands,
    "study-seed",
    collector,
    undefined,
    {
      shipBuilding: content,
    },
  );
  const next = {
    ...result.finalSnapshot,
    turnNumber: SafeInt.add(result.finalSnapshot.turnNumber, SafeInt.ONE),
  };
  return { result, collector, next };
}
const nation = (s: CampaignSnapshot) => s.nations.get(ATTACKER_NATION)!;
const studyOf = (s: CampaignSnapshot, id: string) =>
  (nation(s).designStudies ?? []).find((x) => x.design.designVersionId === id)!;
const withReserve = (s: CampaignSnapshot, reserve: number): CampaignSnapshot => {
  const nations = new Map(s.nations);
  nations.set(ATTACKER_NATION, { ...nation(s), expenses: SafeInt(reserve) });
  return { ...s, nations };
};
function runUntilApproved(
  s: CampaignSnapshot,
  id: string,
  max = 8,
): { s: CampaignSnapshot; months: number } {
  let cur = s;
  for (let m = 1; m <= max; m++) {
    cur = month(cur).next;
    if (cur.designs.has(id)) return { s: cur, months: m };
  }
  throw new Error(`${id} not approved within ${max} months`);
}

describe("design studies (DESIGN-21 section 3, ADR-0085)", () => {
  it("a submitted design opens a study instead of being approved, and pays its first month", () => {
    const { next, result } = month(snapshot0, [submit(snapshot0, "des_a")]);
    expect(next.designs.has("des_a")).toBe(false);
    const st = studyOf(next, "des_a");
    const cost = Number(st.design.constructionCostUnits);
    expect(st).toMatchObject({
      status: "IN_PROGRESS",
      baselineDesignVersionId: "NONE",
      derived: false,
      newFamily: true,
      discountBp: 0,
      finalStudyWork: 4,
      finalStudyCost: Math.max(1, Math.ceil((cost * 300) / 10_000)),
      workDone: 1,
      formulaVersion: "design_study_v1",
    });
    expect(st.costPaid).toBe(Math.ceil(st.finalStudyCost / 4));
    expect(
      Number(nation(snapshot0).treasury) - Number(nation(result.finalSnapshot).treasury),
    ).toBeGreaterThanOrEqual(st.costPaid);
    const entries = result.financialLedger.all.filter((e) => e.categoryId === "DESIGN_STUDY");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.reason).toMatch(/Design study for Class des_a/);
  });

  it("approves the design and creates its family when the last month of work is paid, having paid exactly the study cost", () => {
    const first = month(snapshot0, [submit(snapshot0, "des_a")]).next;
    const { s, months } = runUntilApproved(first, "des_a");
    expect(months).toBe(3);
    const st = studyOf(s, "des_a");
    expect(st.status).toBe("COMPLETED");
    expect(st.completionMonth).not.toBeNull();
    expect(st.costPaid).toBe(st.finalStudyCost);
    expect(s.designFamilies.get("fam_test_destroyer")?.memberDesignVersionIds).toEqual(["des_a"]);
  });

  it("makes no progress in a month it cannot pay for, and resumes when it can", () => {
    const first = month(snapshot0, [submit(snapshot0, "des_a")]).next;
    const broke = month(withReserve(first, 1_000_000_000)).next;
    expect(studyOf(broke, "des_a").workDone).toBe(1);
    const resumed = month(withReserve(broke, 0)).next;
    expect(studyOf(resumed, "des_a").workDone).toBe(2);
  });

  it("a similar design in the same family is derived: 25 % less work and cost, and it joins the family", () => {
    const a = runUntilApproved(month(snapshot0, [submit(snapshot0, "des_a")]).next, "des_a").s;
    const machinery = havockDraft["machinery"] as Record<string, number>;
    const variant = {
      ...havockDraft,
      machinery: { ...machinery, installedKw: machinery["installedKw"]! + 50 },
    };
    const b = month(a, [submit(a, "des_b", variant)]).next;
    const st = studyOf(b, "des_b");
    expect(st).toMatchObject({
      derived: true,
      baselineDesignVersionId: "des_a",
      discountBp: 2_500,
      finalStudyWork: 3,
      newFamily: false,
    });
    expect(st.failedCriteria).toEqual([]);
    const done = runUntilApproved(b, "des_b").s;
    expect(done.designFamilies.get("fam_test_destroyer")?.memberDesignVersionIds).toEqual([
      "des_a",
      "des_b",
    ]);
  });

  it("a dissimilar design under the same name is not rejected: it starts a new family, with no discount", () => {
    const a = runUntilApproved(month(snapshot0, [submit(snapshot0, "des_a")]).next, "des_a").s;
    const machinery = havockDraft["machinery"] as Record<string, number>;
    const bigger = {
      ...havockDraft,
      machinery: { ...machinery, installedKw: Math.round(machinery["installedKw"]! * 0.7) },
    };
    const b = month(a, [submit(a, "des_big", bigger)]).next;
    const st = studyOf(b, "des_big");
    if (st === undefined) throw new Error("the bigger variant should still be a legal design");
    expect(st.derived).toBe(false);
    expect(st.failedCriteria).toEqual(["DERIVED_DESIGN_SPEED_CHANGED"]);
    expect(st.discountBp).toBe(0);
    expect(st.designFamilyId).not.toBe("fam_test_destroyer");
    const done = runUntilApproved(b, "des_big").s;
    expect(done.designFamilies.get(st.designFamilyId)?.memberDesignVersionIds).toEqual(["des_big"]);
    expect(done.designFamilies.get("fam_test_destroyer")?.memberDesignVersionIds).toEqual([
      "des_a",
    ]);
  });

  it("refuses a second submission of a design that is already in study", () => {
    const first = month(snapshot0, [submit(snapshot0, "des_a")]).next;
    const again = month(first, [submit(first, "des_a")]);
    expect(again.collector.all.some((d) => /already exists/.test(d.message))).toBe(true);
    expect(
      (nation(again.next).designStudies ?? []).filter((x) => x.design.designVersionId === "des_a"),
    ).toHaveLength(1);
  });

  it("is deterministic", () => {
    const one = month(snapshot0, [submit(snapshot0, "des_a")]).result.finalSnapshot;
    const two = month(snapshot0, [submit(snapshot0, "des_a")]).result.finalSnapshot;
    expect(hashSnapshot(one)).toBe(hashSnapshot(two));
  });
});
