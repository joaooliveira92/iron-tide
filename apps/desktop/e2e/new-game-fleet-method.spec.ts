import { SEED, expect, test } from "./fixtures.js";
import { reachFleetMethodScreen } from "./flows.js";

test("Starting-fleet method: three cards in a deck, a detail panel that follows focus and selection", async ({
  e2e,
}) => {
  await reachFleetMethodScreen(e2e.page, { seed: SEED });

  const listbox = e2e.page.getByRole("listbox", { name: "Starting-fleet methods" });
  await expect(listbox).toBeVisible();

  const inherit = listbox.getByRole("option", { name: "Inherit an Existing Navy" });
  const manual = listbox.getByRole("option", { name: "Build the Legacy Fleet Manually" });
  const curated = listbox.getByRole("option", { name: "Curated Historical-Inspired Fleet" });

  await expect(inherit).toBeVisible();
  await expect(manual).toBeVisible();
  await expect(curated).toBeVisible();

  // Default selection is `generated` (Inherit) with its detail panel.
  await expect(inherit).toHaveAttribute("aria-selected", "true");
  const panel = e2e.page.getByRole("region", { name: "Fleet method details" });
  await expect(panel.getByText(/operational-but-aging navy/)).toBeVisible();
  await expect(panel.getByText(/Detailed fleet construction isn't available yet/)).toHaveCount(0);

  // The deck's cards overlap, so a centre-click lands on the top card. Step the
  // listbox to the manual-build card and confirm with Enter, as the archetype
  // step does; the detail panel then follows the applied method.
  await listbox.press("ArrowRight");
  await listbox.press("Enter");
  await expect(manual).toHaveAttribute("aria-selected", "true");
  await expect(inherit).toHaveAttribute("aria-selected", "false");
  await expect(panel.getByText(/Automatic generation is switched off/)).toBeVisible();
  await expect(e2e.page.getByText(/operational-but-aging navy/)).toHaveCount(0);
  await expect(panel.getByText(/Detailed fleet construction isn't available yet/)).toBeVisible();

  // The status line shows the current method.
  await expect(e2e.page.getByRole("status")).toContainText("Build the Legacy Fleet Manually");
});
