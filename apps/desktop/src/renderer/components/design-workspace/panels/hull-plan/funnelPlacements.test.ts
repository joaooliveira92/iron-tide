import type { DesignDraft } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { funnelPlacements } from "./funnelPlacements.js";
import { content } from "./test-fixtures.js";
/** A component the catalogue tags as a funnel, and one it does not. */
const funnel = content.catalogue.find((c) => c.tags.includes("funnel"))!;
const other = content.catalogue.find((c) => !c.tags.includes("funnel"))!;

const draft = (placements: DesignDraft["placements"]): DesignDraft =>
  ({ placements }) as unknown as DesignDraft;
const placed = (instanceId: string, componentId: string, stationPermille: number) => ({
  instanceId,
  componentId,
  zoneId: "CENTRAL_MACHINERY",
  stationPermille,
});

describe("funnelPlacements", () => {
  it("keeps only the placements whose component is tagged as a funnel", () => {
    const d = draft([
      placed("f1", funnel.id, 560),
      placed("x", other.id, 300),
      placed("f2", funnel.id, 600),
    ] as DesignDraft["placements"]);
    expect(funnelPlacements(d, content)).toEqual([
      { instanceId: "f1", stationPermille: 560 },
      { instanceId: "f2", stationPermille: 600 },
    ]);
  });

  it("keeps the draft's order and returns nothing when no funnel is placed", () => {
    const d = draft([placed("x", other.id, 300)] as DesignDraft["placements"]);
    expect(funnelPlacements(d, content)).toEqual([]);
    const empty = draft([] as DesignDraft["placements"]);
    expect(funnelPlacements(empty, content)).toEqual([]);
  });
});
