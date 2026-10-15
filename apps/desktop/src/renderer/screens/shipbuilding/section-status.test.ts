import { describe, expect, it } from "vite-plus/test";
import type { ComponentCategory } from "@bluewave/ship-design";
import { sectionStatuses, type StatusFinding } from "./section-status.js";

const gun: [string, ComponentCategory] = ["GUN_1", "MAIN_GUN"];
const rangefinder: [string, ComponentCategory] = ["RF_1", "RANGEFINDER"];
const fittings = new Map([gun, rangefinder]);

const finding = (
  severity: StatusFinding["severity"],
  settings: StatusFinding["settings"],
  ...instanceIds: string[]
): StatusFinding => ({
  severity,
  settings,
  entities: instanceIds.length
    ? instanceIds.map((instanceId) => ({ kind: "fitting" as const, instanceId }))
    : [{ kind: "ship" as const }],
});

describe("sectionStatuses", () => {
  it("marks every section valid when there are no findings and the fittings configure armament and systems", () => {
    const s = sectionStatuses([], fittings);
    for (const id of [
      "overview",
      "hull",
      "machinery",
      "protection",
      "armament",
      "systems",
      "review",
    ] as const)
      expect(s[id]).toEqual({ kind: "valid" });
  });

  it("shows armament and systems as not configured when nothing of theirs is fitted", () => {
    const s = sectionStatuses([], new Map());
    expect(s.armament).toEqual({ kind: "not-configured" });
    expect(s.systems).toEqual({ kind: "not-configured" });
    expect(s.hull).toEqual({ kind: "valid" });
  });

  it("routes findings by their settings group, counting blocking and critical as unresolved issues", () => {
    const s = sectionStatuses(
      [
        finding("BLOCKING", "hull"),
        finding("CRITICAL", "hull"),
        finding("WARNING", "armour"),
        finding("ADVISORY", "machinery"),
        finding("WARNING", "brief"),
      ],
      fittings,
    );
    expect(s.hull).toEqual({ kind: "issues", count: 2 });
    expect(s.protection).toEqual({ kind: "warning", count: 1 });
    expect(s.machinery).toEqual({ kind: "valid" });
    expect(s.overview).toEqual({ kind: "warning", count: 1 });
  });

  it("routes arrangement findings to the section that owns each named fitting", () => {
    const s = sectionStatuses(
      [finding("BLOCKING", "arrangement", "GUN_1"), finding("WARNING", "arrangement", "RF_1")],
      fittings,
    );
    expect(s.armament).toEqual({ kind: "issues", count: 1 });
    expect(s.systems).toEqual({ kind: "warning", count: 1 });
  });

  it("gives Review the whole design's status, including findings no section owns", () => {
    const s = sectionStatuses(
      [
        finding("BLOCKING", undefined),
        finding("CRITICAL", "hull"),
        finding("WARNING", "arrangement"),
      ],
      fittings,
    );
    expect(s.review).toEqual({ kind: "issues", count: 2 });
    expect(s.hull).toEqual({ kind: "issues", count: 1 });
    expect(s.armament).toEqual({ kind: "valid" });
  });
});
