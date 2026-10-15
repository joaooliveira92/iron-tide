/* @vitest-environment jsdom */
import type { LandTargetDamage, MinePressure, SubmarinePool } from "@bluewave/campaign-engine";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { StrategicOverviewTab } from "./StrategicOverviewTab.js";

/**
 * Pure-presentation render tests for the Strategic Overview tab. The three
 * theater sections render straight from their projected rows; the empty case
 * for each is stated plainly rather than hidden. Nothing here touches
 * authoritative state.
 */
const pools: readonly SubmarinePool[] = [
  { poolId: "pool_1", nationId: "uk", submarineType: "Holland-class", available: 3 },
  { poolId: "pool_2", nationId: "germany", submarineType: "U-boat", available: 5 },
];

const pressure: readonly MinePressure[] = [
  {
    areaId: "area_mediterranean",
    density: 2,
    sources: ["minefield_a", "minefield_b"],
    freshness: 80,
    detectionConfidence: 60,
  },
];

const damage: readonly LandTargetDamage[] = [
  { landTargetId: "fort_dover", damage: 0, state: "intact" },
  { landTargetId: "fort_calais", damage: 55, state: "damaged" },
];

afterEach(() => {
  cleanup();
});

describe("StrategicOverviewTab", () => {
  it("renders submarine pools, mine pressure and coastal defenses from the rows", () => {
    render(
      <StrategicOverviewTab
        submarinePools={pools}
        minePressure={pressure}
        landTargetDamage={damage}
      />,
    );

    expect(screen.getByText("Submarine Warfare Pools")).not.toBeNull();
    expect(screen.getByText("United Kingdom")).not.toBeNull();
    expect(screen.getByText("German Empire")).not.toBeNull();
    expect(screen.getByText("Holland-class")).not.toBeNull();
    expect(screen.getByText("3 available")).not.toBeNull();
    expect(screen.getByText("5 available")).not.toBeNull();

    expect(screen.getByText("Sea Mine Pressure Map")).not.toBeNull();
    expect(screen.getByText("Mediterranean")).not.toBeNull();
    expect(screen.getByText("Sources: 2")).not.toBeNull();
    expect(screen.getByText("80%")).not.toBeNull();
    expect(screen.getByText("60%")).not.toBeNull();

    expect(screen.getByText("Coastal Defenses & Batteries")).not.toBeNull();
    expect(screen.getByText("fort_dover")).not.toBeNull();
    expect(screen.getByText("intact")).not.toBeNull();
    expect(screen.getByText("fort_calais")).not.toBeNull();
    expect(screen.getByText("damaged")).not.toBeNull();
  });

  it("states each empty theater section plainly instead of hiding it", () => {
    render(<StrategicOverviewTab submarinePools={[]} minePressure={[]} landTargetDamage={[]} />);

    expect(screen.getByText("No submarine deployments")).not.toBeNull();
    expect(screen.getByText("No active minefields")).not.toBeNull();
    expect(screen.getByText("No fortified land targets")).not.toBeNull();
  });
});
