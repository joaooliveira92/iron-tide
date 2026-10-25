import type { DesignDraft, WorkshopView } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { cn } from "../../../../lib/utils.js";
import type { PresentationFormat } from "../../../../lib/presentation-format/index.js";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import type { PlanFrame } from "./geometry.js";
import { profileFrame } from "./profile-geometry.js";
import { SectionDrawing } from "./SectionDrawing.js";
import { sectionFacts, type SectionFitting, type SectionId, type ZoneRange } from "./sections.js";

export interface SectionCardContext {
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
  readonly content: DrawingBoardContent;
  readonly zones: readonly ZoneRange[];
  readonly frame: PlanFrame;
  readonly sheerBp: number;
}

const LIST_MAX = 6;

const SIDE = { CENTRE: "centreline", PORT: "port", STBD: "starboard" } as const;

function fittingLine(f: SectionFitting, format: PresentationFormat): string {
  const num = (v: number, digits = 0) =>
    format.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const parts = [`${SIDE[f.side]}, ${f.stationPermille}‰`];
  if (f.weightKg !== undefined)
    parts.push(format.measurement(f.weightKg, "mass", { maximumFractionDigits: 1 }));
  if (f.arcDeg !== undefined) parts.push(`${num(f.arcDeg)}° arc`);
  if (f.protectionBp !== undefined)
    parts.push(`protection margin ${format.percent(f.protectionBp, 0)}`);
  return parts.join(" · ");
}

export function SectionCard({
  id,
  ctx,
}: {
  readonly id: SectionId;
  readonly ctx: SectionCardContext;
}) {
  const format = usePresentationFormat();
  const num = (v: number, digits = 0) =>
    format.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const pct = (bp: number) => format.percent(bp, 0);
  const facts = sectionFacts(id, ctx);
  const { zone, load, meta } = facts;
  const form = ctx.content.hullForms.find((f) => f.id === ctx.draft.hull.hullFormId);
  const profile = profileFrame(ctx.draft.hull, ctx.sheerBp, ctx.frame.bow, ctx.frame.stern);
  const extra = facts.fittings.length - LIST_MAX;
  const drawing = zone ? (
    <SectionDrawing
      facts={facts}
      frame={ctx.frame}
      profile={profile}
      draft={ctx.draft}
      content={ctx.content}
      zones={ctx.zones}
    />
  ) : (
    <p role="note" className="text-muted-foreground">
      This hull form does not define a {meta.name.toLowerCase()} section, so there is nothing to
      draw.
    </p>
  );
  return (
    <article
      aria-label={meta.name}
      data-testid="section-card"
      data-section={id}
      className="grid grid-cols-1 @[26rem]:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
    >
      <div
        className={cn(
          "border-b p-3 @[26rem]:border-b-0 @[26rem]:border-r @[26rem]:p-2",
          zone && "slate-grid @[26rem]:bg-muted/20",
        )}
      >
        {drawing}
      </div>
      <div className="space-y-2 p-3 text-sm">
        <div>
          <h3 className="font-display font-semibold tracking-tight">{meta.name}</h3>
          {zone && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Stations {zone.startPermille}–{zone.endPermille}‰ · {num(facts.fromBowM, 1)}–
              {num(facts.fromBowM + facts.lengthM, 1)} m from the bow · {num(facts.lengthM, 1)} m
              long
            </p>
          )}
        </div>
        <p className="leading-relaxed text-muted-foreground">{meta.purpose}</p>

        {load ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs tabular-nums">
            <dt className="text-muted-foreground">Weight fitted</dt>
            <dd>{format.measurement(load.weightKg, "mass", { maximumFractionDigits: 1 })}</dd>
            <dt className="text-muted-foreground">Internal volume</dt>
            <dd>
              {num(load.volumeUsedLitre / 1000)} of {num(load.volumeCapacityLitre / 1000)} m³ used
            </dd>
            <dt className="text-muted-foreground">Deck area</dt>
            <dd>
              {num(load.deckUsedMm2 / 1e6)} of {num(load.deckCapacityMm2 / 1e6)} m² used
            </dd>
            {zone?.volumeBp !== undefined && zone.deckAreaBp !== undefined && (
              <>
                <dt className="text-muted-foreground">Share of hull</dt>
                <dd>
                  {pct(zone.volumeBp)} of volume · {pct(zone.deckAreaBp)} of deck
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p role="note" className="text-xs text-muted-foreground">
            Volume, deck area and weight for this section are not available: the design has no
            arrangement result yet.
          </p>
        )}

        {facts.fittings.length > 0 ? (
          <ol
            className="space-y-0.5 text-xs"
            aria-label={`Fittings in the ${meta.name.toLowerCase()}`}
          >
            {facts.fittings.slice(0, LIST_MAX).map((f) => (
              <li key={f.instanceId} className="flex gap-2">
                <span className="w-4 shrink-0 text-right font-medium tabular-nums">{f.n}</span>
                <span>
                  {f.name} <span className="text-muted-foreground">({fittingLine(f, format)})</span>
                </span>
              </li>
            ))}
            {extra > 0 && <li className="pl-6 text-muted-foreground">and {extra} more</li>}
          </ol>
        ) : (
          zone && (
            <p className="text-xs text-muted-foreground">
              {facts.machineryRooms.length > 0 || facts.fuelStationPermille !== undefined
                ? "No components are placed here; the plant's rooms and bunkers are listed below."
                : "Nothing is fitted here yet; the drawing shows the hull geometry only."}
            </p>
          )
        )}
        {facts.machineryRooms.map((r) => (
          <p key={r.stationPermille} className="text-xs">
            <span className="font-medium">M</span> Machinery room at {r.stationPermille}‰,{" "}
            {pct(r.shareBp)} of the plant
          </p>
        ))}
        {facts.fuelStationPermille !== undefined && (
          <p className="text-xs">
            <span className="font-medium">F</span> Fuel stowage at {facts.fuelStationPermille}‰
          </p>
        )}
        {zone && (
          <p className="text-xs text-muted-foreground">
            Schematic{form ? "" : " (hull form unknown)"}: hull, deck houses and funnels follow the
            design; symbols are drawing conventions. The drawing is the main plan and profile,
            cropped to this station window.
          </p>
        )}
      </div>
    </article>
  );
}
