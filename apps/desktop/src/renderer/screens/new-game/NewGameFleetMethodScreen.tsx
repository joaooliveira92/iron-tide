import { useCallback, useMemo, useState } from "react";
import { Button } from "../../components/ui/button.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import {
  FleetMethodDeckPane,
  FleetMethodDetailPanel,
} from "./components/fleet-method-deck/index.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { FLEET_METHOD_CARDS } from "./fleet-method-content.js";
import type { FleetMethodDraft } from "./new-game-fleet-method-screen-state.js";

export interface NewGameFleetMethodScreenProps {
  readonly initialFleetMethod: FleetMethodDraft;
  readonly status: "ready" | "launching";
  readonly error: string | null;
  readonly onBack: () => void;
  readonly onNext: (fleetMethod: FleetMethodDraft) => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

export function NewGameFleetMethodScreen({
  initialFleetMethod,
  status,
  error,
  onBack,
  onNext,
  onPrimaryActionChange,
}: NewGameFleetMethodScreenProps) {
  const [fleetMethod, setFleetMethod] = useState<FleetMethodDraft>(initialFleetMethod);
  const launching = status === "launching";

  const [pendingFleetMethodId, setPendingFleetMethodId] = useState<string | null>(null);

  const [focusOverride, setFocusOverride] = useState<number | null>(null);
  const activeIndex = FLEET_METHOD_CARDS.findIndex(
    (card) => card.id === fleetMethod.legacyFleetModeId,
  );
  const focusedIndex = focusOverride ?? Math.max(0, activeIndex);

  const focusedCard = FLEET_METHOD_CARDS[focusedIndex] ?? FLEET_METHOD_CARDS[0];
  const activeCardName =
    FLEET_METHOD_CARDS.find((card) => card.id === fleetMethod.legacyFleetModeId)?.title ?? "";

  const onFocusIndex = useCallback((index: number) => {
    setFocusOverride(index);
    setPendingFleetMethodId(FLEET_METHOD_CARDS[index]?.id ?? null);
  }, []);

  const handleSelectMethod = useCallback((cardId: string) => {
    setFleetMethod({ legacyFleetModeId: cardId });
    setPendingFleetMethodId(null);
  }, []);

  const needsSelect =
    pendingFleetMethodId !== null && pendingFleetMethodId !== fleetMethod.legacyFleetModeId;

  const handleNext = useCallback(() => {
    if (launching) return;
    if (needsSelect && pendingFleetMethodId !== null) {
      setFleetMethod({ legacyFleetModeId: pendingFleetMethodId });
      setPendingFleetMethodId(null);
      return;
    }
    onNext(fleetMethod);
  }, [launching, fleetMethod, pendingFleetMethodId, needsSelect, onNext]);

  const primaryAction = useMemo(
    () => ({
      label: needsSelect ? "Select" : launching ? "Starting…" : "Next: Review Campaign",
      disabled: launching,
      onTrigger: handleNext,
    }),
    [launching, handleNext, needsSelect],
  );
  usePrimaryAction(primaryAction, onPrimaryActionChange);

  return (
    <NewGameScreenLayout fullBleed>
      {error !== null && (
        <div className="flex flex-col items-start gap-6 p-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" onClick={onBack} disabled={launching}>
            Back to Identity
          </Button>
        </div>
      )}

      {error === null && focusedCard !== undefined && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
          <FleetMethodDeckPane
            activeId={fleetMethod.legacyFleetModeId}
            focusedIndex={focusedIndex}
            onFocusIndex={onFocusIndex}
            onSelectMethod={handleSelectMethod}
          />

          <section
            aria-label="Fleet method details"
            className="themed-scrollbar relative z-10 min-w-0 flex-1 lg:h-full lg:overflow-y-auto"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-8">
              <p role="status" className="text-sm text-muted-foreground">
                Current method:{" "}
                <span className="font-medium text-foreground">{activeCardName}</span>
              </p>

              <FleetMethodDetailPanel
                key={focusedCard.id}
                card={focusedCard}
                applied={focusedCard.id === fleetMethod.legacyFleetModeId}
                pending={
                  pendingFleetMethodId === focusedCard.id &&
                  focusedCard.id !== fleetMethod.legacyFleetModeId
                }
              />

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={onBack} disabled={launching}>
                  Back to Identity
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </NewGameScreenLayout>
  );
}
