import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Sparkles, Truck, Package, TrendingDown, Clock, DollarSign, Route as RouteIcon, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OptimizerMap } from "@/components/OptimizerMap";
import { optimize, type OptDelivery, type OptVehicle, type OptimizationResult } from "@/lib/route-optimizer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/optimizer")({
  head: () => ({ meta: [{ title: "Route Optimizer — SkyRoute AI" }] }),
  component: OptimizerPage,
});

const FUEL_PRICE = 1.45; // $/L default

function OptimizerPage() {
  const { data: vehicles } = useQuery({
    queryKey: ["opt-vehicles"],
    queryFn: async () => (await supabase
      .from("vehicles")
      .select("id,plate,model,capacity_kg,fuel_efficiency,current_lat,current_lng,status")
      .not("current_lat", "is", null)
      .not("current_lng", "is", null)).data ?? [],
  });

  const { data: deliveries } = useQuery({
    queryKey: ["opt-deliveries"],
    queryFn: async () => (await supabase
      .from("deliveries")
      .select("id,tracking_no,customer_name,dest_lat,dest_lng,weight_kg,status")
      .in("status", ["pending", "assigned"])
      .not("dest_lat", "is", null)
      .not("dest_lng", "is", null)).data ?? [],
  });

  const { data: warehouses } = useQuery({
    queryKey: ["opt-warehouses"],
    queryFn: async () => (await supabase
      .from("warehouses").select("id,name,lat,lng")
      .not("lat", "is", null).not("lng", "is", null)).data ?? [],
  });

  const [selVeh, setSelVeh] = useState<Set<string>>(new Set());
  const [selDel, setSelDel] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  };

  const selectAll = (kind: "v" | "d") => {
    if (kind === "v") setSelVeh(new Set((vehicles ?? []).map(v => v.id)));
    else setSelDel(new Set((deliveries ?? []).map(d => d.id)));
  };

  const run = () => {
    const vs = (vehicles ?? []).filter(v => selVeh.has(v.id));
    const ds = (deliveries ?? []).filter(d => selDel.has(d.id));
    if (!vs.length || !ds.length) {
      toast.error("Select at least one vehicle and one delivery");
      return;
    }
    const totalDemand = ds.reduce((s, d) => s + Number(d.weight_kg), 0);
    const totalCap = vs.reduce((s, v) => s + Number(v.capacity_kg), 0);
    if (totalDemand > totalCap) {
      toast.warning(`Demand (${totalDemand.toFixed(0)} kg) exceeds fleet capacity (${totalCap} kg). Some deliveries may be unassigned.`);
    }

    const optVehicles: OptVehicle[] = vs.map(v => ({
      id: v.id, plate: v.plate, capacity_kg: Number(v.capacity_kg) || 1000,
      fuel_efficiency: Number(v.fuel_efficiency) || 8,
      fuel_price: FUEL_PRICE,
      start: { id: `start-${v.id}`, label: v.plate, lat: Number(v.current_lat), lng: Number(v.current_lng) },
    }));
    const optDeliveries: OptDelivery[] = ds.map(d => ({
      id: d.id, label: d.tracking_no, weight_kg: Number(d.weight_kg) || 1,
      lat: Number(d.dest_lat), lng: Number(d.dest_lng),
    }));
    const waypoints = (warehouses ?? []).map(w => ({
      id: `wh-${w.id}`, label: w.name, lat: Number(w.lat), lng: Number(w.lng),
    }));

    const res = optimize(optVehicles, optDeliveries, waypoints);
    setResult(res);
    toast.success(`Optimized — saved ${res.savings.distance_pct}% distance`);
  };

  const canRun = selVeh.size > 0 && selDel.size > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route Optimization Engine"
        subtitle="Nearest Neighbor + Dijkstra. Assign vehicles by capacity and compute the shortest visiting order."
        actions={
          <Button onClick={run} disabled={!canRun} className="gap-2">
            <Sparkles className="h-4 w-4" /> Optimize routes
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SelectorCard
          title="Vehicles" icon={<Truck className="h-4 w-4" />}
          count={selVeh.size} total={vehicles?.length ?? 0}
          onSelectAll={() => selectAll("v")}
          onClear={() => setSelVeh(new Set())}
        >
          <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
            {(vehicles ?? []).map(v => (
              <label key={v.id} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-2.5 hover:bg-accent">
                <Checkbox checked={selVeh.has(v.id)} onCheckedChange={() => setSelVeh(s => toggle(s, v.id))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{v.plate}</span>
                    <span className="text-xs text-muted-foreground">{v.model}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Cap {v.capacity_kg} kg · {v.fuel_efficiency ?? 8} km/L · <span className="capitalize">{v.status}</span>
                  </div>
                </div>
              </label>
            ))}
            {!vehicles?.length && <Empty msg="No vehicles with location data" />}
          </div>
        </SelectorCard>

        <SelectorCard
          title="Deliveries" icon={<Package className="h-4 w-4" />}
          count={selDel.size} total={deliveries?.length ?? 0}
          onSelectAll={() => selectAll("d")}
          onClear={() => setSelDel(new Set())}
        >
          <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
            {(deliveries ?? []).map(d => (
              <label key={d.id} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-2.5 hover:bg-accent">
                <Checkbox checked={selDel.has(d.id)} onCheckedChange={() => setSelDel(s => toggle(s, d.id))} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{d.tracking_no}</span>
                    <Badge variant="secondary" className="text-[10px]">{d.weight_kg} kg</Badge>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{d.customer_name}</div>
                </div>
              </label>
            ))}
            {!deliveries?.length && <Empty msg="No pending deliveries" />}
          </div>
        </SelectorCard>
      </div>

      {result && <ResultsPanel result={result} />}
    </div>
  );
}

