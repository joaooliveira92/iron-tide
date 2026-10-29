import { ChevronDown, Newspaper, ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import type { MonthlyReportEntry } from "../../../../shared/reports-contract.js";
import type { EntityReferenceDto } from "../../../../shared/turn-message-contract.js";
import type { TurnSummaryEntry } from "../../../../shared/turn-message-contract.js";
import type { UiStateTurnMessages } from "../../../../shared/ui-state-contract.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover.js";
import { resolveMessage } from "../../../content/uiCatalogue.js";
import { HeaderToolbar } from "../../../shell/screen-header.js";
import { MonthReportCard } from "../MonthReportCard.js";
import { TurnSummaryPanel } from "../TurnSummaryPanel.js";

export interface OverviewHeaderReportsProps {
  readonly reports: readonly MonthlyReportEntry[];
  readonly areaName: (id: string) => string;
  readonly summaries: readonly TurnSummaryEntry[];
  readonly summariesLoading: boolean;
  readonly turnMessages: UiStateTurnMessages;
  readonly onTogglePinned: (id: string) => void;
  readonly onToggleRead: (id: string) => void;
  readonly onOpenEntity: (ref: EntityReferenceDto) => void;
  readonly isEntityAvailable: (ref: EntityReferenceDto) => boolean;
}

function ReportChip({
  testId,
  label,
  icon,
  children,
}: {
  readonly testId: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        data-testid={testId}
        className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border bg-muted/40 px-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        {icon}
        {label}
        <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70vh] w-96 overflow-y-auto p-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function OverviewHeaderReports({
  reports,
  areaName,
  summaries,
  summariesLoading,
  turnMessages,
  onTogglePinned,
  onToggleRead,
  onOpenEntity,
  isEntityAvailable,
}: OverviewHeaderReportsProps) {
  return (
    <HeaderToolbar>
      <ReportChip
        testId="home-turn-summary"
        label={resolveMessage("ui.turnSummary.title")}
        icon={<ScrollText aria-hidden="true" className="size-3.5 text-muted-foreground" />}
      >
        <TurnSummaryPanel
          summaries={summaries}
          loading={summariesLoading}
          turnMessages={turnMessages}
          onTogglePinned={onTogglePinned}
          onToggleRead={onToggleRead}
          onOpenEntity={onOpenEntity}
          isEntityAvailable={isEntityAvailable}
        />
      </ReportChip>
      <ReportChip
        testId="home-month-report"
        label="Recent developments"
        icon={<Newspaper aria-hidden="true" className="size-3.5 text-muted-foreground" />}
      >
        <MonthReportCard reports={reports} areaName={areaName} embedded />
      </ReportChip>
    </HeaderToolbar>
  );
}
