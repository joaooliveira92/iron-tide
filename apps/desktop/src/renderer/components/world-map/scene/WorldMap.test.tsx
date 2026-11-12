import { cleanup, render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { initialMapPrototypeState } from "../map-state.js";
import { useMapPalette } from "../map-palette.js";
import { projectionById } from "../projection.js";
import { useMapCamera } from "../useMapCamera.js";
import { useWorldMapModel } from "../useWorldMapModel.js";
import { WorldMap } from "./WorldMap.js";
import { useWorldTurn } from "./WorldCopies.js";
import { useWorldMapScene } from "./WorldMapScene.js";

const NONE: ReadonlySet<string> = new Set();

function Scene({ children }: { readonly children: ReactNode }) {
  const projection = projectionById(initialMapPrototypeState.projection);
  const camera = useMapCamera(projection.width, projection.height, { wrapHorizontally: true });
  const palette = useMapPalette();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const model = useWorldMapModel({
    state: initialMapPrototypeState,
    route: null,
    projection,
    palette,
    camera,
    rootRef,
  });
  return (
    <svg>
      <WorldMap.Root
        model={model}
        palette={palette}
        width={projection.width}
        onAreaClick={() => undefined}
        legalAreas={NONE}
        dimmedAreas={NONE}
        blockadedAreas={NONE}
        pendingOrders={[]}
        draggableFleets={NONE}
        selectedFleetId={null}
      >
        {children}
      </WorldMap.Root>
    </svg>
  );
}

function ProbeLayer() {
  const turn = useWorldTurn();
  const { meta } = useWorldMapScene();
  return <circle data-probe={turn} data-areas={meta.model.areas.length} cx={0} cy={0} r={1} />;
}

describe("WorldMap composition", () => {
  afterEach(cleanup);

  it("renders a layer that only the caller supplies, once per wrapped world copy, with no chart change", () => {
    const { container } = render(
      <Scene>
        <WorldMap.Copies>
          <ProbeLayer />
        </WorldMap.Copies>
      </Scene>,
    );
    const probes = [...container.querySelectorAll("[data-probe]")];
    expect(probes.map((probe) => probe.getAttribute("data-probe"))).toEqual(["-1", "0", "1"]);
    expect(Number(probes[0]?.getAttribute("data-areas"))).toBeGreaterThan(0);
  });

  it("lets built-in layers be left out or reordered by the caller", () => {
    const { container } = render(
      <Scene>
        <WorldMap.Copies>
          <WorldMap.Areas />
          <ProbeLayer />
        </WorldMap.Copies>
      </Scene>,
    );
    expect(container.querySelector("path[data-map-area]")).not.toBeNull();
    expect(container.querySelector('[data-layer="lanes"]')).toBeNull();
    expect(container.querySelector("[data-probe]")).not.toBeNull();
  });

  it("fails with a tagged error when a layer is rendered outside the root", () => {
    expect(() => render(<ProbeLayer />)).toThrow();
  });
});
