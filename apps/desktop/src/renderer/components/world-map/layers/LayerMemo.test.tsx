import { cleanup, fireEvent, render, type RenderResult } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AreasLayerProps } from "./AreasLayer.js";
import type { FleetsLayerProps } from "./FleetsLayer.js";
import type { PortsLayerProps } from "./PortsLayer.js";
import type { StrengthLayerProps } from "./StrengthLayer.js";
import { AreasLayer } from "./AreasLayer.js";
import { FleetsLayer } from "./FleetsLayer.js";
import { PortsLayer } from "./PortsLayer.js";
import { StrengthLayer } from "./StrengthLayer.js";
import { DARK_MAP_PALETTE } from "../map-palette.js";
import type { AreaControl } from "../map-state.js";
import type { ProjectedArea } from "../projection.js";
import type { FleetMark, PortMark } from "../map-markers.js";
import type { RegionStrength } from "../map-strength.js";

const area: ProjectedArea = {
  id: "area_north_sea",
  path: "M0 0L80 0L80 60L0 60Z",
  ring: [
    [0, 0],
    [80, 0],
    [80, 60],
    [0, 60],
  ],
  label: [40, 30],
  centroid: [40, 30],
  bounds: { width: 80, height: 60 },
};

const portMark: PortMark = {
  id: "port-1",
  name: "Portland",
  ux: 10,
  uy: 20,
  owner: "uk",
  major: true,
  count: 1,
};

const fleetMark: FleetMark = { id: "fleet-1", ux: 12, uy: 22, ships: 4, owner: "uk", count: 1 };

const regionStrength: RegionStrength = {
  areaId: area.id,
  total: 4,
  fraction: 0.5,
  nations: [{ nation: "uk", name: "United Kingdom", flagUrl: null, ships: 4 }],
  flags: [{ nation: "uk", name: "United Kingdom", flagUrl: null, ships: 4 }],
  overflow: 0,
  overflowShips: 0,
};

function Churn({ children }: { readonly children: ReactNode }) {
  const [tick, setTick] = useState(0);
  return (
    <div>
      <button type="button" data-testid="churn" onClick={() => setTick((value) => value + 1)}>
        {`tick ${tick}`}
      </button>
      <svg>
        <g>{children}</g>
      </svg>
    </div>
  );
}

function churned(view: RenderResult): void {
  fireEvent.click(view.getByTestId("churn"));
}

describe("memoised map layers", () => {
  afterEach(cleanup);

  it("keeps AreasLayer out of a parent re-render when its props are unchanged", () => {
    const fillFor = vi.fn(() => "oklch(0.5 0 0)");
    const props: AreasLayerProps = {
      turn: 0,
      areas: [area],
      control: new Map<string, AreaControl>([
        [area.id, { owner: "uk", contested: false, possessions: 1 }],
      ]),
      selected: null,
      routeSet: new Set<string>(),
      ownershipOn: true,
      areaWash: "wash",
      areaWashSelected: "wash-selected",
      areaEdge: "edge",
      selectedEdge: "selected",
      route: "route",
      unavailable: new Set<string>(),
      unavailableWash: "unavailable",
      nameOf: () => "North Sea",
      describe: () => "North Sea, held by United Kingdom",
      fillFor,
      onAreaClick: () => undefined,
      legal: new Set<string>(),
      dimmed: new Set<string>(),
      blockaded: new Set<string>(),
    };
    const view = render(
      <Churn>
        <AreasLayer {...props} />
      </Churn>,
    );
    expect(fillFor).toHaveBeenCalled();
    fillFor.mockClear();

    churned(view);

    expect(fillFor).not.toHaveBeenCalled();
  });

  it("keeps PortsLayer out of a parent re-render when its props are unchanged", () => {
    const strokeFor = vi.fn(() => "oklch(0.5 0 0)");
    const props: PortsLayerProps = { marks: [portMark], strokeFor };
    const view = render(
      <Churn>
        <PortsLayer {...props} />
      </Churn>,
    );
    expect(strokeFor).toHaveBeenCalled();
    strokeFor.mockClear();

    churned(view);

    expect(strokeFor).not.toHaveBeenCalled();
  });

  it("keeps FleetsLayer out of a parent re-render when its props are unchanged", () => {
    const strokeFor = vi.fn(() => "oklch(0.5 0 0)");
    const props: FleetsLayerProps = {
      marks: [fleetMark],
      strokeFor,
      live: true,
      playerNationId: "uk",
      draggable: new Set([fleetMark.id]),
      selectedFleetId: fleetMark.id,
    };
    const view = render(
      <Churn>
        <FleetsLayer {...props} />
      </Churn>,
    );
    expect(strokeFor).toHaveBeenCalled();
    strokeFor.mockClear();

    churned(view);

    expect(strokeFor).not.toHaveBeenCalled();
  });

  it("keeps StrengthLayer out of a parent re-render when its props are unchanged", () => {
    const strokeFor = vi.fn(() => "oklch(0.5 0 0)");
    const anchorOf = vi.fn(() => area.label);
    const props: StrengthLayerProps = {
      regions: [regionStrength],
      anchorOf,
      strokeFor,
      palette: DARK_MAP_PALETTE,
      compact: false,
      offsets: new Map<string, number>(),
    };
    const view = render(
      <Churn>
        <StrengthLayer {...props} />
      </Churn>,
    );
    expect(strokeFor).toHaveBeenCalled();
    strokeFor.mockClear();
    anchorOf.mockClear();

    churned(view);

    expect(strokeFor).not.toHaveBeenCalled();
    expect(anchorOf).not.toHaveBeenCalled();
  });
});
