import { ChevronDown } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import {
  attitudeLabel,
  statusLabel,
  tierDescription,
  tierTitle,
  worldText,
} from "../world-situation-copy.js";
import { OUTLOOK_TONE } from "../world-situation-presentation.js";
import {
  adjacentPowerId,
  type PowerBrief,
  type PowerGroup as PowerGroupModel,
  type RelevanceTier,
} from "../world-situation.js";
import { NationGlyph } from "./NationGlyph.js";
import { OutlookBadge } from "./RelationshipStatus.js";

type CardDensity = "feature" | "standard" | "dense";

const DENSITY_BY_TIER: Readonly<Record<RelevanceTier, CardDensity>> = {
  immediate: "feature",
  wide_reach: "standard",
  distant: "dense",
};

const COLLAPSIBLE_TIERS: ReadonlySet<RelevanceTier> = new Set<RelevanceTier>(["distant"]);

export interface PowerSummaryCardProps {
  readonly power: PowerBrief;
  readonly density: CardDensity;
  readonly selected: boolean;
  readonly tabbable: boolean;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly buttonRef: (element: HTMLButtonElement | null) => void;
}

export function PowerSummaryCard({
  power,
  density,
  selected,
  tabbable,
  onSelect,
  onKeyDown,
  buttonRef,
}: PowerSummaryCardProps) {
  const tone = OUTLOOK_TONE[power.outlook];
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-current={selected ? "true" : undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        "group flex w-full items-center gap-3 border-l-4 text-left outline-none",
        "motion-safe:transition-colors motion-safe:duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        density === "feature" && "rounded-r-md px-3 py-2.5",
        density === "standard" && "rounded-r-md px-3 py-2",
        density === "dense" && "rounded-r-sm px-3 py-1.5",
        selected
          ? cn("bg-background/40 shadow-sm ring-1 ring-primary/50", tone.rule)
          : "border-l-transparent hover:bg-muted/60",
      )}
    >
      <NationGlyph
        nationId={power.nationId}
        name={power.name}
        className={density === "dense" ? "h-5 w-7" : undefined}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate font-semibold text-foreground",
            density === "dense" ? "text-sm" : "text-[0.95rem]",
          )}
        >
          {power.name}
        </span>
        {density !== "dense" && (
          <span className="truncate text-xs text-muted-foreground">
            {statusLabel(power.status)} · {attitudeLabel(power.attitude)}
          </span>
        )}
      </span>
      <OutlookBadge outlook={power.outlook} className="shrink-0" />
      {selected && <span className="sr-only">{worldText("navigator.selected")}</span>}
    </button>
  );
}

export interface PowerNavigatorProps {
  readonly groups: readonly PowerGroupModel[];
  readonly selectedId: string | null;
  readonly onSelect: (nationId: string) => void;
  readonly renderDossier: (power: PowerBrief) => ReactNode;
}

export function PowerNavigator({
  groups,
  selectedId,
  onSelect,
  renderDossier,
}: PowerNavigatorProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<RelevanceTier>>(new Set());
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const isOpen = (tier: RelevanceTier): boolean =>
    !COLLAPSIBLE_TIERS.has(tier) || expanded.has(tier);
  const visible = groups.filter((group) => isOpen(group.tier)).flatMap((group) => group.powers);
  const tabStopId =
    visible.find((power) => power.nationId === selectedId)?.nationId ??
    visible[0]?.nationId ??
    null;

  const move = (event: KeyboardEvent<HTMLButtonElement>, current: string) => {
    const step =
      event.key === "ArrowDown"
        ? "next"
        : event.key === "ArrowUp"
          ? "previous"
          : event.key === "Home"
            ? "first"
            : event.key === "End"
              ? "last"
              : null;
    if (step === null) return;
    event.preventDefault();
    const target = adjacentPowerId(visible, current, step);
    if (target === null) return;
    onSelect(target);
    buttons.current.get(target)?.focus();
  };

  const toggle = (tier: RelevanceTier) => {
    const opening = !expanded.has(tier);
    const next = new Set(expanded);
    if (opening) next.add(tier);
    else {
      next.delete(tier);
      const group = groups.find((candidate) => candidate.tier === tier);
      const hidesSelection = group?.powers.some((power) => power.nationId === selectedId) ?? false;
      const fallback = groups.find(
        (candidate) => isOpen(candidate.tier) && candidate.tier !== tier,
      );
      if (hidesSelection && fallback?.powers[0] !== undefined)
        onSelect(fallback.powers[0].nationId);
    }
    setExpanded(next);
  };

  return (
    <nav aria-labelledby="world-navigator-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="world-navigator-heading" className="text-lg font-semibold text-foreground">
          {worldText("navigator.heading")}
        </h2>
        <p className="text-xs text-muted-foreground">{worldText("navigator.hint")}</p>
      </div>
      {groups.map((group) => {
        const density = DENSITY_BY_TIER[group.tier];
        const listId = `world-tier-${group.tier}`;
        const open = isOpen(group.tier);
        const collapsible = COLLAPSIBLE_TIERS.has(group.tier);
        return (
          <section
            key={group.tier}
            aria-labelledby={`${listId}-title`}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1">
              <div>
                <h3
                  id={`${listId}-title`}
                  className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {tierTitle(group.tier)}
                </h3>
                <p className="text-xs text-muted-foreground">{tierDescription(group.tier)}</p>
              </div>
              {collapsible && (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => toggle(group.tier)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 text-xs font-medium text-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {open
                    ? worldText("navigator.collapse")
                    : worldText("navigator.expand", { count: group.powers.length })}
                  <ChevronDown
                    className={cn(
                      "size-3.5 motion-safe:transition-transform motion-safe:duration-150",
                      open && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
            <ul id={listId} hidden={!open} className="flex flex-col gap-1">
              {open &&
                group.powers.map((power) => (
                  <li key={power.nationId}>
                    <PowerSummaryCard
                      power={power}
                      density={density}
                      selected={power.nationId === selectedId}
                      tabbable={power.nationId === tabStopId}
                      onSelect={() => onSelect(power.nationId)}
                      onKeyDown={(event) => move(event, power.nationId)}
                      buttonRef={(element) => {
                        if (element === null) buttons.current.delete(power.nationId);
                        else buttons.current.set(power.nationId, element);
                      }}
                    />
                    {power.nationId === selectedId && (
                      <div className="mt-1.5 mb-2">{renderDossier(power)}</div>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
