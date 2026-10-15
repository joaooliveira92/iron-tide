import { useCallback, useEffect, useId, useRef, useState } from "react";
import { normalizeIndex } from "@/components/card-deck/index.js";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { nationPresentationOrNull } from "@/content/presentationContent.js";
import { playMechanicalAcoustic } from "@/shell/controller/mechanicalAcoustic.js";
import { DossierSlidePanel } from "./DossierSlidePanel/index.js";
import { FleetDispatchBoard } from "./FleetDispatchBoard.js";
import { GlobePanel } from "./GlobePanel.js";
import { TelemetryBar } from "./TelemetryBar.js";

// Hoisted static formatting utilities to prevent inline recreation
function formatCoord(decimal: number, posDir: string, negDir: string): string {
  const absolute = Math.abs(decimal);
  const deg = Math.floor(absolute);
  const min = Math.round((absolute - deg) * 60);
  const dir = decimal >= 0 ? posDir : negDir;
  return `${deg}°${String(min).padStart(2, "0")}'${dir}`;
}

/**
 * The 1880 Admiralty nation-selection surface.
 *
 * Orchestrates four sub-components:
 * - TelemetryBar: coordinate display and keyboard hints
 * - FleetDispatchBoard: nation grid selector
 * - GlobePanel: clipped globe with dossier slide panel
 * - DossierSlidePanel: nation dossier drawer
 */
export function NationSelectionScreen({
  slots,
  onConfirm,
  onCancel,
  onRecommendedSetup,
  focusedIndex,
  onFocusChange,
  failure,
}: {
  slots: readonly PlayableSlotCountryId[];
  onConfirm: (countryId: string) => void;
  onCancel: () => void;
  onRecommendedSetup: (countryId: string) => void;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  failure: string | null;
}): React.JSX.Element {
  const listboxId = useId();
  const [isDossierOpen, setDossierOpen] = useState(true);

  const slotCount = slots.length;
  const normalizedFocusedIndex = normalizeIndex(focusedIndex, slotCount);
  const focusedSlotId = slots[normalizedFocusedIndex] as PlayableSlotCountryId;
  const coords = nationPresentationOrNull(focusedSlotId)?.coordinates;

  // Stabilize external callbacks via Refs to prevent rendering stutters in child modules
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onCancelRef.current = onCancel;
  }, [onConfirm, onCancel]);

  const navigate = useCallback(
    (delta: number) => {
      onFocusChange((focusedIndex + delta + slotCount) % slotCount);
      playMechanicalAcoustic("click");
    },
    [focusedIndex, onFocusChange, slotCount],
  );

  const confirm = useCallback(
    (index: number) => {
      playMechanicalAcoustic("sonar");
      onConfirmRef.current(slots[index] as string);
    },
    [slots],
  );

  const handleSlotSelect = useCallback(
    (index: number) => {
      onFocusChange(index);
      setDossierOpen(true);
      playMechanicalAcoustic("click");
    },
    [onFocusChange],
  );

  const handleNationClick = useCallback(
    (countryId: string) => {
      const index = slots.indexOf(countryId as PlayableSlotCountryId);
      if (index >= 0) handleSlotSelect(index);
    },
    [handleSlotSelect, slots],
  );

  const handleChangeNation = useCallback(() => {
    setDossierOpen(false);
  }, []);

  const handleListboxKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        navigate(1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        navigate(-1);
        break;
      case "Enter":
        e.preventDefault();
        confirm(focusedIndex);
        break;
      case "Escape":
        e.preventDefault();
        playMechanicalAcoustic("abort");
        onCancelRef.current();
        break;
    }
  };

  const coordinateLabel =
    coords === undefined
      ? "NO TARGET"
      : `LAT ${formatCoord(coords.lat, "N", "S")} • LONG ${formatCoord(coords.lng, "E", "W")}`;

  if (slotCount === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-admiralty-surface p-8 text-center font-display text-sm uppercase tracking-widest text-admiralty-ink-muted">
        No playable nations for this scenario.
      </div>
    );
  }

  return (
    <div
      data-testid="fleet-dispatch-surface"
      className="flex h-full min-h-[44rem] w-full flex-col bg-admiralty-surface font-sans text-admiralty-ink selection:bg-admiralty-accent selection:text-admiralty-accent-foreground overflow-hidden"
      aria-labelledby="nation-selection-heading"
    >
      <TelemetryBar coordinateLabel={coordinateLabel} />

      <main
        aria-labelledby="nation-selection-heading"
        className="relative flex min-h-0 flex-1 flex-col items-stretch bg-admiralty-surface lg:flex-row lg:overflow-hidden"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage: `
              linear-gradient(to right, color-mix(in srgb, var(--color-admiralty-signal) 15%, transparent) 1px, transparent 1px),
              linear-gradient(to bottom, color-mix(in srgb, var(--color-admiralty-signal) 15%, transparent) 1px, transparent 1px)
            `,
            backgroundSize: "44px 44px",
          }}
          aria-hidden="true"
        />

        {/* Left Panel: Fleet Dispatch Board */}
        <FleetDispatchBoard
          slots={slots}
          focusedIndex={focusedIndex}
          listboxId={listboxId}
          onSelect={handleSlotSelect}
          onKeyDown={handleListboxKeyDown}
          footerChildren={
            <DossierSlidePanel
              countryId={focusedSlotId}
              isOpen={isDossierOpen}
              onChangeNation={handleChangeNation}
              onConfirm={onConfirm}
              onRecommendedSetup={onRecommendedSetup}
            />
          }
        />

        {/* Right Panel: Globe */}
        <GlobePanel focusedSlotId={focusedSlotId} onNationClick={handleNationClick} />

        {/* ── Failure Notice: surfaces a rejected campaign start (e.g. an
            unsupported nation), which otherwise fails silently on this screen
            — session.failure is only rendered back on CampaignLaunchGate's
            menu/archives phases. ── */}
        {failure && (
          <div
            role="alert"
            className="absolute inset-x-0 bottom-4 z-40 mx-auto w-full max-w-md rounded-xl border border-destructive/40 p-4 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2 font-display text-base font-bold text-destructive uppercase mb-1">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span>Admiralty Failure Dispatch</span>
            </div>
            <p className="font-display text-base text-admiralty-ink">{failure}</p>
          </div>
        )}
      </main>
    </div>
  );
}
