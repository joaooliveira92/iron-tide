import { ProtectionRegionRow } from "./ProtectionRegionRow.js";
import { useProtectionEditing } from "./ProtectionEditing.js";

export function ProtectionRegions() {
  const { model } = useProtectionEditing();
  if (model.fitted.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No armour fitted. The brief{" "}
        {model.protectionGoal === "NONE" ? "accepts" : "does not accept"} an unprotected ship.
      </p>
    );
  return (
    <div className="space-y-4">
      {model.groups.map((group) => (
        <section key={group.id} aria-label={group.label} className="space-y-2">
          <h3 className="text-sm font-medium">{group.label}</h3>
          <ul className="space-y-2">
            {group.fields.map((field) => (
              <ProtectionRegionRow key={field.region} field={field} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
