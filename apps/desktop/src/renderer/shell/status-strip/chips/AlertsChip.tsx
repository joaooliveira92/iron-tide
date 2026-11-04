import { Bell, CircleAlert } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import { CardFoot, CardHeader } from "../StripGlyph.js";
import { PinnableCard } from "../StripCard.js";
import { CHIP } from "../strip-styles.js";

export function AlertsChip({ alerts }: { readonly alerts: string }) {
  const unavailable = alerts.toLowerCase().includes("unavailable");
  return (
    <PinnableCard
      trigger={<button type="button" />}
      variant="button"
      width="w-64"
      triggerProps={{ "aria-label": `Priorities: ${alerts}` }}
      triggerClassName={cn(CHIP, unavailable && "text-muted-foreground")}
      card={
        <>
          <CardHeader title="Priorities" icon={<Bell className="size-3.5" aria-hidden="true" />} />
          <p className="px-3 py-2.5 text-sm font-semibold">{alerts}</p>
          <CardFoot>
            {unavailable
              ? "The priorities projection could not be read, so no count is shown."
              : "Strategic priorities the campaign has raised for attention. Open Overview to act on them."}
          </CardFoot>
        </>
      }
    >
      {unavailable ? (
        <CircleAlert className="size-3.5" aria-hidden="true" />
      ) : (
        <Bell className="size-3.5 text-muted-foreground" aria-hidden="true" />
      )}
      <span>{alerts}</span>
    </PinnableCard>
  );
}
