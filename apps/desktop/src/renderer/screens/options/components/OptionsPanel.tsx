import type { OptionsDepartment } from "../options-departments.js";
import { AccessibilityPanel } from "./AccessibilityPanel.js";
import { AppearancePanel } from "./AppearancePanel.js";
import { CurrencyPanel } from "./CurrencyPanel.js";
import { GeneralPanel } from "./GeneralPanel.js";
import { LanguagePanel } from "./LanguagePanel.js";
import { MeasurementsPanel } from "./MeasurementsPanel.js";

export function OptionsPanel({
  department,
  onSelect,
}: {
  department: OptionsDepartment;
  onSelect: (department: OptionsDepartment) => void;
}) {
  switch (department) {
    case "general":
      return <GeneralPanel />;
    case "appearance":
      return <AppearancePanel />;
    case "measurements":
      return <MeasurementsPanel />;
    case "currency":
      return <CurrencyPanel />;
    case "language":
      return <LanguagePanel />;
    case "accessibility":
      return <AccessibilityPanel onOpenAppearance={() => onSelect("appearance")} />;
  }
}
