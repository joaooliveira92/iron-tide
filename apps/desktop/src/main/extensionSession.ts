/**
 * `electron-devtools-installer@4.0.0` (the latest release) calls the deprecated
 * `session.loadExtension` / `session.getAllExtensions`, which Electron 44 warns
 * about. This adapter forwards exactly those two calls to the modern
 * `session.extensions.*` API (ADR-0118); every other member is delegated to the
 * real session — bound to it — so native methods keep working.
 */

/** The sliver of `Electron.Session` this adapter touches. */
export interface ExtensionSessionLike {
  readonly extensions: {
    getAllExtensions(): readonly unknown[];
    loadExtension(path: string, options?: Electron.LoadExtensionOptions): unknown;
  };
  getAllExtensions(): readonly unknown[];
  loadExtension(path: string, options?: Electron.LoadExtensionOptions): unknown;
}

export function withModernExtensionApi<T extends ExtensionSessionLike>(real: T): T {
  return new Proxy(real, {
    get(target, property, receiver) {
      if (property === "getAllExtensions") {
        return () => target.extensions.getAllExtensions();
      }
      if (property === "loadExtension") {
        return (path: string, options?: Electron.LoadExtensionOptions) =>
          target.extensions.loadExtension(path, options);
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
