/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HeaderCampaignMenu } from "./HeaderCampaignMenu.js";

function setup(saving = false) {
  const handlers = { onSave: vi.fn(), onCopy: vi.fn(), onCloseCampaign: vi.fn() };
  render(<HeaderCampaignMenu saving={saving} {...handlers} />);
  fireEvent.click(screen.getByRole("button", { name: "Campaign menu" }));
  return handlers;
}

describe("HeaderCampaignMenu", () => {
  afterEach(cleanup);

  it("saves the campaign", async () => {
    const h = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(h.onSave).toHaveBeenCalledOnce();
  });

  it("saves a copy", async () => {
    const h = setup();
    fireEvent.click(await screen.findByRole("button", { name: /Copy game/ }));
    expect(h.onCopy).toHaveBeenCalledOnce();
  });

  it("disables Save and Copy while a save is in flight", async () => {
    setup(true);
    expect((await screen.findByRole("button", { name: /Sav/ })) as HTMLButtonElement).toBeTruthy();
    expect((screen.getByRole("button", { name: /Copy game/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("closes the campaign only after confirmation", async () => {
    const h = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Close campaign…" }));
    expect(h.onCloseCampaign).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Close campaign" }));
    expect(h.onCloseCampaign).toHaveBeenCalledOnce();
  });

  it("dismisses the menu on an outside pointer press", async () => {
    setup();
    expect(await screen.findByRole("button", { name: "Save" })).toBeTruthy();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("dismisses the menu on Escape", async () => {
    setup();
    expect(await screen.findByRole("button", { name: "Save" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
