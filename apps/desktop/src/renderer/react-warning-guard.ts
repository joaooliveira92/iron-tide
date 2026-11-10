import { BluewaveError } from "@bluewave/contracts";
import { format } from "node:util";
import { afterEach, beforeEach, vi, type MockInstance } from "vite-plus/test";

const REACT_DEFECT =
  /not wrapped in act|cannot be a descendant of|cannot contain a nested|hydration|validateDOMNesting/iu;

let errors: MockInstance<typeof console.error> | null = null;

beforeEach(() => {
  errors = vi.spyOn(console, "error");
});

afterEach(() => {
  const spy = errors;
  errors = null;
  if (spy === null) {
    return;
  }
  const defects = spy.mock.calls
    .map((args) => format(...args))
    .filter((message) => REACT_DEFECT.test(message));
  spy.mockRestore();
  if (defects.length > 0) {
    throw new BluewaveError(
      `React reported a defect during the test:\n${defects.join("\n---\n")}`,
      {
        defects,
      },
    );
  }
});
