import { useId } from "react";
import type { DesignDraft } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { NON_SCALING, STROKE } from "./drafting.js";
import type { PlanFrame } from "./geometry.js";
import type { ProfileFrame } from "./profile-geometry.js";
import {
  CARD_FONT,
  PAD_X,
  PLAN_BAND,
  PLAN_TOP,
  PROFILE_BAND,
  PROFILE_TOP,
  SECTION_H,
  SECTION_W,
  sectionLayout,
} from "./section-drawing.js";
import { SectionFittingOverlay } from "./SectionFittingOverlay.js";
import { SectionPlanBand } from "./SectionPlanBand.js";
import { SectionProfileBand } from "./SectionProfileBand.js";
import { SectionScale } from "./SectionScale.js";
import type { SectionFacts, ZoneRange } from "./sections.js";

export { SECTION_H, SECTION_W };

/**
 * The section card's drawing: a plan band and a profile band under one uniform transform, so each band is a
 * faithful crop of the main drawing and can never disagree with it. Because a uniform scale cannot magnify past
 * the band heights, the window widens to fill the card instead of squashing the drawing: the section sits centred
 * with its neighbours dimmed. The hull, deck houses and funnels are the main drawing's own layers under that
 * transform; fittings, arcs, machinery rooms and bunkers are drawn over them from the section's facts.
 *
 * This component owns only the card's frame, defs and layer order; the bands, callouts and scale are the focused
 * components beside it.
 */
export function SectionDrawing({
  facts,
  frame,
  profile,
  draft,
  content,
  zones,
}: {
  readonly facts: SectionFacts;
  readonly frame: PlanFrame;
  readonly profile: ProfileFrame;
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly zones: readonly ZoneRange[];
}) {
  const clip = `section-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const layout = sectionLayout(facts, frame, profile, draft, content, zones);
  if (!layout) return null;
  const { x0, x1 } = layout;
  return (
    <svg
      viewBox={`0 0 ${SECTION_W} ${SECTION_H}`}
      className="w-full rounded bg-muted/40"
      role="img"
      aria-label={layout.label}
      data-testid="section-drawing"
      data-section={facts.id}
    >
      <defs>
        <clipPath id={`${clip}-plan`}>
          <rect x={PAD_X} y={PLAN_TOP} width={SECTION_W - 2 * PAD_X} height={PLAN_BAND} />
        </clipPath>
        <clipPath id={`${clip}-profile`}>
          <rect x={PAD_X} y={PROFILE_TOP} width={SECTION_W - 2 * PAD_X} height={PROFILE_BAND} />
        </clipPath>
        <pattern
          id={`${clip}-hatch`}
          width={4}
          height={4}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={4} className="stroke-foreground" strokeWidth={1} />
        </pattern>
      </defs>

      <SectionPlanBand
        layout={layout}
        frame={frame}
        draft={draft}
        content={content}
        zones={zones}
        clip={clip}
      />

      <SectionProfileBand layout={layout} profile={profile} facts={facts} clip={clip} />

      {/* Neighbouring sections, dimmed: context, not part of this section. */}
      <rect
        x={PAD_X}
        y={PLAN_TOP}
        width={Math.max(0, x0 - PAD_X)}
        height={PROFILE_TOP + PROFILE_BAND - PLAN_TOP}
        className="fill-background"
        fillOpacity={0.6}
      />
      <rect
        x={x1}
        y={PLAN_TOP}
        width={Math.max(0, SECTION_W - PAD_X - x1)}
        height={PROFILE_TOP + PROFILE_BAND - PLAN_TOP}
        className="fill-background"
        fillOpacity={0.6}
      />
      {[x0, x1].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={PLAN_TOP}
          y2={PROFILE_TOP + PROFILE_BAND}
          className="stroke-foreground"
          strokeWidth={STROKE.structure}
          {...NON_SCALING}
          data-testid="section-bulkhead"
        />
      ))}

      <SectionFittingOverlay layout={layout} frame={frame} facts={facts} clip={clip} />

      {(
        [
          ["Plan", PLAN_TOP],
          ["Profile", PROFILE_TOP],
        ] as const
      ).map(([caption, y]) => (
        <text
          key={caption}
          x={PAD_X + 3}
          y={y + CARD_FONT}
          className="fill-muted-foreground"
          fontSize={CARD_FONT - 1}
        >
          {caption}
        </text>
      ))}

      <SectionScale layout={layout} />
    </svg>
  );
}
