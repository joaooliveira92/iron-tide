import { useCallback, useMemo, useRef, useState } from "react";
import {
  PLAYABLE_SLOT_COUNTRY_IDS,
  type PlayableSlotCountryId,
} from "../../content/nationAssetManifest.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import { NationSelectionScreen } from "./nation-selection/NationSelectionScreen.js";
import { countryIdToNationId } from "./nation-selection/slotBridge.js";

export interface NewGameNationScreenProps {
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: (nationId: string) => void;
  readonly onRecommendedSetup: (nationId: string) => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

/**
 * The commissioning flow's first step: confirm a nation before any other
 * preference exists yet. Nation dossier content (the decoded presentation
 * corpus served over the content IPC) is
 * presentation-only and keyed by country id, so this screen needs no
 * `NewGameOptions`/scenario data — that's fetched later, in the Rules of the
 * Naval Age step.
 */
export function NewGameNationScreen({
  error,
  onCancel,
  onConfirm,
  onRecommendedSetup,
  onPrimaryActionChange,
}: NewGameNationScreenProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const slots = PLAYABLE_SLOT_COUNTRY_IDS;

  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const triggerConfirm = useCallback(() => {
    const countryId = slots[focusedIndex];
    const nationId = countryId === undefined ? null : countryIdToNationId(countryId);
    if (nationId !== null) onConfirmRef.current(nationId);
  }, [focusedIndex, slots]);

  const primaryAction = useMemo(
    () => ({ label: "Continue", disabled: false, onTrigger: triggerConfirm }),
    [triggerConfirm],
  );
  usePrimaryAction(primaryAction, onPrimaryActionChange);

  const handleConfirm = useCallback(
    (countryId: string) => {
      const nationId = countryIdToNationId(countryId as PlayableSlotCountryId);
      if (nationId !== null) onConfirm(nationId);
    },
    [onConfirm],
  );

  const handleRecommendedSetup = useCallback(
    (countryId: string) => {
      const nationId = countryIdToNationId(countryId as PlayableSlotCountryId);
      if (nationId !== null) onRecommendedSetup(nationId);
    },
    [onRecommendedSetup],
  );

  return (
    <div className="relative h-full flex flex-col">
      <div className="min-h-0 flex-1">
        <NationSelectionScreen
          slots={slots}
          onConfirm={handleConfirm}
          onCancel={onCancel}
          onRecommendedSetup={handleRecommendedSetup}
          focusedIndex={focusedIndex}
          onFocusChange={setFocusedIndex}
          failure={error}
        />
      </div>
    </div>
  );
}
