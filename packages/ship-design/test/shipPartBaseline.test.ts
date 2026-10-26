import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  APPROVED_DIFFS_SCHEMA,
  checkWithApprovedDiffs,
  decodeApprovedDiffs,
} from "../src/index.js";
import {
  checkEquivalenceReport,
  type EquivalenceReport,
  type MetricRow,
} from "../src/equivalenceReport.js";
import { type ApprovedDiff, type ApprovedDiffsFile } from "../src/approvedDiffs.js";
import { D17_ROWS, TORPEDO_ROWS } from "./fixtures/shipPartBaselineRows.js";
import { runEquivalence } from "./helpers/equivalenceRun.js";

const report = runEquivalence();
const entriesOf = (r: EquivalenceReport) =>
  r.designs.flatMap((d) => d.entries.map((e) => ({ design: d.designId, ...e })));

describe("pinned baseline (ticket 09, SPM-R26 P1 gate)", () => {
  it("pins the coverage and data-quality inventory", () => {
    const expected = {
      designs: 96,
      placements: 883,
      gunPlacements: 251,
      tubePlacements: 31,
      fittingPlacements: 601,
    };
    expect(report.coverage.baseline).toEqual(expected);
    expect(report.coverage.candidate).toEqual(expected);
    expect(report.coverage.pinned).toEqual(expected);
    expect(report.dataQuality.inventory.observed).toEqual({
      centralBatteryPlacements: 12,
      launcherVariants: 17,
      waivedLauncherRecords: 5,
      torpedoEntriesAffected: 9,
    });
    expect(report.dataQuality.inventory.pinned).toEqual(report.dataQuality.inventory.observed);
  });

  it("has changed = 0 and passes every gate with the empty approved-diffs file", () => {
    expect(report.summary.rows.changed).toBe(0);
    expect(checkEquivalenceReport(report)).toMatchObject({ ok: true });
  });

  it("keeps inherited findings in dataQuality, apart from the differences", () => {
    const { inherited } = report.dataQuality;
    expect(inherited.filter((f) => f.code === "DQ-TORPEDO-001")).toHaveLength(9);
    expect(inherited.filter((f) => f.code === "DQ-ARMAMENT-001")).toHaveLength(12);
    expect(inherited.every((f) => f.status === "inherited")).toBe(true);
    const rows = report.designs.flatMap((d) => d.rows);
    expect(rows.some((r) => String(r.path).includes("DQ-"))).toBe(false);
  });

  it("pins the twelve D17 rows", () => {
    const nine = entriesOf(report).filter(
      (e) => e.disposition === "RECLASSIFIED_AS_CENTRAL_BATTERY",
    );
    const observed = nine
      .map((e) => [
        e.design,
        e.instanceId,
        e.legacyComponentId,
        e.legacyUnits,
        e.mountCount,
        e.gunsPerMount,
        e.legacyMountType,
      ])
      .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));
    const pinned = [...D17_ROWS].sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));
    expect(observed).toEqual(pinned.map((r) => [...r]));
    for (const e of nine) {
      expect(e.legacyFixedInstallationKg).not.toBeNull();
    }
  });

  it("pins the 31 torpedo rows", () => {
    const tubes = entriesOf(report)
      .filter((e) => e.kind === "tube")
      .map((e) => [e.design, e.instanceId, e.legacyComponentId, e.legacyUnits, e.mountCount])
      .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));
    const pinned = [...TORPEDO_ROWS]
      .map((r) => [...r])
      .sort((a, b) => `${a[0]}:${a[1]}`.localeCompare(`${b[0]}:${b[1]}`));
    expect(tubes).toHaveLength(31);
    expect(tubes).toEqual(pinned);
  });
});

describe("baseline gates (fixtures)", () => {
  const tamper = (fn: (e: ReturnType<typeof entriesOf>[number]) => boolean, patch: object) => ({
    ...report,
    designs: report.designs.map((d) => ({
      ...d,
      entries: d.entries.map((e) => (fn({ design: d.designId, ...e }) ? { ...e, ...patch } : e)),
    })),
  });
  const codes = (r: EquivalenceReport) => {
    const g = checkEquivalenceReport(r);
    return [...g.structural, ...g.semantic].map((f) => f.code);
  };

  it("a moved data-quality count fails the structural gate", () => {
    const r: EquivalenceReport = {
      ...report,
      dataQuality: {
        ...report.dataQuality,
        inventory: {
          ...report.dataQuality.inventory,
          observed: { ...report.dataQuality.inventory.observed, launcherVariants: 16 },
        },
      },
    };
    expect(codes(r)).toContain("DATA_QUALITY_NOT_PINNED");
  });

  it("D17: a barrel or fixed-installation difference fails", () => {
    const barrels = tamper((e) => e.disposition !== null && e.instanceId === "sec", {
      gunsPerMount: 2,
    });
    expect(codes(barrels)).toContain("D17_BARREL_EQUALITY");
    const fixed = tamper((e) => e.disposition !== null, { legacyFixedInstallationKg: 1 });
    expect(codes(fixed)).toContain("D17_FIXED_INSTALLATION");
  });

  it("torpedo: mountCount different from legacy tubes fails", () => {
    const r = tamper((e) => e.kind === "tube", { mountCount: 99 });
    expect(codes(r)).toContain("TORPEDO_MOUNT_COUNT_MISMATCH");
  });
});

