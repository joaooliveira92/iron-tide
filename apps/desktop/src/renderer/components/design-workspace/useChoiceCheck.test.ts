import { describe, expect, it } from "vite-plus/test";
import { introducedProblems } from "./useChoiceCheck.js";
import type { BoardFinding } from "./validation/boardFindings.js";

const finding = (key: string, severity: BoardFinding["severity"]): BoardFinding =>
  ({ key, severity }) as BoardFinding;

describe("introducedProblems", () => {
  it("reports blocking and critical findings that were not there before", () => {
    const before = [finding("A", "WARNING")];
    const after = [finding("A", "WARNING"), finding("B", "BLOCKING"), finding("C", "CRITICAL")];
    expect(introducedProblems(before, after).map((f) => f.key)).toEqual(["B", "C"]);
  });

  it("ignores findings that already existed, and warnings or advisories that are new", () => {
    const before = [finding("B", "BLOCKING")];
    const after = [finding("B", "BLOCKING"), finding("W", "WARNING"), finding("V", "ADVISORY")];
    expect(introducedProblems(before, after)).toEqual([]);
  });
});
