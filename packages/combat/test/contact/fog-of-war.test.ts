import { describe, it, expect } from "vite-plus/test";
import { createContactTrack, resolveLegalTarget } from "@bluewave/combat/contact";

function knownMap() {
  const a = createContactTrack({
    battleId: "b1",
    assetId: "a1",
    sideId: "DEFENDER",
    estimatedIdentity: "unknown",
    position: [0, 0],
    course: 90,
    speedBpKnots: 10_000,
    observationTime: "1900-01-01T00:00:00.000Z",
    minute: 0,
  });
  const b = createContactTrack({
    battleId: "b1",
    assetId: "a2",
    sideId: "DEFENDER",
    estimatedIdentity: "unknown",
    position: [100, 0],
    course: 0,
    speedBpKnots: 9_000,
    observationTime: "1900-01-01T00:00:00.000Z",
    minute: 0,
  });
  return new Map([
    [a.contactId, a],
    [b.contactId, b],
  ]);
}

describe("AC-11 fog-of-war", () => {
  it("resolves a legal known ContactTrack (no leak)", () => {
    const map = knownMap();
    const track = resolveLegalTarget("b1:a1", map);
    expect(track.assetId).toBe("a1");
  });

  it("rejects a target order referencing a hidden true asset (no legal track)", () => {
    const map = knownMap();
    let thrown = false;
    let code = "";
    try {
      resolveLegalTarget("b1:GHOST", map, "GHOST");
    } catch (e) {
      thrown = true;
      code = (e as { message: string }).message;
    }
    expect(thrown).toBe(true);
    expect(code).toBe("TACTICAL_FOG_OF_WAR_VIOLATION");
  });

  it("rejects a target order against a zero-confidence (stale/dropped) track", () => {
    const map = knownMap();
    const stale = map.get("b1:a2")!;
    stale.confidence = 0;
    let code = "";
    try {
      resolveLegalTarget("b1:a2", map);
    } catch (e) {
      code = (e as { message: string }).message;
    }
    expect(code).toBe("TACTICAL_FOG_OF_WAR_VIOLATION");
  });
});
