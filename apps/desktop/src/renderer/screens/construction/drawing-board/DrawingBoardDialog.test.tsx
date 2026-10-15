import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DrawingBoardDialog } from "./DrawingBoardDialog.js";

afterEach(cleanup);

describe("DrawingBoardDialog", () => {
  it("shows a launcher, and opens the drawing board in a modal dialog", () => {
    render(<DrawingBoardDialog />);
    expect(screen.queryByTestId("drawing-board")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /open drawing board/i }));
    expect(screen.getByRole("dialog", { name: "Drawing Board" })).toBeTruthy();
    expect(screen.getByTestId("drawing-board")).toBeTruthy();
  });
});
