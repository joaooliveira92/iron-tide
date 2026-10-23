import { memo } from "react";
import type { ConstructionCommand } from "@bluewave/campaign-engine";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ConstructionScreenProjection } from "../../../../shared/construction-contract.js";
import { CommandStatusBadge } from "./CommandStatusBadge.js";
import { Meter } from "./Meter.js";

export interface CommandInspectorProps {
  readonly command: ConstructionCommand | null;
  readonly commands: readonly ConstructionCommand[];
  readonly economy: ConstructionScreenProjection["economy"];
  readonly workspace: ConstructionScreenProjection["workspace"];
}

export const CommandInspector = memo(function CommandInspector({
  command,
  commands,
  economy,
  workspace,
}: CommandInspectorProps) {
  const format = usePresentationFormat();
  if (command === null) {
    const count = (status: ConstructionCommand["status"]) =>
      commands.filter((c) => c.status === status).length;
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Select an order in the ledger to see what it reserves.
        </p>
        <dl className="space-y-1 text-sm">
          {(["submitted", "accepted", "superseded", "cancelled"] as const).map((status) => (
            <div key={status} className="flex items-center justify-between">
              <dt>
                <CommandStatusBadge status={status} />
              </dt>
              <dd className="font-mono tabular-nums">{count(status)}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  const treasuryShare = economy.treasury > 0 ? (command.projectedCost / economy.treasury) * 100 : 0;
  const capacityShare =
    economy.shipyardCapacity > 0
      ? (command.projectedCapacityUnits / economy.shipyardCapacity) * 100
      : 0;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold leading-tight">{command.design.className}</h3>
        <p className="text-xs text-muted-foreground">{command.design.shipType}</p>
        <CommandStatusBadge status={command.status} />
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Treasury</span>
            <span className="font-mono tabular-nums">{format.money(command.projectedCost)}</span>
          </div>
          <Meter pct={treasuryShare} />
          <p className="text-right text-xs text-muted-foreground">
            {format.number(treasuryShare, { maximumFractionDigits: 1 })}% of the treasury
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Capacity</span>
            <span className="font-mono tabular-nums">
              {format.count(command.projectedCapacityUnits)}
            </span>
          </div>
          <Meter pct={capacityShare} />
          <p className="text-right text-xs text-muted-foreground">
            {format.number(capacityShare, { maximumFractionDigits: 1 })}% of shipyard capacity
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        All orders this month reserve {format.money(workspace.treasuryReserved)} and{" "}
        {format.count(workspace.capacityReserved)} capacity.
      </p>
      {DEBUG_MODE && (
        <p className="font-mono text-xs text-muted-foreground">
          {command.commandId} · rev {command.submittedAtRevision}
        </p>
      )}
    </div>
  );
});
