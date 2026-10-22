import * as d3Drag from "d3-drag";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";
import { type JSX, useEffect, useRef } from "react";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";

import { dominantFlagColors, globePoints } from "./globePins.js";
import type { GlobePoint } from "./globeTypes.js";
import { GlobeShell } from "./GlobeShell.js";
import {
  isVisible,
  MAX_PHI_DEG,
  MIN_PHI_DEG,
  normalizeDeg,
  PIN_BASE_RADIUS_PX,
  PIN_HIT_RADIUS_PX,
  RING_BASE_HALF_PX,
  type RotationAnim,
  type SvgGlobeResizeContext,
  useSvgGlobe,
} from "./useSvgGlobe.js";

const CLICK_DISTANCE_PX = 5;
const MAX_ZOOM_MULTIPLIER = 4;
const ROTATE_SENSITIVITY = 0.25;

export interface InteractiveGlobeProps {
  readonly focusedCountryId?: PlayableSlotCountryId | null;
  readonly onNationClick?: (countryId: string) => void;
}

export function InteractiveGlobe({
  focusedCountryId,
  onNationClick,
}: InteractiveGlobeProps): JSX.Element {
  const globe = useSvgGlobe();
  const focusedRef = useRef(focusedCountryId);
  const onNationClickRef = useRef(onNationClick);

  useEffect(() => {
    focusedRef.current = focusedCountryId;
  }, [focusedCountryId]);
  useEffect(() => {
    onNationClickRef.current = onNationClick;
  }, [onNationClick]);

  useEffect(() => {
    const svgEl = globe.svgRef.current;
    const projection = globe.projection();
    if (!svgEl || !projection) return;

    const svg = d3Selection.select(svgEl);
    const pinSel = d3Selection.select(globe.pinRef.current);
    const ringSel = d3Selection.select(globe.ringRef.current);
    const points = globePoints();
    const colors = dominantFlagColors();
    const focused = (): GlobePoint | undefined =>
      focusedRef.current ? points.find((p) => p.countryId === focusedRef.current) : undefined;

    const baseScale = projection.scale();
    const extentWidth = globe.containerRef.current?.clientWidth ?? 800;
    const extentHeight = globe.containerRef.current?.clientHeight ?? 600;

    const unregisterRenderer = globe.registerFrameRenderer(() => {
      const pixelRadius = PIN_BASE_RADIUS_PX;
      pinSel
        .selectAll<SVGGElement, GlobePoint>("g")
        .data(points, (d) => d.countryId)
        .join(
          (enter) => {
            const g = enter.append("g").attr("class", "svg-globe-pin");
            g.append("circle")
              .attr("class", "pin-hit-target")
              .attr("fill", "transparent")
              .attr("stroke", "none");
            g.append("line")
              .attr("class", "pin-h")
              .attr("stroke", "var(--globe-accent)")
              .attr("stroke-width", 1.25);
            g.append("line")
              .attr("class", "pin-v")
              .attr("stroke", "var(--globe-accent)")
              .attr("stroke-width", 1.25);
            g.append("circle").attr("class", "pin-dot").attr("stroke", "none");
            return g;
          },
          (update) => update,
          (exit) => exit.remove(),
        )
        .attr("data-country-id", (d) => d.countryId)
        .style("display", (d) => (isVisible(projection, d.lat, d.lng) ? null : "none"))
        .style("cursor", "pointer")
        .each(function (d) {
          const [x, y] = projection([d.lng, d.lat]) ?? [0, 0];
          const g = d3Selection.select(this);
          g.select(".pin-hit-target").attr("cx", x).attr("cy", y).attr("r", PIN_HIT_RADIUS_PX);
          g.select(".pin-h")
            .attr("x1", x - pixelRadius * 2)
            .attr("y1", y)
            .attr("x2", x + pixelRadius * 2)
            .attr("y2", y);
          g.select(".pin-v")
            .attr("x1", x)
            .attr("y1", y - pixelRadius * 2)
            .attr("x2", x)
            .attr("y2", y + pixelRadius * 2);
          g.select(".pin-dot")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", pixelRadius * 0.85)
            .attr("fill", colors[d.countryId] ?? "var(--globe-accent)");
        });

      const ringPoint = focused();
      const ringHalf = RING_BASE_HALF_PX;
      ringSel
        .selectAll<SVGRectElement, GlobePoint>("rect")
        .data(ringPoint && isVisible(projection, ringPoint.lat, ringPoint.lng) ? [ringPoint] : [])
        .join(
          (enter) =>
            enter
              .append("rect")
              .attr("class", "svg-globe-ring")
              .attr("fill", "none")
              .attr("stroke", "var(--globe-ring)")
              .attr("stroke-width", 1.5),
          (update) => update,
          (exit) => exit.remove(),
        )
        .each(function (d) {
          const [x, y] = projection([d.lng, d.lat]) ?? [0, 0];
          d3Selection
            .select(this)
            .attr("x", x - ringHalf)
            .attr("y", y - ringHalf)
            .attr("width", ringHalf * 2)
            .attr("height", ringHalf * 2)
            .style("transform-origin", `${x}px ${y}px`);
        });
    });

    const drag = d3Drag
      .drag<SVGSVGElement, unknown>()
      .clickDistance(CLICK_DISTANCE_PX)
      .filter(
        (event: Event) => event.type !== "touchstart" || (event as TouchEvent).touches.length === 1,
      )
      .on("start", () => {
        globe.setDragging(true);
        globe.rotationAnimRef.current = null;
      })
      .on("drag", (event: d3Drag.D3DragEvent<SVGSVGElement, unknown, unknown>) => {
        const [lambda, phi] = projection.rotate();
        const nextPhi = Math.max(
          MIN_PHI_DEG,
          Math.min(MAX_PHI_DEG, phi - event.dy * ROTATE_SENSITIVITY),
        );
        projection.rotate([lambda + event.dx * ROTATE_SENSITIVITY, nextPhi]);
      })
      .on("end", () => {
        globe.setDragging(false);
      });

    const zoom = d3Zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([baseScale, baseScale * MAX_ZOOM_MULTIPLIER])
      .extent([
        [0, 0],
        [extentWidth, extentHeight],
      ])
      .filter((event: Event) => {
        if (event.type === "wheel") return true;
        if (event.type === "touchstart") return (event as TouchEvent).touches.length > 1;
        return false;
      })
      .on("zoom", (event: d3Zoom.D3ZoomEvent<SVGSVGElement, unknown>) => {
        projection.scale(event.transform.k);
      });

    const zoomTransform = zoom.transform.bind(zoom);
    svg.call(zoom).call(zoomTransform, d3Zoom.zoomIdentity.scale(baseScale));
    svg.call(drag);

    svg.on("click", (event: MouseEvent) => {
      const target = (event.target as Element).closest(".svg-globe-pin") as SVGGElement | null;
      if (target?.dataset.countryId) {
        onNationClickRef.current?.(target.dataset.countryId);
      }
    });

    const unregisterResize = globe.registerResizeHandler(
      ({ width, height, baseScale: newBase, projection: proj }: SvgGlobeResizeContext) => {
        zoom.scaleExtent([newBase, newBase * MAX_ZOOM_MULTIPLIER]).extent([
          [0, 0],
          [width, height],
        ]);
        const clampedScale = Math.max(
          newBase,
          Math.min(proj.scale(), newBase * MAX_ZOOM_MULTIPLIER),
        );
        svg.call(zoomTransform, d3Zoom.zoomIdentity.scale(clampedScale));
      },
    );

    return () => {
      svg.on(".drag", null).on(".zoom", null).on("click", null);
      unregisterRenderer();
      unregisterResize();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusedCountryId) return;
    const projection = globe.projection();
    if (!projection) return;
    const target = globePoints().find((p) => p.countryId === focusedCountryId);
    if (!target) return;

    const [fromLambda, fromPhi] = projection.rotate();
    const toLambdaRaw = -target.lng;
    const toPhi = Math.max(MIN_PHI_DEG, Math.min(MAX_PHI_DEG, -target.lat));
    const toLambda = fromLambda + normalizeDeg(toLambdaRaw - fromLambda);

    const anim: RotationAnim = {
      fromLambda,
      fromPhi,
      toLambda,
      toPhi,
      start: performance.now(),
    };
    globe.rotationAnimRef.current = anim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedCountryId]);

  return <GlobeShell refs={globe} />;
}
