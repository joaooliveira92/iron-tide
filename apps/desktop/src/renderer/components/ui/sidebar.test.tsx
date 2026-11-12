/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSkeletonIcon,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "./sidebar.js";

function mockViewport(mobile: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: mobile,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function StateProbe() {
  const { state, open, openMobile, isMobile } = useSidebar();
  return (
    <output data-testid="probe">{`${state}|${String(open)}|${String(openMobile)}|${String(isMobile)}`}</output>
  );
}

function probe(): string {
  return screen.getByTestId("probe").textContent;
}

function shell(providerProps: Partial<React.ComponentProps<typeof SidebarProvider>> = {}) {
  return (
    <SidebarProvider {...providerProps}>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Fleet</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Overview">Overview</SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
        <StateProbe />
      </SidebarInset>
    </SidebarProvider>
  );
}

function desktopRoot(container: HTMLElement): HTMLElement {
  const node = container.querySelector<HTMLElement>("[data-side]");
  if (node === null) throw new Error("sidebar root missing");
  return node;
}

describe("Sidebar", () => {
  beforeEach(() => mockViewport(false));
  afterEach(cleanup);

  it("starts expanded and exposes the layout attributes the stylesheet keys on", () => {
    const { container } = render(shell());
    const root = desktopRoot(container);

    expect(root.dataset.state).toBe("expanded");
    expect(root.dataset.collapsible).toBe("");
    expect(root.dataset.variant).toBe("sidebar");
    expect(root.dataset.side).toBe("left");
    expect(probe()).toBe("expanded|true|false|false");
  });

  it("honours defaultOpen={false} and reports the collapsed mode", () => {
    const { container } = render(shell({ defaultOpen: false }));
    const root = desktopRoot(container);

    expect(root.dataset.state).toBe("collapsed");
    expect(root.dataset.collapsible).toBe("icon");
  });

  it("toggles with Ctrl+B and Cmd+B, swallows the event, and ignores other keys", () => {
    render(shell());

    const ctrl = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, cancelable: true });
    act(() => {
      window.dispatchEvent(ctrl);
    });
    expect(ctrl.defaultPrevented).toBe(true);
    expect(probe()).toBe("collapsed|false|false|false");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });
    expect(probe()).toBe("expanded|true|false|false");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", ctrlKey: true }));
    });
    expect(probe()).toBe("expanded|true|false|false");
  });

  it("removes the window shortcut on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const view = render(shell());
    view.unmount();

    expect(remove.mock.calls.some(([type]) => type === "keydown")).toBe(true);
    remove.mockRestore();
  });

  it("is controllable: reports the request and keeps the controlled value", () => {
    const onOpenChange = vi.fn();
    render(shell({ open: true, onOpenChange }));

    fireEvent.click(screen.getByTitle("Toggle Sidebar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(probe()).toBe("expanded|true|false|false");
  });

  it("toggles from the trigger button, which is keyboard operable and named", () => {
    render(shell());
    const trigger = screen
      .getAllByRole("button", { name: "Toggle Sidebar" })
      .find((node) => node.dataset.sidebar === "trigger");
    if (trigger === undefined) throw new Error("trigger missing");

    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);

    expect(probe()).toBe("collapsed|false|false|false");
  });

  it("runs the consumer onClick before toggling", () => {
    const onClick = vi.fn();
    render(
      <SidebarProvider>
        <SidebarTrigger onClick={onClick} />
        <StateProbe />
      </SidebarProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(probe()).toBe("collapsed|false|false|false");
  });

  it("gives the rail a name and keeps it out of the tab order", () => {
    render(shell());
    const rail = screen.getByTitle("Toggle Sidebar");

    expect(rail.getAttribute("aria-label")).toBe("Toggle Sidebar");
    expect(rail.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(rail);
    expect(probe()).toBe("collapsed|false|false|false");
  });

  it("renders a plain panel without data attributes when collapsible is none", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <span>Static</span>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(container.querySelector("[data-side]")).toBeNull();
    expect(screen.getByText("Static").parentElement?.className).toContain("bg-sidebar");
  });

  it("places a right-hand floating sidebar via data attributes", () => {
    const { container } = render(
      <SidebarProvider>
        <Sidebar side="right" variant="floating">
          <span>Floating</span>
        </Sidebar>
      </SidebarProvider>,
    );
    const root = desktopRoot(container);

    expect(root.dataset.side).toBe("right");
    expect(root.dataset.variant).toBe("floating");
  });

  it("throws a named error when used outside the provider", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<StateProbe />)).toThrow(
      "useSidebar must be used within a SidebarProvider.",
    );
    error.mockRestore();
  });
});

