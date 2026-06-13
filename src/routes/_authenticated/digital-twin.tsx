import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { LogisticsMap } from "@/components/LogisticsMap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  CloudRain, Construction, Wrench, PackagePlus, Activity, Sparkles,
  TrendingDown, TrendingUp, Truck, Warehouse, Package, Route as RouteIcon,
  Bot, Radio, RotateCcw, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/digital-twin")({
  head: () => ({ meta: [{ title: "Digital Twin — SkyRoute AI" }] }),
  ssr: false,
  component: DigitalTwinPage,
});

type Scenario = "traffic" | "breakdown" | "weather" | "spike";

type AgentLog = {
  id: string;
  agent: string;
  action: string;
  detail: string;
  ts: number;
  tone: "info" | "warn" | "success";
};

type Metrics = {
  avgEtaMin: number;
  onTimePct: number;
  costUsd: number;
  co2Kg: number;
  utilization: number;
  activeRoutes: number;
};

const SCENARIOS: Record<Scenario, {
  label: string; icon: any; color: string; description: string;
  impact: { eta: number; onTime: number; cost: number; co2: number; utilization: number };
}> = {
  traffic: {
    label: "Traffic Congestion", icon: Construction, color: "text-amber-500",
    description: "Major arterials report 40%+ slowdown across 3 metros.",
    impact: { eta: 1.35, onTime: -22, cost: 1.18, co2: 1.22, utilization: -8 },
  },
  breakdown: {
    label: "Vehicle Breakdown", icon: Wrench, color: "text-red-500",
    description: "Two long-haul vehicles offline — load redistribution required.",
    impact: { eta: 1.18, onTime: -14, cost: 1.25, co2: 1.10, utilization: -15 },
  },
  weather: {
    label: "Weather Disruption", icon: CloudRain, color: "text-blue-500",
    description: "Storm system affecting north-east corridor for 6h.",
    impact: { eta: 1.42, onTime: -28, cost: 1.30, co2: 1.15, utilization: -12 },
  },
  spike: {
    label: "Delivery Spike", icon: PackagePlus, color: "text-violet-500",
    description: "Inbound order volume up 3.2× over baseline (flash sale).",
    impact: { eta: 1.28, onTime: -18, cost: 1.40, co2: 1.35, utilization: 18 },
  },
};

const AGENT_PLAYBOOK: Record<Scenario, AgentLog[]> = {
  traffic: [
    { id: "", agent: "Route Agent", action: "Re-routing fleet", detail: "Diverting 12 vehicles via secondary corridors. ETA recovery: 78%.", ts: 0, tone: "info" },
    { id: "", agent: "Dispatch Agent", action: "Resequencing stops", detail: "Reprioritized 34 deliveries by SLA risk and proximity clusters.", ts: 0, tone: "info" },
    { id: "", agent: "Sustainability Agent", action: "Idle mitigation", detail: "Paused 4 EV departures to avoid stop-and-go battery drain.", ts: 0, tone: "warn" },
    { id: "", agent: "Cost Agent", action: "Toll optimization", detail: "Approved $214 in toll spend to preserve 11 on-time deliveries.", ts: 0, tone: "success" },
  ],
  breakdown: [
    { id: "", agent: "Dispatch Agent", action: "Asset failover", detail: "TRK-4112 & TRK-2208 marked offline. Loads transferred to 3 backups.", ts: 0, tone: "warn" },
    { id: "", agent: "Route Agent", action: "Recalculating chains", detail: "Rebuilt 9 multi-stop routes; avg detour 14.2 km.", ts: 0, tone: "info" },
    { id: "", agent: "Cost Agent", action: "Maintenance dispatch", detail: "Roadside service ETA 38 min. Estimated downtime cost: $1.2k.", ts: 0, tone: "info" },
    { id: "", agent: "Sustainability Agent", action: "CO₂ rebalance", detail: "Shifted 2 long-haul legs to electric fleet to offset detour emissions.", ts: 0, tone: "success" },
  ],
  weather: [
    { id: "", agent: "Route Agent", action: "Corridor avoidance", detail: "Excluded I-95 N segment until 18:00. 22 routes rebuilt.", ts: 0, tone: "warn" },
    { id: "", agent: "Dispatch Agent", action: "Driver safety hold", detail: "Held 6 departures, notified 84 customers with new ETAs.", ts: 0, tone: "info" },
    { id: "", agent: "Cost Agent", action: "Hub rebalancing", detail: "Pre-staged inventory at 2 secondary hubs to absorb backlog.", ts: 0, tone: "info" },
    { id: "", agent: "Sustainability Agent", action: "Consolidation", detail: "Merged 11 partial loads — 1,840 km saved vs. naive recovery.", ts: 0, tone: "success" },
  ],
  spike: [
    { id: "", agent: "Dispatch Agent", action: "Surge activation", detail: "Activated 7 reserve vehicles and 3 contractor drivers.", ts: 0, tone: "info" },
    { id: "", agent: "Route Agent", action: "Cluster batching", detail: "Built 28 micro-batches by zip cluster. Avg stops/route: 18.", ts: 0, tone: "info" },
    { id: "", agent: "Cost Agent", action: "Dynamic pricing", detail: "Promoted next-day option on 412 low-priority orders. Capacity freed: 22%.", ts: 0, tone: "success" },
    { id: "", agent: "Sustainability Agent", action: "EV-first dispatch", detail: "Routed 64% of urban surge volume to electric fleet.", ts: 0, tone: "success" },
  ],
};

