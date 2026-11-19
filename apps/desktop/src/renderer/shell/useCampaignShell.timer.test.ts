/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { useCampaignShell } from "./useCampaignShell.js";
import { projection } from "./useCampaignShell.fixtures.js";

afterEach(() => {
  vi.useRealTimers();
});

const ok = <T>(value: T) => ({ outcome: "success" as const, value, diagnostics: [] });

describe("save message timer", () => {
  it("clears the pending save-message timer when the shell unmounts", async () => {
    vi.useFakeTimers();
    const execute = vi.fn(async (command: string) =>
      command === "inspectCampaign"
        ? ok({ projection })
        : command === "saveCampaign"
          ? ok({ revision: 4 })
          : ok({}),
    );
    const bridge = { campaign: { execute } } as BluewaveDesktopBridge;
    const { result, unmount } = renderHook(() => useCampaignShell(bridge));
    await act(() => result.current.openCampaign("ses-1"));
    const before = vi.getTimerCount();
    await act(() => result.current.saveCampaign());
    expect(vi.getTimerCount()).toBeGreaterThan(before);
    unmount();
    expect(vi.getTimerCount()).toBe(before);
  });
});
