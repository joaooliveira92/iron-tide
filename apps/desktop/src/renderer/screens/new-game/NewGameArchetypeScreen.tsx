import type { ArchetypeSelection } from "@bluewave/campaign-engine";
import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import {
  ArchetypeDeckPane,
  ArchetypeDetailPanel,
  ArchetypeWorkspaceProvider,
  useArchetypeWorkspace,
} from "./components/archetype/index.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";

export interface NewGameArchetypeScreenProps {
  readonly initialArchetype: ArchetypeSelection | null;
  readonly onBack: () => void;
  readonly onNext: (selection: ArchetypeSelection) => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

export function NewGameArchetypeScreen({
  initialArchetype,
  onBack,
  onNext,
  onPrimaryActionChange,
}: NewGameArchetypeScreenProps) {
  const workspace = useArchetypeWorkspace({ initialArchetype, onNext });
  const { appliedName, detail, primaryAction } = workspace.meta;
  const { allocatorFocusRequest } = workspace.state;

  usePrimaryAction(primaryAction, onPrimaryActionChange);

  const detailRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (allocatorFocusRequest === 0) return;
    detailRef.current?.querySelector<HTMLInputElement>('input[type="range"]')?.focus();
  }, [allocatorFocusRequest]);

  return (
    <NewGameScreenLayout variant="bleed">
      <ArchetypeWorkspaceProvider workspace={workspace}>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
          <ArchetypeDeckPane />

          <section
            ref={detailRef}
            aria-label="Archetype details"
            className="themed-scrollbar relative z-10 min-w-0 flex-1 lg:h-full lg:overflow-y-auto"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-8">
              <p role="status" className="text-sm text-muted-foreground">
                Current archetype:{" "}
                <span className="font-medium text-foreground">{appliedName}</span>
              </p>

              <ArchetypeDetailPanel key={detail.slotId ?? "none"} />

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={onBack}>
                  Back to Preferences
                </Button>
              </div>
            </div>
          </section>
        </div>
      </ArchetypeWorkspaceProvider>
    </NewGameScreenLayout>
  );
}
