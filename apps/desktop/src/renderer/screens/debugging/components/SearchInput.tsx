import { Search } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Input } from "../../../components/ui/input.js";
import { cn } from "../../../lib/utils.js";

export interface SearchInputProps {
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly inputClassName?: string;
  readonly rightElement?: ReactNode;
}

export function SearchInput({
  placeholder,
  value,
  onChange,
  className,
  inputRef,
  inputClassName,
  rightElement,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        className={cn("h-9 pl-8 text-xs", inputClassName)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {rightElement}
    </div>
  );
}
