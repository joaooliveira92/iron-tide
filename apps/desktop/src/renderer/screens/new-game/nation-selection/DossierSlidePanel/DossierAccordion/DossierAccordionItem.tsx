import { type KeyboardEvent } from "react";
import { type HoverCardHandle, HoverCardTrigger } from "@/components/ui/hover-card.js";
import { cn } from "@/lib/utils.js";
import { ACCENT_STYLES, DOSSIER_CLOSE_DELAY, DOSSIER_OPEN_DELAY } from "./constants.js";
import type { DossierSection, DossierSectionId } from "./types.js";

export interface DossierAccordionItemProps {
  readonly section: DossierSection;
  readonly active: boolean;
  readonly handle: HoverCardHandle<DossierSectionId>;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export function DossierAccordionItem({
  section,
  active,
  handle,
  onSelect,
  onKeyDown,
}: DossierAccordionItemProps) {
  const Icon = section.icon;
  const accent = ACCENT_STYLES[section.accent];
  const triggerId = `dossier-${section.id}-trigger`;
  const panelId = `dossier-${section.id}-panel`;

  return (
    <HoverCardTrigger
      id={triggerId}
      handle={handle}
      payload={section.id}
      delay={DOSSIER_OPEN_DELAY}
      closeDelay={DOSSIER_CLOSE_DELAY}
      data-dossier-section={section.id}
      aria-label={section.label}
      aria-expanded={active}
      aria-controls={active ? panelId : undefined}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      render={<button type="button" />}
      className={cn(
        "group flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-md border px-2 py-2 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-admiralty-accent",
        active
          ? cn(accent.border, accent.bg)
          : "border-admiralty-border/70 bg-admiralty-surface/50 hover:border-admiralty-border hover:bg-admiralty-ink/[0.05]",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", accent.text)} aria-hidden="true" />
      <span
        className={cn(
          "truncate font-display text-[0.68rem] font-black uppercase tracking-[0.16em]",
          accent.text,
        )}
      >
        {section.label}
      </span>
    </HoverCardTrigger>
  );
}
