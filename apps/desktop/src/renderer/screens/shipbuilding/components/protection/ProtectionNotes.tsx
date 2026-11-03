import { useProtectionEditing } from "./ProtectionEditing.js";

export function ProtectionNotes() {
  const { model } = useProtectionEditing();
  return (
    <details className="rounded-md border p-2 text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        What the model does not carry
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        {model.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </details>
  );
}
