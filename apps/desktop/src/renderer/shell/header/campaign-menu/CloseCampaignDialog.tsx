import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog.js";
import { translate } from "../../../lib/strings.js";

export interface CloseCampaignDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

export function CloseCampaignDialog({ open, onOpenChange, onConfirm }: CloseCampaignDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{translate("shell.header.closeDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {translate("shell.header.closeDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{translate("shell.header.closeDialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {translate("shell.header.closeDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
