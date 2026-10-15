import { describe, expect, it } from "vite-plus/test";
import {
  canActivateSmokeGenerator,
  activateSmokeGenerator,
  SMOKE_GENERATOR_COOLDOWN_MINUTES,
  SMOKE_GENERATOR_CHARGES,
  SMOKE_GENERATOR_INITIAL_DENSITY,
  SMOKE_DOCTRINE_ADOPTION_MONTHS,
  SMOKE_GENERATOR_TECHNOLOGY_UNAVAILABLE,
  SMOKE_GENERATOR_CHARGES_EMPTY,
  SMOKESCREEN_COOLDOWN_ACTIVE,
} from "../../src/smoke/index.js";

function validActivateParams() {
  return {
    generatorTechnologyDiscovered: true,
    generatorInstalledAndOperational: true,
    remainingCharges: SMOKE_GENERATOR_CHARGES,
    cooldownActive: false,
    cooldownUntilMinute: 0,
    currentMinute: 100,
    doctrineAdoptedMonths: SMOKE_DOCTRINE_ADOPTION_MONTHS,
  };
}

describe("canActivateSmokeGenerator", () => {
  it("generator with tech and charge can activate", () => {
    const result = canActivateSmokeGenerator(validActivateParams());
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("no charges remaining fails", () => {
    const result = canActivateSmokeGenerator({ ...validActivateParams(), remainingCharges: 0 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_GENERATOR_CHARGES_EMPTY);
  });

  it("cooldown active fails", () => {
    const result = canActivateSmokeGenerator({ ...validActivateParams(), cooldownActive: true });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKESCREEN_COOLDOWN_ACTIVE);
  });

  it("generator not installed fails", () => {
    const result = canActivateSmokeGenerator({
      ...validActivateParams(),
      generatorInstalledAndOperational: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("GENERATOR_NOT_INSTALLED");
  });

  it("unknown tech returns ineligible", () => {
    const result = canActivateSmokeGenerator({
      ...validActivateParams(),
      generatorTechnologyDiscovered: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_GENERATOR_TECHNOLOGY_UNAVAILABLE);
  });

  it("doctrine not adopted fails", () => {
    const result = canActivateSmokeGenerator({
      ...validActivateParams(),
      doctrineAdoptedMonths: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_GENERATOR_TECHNOLOGY_UNAVAILABLE);
  });

  it("single remaining charge is sufficient", () => {
    const result = canActivateSmokeGenerator({ ...validActivateParams(), remainingCharges: 1 });
    expect(result.eligible).toBe(true);
  });

  it("cooldown ends at the right minute", () => {
    const { cooldownUntilMinute } = activateSmokeGenerator(
      [500, 500],
      3,
      100,
      0,
      "ship-001",
      "PLAYER_1",
    );
    expect(cooldownUntilMinute).toBe(100 + SMOKE_GENERATOR_COOLDOWN_MINUTES);
  });
});

describe("activateSmokeGenerator", () => {
  it("creates cloud with correct density", () => {
    const { cloud } = activateSmokeGenerator([500, 500], 3, 100, 0, "ship-001", "PLAYER_1");
    expect(cloud.densityBp).toBe(SMOKE_GENERATOR_INITIAL_DENSITY);
  });

  it("reduces charges", () => {
    const { nextCharges } = activateSmokeGenerator([500, 500], 3, 100, 0, "ship-001", "PLAYER_1");
    expect(nextCharges).toBe(2);
  });

  it("cooldown period is set correctly", () => {
    const { cooldownUntilMinute } = activateSmokeGenerator(
      [500, 500],
      3,
      120,
      0,
      "ship-001",
      "PLAYER_1",
    );
    expect(cooldownUntilMinute).toBe(140);
  });

  it("generator cloud has correct source type", () => {
    const { cloud } = activateSmokeGenerator([500, 500], 3, 100, 0, "ship-001", "PLAYER_1");
    expect(cloud.sourceType).toBe("GENERATOR");
  });

  it("cloud is placed at ship position", () => {
    const { cloud } = activateSmokeGenerator([1500, 2500], 3, 100, 0, "ship-001", "PLAYER_1");
    expect(cloud.centroidPosition).toEqual([1500, 2500]);
  });

  it("cloud has correct owner and source ID", () => {
    const { cloud } = activateSmokeGenerator([500, 500], 3, 100, 0, "ship-007", "PLAYER_2");
    expect(cloud.owner).toBe("PLAYER_2");
    expect(cloud.sourceId).toBe("ship-007");
  });

  it("last charge consumes it", () => {
    const { nextCharges } = activateSmokeGenerator([500, 500], 1, 100, 0, "ship-001", "PLAYER_1");
    expect(nextCharges).toBe(0);
  });

  it("cloud is active after activation", () => {
    const { cloud } = activateSmokeGenerator([500, 500], 3, 100, 0, "ship-001", "PLAYER_1");
    expect(cloud.active).toBe(true);
  });

  it("cloud ID contains generator prefix", () => {
    const { cloud } = activateSmokeGenerator([500, 500], 3, 100, 0, "ship-001", "PLAYER_1");
    expect(cloud.smokeCloudId).toContain("generator-");
  });

  it("vertical extent is 100m", () => {
    const { cloud } = activateSmokeGenerator([500, 500], 3, 100, 0, "ship-001", "PLAYER_1");
    expect(cloud.verticalExtentM).toBe(100);
  });
});
