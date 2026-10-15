import { Badge } from "../../../../components/ui/badge.js";
import { Button } from "../../../../components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card.js";
import { Field, FieldGroup, FieldLabel } from "../../../../components/ui/field.js";
import { Input } from "../../../../components/ui/input.js";
import { useSandbox } from "../sandbox-context.js";

export function SandboxSetupCard() {
  const { state, actions } = useSandbox();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Engagement Setup</CardTitle>
        <CardDescription>
          Choose the war to draw a battle from, then generate its manifest.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="warId">War ID</FieldLabel>
            <Input
              id="warId"
              value={state.warId}
              onChange={(event) => actions.updateWarId(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="turnCount">Tactical Turn Budget</FieldLabel>
            <Input
              id="turnCount"
              type="number"
              min={1}
              value={state.turnCount}
              onChange={(event) => actions.updateTurnCount(Number(event.target.value))}
            />
          </Field>
        </FieldGroup>

        <Button
          variant="secondary"
          size="sm"
          onClick={actions.generateBattle}
          disabled={state.busy}
        >
          Generate Engagement
        </Button>

        {state.generateError !== null && (
          <p className="rounded-md bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {state.generateError}
          </p>
        )}

        {state.manifest !== null && (
          <div className="space-y-2 rounded-md border bg-muted/10 p-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b pb-1">
              <span className="font-medium">BATTLE: {state.manifest.battleId}</span>
              <Badge variant="outline" className="font-mono text-[12px]">
                {state.manifest.missionType}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {state.manifest.sides.map((side) => (
                <div key={side.sideId}>
                  <div className="text-[12px] text-muted-foreground uppercase">
                    {side.sideId} — {side.nationId}
                  </div>
                  {side.participants.map((participant, idx) => (
                    <div key={idx} className="text-[12px]">
                      • {participant.shipId} ({participant.divisionId || "unassigned"})
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
