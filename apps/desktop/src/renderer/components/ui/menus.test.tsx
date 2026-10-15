import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./context-menu.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

afterEach(cleanup);

describe("menu primitives in jsdom", () => {
  it("dropdown opens on click and fires item selection", async () => {
    const onClick = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onClick}>Do it</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Do it" }));
    expect(onClick).toHaveBeenCalled();
  });
  it("context menu opens on contextmenu", async () => {
    const onClick = vi.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger>Area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onClick}>Act</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText("Area"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Act" }));
    expect(onClick).toHaveBeenCalled();
  });
});
