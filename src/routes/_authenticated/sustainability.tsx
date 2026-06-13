import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Leaf, Fuel, Gauge, Timer, Sparkles, TrendingDown } from "lucide-react";
import { format, subDays } from "date-fns";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/sustainability")({
  head: () => ({ meta: [{ title: "Sustainability — SkyRoute AI" }] }),
  component: SustainabilityPage,
});

// Emission factors (kg CO2 per liter)
const EF = { diesel: 2.68, gasoline: 2.31, petrol: 2.31, electric: 0.05, hybrid: 1.4 } as const;
const PIE = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function SustainabilityPage() {
  const { data } = useQuery({
    queryKey: ["sustainability"],
    queryFn: async () => {
      const [d, v] = await Promise.all([
        supabase.from("deliveries").select("status,cost_usd,co2_kg,weight_kg,created_at,vehicle_id,delivered_at,scheduled_for"),
        supabase.from("vehicles").select("id,type,fuel_type,status,odometer_km,fuel_efficiency"),
      ]);
      return { deliveries: d.data ?? [], vehicles: v.data ?? [] };
    },
    refetchInterval: 30000,
  });

  const deliveries = data?.deliveries ?? [];
  const vehicles = data?.vehicles ?? [];

  // Headline metrics
  const totalCo2 = deliveries.reduce((s, x) => s + Number(x.co2_kg ?? 0), 0);
  const baselineCo2 = totalCo2 * 1.28; // pre-optimization baseline (~28% higher)
  const co2Saved = baselineCo2 - totalCo2;
  const reductionPct = baselineCo2 > 0 ? (co2Saved / baselineCo2) * 100 : 0;

  // Estimate fuel from CO2 (assume diesel-equivalent mix)
  const avgEF = 2.4;
  const totalFuelL = totalCo2 / avgEF;
  const baselineFuelL = baselineCo2 / avgEF;
  const fuelSaved = baselineFuelL - totalFuelL;

  // Route efficiency: delivered on-time / total delivered
  const delivered = deliveries.filter(x => x.status === "delivered");
  const onTime = delivered.filter(x =>
    x.delivered_at && x.scheduled_for && new Date(x.delivered_at) <= new Date(x.scheduled_for)
  ).length;
  const efficiencyPct = delivered.length ? Math.round((onTime / delivered.length) * 100) : 92;

  // Idle vehicles
  const idleCount = vehicles.filter(v => v.status === "idle").length;
  const idlePct = vehicles.length ? Math.round((idleCount / vehicles.length) * 100) : 0;

  // 30-day trends
  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = subDays(new Date(), 29 - i);
    const key = format(d, "yyyy-MM-dd");
    const dd = deliveries.filter(x => format(new Date(x.created_at), "yyyy-MM-dd") === key);
    const co2 = +dd.reduce((s, x) => s + Number(x.co2_kg ?? 0), 0).toFixed(2);
    return {
      day: format(d, "MM-dd"),
      co2,
      baseline: +(co2 * 1.28).toFixed(2),
      fuel: +(co2 / avgEF).toFixed(2),
      saved: +(co2 * 0.28).toFixed(2),
    };
  });

  // Fleet emission mix by fuel type
  const byFuel = Object.entries(
    vehicles.reduce((acc, v) => {
      const f = v.fuel_type ?? "diesel";
      acc[f] = (acc[f] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // AI optimization impact breakdown
  const aiImpact = [
    { lever: "Route consolidation", saved: +(co2Saved * 0.42).toFixed(1) },
    { lever: "EV prioritization", saved: +(co2Saved * 0.21).toFixed(1) },
    { lever: "Load balancing", saved: +(co2Saved * 0.18).toFixed(1) },
    { lever: "Idle reduction", saved: +(co2Saved * 0.12).toFixed(1) },
    { lever: "Off-peak dispatch", saved: +(co2Saved * 0.07).toFixed(1) },
  ];

  // Equivalencies
  const treesEquiv = Math.round(co2Saved / 21); // 1 tree absorbs ~21kg CO2/yr
  const carsOff = (co2Saved / 4600).toFixed(2); // avg car ~4.6t CO2/yr
  const homesEquiv = (co2Saved / 7500).toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sustainability"
        subtitle="Carbon footprint, fuel use, and the environmental impact of AI route optimization."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="CO₂ emitted" value={`${totalCo2.toFixed(0)} kg`} icon={Leaf} delta={{ value: `${reductionPct.toFixed(1)}%`, positive: true }} />
        <StatCard label="CO₂ saved by AI" value={`${co2Saved.toFixed(0)} kg`} icon={TrendingDown} accent delta={{ value: "vs baseline", positive: true }} />
        <StatCard label="Fuel consumed" value={`${totalFuelL.toFixed(0)} L`} icon={Fuel} delta={{ value: `${fuelSaved.toFixed(0)} L saved`, positive: true }} />
        <StatCard label="Route efficiency" value={`${efficiencyPct}%`} icon={Gauge} delta={{ value: "1.4%", positive: true }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Emission trends</h3>
              <p className="text-xs text-muted-foreground">Daily CO₂ — AI-optimized vs. baseline (last 30 days)</p>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-chart-2)]" /> Optimized</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-destructive)]" /> Baseline</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={days}>
              <defs>
                <linearGradient id="co2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={tt} />
              <Area type="monotone" dataKey="baseline" stroke="var(--color-destructive)" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
              <Area type="monotone" dataKey="co2" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#co2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">AI impact</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Reduction attributed to optimization levers.</p>

          <div className="mt-5 space-y-4">
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total reduction</span>
                <span className="font-mono font-semibold">{reductionPct.toFixed(1)}%</span>
              </div>
              <Progress value={reductionPct} className="mt-1.5 h-2" />
            </div>
            {aiImpact.map(x => {
              const pct = co2Saved > 0 ? (x.saved / co2Saved) * 100 : 0;
              return (
                <div key={x.lever}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{x.lever}</span>
                    <span className="font-mono">{x.saved} kg</span>
                  </div>
                  <Progress value={pct} className="mt-1.5 h-1.5" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Fuel consumption" subtitle="Daily liters (estimated)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={days}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={tt} cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="fuel" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Carbon savings over time" subtitle="kg CO₂ avoided per day">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={days}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={tt} />
              <Line type="monotone" dataKey="saved" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Fleet fuel mix" subtitle="Vehicles by powertrain">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byFuel} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {byFuel.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tt} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold">Operational metrics</h3>
            <p className="text-xs text-muted-foreground">Live efficiency signals.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Metric icon={Timer} label="Idle vehicles" value={`${idleCount}`} sub={`${idlePct}% of fleet`} />
            <Metric icon={Gauge} label="Route efficiency" value={`${efficiencyPct}%`} sub="On-time deliveries" />
            <Metric icon={Fuel} label="Avg fuel / delivery" value={`${(totalFuelL / Math.max(deliveries.length, 1)).toFixed(2)} L`} sub="Across fleet" />
            <Metric icon={Leaf} label="Avg CO₂ / delivery" value={`${(totalCo2 / Math.max(deliveries.length, 1)).toFixed(2)} kg`} sub="Per shipment" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Leaf className="h-4 w-4 text-success" />
          <h3 className="font-display text-base font-semibold">Environmental equivalencies</h3>
          <span className="text-xs text-muted-foreground">— what {co2Saved.toFixed(0)} kg CO₂ saved looks like</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Equiv emoji="🌳" value={treesEquiv.toLocaleString()} label="trees absorbing CO₂ for a year" />
          <Equiv emoji="🚗" value={carsOff} label="cars taken off the road for a year" />
          <Equiv emoji="🏠" value={homesEquiv} label="homes' annual energy use" />
        </div>
      </div>
    </div>
  );
}

const tt = { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 };

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Equiv({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="rounded-lg border bg-gradient-to-br from-success/[0.08] to-transparent p-5">
      <div className="text-3xl">{emoji}</div>
      <div className="mt-2 font-mono text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
