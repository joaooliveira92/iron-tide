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

export const SECTION_OPEN_DELAY = 200;
export const SECTION_CLOSE_DELAY = 300;

const isSectionId = (v: string | undefined): v is SectionId =>
  (SECTION_IDS as readonly string[]).includes(v ?? "");

const LABEL_EDGE_ROOM = "3.25rem";

export function labelPlacement(span: { readonly leftPct: number; readonly widthPct: number }): {
  readonly left: string;
  readonly width: string;
} {
  const pct = (n: number) => Math.round(n * 1000) / 1000;
  const half = `max(${pct(span.widthPct / 2)}%, ${LABEL_EDGE_ROOM})`;
  return {
    left: `min(${pct(span.leftPct + span.widthPct / 2)}%, calc(100% - ${half}))`,
    width: `max(${pct(span.widthPct)}%, 2.75rem)`,
  };
}

export function SectionLabels({
  zones,
  renderCard,
  anchor,
  numbered = false,
}: {
  readonly zones: readonly ZoneRange[];
  readonly renderCard: (id: SectionId) => ReactNode;
  readonly anchor?: RefObject<HTMLElement | null>;
  readonly numbered?: boolean;
}) {
  const [handle] = useState(() => createHoverCardHandle<SectionId>());
  const store = useSelectionStore();
  const active = useShipSelection((s) => s.preview);
  const selected = useShipSelection((s) => (s.selected?.kind === "section" ? s.selected.id : null));
  const onActiveChange = store.setPreview;
  const pinnedUnderPointer = useRef<SectionId | null>(null);
  const prefix = useId();
  const triggerId = (id: SectionId) => `${prefix}-section-${id}`;
  const spans = SECTION_IDS.map((id) => {
    const zone = zones.find((z) => z.id === SECTIONS[id].zoneId);
    return { id, span: zone ? sectionSpan(zone) : undefined };
  });
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
                          ...labelPlacement(span),
                          top: i % 2 === 0 ? 0 : "1.875rem",
                        }
                      : undefined
                  }
                  className={cn(
                    "h-7 cursor-pointer whitespace-nowrap rounded-sm border-t-2 border-muted-foreground/40 px-1 text-xs text-muted-foreground",
                    "hover:bg-muted hover:text-foreground",
                    "outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    "data-popup-open:border-primary data-popup-open:bg-primary/10 data-popup-open:text-foreground",
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
