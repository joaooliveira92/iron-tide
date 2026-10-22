import { describe, expect, it } from "vite-plus/test";
import {
  canDeploySmokeFloat,
  deploySmokeFloat,
  SMOKE_FLOAT_INITIAL_DENSITY,
  SMOKE_DOCTRINE_ADOPTION_MONTHS,
  SMOKE_FLOAT_TECHNOLOGY_UNAVAILABLE,
  SMOKE_FLOAT_CAPACITY_MISSING,
  SMOKE_FLOAT_INVENTORY_EMPTY,
  SMOKE_FLOAT_DEPLOYMENT_SPEED_EXCEEDED,
  SMOKE_EQUIPMENT_MODE_CONFLICT,
} from "@bluewave/combat/smoke";

function validDeployParams() {
  return {
    shipClass: "CL",
    smokeFloatTechnologyDiscovered: true,
    doctrineAdoptedMonths: SMOKE_DOCTRINE_ADOPTION_MONTHS,
    storageAndDeploymentInstalled: true,
    remainingFloats: 2,
    currentSpeedKt: 15,
    deploymentAlreadyThisSubstep: false,
    tacticalPositionLegal: true,
    equipmentMode: "FLOATS" as const,
  };
}

describe("canDeploySmokeFloat", () => {
  it("CL with tech and doctrine can deploy", () => {
    const result = canDeploySmokeFloat(validDeployParams());
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("wrong ship class fails", () => {
    const result = canDeploySmokeFloat({ ...validDeployParams(), shipClass: "DD" });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("SHIP_CLASS_MISMATCH");
  });

  it("missing tech fails", () => {
    const result = canDeploySmokeFloat({
      ...validDeployParams(),
      smokeFloatTechnologyDiscovered: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_FLOAT_TECHNOLOGY_UNAVAILABLE);
  });

  it("no doctrine fails", () => {
    const result = canDeploySmokeFloat({ ...validDeployParams(), doctrineAdoptedMonths: 0 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_FLOAT_CAPACITY_MISSING);
  });

  it("no floats remaining fails", () => {
    const result = canDeploySmokeFloat({ ...validDeployParams(), remainingFloats: 0 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_FLOAT_INVENTORY_EMPTY);
  });

  it("speed > 25 knots fails", () => {
    const result = canDeploySmokeFloat({ ...validDeployParams(), currentSpeedKt: 30 });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_FLOAT_DEPLOYMENT_SPEED_EXCEEDED);
  });

  it("speed exactly 25 knots is allowed", () => {
    const result = canDeploySmokeFloat({ ...validDeployParams(), currentSpeedKt: 25 });
    expect(result.eligible).toBe(true);
  });

  it("already deploying this substep fails", () => {
    const result = canDeploySmokeFloat({
      ...validDeployParams(),
      deploymentAlreadyThisSubstep: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("DEPLOYMENT_ALREADY_IN_PROGRESS");
  });

  it("illegal tactical position fails", () => {
    const result = canDeploySmokeFloat({ ...validDeployParams(), tacticalPositionLegal: false });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("ILLEGAL_TACTICAL_POSITION");
  });

  it("mode conflict with generator fails", () => {
    const result = canDeploySmokeFloat({ ...validDeployParams(), equipmentMode: "GENERATOR" });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_EQUIPMENT_MODE_CONFLICT);
  });

  it("mode NONE fails (floats not configured)", () => {
    const result = canDeploySmokeFloat({ ...validDeployParams(), equipmentMode: "NONE" });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(SMOKE_EQUIPMENT_MODE_CONFLICT);
  });
});

describe("deploySmokeFloat", () => {
  it("creates cloud with correct density", () => {
    const { cloud } = deploySmokeFloat([1000, 2000], 3, "ship-456", "PLAYER_1", 150, 0);
    expect(cloud.densityBp).toBe(SMOKE_FLOAT_INITIAL_DENSITY);
  });

  it("reduces float count", () => {
    const { remainingFloats } = deploySmokeFloat([1000, 2000], 3, "ship-456", "PLAYER_1", 150, 0);
    expect(remainingFloats).toBe(2);
  });

  it("deployment at stern position", () => {
    const { cloud } = deploySmokeFloat([1000, 2000], 3, "ship-456", "PLAYER_1", 150, 0);
    expect(cloud.centroidPosition).toEqual([1000, 1950]);
  });

  it("smoke float cloud has correct source type", () => {
    const { cloud } = deploySmokeFloat([1000, 2000], 3, "ship-456", "PLAYER_1", 150, 0);
    expect(cloud.sourceType).toBe("FLOAT");
  });

  it("cloud has correct owner and source ID", () => {
    const { cloud } = deploySmokeFloat([1000, 2000], 3, "ship-456", "PLAYER_2", 150, 0);
    expect(cloud.owner).toBe("PLAYER_2");
    expect(cloud.sourceId).toBe("ship-456");
  });

  it("last float deployment reduces to 0", () => {
    const { remainingFloats } = deploySmokeFloat([1000, 2000], 1, "ship-456", "PLAYER_1", 150, 0);
    expect(remainingFloats).toBe(0);
  });

  it("cloud is active after deployment", () => {
    const { cloud } = deploySmokeFloat([1000, 2000], 3, "ship-456", "PLAYER_1", 150, 0);
    expect(cloud.active).toBe(true);
  });

  it("cloud ID contains float prefix", () => {
    const { cloud } = deploySmokeFloat([1000, 2000], 3, "ship-456", "PLAYER_1", 150, 0);
    expect(cloud.smokeCloudId).toContain("float-");
  });
});
