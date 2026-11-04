/* @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { SortableList, useSortableList } from "./sortable-list.js";

const ITEMS = [{ id: "a" }, { id: "b" }];

function getItemLabel(item: { id: string }): string {
  return item.id.toUpperCase();
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
      <SortableList items={ITEMS} getItemLabel={getItemLabel}>
        {consumer}
      </SortableList>,
    );
    const afterMount = consumerRenders;
    rerender(
      <SortableList items={ITEMS} getItemLabel={getItemLabel}>
        {consumer}
      </SortableList>,
    );
    expect(consumerRenders).toBe(afterMount);
  });

  it("gives each item its 1-based position within the set", () => {
    const { container } = render(
      <SortableList items={ITEMS} getItemLabel={getItemLabel} renderItem={(item) => item.id} />,
    );
    const positions = Array.from(container.querySelectorAll("li")).map((li) =>
      li.getAttribute("aria-posinset"),
    );
    expect(positions).toEqual(["1", "2"]);
  });
});
