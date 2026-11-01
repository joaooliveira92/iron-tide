import { memo } from "react";

import { CHART } from "../chart-theme.js";
import type { MapPalette } from "../map-palette.js";
import type { MapPendingOrder } from "../map-orders.js";
import type { Point } from "../projection.js";

export interface OrdersLayerProps {
  readonly pending: readonly (MapPendingOrder & {
    readonly from: Point;
    readonly to: Point;
    readonly via?: readonly Point[];
  })[];
  readonly palette: MapPalette;
  readonly worldWidth: number;
}

export const OrdersLayer = memo(function OrdersLayer({
  pending,
  palette,
  worldWidth,
}: OrdersLayerProps) {
  return (
    <g data-layer="orders" aria-hidden="true" pointerEvents="none">
      {pending.map((order) => {
        const followsLane = order.via !== undefined;
        const toX = followsLane
          ? order.to[0]
          : order.to[0] - order.from[0] > worldWidth / 2
            ? order.to[0] - worldWidth
            : order.from[0] - order.to[0] > worldWidth / 2
              ? order.to[0] + worldWidth
              : order.to[0];
        const points: Point[] = [order.from, ...(order.via ?? []), [toX, order.to[1]]];
        const polyline = points.map(([x, y]) => `${x},${y}`).join(" ");
        const middle = points[Math.floor((points.length - 1) / 2)] as Point;
        const next = points[Math.floor(points.length / 2)] as Point;
        const midX = (middle[0] + next[0]) / 2;
        const midY = (middle[1] + next[1]) / 2;
        return (
          <g key={order.commandId} data-order={order.fleetId}>
            <polyline
              points={polyline}
              fill="none"
              strokeLinejoin="round"
              stroke={palette.routeCasing}
              strokeWidth={4}
              strokeDasharray="8 5"
            />
            <polyline
              points={polyline}
              fill="none"
              strokeLinejoin="round"
              stroke={palette.orderPending}
              strokeWidth={2}
              strokeDasharray="8 5"
            />
            <circle cx={toX} cy={order.to[1]} r={4} fill={palette.orderPending} />
            <text
              x={midX}
              y={midY - 6}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={CHART.ink}
              stroke={palette.labelHalo}
              strokeWidth={3}
              paintOrder="stroke"
            >
              {`Ordered: ${order.destinationName}`}
            </text>
          </g>
        );
      })}
    </g>
  );
});
