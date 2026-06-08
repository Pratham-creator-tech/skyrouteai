import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BatteryCharging, Fuel, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/vehicles")({
  head: () => ({ meta: [{ title: "Vehicles — SkyRoute AI" }] }),
  component: VehiclesPage,
});

function VehiclesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("plate");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet"
        subtitle={`${data?.length ?? 0} vehicles — telemetry live`}
        actions={<Button>+ Add vehicle</Button>}
      />

      {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl border bg-card" />)}
      </div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(data ?? []).map(v => {
          const isEv = v.fuel_type === "electric";
          const pct = isEv ? (v.battery_pct ?? 0) : (v.fuel_pct ?? 0);
          return (
            <div key={v.id} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{v.type.replace(/_/g, " ")}</div>
                  <div className="mt-0.5 font-display text-lg font-semibold">{v.plate}</div>
                  <div className="text-xs text-muted-foreground">{v.model}</div>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <Truck className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <StatusBadge status={v.status} />
                <span className="font-mono text-[11px] text-muted-foreground">{v.odometer_km.toLocaleString()} km</span>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {isEv ? <BatteryCharging className="h-3.5 w-3.5" /> : <Fuel className="h-3.5 w-3.5" />}
                    {isEv ? "Battery" : "Fuel"}
                  </span>
                  <span className="font-mono tabular-nums">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Capacity</div>
                  <div className="font-mono font-medium">{v.capacity_kg} kg</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Fuel</div>
                  <div className="font-mono font-medium capitalize">{v.fuel_type}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
