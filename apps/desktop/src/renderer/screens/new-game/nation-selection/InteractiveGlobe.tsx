import { type JSX, useRef, useState } from "react";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";

import { attachGlobeInteractions } from "./globeInteractions.js";
import { globePins } from "./globePins.js";
import { GlobeShell } from "./GlobeShell.js";
import { useSvgGlobe } from "./useSvgGlobe.js";

export interface InteractiveGlobeProps {
  readonly focusedCountryId?: PlayableSlotCountryId | null;
  readonly onNationClick?: (countryId: string) => void;
}

export function InteractiveGlobe({
  focusedCountryId,
  onNationClick,
}: InteractiveGlobeProps): JSX.Element {
  const [{ points, colors }] = useState(globePins);
  const focusedRef = useRef(focusedCountryId);
  const onNationClickRef = useRef(onNationClick);
  focusedRef.current = focusedCountryId;
  onNationClickRef.current = onNationClick;

  const globe = useSvgGlobe((handles, container) =>
    attachGlobeInteractions(handles, container, { points, colors, focusedRef, onNationClickRef }),
  );

  return <GlobeShell refs={globe} />;
}
