import { ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "../../components/ui/button.js";
import { CampaignMenuItems } from "./campaign-menu/CampaignMenuItems.js";
import { CloseCampaignDialog } from "./campaign-menu/CloseCampaignDialog.js";
import { useDismissOnOutside } from "./campaign-menu/useDismissOnOutside.js";

export interface HeaderCampaignMenuProps {
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly onCopy: () => void;
  readonly onCloseCampaign: () => void;
}

/** The header's Campaign menu (CC-6): file-level actions. Advance Month stays the only Turn control. */
export function HeaderCampaignMenu({
  saving,
  onSave,
  onCopy,
  onCloseCampaign,
}: HeaderCampaignMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismissOnOutside(rootRef, menuOpen, closeMenu);

  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  return (
    <>
      <div ref={rootRef} className="relative">
        <Button
          variant="outline"
          aria-label="Campaign menu"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          title="Save, copy or close the campaign"
          className="h-8 shrink-0 gap-1 px-3"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Campaign
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        {menuOpen && (
          <CampaignMenuItems
            saving={saving}
            onSave={run(onSave)}
            onCopy={run(onCopy)}
            onCloseRequest={run(() => setConfirmOpen(true))}
          />
        )}
      </div>
      <CloseCampaignDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={onCloseCampaign}
      />
    </>
  );
}
