export type FleetHotkeyAction =
  | "previous-division"
  | "next-division"
  | "focus-destination"
  | "submit-order"
  | "cancel-order"
  | "reserve-selected";

export type HotkeyTarget = "none" | "control" | "text-entry" | "overlay" | "workbench";

export interface HotkeyEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
  readonly target: HotkeyTarget;
}

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);
const CONTROL_ROLES = new Set([
  "button",
  "radio",
  "checkbox",
  "combobox",
  "switch",
  "tab",
  "menuitem",
]);
const CONTROL_TAGS = new Set(["BUTTON", "A", "SELECT", "SUMMARY"]);
const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]';
const WORKBENCH_SELECTOR = "[data-fleet-hotkey-scope]";

const KEY_ACTIONS: Readonly<Record<string, FleetHotkeyAction>> = {
  "[": "previous-division",
  "]": "next-division",
  m: "focus-destination",
  Enter: "submit-order",
  Escape: "cancel-order",
  r: "reserve-selected",
};

export function classifyHotkeyTarget(target: EventTarget | null): HotkeyTarget {
  if (!(target instanceof Element)) return "none";
  if (target.closest(OVERLAY_SELECTOR) === null) return classifyElement(target);
  if (target.closest(WORKBENCH_SELECTOR) === null) return "overlay";
  return classifyElement(target) === "text-entry" ? "text-entry" : "workbench";
}

function classifyElement(target: Element): HotkeyTarget {
  if (target instanceof HTMLTextAreaElement) return "text-entry";
  if (target.closest('[contenteditable]:not([contenteditable="false"])') !== null) {
    return "text-entry";
  }
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(target.type) ? "text-entry" : "control";
  }
  if (CONTROL_TAGS.has(target.tagName)) return "control";
  const role = target.getAttribute("role");
  return role !== null && CONTROL_ROLES.has(role) ? "control" : "none";
}

export function fleetHotkeyAction(event: HotkeyEvent): FleetHotkeyAction | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.target === "text-entry" || event.target === "overlay") return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const action = KEY_ACTIONS[key];
  if (action === undefined) return null;
  if (event.target === "workbench") return action === "reserve-selected" ? action : null;
  if (action === "submit-order" && event.target === "control") return null;
  return action;
}

export function stepDivisionSelection(
  divisionIds: readonly string[],
  current: string | null,
  direction: 1 | -1,
): string | null {
  if (divisionIds.length === 0) return null;
  const index = current === null ? -1 : divisionIds.indexOf(current);
  if (index === -1) return (direction === 1 ? divisionIds[0] : divisionIds.at(-1)) ?? null;
  return divisionIds[(index + direction + divisionIds.length) % divisionIds.length] ?? null;
}

export interface OrderHotkeyContext {
  readonly busy: boolean;
  readonly divisionSelected: boolean;
  readonly destinationChosen: boolean;
  readonly pendingCommandId: string | null;
}

export type OrderHotkeyIntent =
  | { readonly kind: "submit" }
  | { readonly kind: "replace"; readonly commandId: string }
  | { readonly kind: "cancel"; readonly commandId: string };

export function orderHotkeyIntent(
  action: FleetHotkeyAction,
  context: OrderHotkeyContext,
): OrderHotkeyIntent | null {
  if (context.busy) return null;
  if (action === "cancel-order") {
    return context.pendingCommandId === null
      ? null
      : { kind: "cancel", commandId: context.pendingCommandId };
  }
  if (action !== "submit-order") return null;
  if (!context.destinationChosen) return null;
  if (context.pendingCommandId !== null) {
    return { kind: "replace", commandId: context.pendingCommandId };
  }
  return context.divisionSelected ? { kind: "submit" } : null;
}
