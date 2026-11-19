/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { CampaignShellProvider } from "./CampaignShellContext.js";
import { GlobalSearch } from "./GlobalSearch.js";
import { MapSheet } from "./MapSheet.js";
import { HeaderCampaignMenu } from "./header/HeaderCampaignMenu.js";
import type { PrimaryAction } from "./primary-action.js";
import {
  HeaderToolbar,
  ScreenHeader,
  ScreenHeaderProvider,
  useScreenHeaderHost,
  useScreenHeaderSlot,
} from "./screen-header.js";
import { usePrimaryAction } from "./usePrimaryAction.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function listenerBalance(target: EventTarget, type: string) {
  const added = vi.spyOn(target, "addEventListener");
  const removed = vi.spyOn(target, "removeEventListener");
  const count = (calls: readonly unknown[][]) => calls.filter(([name]) => name === type).length;
  return { live: () => count(added.mock.calls) - count(removed.mock.calls) };
}

describe("campaign menu dismissal", () => {
  function renderMenu() {
    return render(
      <div>
        <span>outside</span>
        <HeaderCampaignMenu
          saving={false}
          onSave={() => {}}
          onCopy={() => {}}
          onCloseCampaign={() => {}}
        />
      </div>,
    );
  }
  const trigger = () => screen.getByRole("button", { name: /campaign menu/i });

  it("closes on a pointer press outside and stays open for one inside", () => {
    renderMenu();
    fireEvent.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and ignores other keys", () => {
    renderMenu();
    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: "a" });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("listens only while open and releases on close and unmount", () => {
    const balance = listenerBalance(document, "pointerdown");
    const view = renderMenu();
    expect(balance.live()).toBe(0);
    fireEvent.click(trigger());
    expect(balance.live()).toBe(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(balance.live()).toBe(0);
    fireEvent.click(trigger());
    expect(balance.live()).toBe(1);
    view.unmount();
    expect(balance.live()).toBe(0);
  });
});

describe("global search shortcut", () => {
  const targets = [{ id: "fleet", label: "Fleet" }];

  it("toggles the search dialog with Ctrl+F and ignores a bare F", () => {
    render(<GlobalSearch targets={targets} onNavigate={() => {}} />);
    fireEvent.keyDown(window, { key: "f" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "F", metaKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from the button and navigates to a chosen target", () => {
    const onNavigate = vi.fn();
    render(<GlobalSearch targets={targets} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Fle" } });
    fireEvent.click(screen.getByText("Fleet"));
    expect(onNavigate).toHaveBeenCalledWith("fleet");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the shortcut working across a target-list change and releases on unmount", () => {
    const balance = listenerBalance(window, "keydown");
    const view = render(<GlobalSearch targets={[]} onNavigate={() => {}} />);
    expect(balance.live()).toBe(1);
    view.rerender(<GlobalSearch targets={targets} onNavigate={() => {}} />);
    expect(balance.live()).toBe(1);
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    view.unmount();
    expect(balance.live()).toBe(0);
  });
});

describe("world map sheet shortcut", () => {
  it("toggles the sheet with F1 and skips text inputs", () => {
    render(
      <CampaignShellProvider bridge={undefined}>
        <input aria-label="note" />
        <MapSheet />
      </CampaignShellProvider>,
    );
    fireEvent.keyDown(screen.getByLabelText("note"), { key: "F1" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "F1" });
    expect(screen.getByRole("dialog", { name: "World Map" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "F1" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "F2" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("releases the shortcut on unmount", () => {
    const balance = listenerBalance(window, "keydown");
    const view = render(
      <CampaignShellProvider bridge={undefined}>
        <MapSheet />
      </CampaignShellProvider>,
    );
    expect(balance.live()).toBeGreaterThan(0);
    view.unmount();
    expect(balance.live()).toBe(0);
  });
});

describe("screen header registration", () => {
  function Slot() {
    const { spec, toolbarUsed, bindToolbar } = useScreenHeaderSlot();
    return (
      <div>
        <span data-testid="title">{spec?.title ?? "none"}</span>
        <span data-testid="used">{String(toolbarUsed)}</span>
        <div data-testid="toolbar" ref={bindToolbar} />
      </div>
    );
  }

  function Harness({ initial }: { readonly initial: boolean }) {
    const [shown, setShown] = useState(initial);
    const [title, setTitle] = useState("Fleet");
    const [toolbar, setToolbar] = useState(false);
    return (
      <ScreenHeaderProvider>
        <Slot />
        {shown && <ScreenHeader title={title}>{toolbar ? <b>tools</b> : null}</ScreenHeader>}
        <button onClick={() => setShown((value) => !value)}>toggle</button>
        <button onClick={() => setTitle("Ports")}>retitle</button>
        <button onClick={() => setToolbar((value) => !value)}>tools</button>
      </ScreenHeaderProvider>
    );
  }

  it("publishes the title on mount, follows prop changes and clears on unmount", () => {
    render(<Harness initial />);
    expect(screen.getByTestId("title").textContent).toBe("Fleet");
    fireEvent.click(screen.getByText("retitle"));
    expect(screen.getByTestId("title").textContent).toBe("Ports");
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("title").textContent).toBe("none");
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("title").textContent).toBe("Ports");
  });

  it("portals toolbar children into the bound host and tracks whether a toolbar is used", () => {
    render(<Harness initial />);
    expect(screen.getByTestId("used").textContent).toBe("false");
    fireEvent.click(screen.getByText("tools"));
    expect(screen.getByTestId("used").textContent).toBe("true");
    expect(screen.getByTestId("toolbar").textContent).toBe("tools");
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("used").textContent).toBe("false");
    expect(screen.getByTestId("toolbar").textContent).toBe("");
  });

  it("reports a host only once a toolbar target is bound and renders HeaderToolbar inline without one", () => {
    function HostProbe() {
      return <span data-testid="host">{String(useScreenHeaderHost())}</span>;
    }
    render(
      <ScreenHeaderProvider>
        <HostProbe />
        <Slot />
      </ScreenHeaderProvider>,
    );
    expect(screen.getByTestId("host").textContent).toBe("true");
    cleanup();
    render(<HeaderToolbar>inline</HeaderToolbar>);
    expect(screen.getByText("inline")).toBeTruthy();
  });

  it("is inert without a provider", () => {
    expect(() => render(<ScreenHeader title="Alone" />)).not.toThrow();
  });
});

describe("primary action registration", () => {
  const action = (label: string): PrimaryAction => ({
    label,
    disabled: false,
    onTrigger: () => {},
  });

  it("registers on mount, swaps on change and clears on unmount", () => {
    const onChange = vi.fn();
    const first = action("Next");
    const second = action("Finish");
    const view = renderHook(({ current }) => usePrimaryAction(current, onChange), {
      initialProps: { current: first as PrimaryAction | null },
    });
    expect(onChange.mock.calls).toEqual([[first]]);
    view.rerender({ current: second });
    expect(onChange.mock.calls).toEqual([[first], [null], [second]]);
    view.unmount();
    expect(onChange.mock.calls.at(-1)).toEqual([null]);
  });

  it("registers nothing for a null action", () => {
    const onChange = vi.fn();
    const view = renderHook(() => usePrimaryAction(null, onChange));
    view.unmount();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("re-registers when the change callback is replaced", () => {
    const one = vi.fn();
    const two = vi.fn();
    const current = action("Go");
    const view = renderHook(({ cb }) => usePrimaryAction(current, cb), {
      initialProps: { cb: one },
    });
    act(() => view.rerender({ cb: two }));
    expect(one.mock.calls).toEqual([[current], [null]]);
    expect(two.mock.calls).toEqual([[current]]);
  });
});
