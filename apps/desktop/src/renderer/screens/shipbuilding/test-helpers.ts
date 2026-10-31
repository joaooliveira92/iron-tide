import { fireEvent, screen, within } from "@testing-library/react";

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

export function openHistory(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: /More design actions/ }));
  fireEvent.click(screen.getByRole("menuitem", { name: /Edit history/ }));
  return screen.getByRole("dialog", { name: "Edit history" });
}

export function historyEntries(): string {
  return within(openHistory()).getByRole("region", { name: "Edit history" }).textContent ?? "";
}

export function openSection(name: string, tab?: string): void {
  const nav = screen.getByRole("navigation", { name: "Design sections" });
  const button = within(nav).getByRole("button", { name: new RegExp(`^${name}`) });
  if (button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
  if (tab === undefined) return;
  const drawer = screen.getByTestId("design-drawer");
  fireEvent.click(
    within(within(drawer).getByRole("tablist", { name: /tabs$/ })).getByRole("tab", { name: tab }),
  );
}

export function layersPopover(): HTMLElement {
  if (screen.queryByRole("group", { name: "Overlays" }) === null)
    fireEvent.click(screen.getByRole("button", { name: /^Layers/ }));
  return screen.getByRole("group", { name: "Overlays" }).parentElement as HTMLElement;
}