describe("approved diffs", () => {
  const file: unknown = JSON.parse(
    readFileSync(new URL("../approved-diffs.json", import.meta.url), "utf8"),
  );

  const changedRow: MetricRow = {
    path: "entries[tubes].massKg",
    baseline: 9200,
    candidate: 9500,
    delta: 300,
    tolerance: 0,
    status: "changed",
  };
  const withChange: EquivalenceReport = {
    ...report,
    designs: report.designs.map((d, i) => (i === 0 ? { ...d, rows: [...d.rows, changedRow] } : d)),
  };
  const design = report.designs[0]?.designId ?? "";
  const entry: ApprovedDiff = {
    decisionId: "ADR-0200-D1",
    designId: design,
    placementId: "tubes",
    fieldPath: "entries[tubes].massKg",
    oldValue: 9200,
    newValue: 9500,
    differenceClass: "BASIS_CHANGE",
    reason: "Launcher mass moves to the authored basis.",
    approvalReference: "owner-review-5",
    expectedDelta: 300,
  };
  const wrap = (...entries: unknown[]) => ({ schema: APPROVED_DIFFS_SCHEMA, entries });
  const errorsOf = (raw: unknown): string => {
    const r = decodeApprovedDiffs(raw);
    return r.ok ? "" : r.errors.join("\n");
  };

  it("the committed file is empty and approves nothing", () => {
    const decoded = decodeApprovedDiffs(file);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value.entries).toEqual([]);
    const result = checkWithApprovedDiffs(withChange, {
      schema: APPROVED_DIFFS_SCHEMA,
      entries: [],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toContain("CHANGED_ROW");
  });

  it("an unapproved change fails, and passes once a matching strict entry exists", () => {
    const approved: ApprovedDiffsFile = { schema: APPROVED_DIFFS_SCHEMA, entries: [entry] };
    const result = checkWithApprovedDiffs(withChange, approved);
    expect(result.failures).toEqual([]);
    expect(result.applied).toEqual([entry]);
  });

  it("a numeric entry whose delta differs from the row does not approve it", () => {
    const wrong = { ...entry, newValue: 9600, expectedDelta: 400 };
    const result = checkWithApprovedDiffs(withChange, {
      schema: APPROVED_DIFFS_SCHEMA,
      entries: [wrong],
    });
    expect(result.failures.map((f) => f.code)).toEqual(
      expect.arrayContaining(["CHANGED_ROW", "APPROVED_DIFF_STALE"]),
    );
  });

  it("an entry that matches nothing is stale and fails", () => {
    const result = checkWithApprovedDiffs(report, {
      schema: APPROVED_DIFFS_SCHEMA,
      entries: [entry],
    });
    expect(result.failures.map((f) => f.code)).toEqual(["APPROVED_DIFF_STALE"]);
  });

  it("decode accepts a strict entry", () => {
    expect(decodeApprovedDiffs(wrap(entry)).ok).toBe(true);
  });

  it("decode rejects wildcard, glob and regex entries", () => {
    for (const patch of [
      { fieldPath: "*" },
      { fieldPath: "entries[*].massKg" },
      { placementId: "main_*" },
      { designId: "kaiser_.*" },
      { fieldPath: "^entries\\[.+\\]\\.massKg$" },
      { designId: "(a|b)" },
    ]) {
      expect(errorsOf(wrap({ ...entry, ...patch })), JSON.stringify(patch)).not.toBe("");
    }
  });

  it("decode rejects a whole-design or ticket-wide approval", () => {
    expect(errorsOf(wrap({ ...entry, fieldPath: design }))).not.toBe("");
    expect(errorsOf(wrap({ ...entry, placementId: "all" }))).not.toBe("");
    expect(errorsOf(wrap({ ...entry, fieldPath: "entire design" }))).not.toBe("");
    expect(errorsOf(wrap({ ...entry, reason: "Every change from ticket 12" }))).not.toBe("");
    expect(errorsOf(wrap({ ...entry, decisionId: "any diff of ticket-12" }))).not.toBe("");
  });

  it("decode rejects an entry missing any required field", () => {
    for (const key of [
      "decisionId",
      "designId",
      "placementId",
      "fieldPath",
      "oldValue",
      "newValue",
      "differenceClass",
      "reason",
      "approvalReference",
    ]) {
      const rest = Object.fromEntries(Object.entries(entry).filter(([k]) => k !== key));
      expect(errorsOf(wrap(rest)), key).not.toBe("");
    }
  });

  it("decode rejects a numeric entry with no expected delta or value", () => {
    const { expectedDelta: _d, ...rest } = entry;
    expect(errorsOf(wrap(rest))).toContain("expectedDelta or expectedReplacement");
    expect(decodeApprovedDiffs(wrap({ ...rest, expectedReplacement: 9500 })).ok).toBe(true);
    expect(errorsOf(wrap({ ...entry, expectedDelta: 1 }))).not.toBe("");
  });

  it("decode rejects an unknown field, a wrong schema and a non-object file", () => {
    expect(errorsOf(wrap({ ...entry, note: "x" }))).not.toBe("");
    expect(errorsOf({ schema: "other", entries: [] })).not.toBe("");
    expect(errorsOf([])).not.toBe("");
  });
});
