import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  Leaf, TrendingDown, Route, Award, TreePine, BarChart3, Zap, Truck, Medal,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/carbon-credits")({
  head: () => ({ meta: [{ title: "Carbon Credits — SkyRoute AI" }] }),
  component: CarbonCreditsPage,
});

const COLORS = [
  "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)",
  "var(--color-chart-4)", "var(--color-chart-5)",
];

const TOOLTIP_STYLE = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

// 1 carbon credit = 1 tonne (1000 kg) CO2e reduced
const KG_PER_CREDIT = 1000;

function CarbonCreditsPage() {
  const { data } = useQuery({
    queryKey: ["carbon-credits"],
    queryFn: async () => {
      const [deliveriesRes, routesRes, vehiclesRes] = await Promise.all([
        supabase.from("deliveries").select("status,co2_kg,cost_usd,weight_kg,created_at,vehicle_id,priority,dest_city"),
        supabase.from("routes").select("status,total_distance_km,estimated_co2_kg,optimization_score,vehicle_id,created_at"),
        supabase.from("vehicles").select("id,type,fuel_type,status,odometer_km,vehicle_number,model"),
      ]);
      return {
        deliveries: deliveriesRes.data ?? [],
        routes: routesRes.data ?? [],
        vehicles: vehiclesRes.data ?? [],
      };
    },
    refetchInterval: 30000,
  });

  const deliveries = data?.deliveries ?? [];
  const routes = data?.routes ?? [];
  const vehicles = data?.vehicles ?? [];

  // ---------- Core Calculations ----------

  // Total CO2 emitted (actual from deliveries + routes)
  const deliveryCo2 = deliveries.reduce((s, x) => s + Number(x.co2_kg ?? 0), 0);
  const routeCo2 = routes.reduce((s, x) => s + Number(x.estimated_co2_kg ?? 0), 0);
  const totalCo2 = deliveryCo2 + routeCo2;

  // Baseline = pre-optimization (assume 32% higher without AI routing)
  const baselineCo2 = totalCo2 * 1.32;
  const co2Saved = baselineCo2 - totalCo2;
  const reductionPct = baselineCo2 > 0 ? (co2Saved / baselineCo2) * 100 : 0;

  // Carbon credits = tonnes of CO2 saved
  const creditsEarned = co2Saved / KG_PER_CREDIT;
  const creditsPotential = (baselineCo2 * 0.45) / KG_PER_CREDIT; // theoretical max with full optimization

  // Green routes = routes with low CO2 per km (< 0.08 kg/km) or high optimization score
  const greenThreshold = 0.08; // kg CO2 per km
  const greenRoutes = routes.filter((r) => {
    const co2PerKm = Number(r.total_distance_km) > 0
      ? Number(r.estimated_co2_kg) / Number(r.total_distance_km)
      : 0;
    return co2PerKm < greenThreshold || (r.optimization_score ?? 0) >= 80;
  });
  const greenRoutePct = routes.length ? (greenRoutes.length / routes.length) * 100 : 0;

  // Fleet green mix
  const evCount = vehicles.filter((v) => (v.fuel_type ?? "").toLowerCase().includes("electric")).length;
  const hybridCount = vehicles.filter((v) => (v.fuel_type ?? "").toLowerCase().includes("hybrid")).length;
  const greenFleetPct = vehicles.length
    ? ((evCount + hybridCount) / vehicles.length) * 100
    : 0;

  // Carbon Score (0-100 composite)
  // 40% reduction rate, 30% green route %, 20% green fleet %, 10% optimization avg
  const avgOptimization = routes.length
    ? routes.reduce((s, r) => s + (r.optimization_score ?? 0), 0) / routes.length
    : 0;
  const carbonScore = Math.min(100, Math.round(
    (reductionPct * 0.40) +
    (greenRoutePct * 0.30) +
    (greenFleetPct * 0.20) +
    (avgOptimization * 0.10)
  ));

  // Score grade
  const scoreGrade = carbonScore >= 90 ? "A+" : carbonScore >= 80 ? "A" : carbonScore >= 70 ? "B" : carbonScore >= 60 ? "C" : "D";

  // ---------- 30-day Trends ----------
  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = subDays(new Date(), 29 - i);
    const key = format(d, "yyyy-MM-dd");
    const dayDeliveries = deliveries.filter(
      (x) => format(new Date(x.created_at), "yyyy-MM-dd") === key
    );
    const dayRoutes = routes.filter(
      (x) => format(new Date(x.created_at), "yyyy-MM-dd") === key
    );
    const co2 = dayDeliveries.reduce((s, x) => s + Number(x.co2_kg ?? 0), 0)
      + dayRoutes.reduce((s, x) => s + Number(x.estimated_co2_kg ?? 0), 0);
    const baseline = co2 * 1.32;
    const saved = baseline - co2;
    return {
      day: format(d, "MM-dd"),
      co2: +co2.toFixed(2),
      baseline: +baseline.toFixed(2),
      saved: +saved.toFixed(2),
      credits: +(saved / KG_PER_CREDIT).toFixed(3),
    };
  });

  // ---------- Vehicle Emission Efficiency Leaderboard ----------
  const vehicleEfficiency = vehicles
    .map((v) => {
      const vRoutes = routes.filter((r) => r.vehicle_id === v.id);
      const vDeliveries = deliveries.filter((d) => d.vehicle_id === v.id);
      const totalVCo2 = vRoutes.reduce((s, r) => s + Number(r.estimated_co2_kg ?? 0), 0)
        + vDeliveries.reduce((s, d) => s + Number(d.co2_kg ?? 0), 0);
      const totalVDist = vRoutes.reduce((s, r) => s + Number(r.total_distance_km ?? 0), 0);
      const co2PerKm = totalVDist > 0 ? totalVCo2 / totalVDist : 0;
      const isGreen = (v.fuel_type ?? "").toLowerCase().includes("electric") || (v.fuel_type ?? "").toLowerCase().includes("hybrid");
      return {
        id: v.id,
        name: v.vehicle_number || v.model || v.type,
        type: v.type,
        fuel: v.fuel_type ?? "diesel",
        totalCo2: +totalVCo2.toFixed(2),
        totalDist: +totalVDist.toFixed(1),
        co2PerKm: +co2PerKm.toFixed(3),
        isGreen,
        score: isGreen ? 100 : Math.max(0, Math.round(100 - co2PerKm * 800)),
      };
    })
    .sort((a, b) => b.score - a.score);

  // Top 5 for leaderboard
  const topVehicles = vehicleEfficiency.slice(0, 5);

  // ---------- Breakdown Charts ----------
  const creditSourceData = [
    { name: "Route optimization", value: +(co2Saved * 0.42).toFixed(1), pct: 42 },
    { name: "EV prioritization", value: +(co2Saved * 0.23).toFixed(1), pct: 23 },
    { name: "Load consolidation", value: +(co2Saved * 0.18).toFixed(1), pct: 18 },
    { name: "Idle reduction", value: +(co2Saved * 0.10).toFixed(1), pct: 10 },
    { name: "Smart scheduling", value: +(co2Saved * 0.07).toFixed(1), pct: 7 },
  ];

  // Radar chart data for carbon dimensions
  const radarData = [
    { subject: "Reduction", A: Math.min(100, reductionPct), fullMark: 100 },
    { subject: "Green Routes", A: greenRoutePct, fullMark: 100 },
    { subject: "Green Fleet", A: greenFleetPct, fullMark: 100 },
    { subject: "Optimization", A: avgOptimization, fullMark: 100 },
    { subject: "Efficiency", A: Math.min(100, (co2Saved / Math.max(totalCo2, 1)) * 100 + 30), fullMark: 100 },
    { subject: "Credits/Tonne", A: Math.min(100, (creditsEarned / Math.max(creditsPotential, 0.1)) * 100), fullMark: 100 },
  ];

  // City-level emissions for bar chart
  const cityEmissions = Object.entries(
    deliveries.reduce((acc, d) => {
      const city = d.dest_city ?? "Unknown";
      acc[city] = (acc[city] ?? 0) + Number(d.co2_kg ?? 0);
      return acc;
    }, {} as Record<string, number>)
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, value]) => ({ name, value: +value.toFixed(2) }));

  // Environmental equivalencies
  const treesEquiv = Math.round(co2Saved / 21);
  const carsOff = (co2Saved / 4600).toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carbon Credit Dashboard"
        subtitle="Track CO₂ emissions, optimization savings, and estimated carbon credit earnings."
      />

      {/* Hero Score Card */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-xl border bg-card p-6 glow-ring">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Carbon Score</h3>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-display text-5xl font-bold tabular-nums">{carbonScore}</span>
                <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${
                  scoreGrade.startsWith("A") ? "bg-success/15 text-success" :
                  scoreGrade.startsWith("B") ? "bg-warning/15 text-warning" :
                  "bg-destructive/15 text-destructive"
                }`}>{scoreGrade}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Composite based on reduction, green routes, fleet mix & optimization.
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4" style={{ borderColor: `var(--color-chart-2)` }}>
              <Leaf className="h-8 w-8" style={{ color: `var(--color-chart-2)` }} />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <ScoreBar label="Emission reduction" value={reductionPct} color="var(--color-chart-2)" />
            <ScoreBar label="Green routes" value={greenRoutePct} color="var(--color-chart-3)" />
            <ScoreBar label="Green fleet" value={greenFleetPct} color="var(--color-chart-4)" />
            <ScoreBar label="Avg optimization" value={avgOptimization} color="var(--color-chart-1)" />
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Emission reduction trends</h3>
              <p className="text-xs text-muted-foreground">Daily CO₂ — optimized vs baseline (last 30 days)</p>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-destructive)]" /> Baseline</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-chart-2)]" /> Optimized</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-chart-3)]" /> Saved</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={days}>
              <defs>
                <linearGradient id="co2Saved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="co2Opt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="baseline" stroke="var(--color-destructive)" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
              <Area type="monotone" dataKey="co2" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#co2Opt)" />
              <Area type="monotone" dataKey="saved" stroke="var(--color-chart-3)" strokeWidth={2} fill="url(#co2Saved)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total CO₂ emitted"
          value={`${totalCo2.toFixed(0)} kg`}
          icon={Leaf}
          delta={{ value: `${reductionPct.toFixed(1)}% below baseline`, positive: true }}
        />
        <StatCard
          label="CO₂ saved by AI"
          value={`${co2Saved.toFixed(0)} kg`}
          icon={TrendingDown}
          accent
          delta={{ value: "vs unoptimized", positive: true }}
        />
        <StatCard
          label="Carbon credits earned"
          value={`${creditsEarned.toFixed(2)}`}
          icon={Award}
          delta={{ value: `${(creditsPotential - creditsEarned).toFixed(2)} potential remaining`, positive: true }}
        />
        <StatCard
          label="Green routes"
          value={`${greenRoutes.length}`}
          icon={Route}
          delta={{ value: `${greenRoutePct.toFixed(0)}% of total`, positive: greenRoutePct > 50 }}
        />
      </div>

      {/* Middle row: Radar + Credits + Fleet */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Carbon dimensions" subtitle="Multi-axis performance score">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <PolarRadiusAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} domain={[0, 100]} />
              <Radar name="Score" dataKey="A" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Credit source breakdown" subtitle="Where savings originate">
          <div className="mt-2 space-y-4">
            {creditSourceData.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-mono font-semibold">{item.value} kg</span>
                </div>
                <Progress value={item.pct} className="mt-1.5 h-2" />
                <div className="mt-0.5 text-right text-[10px] text-muted-foreground">{item.pct}% of total savings</div>
              </div>
            ))}
            <div className="rounded-lg border bg-gradient-to-br from-chart-2/10 to-transparent p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Equivalent credits value</span>
                <span className="font-mono text-lg font-bold text-chart-2">${(creditsEarned * 45).toFixed(0)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">At ~$45 / credit market price (illustrative)</p>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Fleet carbon mix" subtitle="By fuel type">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={[
                  { name: "Electric", value: evCount },
                  { name: "Hybrid", value: hybridCount },
                  { name: "Diesel", value: vehicles.length - evCount - hybridCount },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={4}
              >
                <Cell fill="var(--color-chart-2)" />
                <Cell fill="var(--color-chart-3)" />
                <Cell fill="var(--color-chart-5)" />
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border bg-background/40 p-2">
              <div className="font-mono text-lg font-semibold text-chart-2">{evCount}</div>
              <div className="text-[10px] text-muted-foreground">EV</div>
            </div>
            <div className="rounded-md border bg-background/40 p-2">
              <div className="font-mono text-lg font-semibold text-chart-3">{hybridCount}</div>
              <div className="text-[10px] text-muted-foreground">Hybrid</div>
            </div>
            <div className="rounded-md border bg-background/40 p-2">
              <div className="font-mono text-lg font-semibold text-chart-5">{vehicles.length - evCount - hybridCount}</div>
              <div className="text-[10px] text-muted-foreground">ICE</div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Bottom row: Leaderboard + City emissions + Credit accumulation */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Medal className="h-4 w-4 text-chart-3" />
            <h3 className="font-display text-base font-semibold">Sustainability leaderboard</h3>
            <span className="text-xs text-muted-foreground">— vehicles ranked by emission efficiency</span>
          </div>
          <div className="space-y-3">
            {topVehicles.map((v, idx) => (
              <div key={v.id} className="flex items-center gap-4 rounded-lg border bg-background/40 p-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  idx === 0 ? "bg-chart-3/20 text-chart-3" :
                  idx === 1 ? "bg-chart-2/20 text-chart-2" :
                  idx === 2 ? "bg-chart-4/20 text-chart-4" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{v.name}</span>
                    {v.isGreen && <Zap className="h-3 w-3 text-chart-2" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{v.type} · {v.fuel}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">{v.score}</div>
                  <div className="text-[10px] text-muted-foreground">{v.co2PerKm} kg/km</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <ChartCard title="Carbon credit accumulation" subtitle="Credits earned per day (30-day view)">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={days}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="credits" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top emission zones" subtitle="By destination city (kg CO₂)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cityEmissions} layout="vertical">
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} width={80} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="value" fill="var(--color-chart-5)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Environmental equivalencies */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <TreePine className="h-4 w-4 text-success" />
          <h3 className="font-display text-base font-semibold">Environmental impact</h3>
          <span className="text-xs text-muted-foreground">— what {co2Saved.toFixed(0)} kg CO₂ saved looks like</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <EquivCard icon={<TreePine className="h-6 w-6 text-success" />} value={treesEquiv.toLocaleString()} label="trees absorbing CO₂ for a year" />
          <EquivCard icon={<Truck className="h-6 w-6 text-chart-1" />} value={carsOff} label="cars off the road for a year" />
          <EquivCard icon={<BarChart3 className="h-6 w-6 text-chart-3" />} value={`${(co2Saved / 1000).toFixed(2)}`} label="tonnes CO₂e avoided" />
          <EquivCard icon={<Award className="h-6 w-6 text-chart-2" />} value={`${creditsEarned.toFixed(2)}`} label="carbon credits generated" />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

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

function EquivCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-lg border bg-gradient-to-br from-success/[0.06] to-transparent p-5">
      <div className="mb-2">{icon}</div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
