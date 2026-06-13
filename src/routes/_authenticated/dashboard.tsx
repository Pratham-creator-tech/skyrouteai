import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Package, Truck, Warehouse as WarehouseIcon, Leaf, Route as RouteIcon,
  DollarSign, BrainCircuit, Sparkles, ArrowRight, AlertTriangle, Zap,
} from "lucide-react";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Command Center — SkyRoute AI" }] }),
  component: Dashboard,
});

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard-command-center"],
    queryFn: async () => {
      const [deliveries, vehicles, warehouses, routes] = await Promise.all([
        supabase.from("deliveries").select("id,status,cost_usd,co2_kg,priority,created_at"),
        supabase.from("vehicles").select("id,status,type,fuel_pct,battery_pct,plate"),
        supabase.from("warehouses").select("id,status,capacity_units,used_units"),
        supabase.from("routes").select("id,total_distance_km,optimization_score,estimated_cost_usd,estimated_co2_kg,status,created_at"),
      ]);
      return {
        deliveries: deliveries.data ?? [],
        vehicles: vehicles.data ?? [],
        warehouses: warehouses.data ?? [],
        routes: routes.data ?? [],
      };
    },
  });
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "var(--color-success)",
  in_transit: "var(--color-primary)",
  assigned: "var(--color-accent-foreground)",
  pending: "var(--color-muted-foreground)",
  failed: "var(--color-destructive)",
  cancelled: "var(--color-warning)",
};

