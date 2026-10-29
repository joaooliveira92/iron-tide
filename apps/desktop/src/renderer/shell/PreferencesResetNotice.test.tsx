import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { dismissToast, Toaster } from "../components/ui/toast.js";
import {
  PREFERENCES_RESET_TOAST_ID,
  PreferencesResetNotice,
  preferencesResetMessage,
} from "./PreferencesResetNotice.js";

describe("preferences reset notice", () => {
  afterEach(() => {
    dismissToast(PREFERENCES_RESET_TOAST_ID);
  });

  it.each(["unparseable", "undecodable", "unknown-version:9"])(
    "names the %s reason and the file the player can inspect",
    (reason) => {
      const message = preferencesResetMessage({
        file: "/home/player/.config/bluewave/preferences.json",
        reason,
      });
      expect(message).toContain(reason);
      expect(message).toContain("/home/player/.config/bluewave/preferences.json");
      expect(message).toContain("defaults");
      expect(message).toContain("left untouched");
    },
  );

  it("shows one dismissible notice when the startup snapshot reports a recovery", async () => {
    render(
      <>
        <Toaster />
        <PreferencesResetNotice
          recovery={{ file: "/tmp/preferences.json", reason: "unparseable" }}
        />
      </>,
    );

    await waitFor(() => expect(screen.getByText(/could not read your preferences/)).toBeTruthy());
    expect(screen.getByLabelText("Dismiss")).toBeTruthy();
  });

  it("shows no notice when preferences loaded normally", async () => {
    render(
      <>
        <Toaster />
        <PreferencesResetNotice recovery={undefined} />
      </>,
    );
    await act(async () => {});
    expect(screen.queryByText(/could not read your preferences/)).toBeNull();
  });
});
