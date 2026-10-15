import { formatEngineAudit, renderEngineAuditText } from "@bluewave/campaign-engine";
import { Database, Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog.js";
import { Button } from "../../../components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import type { StoredEngineAudit } from "../../../lib/engine-audit.js";
import { formatEventDateTime } from "../utils/format.js";

export interface EngineAuditInspectorProps {
  readonly audits: readonly StoredEngineAudit[];
  readonly selectedAudit: StoredEngineAudit | null;
  readonly onSelectAudit: (audit: StoredEngineAudit) => void;
  readonly onCloseAudit: () => void;
  readonly onClearAudits: () => void;
}

export function EngineAuditInspector({
  audits,
  selectedAudit,
  onSelectAudit,
  onCloseAudit,
  onClearAudits,
}: EngineAuditInspectorProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                <Database className="h-4 w-4 text-primary" />
                Engine Audit Trail
              </CardTitle>
              <CardDescription className="text-xs">
                The authoritative, replayable record of simulation decisions returned at the engine
                boundary.
              </CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={audits.length === 0}
                    className="shrink-0"
                  />
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear engine audit log?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes all {audits.length} recorded engine audits from local
                    storage. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearAudits}>Clear log</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>{audits.length} recorded audits</span>
            <span>Engine results recorded during simulation</span>
          </div>
          <ScrollArea className="h-[300px] rounded-md border">
            {audits.length === 0 ? (
              <Empty className="h-full border-none">
                <EmptyIcon>
                  <Database />
                </EmptyIcon>
                <EmptyTitle>No engine audits recorded</EmptyTitle>
                <EmptyDescription>
                  Run a month or battle in the simulation screen to capture the deterministic audit
                  trail.
                </EmptyDescription>
              </Empty>
            ) : (
              <Table className="font-mono text-[12px]">
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="p-2">Time</TableHead>
                    <TableHead className="p-2">Action</TableHead>
                    <TableHead className="p-2 text-right">Decisions</TableHead>
                    <TableHead className="p-2 text-right">Events</TableHead>
                    <TableHead className="p-2 text-right">Ledger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((audit, idx) => {
                    const report = formatEngineAudit(audit.input);
                    const decisionCount = report.counts.decisions;
                    return (
                      <TableRow
                        key={idx}
                        className="h-8 cursor-pointer hover:bg-muted/40"
                        onClick={() => onSelectAudit(audit)}
                      >
                        <TableCell className="p-2 text-muted-foreground">
                          {formatEventDateTime(audit.timestamp)}
                        </TableCell>
                        <TableCell className="p-2 font-medium">{audit.action}</TableCell>
                        <TableCell className="p-2 text-right">{decisionCount}</TableCell>
                        <TableCell className="p-2 text-right">
                          {report.counts.domainEvents}
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          {report.counts.ledgerEntries}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Sheet open={selectedAudit !== null} onOpenChange={(open) => !open && onCloseAudit()}>
        <SheetContent className="flex flex-col gap-4 sm:max-w-2xl">
          {selectedAudit !== null && <AuditDetail audit={selectedAudit} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function AuditDetail({ audit }: { readonly audit: StoredEngineAudit }) {
  const report = useMemo(() => formatEngineAudit(audit.input), [audit]);
  const text = useMemo(
    () => renderEngineAuditText(report, `Engine Audit — ${audit.action}`),
    [report, audit.action],
  );
  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-mono text-base">{audit.action}</SheetTitle>
        <SheetDescription>
          {formatEventDateTime(audit.timestamp)} · {report.counts.decisions} decisions ·{" "}
          {report.counts.domainEvents} events · {report.counts.ledgerEntries} ledger entries
        </SheetDescription>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1 rounded-md border bg-zinc-950">
        <pre className="whitespace-pre-wrap break-words p-2 font-mono text-[12px] text-zinc-50">
          {text}
        </pre>
      </ScrollArea>
      {audit.input.randomDecisions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Random decisions
          </h4>
          <ScrollArea className="h-40 rounded-md border">
            <Table className="font-mono text-[11px]">
              <TableHeader>
                <TableRow className="h-7">
                  <TableHead className="p-1.5">Purpose</TableHead>
                  <TableHead className="p-1.5">Phase</TableHead>
                  <TableHead className="p-1.5">Entity</TableHead>
                  <TableHead className="p-1.5 text-right">Value</TableHead>
                  <TableHead className="p-1.5">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.input.randomDecisions.map((decision, idx) => (
                  <TableRow key={idx} className="h-7">
                    <TableCell className="p-1.5">{decision.purpose}</TableCell>
                    <TableCell className="p-1.5">{decision.phase}</TableCell>
                    <TableCell className="p-1.5">{decision.entityKey}</TableCell>
                    <TableCell className="p-1.5 text-right">{decision.value}</TableCell>
                    <TableCell className="p-1.5">{decision.outcome}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </>
  );
}
