/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PLAYABLE_SLOT_COUNTRY_IDS } from "@/content/nationAssetManifest.js";
import { nationDossier, nationFlavor } from "@/content/presentationContent.js";
import { DossierSlidePanel } from "./DossierSlidePanel.js";
import { buildDossierTabs } from "./DossierTabContent.js";

vi.mock("./DossierTabContent.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./DossierTabContent.js")>();
  return { ...original, buildDossierTabs: vi.fn(original.buildDossierTabs) };
});

beforeEach(() => {
  vi.mocked(buildDossierTabs).mockClear();
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

function renderPanel(countryId: (typeof PLAYABLE_SLOT_COUNTRY_IDS)[number]) {
  render(
    <DossierSlidePanel
      countryId={countryId}
      isOpen
      onChangeNation={vi.fn()}
      onConfirm={vi.fn()}
      onRecommendedSetup={vi.fn()}
    />,
  );
}

describe("DossierSlidePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("rebuilds the dossier tabs only when the country changes", () => {
    const props = { onChangeNation: vi.fn(), onConfirm: vi.fn(), onRecommendedSetup: vi.fn() };
    const { rerender } = render(<DossierSlidePanel countryId="gb" isOpen {...props} />);

    rerender(<DossierSlidePanel countryId="gb" isOpen={false} {...props} />);
    expect(buildDossierTabs).toHaveBeenCalledTimes(1);

    rerender(<DossierSlidePanel countryId="fr" isOpen={false} {...props} />);
    expect(buildDossierTabs).toHaveBeenCalledTimes(2);
    expect(vi.mocked(buildDossierTabs).mock.lastCall?.[0]).toBe("fr");
  });

  it("shows the nation name with the appointment title only on the flag's hover", async () => {
    renderPanel("gb");

    expect(screen.getByRole("heading", { name: "United Kingdom" })).toBeTruthy();
    expect(screen.queryByText(/You have been appointed First Sea Lord/i)).toBeNull();

    const flag = screen.getByLabelText(/You have been appointed First Sea Lord/i);
    fireEvent.focus(flag);
    expect(await screen.findByText(/You have been appointed First Sea Lord/i)).toBeTruthy();

    expect(screen.queryByText(/Admiralty Intelligence Dossier/i)).toBeNull();
    expect(screen.queryByText(/1880/)).toBeNull();
  });

  it("never shows a Compare Nations control", () => {
    renderPanel("gb");

    expect(screen.queryByText(/Compare Nations/i)).toBeNull();
  });

  it.each(PLAYABLE_SLOT_COUNTRY_IDS)("renders %s's full dossier field set", (countryId) => {
    renderPanel(countryId);
    const flavor = nationFlavor(countryId);
    const fields = nationDossier(countryId);

    fireEvent.click(screen.getByRole("button", { name: "Economy" }));
    expect(screen.getByText(flavor.economy)).toBeTruthy();
    expect(screen.getByText(new RegExp(fields.budgetCategory))).toBeTruthy();
    expect(screen.getByText(new RegExp(fields.shipbuildingCapacity))).toBeTruthy();
    expect(screen.getByText(new RegExp(fields.researchStrengths))).toBeTruthy();
    expect(screen.getByText(new RegExp(fields.researchWeaknesses))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Military" }));
    expect(screen.getByText(flavor.military)).toBeTruthy();
    expect(screen.getByText(new RegExp(fields.doctrine))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${fields.difficulty} / 5`))).toBeTruthy();
    expect(screen.getByText(new RegExp(fields.likelyRivals.join(", ")))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Diplomacy" }));
    expect(screen.getByText(flavor.diplomacy)).toBeTruthy();
    expect(screen.getByText(new RegExp(fields.strategicRegions))).toBeTruthy();
    expect(screen.getByText(new RegExp(fields.nationalCharacteristics))).toBeTruthy();
  });

  it("renders nothing when not open", () => {
    const { container } = render(
      <DossierSlidePanel
        countryId="gb"
        isOpen={false}
        onChangeNation={vi.fn()}
        onConfirm={vi.fn()}
        onRecommendedSetup={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});