function baselineFrom(data: any): Metrics {
  const deliveries = data?.deliveries ?? [];
  const routes = data?.routes ?? [];
  const vehicles = data?.vehicles ?? [];
  const inTransit = vehicles.filter((v: any) => v.status === "in_transit").length;
  const avgEta = routes.length
    ? routes.reduce((a: number, r: any) => a + Number(r.total_duration_min || 0), 0) / routes.length
    : 64;
  const cost = deliveries.reduce((a: number, d: any) => a + Number(d.cost_usd || 0), 0) || 18420;
  const co2 = deliveries.reduce((a: number, d: any) => a + Number(d.co2_kg || 0), 0) || 1265;
  return {
    avgEtaMin: Math.round(avgEta),
    onTimePct: 94,
    costUsd: Math.round(cost),
    co2Kg: Math.round(co2),
    utilization: Math.min(95, 55 + inTransit * 2),
    activeRoutes: routes.length,
  };
}

function applyDisruption(base: Metrics, s: Scenario): Metrics {
  const i = SCENARIOS[s].impact;
  return {
    avgEtaMin: Math.round(base.avgEtaMin * i.eta),
    onTimePct: Math.max(35, base.onTimePct + i.onTime),
    costUsd: Math.round(base.costUsd * i.cost),
    co2Kg: Math.round(base.co2Kg * i.co2),
    utilization: Math.max(20, Math.min(99, base.utilization + i.utilization)),
    activeRoutes: base.activeRoutes,
  };
}

function applyOptimization(disrupted: Metrics, base: Metrics, intensity: number): Metrics {
  // intensity 0..100 — recover toward baseline, plus a small bonus on cost/co2.
  const r = intensity / 100;
  const lerp = (a: number, b: number) => a + (b - a) * r;
  return {
    avgEtaMin: Math.round(lerp(disrupted.avgEtaMin, base.avgEtaMin * 0.96)),
    onTimePct: Math.round(lerp(disrupted.onTimePct, Math.min(98, base.onTimePct + 2))),
    costUsd: Math.round(lerp(disrupted.costUsd, base.costUsd * 0.94)),
    co2Kg: Math.round(lerp(disrupted.co2Kg, base.co2Kg * 0.88)),
    utilization: Math.round(lerp(disrupted.utilization, Math.min(96, base.utilization + 4))),
    activeRoutes: disrupted.activeRoutes,
  };
}

