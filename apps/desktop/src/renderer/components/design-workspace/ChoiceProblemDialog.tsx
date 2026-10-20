import { OctagonX } from "lucide-react";
import { formatExplanation } from "../../lib/presentation-format/index.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog.js";
import { Badge } from "../ui/badge.js";
import type { ChoiceProblem } from "./useChoiceCheck.js";
import { SEVERITY_STYLE } from "./validation/severity.js";

/**
 * Explains, right after a choice, why it stops the design working: what failed, why, what it would mean in play,
 * and how to put it right. The player may undo the choice or keep it and fix it another way.
 */
export function ChoiceProblemDialog({
  problem,
  open,
  onOpenChange,
  onUndo,
}: {
  readonly problem: ChoiceProblem | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onUndo: () => void;
}) {
  return (
    <AlertDialog open={open && problem !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        {problem && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <OctagonX className="size-5 text-destructive" aria-hidden />
                This change breaks the design
              </AlertDialogTitle>
              <AlertDialogDescription>
                {problem.choice}. This leaves the design unable to work as it should; here is what
                happened and how to fix it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="space-y-4">
              {problem.findings.map((f) => (
                <li key={f.key} className="space-y-2 rounded-md border p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant={SEVERITY_STYLE[f.severity].badge}>
                      {SEVERITY_STYLE[f.severity].label}
                    </Badge>
                    <p className="font-medium">{f.title}</p>
                  </div>
                  <p className="text-muted-foreground">{f.explanation}</p>
                  <p>
                    <span className="font-medium">In play: </span>
                    {formatExplanation(f.finding.consequence)}
                  </p>
                  {f.finding.remedies.length > 0 && (
                    <div>
                      <p className="font-medium">How to fix it</p>
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {f.finding.remedies.map((r) => (
                          <li key={r.id}>{formatExplanation(r.description)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it and fix it myself</AlertDialogCancel>
              <AlertDialogAction onClick={onUndo}>Undo this choice</AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
