import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/deliveries": "Deliveries",
  "/vehicles": "Vehicles",
  "/warehouses": "Warehouses",
  "/route-planner": "Route Planner",
  "/ai-control": "AI Control Center",
  "/analytics": "Analytics",
  "/settings": "Settings",
};

function AuthedLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const title = TITLES[pathname] ?? "SkyRoute AI";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="font-display text-sm font-semibold">{title}</div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                Systems nominal
              </div>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