describe("Sidebar on a narrow viewport", () => {
  beforeEach(() => mockViewport(true));
  afterEach(cleanup);

  it("keeps the panel closed until the trigger opens an accessible dialog", async () => {
    render(shell());

    await act(async () => undefined);
    expect(probe()).toBe("expanded|true|false|true");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));

    expect(probe()).toBe("expanded|true|true|true");
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("data-mobile")).toBe("true");
    expect(screen.getByText("Sidebar")).toBeTruthy();
    expect(screen.getByText("Displays the mobile sidebar.")).toBeTruthy();
  });
});

describe("SidebarMenuButton", () => {
  beforeEach(() => mockViewport(false));
  afterEach(cleanup);

  function renderButton(node: React.ReactNode) {
    return render(
      <SidebarProvider>
        <SidebarMenu>
          <SidebarMenuItem>{node}</SidebarMenuItem>
        </SidebarMenu>
      </SidebarProvider>,
    );
  }

  it("is a focusable named button that fires on click", () => {
    const onClick = vi.fn();
    renderButton(<SidebarMenuButton onClick={onClick}>Overview</SidebarMenuButton>);
    const button = screen.getByRole("button", { name: "Overview" });

    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.dataset.sidebar).toBe("menu-button");
  });

  it("marks the active entry through data-active", () => {
    renderButton(
      <>
        <SidebarMenuButton data-active>On</SidebarMenuButton>
        <SidebarMenuButton>Off</SidebarMenuButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "On" }).dataset.active).toBe("true");
    expect(screen.getByRole("button", { name: "Off" }).dataset.active).toBeUndefined();
  });

  it("carries the size variant as data-size and class", () => {
    renderButton(<SidebarMenuButton size="lg">Large</SidebarMenuButton>);
    const button = screen.getByRole("button", { name: "Large" });

    expect(button.dataset.size).toBe("lg");
    expect(button.className).toContain("h-12");
  });

  it("renders the supplied element instead of a button", () => {
    const { container } = renderButton(
      <SidebarMenuButton render={<a href="#fleet" />} data-active>
        Fleet
      </SidebarMenuButton>,
    );
    const link = screen.getByRole("link", { name: "Fleet" });

    expect(container.querySelector("button")).toBeNull();
    expect(link.dataset.sidebar).toBe("menu-button");
    expect(link.dataset.active).toBe("true");
    expect(link.className).toContain("peer/menu-button");
  });

  it("forwards a ref to the underlying button", () => {
    let node: HTMLButtonElement | null = null;
    renderButton(
      <SidebarMenuButton
        ref={(value) => {
          node = value;
        }}
      >
        Ref
      </SidebarMenuButton>,
    );

    expect((node as HTMLButtonElement | null)?.tagName).toBe("BUTTON");
  });
});

describe("Sidebar slots", () => {
  beforeEach(() => mockViewport(false));
  afterEach(cleanup);

  it("renders a group label as a div, or as the supplied element", () => {
    render(
      <SidebarProvider>
        <SidebarGroup>
          <SidebarGroupLabel>Plain</SidebarGroupLabel>
          <SidebarGroupLabel render={<h3 />}>Heading</SidebarGroupLabel>
        </SidebarGroup>
      </SidebarProvider>,
    );

    expect(screen.getByText("Plain").tagName).toBe("DIV");
    expect(screen.getByText("Plain").dataset.sidebar).toBe("group-label");
    expect(screen.getByRole("heading", { name: "Heading" }).dataset.sidebar).toBe("group-label");
  });

  it("draws the skeleton icon only when it is composed in", () => {
    const { container, rerender } = render(<SidebarMenuSkeleton />);
    expect(container.querySelector('[data-sidebar="menu-skeleton-icon"]')).toBeNull();
    expect(container.querySelector('[data-sidebar="menu-skeleton-text"]')).not.toBeNull();

    rerender(
      <SidebarMenuSkeleton>
        <SidebarMenuSkeletonIcon />
      </SidebarMenuSkeleton>,
    );
    const icon = container.querySelector('[data-sidebar="menu-skeleton-icon"]');
    expect(icon).not.toBeNull();
    expect(icon?.nextElementSibling?.getAttribute("data-sidebar")).toBe("menu-skeleton-text");
  });
});
