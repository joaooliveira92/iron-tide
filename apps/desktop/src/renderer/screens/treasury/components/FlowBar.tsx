import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { buildBudgetBar, type BudgetSegment, type BudgetSegmentId } from "../budget-bar.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";
import { SegmentCard } from "./SegmentCard.js";

const HATCH =
  "bg-[repeating-linear-gradient(135deg,transparent_0_4px,color-mix(in_oklab,var(--foreground)_28%,transparent)_4px_6px)]";
const RULER_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;
const LABEL_MIN_WIDTH = 0.14;
const GROW = "transition-[width,opacity] duration-500 ease-out motion-reduce:transition-none";

export interface FlowBarProps {
  readonly breakdown: TreasuryBreakdown;
  readonly previewResearch: number | null;
  readonly active: BudgetSegmentId | null;
  readonly onActive: (id: BudgetSegmentId | null) => void;
}

export function segmentFacts(
  segment: BudgetSegment,
  format: ReturnType<typeof usePresentationFormat>,
) {
  return [
    {
      label: "Share of spending",
      value: `${format.number(segment.shareOfSpend * 100, { maximumFractionDigits: 0 })}%`,
    },
    {
      label: "Share of income",
      value: `${format.number(segment.shareOfIncome * 100, { maximumFractionDigits: 0 })}%`,
    },
  ];
}

function Segment({
  segment,
  active,
  onActive,
}: {
  readonly segment: BudgetSegment;
  readonly active: BudgetSegmentId | null;
  readonly onActive: (id: BudgetSegmentId | null) => void;
}) {
  const format = usePresentationFormat();
  const shrink = segment.previewDelta < 0 ? segment.previewWidth : 0;
  const width = Math.max(0, segment.width - shrink);
  return (
    <>
      <HoverCard>
        <HoverCardTrigger
          delay={0}
          closeDelay={0}
          render={<div />}
          onMouseEnter={() => onActive(segment.id)}
          onMouseLeave={() => onActive(null)}
          className={cn(
            "flex h-full min-w-0 items-center overflow-hidden px-2 text-xs font-medium text-primary-foreground",
            GROW,
            segment.className,
            active !== null && active !== segment.id && "opacity-40",
          )}
          style={{ width: `${width * 100}%` }}
        >
          {segment.width >= LABEL_MIN_WIDTH && <span className="truncate">{segment.label}</span>}
        </HoverCardTrigger>
        <HoverCardContent side="top" align="center" className="w-72">
          <SegmentCard
            swatchClassName={segment.className}
            title={segment.label}
            amount={format.money(segment.value)}
            description={segment.description}
            facts={segmentFacts(segment, format)}
          />
        </HoverCardContent>
      </HoverCard>
      {segment.previewDelta !== 0 && (
        <div
          data-preview={segment.previewDelta > 0 ? "added" : "removed"}
          className={cn(
            "h-full border-y border-dashed border-foreground/50",
            GROW,
            HATCH,
            segment.previewDelta > 0 && "bg-success/30",
          )}
          style={{ width: `${segment.previewWidth * 100}%` }}
        />
      )}
    </>
  );
}

export function FlowBar({ breakdown, previewResearch, active, onActive }: FlowBarProps) {
  const format = usePresentationFormat();
  const bar = buildBudgetBar(breakdown, previewResearch);
  const markerAt = `${bar.incomeMarker * 100}%`;
  const overflow = bar.overBudget
    ? { left: markerAt, width: `${(1 - bar.incomeMarker) * 100}%` }
    : null;

  return (
    <div className="space-y-2" data-testid="budget-bar">
      <div aria-hidden="true" className="relative h-4 text-[0.6875rem] text-muted-foreground">
        {RULER_STEPS.map((step) => (
          <span
            key={step}
            className={cn(
              "absolute tabular-nums",
              step === 1 ? "-translate-x-full" : step > 0 && "-translate-x-1/2",
            )}
            style={{ left: `${step * 100}%` }}
          >
            {format.count(Math.round(bar.scale * step))}
          </span>
        ))}
      </div>
      <div className="relative">
        <div
          role="img"
          aria-label={bar.label}
          className="relative flex h-14 w-full overflow-hidden rounded-md bg-muted/70 ring-1 ring-border"
        >
          {bar.segments.map((segment) => (
            <Segment key={segment.id} segment={segment} active={active} onActive={onActive} />
          ))}
          {overflow !== null && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 border-l-2 border-destructive bg-[repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--destructive)_35%,transparent)_5px_8px)]"
              style={overflow}
            />
          )}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-2 -top-2 w-0.5 bg-foreground transition-[left] duration-500 ease-out motion-reduce:transition-none"
          style={{ left: `calc(${markerAt} - 1px)` }}
        >
          <span
            className={cn(
              "absolute -bottom-5 whitespace-nowrap text-[0.6875rem] font-medium tabular-nums",
              bar.incomeMarker > 0.8 ? "right-0.5" : "left-1/2 -translate-x-1/2",
            )}
          >
            Income {format.count(bar.income)}
          </span>
        </div>
      </div>
      <div className="h-4" />
    </div>
  );
}
