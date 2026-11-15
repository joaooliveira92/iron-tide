import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DeltaPreview } from "./DeltaPreview.js";
import type { Delta } from "./optionDelta.js";

afterEach(cleanup);

const rows: readonly Delta[] = [
  { id: "speed", label: "Speed", text: "+1.2 kn", direction: "up", tone: "better" },
  { id: "cost", label: "Cost", text: "+4%", direction: "up", tone: "worse" },
  { id: "displacement", label: "Displacement", text: "-10 t", direction: "down", tone: "neutral" },
  { id: "legacy", label: "Legacy", text: "from 1885-01", direction: "flat" },
];

describe("DeltaPreview", () => {
  it("states direction and tone in words, not only colour", () => {
    render(<DeltaPreview deltas={rows} />);
    const list = screen.getByTestId("delta-preview");
    const speed = within(list).getByText("Speed").closest("li")!;
    expect(speed.getAttribute("data-tone")).toBe("better");
    expect(speed.textContent).toMatch(/↑/);
    expect(speed.textContent).toMatch(/better/);
    const cost = within(list).getByText("Cost").closest("li")!;
    expect(cost.getAttribute("data-tone")).toBe("worse");
    expect(cost.textContent).toMatch(/↑/);
    expect(cost.textContent).toMatch(/worse/);
    const displacement = within(list).getByText("Displacement").closest("li")!;
    expect(displacement.textContent).toMatch(/↓/);
    expect(displacement.textContent).not.toMatch(/better|worse/);
  });

  it("treats a delta without a tone as neutral", () => {
    render(<DeltaPreview deltas={rows} />);
    const legacy = screen.getByText("Legacy").closest("li")!;
    expect(legacy.getAttribute("data-tone")).toBe("neutral");
    expect(legacy.textContent).toMatch(/→/);
  });

  it("renders nothing for no deltas", () => {
    const { container } = render(<DeltaPreview deltas={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("announces the deltas politely and whole, led by what they describe", () => {
    render(<DeltaPreview deltas={rows} label="Effect of the highlighted gun" />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(region.textContent).toMatch(/^Effect of the highlighted gun: /);
    expect(within(region).getByTestId("delta-preview")).toBeTruthy();
    expect(region.textContent).toMatch(/Speed.*up.*\+1\.2 kn.*better/);
    expect(region.textContent).toMatch(/Cost.*up.*\+4%.*worse/);
  });
});
