import type {
  ActiveView,
  HeaderCampaign,
  SecondaryRow,
  WizardStepCopy,
} from "../site-header-state.js";
import { describeSecondaryRow } from "../site-header-state.js";
import { usePresentationFormat } from "../usePresentationFormat.js";
import { CampaignRow } from "./secondary-row/CampaignRow.js";
import { EditorRow } from "./secondary-row/EditorRow.js";
import { PreferencesRow } from "./secondary-row/PreferencesRow.js";
import { StatusRow } from "./secondary-row/StatusRow.js";
import { WizardRow } from "./secondary-row/WizardRow.js";

export interface HeaderSecondaryRowProps {
  readonly activeView: ActiveView;
  readonly campaign?: HeaderCampaign | null;
  /** Replaces the generic new-game heading and hint when the current step has its own. */
  readonly wizardStep?: WizardStepCopy | undefined;
  readonly onActionClick?: ((actionCode: string) => void) | undefined;
}

export interface SecondaryRowViewProps {
  readonly row: SecondaryRow;
  readonly onActionClick?: ((actionCode: string) => void) | undefined;
}

/**
 * The adaptive second row. A thin container: it describes the row from view/campaign state and
 * delegates rendering to one focused presenter per row kind.
 */
export function HeaderSecondaryRow({
  activeView,
  campaign = null,
  wizardStep,
  onActionClick,
}: HeaderSecondaryRowProps) {
  const format = usePresentationFormat();
  return (
    <SecondaryRowView
      row={describeSecondaryRow(activeView, campaign, format, wizardStep)}
      onActionClick={onActionClick}
    />
  );
}

/**
 * Dispatches a described row to its presenter. The `SecondaryRow` union is the single extension
 * point: a new kind is added to the state contract, this exhaustive switch, and one presenter.
 */
export function SecondaryRowView({ row, onActionClick }: SecondaryRowViewProps) {
  switch (row.kind) {
    case "status":
      return <StatusRow row={row} />;
    case "campaign":
      return <CampaignRow row={row} />;
    case "editor":
      return <EditorRow row={row} onActionClick={onActionClick} />;
    case "wizard":
      return <WizardRow row={row} />;
    case "preferences":
      return <PreferencesRow row={row} />;
  }
}
