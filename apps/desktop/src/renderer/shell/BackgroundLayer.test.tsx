/* @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const spies = vi.hoisted(() => ({
  auralis: vi.fn(),
  nebulore: vi.fn(),
  patternWaves: vi.fn(),
  shader: vi.fn(),
  stars: vi.fn(),
}));

vi.mock("../components/backgrounds/auralis.js", () => ({
  default: (props: unknown) => {
    spies.auralis(props);
    return null;
  },
}));

vi.mock("../components/backgrounds/nebulore.js", () => ({
  default: (props: unknown) => {
    spies.nebulore(props);
    return null;
  },
}));

vi.mock("../components/backgrounds/pattern-waves.js", () => ({
  default: (props: unknown) => {
    spies.patternWaves(props);
    return null;
  },
}));

vi.mock("../components/backgrounds/starts.js", () => ({
  StarsBackground: (props: unknown) => {
    spies.stars(props);
    return null;
  },
}));

vi.mock("../components/motion/shader-background.js", () => ({
  ShaderBackground: (props: unknown) => {
    spies.shader(props);
    return null;
  },
}));

import { BackgroundLayer } from "./BackgroundLayer.js";
import { AURALIS_PALETTE, NEBULORE_PALETTE, type ResolvedTheme } from "./background-palettes.js";

type Background = Parameters<typeof BackgroundLayer>[0]["background"];
type SpyProps = { colorBack?: string; colors?: readonly string[] };

const renderLayer = (background: Background, resolvedTheme: ResolvedTheme) =>
  render(<BackgroundLayer background={background} resolvedTheme={resolvedTheme} />);

const lastProps = (spy: ReturnType<typeof vi.fn>): SpyProps | undefined =>
  spy.mock.calls.at(-1)?.[0] as SpyProps | undefined;

afterEach(() => {
  cleanup();
  for (const spy of Object.values(spies)) spy.mockClear();
});

describe("BackgroundLayer theme to palette mapping", () => {
  it("gives auralis the light base colour in a light theme", () => {
    renderLayer("auralis", "light");
    expect(lastProps(spies.auralis)?.colorBack).toBe("#fff5f5");
    expect(lastProps(spies.auralis)?.colorBack).toBe(AURALIS_PALETTE.light.colorBack);
  });

  it("gives auralis the dark base colour in a dark theme", () => {
    renderLayer("auralis", "dark");
    expect(lastProps(spies.auralis)?.colorBack).toBe("#010103");
    expect(lastProps(spies.auralis)?.colors).toBe(AURALIS_PALETTE.dark.colors);
  });

  it("gives nebulore the light base colour in a light theme", () => {
    renderLayer("nebulore", "light");
    expect(lastProps(spies.nebulore)?.colorBack).toBe("#f5f5ff");
    expect(lastProps(spies.nebulore)?.colorBack).toBe(NEBULORE_PALETTE.light.colorBack);
  });

  it("gives nebulore the dark base colour in a dark theme", () => {
    renderLayer("nebulore", "dark");
    expect(lastProps(spies.nebulore)?.colorBack).toBe("#010103");
    expect(lastProps(spies.nebulore)?.colors).toBe(NEBULORE_PALETTE.dark.colors);
  });

  it("passes a stable palette array across renders", () => {
    renderLayer("auralis", "light");
    const first = lastProps(spies.auralis)?.colors;
    cleanup();
    renderLayer("auralis", "light");
    const second = lastProps(spies.auralis)?.colors;
    expect(second).toBe(first);
    expect(second).toBe(AURALIS_PALETTE.light.colors);
  });

  it("freezes the palette constants", () => {
    expect(Object.isFrozen(AURALIS_PALETTE)).toBe(true);
    expect(Object.isFrozen(AURALIS_PALETTE.light)).toBe(true);
    expect(Object.isFrozen(AURALIS_PALETTE.light.colors)).toBe(true);
  });
});
