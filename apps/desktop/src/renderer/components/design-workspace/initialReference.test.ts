import { describe, expect, it } from "vite-plus/test";
import type { ReferenceDesign } from "./content.js";
import { selectInitialReference } from "./initialReference.js";

const ref = (id: string, month: string): ReferenceDesign => ({
  id,
  name: id,
  month,
  draft: {} as ReferenceDesign["draft"],
});

const refs = [
  ref("old_1895", "1895-06"),
  ref("new_1896", "1896-01"),
  ref("first_1880", "1880-01"),
  ref("second_1880", "1880-01"),
  ref("mid_1890", "1890-01"),
];

describe("selectInitialReference", () => {
  it("in a campaign, picks the newest design that exists at the campaign date", () => {
    expect(selectInitialReference(refs, "1885-01")!.id).toBe("first_1880");
    expect(selectInitialReference(refs, "1891-01")!.id).toBe("mid_1890");
    expect(selectInitialReference(refs, "1895-06")!.id).toBe("old_1895");
    expect(selectInitialReference(refs, "1900-01")!.id).toBe("new_1896");
  });

  it("never picks a design dated after the campaign date", () => {
    const picked = selectInitialReference(refs, "1885-01")!;
    expect(["old_1895", "new_1896", "mid_1890"]).not.toContain(picked.id);
  });

  it("breaks equal-date ties by file order", () => {
    expect(selectInitialReference(refs, "1880-06")!.id).toBe("first_1880");
  });

  it("standalone (no campaign date) uses the first design", () => {
    expect(selectInitialReference(refs, null)!.id).toBe("old_1895");
  });

  it("produces a defined fallback for an empty catalogue", () => {
    expect(selectInitialReference([], "1880-01")).toBeUndefined();
  });

  it("falls back to the first design when the date precedes every design", () => {
    expect(selectInitialReference(refs, "1879-01")!.id).toBe("old_1895");
  });

  it("does not match every design on a malformed date", () => {
    expect(selectInitialReference(refs, "not-a-month")!.id).toBe("old_1895");
  });
});
