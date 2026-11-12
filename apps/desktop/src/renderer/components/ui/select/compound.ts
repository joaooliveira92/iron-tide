import { SelectContent } from "./select-content.js";
import { SelectItem } from "./select-item.js";
import { SelectRoot } from "./select-root.js";
import { SelectTrigger } from "./select-trigger.js";
import { SelectValue } from "./select-value.js";

export const Select = Object.assign(SelectRoot, {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Content: SelectContent,
  Item: SelectItem,
});
