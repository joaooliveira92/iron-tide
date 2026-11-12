import type { ReactNode } from "react";

export type BouncyAccordionItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  attrs?: Readonly<Record<string, string>>;
};

export type BouncyAccordionClassNames = {
  root?: string;
  item?: string;
  trigger?: string;
  icon?: string;
  title?: string;
  chevron?: string;
  content?: string;
  body?: string;
  description?: string;
};

export type BouncyAccordionCollapse = "allowed" | "blocked";
