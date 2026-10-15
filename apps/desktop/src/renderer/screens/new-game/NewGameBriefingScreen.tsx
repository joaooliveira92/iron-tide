import { Flag, Landmark, Radar } from "lucide-react";
import {
  tensionLabel,
  type OpeningBriefingProjection,
  type OpeningBriefingRelationsRow,
} from "@bluewave/campaign-engine";
import type { ReactNode } from "react";
import { nationPresentationOrNull } from "../../content/presentationContent.js";
import type { PlayableSlotCountryId } from "../../content/nationAssetManifest.js";
import { Button } from "../../components/ui/button.js";
import { GlassCard } from "../../components/ui/glass-card.js";
import { cn } from "../../lib/utils.js";
import { nationFlagUrl } from "../../content/nation-flag.js";
import { tensionBadgeLabel } from "../diplomacy/diplomacy-presentation.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { formatCampaignMonth, formatTreasury } from "../../shell/site-header-state.js";
import {
  RELATION_PRESENTATION,
  TENSION_PRESENTATION,
  sortRelationsByTension,
} from "./new-game-briefing-presentation.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { ScreenHeader } from "./components/ScreenHeader.js";
import { OPENING_BRIEFING_PAGE_TITLES, canGoBack } from "./new-game-briefing-screen-state.js";
import { useBriefingPager } from "./useBriefingPager.js";
import { useOpeningBriefing, type LoadOpeningBriefing } from "./useOpeningBriefing.js";

