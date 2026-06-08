import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Route as RouteIcon, Sparkles, Clock, Leaf, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/route-planner")({
  head: () => ({ meta: [{ title: "Route Planner — SkyRoute AI" }] }),
  component: RoutePlanner,
});

function RoutePlanner() {
  const qc = useQueryClient();
  const [originId, setOriginId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [name, setName] = useState("");
  const [stops, setStops] = useState(8);

  const { data: warehouses } = useQuery({
    queryKey: ["wh-list"],
    queryFn: async () => (await supabase.from("warehouses").select("id,name,code")).data ?? [],
  });
  const { data: vehicles } = useQuery({
    queryKey: ["veh-list"],
    queryFn: async () => (await supabase.from("vehicles").select("id,plate,model,type")).data ?? [],
  });
  const { data: routes } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => (await supabase.from("routes").select("*").order("planned_for", { ascending: false })).data ?? [],
  });

  const optimize = useMutation({
    mutationFn: async () => {
      if (!originId || !vehicleId || !name) throw new Error("Fill all fields");
      // simulated AI optimization metrics
      const distance = +(stops * (12 + Math.random() * 8)).toFixed(2);
      const duration = Math.round(stops * (8 + Math.random() * 6));
      const cost = +(distance * (0.9 + Math.random() * 0.4)).toFixed(2);
      const co2 = +(distance * (0.08 + Math.random() * 0.05)).toFixed(2);
      const score = 85 + Math.floor(Math.random() * 14);
      const { error } = await supabase.from("routes").insert({
        name, origin_warehouse_id: originId, vehicle_id: vehicleId,
        total_distance_km: distance, total_duration_min: duration,
        estimated_cost_usd: cost, estimated_co2_kg: co2,
        optimization_score: score, status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Route optimized & saved"); qc.invalidateQueries({ queryKey: ["routes"] }); setName(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Route Planner" subtitle="Plan, optimize, and dispatch routes with AI assistance." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 lg:col-span-1">
          <h3 className="font-display text-base font-semibold">Plan new route</h3>
          <p className="text-xs text-muted-foreground">Atlas Router will optimize on save.</p>

          <div className="mt-5 space-y-3">
            <div>
              <Label htmlFor="name">Route name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Brooklyn morning loop" />
            </div>
            <div>
              <Label>Origin warehouse</Label>
              <Select value={originId} onValueChange={setOriginId}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vehicle</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  {(vehicles ?? []).map(v => <SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stops">Stops</Label>
              <Input id="stops" type="number" min={1} max={30} value={stops} onChange={e => setStops(Number(e.target.value))} />
            </div>
            <Button onClick={() => optimize.mutate()} disabled={optimize.isPending} className="w-full gap-2">
              <Sparkles className="h-4 w-4" /> {optimize.isPending ? "Optimizing…" : "Optimize & save"}
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Recent routes</h3>
          <div className="mt-3 space-y-3">
            {(routes ?? []).map(r => (
              <div key={r.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RouteIcon className="h-4 w-4 text-primary" />
                      <div className="truncate font-display font-semibold">{r.name}</div>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      Planned {format(new Date(r.planned_for), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <div className="text-[10px] uppercase text-muted-foreground">Score</div>
                      <div className="font-mono text-lg font-semibold text-primary">{r.optimization_score}</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
                  <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} label="Distance" value={`${r.total_distance_km} km`} />
                  <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={`${r.total_duration_min} min`} />
                  <Stat icon={<DollarSign className="h-3.5 w-3.5" />} label="Cost" value={`$${r.estimated_cost_usd}`} />
                  <Stat icon={<Leaf className="h-3.5 w-3.5" />} label="CO₂" value={`${r.estimated_co2_kg} kg`} />
                </div>
              </div>
            ))}
            {(routes ?? []).length === 0 && (
              <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
                No routes yet. Plan your first one →
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
