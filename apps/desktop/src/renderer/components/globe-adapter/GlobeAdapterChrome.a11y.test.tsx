import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { GlobeAdapterChrome } from "./GlobeAdapterChrome.js";
import { GlobeAdapterLayers } from "./GlobeAdapterLayers.js";
import { GlobeAdapterLegend } from "./GlobeAdapterLegend.js";
import { GlobeMinimap } from "./GlobeAdapterWidgets.js";
import { deriveAdapterModel } from "./adapter-derivations.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";

const noop = () => undefined;

function overlay() {
  return {
    ...EMPTY_LIVE_OVERLAY,
    source: "campaign" as const,
    ownership: new Map([["area_north_sea", "united_kingdom"]]),
    fleets: [
      {
        id: "fleet-home",
        name: "Home Fleet",
        area: "area_north_sea",
        nation: "united_kingdom",
        ships: 12,
      },
    ],
    lanes: [{ a: "area_north_sea", b: "area_western_approaches" }],
  };
}

describe("GlobeAdapterChrome accessibility", () => {
  afterEach(cleanup);

  it("has no automated accessibility violations in the access-tree mirror", async () => {
    const model = deriveAdapterModel(overlay(), "area_north_sea");
    const viewport = { centre: [0, 30], zoom: 2, bearing: 0, pitch: 0 } as const;
    const { container } = render(
      <>
        <GlobeAdapterLayers
          state={initialMapPrototypeState}
          variant="full"
          treeRows={model.treeRows}
          ownershipRows={model.ownershipRows}
          onSelect={noop}
          onToggleLayer={noop}
          onSetProjection={noop}
          onSetCentre={noop}
          onReset={noop}
        />
        <GlobeAdapterChrome
          variant="full"
          ownershipRows={model.ownershipRows}
          summary={model.summary}
          nameFor={model.nameFor}
          onSelect={noop}
        />
        <GlobeAdapterLegend
          state={initialMapPrototypeState}
          route={{
            path: ["area_north_sea", "area_western_approaches"],
            hops: 1,
            nauticalMiles: 420,
            perHop: 420,
            months: 0.1,
          }}
          viewport={viewport}
          variant="full"
        >
          <GlobeMinimap viewport={viewport} onRecentre={noop} />
        </GlobeAdapterLegend>
      </>,
    );
    const results = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
