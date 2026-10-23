import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { StrategicPriority } from "@bluewave/campaign-engine";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { MAX_VISIBLE_PRIORITIES, PrioritiesCard } from "./PrioritiesCard.js";

const priority = (over: Partial<StrategicPriority> & { id: string }): StrategicPriority => ({
  type: "monthly_deficit",
  severity: "warning",
  title: "Monthly deficit",
  summary: "Spending exceeds income by 56.",
  reason: "r",
  destination: "construction",
  fingerprint: over.id,
  ...over,
});

describe("PrioritiesCard", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(cleanup);

  it("shows loading, unavailable and empty states honestly", () => {
    const { rerender } = render(
      <PrioritiesCard state={{ status: "loading" }} onNavigate={() => undefined} />,
    );
    expect(screen.getByText(/Reading the Admiralty/)).toBeTruthy();
    rerender(<PrioritiesCard state={{ status: "unavailable" }} onNavigate={() => undefined} />);
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
    rerender(
      <PrioritiesCard state={{ status: "ready", priorities: [] }} onNavigate={() => undefined} />,
    );
    expect(screen.getByText("The Admiralty has identified no urgent concerns.")).toBeTruthy();
  });

  it("shows severity, title and summary, and links to where the player can act", () => {
    const onNavigate = vi.fn();
    render(
      <PrioritiesCard
        state={{
          status: "ready",
          priorities: [
            priority({
              id: "a",
              severity: "critical",
              title: "Cash reserve critical",
              destination: "treasury" as never,
            }),
            priority({
              id: "b",
              severity: "advisory",
              title: "Low research",
              destination: "research",
            }),
          ],
        }}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText("Critical")).toBeTruthy();
    expect(screen.getByText("Advisory")).toBeTruthy();
    expect(screen.getByText("Cash reserve critical")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Go to Research/ }));
    expect(onNavigate).toHaveBeenCalledWith("research");
  });

  it("offers no link for a concern that already lives on the Overview", () => {
    render(
      <PrioritiesCard
        state={{ status: "ready", priorities: [priority({ id: "o", destination: "overview" })] }}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("caps the list and says how many more there are", () => {
    const many = Array.from({ length: MAX_VISIBLE_PRIORITIES + 2 }, (_, i) =>
      priority({ id: `p${i}`, title: `Concern ${i}` }),
    );
    render(
      <PrioritiesCard state={{ status: "ready", priorities: many }} onNavigate={() => undefined} />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(MAX_VISIBLE_PRIORITIES);
    expect(screen.getByText("and 2 more concerns")).toBeTruthy();
  });
});
