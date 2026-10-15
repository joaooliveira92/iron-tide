import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import type { DivisionCommandBody } from "../../../../shared/division-contract.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { useDivisionOrganization } from "../hooks/useDivisionOrganization.js";
import { CreateDivisionForm } from "./CreateDivisionForm.js";
import { DivisionCard } from "./DivisionCard.js";
import type { DivisionOrganizationState } from "./division-organization-state.js";

export interface FleetOrganizationViewProps {
  readonly state: DivisionOrganizationState;
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly outcomeUnknown: boolean;
  readonly onRetry: () => void;
  readonly onReload: () => void;
  readonly send: (command: DivisionCommandBody) => Promise<CommandOutcome>;
}

/** Presentational Fleet organization: divisions, the create form, and honest status. */
export function FleetOrganizationView({
  state,
  loadError,
  busy,
  outcomeUnknown,
  onRetry,
  onReload,
  send,
}: FleetOrganizationViewProps) {
  return (
    <section className="space-y-4" data-testid="fleet-organization">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Fleet organization</h3>
        <Badge variant="secondary" className="text-xs">
          {state.divisions.length}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Divisions fight together and build experience and cohesion. Changes are queued and applied
        by the engine when you advance the month; reorganizing costs experience and cohesion.
      </p>

      {loadError !== null && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/50 p-3 text-sm">
          <p className="whitespace-pre-line text-destructive">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={onReload}>
            Reload
          </Button>
        </div>
      )}

      {state.notice !== null && (
        <div role="status" className="space-y-2 rounded-md border px-3 py-2 text-sm">
          <p className="whitespace-pre-line">{state.notice}</p>
          {state.requiresRefresh && (
            <Button type="button" size="sm" variant="outline" onClick={onReload}>
              Refresh
            </Button>
          )}
        </div>
      )}

      {outcomeUnknown && (
        <div role="alert" className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span>The last command may not have reached the engine.</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {state.divisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No divisions yet. Found one from a commissioned ship below.
        </p>
      ) : (
        <div className="space-y-3">
          {state.divisions.map((division) => (
            <DivisionCard
              key={division.divisionId}
              division={division}
              state={state}
              busy={busy}
              send={send}
            />
          ))}
        </div>
      )}

      <CreateDivisionForm state={state} busy={busy} send={send} />
    </section>
  );
}

/** Fleet organization wired to the session: loads the view and queues engine commands. */
export function FleetOrganizationSection({ sessionId }: { readonly sessionId: string }) {
  const organization = useDivisionOrganization(sessionId);
  return (
    <FleetOrganizationView
      state={organization.state}
      loadError={organization.loadError}
      busy={organization.busy}
      outcomeUnknown={organization.request.outcomeUnknown}
      onRetry={organization.request.retry}
      onReload={() => void organization.loadScreen()}
      send={organization.send}
    />
  );
}
