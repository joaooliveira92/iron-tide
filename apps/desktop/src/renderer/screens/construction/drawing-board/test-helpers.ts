import { fireEvent, screen } from "@testing-library/react";

const SHIP_VIEW_PANELS: ReadonlySet<string> = new Set(["Hull plan"]);

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

export function openPlanDisplay(): void {
  if (screen.queryByRole("dialog", { name: "Plan display" }) !== null) return;
  fireEvent.click(screen.getByRole("button", { name: "Plan display" }));
}

export async function planMenu(...path: string[]): Promise<void> {
  fireEvent.contextMenu(screen.getByRole("group", { name: /^Ship plan/ }));
  for (const label of path) fireEvent.click(await screen.findByRole("menuitem", { name: label }));
}

const categoryLabel = (category: string) => {
  const spaced = category.replaceAll("_", " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const armPlace = (component: { readonly category: string; readonly displayName: string }) =>
  planMenu("Place", categoryLabel(component.category), component.displayName);

export async function armMove(which: "first" | "last" = "last"): Promise<void> {
  await planMenu("Move");
  const items = await screen.findAllByRole("menuitem", { name: /\(.+\)$/ });
  fireEvent.click(which === "first" ? items[0]! : items[items.length - 1]!);
}

export function chooseOption(trigger: string | RegExp, option: string | RegExp): void {
  fireEvent.click(screen.getByLabelText(trigger));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

export function chooseOptionAt(trigger: string | RegExp, index: number): void {
  fireEvent.click(screen.getByLabelText(trigger));
  const options = screen.getAllByRole("option");
  const chosen = options[index];
  if (chosen === undefined) throw new Error(`no option at index ${index}`);
  fireEvent.click(chosen);
}

export function region(name: string): HTMLElement {
  if (SHIP_VIEW_PANELS.has(name)) return screen.getByRole("region", { name });
  const tab = PANEL_TAB[name];
  if (tab === undefined) throw new Error(`no tab known for panel "${name}"`);
  openTab(tab);
  return screen.getByRole("region", { name });
}
