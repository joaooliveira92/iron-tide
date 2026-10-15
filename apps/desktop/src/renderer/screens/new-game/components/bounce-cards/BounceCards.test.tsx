/* @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { BounceCards } from "./BounceCards.js";

const images = [{ src: "a.png" }, { src: "b.png" }, { src: "c.png" }];

function cardLayers(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll<HTMLDivElement>(".bounce-cards__card")).map((el) =>
    Number(el.style.zIndex),
  );
}

afterEach(() => {
  cleanup();
});

describe("BounceCards activeOnTop", () => {
  it("stacks the selected card above its siblings", () => {
    const { container } = render(<BounceCards images={images} activeIndex={0} activeOnTop />);

    const layers = cardLayers(container);
    expect(layers[0]).toBeGreaterThan(Math.max(...layers.slice(1)));
  });

  it("keeps the even fan when activeOnTop is off", () => {
    const { container } = render(<BounceCards images={images} activeIndex={0} />);

    expect(cardLayers(container)).toEqual([1, 2, 3]);
  });
});
