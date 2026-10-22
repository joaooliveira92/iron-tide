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
