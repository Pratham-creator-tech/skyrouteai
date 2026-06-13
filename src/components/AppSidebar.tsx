import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Truck, Warehouse, Route as RouteIcon,
  BrainCircuit, BarChart3, Settings, LogOut, MapPin, Sparkles, Workflow, MessagesSquare, Leaf, Users, Boxes, Award,
  ChevronDown, Home, Cpu, Gauge, LineChart,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/skyroute-logo.png";

const GROUPS = [
  {
    title: "Overview",
    icon: Home,
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Live Map", url: "/live-map", icon: MapPin },
      { title: "Digital Twin", url: "/digital-twin", icon: Boxes },
    ],
  },
  {
    title: "Operations",
    icon: Gauge,
    items: [
      { title: "Deliveries", url: "/deliveries", icon: Package },
      { title: "Vehicles", url: "/vehicles", icon: Truck },
      { title: "Warehouses", url: "/warehouses", icon: Warehouse },
      { title: "Route Planner", url: "/route-planner", icon: RouteIcon },
    ],
  },
  {
    title: "AI & Automation",
    icon: Cpu,
    items: [
      { title: "Optimizer", url: "/optimizer", icon: Sparkles },
      { title: "AI Control Center", url: "/ai-control", icon: BrainCircuit },
      { title: "Agent Collaboration", url: "/collaboration", icon: Users },
      { title: "AI Assistant", url: "/assistant", icon: MessagesSquare },
      { title: "Workflows", url: "/workflows", icon: Workflow },
    ],
  },
  {
    title: "Intelligence",
    icon: LineChart,
    items: [
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
      { title: "Carbon Credits", url: "/carbon-credits", icon: Award },
      { title: "Sustainability", url: "/sustainability", icon: Leaf },
    ],
  },
];

const BOTTOM = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: s => s.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-2">
          <img src={logoImg} alt="SkyRoute AI" className="h-8 w-8 rounded-md object-cover" />
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-sm font-semibold">SkyRoute AI</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Logistics OS</div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {GROUPS.map(group => {
          const hasActive = group.items.some(item => pathname === item.url);
          return (
            <Collapsible key={group.title} defaultOpen={hasActive} className="group/collapsible">
              <SidebarGroup className="py-1">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between pr-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-180">
                    <span className="flex items-center gap-2">
                      <group.icon className="h-3.5 w-3.5" />
                      {!collapsed && group.title}
                    </span>
                    {!collapsed && <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />}
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map(item => {
                        const active = pathname === item.url;
                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                              <Link to={item.url} className="flex items-center gap-2">
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          {BOTTOM.map(item => {
            const active = pathname === item.url;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => supabase.auth.signOut()} tooltip="Sign out">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
