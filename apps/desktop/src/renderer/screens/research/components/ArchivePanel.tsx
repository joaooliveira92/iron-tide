import { Check } from "lucide-react";
import type { ResearchFieldView } from "../research-view-model.js";
import { fieldIcon } from "./field-icons.js";

export function ArchivePanel({ fields }: { readonly fields: readonly ResearchFieldView[] }) {
  const groups = fields
    .map((field) => ({ field, done: field.techs.filter((t) => t.status === "discovered") }))
    .filter((g) => g.done.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing is discovered yet. Your first breakthrough will be filed here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ field, done }) => {
        const Icon = fieldIcon(field.fieldId);
        return (
          <section key={field.fieldId} aria-label={field.label} className="space-y-1">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon aria-hidden="true" className="size-3.5" />
              {field.label}
              <span className="ml-auto tabular-nums">
                {done.length} of {field.totalTechs}
              </span>
            </h3>
            <ul className="space-y-0.5">
              {done.map((tech) => (
                <li key={tech.techId} className="flex items-center gap-1.5 text-sm">
                  <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                  {tech.label}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
