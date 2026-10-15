import { describe, expect, it } from "vite-plus/test";
import { defaultFleetMethod } from "./new-game-fleet-method-screen-state.js";

describe("new-game-fleet-method-screen-state", () => {
  it("defaults to the generated (inherit an existing navy) mode", () => {
    expect(defaultFleetMethod()).toEqual({ legacyFleetModeId: "generated" });
  });
});
