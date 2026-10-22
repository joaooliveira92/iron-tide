import type { DesignDraft } from "@bluewave/ship-design";
import { machineryRooms } from "../../selection/facts.js";
import { sameEntity, type ShipEntity } from "../../selection/store.js";
import { useShipSelection } from "../../selection/useShipSelection.js";
import { WarningGlyph } from "./WarningGlyph.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";
import { MachineryRoomMarker, SectionHighlightLayer } from "./selection-layers.js";
import { SECTIONS, type ZoneRange } from "./sections.js";

export function SelectionLayer({
  frame,
  zones,
  draft,
  warns,
}: {
  readonly frame: PlanFrame;
  readonly zones: readonly ZoneRange[];
  readonly draft: DesignDraft;
  readonly warns: (entity: ShipEntity) => boolean;
}) {
  const selected = useShipSelection((s) => s.selected);
  const linked = useShipSelection((s) => s.linked);
  const preview = useShipSelection((s) => s.preview);
  const rooms = machineryRooms(draft);
  const zoneOf = (id: keyof typeof SECTIONS) => zones.find((z) => z.id === SECTIONS[id].zoneId);
  const selectedZone = selected?.kind === "section" ? zoneOf(selected.id) : undefined;
  return (
    <g data-testid="selection-layer">
      {linked.map((e) => {
        if (sameEntity(e, selected)) return null;
        if (e.kind === "section")
          return (
            <SectionHighlightLayer
              key={`s-${e.id}`}
              frame={frame}
              zone={zoneOf(e.id)}
              variant="linked"
            />
          );
        if (e.kind === "machinery-room" && rooms[e.index])
          return (
            <MachineryRoomMarker
              key={`r-${e.index}`}
              frame={frame}
              stationPermille={rooms[e.index]!.stationPermille}
              variant="linked"
            />
          );
        return null;
      })}
      {preview !== null && !(selected?.kind === "section" && selected.id === preview) && (
        <SectionHighlightLayer frame={frame} zone={zoneOf(preview)} variant="preview" />
      )}
      {selectedZone && selected && (
        <>
          <SectionHighlightLayer frame={frame} zone={selectedZone} variant="selected" />
          {warns(selected) && (
            <WarningGlyph
              x={frame.x(selectedZone.endPermille) - 8}
              y={PLAN_MID - frame.maxHalf - 10}
            />
          )}
        </>
      )}
      {selected?.kind === "machinery-room" && rooms[selected.index] && (
        <MachineryRoomMarker
          frame={frame}
          stationPermille={rooms[selected.index]!.stationPermille}
          variant="selected"
        />
      )}
    </g>
  );
}
