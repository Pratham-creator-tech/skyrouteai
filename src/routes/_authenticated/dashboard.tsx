import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Package, Truck, Warehouse as WarehouseIcon, Leaf, Clock, DollarSign, Activity, BrainCircuit,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SkyRoute AI" }] }),
  component: Dashboard,
});

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [deliveries, vehicles, warehouses, agents, events] = await Promise.all([
        supabase.from("deliveries").select("id,status,cost_usd,co2_kg,created_at,priority,tracking_no,customer_name,dest_city,eta").order("created_at", { ascending: false }),
        supabase.from("vehicles").select("id,status,type,battery_pct,fuel_pct,plate"),
        supabase.from("warehouses").select("id,status,capacity_units,used_units,name"),
        supabase.from("ai_agents").select("id,status,name,runs_today,success_rate,type,last_run_at"),
        supabase.from("ai_events").select("id,action,summary,severity,created_at,agent_id").order("created_at", { ascending: false }).limit(8),
      ]);
      return {
        deliveries: deliveries.data ?? [],
        vehicles: vehicles.data ?? [],
        warehouses: warehouses.data ?? [],
        agents: agents.data ?? [],
        events: events.data ?? [],
      };
    },
  });
}

function Dashboard() {
  const { data, isLoading } = useDashboardData();
  if (isLoading || !data) return <LoadingShell />;

  const totalDeliveries = data.deliveries.length;
  const delivered = data.deliveries.filter(d => d.status === "delivered").length;
  const inTransit = data.deliveries.filter(d => d.status === "in_transit").length;
  const onTimePct = totalDeliveries ? Math.round((delivered / totalDeliveries) * 100) : 0;
  const totalCost = data.deliveries.reduce((s, d) => s + Number(d.cost_usd ?? 0), 0);
  const totalCo2 = data.deliveries.reduce((s, d) => s + Number(d.co2_kg ?? 0), 0);
  const activeVehicles = data.vehicles.filter(v => v.status === "in_transit").length;
  const activeAgents = data.agents.filter(a => a.status === "active").length;

  // Build 14-day delivery trend
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = subDays(new Date(), 13 - i);
    const key = format(d, "yyyy-MM-dd");
    const count = data.deliveries.filter(x => format(new Date(x.created_at), "yyyy-MM-dd") === key).length;
    return { day: format(d, "MM-dd"), count };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mission control"
        subtitle="Live view of deliveries, fleet, warehouses, and AI agents."
        actions={
          <>
            <Button variant="outline" size="sm">Export</Button>
            <Button size="sm" className="gap-2"><BrainCircuit className="h-4 w-4" /> Ask SkyRoute AI</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Deliveries (active)" value={inTransit + data.deliveries.filter(d => d.status === "assigned" || d.status === "pending").length} icon={Package} accent delta={{ value: "12%", positive: true }} />
        <StatCard label="On-time rate" value={`${onTimePct}%`} icon={Clock} delta={{ value: "0.4%", positive: true }} />
        <StatCard label="Active vehicles" value={`${activeVehicles}/${data.vehicles.length}`} icon={Truck} />
        <StatCard label="AI agents online" value={`${activeAgents}/${data.agents.length}`} icon={BrainCircuit} />
        <StatCard label="Operating cost (period)" value={`$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} delta={{ value: "3.1%", positive: false }} />
        <StatCard label="CO₂ footprint" value={`${totalCo2.toFixed(1)} kg`} icon={Leaf} delta={{ value: "8.6%", positive: true }} />
        <StatCard label="Warehouses operational" value={data.warehouses.filter(w => w.status === "operational").length} icon={WarehouseIcon} />
        <StatCard label="Anomalies (24h)" value={data.events.filter(e => e.severity === "warning" || e.severity === "error").length} icon={Activity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Delivery volume — 14 days</h3>
              <p className="text-xs text-muted-foreground">Total deliveries created per day</p>
            </div>
            <div className="text-xs text-muted-foreground">Live</div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-display text-base font-semibold">AI agents</h3>
          <p className="text-xs text-muted-foreground">{activeAgents} of {data.agents.length} active</p>
          <ul className="mt-4 space-y-3">
            {data.agents.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{a.type} · {a.runs_today} runs · {a.success_rate}% success</div>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h3 className="font-display text-base font-semibold">Recent deliveries</h3>
              <p className="text-xs text-muted-foreground">Latest 6</p>
            </div>
          </div>
          <ul className="divide-y">
            {data.deliveries.slice(0, 6).map(d => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">{d.tracking_no}</div>
                  <div className="truncate text-sm font-medium">{d.customer_name} · {d.dest_city}</div>
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h3 className="font-display text-base font-semibold">AI activity feed</h3>
              <p className="text-xs text-muted-foreground">Latest agent actions</p>
            </div>
          </div>
          <ul className="divide-y">
            {data.events.map(e => (
              <li key={e.id} className="flex items-start gap-3 p-4">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  e.severity === "error" ? "bg-destructive" :
                  e.severity === "warning" ? "bg-warning" :
                  e.severity === "success" ? "bg-success" : "bg-primary"
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{e.action}</div>
                  <div className="text-sm">{e.summary}</div>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">{format(new Date(e.created_at), "HH:mm")}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-xl border bg-card" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border bg-card" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}
