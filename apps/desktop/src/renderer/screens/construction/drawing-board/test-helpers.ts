import { fireEvent, screen } from "@testing-library/react";

/** Panels in the workspace's ship view: visible on every tab, so no tab needs opening. */
const SHIP_VIEW_PANELS: ReadonlySet<string> = new Set(["Hull plan"]);

/** The tab each panel lives on, so a test can ask for a panel by name and land on the right tab. */
const PANEL_TAB: Record<string, string> = {
  "Hull and displacement": "Hull and machinery",
  "Design brief": "Hull and machinery",
  "Ship types": "Hull and machinery",
  "Machinery, fuel and range": "Hull and machinery",
  "Components and arrangement": "Arrangement",
  Batteries: "Arrangement",
  Protection: "Arrangement",
  "Topside load": "Arrangement",
  Validation: "Analysis",
  Performance: "Analysis",
  "Compared with starting design": "Analysis",
  "Weight summary": "Analysis",
  "Cost and construction forecast": "Analysis",
  "Submit for construction": "Build",
  "Revision preview": "Build",
  "Edit history": "History and files",
  "Design file": "History and files",
  "AI alternatives": "History and files",
};

export const openTab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(name, "i") }));

/** Opens the toolbar's plan display popover (gun arcs, findings), unless it is already open. */
export function openPlanDisplay(): void {
  if (screen.queryByRole("dialog", { name: "Plan display" }) !== null) return;
  fireEvent.click(screen.getByRole("button", { name: "Plan display" }));
}

/** Right-clicks the ship plan and walks the context menu: each label is a menu item (or submenu) to click in turn. */
export async function planMenu(...path: string[]): Promise<void> {
  fireEvent.contextMenu(screen.getByRole("group", { name: /^Ship plan/ }));
  for (const label of path) fireEvent.click(await screen.findByRole("menuitem", { name: label }));
}

const categoryLabel = (category: string) => {
  const spaced = category.replaceAll("_", " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Arms the Place tool for `component` from the plan's context menu. */
export const armPlace = (component: { readonly category: string; readonly displayName: string }) =>
  planMenu("Place", categoryLabel(component.category), component.displayName);

/** Arms the Move tool for the first or last fitting in the plan's Move submenu. */
export async function armMove(which: "first" | "last" = "last"): Promise<void> {
  await planMenu("Move");
  const items = await screen.findAllByRole("menuitem", { name: /\(.+\)$/ });
  fireEvent.click(which === "first" ? items[0]! : items[items.length - 1]!);
}

/** Opens a `<Select>` by its trigger's accessible name and clicks the option whose visible text matches. */
export function chooseOption(trigger: string | RegExp, option: string | RegExp): void {
  fireEvent.click(screen.getByLabelText(trigger));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

/** Opens a `<Select>` by its trigger's accessible name and clicks the option at `index`. */
export function chooseOptionAt(trigger: string | RegExp, index: number): void {
  fireEvent.click(screen.getByLabelText(trigger));
  const options = screen.getAllByRole("option");
  const chosen = options[index];
  if (chosen === undefined) throw new Error(`no option at index ${index}`);
  fireEvent.click(chosen);
}

/** Opens the tab that holds the named panel (if it is on one) and returns the panel. */
export function region(name: string): HTMLElement {
  if (SHIP_VIEW_PANELS.has(name)) return screen.getByRole("region", { name });
  const tab = PANEL_TAB[name];
  if (tab === undefined) throw new Error(`no tab known for panel "${name}"`);
  openTab(tab);
  return screen.getByRole("region", { name });
}
