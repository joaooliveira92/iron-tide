import type { DesignDraft } from "@bluewave/ship-design";
import { machineryRooms } from "../../selection/facts.js";
import { LABEL_FONT, NON_SCALING, STROKE } from "./drafting.js";
import { PLAN_MID, type PlanFrame } from "./geometry.js";

export function MachineryLayoutLayer({
  frame,
  draft,
}: {
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
}) {
  const rooms = machineryRooms(draft);
  const top = PLAN_MID - frame.maxHalf - 2;
  const bottom = PLAN_MID + frame.maxHalf + 2;
  return (
    <g data-testid="machinery-layout">
      {rooms.map((room, i) => {
        const x = frame.x(room.stationPermille);
        return (
          <g key={`${room.zoneId}-${room.stationPermille}-${i}`} data-machinery-room={i}>
            <line
              x1={x}
              x2={x}
              y1={top}
              y2={bottom}
              className="pointer-events-none stroke-foreground"
              strokeWidth={STROKE.structure}
              strokeDasharray="2 2"
              {...NON_SCALING}
            />
            <text
              x={x + 3}
              y={top + 2}
              className="pointer-events-none fill-foreground font-medium"
              fontSize={LABEL_FONT}
            >
              {`M${i + 1}`}
            </text>
            <title>{`Machinery room ${i + 1} @ ${room.stationPermille}‰`}</title>
          </g>
        );
      })}
    </g>
  );
}
