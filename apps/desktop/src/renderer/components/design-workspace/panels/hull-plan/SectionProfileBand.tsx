import { DASH, NON_SCALING, OPACITY, STROKE } from "./drafting.js";
import { ProfileFittingsLayer, ProfileHullLayer } from "./profile-layers.js";
import type { ProfileFrame } from "./profile-geometry.js";
import { CARD_FONT, PAD_X, SECTION_W, type SectionLayout } from "./section-drawing.js";
import type { SectionFacts } from "./sections.js";

export function SectionProfileBand({
  layout,
  profile,
  facts,
  clip,
}: {
  readonly layout: SectionLayout;
  readonly profile: ProfileFrame;
  readonly facts: SectionFacts;
  readonly clip: string;
}) {
  return (
    <g clipPath={`url(#${clip}-profile)`}>
      <g transform={`matrix(${layout.a} 0 0 ${layout.kp} ${layout.b} ${layout.profileTy})`}>
        <ProfileHullLayer frame={profile} />
        <ProfileFittingsLayer houses={layout.houses} funnels={layout.funnels} />
      </g>
      <line
        x1={PAD_X}
        x2={SECTION_W - PAD_X}
        y1={layout.pY(profile.waterlineY)}
        y2={layout.pY(profile.waterlineY)}
        className="stroke-primary"
        strokeWidth={STROKE.datum}
        strokeOpacity={OPACITY.datum}
        strokeDasharray={DASH.waterline}
        {...NON_SCALING}
        data-testid="section-waterline"
      />
      {facts.machineryRooms.map((r) => (
        <g key={`room-${r.stationPermille}`} data-testid="section-machinery-room">
          <rect
            x={layout.X(r.stationPermille) - 11}
            y={layout.pY(profile.waterlineY) + 2}
            width={22}
            height={Math.max(8, layout.pY(profile.keelBaseY) - layout.pY(profile.waterlineY) - 5)}
            className="fill-muted stroke-foreground"
            strokeWidth={STROKE.structure}
            strokeDasharray="2 2"
            {...NON_SCALING}
          />
          <text
            x={layout.X(r.stationPermille)}
            y={layout.pY(profile.waterlineY) + 14}
            textAnchor="middle"
            className="fill-foreground"
            fontSize={CARD_FONT - 2}
          >
            M
          </text>
        </g>
      ))}
      {facts.fuelStationPermille !== undefined && (
        <g data-testid="section-fuel">
          <circle
            cx={layout.X(facts.fuelStationPermille)}
            cy={layout.pY(profile.keelBaseY) - 9}
            r={6}
            className="fill-background stroke-foreground"
            strokeWidth={STROKE.structure}
            {...NON_SCALING}
          />
          <text
            x={layout.X(facts.fuelStationPermille)}
            y={layout.pY(profile.keelBaseY) - 5.5}
            textAnchor="middle"
            className="fill-foreground"
            fontSize={CARD_FONT - 3}
          >
            F
          </text>
        </g>
      )}
      {facts.fittings.map((f) => {
        const x = layout.X(f.stationPermille);
        const deck = layout.pY(profile.deckY(f.stationPermille / 1000));
        return (
          <line
            key={f.instanceId}
            x1={x}
            x2={x}
            y1={deck}
            y2={deck - 7}
            className="stroke-primary"
            strokeWidth={2}
            {...NON_SCALING}
          />
        );
      })}
    </g>
  );
}
