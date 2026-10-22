import { Data } from "effect";

export type Severity = "error" | "warning" | "info";

export type DiagnosticCode = string & { readonly __diagnosticCode: never };

export interface SourceLocation {
  path: string;
  line: number;
  column?: number;
}

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  stage: string;
  message: string;
  sourceLocation?: SourceLocation;
  entityId?: string;
  relatedLocations?: SourceLocation[];
  remediation?: string;
}

export class DiagnosticError extends Data.TaggedError("DiagnosticError")<{
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly stage?: string;
  readonly sourceLocation?: SourceLocation;
  readonly entityId?: string;
  readonly relatedLocations?: SourceLocation[];
  readonly remediation?: string;
}> {
  toDiagnostic(): Diagnostic {
    return {
      code: this.code,
      severity: "error",
      stage: this.stage ?? "unknown",
      message: this.message,
      sourceLocation: this.sourceLocation,
      entityId: this.entityId,
      relatedLocations: this.relatedLocations,
      remediation: this.remediation,
    };
  }
}

export class DiagnosticCollector {
  private diagnostics: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  addError(
    code: string,
    message: string,
    options?: {
      stage?: string;
      sourceLocation?: SourceLocation;
      entityId?: string;
      relatedLocations?: SourceLocation[];
      remediation?: string;
    },
  ): void {
    this.add({
      code: code as DiagnosticCode,
      severity: "error",
      stage: options?.stage ?? "unknown",
      message,
      sourceLocation: options?.sourceLocation,
      entityId: options?.entityId,
      relatedLocations: options?.relatedLocations,
      remediation: options?.remediation,
    });
  }

  addWarning(
    code: string,
    message: string,
    options?: {
      stage?: string;
      sourceLocation?: SourceLocation;
      entityId?: string;
      remediation?: string;
    },
  ): void {
    this.add({
      code: code as DiagnosticCode,
      severity: "warning",
      stage: options?.stage ?? "unknown",
      message,
      sourceLocation: options?.sourceLocation,
      entityId: options?.entityId,
      remediation: options?.remediation,
    });
  }

  addInfo(
    code: string,
    message: string,
    options?: { stage?: string; sourceLocation?: SourceLocation; entityId?: string },
  ): void {
    this.add({
      code: code as DiagnosticCode,
      severity: "info",
      stage: options?.stage ?? "unknown",
      message,
      sourceLocation: options?.sourceLocation,
      entityId: options?.entityId,
    });
  }

  get all(): readonly Diagnostic[] {
    return this.diagnostics;
  }

  get errors(): readonly Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "error");
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  get warnings(): readonly Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "warning");
  }

  clear(): void {
    this.diagnostics = [];
  }

  toJSON(): string {
    return JSON.stringify(this.diagnostics, null, 2);
  }

  toHuman(_options?: { color?: boolean }): string {
    return this.diagnostics
      .map((d) => {
        const severity = d.severity.toUpperCase().padEnd(7);
        const location = d.sourceLocation
          ? `${d.sourceLocation.path}:${d.sourceLocation.line}`
          : "";
        const entity = d.entityId ? `[${d.entityId}]` : "";
        const remediation = d.remediation ? ` — ${d.remediation}` : "";
        return `${severity} ${d.code} ${location} ${entity} ${d.message}${remediation}`;
      })
      .join("\n");
  }
}
