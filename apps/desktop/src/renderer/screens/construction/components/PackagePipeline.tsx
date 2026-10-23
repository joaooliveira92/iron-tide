import { Check } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import type { PackageRow, PackageState, ProjectRow } from "../project-progress.js";
import { Peek, PeekRows } from "./Peek.js";

export const PACKAGE_STATE_TEXT: Record<PackageState, string> = {
  done: "Done",
  active: "In progress",
  ready: "Ready to start",
  waiting: "Waiting",
};

const BLOCK: Record<PackageState, string> = {
  done: "bg-success/20 text-foreground",
  active: "bg-muted text-foreground",
  ready: "border border-dashed border-foreground/30 text-muted-foreground",
  waiting: "bg-muted/50 text-muted-foreground",
};

const FILL: Record<PackageState, string> = {
  done: "bg-success/25",
  active: "bg-primary/30",
  ready: "",
  waiting: "",
};

export const packageStateText = (pkg: PackageRow): string =>
  pkg.state === "active"
    ? `${PACKAGE_STATE_TEXT.active} · ${pkg.percent}%`
    : PACKAGE_STATE_TEXT[pkg.state];

function PackageBlock({ pkg }: { readonly pkg: PackageRow }) {
  const stateText = packageStateText(pkg);
  return (
    <li className="min-w-0 flex-1">
      <Peek
        trigger={
          <span
            tabIndex={0}
            role="group"
            aria-label={`${pkg.label}: ${stateText}`}
            data-state={pkg.state}
            className={cn(
              "relative flex h-8 cursor-default items-center gap-1 overflow-hidden rounded-md px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
              BLOCK[pkg.state],
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-0 left-0 transition-[width] duration-500",
                FILL[pkg.state],
              )}
              style={{ width: `${pkg.percent}%` }}
            />
            {pkg.state === "done" && (
              <Check aria-hidden="true" className="relative size-3 shrink-0 text-success" />
            )}
            <span className="relative truncate">{pkg.label}</span>
          </span>
        }
      >
        <PeekRows
          title={pkg.label}
          rows={[
            { label: "State", value: stateText },
            { label: "Complete", value: `${pkg.percent}%` },
            {
              label: "Starts after",
              value: pkg.dependsOn.length === 0 ? "nothing" : pkg.dependsOn.join(", "),
            },
          ]}
        />
      </Peek>
    </li>
  );
}

export function PackagePipeline({ row }: { readonly row: ProjectRow }) {
  return (
    <ol aria-label={`${row.className} work packages`} className="flex items-stretch gap-1">
      {row.packages.map((pkg) => (
        <PackageBlock key={pkg.id} pkg={pkg} />
      ))}
    </ol>
  );
}
