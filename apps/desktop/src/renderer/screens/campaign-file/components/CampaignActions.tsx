import { FileUp, FolderOpen } from "lucide-react";

import { Button } from "../../../components/ui/button.js";

interface CampaignActionsProps {
  readonly disabled: boolean;
  readonly onOpenCampaign: () => void;
  readonly onStartNewGame: () => void;
}

export function CampaignActions({
  disabled,
  onOpenCampaign,
  onStartNewGame,
}: CampaignActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Button
        variant="default"
        size="lg"
        className="h-20 flex-col gap-1"
        onClick={onOpenCampaign}
        disabled={disabled}
      >
        <FolderOpen className="h-6 w-6" />
        <span>Open Campaign</span>
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="h-20 flex-col gap-1"
        onClick={onStartNewGame}
        disabled={disabled}
      >
        <FileUp className="h-6 w-6" />
        <span>New Campaign</span>
      </Button>
    </div>
  );
}
