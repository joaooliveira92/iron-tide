import { test, expect } from "./fixtures.js";

test("Electron boots hermetically, renders the shell landing, and rejects debug-only commands", async ({
  e2e,
}) => {
  expect(e2e.page.url()).not.toContain("localhost");
  await expect(e2e.page.getByText("Bluewave Naval Staff")).toBeVisible();

  // The debug-only Tactical Sandbox commands are rejected in a normal build.
  const reason = await e2e.page.evaluate(async () => {
    const bridge = (
      window as unknown as {
        bluewave: {
          campaign: { execute(command: string, payload: unknown): Promise<{ reason?: string }> };
        };
      }
    ).bluewave;
    return (await bridge.campaign.execute("generateBattle", { sessionId: "x", warId: "w" })).reason;
  });
  expect(reason).toBe("DEBUG_ONLY");
});
