import type { AreaControl } from "../fixture-world.js";
import type { ProjectedArea } from "../projection.js";

export interface AreasLayerProps {
  readonly turn: number;
  readonly areas: readonly ProjectedArea[];
  readonly control: ReadonlyMap<string, AreaControl>;
  readonly selected: string | null;
  readonly routeSet: ReadonlySet<string>;
  readonly ownershipOn: boolean;
  readonly areaWash: string;
  readonly areaWashSelected: string;
  readonly areaEdge: string;
  readonly selectedEdge: string;
  readonly route: string;
  readonly nameOf: (id: string) => string;
  readonly describe: (id: string) => string;
  readonly fillFor: (nation: string | null, alpha: number) => string;
  readonly onAreaClick: (id: string, shiftKey: boolean) => void;
}

/**
 * Area polygons with the ownership wash, and the chart's keyboard surface: the
 * map draws every layer three times to wrap seamlessly, but only the home copy
 * (`turn === 0`) is exposed to keyboard and screen readers.
 */
export function AreasLayer({
  turn,
  areas,
  control,
  selected,
  routeSet,
  ownershipOn,
  areaWash,
  areaWashSelected,
  areaEdge,
  selectedEdge,
  route,
  nameOf,
  describe,
  fillFor,
  onAreaClick,
}: AreasLayerProps) {
  const interactive = turn === 0;
  return (
    <>
      {areas.map((area) => {
        const held = control.get(area.id);
        const isSelected = selected === area.id;
        const onRouteLeg = routeSet.has(area.id);
        return (
          <path
            key={area.id}
            d={area.path}
            fill={
              ownershipOn
                ? fillFor(held?.owner ?? null, isSelected ? 0.42 : 0.2)
                : isSelected
                  ? areaWashSelected
                  : areaWash
            }
            stroke={isSelected ? selectedEdge : onRouteLeg ? route : areaEdge}
            strokeWidth={isSelected ? 2.5 : onRouteLeg ? 2 : 0.9}
            vectorEffect="non-scaling-stroke"
            strokeDasharray={held?.contested === true ? "6 4" : undefined}
            className="cursor-pointer outline-none transition-[fill] duration-150 focus-visible:[stroke:var(--map-focus)] focus-visible:stroke-[3]"
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-hidden={interactive ? undefined : true}
            aria-pressed={interactive ? isSelected : undefined}
            aria-label={interactive ? describe(area.id) : undefined}
            onClick={(event) => onAreaClick(area.id, event.shiftKey)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onAreaClick(area.id, event.shiftKey);
            }}
          >
            {/* Hover name, so an area whose label was thinned out stays identifiable. */}
            {interactive && <title>{nameOf(area.id)}</title>}
          </path>
        );
      })}
    </>
  );
}
