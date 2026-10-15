import { Anchor, Coins, Scroll } from "lucide-react";
import { type JSX, type KeyboardEvent, useMemo, useRef, useState } from "react";
import { createHoverCardHandle, HoverCard, HoverCardContent } from "@/components/ui/hover-card.js";
import { cn } from "@/lib/utils.js";
import { ACCENT_STYLES } from "./constants.js";
import { DossierAccordionItem } from "./DossierAccordionItem.js";
import type { DossierSection, DossierSectionId } from "./types.js";

interface DossierAccordionProps {
  economy: React.ReactNode;
  military: React.ReactNode;
  diplomacy: React.ReactNode;
}

const isSectionId = (value: string | undefined): value is DossierSectionId =>
  value === "economy" || value === "military" || value === "diplomacy";

/**
 * The dossier's three intelligence sections as a hover strip. Each tab opens one shared card
 * (Base UI's detached-handle preview card) rather than expanding a fixed-height inline panel, so
 * moving between sections swaps the card's content and nothing ever needs to be scrolled. Hover,
 * keyboard focus and a click/tap all open it; Escape or a press outside closes it.
 *
 * Base UI owns whether the card is open and for which tab. `active` only mirrors that for the
 * tabs' ARIA state: feeding it back as a controlled `open`/`triggerId` raced the hover delays and
 * left the wrong card (or none) showing.
 */
export function DossierAccordion({
  economy,
  military,
  diplomacy,
}: DossierAccordionProps): JSX.Element {
  const [handle] = useState(() => createHoverCardHandle<DossierSectionId>());
  const [active, setActive] = useState<DossierSectionId | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const sections = useMemo<DossierSection[]>(
    () => [
      { id: "economy", label: "Economy", text: economy, icon: Coins, accent: "gold" },
      { id: "military", label: "Military", text: military, icon: Anchor, accent: "red" },
      { id: "diplomacy", label: "Diplomacy", text: diplomacy, icon: Scroll, accent: "blue" },
    ],
    [economy, military, diplomacy],
  );

  const triggerId = (id: DossierSectionId): string => `dossier-${id}-trigger`;

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, index: number): void => {
    let target: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      target = (index + 1) % sections.length;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      target = (index - 1 + sections.length) % sections.length;
    }

    if (event.key === "Home") target = 0;
    if (event.key === "End") target = sections.length - 1;

    if (target !== null) {
      event.preventDefault();
      const next = sections[target];
      if (next !== undefined) document.getElementById(triggerId(next.id))?.focus();
    }
  };

  return (
    <div className="relative">
      <div
        ref={stripRef}
        role="group"
        aria-label="Nation dossier sections"
        className="grid grid-cols-3 items-stretch gap-2 border-t border-admiralty-border/60 bg-admiralty-surface-raised/80 px-3 py-3 backdrop-blur-md sm:px-4"
      >
        {sections.map((section, index) => (
          <DossierAccordionItem
            key={section.id}
            section={section}
            active={active === section.id}
            handle={handle}
            onSelect={() => handle.open(triggerId(section.id))}
            onKeyDown={(event) => handleKeyDown(event, index)}
          />
        ))}
      </div>

      <HoverCard
        handle={handle}
        onOpenChange={(open, details) => {
          const id =
            details.trigger instanceof HTMLElement
              ? details.trigger.dataset["dossierSection"]
              : undefined;
          // The tab just left still has its close timer running when the pointer lands on the
          // next one; that stale hover-close must not take down the card the new tab opened.
          if (
            !open &&
            details.reason === "trigger-hover" &&
            stripRef.current?.querySelector("[data-dossier-section]:hover") != null
          ) {
            details.cancel();
            return;
          }
          if (!open) setActive(null);
          else if (isSectionId(id)) setActive(id);
        }}
      >
        {({ payload }) => {
          const section = sections.find((candidate) => candidate.id === payload);
          if (section === undefined) return null;
          const Icon = section.icon;
          const accent = ACCENT_STYLES[section.accent];
          return (
            <HoverCardContent
              id={`dossier-${section.id}-panel`}
              side="top"
              align="center"
              sideOffset={8}
              collisionPadding={12}
              anchor={stripRef}
              className="w-(--anchor-width) min-w-72 max-w-[calc(100vw-1.5rem)] max-h-[min(70vh,var(--available-height))] overflow-y-auto overscroll-contain rounded-lg border border-admiralty-accent/30 bg-admiralty-surface-raised p-0 text-admiralty-ink shadow-[0_18px_60px_rgba(0,0,0,0.45)] motion-reduce:animate-none"
            >
              <div
                className={cn(
                  "sticky top-0 flex items-center gap-2 border-b px-4 py-2.5 backdrop-blur-md",
                  accent.border,
                  accent.bg,
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", accent.text)} aria-hidden="true" />
                <span
                  className={cn(
                    "font-display text-[0.7rem] font-black uppercase tracking-[0.18em]",
                    accent.text,
                  )}
                >
                  {section.label}
                </span>
                <span className="ml-auto font-display text-[0.55rem] uppercase tracking-[0.18em] text-admiralty-ink-faint">
                  Intelligence
                </span>
              </div>
              <div className="px-4 py-3.5">{section.text}</div>
            </HoverCardContent>
          );
        }}
      </HoverCard>
    </div>
  );
}
