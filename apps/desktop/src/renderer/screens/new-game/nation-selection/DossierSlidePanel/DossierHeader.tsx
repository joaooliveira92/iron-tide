import { Anchor } from "lucide-react";
import type { JSX } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card.js";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { NationEmblem } from "./NationEmblem.js";
import { getCountryCode } from "./nationArtwork.js";

interface DossierHeaderProps {
  countryId: PlayableSlotCountryId;
  nationName: string;
  appointmentTitle: string;
}

export function DossierHeader({
  countryId,
  nationName,
  appointmentTitle,
}: DossierHeaderProps): JSX.Element {
  const appointmentMessage = `You have been appointed ${appointmentTitle}`;

  return (
    <header className="relative flex items-center gap-3 border-b border-admiralty-accent/25 bg-admiralty-surface-raised/80 px-3 py-3 backdrop-blur-md sm:gap-4 sm:px-4">
      <HoverCard>
        <HoverCardTrigger
          render={<span tabIndex={0} />}
          aria-label={appointmentMessage}
          className="inline-flex flex-none cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-admiralty-accent"
        >
          <NationEmblem countryId={countryId} />
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-auto max-w-64 px-3 py-1.5 text-xs leading-snug">
          {appointmentMessage}
        </HoverCardContent>
      </HoverCard>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-display text-[0.58rem] uppercase tracking-[0.2em] text-admiralty-accent/80">
          <Anchor className="h-3 w-3 shrink-0" aria-hidden="true" />
          Fleet record
        </p>
        <h3
          id={`nation-dossier-heading-${countryId}`}
          className="mt-0.5 line-clamp-2 text-balance font-display text-base font-black uppercase leading-tight tracking-[0.08em] text-admiralty-ink sm:text-lg"
        >
          {nationName}
        </h3>
      </div>
      <span className="inline-flex shrink-0 items-center rounded-sm border border-admiralty-accent/40 bg-admiralty-accent/10 px-1.5 py-0.5 font-display text-[0.6rem] font-black uppercase tracking-[0.2em] text-admiralty-accent">
        {getCountryCode(countryId)}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-admiralty-accent/60 to-transparent"
      />
    </header>
  );
}
