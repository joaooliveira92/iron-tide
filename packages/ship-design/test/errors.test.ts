import { isBluewaveError } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { applyArmourScheme } from "../src/armourSchemes.js";
import { SHIP_DESIGN_INVARIANT_FAILED, designInvariant } from "../src/errors.js";

function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

describe("ship-design invariant failures", () => {
  it("carry the original reason as the message and a stable tag and code", () => {
    const error = designInvariant("something is off");

    expect(isBluewaveError(error)).toBe(true);
    expect(error.message).toBe("something is off");
    expect(error.context).toEqual({
      code: SHIP_DESIGN_INVARIANT_FAILED,
      reason: "something is off",
    });
  });

  it("are thrown tagged by a production guard", () => {
    const error = caught(() => applyArmourScheme("no-such-scheme" as never, [], {} as never, "x"));

    expect(isBluewaveError(error) && error.context.code).toBe(SHIP_DESIGN_INVARIANT_FAILED);
    expect(isBluewaveError(error) && error.message).toBe("unknown armour scheme 'no-such-scheme'");
  });
});
