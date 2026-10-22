import { describe, expect, it } from "vite-plus/test";
import { assertDeclineAllowed, isDeclineAllowed } from "@bluewave/combat/generation";
import { BATTLE_DECLINE_NOT_ALLOWED } from "@bluewave/combat/generation";

describe("declining by acceptance class", () => {
  it("allows every class but the operationally unavoidable one, without throwing", () => {
    expect(isDeclineAllowed("OPERATIONALLY_UNAVOIDABLE")).toBe(false);
    expect(isDeclineAllowed("OPTIONAL")).toBe(true);
    expect(isDeclineAllowed("POLITICALLY_EXPECTED")).toBe(true);
  });

  it("keeps the throwing assertion consistent with the predicate", () => {
    expect(() => assertDeclineAllowed("OPERATIONALLY_UNAVOIDABLE")).toThrow(
      BATTLE_DECLINE_NOT_ALLOWED,
    );
    expect(() => assertDeclineAllowed("OPTIONAL")).not.toThrow();
  });
});
