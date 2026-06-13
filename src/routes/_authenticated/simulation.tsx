import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Trash2, Rocket, Truck, Package, Warehouse, BrainCircuit, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/simulation")({
  head: () => ({ meta: [{ title: "Demo Simulation — SkyRoute AI" }] }),
  component: SimulationPage,
});

// US-centered hubs
const CITIES = [
  { name: "Los Angeles DC", code: "LAX-01", city: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago Hub", code: "ORD-01", city: "Chicago", lat: 41.8781, lng: -87.6298 },
  { name: "Dallas Center", code: "DFW-01", city: "Dallas", lat: 32.7767, lng: -96.7970 },
  { name: "Atlanta Depot", code: "ATL-01", city: "Atlanta", lat: 33.7490, lng: -84.3880 },
  { name: "New York Hub", code: "JFK-01", city: "New York", lat: 40.7128, lng: -74.0060 },
];

const VEHICLE_TYPES = ["van", "truck", "ev_van", "cargo_bike"] as const;
const FUEL_TYPES = ["diesel", "gasoline", "electric", "hybrid"] as const;
const PRIORITIES = ["standard", "express", "overnight"] as const;
const FIRST = ["Alex","Jordan","Sam","Taylor","Riley","Casey","Morgan","Jamie","Drew","Avery","Quinn","Reese","Skyler","Parker","Hayden"];
const LAST = ["Reyes","Nguyen","Patel","Garcia","Chen","Brown","Khan","Müller","Silva","Kim","Lopez","Singh","Costa","Tanaka","Rossi"];

const AGENTS = ["Dispatch Agent", "Route Agent", "Cost Agent", "Sustainability Agent"] as const;

type ActivityEvent = {
  id: string;
  t: number;
  kind: "dispatch" | "movement" | "delivered" | "traffic" | "ai";
  text: string;
  meta?: string;
};

const rnd = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Math.random().toString(36).slice(2, 10);

function SimulationPage() {
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [running, setRunning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [tick, setTick] = useState(0);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [counts, setCounts] = useState({ warehouses: 0, vehicles: 0, deliveries: 0, decisions: 0 });

  const stateRef = useRef<{
    vehicles: Array<{ id: string; lat: number; lng: number; targetLat: number; targetLng: number; status: string; fuel: number }>;
    deliveries: Array<{ id: string; status: string; vehicle_id: string | null; dest_lat: number; dest_lng: number }>;
    warehouseIds: string[];
  }>({ vehicles: [], deliveries: [], warehouseIds: [] });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCounts = async () => {
    const [w, v, d, a] = await Promise.all([
      supabase.from("warehouses").select("id", { count: "exact", head: true }),
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("deliveries").select("id", { count: "exact", head: true }),
      supabase.from("ai_decisions").select("id", { count: "exact", head: true }),
    ]);
    setCounts({
      warehouses: w.count ?? 0,
      vehicles: v.count ?? 0,
      deliveries: d.count ?? 0,
      decisions: a.count ?? 0,
    });
  };

  useEffect(() => {
    refreshCounts();
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const log = (e: Omit<ActivityEvent, "id" | "t">) => {
    setEvents(prev => [{ id: uid(), t: Date.now(), ...e }, ...prev].slice(0, 200));
  };

  // -------- SEED --------
  async function seed() {
    if (seeding) return;
    setSeeding(true);
    try {
      toast.info("Seeding demo data…");

      // 5 warehouses
      const whRows = CITIES.map(c => ({
        name: c.name, code: c.code + "-" + uid().slice(0, 4),
        address: `100 ${c.city} Way`, city: c.city, country: "US",
        lat: c.lat, lng: c.lng, capacity_units: 50000, used_units: Math.floor(rnd(8000, 30000)),
        status: "operational",
      }));
      const { data: whs, error: wErr } = await supabase.from("warehouses").insert(whRows).select("id,lat,lng");
      if (wErr) throw wErr;
      const whIds = whs!.map(w => w.id);
      log({ kind: "ai", text: `Provisioned ${whs!.length} warehouses across US network` });

      // 50 vehicles
      const vRows = Array.from({ length: 50 }).map((_, i) => {
        const home = whs![i % whs!.length];
        const type = pick(VEHICLE_TYPES);
        const fuel = type === "ev_van" ? "electric" : pick(FUEL_TYPES);
        return {
          plate: `SIM-${(1000 + i).toString()}-${uid().slice(0, 3).toUpperCase()}`,
          model: type === "truck" ? "Freightliner M2" : type === "ev_van" ? "Rivian EDV" : type === "cargo_bike" ? "Urban Arrow" : "Ford Transit",
          type, fuel_type: fuel,
          capacity_kg: type === "truck" ? 8000 : type === "cargo_bike" ? 150 : 1500,
          fuel_pct: fuel === "electric" ? null : Math.floor(rnd(40, 100)),
          battery_pct: fuel === "electric" ? Math.floor(rnd(40, 100)) : null,
          status: Math.random() < 0.7 ? "idle" : "active",
          home_warehouse_id: home.id,
          current_lat: Number(home.lat) + rnd(-0.05, 0.05),
          current_lng: Number(home.lng) + rnd(-0.05, 0.05),
          odometer_km: Math.floor(rnd(5000, 80000)),
        };
      });
      const { data: vehs, error: vErr } = await supabase.from("vehicles").insert(vRows).select("id,current_lat,current_lng");
      if (vErr) throw vErr;
      log({ kind: "ai", text: `Onboarded ${vehs!.length} vehicles to fleet` });

      // 500 deliveries (batched)
      const dRows = Array.from({ length: 500 }).map((_, i) => {
        const wh = whs![i % whs!.length];
        const cityMeta = CITIES[i % CITIES.length];
        const destLat = Number(wh.lat) + rnd(-1.5, 1.5);
        const destLng = Number(wh.lng) + rnd(-1.5, 1.5);
        return {
          tracking_no: `SR-${Date.now().toString(36).toUpperCase()}-${i.toString().padStart(4, "0")}`,
          customer_name: `${pick(FIRST)} ${pick(LAST)}`,
          origin_warehouse_id: wh.id,
          dest_address: `${Math.floor(rnd(100, 9999))} Market St`,
          dest_city: cityMeta.city,
          dest_lat: destLat, dest_lng: destLng,
          weight_kg: +rnd(0.5, 25).toFixed(2),
          priority: pick(PRIORITIES),
          status: "pending",
          cost_usd: +rnd(8, 65).toFixed(2),
          co2_kg: +rnd(0.4, 12).toFixed(2),
        };
      });

      const CHUNK = 100;
      for (let i = 0; i < dRows.length; i += CHUNK) {
        const { error } = await supabase.from("deliveries").insert(dRows.slice(i, i + CHUNK));
        if (error) throw error;
      }
      log({ kind: "ai", text: `Generated 500 pending deliveries — ready for dispatch` });

      toast.success("Demo data seeded: 5 warehouses · 50 vehicles · 500 deliveries");
      stateRef.current.warehouseIds = whIds;
      await refreshCounts();
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  // -------- LOAD STATE for ticks --------
  async function loadState() {
    const [{ data: vs }, { data: ds }] = await Promise.all([
      supabase.from("vehicles").select("id,current_lat,current_lng,status,fuel_pct").limit(200),
      supabase.from("deliveries").select("id,status,vehicle_id,dest_lat,dest_lng").in("status", ["pending", "in_transit", "out_for_delivery"]).limit(500),
    ]);
    stateRef.current.vehicles = (vs ?? []).filter(v => v.current_lat != null).map(v => ({
      id: v.id,
      lat: Number(v.current_lat), lng: Number(v.current_lng),
      targetLat: Number(v.current_lat), targetLng: Number(v.current_lng),
      status: v.status, fuel: v.fuel_pct ?? 100,
    }));
    stateRef.current.deliveries = (ds ?? []).filter(d => d.dest_lat != null).map(d => ({
      id: d.id, status: d.status, vehicle_id: d.vehicle_id,
      dest_lat: Number(d.dest_lat), dest_lng: Number(d.dest_lng),
    }));
  }

  // -------- TICK --------
  async function runTick() {
    setTick(t => t + 1);
    const s = stateRef.current;
    if (s.vehicles.length === 0) return;

    // 1) Dispatch: assign up to 3 pending deliveries to idle vehicles
    const pending = s.deliveries.filter(d => d.status === "pending");
    const idleVehicles = s.vehicles.filter(v => v.status === "idle");
    const assignCount = Math.min(3, pending.length, idleVehicles.length);
    for (let i = 0; i < assignCount; i++) {
      const del = pending[i];
      const veh = idleVehicles[i];
      veh.status = "active";
      veh.targetLat = del.dest_lat;
      veh.targetLng = del.dest_lng;
      del.status = "in_transit";
      del.vehicle_id = veh.id;
      await supabase.from("deliveries").update({ status: "in_transit", vehicle_id: veh.id }).eq("id", del.id);
      await supabase.from("vehicles").update({ status: "active" }).eq("id", veh.id);
      log({ kind: "dispatch", text: `Dispatch Agent assigned delivery to vehicle`, meta: `${del.id.slice(0,6)} → ${veh.id.slice(0,6)}` });
      await supabase.from("ai_decisions").insert({
        agent_name: "Dispatch Agent",
        decision: `Assigned delivery ${del.id.slice(0,8)} to vehicle ${veh.id.slice(0,8)}`,
        reasoning: `Nearest idle vehicle within capacity. Distance optimized via Nearest Neighbor.`,
      });
    }

    // 2) Movement: nudge active vehicles toward target
    const moving = s.vehicles.filter(v => v.status === "active").slice(0, 30);
    for (const v of moving) {
      const dLat = v.targetLat - v.lat;
      const dLng = v.targetLng - v.lng;
      const dist = Math.hypot(dLat, dLng);
      if (dist < 0.02) {
        // Arrived
        const del = s.deliveries.find(d => d.vehicle_id === v.id && d.status === "in_transit");
        if (del) {
          del.status = "delivered";
          await supabase.from("deliveries").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", del.id);
          log({ kind: "delivered", text: `Delivery completed`, meta: del.id.slice(0,8) });
        }
        v.status = "idle";
        await supabase.from("vehicles").update({ status: "idle", current_lat: v.lat, current_lng: v.lng }).eq("id", v.id);
      } else {
        const step = Math.min(0.15, dist) / dist;
        v.lat += dLat * step * 0.5;
        v.lng += dLng * step * 0.5;
        v.fuel = Math.max(0, v.fuel - rnd(0.1, 0.5));
        await supabase.from("vehicles").update({ current_lat: v.lat, current_lng: v.lng, fuel_pct: Math.round(v.fuel) }).eq("id", v.id);
      }
    }
    if (moving.length) log({ kind: "movement", text: `${moving.length} vehicles repositioned along optimized routes` });

    // 3) Traffic event (random)
    if (Math.random() < 0.4 && moving.length) {
      const v = pick(moving);
      log({ kind: "traffic", text: `Traffic delay detected — Route Agent recomputing`, meta: `Vehicle ${v.id.slice(0,6)} · +${Math.floor(rnd(4, 18))} min` });
      await supabase.from("ai_decisions").insert({
        agent_name: "Route Agent",
        decision: `Rerouted vehicle ${v.id.slice(0,8)} around congestion`,
        reasoning: `Dijkstra shortest-path re-evaluation triggered by traffic signal. ETA delta minimized.`,
      });
    }

    // 4) Periodic Cost / Sustainability insight
    if (tick % 5 === 0) {
      const agent = pick(AGENTS.slice(2));
      const decision = agent === "Cost Agent"
        ? `Consolidated 4 routes — projected savings $${rnd(40, 180).toFixed(2)}`
        : `Switched 2 deliveries to EV fleet — avoided ${rnd(3, 14).toFixed(1)} kg CO₂`;
      log({ kind: "ai", text: `${agent}: ${decision}` });
      await supabase.from("ai_decisions").insert({
        agent_name: agent, decision,
        reasoning: agent === "Cost Agent" ? "Fuel + labor cost optimization on overlapping legs" : "Carbon-aware vehicle selection per delivery weight class",
      });
    }
  }

  // -------- CONTROL --------
  async function start() {
    if (running) return;
    await loadState();
    if (stateRef.current.vehicles.length === 0) {
      toast.error("No vehicles found — click Seed Demo Data first.");
      return;
    }
    setRunning(true);
    log({ kind: "ai", text: "🚀 Simulation started — agents are live" });
    tickRef.current = setInterval(runTick, 2000);
  }

  function stop() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setRunning(false);
    log({ kind: "ai", text: "⏸ Simulation paused" });
  }

  async function clearAll() {
    if (!confirm("Delete all simulation data (vehicles, deliveries, warehouses, AI decisions)?")) return;
    setClearing(true);
    stop();
    try {
      await supabase.from("ai_decisions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("route_stops").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("routes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("deliveries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("vehicles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("warehouses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      setEvents([]);
      await refreshCounts();
      qc.invalidateQueries();
      toast.success("Simulation data cleared");
    } catch (e: any) {
      toast.error(e.message ?? "Clear failed");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo Simulation"
        subtitle="Generate a full logistics network and watch autonomous agents operate it in real time."
        actions={
          <>
            <Button variant="outline" onClick={seed} disabled={seeding || running}>
              <Rocket className="mr-2 h-4 w-4" /> {seeding ? "Seeding…" : "Seed Demo Data"}
            </Button>
            {!running ? (
              <Button onClick={start} disabled={seeding}>
                <Play className="mr-2 h-4 w-4" /> Start Simulation
              </Button>
            ) : (
              <Button variant="secondary" onClick={stop}>
                <Square className="mr-2 h-4 w-4" /> Stop
              </Button>
            )}
            <Button variant="ghost" onClick={clearAll} disabled={clearing || seeding}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Warehouses" value={counts.warehouses} icon={Warehouse} />
        <StatCard label="Vehicles" value={counts.vehicles} icon={Truck} />
        <StatCard label="Deliveries" value={counts.deliveries} icon={Package} />
        <StatCard label="AI Decisions" value={counts.decisions} icon={BrainCircuit} accent />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Live activity stream</h3>
              <p className="text-xs text-muted-foreground">
                {running ? <span className="inline-flex items-center gap-1.5"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span> Simulation running · tick #{tick}</span> : "Idle — press Start Simulation"}
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">{events.length} events</Badge>
          </div>
          <ScrollArea className="h-[460px] pr-3">
            {events.length === 0 ? (
              <div className="grid h-[420px] place-items-center text-sm text-muted-foreground">
                No activity yet. Seed data then start the simulation.
              </div>
            ) : (
              <ul className="space-y-2">
                {events.map(ev => (
                  <li key={ev.id} className="flex items-start gap-3 rounded-lg border bg-background/40 p-3 text-sm">
                    <KindIcon kind={ev.kind} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{ev.text}</div>
                      {ev.meta && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{ev.meta}</div>}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(ev.t).toLocaleTimeString([], { hour12: false })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
            <h3 className="font-display text-base font-semibold">What gets simulated</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• Dispatch Agent assigns deliveries to idle vehicles</li>
              <li>• Vehicles move toward destinations each tick (2s)</li>
              <li>• Route Agent reroutes around traffic delays</li>
              <li>• Cost & Sustainability agents emit periodic insights</li>
              <li>• Deliveries complete on arrival, vehicles return to idle</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-display text-base font-semibold">Tips</h3>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>Open <span className="font-mono text-foreground">Live Map</span> in a second tab to watch vehicles move.</li>
              <li>Visit <span className="font-mono text-foreground">AI Control</span> to see decisions stream in.</li>
              <li>Use <span className="font-mono text-foreground">Clear</span> to reset between demos.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function KindIcon({ kind }: { kind: ActivityEvent["kind"] }) {
  const cfg = {
    dispatch: { Icon: Package, cls: "bg-primary/15 text-primary" },
    movement: { Icon: Truck, cls: "bg-chart-2/15 text-chart-2" },
    delivered: { Icon: Rocket, cls: "bg-success/15 text-success" },
    traffic: { Icon: AlertTriangle, cls: "bg-warning/15 text-warning" },
    ai: { Icon: BrainCircuit, cls: "bg-accent/30 text-accent-foreground" },
  }[kind];
  return (
    <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${cfg.cls}`}>
      <cfg.Icon className="h-3.5 w-3.5" />
    </div>
  );
}
