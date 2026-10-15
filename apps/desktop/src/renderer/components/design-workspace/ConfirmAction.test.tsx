import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ConfirmAction } from "./ConfirmAction.js";

afterEach(cleanup);

const setup = (confirm: boolean) => {
  const onConfirm = vi.fn();
  render(
    <ConfirmAction
      confirm={confirm}
      title="Replace your design?"
      description="Your unsaved edits will be lost."
      confirmLabel="Replace"
      onConfirm={onConfirm}
    >
      Load
    </ConfirmAction>,
  );
  return onConfirm;
};

describe("ConfirmAction", () => {
  it("acts immediately when nothing would be lost", () => {
    const onConfirm = setup(false);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("asks first, and only acts on confirmation", async () => {
    const onConfirm = setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(onConfirm).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Your unsaved edits will be lost.");
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
  it("does nothing when the player keeps what they have", async () => {
    const onConfirm = setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Keep what I have" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
