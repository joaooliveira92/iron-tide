import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  SHIPPED_MOVEMENT_KINEMATICS_CONTRACT,
  validateMovementKinematicsContract,
  SHIPPED_FORMATION_STATION_CONTRACT,
  validateFormationStationContract,
  movementKinematicsPolicyId,
} from "@bluewave/combat/movement";
import {
  SHIPPED_SPOTTING_SENSOR_CONTRACT,
  validateSpottingSensorContract,
  spottingSensorPolicyId,
  NAUTICAL_MILE_UM,
} from "@bluewave/combat/spotting";
import {
  SHIPPED_CONTACT_LIFECYCLE_CONTRACT,
  validateContactLifecycleContract,
  contactLifecyclePolicyId,
} from "@bluewave/combat/contact";

describe("AC-14 versioned contracts ship *_v1 + SHIPPED_*_CONTRACT + validate guard", () => {
  it("movement kinematics contract ships *_v1 policy and validates", () => {
    expect(movementKinematicsPolicyId).toBe("movement_kinematics_v1");
    expect(SHIPPED_MOVEMENT_KINEMATICS_CONTRACT.policyId).toBe("movement_kinematics_v1");
    expect(() =>
      validateMovementKinematicsContract(SHIPPED_MOVEMENT_KINEMATICS_CONTRACT),
    ).not.toThrow();
    expect(() =>
      validateMovementKinematicsContract({
        ...SHIPPED_MOVEMENT_KINEMATICS_CONTRACT,
        policyId: "x",
      }),
    ).toThrow(BluewaveError);
  });

  it("formation station contract ships and validates", () => {
    expect(() =>
      validateFormationStationContract(SHIPPED_FORMATION_STATION_CONTRACT),
    ).not.toThrow();
    expect(() =>
      validateFormationStationContract({
        ...SHIPPED_FORMATION_STATION_CONTRACT,
        lineAheadColumnIntervalUm: -1,
      }),
    ).toThrow(BluewaveError);
  });

  it("spotting sensor contract ships *_v1 policy and validates", () => {
    expect(spottingSensorPolicyId).toBe("spotting_sensor_v1");
    expect(SHIPPED_SPOTTING_SENSOR_CONTRACT.policyId).toBe("spotting_sensor_v1");
    expect(NAUTICAL_MILE_UM).toBe(1_852_000_000);
    expect(() => validateSpottingSensorContract(SHIPPED_SPOTTING_SENSOR_CONTRACT)).not.toThrow();
    expect(() =>
      validateSpottingSensorContract({ ...SHIPPED_SPOTTING_SENSOR_CONTRACT, nauticalMileUm: 1 }),
    ).toThrow(BluewaveError);
  });

  it("contact lifecycle contract ships *_v1 policy and validates", () => {
    expect(contactLifecyclePolicyId).toBe("contact_lifecycle_v1");
    expect(SHIPPED_CONTACT_LIFECYCLE_CONTRACT.policyId).toBe("contact_lifecycle_v1");
    expect(() =>
      validateContactLifecycleContract(SHIPPED_CONTACT_LIFECYCLE_CONTRACT),
    ).not.toThrow();
    expect(() =>
      validateContactLifecycleContract({
        ...SHIPPED_CONTACT_LIFECYCLE_CONTRACT,
        confidenceMaxBp: 0,
      }),
    ).toThrow(BluewaveError);
  });
});
