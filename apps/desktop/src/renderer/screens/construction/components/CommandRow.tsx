import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import type { ConstructionCommand } from "@bluewave/campaign-engine";
import { Button } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import { TableCell, TableRow } from "../../../components/ui/table.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { CommandStatusBadge } from "./CommandStatusBadge.js";

export interface CommandRowProps {
  readonly command: ConstructionCommand;
  readonly busy: boolean;
  readonly selectedDesignId: string | null;
  readonly onReplace: (commandId: string) => void;
  readonly onCancel: (commandId: string) => void;
}

/** One construction command in the ledger: its design, status, cost, and actions. */
export function CommandRow({
  command,
  busy,
  selectedDesignId,
  onReplace,
  onCancel,
}: CommandRowProps) {
  const format = usePresentationFormat();
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span>{command.design.className}</span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {command.design.shipType}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <CommandStatusBadge status={command.status} />
      </TableCell>
      {DEBUG_MODE && (
        <TableCell className="font-mono text-xs text-muted-foreground">
          {command.commandId}
        </TableCell>
      )}
      {DEBUG_MODE && (
        <TableCell className="text-right font-mono text-xs">
          {command.submittedAtRevision}
        </TableCell>
      )}
      <TableCell className="text-right font-mono text-xs">
        {format.money(command.projectedCost)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {format.count(command.projectedCapacityUnits)}
      </TableCell>
      <TableCell className="text-right">
        {command.status === "submitted" && (
          <ButtonGroup className="justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReplace(command.commandId)}
              disabled={busy || selectedDesignId === null}
            >
              Replace
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancel(command.commandId)}
              disabled={busy}
            >
              Cancel
            </Button>
          </ButtonGroup>
        )}
      </TableCell>
    </TableRow>
  );
}
