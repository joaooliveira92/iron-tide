/**
 * Resolves once the page's DOM has stopped changing structurally for `quietMs`, or reports it never
 * did within `maxMs`. Runs inside the page (`page.evaluate(waitForQuiet, ...)`), so it must stay
 * self-contained: no imports, no references outside its own body.
 *
 * Only structural mutations (nodes added/removed, text changed) count. Continuous animation (the
 * globe, shaders) rewrites attributes every frame and would otherwise never settle.
 */
export function waitForQuiet(opts: {
  readonly quietMs: number;
  readonly maxMs: number;
}): Promise<{ settled: boolean }> {
  return new Promise((done) => {
    let quiet: ReturnType<typeof setTimeout>;
    const finish = (settled: boolean) => {
      observer.disconnect();
      clearTimeout(quiet);
      clearTimeout(ceiling);
      done({ settled });
    };
    const observer = new MutationObserver((records) => {
      if (records.every((r) => r.type === "attributes")) return;
      clearTimeout(quiet);
      quiet = setTimeout(() => finish(true), opts.quietMs);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    quiet = setTimeout(() => finish(true), opts.quietMs);
    const ceiling = setTimeout(() => finish(false), opts.maxMs);
  });
}
