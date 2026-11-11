import { ClipboardCopy } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { useBridge } from "../../../lib/bridge-context.js";

export interface GenerationReportExportProps {
  readonly sessionId: string;
}

export function GenerationReportExport({ sessionId }: GenerationReportExportProps) {
  const bridge = useBridge();
  const [message, setMessage] = useState<string | null>(null);

  const exportReport = useCallback(async () => {
    if (bridge === undefined) {
      setMessage("The desktop bridge is not available.");
      return;
    }
    const result = await bridge.campaign.execute("exportGenerationReport", sessionId);
    if (result.outcome !== "success") {
      setMessage(result.diagnostics[0] ?? "The generation report could not be exported.");
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(result.value.report, null, 2));
    setMessage("Generation report copied to the clipboard as JSON.");
  }, [bridge, sessionId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Legacy fleet generation report</CardTitle>
        <CardDescription className="text-xs">
          Per-nation counts, fallbacks, skipped roles and the stop reason recorded when the starting
          fleet was generated for this campaign.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => void exportReport()}>
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            Copy generation report
          </Button>
        </div>
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      </CardContent>
    </Card>
  );
}
