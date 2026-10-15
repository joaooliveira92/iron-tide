/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { Coins } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createHoverCardHandle } from "@/components/ui/hover-card.js";
import { DossierAccordionItem } from "./DossierAccordionItem.js";
import type { DossierSection, DossierSectionId } from "./types.js";

const section: DossierSection = {
  id: "economy",
  label: "Economy",
  text: "The Admiralty funds ship construction.",
  icon: Coins,
  accent: "gold",
};

function renderItem(active: boolean) {
  const handle = createHoverCardHandle<DossierSectionId>();
  return render(
    <DossierAccordionItem
      section={section}
      active={active}
      handle={handle}
      onSelect={vi.fn()}
      onKeyDown={vi.fn()}
    />,
  );
}

describe("DossierAccordionItem", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a labelled tab that controls its intelligence panel", () => {
    renderItem(true);

    const trigger = screen.getByRole("button", { name: "Economy" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe("dossier-economy-panel");
  });

  it("leaves the panel unlinked while the card is closed", () => {
    renderItem(false);

    const trigger = screen.getByRole("button", { name: "Economy" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBeNull();
  });
});
