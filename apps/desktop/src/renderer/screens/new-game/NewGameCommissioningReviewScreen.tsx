import type { ArchetypeSelection } from "@bluewave/campaign-engine";
import { Anchor } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { Button } from "../../components/ui/button.js";
import { GlassCard } from "../../components/ui/glass-card.js";
import { Table, TableBody, TableCell, TableRow } from "../../components/ui/table.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import {
  COMMISSIONING_GROUP_ICONS,
  FORECAST_ICONS,
  summaryRowIcon,
} from "./components/commissioning-review-icons.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { ScreenHeader } from "./components/ScreenHeader.js";
import type { FleetMethodDraft } from "./new-game-fleet-method-screen-state.js";
import type { CampaignIdentityDraft } from "./new-game-identity-screen-state.js";
import {
  activePresetAnnotation,
  buildStrategicForecast,
  buildSummaryRows,
  type SummaryGroup,
  type SummaryRow,
} from "./new-game-commissioning-review-screen-state.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";

export interface NewGameCommissioningReviewScreenProps {
  readonly nationId: string;
  readonly options: NewGameOptions | null;
  readonly preferences: DraftPreferences;
  readonly archetype: ArchetypeSelection;
  readonly identity: CampaignIdentityDraft;
  readonly fleetMethod: FleetMethodDraft;
  readonly status: "ready" | "launching";
  readonly error: string | null;
  readonly onBack: () => void;
  readonly onBeginCommission: () => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

const SUMMARY_SECTIONS: ReadonlyArray<{
  readonly group: SummaryGroup;
  readonly title: string;
  readonly ariaLabel: string;
}> = [
  { group: "command", title: "The Command", ariaLabel: "Command summary" },
  {
    group: "uncertainty",
    title: "Historical Uncertainty",
    ariaLabel: "Historical uncertainty summary",
  },
  { group: "identity", title: "Admiralty Identity", ariaLabel: "Admiralty identity summary" },
];

export function NewGameCommissioningReviewScreen({
  nationId,
  options,
  preferences,
  archetype,
  identity,
  fleetMethod,
  status,
  error,
  onBack,
  onBeginCommission,
  onPrimaryActionChange,
}: NewGameCommissioningReviewScreenProps) {
  const launching = status === "launching";

  const onBeginRef = useRef(onBeginCommission);
  onBeginRef.current = onBeginCommission;
  const triggerBegin = useCallback(() => {
    onBeginRef.current();
  }, []);

  const primaryAction = useMemo(
    () => ({
      label: launching ? "Commissioning…" : "Begin Commission",
      disabled: launching,
      onTrigger: triggerBegin,
    }),
    [launching, triggerBegin],
  );
  usePrimaryAction(primaryAction, onPrimaryActionChange);

  const rows = buildSummaryRows({
    nationId,
    options,
    preferences,
    archetype,
    identity,
    fleetMethod,
  });
  const presetLabel = activePresetAnnotation(preferences);
  const forecast = buildStrategicForecast(nationId, preferences);

  return (
    <NewGameScreenLayout>
      <ScreenHeader
        icon={<Anchor className="h-5 w-5" />}
        title="Final commissioning review"
        description="Confirm every decision before your appointment is commissioned."
      />

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      {SUMMARY_SECTIONS.map((section) => (
        <ReviewSection
          key={section.group}
          title={section.title}
          ariaLabel={section.ariaLabel}
          icon={COMMISSIONING_GROUP_ICONS[section.group]}
          note={
            section.group === "uncertainty" ? `Rules of the Naval Age: ${presetLabel}` : undefined
          }
          rows={rows.filter((row) => row.group === section.group)}
        />
      ))}

      {forecast !== null && (
        <GlassCard glassVariant="liquid-refract">
          <section className="flex flex-col gap-4 p-4">
            <header className="flex items-center gap-2">
              <SectionBadge icon={FORECAST_ICONS.heading} />
              <h2 className="text-sm font-semibold">
                Strategic forecast — {forecast.appointmentTitle}
              </h2>
            </header>

            <div className="grid gap-3 sm:grid-cols-3">
              <ForecastFact
                icon={FORECAST_ICONS.doctrine}
                label="Doctrine"
                text={forecast.doctrine}
              />
              <ForecastFact
                icon={FORECAST_ICONS.strategicRegions}
                label="Strategic regions"
                text={forecast.strategicRegions}
              />
              <ForecastFact
                icon={FORECAST_ICONS.nationalCharacteristics}
                label="National character"
                text={forecast.nationalCharacteristics}
              />
            </div>

            <div>
              <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <FORECAST_ICONS.expectedPressures
                  className="h-3.5 w-3.5 flex-none text-admiralty-accent"
                  aria-hidden="true"
                />
                Expected pressures
              </p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {forecast.expectedPressures.map((pressure) => (
                  <li
                    key={pressure}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Anchor
                      className="mt-0.5 h-3.5 w-3.5 flex-none text-admiralty-accent/80"
                      aria-hidden="true"
                    />
                    {pressure}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </GlassCard>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={launching}>
          Back to Fleet Method
        </Button>
      </div>
    </NewGameScreenLayout>
  );
}

function SectionBadge({ icon: Icon }: { readonly icon: LucideIcon }) {
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-admiralty-accent/45 bg-admiralty-accent/10 text-admiralty-accent">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

function ReviewSection({
  title,
  ariaLabel,
  icon,
  note,
  rows,
}: {
  readonly title: string;
  readonly ariaLabel: string;
  readonly icon: LucideIcon;
  readonly note?: string | undefined;
  readonly rows: readonly SummaryRow[];
}) {
  return (
    <GlassCard glassVariant="liquid-refract">
      <section className="p-4">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <SectionBadge icon={icon} />
          <h2 className="text-sm font-semibold">{title}</h2>
          {note !== undefined && (
            <span className="ml-auto rounded-full border border-admiralty-accent/25 bg-admiralty-accent/[0.06] px-2.5 py-1 font-display text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {note}
            </span>
          )}
        </header>
        <Table aria-label={ariaLabel}>
          <TableBody>
            {rows.map((row) => {
              const RowIcon = summaryRowIcon(row.icon);
              return (
                <TableRow key={row.label}>
                  <TableCell className="w-2/5 font-medium text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <RowIcon
                        className="h-4 w-4 flex-none text-admiralty-accent/80"
                        aria-hidden="true"
                      />
                      {row.label}
                    </span>
                  </TableCell>
                  <TableCell>{row.value}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </GlassCard>
  );
}

function ForecastFact({
  icon: Icon,
  label,
  text,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly text: string;
}) {
  return (
    <article className="rounded-lg border border-border/60 bg-admiralty-surface-raised/40 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 flex-none text-admiralty-accent" aria-hidden="true" />
        <h3 className="font-display text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </article>
  );
}
