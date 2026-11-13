import type {
  EntityReferenceDto,
  TurnSummaryEntry,
} from "../../../shared/turn-message-contract.js";
import type { UiStateTurnMessages } from "../../../shared/ui-state-contract.js";
import {
  TurnSummaryFilterBar,
  TurnSummaryGroups,
  TurnSummaryHistory,
  TurnSummaryNoMatch,
  TurnSummaryProvider,
  TurnSummaryStatus,
  useTurnSummaryMeta,
} from "./turn-summary/index.js";

export interface TurnSummaryPanelProps {
  readonly summaries: readonly TurnSummaryEntry[];
  readonly loading: boolean;
  readonly turnMessages: UiStateTurnMessages;
  readonly onTogglePinned: (id: string) => void;
  readonly onToggleRead: (id: string) => void;
  readonly onOpenEntity?: (ref: EntityReferenceDto) => void;
  readonly onAssignToFleet?: (shipId: string) => void;
  readonly assignableNationId?: string;
  readonly isEntityAvailable?: (ref: EntityReferenceDto) => boolean;
}

function TurnSummarySurface() {
  const { showHistory, showFilters } = useTurnSummaryMeta();
  return (
    <div className="space-y-2" data-testid="turn-summary-panel">
      <TurnSummaryStatus />
      {showHistory && <TurnSummaryHistory />}
      {showFilters && <TurnSummaryFilterBar />}
      <TurnSummaryGroups />
      <TurnSummaryNoMatch />
    </div>
  );
}

export function TurnSummaryPanel(props: TurnSummaryPanelProps) {
  return (
    <TurnSummaryProvider {...props}>
      <TurnSummarySurface />
    </TurnSummaryProvider>
  );
}
