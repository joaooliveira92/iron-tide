/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { NationSelectionScreen } from "./NationSelectionScreen.js";

const SLOTS: readonly PlayableSlotCountryId[] = ["gb", "de", "es"];

if (typeof globalThis.IntersectionObserver === "undefined") {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    },
  });
}

function setup(failure: string | null) {
  return render(
    <NationSelectionScreen
      slots={SLOTS}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      onRecommendedSetup={vi.fn()}
      focusedIndex={0}
      onFocusChange={vi.fn()}
      failure={failure}
    />,
  );
}

describe("NationSelectionScreen failure dispatch", () => {
  afterEach(cleanup);

  it("shows no failure dispatch when there is no failure", () => {
    setup(null);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows no failure dispatch for an empty failure message", () => {
    setup("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the failure message when one is reported", () => {
    setup("The admiralty could not commission this navy.");
    expect(screen.getByRole("alert").textContent).toContain(
      "The admiralty could not commission this navy.",
    );
  });
});
