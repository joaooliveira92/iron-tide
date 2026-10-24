import { readFileSync } from "node:fs";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  APPROVED_DIFFS_SCHEMA,
  checkWithApprovedDiffs,
  decodeApprovedDiffs,
} from "../src/index.js";
import {
  EQUIVALENCE_REPORT_SCHEMA,
  PINNED_COVERAGE,
  checkEquivalenceReport,
  compareMetrics,
  serializeEquivalenceReport,
  type DesignReport,
  type EquivalenceReport,
  type MetricRow,
} from "../src/equivalenceReport.js";
import { runEquivalence } from "./helpers/equivalenceRun.js";
import { nationalContext, shipTypes } from "./helpers/earlyContext.js";

const report = runEquivalence();

const reportSha = sha256Hex(serializeEquivalenceReport(report));

const withDesign = (
  r: EquivalenceReport,
  i: number,
  d: Partial<DesignReport>,
): EquivalenceReport => ({
  ...r,
  designs: r.designs.map((x, j) => (j === i ? { ...x, ...d } : x)),
});
const row = (r: Partial<MetricRow>): MetricRow => ({
  path: "x",
  baseline: 1,
  candidate: 1,
  delta: 0,
  tolerance: 0,
  status: "equal",
  ...r,
});
const codes = (r: EquivalenceReport) =>
  checkEquivalenceReport(r)
    .structural.concat(checkEquivalenceReport(r).semantic)
    .map((f) => f.code);

describe("equivalence harness over current content (ticket 08)", () => {
  it("covers 93/93 designs and 836/836 placements, and the pinned slices", () => {
    expect(report.schema).toBe(EQUIVALENCE_REPORT_SCHEMA);
    expect(report.coverage.baseline).toEqual(PINNED_COVERAGE);
    expect(report.coverage.candidate).toEqual(PINNED_COVERAGE);
    expect(report.designs.every((d) => d.compared)).toBe(true);
  });

  it("reads the compiled ship-type registry from content, so the report is not vacuous (ticket 12b)", () => {
    expect(shipTypes).toHaveLength(14);
    expect(nationalContext("1880-01", "uk").shipTypes).toEqual(shipTypes);
  });

  it("has no changed row and passes both gates", () => {
    expect(report.summary.rows.changed).toBe(0);
    expect(report.summary.rows.orderingOnly).toBe(0);
    const result = checkEquivalenceReport(report);
    expect(result.structural).toEqual([]);
    expect(result.semantic).toEqual([]);
  });

  it("reclassifies only the D18 identity paths of the nine, with old and new values", () => {
    const rows = report.designs.flatMap((d) => d.rows.filter((r) => r.status === "reclassified"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.reclassification?.reason).toBe("DQ-ARMAMENT-001");
      expect(typeof r.baseline).toBe("string");
    }
    const nine = report.designs.flatMap((d) =>
      d.entries.filter((e) => e.disposition === "RECLASSIFIED_AS_CENTRAL_BATTERY"),
    );
    expect(nine).toHaveLength(9);
    const perDesign = report.designs
      .map((d) => [
        d.designId,
        d.entries.filter((e) => e.disposition === "RECLASSIFIED_AS_CENTRAL_BATTERY").length,
      ])
      .filter(([, n]) => n !== 0);
    expect(perDesign).toEqual([
      ["kaiser_1875", 2],
      ["mesudiye_1875", 3],
      ["redoutable_1878", 2],
      ["sachsen_1878", 2],
    ]);
    const paths = new Set(rows.map((r) => r.path.replace(/\[[^\]]*\]/, "[]")));
    expect([...paths].every((p) => /\.(mountType|mountId)$/.test(p))).toBe(true);
    for (const e of nine) {
      expect(e.legacyMountType).not.toBeNull();
      expect(e.mountType).toBe("BROADSIDE_BATTERY");
    }
  });

  it("keeps data quality separate with independent armament, magazine and waiver counts", () => {
    expect(report.dataQuality.unresolvedGunPlacements).toHaveLength(165);
    expect(
      report.dataQuality.unresolvedGunPlacements.every(
        (u) => u.code === "PART_READ_PATH_NO_FIRST_CLASS_ARMAMENT",
      ),
    ).toBe(true);
    expect(report.dataQuality.unresolvedMagazineRelationships).toEqual([]);
    expect(report.dataQuality.waivers).toEqual([]);
  });

  it(`is byte-identical across runs (EQUIVALENCE_REPORT_SHA256 ${reportSha})`, () => {
    expect(serializeEquivalenceReport(runEquivalence())).toBe(serializeEquivalenceReport(report));
    expect(canonicalSerialize(report)).toBe(serializeEquivalenceReport(report));
  });

  it("passes the approved-diff gate with the committed manifest, not around it", () => {
    const raw: unknown = JSON.parse(
      readFileSync(new URL("../approved-diffs.json", import.meta.url), "utf8"),
    );
    const decoded = decodeApprovedDiffs(raw);
    expect(decoded.ok, decoded.ok ? "" : decoded.errors.join("\n")).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.schema).toBe(APPROVED_DIFFS_SCHEMA);
    const result = checkWithApprovedDiffs(report, decoded.value);
    expect(result.failures).toEqual([]);
    expect(result.applied).toEqual([]);
  });
});