function SelectorCard({
  title, icon, count, total, onSelectAll, onClear, children,
}: {
  title: string; icon: React.ReactNode; count: number; total: number;
  onSelectAll: () => void; onClear: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          <Badge variant="outline" className="font-mono text-[10px]">{count}/{total}</Badge>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onSelectAll}>All</Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>Clear</Button>
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">{msg}</div>;
}

function ResultsPanel({ result }: { result: OptimizationResult }) {
  const { original, optimized, savings } = result;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SavingsCard label="Distance saved" pct={savings.distance_pct}
          from={`${original.totals.distance_km} km`} to={`${optimized.totals.distance_km} km`}
          icon={<RouteIcon className="h-4 w-4" />} />
        <SavingsCard label="Fuel cost saved" pct={savings.cost_pct}
          from={`$${original.totals.fuel_cost_usd}`} to={`$${optimized.totals.fuel_cost_usd}`}
          icon={<DollarSign className="h-4 w-4" />} />
        <SavingsCard label="Time saved" pct={savings.time_pct}
          from={`${original.totals.duration_min} min`} to={`${optimized.totals.duration_min} min`}
          icon={<Clock className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="map" className="w-full">
        <TabsList>
          <TabsTrigger value="map">Map view</TabsTrigger>
          <TabsTrigger value="breakdown">Per-vehicle breakdown</TabsTrigger>
        </TabsList>
        <TabsContent value="map" className="mt-4">
          <OptimizerMap original={original.assignments} optimized={optimized.assignments} height={560} />
        </TabsContent>
        <TabsContent value="breakdown" className="mt-4">
          <div className="space-y-3">
            {optimized.assignments.filter(a => a.stops.length).map((a, i) => {
              const orig = original.assignments.find(x => x.vehicle.id === a.vehicle.id);
              return (
                <div key={a.vehicle.id} className="rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="font-display font-semibold">{a.vehicle.plate}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {a.load_kg}/{a.vehicle.capacity_kg} kg
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <Stat label="Distance" value={`${a.distance_km} km`} prev={orig ? `${orig.distance_km} km` : undefined} />
                      <Stat label="Duration" value={`${a.duration_min} min`} prev={orig ? `${orig.duration_min} min` : undefined} />
                      <Stat label="Fuel" value={`$${a.fuel_cost_usd}`} prev={orig ? `$${orig.fuel_cost_usd}` : undefined} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3 text-xs">
                    <Badge className="font-mono">START</Badge>
                    {a.stops.map((s, j) => (
                      <span key={s.id} className="flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge variant="secondary" className="font-mono">
                          {j + 1}. {s.label}
                        </Badge>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SavingsCard({ label, pct, from, to, icon }: { label: string; pct: number; from: string; to: string; icon: React.ReactNode }) {
  const positive = pct > 0;
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}{label}
        </div>
        <Badge className={positive ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15" : "bg-muted text-muted-foreground"}>
          <TrendingDown className="mr-1 h-3 w-3" />
          {positive ? `-${pct}%` : `${pct}%`}
        </Badge>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums">{to}</span>
        <span className="font-mono text-xs text-muted-foreground line-through">{from}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, prev }: { label: string; value: string; prev?: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums">{value}</div>
      {prev && <div className="font-mono text-[10px] text-muted-foreground line-through">{prev}</div>}
    </div>
  );
}
