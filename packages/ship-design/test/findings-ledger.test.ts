import { describe, it, expect } from "vite-plus/test";
import { checkFindingShape, sortFindings, hasBlocking } from "../src/findings.js";
import { emptyLedger, ledgerTotal, withLine, LEDGER_CATEGORIES } from "../src/ledger.js";
import { kg, type Finding } from "../src/index.js";

const f = (id: string, severity: Finding["severity"], remedies = 3): Finding => ({
  id,
  severity,
  what: "w",
  why: "y",
  consequence: "c",
  remedies: Array.from({ length: remedies }, (_, i) => ({ id: `r${i}`, description: "d" })),
  evidence: { formulaId: "F", inputs: {}, threshold: 0, value: 1 },
});

describe("findings", () => {
  it("enforces the four-part message and remedy counts", () => {
    expect(checkFindingShape(f("A", "BLOCKING"))).toEqual([]);
    expect(checkFindingShape(f("A", "BLOCKING", 2))).toHaveLength(1);
    expect(checkFindingShape(f("A", "WARNING", 1))).toHaveLength(1);
    expect(checkFindingShape(f("A", "ADVISORY", 0))).toEqual([]);
    expect(checkFindingShape({ ...f("A", "WARNING"), why: " " })).toContain("why is empty");
  });
  it("sorts by severity then id, deterministically", () => {
    const sorted = sortFindings([
      f("B", "WARNING"),
      f("Z", "BLOCKING"),
      f("A", "WARNING"),
      f("C", "ADVISORY", 0),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["Z", "A", "B", "C"]);
    expect(hasBlocking(sorted)).toBe(true);
    expect(hasBlocking([f("A", "WARNING")])).toBe(false);
  });
});

describe("ledger", () => {
  it("has twelve categories and total equals the sum of lines (I2)", () => {
    expect(LEDGER_CATEGORIES).toHaveLength(12);
    let l = emptyLedger();
    expect(ledgerTotal(l)).toBe(0);
    LEDGER_CATEGORIES.forEach((c, i) => (l = withLine(l, c, kg((i + 1) * 1000))));
    expect(ledgerTotal(l)).toBe(78_000);
  });
});
