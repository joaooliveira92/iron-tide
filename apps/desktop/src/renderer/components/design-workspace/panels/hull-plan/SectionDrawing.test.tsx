import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { SectionDrawing } from "./SectionDrawing.js";
import type { SectionId } from "./sections.js";
import {
  content,
  frame,
  hullForm as form,
  profile,
  reference,
  sectionFactsFor,
} from "./test-fixtures.js";

const draw = (id: SectionId, zones = form.zones) => {
  const facts = sectionFactsFor(id, zones);
  return render(
    <SectionDrawing
      facts={facts}
      frame={frame}
      profile={profile}
      draft={reference.draft}
      content={content}
      zones={zones}
    />,
  );
};

describe("SectionDrawing", () => {
  it("is a described image of the magnified section, on one horizontal scale", () => {
    const { getByRole } = draw("central-machinery");
    const image = getByRole("img");
    expect(image.getAttribute("data-testid")).toBe("section-drawing");
    expect(image.getAttribute("data-section")).toBe("central-machinery");
    const label = image.getAttribute("aria-label")!;
    expect(label).toContain("stations 280 to 520 permille");
    expect(label).toContain("plan above, profile below");
  });

  it("crops to the section with two bulkhead lines and band captions", () => {
    const { container } = draw("central-machinery");
    expect(container.querySelectorAll("[data-testid='section-bulkhead']")).toHaveLength(2);
    const captions = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(captions).toContain("Plan");
    expect(captions).toContain("Profile");
  });

  it("draws nothing when the hull form defines no zone for the section", () => {
    const { container } = draw("quarterdeck", []);
    expect(container.firstChild).toBeNull();
  });
});
