import { Badge } from "../../../../components/ui/badge.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card.js";
import { groupEventsByType } from "../../event-groups.js";
import { useSandbox } from "../sandbox-context.js";

export function SandboxEventLedger() {
  const { state } = useSandbox();
  const outcome = state.tacticalOutcome;
  if (outcome === null) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Full Event Ledger</CardTitle>
        <CardDescription>Every mechanic that fired this battle, by event type</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {groupEventsByType(outcome).map((group) => (
          <Badge key={group.eventType} variant="secondary" className="font-mono text-[12px]">
            {group.eventType} × {group.count}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}