function DigitalTwinPage() {
  const [tick, setTick] = useState(0);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [phase, setPhase] = useState<"idle" | "disrupted" | "optimized">("idle");
  const [intensity, setIntensity] = useState(75);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // Live counts from DB to keep the twin feeling real-time.
  const { data } = useQuery({
    queryKey: ["twin-stats", tick],
    refetchInterval: 5000,
    queryFn: async () => {
      const [v, w, d, r] = await Promise.all([
        supabase.from("vehicles").select("id,status,fuel_pct,battery_pct,current_lat,current_lng"),
        supabase.from("warehouses").select("id,status,capacity_units,used_units"),
        supabase.from("deliveries").select("id,status,priority,cost_usd,co2_kg"),
        supabase.from("routes").select("id,status,total_duration_min,optimization_score"),
      ]);
      return {
        vehicles: v.data ?? [], warehouses: w.data ?? [],
        deliveries: d.data ?? [], routes: r.data ?? [],
      };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("twin-vehicles")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => setTick(t => t + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const baseline = useMemo(() => baselineFrom(data), [data]);
  const disrupted = useMemo(
    () => (scenario ? applyDisruption(baseline, scenario) : baseline),
    [baseline, scenario],
  );
  const optimized = useMemo(
    () => (scenario ? applyOptimization(disrupted, baseline, intensity) : baseline),
    [disrupted, baseline, intensity, scenario],
  );

  function triggerScenario(s: Scenario) {
    setScenario(s);
    setPhase("disrupted");
    const t = Date.now();
    setLogs([{
      id: `${t}-trigger`, agent: "Telemetry", tone: "warn",
      action: `Disruption detected: ${SCENARIOS[s].label}`,
      detail: SCENARIOS[s].description, ts: t,
    }]);
    // Stream agent reactions.
    AGENT_PLAYBOOK[s].forEach((entry, idx) => {
      setTimeout(() => {
        setLogs(prev => [...prev, { ...entry, id: `${t}-${idx}`, ts: Date.now() }]);
      }, 600 + idx * 700);
    });
    setTimeout(() => setPhase("optimized"), 600 + AGENT_PLAYBOOK[s].length * 700 + 300);
  }

  function reset() {
    setScenario(null); setPhase("idle"); setLogs([]);
  }

  const counts = {
    vehicles: data?.vehicles.length ?? 0,
    inTransit: data?.vehicles.filter(v => v.status === "in_transit").length ?? 0,
    warehouses: data?.warehouses.length ?? 0,
    deliveries: data?.deliveries.length ?? 0,
    routes: data?.routes.length ?? 0,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Digital Twin"
        subtitle="A live mirror of the logistics network. Simulate disruptions and watch autonomous agents respond."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live sync
            </Badge>
            {scenario && (
              <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            )}
          </div>
        }
      />

      {/* Twin counters */}
      <div className="grid gap-3 md:grid-cols-4">
        <TwinStat icon={Warehouse} label="Warehouses" value={counts.warehouses} sub="online" />
        <TwinStat icon={Truck} label="Vehicles" value={counts.vehicles} sub={`${counts.inTransit} in transit`} />
        <TwinStat icon={Package} label="Deliveries" value={counts.deliveries} sub="tracked" />
        <TwinStat icon={RouteIcon} label="Routes" value={counts.routes} sub="active plans" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <LogisticsMap height={520} />

          {/* Before / After */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Before vs After Optimization
                  </CardTitle>
                  <CardDescription>
                    {scenario
                      ? `Agent-led recovery from ${SCENARIOS[scenario].label.toLowerCase()}.`
                      : "Run a simulation to compare network performance."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 min-w-[220px]">
                  <span className="text-xs text-muted-foreground">Optimizer intensity</span>
                  <Slider value={[intensity]} onValueChange={v => setIntensity(v[0])} max={100} step={1} className="w-32" />
                  <span className="text-xs font-mono w-8 text-right">{intensity}%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <CompareMetric label="Avg ETA" unit="min" before={disrupted.avgEtaMin} after={optimized.avgEtaMin} baseline={baseline.avgEtaMin} lowerIsBetter />
                <CompareMetric label="On-time" unit="%" before={disrupted.onTimePct} after={optimized.onTimePct} baseline={baseline.onTimePct} />
                <CompareMetric label="Cost" unit="$" before={disrupted.costUsd} after={optimized.costUsd} baseline={baseline.costUsd} lowerIsBetter />
                <CompareMetric label="CO₂" unit="kg" before={disrupted.co2Kg} after={optimized.co2Kg} baseline={baseline.co2Kg} lowerIsBetter />
                <CompareMetric label="Fleet utilization" unit="%" before={disrupted.utilization} after={optimized.utilization} baseline={baseline.utilization} />
                <CompareMetric label="Active routes" unit="" before={disrupted.activeRoutes} after={optimized.activeRoutes} baseline={baseline.activeRoutes} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scenarios + agent stream */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Simulate disruption</CardTitle>
              <CardDescription>Inject a scenario into the twin.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {(Object.keys(SCENARIOS) as Scenario[]).map(s => {
                const cfg = SCENARIOS[s];
                const Icon = cfg.icon;
                const active = scenario === s;
                return (
                  <button
                    key={s}
                    onClick={() => triggerScenario(s)}
                    className={cn(
                      "group flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all hover:border-primary/60 hover:bg-accent/40",
                      active && "border-primary bg-primary/5 ring-1 ring-primary/30",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", cfg.color)} />
                    <div className="text-sm font-medium leading-tight">{cfg.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug">{cfg.description}</div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Radio className={cn("h-4 w-4", phase === "disrupted" ? "text-amber-500 animate-pulse" : phase === "optimized" ? "text-emerald-500" : "text-muted-foreground")} />
                Autonomous agent response
              </CardTitle>
              <CardDescription>
                {phase === "idle" && "Idle — agents are monitoring the twin."}
                {phase === "disrupted" && "Agents negotiating recovery plan…"}
                {phase === "optimized" && "Consensus reached. Plan applied."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[360px] pr-3">
                {logs.length === 0 ? (
                  <div className="flex h-[320px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
                    <Activity className="h-8 w-8 mb-2 opacity-40" />
                    Trigger a scenario to see agents react.
                  </div>
                ) : (
                  <ol className="relative space-y-3 border-l pl-4">
                    {logs.map((l) => {
                      const ago = Math.max(0, Math.round((now - l.ts) / 1000));
                      return (
                        <li key={l.id} className="relative">
                          <span className={cn(
                            "absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                            l.tone === "success" && "bg-emerald-500",
                            l.tone === "warn" && "bg-amber-500",
                            l.tone === "info" && "bg-primary",
                          )} />
                          <div className="flex items-center gap-2">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold">{l.agent}</span>
                            <span className="text-[10px] text-muted-foreground">· {ago}s ago</span>
                          </div>
                          <div className="text-sm font-medium leading-snug mt-0.5">{l.action}</div>
                          <div className="text-xs text-muted-foreground leading-snug">{l.detail}</div>
                          <Separator className="mt-3" />
                        </li>
                      );
                    })}
                  </ol>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TwinStat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number; sub: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-display font-semibold leading-none">{value}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompareMetric({
  label, unit, before, after, baseline, lowerIsBetter,
}: { label: string; unit: string; before: number; after: number; baseline: number; lowerIsBetter?: boolean }) {
  const delta = after - before;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const pct = before === 0 ? 0 : Math.abs((delta / before) * 100);
  const fmt = (n: number) => unit === "$" ? `$${n.toLocaleString()}` : `${n.toLocaleString()}${unit}`;
  // Progress shows recovery toward baseline.
  const span = Math.abs(before - baseline) || 1;
  const recovered = Math.max(0, Math.min(100, ((Math.abs(before - after)) / span) * 100));
  return (
    <div className="rounded-lg border p-3 bg-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Badge variant={improved ? "default" : "secondary"} className="gap-1 text-[10px] h-5 px-1.5">
          {improved ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          {pct.toFixed(0)}%
        </Badge>
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Before</div>
          <div className="text-sm font-mono line-through opacity-60">{fmt(before)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground uppercase">After</div>
          <div className="text-base font-display font-semibold">{fmt(after)}</div>
        </div>
      </div>
      <Progress value={recovered} className="h-1 mt-2" />
    </div>
  );
}
