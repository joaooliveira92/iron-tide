import { Badge } from "../../../components/ui/badge.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet.js";
import type { WideTelemetryEvent } from "../../../lib/telemetry.js";
import { formatEventDateTime } from "../utils/format.js";

export interface TelemetryEventSheetProps {
  readonly event: WideTelemetryEvent | null;
  readonly onClose: () => void;
}

export function TelemetryEventSheet({ event, onClose }: TelemetryEventSheetProps) {
  return (
    <Sheet open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col gap-4 sm:max-w-lg">
        {event !== null && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 font-mono text-base">
                {event.action}
                <Badge
                  variant={event.outcome === "success" ? "default" : "destructive"}
                  className="text-[11px] uppercase"
                >
                  {event.outcome}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {formatEventDateTime(event.timestamp)} · {event.duration_ms}ms · session{" "}
                {event.sessionId}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Diagnostics
              </h4>
              {event.diagnostics.length === 0 ? (
                <p className="text-xs text-muted-foreground">No diagnostics reported.</p>
              ) : (
                <ul className="space-y-1 rounded-md border bg-muted/20 p-2 font-mono text-[11px]">
                  {event.diagnostics.map((diagnostic, idx) => (
                    <li key={idx} className="border-b pb-1 last:border-0 last:pb-0">
                      {diagnostic}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Payload
              </h4>
              <ScrollArea className="min-h-0 flex-1 rounded-md border bg-zinc-950">
                <pre className="whitespace-pre-wrap break-words p-2 font-mono text-[12px] text-zinc-50">
                  {event.payload !== undefined ? JSON.stringify(event.payload, null, 2) : "—"}
                </pre>
              </ScrollArea>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
