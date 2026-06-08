import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/warehouses")({
  head: () => ({ meta: [{ title: "Warehouses — SkyRoute AI" }] }),
  component: WarehousesPage,
});

function WarehousesPage() {
  const { data } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        subtitle={`${data?.length ?? 0} hubs across the network`}
        actions={<Button>+ Add warehouse</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map(w => {
          const utilization = w.capacity_units > 0 ? Math.round((w.used_units / w.capacity_units) * 100) : 0;
          return (
            <div key={w.id} className="rounded-xl border bg-card p-6 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{w.code}</div>
                  <div className="mt-0.5 font-display text-lg font-semibold">{w.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {w.city}, {w.country}
                  </div>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <WarehouseIcon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4">
                <StatusBadge status={w.status} />
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="font-mono tabular-nums">{utilization}% · {w.used_units.toLocaleString()} / {w.capacity_units.toLocaleString()}</span>
                </div>
                <Progress value={utilization} className="mt-2 h-1.5" />
              </div>

              <div className="mt-5 border-t pt-3 text-xs text-muted-foreground">{w.address}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
