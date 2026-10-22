import { describe, it, expect } from "vite-plus/test";
import {
  resolveSensorsSpotting,
  type ResolveSpottingInput,
  NAUTICAL_MILE_UM,
  VISUAL_DETECTION_RANGE_NMI,
} from "../../src/spotting/index.js";

const RANGE_UM = VISUAL_DETECTION_RANGE_NMI * NAUTICAL_MILE_UM;

function base(): ResolveSpottingInput {
  return {
    observers: [{ observerId: "obs-ATTACKER", sideId: "ATTACKER", position: [0, 0] }],
    assets: [
      {
        assetId: "a1",
        sideId: "DEFENDER",
        position: [100_000, 0],
        heading: 90,
        speedBpKnots: 10_000,
      },
    ],
    battleId: "b1",
    minute: 1,
    observationTime: "1900-01-01T00:01:00.000Z",
  };
}

describe("AC-9 spotting resolution", () => {
  it("produces a contact track only from a detected true asset", () => {
    const contacts = resolveSensorsSpotting(base());
    expect(contacts).toHaveLength(1);
    expect(contacts[0]!.contactId).toBe("b1:a1");
    expect(contacts[0]!.assetId).toBe("a1");
    expect(contacts[0]!.source).toBe("visual");
    expect(contacts[0]!.sideId).toBe("DEFENDER");
  });

  it("does not leak a hidden (undetected) asset as a contact", () => {
    const input = base();
    input.assets[0]!.position = [RANGE_UM * 5, 0];
    const contacts = resolveSensorsSpotting(input);
    expect(contacts).toHaveLength(0);
  });

  it("deduplicates contacts seen by multiple observers and records sources", () => {
    const input = base();
    input.observers.push({ observerId: "obs-ATTACKER-2", sideId: "ATTACKER", position: [0, 0] });
    const contacts = resolveSensorsSpotting(input);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]!.sources.sort()).toEqual(["obs-ATTACKER", "obs-ATTACKER-2"]);
  });

  it("never emits a friendly asset as a contact", () => {
    const input = base();
    input.assets[0]!.sideId = "ATTACKER";
    expect(resolveSensorsSpotting(input)).toHaveLength(0);
  });
});
