import type { MapVariant } from "../world-map/map-variant-layout.js";
import { AreaInspector } from "../world-map/AreaInspector.js";
import type { AreaOwnershipRow } from "../world-map/map-a11y.js";
import type { AreaSummary } from "../world-map/map-state.js";
import type { EntityRow, EntitySelection } from "./entity-rows.js";

export interface GlobeAdapterChromeProps {
  readonly variant: MapVariant;
  readonly ownershipRows: readonly AreaOwnershipRow[];
  readonly summary: AreaSummary | null;
  readonly nameFor: (nation: string | null) => string;
  readonly onSelect: (area: string | null) => void;
  readonly entityRows?: readonly EntityRow[];
  readonly onSelectEntity?: (entity: EntitySelection) => void;
}

export function GlobeAdapterChrome({
  variant,
  ownershipRows,
  summary,
  nameFor,
  onSelect,
  entityRows = [],
  onSelectEntity,
}: GlobeAdapterChromeProps) {
  const docked = variant === "command";
  const entityList = (
    <nav
      aria-label="Ports and fleets"
      data-testid="globe-adapter-entities"
      className="rounded border border-white/25 bg-black/80 p-2 text-xs text-white"
    >
      <ul className="grid max-h-40 gap-0.5 overflow-y-auto">
        {entityRows.map((entity) => (
          <li
            key={entity.id}
            className="[content-visibility:auto] [contain-intrinsic-size:auto_1.5rem]"
          >
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => onSelectEntity?.(entity)}
            >
              {entity.name} <span className="opacity-70">({entity.kind})</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      {!docked && (
        <div className="pointer-events-auto absolute right-[calc(0.75rem+var(--chrome-right,0px))] top-[calc(0.75rem+var(--chrome-top,0px))] z-10 flex max-h-[70%] w-72 flex-col gap-2 overflow-y-auto">
          <AreaInspector
            className="rounded-lg border p-3 text-xs shadow-lg backdrop-blur"
            summary={summary}
            nameFor={nameFor}
            onSelect={onSelect}
          />

          <nav
            aria-label="Map areas"
            data-testid="globe-adapter-area-list"
            className="rounded border border-white/25 bg-black/80 p-2 text-xs text-white"
          >
            <ul className="grid max-h-56 gap-0.5 overflow-y-auto">
              {ownershipRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={row.selected}
                    aria-label={`${row.name}: ${row.owner ?? "Unclaimed"}, ${row.fleets} fleets${row.strength === null ? "" : `, ${row.strength}`}`}
                    title={row.name}
                    data-adapter-area={row.id}
                    onClick={() => onSelect(row.id)}
                    className="w-full rounded px-2 py-1 text-left hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:bg-white aria-pressed:text-black"
                  >
                    {row.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {entityList}
        </div>
      )}

      <div className="sr-only">
        <table data-testid="globe-adapter-area-table">
          <caption>Area control</caption>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Controlled by</th>
              <th scope="col">Fleets</th>
              <th scope="col">Strength</th>
            </tr>
          </thead>
          <tbody>
            {ownershipRows.map((row) => (
              <tr key={row.id} aria-selected={row.selected}>
                <th scope="row">{row.name}</th>
                <td>{row.owner ?? "Unclaimed"}</td>
                <td>{row.fleets}</td>
                <td>{row.strength ?? "No ships"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
