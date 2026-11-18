import type { ArchetypeSelection } from "@bluewave/campaign-engine";
import { useCallback, useMemo, useRef } from "react";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import {
  activePresetAnnotation,
  buildStrategicForecast,
  buildSummaryRows,
  type StrategicForecast,
  type SummaryGroup,
  type SummaryRow,
} from "./new-game-commissioning-review-screen-state.js";
import type { FleetMethodDraft } from "./new-game-fleet-method-screen-state.js";
import type { CampaignIdentityDraft } from "./new-game-identity-screen-state.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";

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

export interface CommissioningReviewSection {
  readonly group: SummaryGroup;
  readonly title: string;
  readonly ariaLabel: string;
  readonly rows: readonly SummaryRow[];
}

export interface CommissioningReviewInput {
  readonly nationId: string;
  readonly options: NewGameOptions | null;
  readonly preferences: DraftPreferences;
  readonly archetype: ArchetypeSelection;
  readonly identity: CampaignIdentityDraft;
  readonly fleetMethod: FleetMethodDraft;
  readonly launching: boolean;
  readonly onBeginCommission: () => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

export interface CommissioningReview {
  readonly sections: readonly CommissioningReviewSection[];
  readonly presetLabel: string;
  readonly forecast: StrategicForecast | null;
}

export function useCommissioningReview({
  nationId,
  options,
  preferences,
  archetype,
  identity,
  fleetMethod,
  launching,
  onBeginCommission,
  onPrimaryActionChange,
}: CommissioningReviewInput): CommissioningReview {
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

  const sections = useMemo(() => {
    const rows = buildSummaryRows({
      nationId,
      options,
      preferences,
      archetype,
      identity,
      fleetMethod,
    });
    return SUMMARY_SECTIONS.map((section) => ({
      ...section,
      rows: rows.filter((row) => row.group === section.group),
    }));
  }, [nationId, options, preferences, archetype, identity, fleetMethod]);
  const presetLabel = useMemo(() => activePresetAnnotation(preferences), [preferences]);
  const forecast = useMemo(
    () => buildStrategicForecast(nationId, preferences),
    [nationId, preferences],
  );

  return { sections, presetLabel, forecast };
}
