import { memo } from "react";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import type { ConstructionCommand } from "@bluewave/campaign-engine";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import { CommandRow } from "./CommandRow.js";

export interface CommandTableProps {
  readonly commands: readonly ConstructionCommand[];
  readonly busy: boolean;
  readonly selectedDesignId: string | null;
  readonly onReplace: (commandId: string) => void;
  readonly onCancel: (commandId: string) => void;
}

export const CommandTable = memo(function CommandTable({
  commands,
  busy,
  selectedDesignId,
  onReplace,
  onCancel,
}: CommandTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Command Ledger</CardTitle>
        <CardDescription>Construction commands submitted this month.</CardDescription>
      </CardHeader>
      <CardContent>
        {commands.length === 0 ? (
          <Empty>
            <EmptyIcon />
            <EmptyTitle>No commands</EmptyTitle>
            <EmptyDescription>
              No construction command has been submitted this month.
            </EmptyDescription>
          </Empty>
        ) : (
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
                <CommandRow
                  key={command.commandId}
                  command={command}
                  busy={busy}
                  selectedDesignId={selectedDesignId}
                  onReplace={onReplace}
                  onCancel={onCancel}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
});
