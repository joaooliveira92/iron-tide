import type { JSX } from "react";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";

import { GLOBE_TRANSITION_MS, useArmedAfterMount } from "./globeHandoffTransition.js";
import { InteractiveGlobe } from "./InteractiveGlobe.js";

interface GlobePanelProps {
  focusedSlotId: PlayableSlotCountryId;
  onNationClick: (countryId: string) => void;
}

const TARGETING_BEZEL = (
  <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
    <div className="absolute left-6 top-6 h-8 w-8 border-l border-t border-admiralty-signal/25" />
    <div className="absolute right-6 top-6 h-8 w-8 border-r border-t border-admiralty-signal/25" />
    <div className="absolute bottom-6 left-6 h-8 w-8 border-b border-l border-admiralty-signal/25" />
    <div className="absolute bottom-6 right-6 h-8 w-8 border-b border-r border-admiralty-signal/25" />
  </div>
);

export function GlobePanel({ focusedSlotId, onNationClick }: GlobePanelProps): JSX.Element {
  // Fades the interactive globe in on mount so the viewport settles rather than
  // snapping in at full opacity.
  const globeVisible = useArmedAfterMount(true);

  return (
    <section
      data-testid="globe-panel"
      aria-label="Nation details"
      className="
        relative z-10
        h-full min-h-0 min-w-0
        flex-1 overflow-hidden
        bg-admiralty-surface
      "
    >
      {/* Globe viewport */}
      <div className="absolute inset-0 min-h-0 min-w-0 overflow-hidden">
        {TARGETING_BEZEL}

        <div
          className={`absolute inset-0 transition-opacity ease-out ${globeVisible ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDuration: `${GLOBE_TRANSITION_MS}ms` }}
        >
          <InteractiveGlobe focusedCountryId={focusedSlotId} onNationClick={onNationClick} />
        </div>
      </div>
    </section>
  );
}
