import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  MANUAL_LAUNCH_PROHIBITED_MODES,
  SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT,
  TORPEDO_LAUNCH_AUTHORITY_DENIED,
  TORPEDO_LAUNCH_AUTHORITY_MODES,
  TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED,
  torpedoLaunchAuthorityPolicyId,
  validateLaunchAuthority,
  validateTorpedoLaunchAuthorityContract,
  verifyAuthorityGrant,
  type AuthorityGrant,
} from "../../src/torpedoes/index.js";

function grant(overrides: Partial<AuthorityGrant> = {}): AuthorityGrant {
  return {
    grantId: "GRANT-1",
    platformId: "SHIP-ALPHA",
    mode: "CAPTAIN",
    policyId: torpedoLaunchAuthorityPolicyId,
    ...overrides,
  };
}

describe("AC-5: torpedo_launch_authority_v1 contract pins the closed mode enum", () => {
  it("ships the *_v1 policy id and exactly ADMIRAL / REAR_ADMIRAL / CAPTAIN", () => {
    expect(torpedoLaunchAuthorityPolicyId).toBe("torpedo_launch_authority_v1");
    expect([...TORPEDO_LAUNCH_AUTHORITY_MODES]).toEqual(["ADMIRAL", "REAR_ADMIRAL", "CAPTAIN"]);
    expect(SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT.modes).toEqual(TORPEDO_LAUNCH_AUTHORITY_MODES);
  });

  it("prohibits manual launch in exactly ADMIRAL and REAR_ADMIRAL (§5.1/§5.2)", () => {
    expect([...MANUAL_LAUNCH_PROHIBITED_MODES]).toEqual(["ADMIRAL", "REAR_ADMIRAL"]);
    expect(SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT.manualLaunchProhibitedModes).toEqual(
      MANUAL_LAUNCH_PROHIBITED_MODES,
    );
  });

  it("validates the shipped contract and fails closed on tampering", () => {
    expect(() =>
      validateTorpedoLaunchAuthorityContract(SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT),
    ).not.toThrow();
    expect(() => validateTorpedoLaunchAuthorityContract(null)).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoLaunchAuthorityContract({
        ...SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT,
        policyId: "x",
      } as unknown as Partial<typeof SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT>),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoLaunchAuthorityContract({
        ...SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT,
        modes: [...TORPEDO_LAUNCH_AUTHORITY_MODES, "COMMODORE"],
      } as Partial<typeof SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT>),
    ).toThrow(BluewaveError);
    expect(() =>
      validateTorpedoLaunchAuthorityContract({
        ...SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT,
        manualLaunchProhibitedModes: [...MANUAL_LAUNCH_PROHIBITED_MODES, "CAPTAIN"],
      }),
    ).toThrow(BluewaveError);
  });
});

describe("AC-5: the AuthorityGrant is verifiable", () => {
  it("verifies a well-formed grant", () => {
    expect(verifyAuthorityGrant(grant())).toBe(true);
  });

  it("rejects a null/undefined grant", () => {
    expect(verifyAuthorityGrant(null)).toBe(false);
    expect(verifyAuthorityGrant(undefined)).toBe(false);
  });

  it("rejects an out-of-policy, unknown-mode, or empty-id grant", () => {
    expect(verifyAuthorityGrant(grant({ policyId: "torpedo_launch_authority_v2" }))).toBe(false);
    expect(verifyAuthorityGrant(grant({ mode: "COMMODORE" as AuthorityGrant["mode"] }))).toBe(
      false,
    );
    expect(verifyAuthorityGrant(grant({ grantId: "" }))).toBe(false);
    expect(verifyAuthorityGrant(grant({ platformId: "" }))).toBe(false);
  });
});

describe("AC-5: the legality guard enforces the §5 modes", () => {
  it("prohibits manual launch in ADMIRAL mode (TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED)", () => {
    const verdict = validateLaunchAuthority(grant({ mode: "ADMIRAL" }), true);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasonCode).toBe(TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED);
    expect(verdict.mode).toBe("ADMIRAL");
    expect(verdict.manualLaunch).toBe(true);
  });

  it("prohibits manual launch in REAR_ADMIRAL mode (TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED)", () => {
    const verdict = validateLaunchAuthority(grant({ mode: "REAR_ADMIRAL" }), true);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasonCode).toBe(TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED);
    expect(verdict.mode).toBe("REAR_ADMIRAL");
  });

  it("permits manual launch in CAPTAIN mode (§5.3)", () => {
    const verdict = validateLaunchAuthority(grant({ mode: "CAPTAIN" }), true);
    expect(verdict.allowed).toBe(true);
    expect(verdict.reasonCode).toBeNull();
    expect(verdict.mode).toBe("CAPTAIN");
  });

  it("fails closed on a missing grant (TORPEDO_LAUNCH_AUTHORITY_DENIED)", () => {
    for (const missing of [null, undefined]) {
      const verdict = validateLaunchAuthority(missing, true);
      expect(verdict.allowed).toBe(false);
      expect(verdict.mode).toBeNull();
      expect(verdict.reasonCode).toBe(TORPEDO_LAUNCH_AUTHORITY_DENIED);
    }
  });

  it("fails closed on an invalid grant even in CAPTAIN (TORPEDO_LAUNCH_AUTHORITY_DENIED)", () => {
    const verdict = validateLaunchAuthority(grant({ policyId: "forged" }), true);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasonCode).toBe(TORPEDO_LAUNCH_AUTHORITY_DENIED);
  });
});

describe("AC-5: AI and player use the SAME legality rules (§5.4)", () => {
  it("allows automated (non-manual) launches in EVERY mode — same function, no side branch", () => {
    for (const mode of TORPEDO_LAUNCH_AUTHORITY_MODES) {
      const verdict = validateLaunchAuthority(grant({ mode }), false);
      expect(verdict.allowed).toBe(true);
      expect(verdict.reasonCode).toBeNull();
      expect(verdict.mode).toBe(mode);
    }
  });

  it("returns the same verdict for the same inputs regardless of any player/AI flag", () => {
    const automated = validateLaunchAuthority(grant({ mode: "ADMIRAL" }), false);
    const manual = validateLaunchAuthority(grant({ mode: "ADMIRAL" }), true);
    expect(automated.allowed).toBe(true);
    expect(manual.allowed).toBe(false);
  });
});
