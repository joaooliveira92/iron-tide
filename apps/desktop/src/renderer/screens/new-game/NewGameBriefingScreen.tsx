import { Flag, Landmark, Radar } from "lucide-react";
import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import type { ReactNode } from "react";
import { nationPresentationOrNull } from "../../content/presentationContent.js";
import type { PlayableSlotCountryId } from "../../content/nationAssetManifest.js";
import { GlassCard } from "../../components/ui/glass-card.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { formatCampaignMonth, formatTreasury } from "../../shell/site-header-state.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { BriefingActions } from "./components/BriefingActions.js";
import { BriefingProgress } from "./components/BriefingProgress.js";
import { ScreenHeader } from "./components/ScreenHeader.js";
import { WorldSituationBriefing } from "./world-situation/WorldSituationBriefing.js";
import { worldText } from "./world-situation-copy.js";
import { OPENING_BRIEFING_PAGE_TITLES, canGoBack } from "./new-game-briefing-screen-state.js";
import { useBriefingPager } from "./useBriefingPager.js";
import { useOpeningBriefing, type LoadOpeningBriefing } from "./useOpeningBriefing.js";

const FOREIGN_INTELLIGENCE_PAGE_INDEX = 3;

export interface NewGameBriefingScreenProps {
  readonly sessionId: string;
  readonly onInspectOpeningBriefing: LoadOpeningBriefing;
  readonly onTakeCommand: () => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

function formatSignedMoney(value: number, format: PresentationFormat): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${formatTreasury(Math.abs(value), format)}`;
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
  const format = usePresentationFormat();
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
                : `${stateOfTheNavy.mostExpensiveActiveClass.className} (${formatTreasury(stateOfTheNavy.mostExpensiveActiveClass.projectedCost, format)})`
            }
          />
          <DetailRow label="Largest available dock" value={stateOfTheNavy.largestDockCapacity} />
          <DetailRow
            label="Total maintenance expense"
            value={formatTreasury(stateOfTheNavy.totalMaintenance, format)}
          />
          <DetailRow
            label="Construction committed"
            value={formatTreasury(stateOfTheNavy.constructionCommitted, format)}
          />
        </div>
      </GlassCard>
    </div>
  );
}

function TreasuryPage({ projection }: { readonly projection: OpeningBriefingProjection }) {
  const format = usePresentationFormat();
  const { treasury } = projection;
  return (
    <div className="flex flex-col gap-4">
      <GlassCard glassVariant="liquid-refract">
        <div className="flex flex-col p-4">
          <DetailRow
            label="Government allocation"
            value={formatTreasury(treasury.governmentAllocation, format)}
          />
          <DetailRow
            label="Fixed obligations"
            value={`−${formatTreasury(treasury.obligations, format)}`}
          />
          <DetailRow
            label="Fleet maintenance"
            value={`−${formatTreasury(treasury.fleetMaintenance, format)}`}
          />
          <DetailRow
            label="Research expenditure"
            value={`−${formatTreasury(treasury.researchExpenditure, format)}`}
          />
          <DetailRow
            label="Projected surplus / deficit"
            value={formatSignedMoney(treasury.projectedSurplus, format)}
          />
          {treasury.runwayMonths !== undefined && (
            <DetailRow
              label="Treasury lasts"
              value={`${String(treasury.runwayMonths)} ${treasury.runwayMonths === 1 ? "month" : "months"}`}
            />
          )}
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
      <WorldSituationBriefing projection={projection} />
    ) : (
      <ImmediateConcernsPage projection={projection} />
    );

  const isWorldPage = pageIndex === FOREIGN_INTELLIGENCE_PAGE_INDEX;

  return (
    <NewGameScreenLayout size="md">
      <ScreenHeader icon={<Landmark />} title="Opening Strategic Briefing" description={title} />

      <BriefingProgress
        titles={OPENING_BRIEFING_PAGE_TITLES}
        currentIndex={pageIndex}
        label="Briefing progress"
      />

      {pageContent}

      <BriefingActions
        backLabel={worldText("actions.back")}
        canGoBack={canGoBack(pageIndex)}
        onBack={goBack}
        note={
          isWorldPage
            ? `${worldText("world.reviewOnly")} ${worldText("actions.continue.hint", {
                next: OPENING_BRIEFING_PAGE_TITLES[pageIndex + 1] ?? "",
              })}`
            : undefined
        }
      />

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
