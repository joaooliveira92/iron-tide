import type { CSSProperties } from "react";
import "./anatomy.css";
import type { AnatomyShip } from "./ship-anatomy.js";

const d = (value: string) => (value.length > 0 ? value : undefined);

export function AnatomyShipFigure({
  ship,
  highlight,
  className,
  style,
}: {
  readonly ship: AnatomyShip;
  readonly highlight?: string | undefined;
  readonly className?: string;
  readonly style?: CSSProperties;
}) {
  const anchor = highlight === undefined ? undefined : ship.anchors.get(highlight);
  return (
    <svg
      viewBox={`0 0 ${ship.width} ${ship.height}`}
      className={className === undefined ? "an-ship" : `an-ship ${className}`}
      role="img"
      aria-label={ship.label}
      style={style}
      data-testid="anatomy-ship"
      data-azimuth={ship.azimuth}
    >
      {ship.parts.map((part) => {
        const lit = part.id === highlight;
        return (
          <g key={part.id} className="an-part" data-part={part.id} data-lit={lit ? "" : undefined}>
            {part.halo !== undefined && <path className="an-halo" d={part.halo} />}
            {part.solids.map((shape, index) => (
              <g key={index} className="an-solid" data-tone={shape.tone} data-fill={shape.fill}>
                <path className="an-fill" d={d(shape.paths.fill)} />
                {shape.flat
                  ? null
                  : shape.paths.shades.map((shade, shadeIndex) =>
                      shade.length > 0 ? (
                        <path
                          key={shadeIndex}
                          className="an-shade"
                          data-shade={shadeIndex}
                          d={shade}
                        />
                      ) : null,
                    )}
                {shape.flat ? null : <path className="an-top" d={d(shape.paths.top)} />}
                {shape.crease === "none" ? null : (
                  <path className="an-crease" data-tone={shape.crease} d={d(shape.paths.crease)} />
                )}
                <path className="an-edge" d={d(shape.paths.outline)} />
              </g>
            ))}
            {part.inks.map((ink, index) => (
              <path
                key={`ink-${index}`}
                className="an-ink-fill"
                data-tone={ink.tone ?? "ink"}
                d={ink.d}
              />
            ))}
            {part.lines.map((line, index) => (
              <path
                key={`line-${index}`}
                className="an-line"
                data-tone={line.tone}
                data-dotted={line.dotted ? "" : undefined}
                data-heavy={line.heavy ? "" : undefined}
                d={line.d}
              />
            ))}
            {part.dots.map((dot, index) => (
              <circle
                key={`dot-${index}`}
                className="an-dot"
                data-tone={dot.tone}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
              />
            ))}
          </g>
        );
      })}
      {anchor !== undefined && (
        <g className="an-highlight" aria-hidden="true" data-testid="anatomy-highlight">
          <circle
            className="an-ring-halo"
            cx={anchor.at[0]}
            cy={anchor.at[1]}
            r={anchor.radius + 2}
          />
          <circle className="an-ring" cx={anchor.at[0]} cy={anchor.at[1]} r={anchor.radius} />
        </g>
      )}
    </svg>
  );
}
