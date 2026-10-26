import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { History, HistoryMonth } from "../history-view.js";
import { signed } from "../../overview/month-report-format.js";
import { SegmentCard } from "./SegmentCard.js";

const CASH_ZONE = "h-24";
const SPEND_ZONE = "h-20";
const PAD = 8;
const SPAN = 100 - PAD * 2;

const OUTFLOWS = [
  { id: "obligations", label: "Obligations", className: "bg-warning" },
  { id: "maintenance", label: "Fleet maintenance", className: "bg-primary" },
  { id: "research", label: "Research", className: "bg-success" },
  { id: "construction", label: "Construction", className: "bg-foreground/45" },
] as const;

const cashTop = (month: HistoryMonth): number => PAD + month.cashY * SPAN;

function MonthColumn({
  month,
  spendScale,
  selected,
  onSelect,
}: {
  readonly month: HistoryMonth;
  readonly spendScale: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const format = usePresentationFormat();
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={<button type="button" />}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${month.label}: closing ${format.count(month.closing)}, net ${signed(month.net, format)} — show detail`}
        className={cn(
          "group/col relative flex min-w-0 flex-col outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
          selected && "bg-muted/80",
        )}
      >
        <span aria-hidden="true" className={cn("relative block", CASH_ZONE)}>
          <span
            className={cn(
              "absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background transition-transform group-hover/col:scale-125",
              month.shortfall > 0 && "border-destructive",
              selected && "scale-125 bg-primary",
            )}
            style={{ top: `${cashTop(month)}%` }}
          />
        </span>
        <span
          aria-hidden="true"
          className={cn("relative mt-1 flex flex-col-reverse items-center", SPEND_ZONE)}
        >
          <span className="flex h-full w-3/5 flex-col-reverse">
            {OUTFLOWS.map((outflow) => (
              <span
                key={outflow.id}
                className={cn("block w-full", outflow.className)}
                style={{ height: `${(month[outflow.id] / spendScale) * 100}%` }}
              />
            ))}
          </span>
          <span
            className="absolute left-[15%] right-[15%] h-0.5 bg-foreground"
            style={{ bottom: `${(month.income / spendScale) * 100}%` }}
          />
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="center" className="w-72">
        <SegmentCard
          title={month.label}
          amount={format.money(month.closing)}
          description={`Opened at ${format.count(month.opening)} and closed at ${format.count(month.closing)}.`}
          facts={[
            { label: "Net change", value: signed(month.net, format) },
            { label: "Appropriation", value: format.count(month.income) },
            { label: "Spent", value: format.count(month.spent) },
            ...(month.shortfall > 0
              ? [{ label: "Left unpaid", value: format.count(month.shortfall) }]
              : []),
          ]}
          note={month.shortfall > 0 ? "Some costs could not be paid this month." : null}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

export function HistoryChart({
  history,
  selectedId,
  onSelect,
}: {
  readonly history: History;
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}) {
  const { months, spendScale } = history;
  const line = months.map((month) => `${month.centre * 100},${cashTop(month)}`).join(" ");
  return (
    <div className="space-y-3" data-testid="history-chart">
      <div className="relative">
        <div
          role="group"
          aria-label="Months"
          className="grid"
          style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
        >
          {months.map((month) => (
            <MonthColumn
              key={month.id}
              month={month}
              spendScale={spendScale}
              selected={month.id === selectedId}
              onSelect={() => onSelect(month.id)}
            />
          ))}
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 w-full overflow-visible",
            CASH_ZONE,
          )}
        >
          <polyline
            points={line}
            className="fill-none stroke-primary"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-primary" />
          Closing treasury
        </li>
        {OUTFLOWS.map((outflow) => (
          <li key={outflow.id} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("inline-block size-2.5 rounded-sm", outflow.className)}
            />
            {outflow.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-foreground" />
          Appropriation
        </li>
      </ul>
    </div>
  );
}