describe("equivalence gates (fixtures)", () => {
  const base = report;

  it("structural: coverage that differs fails", () => {
    const r = {
      ...base,
      coverage: { ...base.coverage, candidate: { ...base.coverage.candidate, placements: 822 } },
    };
    expect(codes(r)).toContain("COVERAGE_MISMATCH");
  });

  it("structural: a design withheld by the fit barrier is reported and not compared", () => {
    const r = withDesign(base, 0, { compared: false, rows: [] });
    expect(codes(r)).toContain("DESIGN_NOT_COMPARED");
  });

  it("semantic: a changed row fails", () => {
    const r = withDesign(base, 0, {
      rows: [row({ path: "hull.x", baseline: 1, candidate: 2, delta: 1, status: "changed" })],
    });
    expect(codes(r)).toContain("CHANGED_ROW");
  });

  it("semantic: a reclassified row off a D18 path or on a number fails", () => {
    const id = base.designs[0]?.designId ?? "";
    const off = withDesign(base, 0, {
      rows: [
        row({
          path: "hull.class",
          baseline: "A",
          candidate: "B",
          delta: null,
          status: "reclassified",
        }),
      ],
    });
    expect(codes(off)).toContain("RECLASSIFIED_OFF_D18_PATH");
    const num = withDesign(base, 0, {
      rows: [
        row({
          path: "entries[a].mountType",
          baseline: 1,
          candidate: 2,
          delta: 1,
          status: "reclassified",
        }),
      ],
    });
    expect(codes(num)).toContain("RECLASSIFIED_ON_NUMBER");
    expect(id).not.toBe("");
  });

  it("semantic: a reclassification of a placement outside the nine is not allowed", () => {
    const rows = compareMetrics({
      designId: "somewhere_1880",
      baseline: { "entries[main].mountType": "TURRET" },
      candidate: { "entries[main].mountType": "BROADSIDE_BATTERY" },
    });
    expect(rows[0]?.status).toBe("changed");
  });

  it("semantic: an orderingOnly row on an undeclared path fails", () => {
    const r = withDesign(base, 0, {
      rows: [
        row({ path: "components[a].weightKg", baseline: 1, candidate: 1, status: "orderingOnly" }),
      ],
    });
    expect(codes(r)).toContain("ORDERING_ONLY_UNDECLARED_PATH");
  });

  it("orderingOnly is granted only to a declared path with multiset equality", () => {
    const same = compareMetrics({
      designId: "d",
      baseline: { "findings.multiset[a]": 1, "findings.order": "a\nb" },
      candidate: { "findings.multiset[a]": 1, "findings.order": "b\na" },
    });
    expect(same.find((x) => x.path === "findings.order")?.status).toBe("orderingOnly");
    const diff = compareMetrics({
      designId: "d",
      baseline: { "findings.multiset[a]": 1, "findings.order": "a" },
      candidate: { "findings.multiset[a]": 2, "findings.order": "a\na" },
    });
    expect(diff.find((x) => x.path === "findings.order")?.status).toBe("changed");
  });

  it("integer tolerance is 0: a one-unit difference is changed", () => {
    const rows = compareMetrics({ designId: "d", baseline: { n: 5 }, candidate: { n: 6 } });
    expect(rows[0]).toMatchObject({ status: "changed", delta: 1, tolerance: 0 });
  });
});
