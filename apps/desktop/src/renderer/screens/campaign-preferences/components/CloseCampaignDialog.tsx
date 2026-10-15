import { memo } from "react";
import { SwitchCamera } from "lucide-react";
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

export interface CloseCampaignDialogProps {
  readonly onCloseCampaign: () => void;
}

export const CloseCampaignDialog = memo(function CloseCampaignDialog({
  onCloseCampaign,
}: CloseCampaignDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        <SwitchCamera className="h-3.5 w-3.5" />
        Close Campaign
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close this campaign?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be returned to the campaign file screen. Unsaved progress may be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onCloseCampaign}>Close Campaign</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
