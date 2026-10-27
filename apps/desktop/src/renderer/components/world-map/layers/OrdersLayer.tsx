import { CHART } from "../chart-theme.js";
import type { MapPalette } from "../map-palette.js";
import type { MapPendingOrder } from "../map-orders.js";
import type { Point } from "../projection.js";

export interface OrdersLayerProps {
  readonly pending: readonly (MapPendingOrder & {
    readonly from: Point;
    readonly to: Point;
  })[];
  readonly palette: MapPalette;
  readonly worldWidth: number;
}

export function OrdersLayer({ pending, palette, worldWidth }: OrdersLayerProps) {
  return (
    <g data-layer="orders" aria-hidden="true" pointerEvents="none">
      {pending.map((order) => {
        const toX =
          order.to[0] - order.from[0] > worldWidth / 2
            ? order.to[0] - worldWidth
            : order.from[0] - order.to[0] > worldWidth / 2
              ? order.to[0] + worldWidth
              : order.to[0];
        const midX = (order.from[0] + toX) / 2;
        const midY = (order.from[1] + order.to[1]) / 2;
        return (
          <g key={order.commandId} data-order={order.fleetId}>
            <line
              x1={order.from[0]}
              y1={order.from[1]}
              x2={toX}
              y2={order.to[1]}
              stroke={palette.routeCasing}
              strokeWidth={4}
              strokeDasharray="8 5"
            />
            <line
              x1={order.from[0]}
              y1={order.from[1]}
              x2={toX}
              y2={order.to[1]}
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
}
