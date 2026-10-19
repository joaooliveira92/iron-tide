import { type ReactNode, type RefObject, useId, useRef, useState } from "react";
import {
  createHoverCardHandle,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../ui/hover-card.js";
import { cn } from "../../../../lib/utils.js";
import { useSelectionStore, useShipSelection } from "../../selection/useShipSelection.js";
import { SECTION_IDS, SECTIONS, sectionSpan, type SectionId, type ZoneRange } from "./sections.js";

/** Rest before a card opens, so sweeping the pointer across the strip opens nothing (ms). */
export const SECTION_OPEN_DELAY = 200;
/** Grace before a card closes, long enough to move the pointer from a label into its card (ms). */
export const SECTION_CLOSE_DELAY = 300;

const isSectionId = (v: string | undefined): v is SectionId =>
  (SECTION_IDS as readonly string[]).includes(v ?? "");

/**
 * The section names under the plan, one button per section placed over that section's span, alternating
 * between two rows so neighbouring names never collide. All eight share one hover card: moving between labels
 * swaps its content instead of closing and re-opening it. Hover and keyboard focus open it (a preview). A click,
 * tap or Enter/Space selects and pins the section (`aria-pressed`) and closes the preview: the pinned section's
 * details are in the inspector above the tabs, so touch users never need hover. Both states live in the board's
 * selection store.
 */
export function SectionLabels({
  zones,
  renderCard,
  anchor,
  numbered = false,
}: {
  readonly zones: readonly ZoneRange[];
  readonly renderCard: (id: SectionId) => ReactNode;
  /**
   * What the card is placed beside: the whole drawing, so the open card never covers the plan, its highlight or
   * the neighbouring labels (which the pointer may be heading for).
   */
  readonly anchor?: RefObject<HTMLElement | null>;
  /** Prefix each name with its bow-to-stern number, to match the numbers on the Compartments view. */
  readonly numbered?: boolean;
}) {
  const [handle] = useState(() => createHoverCardHandle<SectionId>());
  // The open card is the selection store's `preview`; a click or Enter/Space also pins the section (`selected`).
  const store = useSelectionStore();
  const active = useShipSelection((s) => s.preview);
  const selected = useShipSelection((s) => (s.selected?.kind === "section" ? s.selected.id : null));
  const onActiveChange = store.setPreview;
  // The label just clicked: its hover open (already counting down when the click lands) is ignored until the
  // pointer leaves it, so the card never reappears over the inspector that now shows the same section.
  const pinnedUnderPointer = useRef<SectionId | null>(null);
  const prefix = useId();
  const triggerId = (id: SectionId) => `${prefix}-section-${id}`;
  const spans = SECTION_IDS.map((id) => {
    const zone = zones.find((z) => z.id === SECTIONS[id].zoneId);
    return { id, span: zone ? sectionSpan(zone) : undefined };
  });
  // Without the hull form's zones there is no geometry to align to: lay the labels out evenly instead.
  const aligned = spans.every((s) => s.span !== undefined);
  return (
    <>
      <div
        role="group"
        aria-label="Hull sections"
        className={cn("@container", aligned ? "relative h-15" : "grid grid-cols-4 gap-1")}
        data-testid="section-labels"
        data-aligned={aligned}
      >
        {spans.map(({ id, span }, i) => {
          const meta = SECTIONS[id];
          return (
            <HoverCardTrigger
              key={id}
              id={triggerId(id)}
              handle={handle}
              payload={id}
              delay={SECTION_OPEN_DELAY}
              closeDelay={SECTION_CLOSE_DELAY}
              render={
                <button
                  type="button"
                  aria-label={meta.name}
                  data-section={id}
                  aria-pressed={selected === id}
                  onClick={() => {
                    // Pinning hands the details to the inspector beside the tabs; the preview card closes so
                    // it never covers them. Hover and focus still preview.
                    store.select({ kind: "section", id });
                    pinnedUnderPointer.current = id;
                    onActiveChange(null);
                  }}
                  onPointerLeave={() => {
                    if (pinnedUnderPointer.current === id) pinnedUnderPointer.current = null;
                  }}
                  style={
                    aligned && span
                      ? {
                          left: `${span.leftPct + span.widthPct / 2}%`,
                          width: `max(${span.widthPct}%, 2.75rem)`,
                          top: i % 2 === 0 ? 0 : "1.875rem",
                        }
                      : undefined
                  }
                  className={cn(
                    "h-7 cursor-pointer whitespace-nowrap rounded-sm border-t-2 border-muted-foreground/40 px-1 text-xs text-muted-foreground",
                    "hover:bg-muted hover:text-foreground",
                    "outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    "data-popup-open:border-primary data-popup-open:bg-primary/10 data-popup-open:text-foreground",
                    // Pinned: solid accent bar, bold and underlined (not colour alone).
                    "aria-pressed:border-primary aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:underline aria-pressed:decoration-2 aria-pressed:underline-offset-4",
                    aligned && "absolute -translate-x-1/2",
                  )}
                />
              }
            >
              {numbered && (
                <span aria-hidden="true" className="mr-1 font-semibold text-foreground">
                  {i + 1}
                </span>
              )}
              <span className="@[40rem]:hidden">{meta.shortLabel}</span>
              <span className="hidden @[40rem]:inline">{meta.name}</span>
            </HoverCardTrigger>
          );
        })}
      </div>
      <HoverCard
        handle={handle}
        open={active !== null}
        triggerId={active === null ? null : triggerId(active)}
        onOpenChange={(open, details) => {
          const id =
            details.trigger instanceof HTMLElement ? details.trigger.dataset["section"] : undefined;
          if (open && id !== undefined && id === pinnedUnderPointer.current) return;
          onActiveChange(open && isSectionId(id) ? id : open ? active : null);
        }}
      >
        {({ payload }) => (
          <HoverCardContent
            side="right"
            align="start"
            sideOffset={12}
            anchor={anchor}
            collisionPadding={12}
            className="@container max-h-[var(--available-height)] w-[min(36rem,calc(100vw-1.5rem))] overflow-y-auto overflow-x-hidden p-0 motion-reduce:animate-none"
          >
            {payload !== undefined && renderCard(payload)}
          </HoverCardContent>
        )}
      </HoverCard>
    </>
  );
}
