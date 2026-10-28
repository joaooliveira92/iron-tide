import { useCallback, type KeyboardEvent } from "react";

export interface MapEntity {
  readonly id: string;
  readonly name: string;
  readonly kind: "port" | "area";
}

export interface MapEntityListProps {
  readonly entities: readonly MapEntity[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

export function MapEntityList({ entities, selectedId, onSelect }: MapEntityListProps) {
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLUListElement>) => {
    const keys = ["ArrowDown", "ArrowUp"];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const index = buttons.findIndex((button) => button === document.activeElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    const target = buttons[(next + buttons.length) % buttons.length];
    if (target !== undefined) {
      event.preventDefault();
      target.focus();
    }
  }, []);

  return (
    <nav
      aria-label="Map entities"
      className="absolute right-2 top-2 max-h-[70vh] w-56 overflow-auto rounded bg-black/80 p-2 text-xs text-white"
    >
      <ul onKeyDown={onKeyDown} className="grid gap-1">
        {entities.map((entity) => (
          <li key={entity.id}>
            <button
              type="button"
              aria-pressed={selectedId === entity.id}
              data-entity={entity.id}
              className="w-full rounded border border-white/40 px-2 py-1 text-left aria-pressed:bg-white aria-pressed:text-black"
              onClick={() => onSelect(entity.id)}
            >
              {entity.name} <span className="opacity-70">({entity.kind})</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
