import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command.js";
import { cn } from "../lib/utils.js";
import type { SearchTarget } from "./global-search-state.js";
import { filterSearchTargets } from "./global-search-state.js";

export interface GlobalSearchProps {
  readonly className?: string;
  readonly targets: readonly SearchTarget[];
  readonly onNavigate: (id: string) => void;
}

/** Jumps to any campaign screen by name via a Ctrl/Cmd+F command palette. Renders nothing when there is nowhere to search. */
export function GlobalSearch({ className, targets, onNavigate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() === "f" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((isOpen) => !isOpen);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (targets.length === 0) return null;

  function navigate(id: string): void {
    onNavigate(id);
    setOpen(false);
    setQuery("");
  }

  const matches = filterSearchTargets(targets, query);

  return (
    <>
      <Button
        className={cn("h-8 w-8 shrink-0", className)}
        variant="ghost"
        size="icon"
        aria-label="Search"
        title="Search (Ctrl+F)"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
        title="Search"
        description="Jump to any campaign screen"
      >
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search screens…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {query.trim().length === 0 ? "Type to search screens…" : "No screens found."}
            </CommandEmpty>
            {matches.length > 0 && (
              <CommandGroup heading="Screens">
                {matches.map((target) => (
                  <CommandItem
                    key={target.id}
                    value={target.id}
                    onSelect={() => navigate(target.id)}
                  >
                    {target.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
