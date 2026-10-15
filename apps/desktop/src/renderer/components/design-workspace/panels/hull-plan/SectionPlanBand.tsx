import type { DesignDraft } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { DASH, NON_SCALING, OPACITY, STROKE } from "./drafting.js";
import type { PlanFrame } from "./geometry.js";
import { HullShapeLayer } from "./plan-layers.js";
import { HullTopsideLayer } from "./HullTopsideLayer.js";
import { PAD_X, SECTION_W, type SectionLayout } from "./section-drawing.js";
import type { ZoneRange } from "./sections.js";

/**
 * The section card's plan band: the main drawing's hull, deck houses and funnels under the card transform, so it
 * can never disagree with the plan, with a centreline over it.
 */
export function SectionPlanBand({
  layout,
  frame,
  draft,
  content,
  zones,
  clip,
}: {
  readonly layout: SectionLayout;
  readonly frame: PlanFrame;
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly zones: readonly ZoneRange[];
  readonly clip: string;
}) {
  return (
    <g clipPath={`url(#${clip}-plan)`}>
      <g transform={`matrix(${layout.a} 0 0 ${layout.ky} ${layout.b} ${layout.planTy})`}>
        <HullShapeLayer frame={frame} />
        <HullTopsideLayer frame={frame} draft={draft} content={content} zones={zones} />
      </g>
      <line
        x1={PAD_X}
        x2={SECTION_W - PAD_X}
        y1={layout.planCy}
        y2={layout.planCy}
        className="stroke-muted-foreground"
        strokeWidth={STROKE.guide}
        strokeOpacity={OPACITY.guide}
        strokeDasharray={DASH.centreline}
        {...NON_SCALING}
      />
    </g>
  );
}
