import type { PlacedLabel } from "../map-label-layout.js";
import { pinned, screenText } from "../map-svg.js";

export interface LabelsLayerProps {
  readonly labels: readonly PlacedLabel[];
  readonly labelInk: string;
  readonly labelHalo: string;
}

/** Place names, zoom-aware; positions come from `layoutLabels`. */
export function LabelsLayer({ labels, labelInk, labelHalo }: LabelsLayerProps) {
  return (
    <>
      {labels.map(({ id, spec, dx, dy }) => (
        <text
          key={id}
          x={0}
          y={0}
          aria-hidden="true"
          textAnchor={spec.anchor}
          letterSpacing={spec.kind === "sea" || spec.kind === "continent" ? 1.2 : 0.2}
          fill={labelInk}
          stroke={labelHalo}
          paintOrder="stroke"
          opacity={spec.opacity * (spec.kind === "continent" ? 0.8 : 1)}
          style={{
            transform: `${pinned(spec.ux, spec.uy).transform} translate(${dx}px, ${dy}px)`,
            ...screenText(spec.px, 3),
            fontWeight: spec.kind === "continent" ? 500 : 600,
            fontStyle: spec.kind === "port" ? "normal" : undefined,
            pointerEvents: "none",
            textTransform:
              spec.kind === "sea" || spec.kind === "continent" ? "uppercase" : undefined,
          }}
        >
          {spec.text}
        </text>
      ))}
    </>
  );
}
