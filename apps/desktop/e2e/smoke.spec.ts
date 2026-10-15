import { test, expect } from "./fixtures.js";

test("Electron boots hermetically and the shell landing renders", async ({ e2e }) => {
  expect(e2e.page.url()).not.toContain("localhost");
  await expect(e2e.page.getByText("Bluewave Naval Staff")).toBeVisible();
  await expect(e2e.page.locator("body")).toContainText("Bluewave");
});

test("the debug-only Tactical Sandbox commands are rejected in a normal build", async ({ e2e }) => {
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
