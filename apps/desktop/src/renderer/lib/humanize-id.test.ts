import { describe, expect, it } from "vite-plus/test";
import { humanizeId } from "./humanize-id.js";

describe("humanizeId", () => {
  it("turns SCREAMING_SNAKE and snake_case ids into sentence case", () => {
    expect(humanizeId("HULL_CONSTRUCTION")).toBe("Hull construction");
    expect(humanizeId("war_imminent")).toBe("War imminent");
    expect(humanizeId("mac_triple_expansion")).toBe("Mac triple expansion");
  });

  it("leaves plain words alone and tolerates empty or odd input", () => {
    expect(humanizeId("neutral")).toBe("Neutral");
    expect(humanizeId("")).toBe("");
    expect(humanizeId("__")).toBe("__");
  });
});
