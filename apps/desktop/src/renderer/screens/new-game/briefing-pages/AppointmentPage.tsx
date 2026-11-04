import { nationPresentationOrNull } from "../../../content/presentationContent.js";
import type { PlayableSlotCountryId } from "../../../content/nationAssetManifest.js";
import { GlassCard } from "../../../components/ui/glass-card.js";
import { formatCampaignMonth } from "../../../shell/site-header-state.js";
import type { OpeningBriefingPageViewProps } from "./opening-briefing-page-views.js";

export function AppointmentPage({ projection }: OpeningBriefingPageViewProps) {
  const record = nationPresentationOrNull(projection.nationId as PlayableSlotCountryId);
  const dossier = record?.dossier;
  const flavor = record?.flavor;
  const title = dossier?.appointmentTitle ?? projection.nationName;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Appointment confirmed · {formatCampaignMonth(projection.month)}
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          You have been appointed {title} — {projection.nationName}
        </h2>
      </div>
      {flavor !== undefined && (
        <GlassCard glassVariant="liquid-refract">
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm text-muted-foreground">{flavor.military}</p>
            <p className="text-sm text-muted-foreground">{flavor.economy}</p>
            <p className="text-sm text-muted-foreground">{flavor.diplomacy}</p>
          </div>
        </GlassCard>
      )}
      {dossier !== undefined && (
        <GlassCard glassVariant="liquid-refract">
          <div className="flex flex-col gap-2 p-4">
            <p className="text-sm text-muted-foreground">{dossier.doctrine}</p>
            <p className="text-sm text-muted-foreground">{dossier.strategicRegions}</p>
            <p className="text-sm text-muted-foreground">{dossier.nationalCharacteristics}</p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
