import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DesignStatusChip, type DesignStatus } from "./DesignStatusChip.js";

afterEach(cleanup);

const status = (over: Partial<DesignStatus> = {}): DesignStatus => ({
  label: "Can be submitted",
  tone: "ok",
  detail: "0 blocking",
  ...over,
});

describe("DesignStatusChip", () => {
  it("announces each status tone", () => {
    const { rerender } = render(<DesignStatusChip status={status()} />);
    expect(screen.getByRole("status").textContent).toContain("Can be submitted");
    rerender(<DesignStatusChip status={status({ label: "Needs a class name", tone: "warn" })} />);
    expect(screen.getByRole("status").textContent).toContain("Needs a class name");
    rerender(<DesignStatusChip status={status({ label: "Cannot be built", tone: "bad" })} />);
    expect(screen.getByRole("status").textContent).toContain("Cannot be built");
  });

  it("turns the status into a button that runs the fix when one is given", () => {
    const onAction = vi.fn<() => void>();
    const needsName = status({ label: "Needs a class name", tone: "warn", detail: "" });
    const { rerender } = render(<DesignStatusChip status={needsName} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<DesignStatusChip status={needsName} onAction={onAction} />);
    expect(screen.getByRole("status")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Needs a class name.*Activate to fix$/ }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
