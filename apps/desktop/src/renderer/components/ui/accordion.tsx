import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";

const Accordion = AccordionPrimitive.Root;

interface AccordionItemProps extends React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Item
> {
  ref?: React.Ref<React.ComponentRef<typeof AccordionPrimitive.Item>> | undefined;
}

const AccordionItem = ({ className, ref, ...props }: AccordionItemProps) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b last:border-b-0", className)}
    {...props}
  />
);
AccordionItem.displayName = "AccordionItem";

interface AccordionTriggerProps extends React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> {
  ref?: React.Ref<React.ComponentRef<typeof AccordionPrimitive.Trigger>> | undefined;
}

const AccordionTrigger = ({ className, children, ref, ...props }: AccordionTriggerProps) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-3 text-sm font-medium transition-all hover:underline",
        "group/accordion-trigger [&[data-panel-open]>[data-slot=accordion-trigger-icon]]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        data-slot="accordion-trigger-icon"
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

interface AccordionContentProps extends React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Panel
> {
  ref?: React.Ref<React.ComponentRef<typeof AccordionPrimitive.Panel>> | undefined;
}

const AccordionContent = ({ className, children, ref, ...props }: AccordionContentProps) => (
  <AccordionPrimitive.Panel
    ref={ref}
    className="overflow-hidden text-sm data-closed:animate-accordion-up data-open:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-3", className)}>{children}</div>
  </AccordionPrimitive.Panel>
);
AccordionContent.displayName = AccordionPrimitive.Panel.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
