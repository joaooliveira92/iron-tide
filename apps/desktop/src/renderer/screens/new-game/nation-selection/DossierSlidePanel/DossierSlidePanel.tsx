import type { JSX } from "react";
import { SlidePanel } from "@/components/slide-panel/index.js";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { nationDossier, nationFlavor } from "@/content/presentationContent.js";
import { DossierAccordion } from "./DossierAccordion/index.js";
import { DossierCover } from "./DossierCover.js";
import { DossierHeader } from "./DossierHeader.js";
import { buildDossierTabs } from "./DossierTabContent.js";

export interface DossierSlidePanelProps {
  countryId: PlayableSlotCountryId;
  isOpen: boolean;
  onChangeNation: () => void;
  onConfirm: (countryId: PlayableSlotCountryId) => void;
  onRecommendedSetup: (countryId: PlayableSlotCountryId) => void;
}

export function DossierSlidePanel({
  countryId,
  isOpen,
}: DossierSlidePanelProps): JSX.Element | null {
  const flavor = nationFlavor(countryId);
  const fields = nationDossier(countryId);
  const tabs = buildDossierTabs(countryId, flavor);

  return (
    <SlidePanel isOpen={isOpen} aria-labelledby={`nation-dossier-heading-${countryId}`}>
      <div className="relative isolate min-w-0 overflow-hidden border-t border-admiralty-accent/40 bg-admiralty-surface-raised/70 shadow-[0_-24px_70px_rgba(0,0,0,0.72),0_0_0_1px_color-mix(in_srgb,var(--color-admiralty-accent)_8%,transparent)] backdrop-blur-md supports-[backdrop-filter]:bg-admiralty-surface-raised/60">
        <DossierCover countryId={countryId} />
        <DossierHeader
          countryId={countryId}
          nationName={flavor.name}
          appointmentTitle={fields.appointmentTitle}
        />
        <DossierAccordion
          economy={tabs.economy}
          military={tabs.military}
          diplomacy={tabs.diplomacy}
        />
      </div>
    </SlidePanel>
  );
}
