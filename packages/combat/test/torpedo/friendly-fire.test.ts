import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  assessFriendlyFireRisk,
  TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP,
  UNIDENTIFIED_CONTACT_IDENTITY,
  type FriendlyFireRiskInputs,
  type FriendlyTrack,
} from "../../src/torpedoes/index.js";

const FRIENDLY = ["rn_cl_arethusa", "rn_dd_amazon"];

function track(overrides: Partial<FriendlyTrack> = {}): FriendlyTrack {
  return {
    contactId: "FRIEND-1",
    estimatedIdentity: "rn_cl_arethusa",
    relativeBearingMdeg: 0,
    rangeM: 5_000,
    confidenceBp: 5_000,
    ...overrides,
  };
}

function inputs(overrides: Partial<FriendlyFireRiskInputs> = {}): FriendlyFireRiskInputs {
  return {
    targetRelativeBearingMdeg: 0,
    targetEstimatedRangeM: 5_000,
    solutionUncertaintyM: 0,
    spreadHalfAngleMdeg: 0,
    friendlyTracks: [],
    friendlyIdentities: FRIENDLY,
    manualLaunch: false,
    ...overrides,
  };
}

describe("AC-19: danger-sector geometry", () => {
  it("computes the uncertainty half-angle with the authored small-angle approximation", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({ solutionUncertaintyM: 1_000, spreadHalfAngleMdeg: 500 }),
    );
    expect(assessment.uncertaintyHalfAngleMdeg).toBe(11_459);
    expect(assessment.dangerHalfAngleMdeg).toBe(11_959);
  });

  it("never divides by zero: a zero/unknown target range falls back to 1 m", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({ targetEstimatedRangeM: 0, solutionUncertaintyM: 5_000 }),
    );
    expect(assessment.uncertaintyHalfAngleMdeg).toBe(286_480_000);
    expect(assessment.dangerHalfAngleMdeg).toBe(286_480_000);
  });

  it("handles bearing wraparound across ±180_000 mdeg", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({
        targetRelativeBearingMdeg: 179_000,
        spreadHalfAngleMdeg: 3_000,
        friendlyTracks: [track({ relativeBearingMdeg: -179_000 })],
      }),
    );
    expect(assessment.tracksInDangerSector.length).toBe(1);
    expect(assessment.confirmedFriendlyInSector).toBe(true);
  });

  it("ignores tracks outside the sector entirely", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({
        spreadHalfAngleMdeg: 1_000,
        friendlyTracks: [track({ relativeBearingMdeg: 45_000, confidenceBp: 0 })],
      }),
    );
    expect(assessment.tracksInDangerSector.length).toBe(0);
    expect(assessment.confirmedFriendlyInSector).toBe(false);
    expect(assessment.unidentifiedOrLowConfidenceInSector).toBe(false);
    expect(assessment.prohibited).toBe(false);
    expect(assessment.raisesMinimumSolutionQuality).toBe(false);
  });
});

describe("AC-19: §24 prohibition (confirmed friendly below 1_000 m predicted separation)", () => {
  it("a confirmed friendly dead on the bearing line (cross-track 0 m) is PROHIBITED", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({ friendlyTracks: [track({ relativeBearingMdeg: 0, rangeM: 5_000 })] }),
    );
    expect(assessment.prohibited).toBe(true);
    expect(assessment.raisesMinimumSolutionQuality).toBe(true);
    expect(assessment.confirmedFriendlyInSector).toBe(true);
  });

  it("the 1_000 m separation boundary is inclusive: 999 m prohibits, 1_000 m does not", () => {
    const below = assessFriendlyFireRisk(
      inputs({
        spreadHalfAngleMdeg: 6_000,
        friendlyTracks: [track({ relativeBearingMdeg: 5_000, rangeM: 11_459 })],
      }),
    );
    expect(below.prohibited).toBe(true);
    const at = assessFriendlyFireRisk(
      inputs({
        spreadHalfAngleMdeg: 6_000,
        friendlyTracks: [track({ relativeBearingMdeg: 5_000, rangeM: 11_460 })],
      }),
    );
    expect(at.prohibited).toBe(false);
    expect(at.raisesMinimumSolutionQuality).toBe(true);
  });

  it("manual launch is echoed but NEVER waives the prohibition", () => {
    const manual = assessFriendlyFireRisk(
      inputs({
        manualLaunch: true,
        friendlyTracks: [track({ relativeBearingMdeg: 0 })],
      }),
    );
    expect(manual.manualLaunch).toBe(true);
    expect(manual.prohibited).toBe(true);
  });

  it("a confirmed friendly outside the sector does not prohibit", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({
        spreadHalfAngleMdeg: 1_000,
        friendlyTracks: [track({ relativeBearingMdeg: 2_000, rangeM: 5_000 })],
      }),
    );
    expect(assessment.prohibited).toBe(false);
    expect(assessment.raisesMinimumSolutionQuality).toBe(false);
  });
});