export interface NewGameBriefingScreenProps {
  readonly sessionId: string;
  readonly onInspectOpeningBriefing: LoadOpeningBriefing;
  readonly onTakeCommand: () => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

function formatSignedMoney(value: number): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${formatTreasury(Math.abs(value))}`;
}

function DetailRow({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function AppointmentPage({
  projection,
  nationId,
}: {
  readonly projection: OpeningBriefingProjection;
  readonly nationId: PlayableSlotCountryId;
}) {
  const record = nationPresentationOrNull(nationId);
  const dossier = record?.dossier;
  const flavor = record?.flavor;
  const title = dossier?.appointmentTitle ?? projection.nationName;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Appointment confirmed · {formatCampaignMonth(projection.month)}
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          You have been appointed {title} — {projection.nationName}
        </h2>
      </div>
      {flavor !== undefined && (
        <GlassCard glassVariant="liquid-refract">
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm text-muted-foreground">{flavor.military}</p>
            <p className="text-sm text-muted-foreground">{flavor.economy}</p>
            <p className="text-sm text-muted-foreground">{flavor.diplomacy}</p>
          </div>
        </GlassCard>
      )}
      {dossier !== undefined && (
        <GlassCard glassVariant="liquid-refract">
          <div className="flex flex-col gap-2 p-4">
            <p className="text-sm text-muted-foreground">{dossier.doctrine}</p>
            <p className="text-sm text-muted-foreground">{dossier.strategicRegions}</p>
            <p className="text-sm text-muted-foreground">{dossier.nationalCharacteristics}</p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function StateOfTheNavyPage({ projection }: { readonly projection: OpeningBriefingProjection }) {
  const { stateOfTheNavy } = projection;
  return (
    <div className="flex flex-col gap-4">
      <GlassCard glassVariant="liquid-refract">
        <div className="flex flex-col gap-1 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ship-class inventory
          </p>
          {stateOfTheNavy.shipClassCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissioned ships on the roster.</p>
          ) : (
            stateOfTheNavy.shipClassCounts.map(({ label, count }) => (
              <DetailRow key={label} label={label} value={count} />
            ))
          )}
        </div>
      </GlassCard>
      <GlassCard glassVariant="liquid-refract">
        <div className="flex flex-col p-4">
          <DetailRow
            label="Ships under construction"
            value={stateOfTheNavy.shipsUnderConstruction}
          />
          <DetailRow
            label="Most expensive active class"
            value={
              stateOfTheNavy.mostExpensiveActiveClass === null
                ? "—"
                : `${stateOfTheNavy.mostExpensiveActiveClass.className} (${formatTreasury(stateOfTheNavy.mostExpensiveActiveClass.projectedCost)})`
            }
          />
          <DetailRow label="Largest available dock" value={stateOfTheNavy.largestDockCapacity} />
          <DetailRow
            label="Total maintenance expense"
            value={formatTreasury(stateOfTheNavy.totalMaintenance)}
          />
          <DetailRow
            label="Construction committed"
            value={formatTreasury(stateOfTheNavy.constructionCommitted)}
          />
        </div>
      </GlassCard>
    </div>
  );
}

function TreasuryPage({ projection }: { readonly projection: OpeningBriefingProjection }) {
  const { treasury } = projection;
  return (
    <div className="flex flex-col gap-4">
      <GlassCard glassVariant="liquid-refract">
        <div className="flex flex-col p-4">
          <DetailRow
            label="Government allocation"
            value={formatTreasury(treasury.governmentAllocation)}
          />
          <DetailRow
            label="Fleet maintenance"
            value={`−${formatTreasury(treasury.fleetMaintenance)}`}
          />
          <DetailRow
            label="Construction committed"
            value={`−${formatTreasury(treasury.constructionCommitted)}`}
          />
          <DetailRow
            label="Research expenditure"
            value={`−${formatTreasury(treasury.researchExpenditure)}`}
          />
          <DetailRow
            label="Projected surplus / deficit"
            value={formatSignedMoney(treasury.projectedSurplus)}
          />
        </div>
      </GlassCard>
      <GlassCard glassVariant="liquid-refract">
        <div className="p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Treasury outlook
          </p>
          <p className="mt-1 text-sm font-medium capitalize">{treasury.status}</p>
        </div>
      </GlassCard>
    </div>
  );
}

/** The power's flag art, or its initial on a muted chip when no art is authored. */
function NationGlyph({ nationId, name }: { readonly nationId: string; readonly name: string }) {
  const url = nationFlagUrl(nationId);
  if (url !== null) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        className="h-6 w-9 shrink-0 rounded-sm border border-border/60 object-cover shadow-sm"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-6 w-9 shrink-0 items-center justify-center rounded-sm border border-border/60 bg-muted text-xs font-semibold text-muted-foreground"
    >
      {name.slice(0, 1)}
    </span>
  );
}

function RelationPill({
  relation,
}: {
  readonly relation: OpeningBriefingRelationsRow["relation"];
}) {
  const { label, icon: Icon, className } = RELATION_PRESENTATION[relation];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function TensionMeter({
  relation,
  tension,
}: {
  readonly relation: OpeningBriefingRelationsRow["relation"];
  readonly tension: number;
}) {
  const band = TENSION_PRESENTATION[tensionLabel(tension)];
  const Icon = band.icon;
  // Suppress the band word when it would only repeat the relation pill
  // ("neutral" relation at a "neutral" band) — the icon and colour still carry it.
  const bandLabel = tensionBadgeLabel(relation, tension);
  const filled = Math.max(0, Math.min(10, tension));
  return (
    <div className="flex min-w-[11rem] flex-1 items-center gap-2">
      <span
        className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", band.text)}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {bandLabel}
      </span>
      <div className="flex flex-1 gap-0.5" role="img" aria-label={`Tension ${tension} of 10`}>
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={cn("h-1.5 flex-1 rounded-full", index < filled ? band.bar : "bg-border/60")}
          />
        ))}
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums">
        {tension}/10
      </span>
    </div>
  );
}

function ForeignIntelligencePage({
  projection,
}: {
  readonly projection: OpeningBriefingProjection;
}) {
  const relations = sortRelationsByTension(projection.foreignIntelligence.relations);
  return (
    <GlassCard glassVariant="liquid-refract">
      <div className="flex flex-col gap-2 p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Relations by power
        </p>
        {relations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No foreign relations on record.</p>
        ) : (
          relations.map((relation) => (
            <div
              key={relation.nationId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border/50 bg-background/40 px-3 py-2"
            >
              <NationGlyph nationId={relation.nationId} name={relation.name} />
              <span className="min-w-[9rem] flex-1 truncate text-sm font-medium">
                {relation.name}
              </span>
              <RelationPill relation={relation.relation} />
              <TensionMeter relation={relation.relation} tension={relation.tension} />
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

function ImmediateConcernsPage({ projection }: { readonly projection: OpeningBriefingProjection }) {
  const concerns = projection.immediateConcerns;
  return (
    <GlassCard glassVariant="liquid-refract">
      <div className="flex flex-col p-4">
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Immediate concerns
        </p>
        {concerns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pressing concerns to report.</p>
        ) : (
          concerns.map((concern) => (
            <div key={concern.category} className="flex items-start gap-2 py-1.5">
              <Flag className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{concern.message}</p>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

export function NewGameBriefingScreen({
  sessionId,
  onInspectOpeningBriefing,
  onTakeCommand,
  onPrimaryActionChange,
}: NewGameBriefingScreenProps) {
  const { projection, error } = useOpeningBriefing(sessionId, onInspectOpeningBriefing);
  const ready = projection !== null;
  const { pageIndex, goBack } = useBriefingPager({
    sessionId,
    ready,
    onTakeCommand,
    onPrimaryActionChange,
  });

  if (error !== null) {
    return (
      <NewGameScreenLayout size="sm" centered>
        <ScreenHeader
          icon={<Flag />}
          title="Briefing unavailable"
          description={`The opening briefing could not be prepared. ${error}`}
        />
      </NewGameScreenLayout>
    );
  }

  if (projection === null) {
    return (
      <NewGameScreenLayout size="sm" centered>
        <ScreenHeader
          icon={<Landmark />}
          title="Opening strategic briefing"
          description="Preparing the briefing…"
        />
      </NewGameScreenLayout>
    );
  }

  const nationId = projection.nationId as PlayableSlotCountryId;
  const title = OPENING_BRIEFING_PAGE_TITLES[pageIndex] ?? "Opening Strategic Briefing";
  const pageContent: ReactNode =
    pageIndex === 0 ? (
      <AppointmentPage projection={projection} nationId={nationId} />
    ) : pageIndex === 1 ? (
      <StateOfTheNavyPage projection={projection} />
    ) : pageIndex === 2 ? (
      <TreasuryPage projection={projection} />
    ) : pageIndex === 3 ? (
      <ForeignIntelligencePage projection={projection} />
    ) : (
      <ImmediateConcernsPage projection={projection} />
    );

  return (
    <NewGameScreenLayout size="md">
      <ScreenHeader icon={<Landmark />} title="Opening Strategic Briefing" description={title} />

      <div className="flex items-center gap-1.5" aria-label="Briefing progress">
        {OPENING_BRIEFING_PAGE_TITLES.map((pageTitle, index) => (
          <span
            key={pageTitle}
            className={`h-1.5 flex-1 rounded-full ${index <= pageIndex ? "bg-primary" : "bg-border"}`}
            title={pageTitle}
          />
        ))}
      </div>

      {pageContent}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={goBack} disabled={!canGoBack(pageIndex)}>
          Back
        </Button>
      </div>

      <div
        className="flex items-center gap-1.5 self-end text-xs text-muted-foreground"
        aria-hidden="true"
      >
        <Radar className="size-3.5" />
        {formatCampaignMonth(projection.month)}
      </div>
    </NewGameScreenLayout>
  );
}
