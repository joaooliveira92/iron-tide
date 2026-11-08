import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog.js";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { SteeringConfirmView } from "../steering-view.js";

export interface SteeringConfirmDialogProps {
  readonly view: SteeringConfirmView;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

export function SteeringConfirmDialog({
  view,
  open,
  onOpenChange,
  onConfirm,
}: SteeringConfirmDialogProps) {
  const format = usePresentationFormat();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{view.title}</AlertDialogTitle>
          <AlertDialogDescription>{view.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogBody>
          <ul className="space-y-2 text-sm">
            {view.rows.map((row) => (
              <li key={row.label} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono tabular-nums">{row.value}</span>
                </div>
                {row.explanation !== undefined && (
                  <ExplanationDisclosure
                    tree={row.explanation.tree}
                    area="construction"
                    summaryKey={row.explanation.summaryKey}
                    format={format}
                  />
                )}
              </li>
            ))}
          </ul>
          {view.notes.map((note) => (
            <p key={note} className="mt-3 text-sm text-muted-foreground">
              {note}
            </p>
          ))}
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel>{view.cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{view.confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
