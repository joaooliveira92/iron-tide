import { memo } from "react";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import type { ConstructionCommand } from "@bluewave/campaign-engine";
import { Button } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ConstructionScreenProjection } from "../../../../shared/construction-contract.js";
import { CommandStatusBadge } from "./CommandStatusBadge.js";
import { Meter } from "./Meter.js";
import { Peek, PeekRows } from "./Peek.js";

export interface OrdersStageProps {
  readonly commands: readonly ConstructionCommand[];
  readonly economy: ConstructionScreenProjection["economy"];
  readonly busy: boolean;
  readonly selectedDesignId: string | null;
  readonly selectedCommandId: string | null;
  readonly onSelectCommand: (commandId: string) => void;
  readonly onReplace: (commandId: string) => void;
  readonly onCancel: (commandId: string) => void;
  readonly onBrowseCatalog: () => void;
}

const OrderRow = memo(function OrderRow({
  command,
  economy,
  busy,
  selectedDesignId,
  selected,
  onSelectCommand,
  onReplace,
  onCancel,
}: Omit<OrdersStageProps, "commands" | "selectedCommandId" | "onBrowseCatalog"> & {
  readonly command: ConstructionCommand;
  readonly selected: boolean;
}) {
  const format = usePresentationFormat();
  const live = command.status === "submitted";
  const treasuryShare = economy.treasury > 0 ? (command.projectedCost / economy.treasury) * 100 : 0;
  return (
    <TableRow data-selected={selected} className={cn(selected && "bg-accent/50")}>
      <TableCell className="font-medium">
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => onSelectCommand(command.commandId)}
          className="flex flex-col rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{command.design.className}</span>
          <span className="text-xs text-muted-foreground">{command.design.shipType}</span>
        </button>
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
      <TableCell className="w-44 text-right">
        <Peek
          side="top"
          trigger={
            <span
              tabIndex={0}
              className="block space-y-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block font-mono text-xs">{format.money(command.projectedCost)}</span>
              <Meter pct={treasuryShare} tone={live ? "primary" : "ok"} className="h-1" />
            </span>
          }
        >
          <PeekRows
            title={command.design.className}
            rows={[
              { label: "Projected cost", value: format.money(command.projectedCost) },
              {
                label: "Share of the treasury",
                value: `${format.number(treasuryShare, { maximumFractionDigits: 1 })}%`,
              },
              { label: "Capacity units", value: format.count(command.projectedCapacityUnits) },
            ]}
          />
        </Peek>
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {format.count(command.projectedCapacityUnits)}
      </TableCell>
      <TableCell className="text-right">
        {live && (
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
});

export const OrdersStage = memo(function OrdersStage({
  commands,
  selectedCommandId,
  onBrowseCatalog,
  ...rest
}: OrdersStageProps) {
  if (commands.length === 0) {
    return (
      <Empty>
        <EmptyIcon />
        <EmptyTitle>No commands</EmptyTitle>
        <EmptyDescription>No construction command has been submitted this month.</EmptyDescription>
        <Button variant="outline" size="sm" onClick={onBrowseCatalog}>
          Browse the design catalog
        </Button>
      </Empty>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Command ledger</h3>
        <p className="text-sm text-muted-foreground">Construction commands submitted this month.</p>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Design</TableHead>
              <TableHead>Status</TableHead>
              {DEBUG_MODE && <TableHead>Command</TableHead>}
              {DEBUG_MODE && <TableHead className="text-right">Rev</TableHead>}
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commands.map((command) => (
              <OrderRow
                key={command.commandId}
                command={command}
                selected={command.commandId === selectedCommandId}
                {...rest}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
