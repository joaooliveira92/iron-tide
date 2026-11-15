import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  dockExpansionDueUnits,
  dockExpansionInstalmentUnits,
  dockExpansionTotalUnits,
  isDockExpansionProject,
  type ConstructionProject,
} from "../src/index.js";

function expansion(over: Partial<ConstructionProject> = {}): ConstructionProject {
  return {
    id: "dock-expansion-GBR-home-1880-02",
    type: "building",
    projectType: "INFRASTRUCTURE",
    targetId: "gbr-home",
    designVersionId: "",
    totalWork: SafeInt(1_200),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status: "PLANNED",
    startedAt: "1880-02",
    elapsedActiveMonths: 0,
    dockExpansionDurationMonths: 12,
    dockExpansionStepKg: 1_000_000,
    ...over,
  };
}

describe("dock expansion instalment schedule", () => {
  it("prices at total work and spreads it over the duration, rounding up", () => {
    expect(dockExpansionTotalUnits(expansion())).toBe(1_200);
    expect(dockExpansionInstalmentUnits(expansion())).toBe(100);
    expect(dockExpansionInstalmentUnits(expansion({ dockExpansionDurationMonths: 9 }))).toBe(134);
  });

  it("owes the cumulative schedule minus what is paid, never above the remainder", () => {
    expect(dockExpansionDueUnits(expansion())).toBe(100);
    expect(
      dockExpansionDueUnits(expansion({ elapsedActiveMonths: 3, paidWork: SafeInt(300) })),
    ).toBe(100);
    expect(
      dockExpansionDueUnits(expansion({ elapsedActiveMonths: 3, paidWork: SafeInt(100) })),
    ).toBe(300);
    expect(
      dockExpansionDueUnits(
        expansion({
          dockExpansionDurationMonths: 9,
          elapsedActiveMonths: 8,
          paidWork: SafeInt(1_072),
        }),
      ),
    ).toBe(128);
    expect(
      dockExpansionDueUnits(expansion({ elapsedActiveMonths: 20, paidWork: SafeInt(900) })),
    ).toBe(300);
  });

  it("owes nothing once paid, completed, cancelled or not a dock expansion", () => {
    expect(dockExpansionDueUnits(expansion({ paidWork: SafeInt(1_200) }))).toBe(0);
    expect(dockExpansionDueUnits(expansion({ status: "COMPLETED" }))).toBe(0);
    expect(dockExpansionDueUnits(expansion({ status: "CANCELLED" }))).toBe(0);
    const other = expansion({ projectType: "NEW_CONSTRUCTION" });
    expect(isDockExpansionProject(other)).toBe(false);
    expect(dockExpansionDueUnits(other)).toBe(0);
  });
});
