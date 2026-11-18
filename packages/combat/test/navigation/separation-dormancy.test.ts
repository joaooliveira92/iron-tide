import { describe, expect, it } from "vite-plus/test";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine } from "@bluewave/random";
import { advanceMinutes } from "@bluewave/combat/simulation";
import {
  BASE_RULES,
  FORMATION,
  navigationContext,
  OBSERVATION,
  scenarioOrders,
  scenarioState,
} from "./separationScenario.js";

type Formation = "LINE_ABREAST" | "SEARCH_LINE" | "SCREEN" | "LINE_AHEAD";

function digest(formation: Formation): string {
  const { hashes } = advanceMinutes({
    state: scenarioState({ divisionOverrides: { formation } }),
    minutes: 6,
    observationTime: OBSERVATION,
    orders: scenarioOrders(),
    formation: FORMATION,
    navigation: navigationContext(BASE_RULES),
    engine: new RandomEngine("separation-dormancy"),
  });
  return sha256Hex(canonicalSerialize(hashes));
}

const PINNED: Record<Formation, string> = {
  LINE_ABREAST: "66998ed87e2f7f4ff3fee02b7b60b6dbd3870a88fd461a8a44765b092483dff1",
  SEARCH_LINE: "3d86206517d4fa18f8d873b512a9c054d3324f5779d6464bd658248abcfc6579",
  SCREEN: "7b2a80c8bb0e09d196579ed9fe78a1a55a1ca3b20f0296395f2c401d58d15340",
  LINE_AHEAD: "9e06f57f2d76002c4aa9f43de8bede2b13ef486b2b25fe0a6f339f0168e8df54",
};

describe("separation dormancy (#941)", () => {
  for (const formation of Object.keys(PINNED) as Formation[]) {
    it(`pins the minute hashes of ${formation} without a separation block`, () => {
      expect(digest(formation)).toBe(PINNED[formation]);
    });
  }
});