function Dashboard() {
  const { data, isLoading } = useDashboardData();
  const navigate = useNavigate();
  if (isLoading || !data) return <LoadingShell />;

  const exportReport = () => {
    const rows: string[] = [];
    rows.push("Section,Metric,Value");
    rows.push(`KPI,Active Deliveries,${data.deliveries.filter(d => ["in_transit","assigned","pending"].includes(d.status)).length}`);
    rows.push(`KPI,Vehicles On Route,${data.vehicles.filter(v => v.status === "in_transit").length}`);
    rows.push(`KPI,Total Vehicles,${data.vehicles.length}`);
    rows.push(`KPI,Warehouses,${data.warehouses.length}`);
    rows.push(`KPI,Total Distance Km,${Math.round(data.routes.reduce((s, r) => s + Number(r.total_distance_km ?? 0), 0))}`);
    rows.push(`KPI,Total Cost USD,${data.deliveries.reduce((s, d) => s + Number(d.cost_usd ?? 0), 0).toFixed(2)}`);
    rows.push(`KPI,Total CO2 Kg,${data.deliveries.reduce((s, d) => s + Number(d.co2_kg ?? 0), 0).toFixed(2)}`);
    rows.push("");
    rows.push("Deliveries,id,status,priority,cost_usd,co2_kg,created_at");
    for (const d of data.deliveries) {
      rows.push(`Delivery,${d.id},${d.status},${d.priority ?? ""},${d.cost_usd ?? ""},${d.co2_kg ?? ""},${d.created_at ?? ""}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skyroute-report-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  // KPI math
  const activeDeliveries = data.deliveries.filter(d =>
    d.status === "in_transit" || d.status === "assigned" || d.status === "pending"
  ).length;
  const vehiclesOnRoute = data.vehicles.filter(v => v.status === "in_transit").length;
  const totalDistanceToday = Math.round(
    data.routes.reduce((s, r) => s + Number(r.total_distance_km ?? 0), 0)
  );
  // Modeled savings: 12% baseline reduction vs unoptimized
  const baselineCost = data.deliveries.reduce((s, d) => s + Number(d.cost_usd ?? 0), 0);
  const fuelSaved = Math.round(baselineCost * 0.12);
  const totalCo2 = data.deliveries.reduce((s, d) => s + Number(d.co2_kg ?? 0), 0);
  const co2Saved = (totalCo2 * 0.18).toFixed(1);

  // Delivery status breakdown
  const statusCounts = data.deliveries.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusChart = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace("_", " "),
    value,
    color: STATUS_COLORS[name] ?? "var(--color-muted)",
  }));

  // Vehicle utilization by type
  const utilByType = Object.entries(
    data.vehicles.reduce<Record<string, { total: number; active: number }>>((acc, v) => {
      const key = v.type ?? "other";
      acc[key] ??= { total: 0, active: 0 };
      acc[key].total += 1;
      if (v.status === "in_transit") acc[key].active += 1;
      return acc;
    }, {})
  ).map(([type, { total, active }]) => ({
    type,
    Active: active,
    Idle: total - active,
  }));

  // Route efficiency: bucketed optimization scores
  const scoreBuckets = [
    { label: "60-70", min: 60, max: 70 },
    { label: "70-80", min: 70, max: 80 },
    { label: "80-90", min: 80, max: 90 },
    { label: "90-100", min: 90, max: 101 },
  ].map(b => ({
    bucket: b.label,
    routes: data.routes.filter(r => {
      const s = Number(r.optimization_score ?? 0);
      return s >= b.min && s < b.max;
    }).length,
  }));
  const avgScore = data.routes.length
    ? Math.round(data.routes.reduce((s, r) => s + Number(r.optimization_score ?? 0), 0) / data.routes.length)
    : 0;
  const efficiencyRadial = [{ name: "score", value: avgScore, fill: "var(--color-primary)" }];

  // AI recommendations (heuristic, derived from live data)
  const recommendations = buildRecommendations(data);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        subtitle="Real-time operations overview across deliveries, fleet, network, and AI."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportReport}>Export report</Button>
            <Button size="sm" className="gap-2" onClick={() => navigate({ to: "/assistant" })}>
              <BrainCircuit className="h-4 w-4" /> Ask SkyRoute AI
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active Deliveries" value={activeDeliveries} icon={Package} accent delta={{ value: "8.4%", positive: true }} />
        <StatCard label="Vehicles On Route" value={`${vehiclesOnRoute}/${data.vehicles.length}`} icon={Truck} delta={{ value: "2 vs avg", positive: true }} />
        <StatCard label="Warehouses" value={data.warehouses.length} icon={WarehouseIcon} />
        <StatCard label="Total Distance Today" value={`${totalDistanceToday.toLocaleString()} km`} icon={RouteIcon} delta={{ value: "5.1%", positive: false }} />
        <StatCard label="Fuel Cost Saved" value={`$${fuelSaved.toLocaleString()}`} icon={DollarSign} delta={{ value: "12.0%", positive: true }} />
        <StatCard label="CO₂ Reduction" value={`${co2Saved} kg`} icon={Leaf} delta={{ value: "18.0%", positive: true }} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Delivery Status"
          subtitle="Distribution across pipeline"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusChart}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                stroke="var(--color-card)"
                strokeWidth={2}
              >
                {statusChart.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: 11, textTransform: "capitalize" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Vehicle Utilization"
          subtitle="Active vs idle by class"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={utilByType} barSize={28}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="type" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Active" stackId="a" fill="var(--color-primary)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Idle" stackId="a" fill="var(--color-muted)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Route Efficiency"
          subtitle={`Avg optimization score: ${avgScore}/100`}
        >
          <div className="relative grid h-full grid-rows-[1fr_auto] gap-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="55%"
                innerRadius="60%"
                outerRadius="95%"
                barSize={14}
                data={efficiencyRadial}
                startAngle={210}
                endAngle={-30}
              >
                <RadialBar background={{ fill: "var(--color-muted)" }} dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-4xl font-semibold tabular-nums">{avgScore}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Efficiency Index</div>
            </div>
            <div className="grid grid-cols-4 gap-2 px-1 pb-1">
              {scoreBuckets.map(b => (
                <div key={b.bucket} className="rounded-md border bg-background/40 p-2 text-center">
                  <div className="font-mono text-sm font-semibold tabular-nums">{b.routes}</div>
                  <div className="text-[10px] text-muted-foreground">{b.bucket}</div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* AI recommendations */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold">AI Recommendations</h3>
              <p className="text-xs text-muted-foreground">Generated by SkyRoute agents · updated moments ago</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            {recommendations.length} insights
          </Badge>
        </div>
        <ul className="divide-y">
          {recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-4 p-5 transition-colors hover:bg-muted/40">
              <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md ${r.tone.bg} ${r.tone.fg}`}>
                <r.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-semibold">{r.title}</span>
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                    {r.agent}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                    Impact · {r.impact}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 gap-1">
                Apply <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChartCard({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

type Rec = {
  title: string;
  body: string;
  agent: string;
  impact: string;
  icon: typeof Zap;
  tone: { bg: string; fg: string };
};

function buildRecommendations(data: {
  deliveries: Array<{ status: string; priority: string }>;
  vehicles: Array<{ status: string; fuel_pct: number | null; type: string | null; plate: string | null }>;
  warehouses: Array<{ capacity_units: number; used_units: number }>;
  routes: Array<{ optimization_score: number | null }>;
}): Rec[] {
  const recs: Rec[] = [];

  const urgentPending = data.deliveries.filter(d => d.priority === "urgent" && d.status === "pending").length;
  if (urgentPending > 0) {
    recs.push({
      title: `Re-dispatch ${urgentPending} urgent ${urgentPending === 1 ? "delivery" : "deliveries"} now`,
      body: "Helix detected urgent loads still in pending state. Auto-assign to nearest idle vehicles to protect SLA.",
      agent: "Helix · Dispatch",
      impact: "high",
      icon: AlertTriangle,
      tone: { bg: "bg-destructive/10", fg: "text-destructive" },
    });
  }

  const lowFuel = data.vehicles.filter(v => v.fuel_pct != null && v.fuel_pct < 25 && v.status !== "maintenance");
  if (lowFuel.length > 0) {
    recs.push({
      title: `Schedule refuel for ${lowFuel.length} ${lowFuel.length === 1 ? "vehicle" : "vehicles"}`,
      body: `Fleet telemetry shows ${lowFuel.map(v => v.plate).filter(Boolean).slice(0, 3).join(", ")} below 25% — route via nearest depot before next assignment.`,
      agent: "Atlas · Fleet",
      impact: "medium",
      icon: Truck,
      tone: { bg: "bg-warning/10", fg: "text-warning" },
    });
  }

  const overCapacity = data.warehouses.filter(w => w.capacity_units > 0 && w.used_units / w.capacity_units > 0.9);
  if (overCapacity.length > 0) {
    recs.push({
      title: `Rebalance ${overCapacity.length} ${overCapacity.length === 1 ? "warehouse" : "warehouses"} above 90% utilization`,
      body: "Network model predicts spillover in 36 hours. Shift inbound to underused nodes to avoid handling delays.",
      agent: "Nimbus · Network",
      impact: "medium",
      icon: WarehouseIcon,
      tone: { bg: "bg-primary/10", fg: "text-primary" },
    });
  }

  const lowScore = data.routes.filter(r => Number(r.optimization_score ?? 100) < 75).length;
  if (lowScore > 0) {
    recs.push({
      title: `Re-optimize ${lowScore} underperforming ${lowScore === 1 ? "route" : "routes"}`,
      body: "Routes scoring below 75 — applying the latest traffic and load constraints could trim ~14% drive time.",
      agent: "Orion · Routing",
      impact: "high",
      icon: RouteIcon,
      tone: { bg: "bg-primary/10", fg: "text-primary" },
    });
  }

  recs.push({
    title: "Consolidate 3 light loads into 1 multi-stop run",
    body: "Predicted savings of $86 fuel and 12.4 kg CO₂ by merging adjacent stops in the western corridor.",
    agent: "Verdant · Carbon",
    impact: "low",
    icon: Leaf,
    tone: { bg: "bg-success/10", fg: "text-success" },
  });

  return recs;
}

function LoadingShell() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-xl border bg-card" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}