describe("AC-19/§24: the §10 quality raise for unidentified or low-confidence contacts", () => {
  it("an unidentified contact inside the sector raises the minimum but does not prohibit", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({
        spreadHalfAngleMdeg: 1_000,
        friendlyTracks: [
          track({
            contactId: "GHOST-1",
            estimatedIdentity: UNIDENTIFIED_CONTACT_IDENTITY,
            relativeBearingMdeg: 500,
          }),
        ],
      }),
    );
    expect(assessment.raisesMinimumSolutionQuality).toBe(true);
    expect(assessment.unidentifiedOrLowConfidenceInSector).toBe(true);
    expect(assessment.prohibited).toBe(false);
  });

  it("a low-confidence non-friendly contact inside the sector raises the minimum", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({
        spreadHalfAngleMdeg: 1_000,
        friendlyTracks: [
          track({
            contactId: "LOWCONF-1",
            estimatedIdentity: "ger_ca_admiral_hipper",
            relativeBearingMdeg: 500,
            confidenceBp: TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP - 1,
          }),
        ],
      }),
    );
    expect(assessment.raisesMinimumSolutionQuality).toBe(true);
    expect(assessment.prohibited).toBe(false);
  });

  it("a high-confidence identified enemy inside the sector neither raises nor prohibits", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({
        spreadHalfAngleMdeg: 1_000,
        friendlyTracks: [
          track({
            contactId: "ENEMY-1",
            estimatedIdentity: "ger_ca_admiral_hipper",
            relativeBearingMdeg: 500,
            confidenceBp: 9_000,
          }),
        ],
      }),
    );
    expect(assessment.raisesMinimumSolutionQuality).toBe(false);
    expect(assessment.prohibited).toBe(false);
  });

  it("a low-confidence CONFIRMED friendly is both a raise and (below 1_000 m) a prohibition", () => {
    const assessment = assessFriendlyFireRisk(
      inputs({
        friendlyTracks: [track({ relativeBearingMdeg: 0, rangeM: 5_000, confidenceBp: 2_000 })],
      }),
    );
    expect(assessment.raisesMinimumSolutionQuality).toBe(true);
    expect(assessment.prohibited).toBe(true);
  });
});

describe("AC-19: structurally-invalid inputs fail closed (TORPEDO_STATE_INVARIANT_FAILED)", () => {
  it("rejects non-integer geometry inputs", () => {
    expect(() => assessFriendlyFireRisk(inputs({ targetRelativeBearingMdeg: 0.5 }))).toThrow(
      BluewaveError,
    );
    expect(() => assessFriendlyFireRisk(inputs({ targetEstimatedRangeM: -1 }))).toThrow(
      BluewaveError,
    );
    expect(() => assessFriendlyFireRisk(inputs({ solutionUncertaintyM: 0.5 }))).toThrow(
      BluewaveError,
    );
    expect(() => assessFriendlyFireRisk(inputs({ spreadHalfAngleMdeg: -1 }))).toThrow(
      BluewaveError,
    );
  });

  it("rejects malformed friendly-track records (non-array, bad confidence, missing ids)", () => {
    expect(() => assessFriendlyFireRisk(inputs({ friendlyTracks: 42 as never }))).toThrow(
      BluewaveError,
    );
    expect(() => assessFriendlyFireRisk(inputs({ friendlyTracks: [null] as never }))).toThrow(
      BluewaveError,
    );
    expect(() =>
      assessFriendlyFireRisk(inputs({ friendlyTracks: [track({ confidenceBp: 10_001 })] })),
    ).toThrow(BluewaveError);
    expect(() =>
      assessFriendlyFireRisk(inputs({ friendlyTracks: [track({ rangeM: -1 })] })),
    ).toThrow(BluewaveError);
    expect(() =>
      assessFriendlyFireRisk(inputs({ friendlyTracks: [track({ contactId: "" })] })),
    ).toThrow(BluewaveError);
    expect(() =>
      assessFriendlyFireRisk(inputs({ friendlyTracks: [track({ estimatedIdentity: "" })] })),
    ).toThrow(BluewaveError);
  });

  it("rejects malformed identity surfaces and a non-boolean manualLaunch", () => {
    expect(() =>
      assessFriendlyFireRisk(inputs({ friendlyIdentities: "rn_cl_arethusa" as never })),
    ).toThrow(BluewaveError);
    expect(() => assessFriendlyFireRisk(inputs({ friendlyIdentities: [42] as never }))).toThrow(
      BluewaveError,
    );
    expect(() => assessFriendlyFireRisk(inputs({ manualLaunch: 1 as never }))).toThrow(
      BluewaveError,
    );
  });
});
