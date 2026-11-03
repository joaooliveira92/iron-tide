import { describe, expect, it } from "vite-plus/test";
import { DESIGN_SECTIONS, type DesignSectionId } from "./design-sections.js";
import { DESIGN_SECTION_SUMMARY, designIndexTabs, statusDetail } from "./design-tabs.js";
import type { SectionStatus } from "./section-status.js";

const all = (status: SectionStatus): { readonly [K in DesignSectionId]: SectionStatus } =>
  Object.fromEntries(DESIGN_SECTIONS.map((id) => [id, status])) as {
    readonly [K in DesignSectionId]: SectionStatus;
  };

describe("designIndexTabs", () => {
  it("lists the seven sections in order, grouped as overview, the five systems, then review", () => {
    const groups = designIndexTabs(all({ kind: "valid" }));
    expect(groups.map((g) => g.map((t) => t.id))).toEqual([
      ["overview"],
      ["hull", "machinery", "protection", "armament", "systems"],
      ["review"],
    ]);
  });

  it("asks for attention only where there is something to fix", () => {
    const statuses = { ...all({ kind: "valid" }), hull: { kind: "issues", count: 2 } as const };
    const tabs = designIndexTabs(statuses).flat();
    expect(tabs.filter((t) => t.attention).map((t) => t.id)).toEqual(["hull"]);
    expect(tabs.find((t) => t.id === "hull")?.detail).toBe("2 problems");
  });

  it("describes every status in words", () => {
    expect(statusDetail({ kind: "valid" }).text).toBe("No problems");
    expect(statusDetail({ kind: "warning", count: 1 })).toEqual({
      text: "1 warning",
      attention: true,
    });
    expect(statusDetail({ kind: "not-configured" })).toEqual({
      text: "Nothing fitted",
      attention: false,
    });
  });

  it("summarises every section for the panel header", () => {
    for (const id of DESIGN_SECTIONS) expect(DESIGN_SECTION_SUMMARY[id].length).toBeGreaterThan(10);
  });
});
