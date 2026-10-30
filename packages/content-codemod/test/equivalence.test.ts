import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  APPROVED_DIFFS_SCHEMA,
  checkWithApprovedDiffs,
  decodeApprovedDiffs,
} from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { runEquivalence } from "../../ship-design/test/helpers/equivalenceRun.js";

const report = runEquivalence();

describe("equivalence totals are unchanged by the codemod (ticket 11c)", () => {
  it("covers 98/98 designs and 922/922 placements", () => {
    expect(report.coverage.baseline).toEqual({
      designs: 98,
      placements: 922,
      gunPlacements: 267,
      tubePlacements: 33,
      fittingPlacements: 622,
    });
    expect(report.summary.rows.changed).toBe(0);
    expect(report.summary.rows.orderingOnly).toBe(0);
  });

  it("keeps the independent armament, magazine and waiver counts separate", () => {
    expect(report.dataQuality.unresolvedGunPlacements).toHaveLength(196);
    expect(
      report.dataQuality.unresolvedGunPlacements.every(
        (u) => u.code === "PART_READ_PATH_NO_FIRST_CLASS_ARMAMENT",
      ),
    ).toBe(true);
    expect(report.dataQuality.unresolvedMagazineRelationships).toEqual([]);
    expect(report.dataQuality.waivers).toEqual([]);
  });

  it("keeps D17 and D18 pinned", () => {
    const nine = report.designs.flatMap((d) =>
      d.entries.filter((e) => e.disposition === "RECLASSIFIED_AS_CENTRAL_BATTERY"),
    );
    expect(nine).toHaveLength(15);
    for (const entry of nine) {
      expect(entry.mountType).toBe("BROADSIDE_BATTERY");
      expect(entry.mountCount).toBe(1);
      expect(entry.gunsPerMount).toBe(entry.legacyUnits);
    }
    const tubes = report.designs.flatMap((d) => d.entries.filter((e) => e.kind === "tube"));
    expect(tubes).toHaveLength(33);
    for (const entry of tubes) expect(entry.mountCount).toBe(entry.legacyUnits);
  });

  it("passes the approved-diff gate with the committed manifest, not around it", () => {
    const raw: unknown = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "..", "..", "ship-design", "approved-diffs.json"),
        "utf8",
      ),
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
