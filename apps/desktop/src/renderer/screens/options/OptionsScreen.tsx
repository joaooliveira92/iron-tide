import { Settings, Undo2 } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "../../components/shared/PageHeader.js";
import { SettingsModal } from "../../components/shared/SettingsModal.js";
import { Button } from "../../components/ui/button.js";
import { usePreferences } from "../../lib/preferences-context.js";
import { translate, type MessageKey } from "../../lib/strings.js";
import { OptionsPanel } from "./components/OptionsPanel.js";
import {
  OPTIONS_DEPARTMENT_ORDER,
  optionsDepartmentMeta,
  type OptionsDepartment,
} from "./options-departments.js";
import { departmentResetPatch } from "./options-reset.js";

const NAV_ITEMS = OPTIONS_DEPARTMENT_ORDER.map(optionsDepartmentMeta);

export interface OptionsScreenProps {
  readonly onClose?: () => void;
}

export function OptionsScreen({ onClose }: OptionsScreenProps = {}) {
  const { setApp } = usePreferences();
  const [open, setOpen] = useState(true);
  const [department, setDepartment] = useState<OptionsDepartment>("general");

  const meta = optionsDepartmentMeta(department);
  const close = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Settings}
        title={translate("settings.title")}
        description={translate("settings.description")}
      />
      {!open && (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {translate("settings.open")}
        </Button>
      )}
      <SettingsModal
        open={open}
        onOpenChange={(next) => !next && close()}
        title={translate("settings.modal.title")}
        navLabel={translate("settings.modal.nav")}
        items={NAV_ITEMS}
        activeId={department}
        onSelect={setDepartment}
        testId="options-workbench"
        headerAction={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setApp(departmentResetPatch(meta.id))}
          >
            <Undo2 aria-hidden="true" />
            {meta.id === "general"
              ? translate("settings.reset.all")
              : translate("settings.reset.department", {
                  department: translate(`settings.reset.noun.${meta.id}` as MessageKey),
                })}
          </Button>
        }
      >
        <OptionsPanel department={meta.id} onSelect={setDepartment} />
      </SettingsModal>
    </div>
  );
}
