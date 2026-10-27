import { test, expect, expectOverview } from "./fixtures.js";
import { startNewCampaign } from "./flows.js";

test.describe("renderer shell security (production loading path)", () => {
  test("the renderer is loaded over file:// with an effective CSP", async ({ e2e }) => {
    expect(e2e.page.url().startsWith("file://")).toBe(true);

    const probe = await e2e.page.evaluate(async () => {
      const violated: string[] = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        violated.push(event.violatedDirective);
      });

      const script = document.createElement("script");
      script.textContent = "window.__cspInlineProbe = true;";
      document.head.append(script);

      Reflect.apply(setTimeout, window, ["window.__cspEvalProbe = true;", 0]);

      const base = document.createElement("base");
      base.href = "https://example.com/";
      document.head.append(base);
      const baseResolved = new URL("x", document.baseURI).href;
      base.remove();

      let fetchOutcome = "allowed";
      try {
        await fetch("https://example.com/");
      } catch {
        fetchOutcome = "blocked";
      }

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        violated,
        inlineScriptRan: Reflect.get(window, "__cspInlineProbe") === true,
        evalRan: Reflect.get(window, "__cspEvalProbe") === true,
        baseResolved,
        fetchOutcome,
      };
    });

    expect(probe.violated).toEqual(
      expect.arrayContaining(["script-src-elem", "script-src", "connect-src"]),
    );
    expect(probe.inlineScriptRan).toBe(false);
    expect(probe.evalRan).toBe(false);
    expect(probe.fetchOutcome).toBe("blocked");
    expect(probe.violated).toContain("base-uri");
    expect(probe.baseResolved.startsWith("file://")).toBe(true);
  });

  test("renderer-created windows and external navigation are denied", async ({ e2e }) => {
    const entry = e2e.page.url();

    const opened = await e2e.page.evaluate(() => window.open("https://example.com/") !== null);
    expect(opened).toBe(false);

    for (const target of ["https://example.com/", "http://example.com/", "file:///etc/hosts"]) {
      await e2e.app.evaluate(({ BrowserWindow }) => {
        const contents = BrowserWindow.getAllWindows()[0]!.webContents;
        Reflect.set(
          globalThis,
          "__navPrevented",
          new Promise((resolve) => {
            contents.once("will-navigate", (event) => resolve(event.defaultPrevented));
          }),
        );
      });
      await e2e.page.evaluate((url) => {
        window.location.href = url;
      }, target);
      const prevented = await e2e.app.evaluate(() => Reflect.get(globalThis, "__navPrevented"));
      expect(prevented, target).toBe(true);
    }

    expect(e2e.app.windows().filter((win) => !win.url().startsWith("devtools://"))).toHaveLength(1);
    expect(e2e.page.url()).toBe(entry);
  });

  test("the renderer is sandboxed with context isolation and no node integration", async ({
    e2e,
  }) => {
    const prefs = await e2e.app.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0]!.webContents;
      const prefs: Record<string, unknown> = Object(
        Reflect.apply(Reflect.get(contents, "getLastWebPreferences"), contents, []),
      );
      return {
        sandbox: prefs.sandbox,
        contextIsolation: prefs.contextIsolation,
        nodeIntegration: prefs.nodeIntegration,
      };
    });
    expect(prefs).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
    expect(await e2e.page.evaluate(() => typeof require)).toBe("undefined");
  });

  test("a reload of the trusted entry point still works", async ({ e2e }) => {
    await e2e.page.reload();
    await expect(e2e.page.getByText("Bluewave Naval Staff")).toBeVisible();
  });

  test("permissions are denied except clipboard write", async ({ e2e }) => {
    const outcome = await e2e.page.evaluate(async () => {
      const notification = await Notification.requestPermission();
      const geolocation = await new Promise<number>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(0),
          (error) => resolve(error.code),
          { timeout: 2000 },
        );
      });
      const media = await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => "granted")
        .catch((error: unknown) => (error instanceof Error ? error.name : "denied"));
      window.focus();
      const clipboard = await navigator.clipboard
        .writeText("shell-security")
        .then(() => "written")
        .catch((error: unknown) => (error instanceof Error ? error.name : "denied"));
      return { notification, geolocation, media, clipboard };
    });

    expect(outcome.notification).toBe("denied");
    expect(outcome.geolocation).toBe(1);
    expect(outcome.media).not.toBe("granted");
    expect(outcome.clipboard).toBe("written");
  });

  test("a new campaign and the shipbuilding workspace raise no CSP violations", async ({ e2e }) => {
    await e2e.page.evaluate(() => {
      const bag: string[] = [];
      Reflect.set(window, "__cspViolations", bag);
      document.addEventListener("securitypolicyviolation", (event) => {
        bag.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    await startNewCampaign(e2e.page);
    await expectOverview(e2e.page);
    const violations = await e2e.page.evaluate(() => Reflect.get(window, "__cspViolations"));
    expect(violations).toEqual([]);
  });
});
