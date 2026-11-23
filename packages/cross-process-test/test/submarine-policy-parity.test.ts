import { SUBMARINE_POLICIES as CAMPAIGN_POLICIES } from "@bluewave/campaign";
import { SUBMARINE_POLICIES as COMBAT_POLICIES } from "@bluewave/combat/submarines";
import { describe, expect, it } from "vite-plus/test";

describe("#1099: submarine policy literals", () => {
  it("offers the same policies in the same order in campaign and combat", () => {
    expect([...CAMPAIGN_POLICIES]).toEqual([...COMBAT_POLICIES]);
  });
});
