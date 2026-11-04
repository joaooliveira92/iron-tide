import { Button } from "../../components/ui/button.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import {
  FleetMethodDeckPane,
  FleetMethodDetailPanel,
  FleetMethodWorkspaceProvider,
  useFleetMethodWorkspace,
} from "./components/fleet-method-deck/index.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
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
  const launching = status === "launching";
  const workspace = useFleetMethodWorkspace({ initialFleetMethod, launching, onNext });
  const { activeName, detail, primaryAction } = workspace.meta;

  usePrimaryAction(primaryAction, onPrimaryActionChange);

  return (
    <NewGameScreenLayout variant="bleed">
      {error !== null && (
        <div className="flex flex-col items-start gap-6 p-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" onClick={onBack} disabled={launching}>
            Back to Identity
          </Button>
        </div>
      )}

      {error === null && detail.card !== null && (
        <FleetMethodWorkspaceProvider workspace={workspace}>
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
            <FleetMethodDeckPane />

            <section
              aria-label="Fleet method details"
              className="themed-scrollbar relative z-10 min-w-0 flex-1 lg:h-full lg:overflow-y-auto"
            >
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-8">
                <p role="status" className="text-sm text-muted-foreground">
                  Current method: <span className="font-medium text-foreground">{activeName}</span>
                </p>

                <FleetMethodDetailPanel key={detail.card.id} />

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={onBack} disabled={launching}>
                    Back to Identity
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </FleetMethodWorkspaceProvider>
      )}
    </NewGameScreenLayout>
  );
}
