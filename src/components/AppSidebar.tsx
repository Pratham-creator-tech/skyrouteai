import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Truck, Warehouse, Route as RouteIcon,
  BrainCircuit, BarChart3, Settings, Zap, LogOut, MapPin, Sparkles, Workflow, MessagesSquare, Leaf, Rocket,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Live Map", url: "/live-map", icon: MapPin },
  { title: "Deliveries", url: "/deliveries", icon: Package },
  { title: "Vehicles", url: "/vehicles", icon: Truck },
  { title: "Warehouses", url: "/warehouses", icon: Warehouse },
  { title: "Route Planner", url: "/route-planner", icon: RouteIcon },
  { title: "Optimizer", url: "/optimizer", icon: Sparkles },
  { title: "AI Control Center", url: "/ai-control", icon: BrainCircuit },
  { title: "AI Assistant", url: "/assistant", icon: MessagesSquare },
  { title: "Workflows", url: "/workflows", icon: Workflow },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Sustainability", url: "/sustainability", icon: Leaf },
  { title: "Simulation", url: "/simulation", icon: Rocket },
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
          <div className="relative grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-sm font-semibold">SkyRoute AI</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Logistics OS</div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(item => {
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
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
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
