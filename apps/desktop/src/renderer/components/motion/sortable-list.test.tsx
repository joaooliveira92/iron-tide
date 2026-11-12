/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SortableList, useSortableList } from "./sortable-list.js";

type Entry = { id: string };

const ITEMS: Entry[] = [{ id: "a" }, { id: "b" }, { id: "c" }];

const onItemsChange = (): void => undefined;

function getItemLabel(item: Entry): string {
  return item.id.toUpperCase();
}

function order(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("li")).map((li) => li.textContent ?? "");
}

function handle(id: string): HTMLElement {
  return screen.getByRole("button", { name: `Reorder ${id.toUpperCase()}` });
}

function entries(items: Entry[]) {
  return (
    <>
      <SortableList.Group>
        {items.map((item) => (
          <SortableList.Item key={item.id} id={item.id}>
            <SortableList.Handle />
            <SortableList.Content>{item.id}</SortableList.Content>
          </SortableList.Item>
        ))}
      </SortableList.Group>
      <SortableList.Undo />
    </>
  );
}

function StaticList({ items }: { items: Entry[] }) {
  return (
    <SortableList items={items} onItemsChange={() => undefined} getItemLabel={getItemLabel}>
      {entries(items)}
    </SortableList>
  );
}

function ControlledList({
  onItemsChange,
  disabled,
}: {
  onItemsChange?: (items: Entry[]) => void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState(ITEMS);
  return (
    <SortableList
      items={items}
      onItemsChange={(next) => {
        setItems(next);
        onItemsChange?.(next);
      }}
      getItemLabel={getItemLabel}
      disabled={disabled}
    >
      {entries(items)}
    </SortableList>
  );
}

describe("SortableList", () => {
  afterEach(cleanup);

  it("keeps its context value stable when a parent re-renders with the same items", () => {
    let consumerRenders = 0;
    function Consumer() {
      useSortableList();
      consumerRenders += 1;
      return null;
    }
    const consumer = <Consumer />;
    const { rerender } = render(
      <SortableList items={ITEMS} onItemsChange={onItemsChange} getItemLabel={getItemLabel}>
        {consumer}
      </SortableList>,
    );
    const afterMount = consumerRenders;
    rerender(
      <SortableList items={ITEMS} onItemsChange={onItemsChange} getItemLabel={getItemLabel}>
        {consumer}
      </SortableList>,
    );
    expect(consumerRenders).toBe(afterMount);
  });

  it("gives each item its 1-based position within the set", () => {
    const { container } = render(<StaticList items={ITEMS} />);
    const positions = Array.from(container.querySelectorAll("li")).map((li) =>
      li.getAttribute("aria-posinset"),
    );
    expect(positions).toEqual(["1", "2", "3"]);
    expect(container.querySelector("li")?.getAttribute("aria-setsize")).toBe("3");
  });

  it("moves an item down and up with the arrow keys and reports each new order", () => {
    const onItemsChange = vi.fn();
    const { container } = render(<ControlledList onItemsChange={onItemsChange} />);

    fireEvent.keyDown(handle("a"), { key: "ArrowDown" });
    expect(order(container)).toEqual(["b", "a", "c"]);
    expect(onItemsChange).toHaveBeenLastCalledWith([{ id: "b" }, { id: "a" }, { id: "c" }]);

    fireEvent.keyDown(handle("a"), { key: "ArrowUp" });
    expect(order(container)).toEqual(["a", "b", "c"]);
  });

  it("moves an item to either edge with Home and End", () => {
    const { container } = render(<ControlledList />);

    fireEvent.keyDown(handle("b"), { key: "End" });
    expect(order(container)).toEqual(["a", "c", "b"]);

    fireEvent.keyDown(handle("b"), { key: "Home" });
    expect(order(container)).toEqual(["b", "a", "c"]);
  });

  it("does not move an item past either end", () => {
    const onItemsChange = vi.fn();
    const { container } = render(<ControlledList onItemsChange={onItemsChange} />);

    fireEvent.keyDown(handle("a"), { key: "ArrowUp" });
    fireEvent.keyDown(handle("c"), { key: "ArrowDown" });

    expect(order(container)).toEqual(["a", "b", "c"]);
    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it("announces a keyboard move to assistive technology", () => {
    render(<ControlledList />);

    fireEvent.keyDown(handle("a"), { key: "ArrowDown" });

    expect(screen.getByRole("status").textContent).toBe("A moved to position 2 of 3.");
  });

  it("restores the previous order with undo and disables undo when there is nothing to restore", () => {
    const { container } = render(<ControlledList />);
    const undo = screen.getByRole("button", { name: "Undo reorder" }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);

    fireEvent.keyDown(handle("a"), { key: "End" });
    expect(order(container)).toEqual(["b", "c", "a"]);
    expect(undo.disabled).toBe(false);

    fireEvent.click(undo);
    expect(order(container)).toEqual(["a", "b", "c"]);
    expect(undo.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Previous order restored.");
  });

  it("drops undo when the id set changes and does not revive the old order when the set returns", () => {
    let setFromParent: (items: Entry[]) => void = () => undefined;
    function Host() {
      const [items, setItems] = useState(ITEMS);
      setFromParent = setItems;
      return (
        <SortableList items={items} onItemsChange={setItems} getItemLabel={getItemLabel}>
          {entries(items)}
        </SortableList>
      );
    }
    render(<Host />);
    const undo = () => screen.getByRole("button", { name: "Undo reorder" }) as HTMLButtonElement;

    fireEvent.keyDown(handle("a"), { key: "End" });
    expect(undo().disabled).toBe(false);

    act(() => setFromParent([{ id: "b" }, { id: "a" }]));
    expect(undo().disabled).toBe(true);

    act(() => setFromParent([{ id: "b" }, { id: "a" }, { id: "c" }]));
    expect(undo().disabled).toBe(true);
  });

  it("keeps the context identity across announcement-only updates", () => {
    let renders = 0;
    function Consumer() {
      useSortableList();
      renders += 1;
      return null;
    }
    render(
      <SortableList items={ITEMS} onItemsChange={onItemsChange} getItemLabel={getItemLabel}>
        {entries(ITEMS)}
        <Consumer />
      </SortableList>,
    );

    fireEvent.keyDown(handle("a"), { key: "ArrowDown" });
    const afterFirstMove = renders;
    fireEvent.keyDown(handle("a"), { key: "ArrowDown" });

    expect(screen.getByRole("status").textContent).not.toBe("");
    expect(renders).toBe(afterFirstMove);
  });

  it("ignores keyboard moves while disabled", () => {
    const onItemsChange = vi.fn();
    const { container } = render(<ControlledList onItemsChange={onItemsChange} disabled />);

    expect((handle("a") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(handle("a"), { key: "ArrowDown" });

    expect(order(container)).toEqual(["a", "b", "c"]);
    expect(onItemsChange).not.toHaveBeenCalled();
  });

  it("rejects duplicate item ids", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => render(<StaticList items={[{ id: "a" }, { id: "a" }]} />)).toThrow(
        "SortableList requires unique item ids.",
      );
    } finally {
      quiet.mockRestore();
    }
  });
});
