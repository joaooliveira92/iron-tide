import {
  FLEET_SIZE_FIELD_LABEL,
  fleetSizeLabel,
  UNCERTAINTY_FIELD_LABELS,
  uncertaintyValueContent,
  type UncertaintyField,
} from "./rules-of-the-naval-age-content.js";
import {
  SIX_SETTING_FIELDS,
  type SixSettingBundle,
  type SixSettingField,
} from "./rules-of-the-naval-age-presets.js";

export interface PresetSettingRow {
  readonly field: SixSettingField;
  readonly label: string;
  readonly value: string;
}

function rowFor(field: SixSettingField, valueId: string): PresetSettingRow {
  if (field === "fleetSize") {
    return { field, label: FLEET_SIZE_FIELD_LABEL, value: fleetSizeLabel(valueId) };
  }
  const uncertaintyField: UncertaintyField = field;
  return {
    field,
    label: UNCERTAINTY_FIELD_LABELS[uncertaintyField],
    value: uncertaintyValueContent(uncertaintyField, valueId).label,
  };
}

/**
 * The six engine settings a preset bundle fixes, as the labelled rows the
 * focused-preset panel shows. Uses the same plain-language labels and value
 * copy as the Era & Scale and Historical Uncertainty forms, so a preset's
 * summary can never disagree with the controls it fills in.
 */
export function presetSettingRows(bundle: SixSettingBundle): readonly PresetSettingRow[] {
  return SIX_SETTING_FIELDS.map((field) => rowFor(field, bundle[field]));
}
