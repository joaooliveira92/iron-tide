/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WeightControl, type WeightControlProps } from "./WeightControl.js";

afterEach(cleanup);

function renderControl(props: Partial<WeightControlProps> = {}) {
  const onSetWeight = vi.fn();
  render(
    <WeightControl
      label="Gunnery"
      weight={2}
      highBlocked={false}
      highCap={5}
      disabled={false}
      onSetWeight={onSetWeight}
      {...props}
    />,
  );
  return onSetWeight;
}

describe("WeightControl", () => {
  it("offers the three weights and reports the pressed one", () => {
    renderControl();
    expect(screen.getByRole("group", { name: "Gunnery" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gunnery Med" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Gunnery High" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("reports the chosen weight", () => {
    const onSetWeight = renderControl();
    fireEvent.click(screen.getByRole("button", { name: "Gunnery High" }));
    expect(onSetWeight).toHaveBeenCalledWith(4);
  });

  it("blocks only High, with an explanation, when the High cap is reached", () => {
    renderControl({ highBlocked: true });
    const high = screen.getByRole("button", { name: "Gunnery High" });
    expect(high.hasAttribute("disabled")).toBe(true);
    expect(high.getAttribute("title")).toMatch(/at most 5 fields may be high/i);
    expect(screen.getByRole("button", { name: "Gunnery Low" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("keeps High usable for a field that already holds it", () => {
    renderControl({ highBlocked: true, weight: 4 });
    expect(screen.getByRole("button", { name: "Gunnery High" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("disables everything while a submit is in flight", () => {
    renderControl({ disabled: true });
    expect(screen.getByRole("button", { name: "Gunnery Low" }).hasAttribute("disabled")).toBe(true);
  });
});
