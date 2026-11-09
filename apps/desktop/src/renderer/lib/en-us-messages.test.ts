import { describe, expect, it } from "vite-plus/test";
import { EN_US_MESSAGES } from "./en-us-messages.js";

const RETIRED_PHRASES = [/presence areas?/i, /\bsea areas?\b/i];

describe("station vocabulary", () => {
  it("keeps retired station and area phrases out of the message catalogue", () => {
    const offenders = Object.entries(EN_US_MESSAGES)
      .filter(([, text]) => RETIRED_PHRASES.some((phrase) => phrase.test(text)))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it("names the Fleet station location column after the station", () => {
    expect(EN_US_MESSAGES["fleet.station.col.area"]).toBe("Location");
    expect(EN_US_MESSAGES["fleet.presence.col.area"]).toBe("Station");
  });
});
