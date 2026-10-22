import { Copy, DoorOpen, Save } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import { translate } from "../../../lib/strings.js";

export interface CampaignMenuItemsProps {
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly onCopy: () => void;
  readonly onCloseRequest: () => void;
}

export function CampaignMenuItems({
  saving,
  onSave,
  onCopy,
  onCloseRequest,
}: CampaignMenuItemsProps) {
  return (
    <div className="absolute right-0 top-full z-50 mt-1 flex w-52 flex-col gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
      <Button variant="ghost" className="justify-start gap-2" disabled={saving} onClick={onSave}>
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
        {saving ? translate("shell.header.menu.saving") : translate("shell.header.menu.save")}
      </Button>
      <Button variant="ghost" className="justify-start gap-2" disabled={saving} onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        {translate("shell.header.menu.copy")}
      </Button>
      <Button variant="ghost" className="justify-start gap-2" onClick={onCloseRequest}>
        <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
        {translate("shell.header.menu.close")}
      </Button>
    </div>
  );
}
