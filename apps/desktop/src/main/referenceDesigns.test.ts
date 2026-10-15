import { describe, expect, it } from "vite-plus/test";

import { readReferenceDesigns } from "./referenceDesigns.js";

/**
 * The live main-process read path (ADR-0122) takes the parts-loadout branch when the pack
 * carries a part model. Ticket 39 puts `historical`/`provenance` on the authored catalogue
 * entry; this pins that they survive the loadout rebuild and are reachable on the read path
 * (the renderer DTO carries them too, but the main-process type must not be a dead field).
 */
describe("reference designs expose provenance on the live read path (ticket 39)", () => {
  const designs = readReferenceDesigns();

  it("carries full provenance for a historical design", () => {
    const devastator = designs.find((d) => d.id === "devastator_1873");
    expect(devastator?.historical).toBe(true);
    expect(devastator?.provenance?.displacementBasis.value).toContain("9,387");
    expect(devastator?.provenance?.displacementBasis.status).toBe("VERIFIED");
    expect(devastator?.provenance?.speed.value).toContain("13.8");
  });

  it("leaves an illustrative template non-historical and without provenance", () => {
    const template = designs.find((d) => d.id === "torpedo_cruiser_1880");
    expect(template?.historical).toBe(false);
    expect(template?.provenance).toBeUndefined();
  });
});
