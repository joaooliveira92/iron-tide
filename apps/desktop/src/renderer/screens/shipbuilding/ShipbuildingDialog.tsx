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
  /** The campaign session, so the working design is kept on disk; absent outside a campaign. */
  readonly sessionId?: string;
}

/**
 * The Shipbuilding workspace opens from the bottom bar in a near full-screen modal, over whichever screen is current.
 * It is the app's only designer; the Construction screen's Drawing Board tab was removed (ADR-0153).
 */
export function ShipbuildingDialog({ open, onOpenChange, sessionId }: ShipbuildingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="shipbuilding-dialog"
        className="flex h-[96vh] w-[98vw] max-w-none flex-col gap-3 overflow-hidden p-4"
      >
        <DialogHeader>
          <DialogTitle>Shipbuilding</DialogTitle>
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
