import type { LucideIcon } from "lucide-react";

export function SectionBadge({ icon: Icon }: { readonly icon: LucideIcon }) {
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-admiralty-accent/45 bg-admiralty-accent/10 text-admiralty-accent">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}
