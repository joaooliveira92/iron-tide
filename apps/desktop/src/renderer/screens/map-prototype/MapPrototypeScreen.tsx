/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Host for ticket 06's three map variants.
 *
 * "Three variants of the strategic map screen, switchable via `?variant=`,
 * mounted as a dev-only campaign screen because no map screen exists yet."
 *
 * The host owns the *data* — selection, ruler, layers, projection — and hands
 * it to whichever variant is showing. It owns no layout: each variant draws
 * the whole page, including its own chrome, because layout is the thing being
 * compared. Switching variant preserves state, which is the point: the same
 * selected area and the same laid ruler render three different ways.
 */

import { useCallback, useState } from "react";
import { PageHeader } from "../../components/shared/PageHeader.js";
import {
  AREA_COUNT,
  EDGE_COUNT,
  initialMapPrototypeState,
  pushRuler,
  readRoute,
  selectArea,
  toggleLayer,
  type LayerId,
} from "../../components/world-map/map-state.js";
import { PrototypeSwitcher, readVariantFromLocation } from "./PrototypeSwitcher.js";
import type { ProjectionId } from "../../components/world-map/projection.js";
import type { AreaId } from "../../components/world-map/fixture-world.js";
import type { VariantDefinition } from "../../components/world-map/map-contract.js";
import { VariantAChart } from "./variants/VariantAChart.js";
import { VariantBBoard } from "./variants/VariantBBoard.js";
import { VariantCGraph } from "./variants/VariantCGraph.js";

const VARIANTS: readonly VariantDefinition[] = [
  {
    key: "A",
    name: "Admiralty chart",
    premise:
      "Real coastlines carry the geography; areas are translucent washes over them. Own palette, floating chrome.",
    Component: VariantAChart,
  },
  {
    key: "B",
    name: "Stylised board",
    premise:
      "No coastlines and no projection. Tiles on a grid, edges drawn as connectors, passages as gates. App theme throughout.",
    Component: VariantBBoard,
  },
  {
    key: "C",
    name: "Operational graph",
    premise:
      "Areas are nodes at computed centroids, geography is a wash, edges are the loudest object. Permanent left rail.",
    Component: VariantCGraph,
  },
];

export function MapPrototypeScreen() {
  const [state, setState] = useState(initialMapPrototypeState);
  const [variantKey, setVariantKey] = useState(() => readVariantFromLocation("A"));

  const onSelect = useCallback(
    (area: AreaId | null) => setState((current) => selectArea(current, area)),
    [],
  );
  const onRuler = useCallback(
    (area: AreaId) => setState((current) => pushRuler(current, area)),
    [],
  );
  const onToggleLayer = useCallback(
    (layer: LayerId) => setState((current) => toggleLayer(current, layer)),
    [],
  );
  const onSetProjection = useCallback(
    (projection: ProjectionId) => setState((current) => ({ ...current, projection })),
    [],
  );
  const onSetCentre = useCallback(
    (centre: number) => setState((current) => ({ ...current, centre })),
    [],
  );
  const onToggleClosedPassages = useCallback(
    () =>
      setState((current) => ({
        ...current,
        respectClosedPassages: !current.respectClosedPassages,
      })),
    [],
  );

  const active =
    VARIANTS.find((variant) => variant.key === variantKey) ?? (VARIANTS[0] as VariantDefinition);
  const route = readRoute(state);
  const Variant = active.Component;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Map prototype (throwaway)"
        description={`Ticket 06 — rendering technology and geometry source. ${AREA_COUNT} areas, ${EDGE_COUNT} edges, fixture geography. Variant ${active.key}: ${active.premise}`}
      />

      <Variant
        state={state}
        route={route}
        onSelect={onSelect}
        onRuler={onRuler}
        onToggleLayer={onToggleLayer}
        onSetProjection={onSetProjection}
        onSetCentre={onSetCentre}
        onToggleClosedPassages={onToggleClosedPassages}
      />

      <PrototypeSwitcher variants={VARIANTS} current={active.key} onChange={setVariantKey} />
    </div>
  );
}
