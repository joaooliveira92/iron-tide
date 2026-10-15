import { Play, RefreshCw } from "lucide-react";
import { Button } from "../../../../components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card.js";
import { Field, FieldLabel } from "../../../../components/ui/field.js";
import { Textarea } from "../../../../components/ui/textarea.js";
import { useSandbox } from "../sandbox-context.js";

export function SandboxResolveCard() {
  const { state, actions } = useSandbox();
  if (state.manifest === null) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Resolve</CardTitle>
        <CardDescription>
          Auto-resolve for a single deterministic outcome, or run the turn-by-turn tactical resolver
          with scripted Admiral-mode orders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={actions.autoResolve} disabled={state.busy}>
            Auto-Resolve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={actions.tacticalResolve}
            disabled={state.busy}
          >
            <Play className="h-3.5 w-3.5" />
            Run Tactical Resolver
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={actions.replayBoundary}
            disabled={state.busy}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Replay Boundary
          </Button>
        </div>

        <Field>
          <FieldLabel htmlFor="scriptedOrders">
            Scripted Orders (JSON array of RawScriptedForceOrder)
          </FieldLabel>
          <Textarea
            id="scriptedOrders"
            rows={8}
            value={state.scriptedOrdersText}
            onChange={(event) => actions.updateScriptedOrdersText(event.target.value)}
          />
        </Field>

        {state.resolveError !== null && (
          <p className="rounded-md bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {state.resolveError}
          </p>
        )}

        {state.boundaryReplayError !== null && (
          <p className="rounded-md bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {state.boundaryReplayError}
          </p>
        )}

        {state.boundaryReplay !== null && (
          <div
            className={`space-y-1 rounded-md border p-2 font-mono text-xs ${
              state.boundaryReplay.matches
                ? "border-success/30 bg-success/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            <p className={state.boundaryReplay.matches ? "text-success" : "text-destructive"}>
              Boundary {state.boundaryReplay.matches ? "MATCHES" : "DIVERGED"}
            </p>
            {state.boundaryReplay.diagnostics.map((diagnostic, idx) => (
              <p key={idx} className="text-muted-foreground">
                {diagnostic}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
