import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.js";
import { ShipbuildingContentGate } from "./ShipbuildingContentGate.js";

export interface ShipbuildingDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly sessionId?: string;
}

export function ShipbuildingDialog({ open, onOpenChange, sessionId }: ShipbuildingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="shipbuilding-dialog"
        className="flex h-[96vh] w-[98vw] max-w-none flex-col gap-3 overflow-hidden p-4"
      >
        <DialogHeader>
          <DialogTitle>Ship design</DialogTitle>
          <DialogDescription>
            Navigate by ship system, edit in the inspector, and watch the consequences on the ship.
            Your design is saved as you work.
          </DialogDescription>
        </DialogHeader>
        {open && <ShipbuildingContentGate sessionId={sessionId} />}
      </DialogContent>
    </Dialog>
  );
}
