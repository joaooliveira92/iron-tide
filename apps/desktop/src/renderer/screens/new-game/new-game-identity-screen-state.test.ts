import { describe, expect, it } from "vite-plus/test";
import {
  defaultCampaignIdentity,
  isCampaignIdentityValid,
  updateCampaignIdentity,
} from "./new-game-identity-screen-state.js";

describe("new-game-identity-screen-state", () => {
  it("defaults to empty names and historical/disabled/imperial enums", () => {
    const identity = defaultCampaignIdentity();
    expect(identity).toEqual({
      admiralName: "",
      campaignName: "",
      namingConvention: "historical",
      shipNameReuse: "disabled",
      measurementSystem: "imperial",
    });
  });

  it("is invalid until both admiral and campaign name are non-empty after trimming", () => {
    const identity = defaultCampaignIdentity();
    expect(isCampaignIdentityValid(identity)).toBe(false);

    const withAdmiral = updateCampaignIdentity(identity, "admiralName", "  ");
    expect(isCampaignIdentityValid(withAdmiral)).toBe(false);

    const withBoth = updateCampaignIdentity(
      updateCampaignIdentity(identity, "admiralName", "John Fisher"),
      "campaignName",
      "Britannia Ascendant",
    );
    expect(isCampaignIdentityValid(withBoth)).toBe(true);
  });

  it("the three enum fields always have a valid default so they never block progress", () => {
    const identity = defaultCampaignIdentity();
    expect(identity.namingConvention).toBe("historical");
    expect(identity.shipNameReuse).toBe("disabled");
    expect(identity.measurementSystem).toBe("imperial");
  });

  it("rejects admiral/campaign name edits beyond the 60-char cap", () => {
    const identity = defaultCampaignIdentity();
    const tooLong = "x".repeat(61);
    const updated = updateCampaignIdentity(identity, "admiralName", tooLong);
    expect(updated).toEqual(identity);

    const atCap = "x".repeat(60);
    const accepted = updateCampaignIdentity(identity, "admiralName", atCap);
    expect(accepted.admiralName).toBe(atCap);
  });
});
