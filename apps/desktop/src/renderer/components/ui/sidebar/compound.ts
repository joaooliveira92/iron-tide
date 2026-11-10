import { SidebarTrigger, SidebarRail } from "./sidebar-controls.js";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from "./sidebar-group.js";
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarSeparator,
} from "./sidebar-layout.js";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "./sidebar-menu.js";
import { SidebarProvider } from "./sidebar-provider.js";
import { SidebarRoot } from "./sidebar-root.js";

export const Sidebar = Object.assign(SidebarRoot, {
  Root: SidebarRoot,
  Provider: SidebarProvider,
  Trigger: SidebarTrigger,
  Rail: SidebarRail,
  Inset: SidebarInset,
  Input: SidebarInput,
  Header: SidebarHeader,
  Footer: SidebarFooter,
  Separator: SidebarSeparator,
  Content: SidebarContent,
  Group: SidebarGroup,
  GroupLabel: SidebarGroupLabel,
  GroupContent: SidebarGroupContent,
  Menu: SidebarMenu,
  MenuItem: SidebarMenuItem,
  MenuButton: SidebarMenuButton,
  MenuSkeleton: SidebarMenuSkeleton,
});
