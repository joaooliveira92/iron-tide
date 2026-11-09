type Format = "JSON5" | "JSONC";
export declare const syntaxError: (text: string, at: number, format: Format) => SyntaxError;
export declare const parse: (text: string, format: Format) => unknown;
export {};
//# sourceMappingURL=jsonParser.d.ts.map