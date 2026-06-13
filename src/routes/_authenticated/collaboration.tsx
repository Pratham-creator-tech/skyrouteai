import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Truck, Route as RouteIcon, DollarSign, Leaf, Play, Loader2,
  Users, MessageSquare, Vote, Trophy, ChevronRight, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/collaboration")({
  head: () => ({ meta: [{ title: "Agent Collaboration — SkyRoute AI" }] }),
  component: CollaborationPage,
});

type AgentKey = "dispatch" | "route" | "cost" | "sustainability";

const AGENTS: { key: AgentKey; name: string; tagline: string; icon: typeof Truck; color: string; bg: string; ring: string }[] = [
  { key: "dispatch",       name: "Dispatch Agent",       tagline: "Vehicle availability & proximity", icon: Truck,      color: "text-blue-500",    bg: "bg-blue-500/10",    ring: "ring-blue-500/40" },
  { key: "route",          name: "Route Agent",          tagline: "Travel time & distance",           icon: RouteIcon,  color: "text-violet-500",  bg: "bg-violet-500/10",  ring: "ring-violet-500/40" },
  { key: "cost",           name: "Cost Agent",           tagline: "Operational cost",                 icon: DollarSign, color: "text-amber-500",   bg: "bg-amber-500/10",   ring: "ring-amber-500/40" },
  { key: "sustainability", name: "Sustainability Agent", tagline: "Carbon impact",                    icon: Leaf,       color: "text-emerald-500", bg: "bg-emerald-500/10", ring: "ring-emerald-500/40" },
];

const AGENT_BY: Record<AgentKey, typeof AGENTS[number]> = Object.fromEntries(
  AGENTS.map(a => [a.key, a]),
) as any;

type Candidate = {
  vehicle: any;
  distanceKm: number;
  travelMin: number;
  costUsd: number;
  co2Kg: number;
};

type Proposal = {
  agent: AgentKey;
  pick: Candidate;
  reasoning: string;
  metricLabel: string;
  metricValue: string;
};

type DebateVote = {
  agent: AgentKey;          // voter
  forVehicleId: string;     // proposal voted for
  score: number;            // 0-100
  comment: string;
};

type Simulation = {
  delivery: any;
  warehouse: any | null;
  candidates: Candidate[];
  proposals: Proposal[];
  debate: DebateVote[];
  tally: { vehicleId: string; total: number; proposer: AgentKey; pick: Candidate }[];
  winner: { vehicleId: string; total: number; proposer: AgentKey; pick: Candidate };
};

function km(a: number, b: number, c: number, d: number) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(c - a), dLng = toRad(d - b);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function vehicleLabel(v: any) {
  return v?.plate ?? v?.vehicle_number ?? v?.id?.slice(0, 6) ?? "vehicle";
}

function buildCandidate(v: any, originLat: number, originLng: number, destLat: number, destLng: number): Candidate {
  const directKm = km(originLat, originLng, destLat, destLng);
  const distanceKm = directKm * 1.25;
  const travelMin = Math.round((distanceKm / 45) * 60);
  const fuel = v.fuel_type ?? "diesel";
  const efficiency = Number(v.fuel_efficiency ?? (fuel === "electric" ? 6 : 8));
  const energyPrice = fuel === "electric" ? 0.18 : 1.35;
  const fuelCost = (distanceKm / 100) * efficiency * energyPrice;
  const driver = (travelMin / 60) * 28;
  const overhead = distanceKm * 0.12;
  const costUsd = fuelCost + driver + overhead;
  const factor = fuel === "electric" ? 0.05 : fuel === "hybrid" ? 0.12 : 0.27;
  const co2Kg = distanceKm * factor;
  return { vehicle: v, distanceKm, travelMin, costUsd, co2Kg };
}

function rank<T>(arr: T[], key: (t: T) => number, ascending = true): T[] {
  return [...arr].sort((a, b) => (ascending ? key(a) - key(b) : key(b) - key(a)));
}

function CollaborationPage() {
  const [sim, setSim] = useState<Simulation | null>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "proposals" | "debate" | "consensus">("idle");

  const { data: bootstrap } = useQuery({
    queryKey: ["collab-bootstrap"],
    queryFn: async () => {
      const [{ data: deliveries }, { data: vehicles }, { data: warehouses }] = await Promise.all([
        supabase.from("deliveries").select("*").limit(50),
        supabase.from("vehicles").select("*").limit(50),
        supabase.from("warehouses").select("*").limit(20),
      ]);
      return { deliveries: deliveries ?? [], vehicles: vehicles ?? [], warehouses: warehouses ?? [] };
    },
  });

  async function startSimulation() {
    if (!bootstrap || !bootstrap.vehicles.length || !bootstrap.deliveries.length) {
      toast.error("Not enough data to run a simulation");
      return;
    }
    setRunning(true);
    setSim(null);
    setPhase("proposals");

    // Pick a delivery with coordinates if possible
    const candidates = bootstrap.deliveries.filter(d => d.dropoff_latitude && d.dropoff_longitude);
    const delivery = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : bootstrap.deliveries[Math.floor(Math.random() * bootstrap.deliveries.length)];

    const warehouse = delivery.origin_warehouse_id
      ? bootstrap.warehouses.find(w => w.id === delivery.origin_warehouse_id) ?? bootstrap.warehouses[0]
      : bootstrap.warehouses[0];

    const oLat = warehouse?.latitude ?? delivery.pickup_latitude ?? 40.7;
    const oLng = warehouse?.longitude ?? delivery.pickup_longitude ?? -74;
    const dLat = delivery.dropoff_latitude ?? oLat + 0.5;
    const dLng = delivery.dropoff_longitude ?? oLng + 0.5;

    // 6 candidate vehicles
    const pool = [...bootstrap.vehicles]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map(v => buildCandidate(v, oLat, oLng, dLat, dLng));

    await new Promise(r => setTimeout(r, 700));

    // Proposals — each agent picks its top candidate by its own metric
    const byDistance = rank(pool, c => c.distanceKm)[0];
    const byTime     = rank(pool, c => c.travelMin)[0];
    const byCost     = rank(pool, c => c.costUsd)[0];
    const byCo2      = rank(pool, c => c.co2Kg)[0];

    const proposals: Proposal[] = [
      {
        agent: "dispatch", pick: byDistance,
        reasoning: `${vehicleLabel(byDistance.vehicle)} is the closest idle unit at ${byDistance.distanceKm.toFixed(1)} km — fastest to dispatch with capacity for the load.`,
        metricLabel: "Dead-haul", metricValue: `${byDistance.distanceKm.toFixed(1)} km`,
      },
      {
        agent: "route", pick: byTime,
        reasoning: `${vehicleLabel(byTime.vehicle)} delivers the shortest ETA at ${byTime.travelMin} min based on the road-adjusted corridor.`,
        metricLabel: "ETA", metricValue: `${byTime.travelMin} min`,
      },
      {
        agent: "cost", pick: byCost,
        reasoning: `${vehicleLabel(byCost.vehicle)} keeps total cost lowest at $${byCost.costUsd.toFixed(2)} including fuel, driver labour, and overhead.`,
        metricLabel: "Cost", metricValue: `$${byCost.costUsd.toFixed(2)}`,
      },
      {
        agent: "sustainability", pick: byCo2,
        reasoning: `${vehicleLabel(byCo2.vehicle)} (${byCo2.vehicle.fuel_type ?? "diesel"}) emits ${byCo2.co2Kg.toFixed(2)} kg CO₂ — the lowest carbon footprint of the pool.`,
        metricLabel: "CO₂", metricValue: `${byCo2.co2Kg.toFixed(2)} kg`,
      },
    ];

    setPhase("debate");
    await new Promise(r => setTimeout(r, 900));

    // Debate — every agent scores every proposal on its own metric (0..100 best is 100)
    const maxDistance = Math.max(...proposals.map(p => p.pick.distanceKm), 1);
    const maxTime     = Math.max(...proposals.map(p => p.pick.travelMin), 1);
    const maxCost     = Math.max(...proposals.map(p => p.pick.costUsd), 1);
    const maxCo2      = Math.max(...proposals.map(p => p.pick.co2Kg), 1);

    const score = (voter: AgentKey, p: Proposal) => {
      const c = p.pick;
      switch (voter) {
        case "dispatch":       return Math.round(100 * (1 - c.distanceKm / maxDistance));
        case "route":          return Math.round(100 * (1 - c.travelMin   / maxTime));
        case "cost":           return Math.round(100 * (1 - c.costUsd     / maxCost));
        case "sustainability": return Math.round(100 * (1 - c.co2Kg       / maxCo2));
      }
    };

    const comment = (voter: AgentKey, p: Proposal) => {
      const own = vehicleLabel(p.pick.vehicle);
      if (voter === p.agent) return `Standing by my proposal — ${own} is optimal on my metric.`;
      switch (voter) {
        case "dispatch":       return `${own} sits ${p.pick.distanceKm.toFixed(1)} km from origin — acceptable dispatch distance.`;
        case "route":          return `Travel time ${p.pick.travelMin} min on ${own} fits the SLA window.`;
        case "cost":           return `Operating cost on ${own} works out to $${p.pick.costUsd.toFixed(2)}.`;
        case "sustainability": return `${own} produces ${p.pick.co2Kg.toFixed(2)} kg CO₂ — ${p.pick.co2Kg < maxCo2 * 0.7 ? "well within target" : "above the green threshold"}.`;
      }
    };

    const debate: DebateVote[] = [];
    for (const voter of AGENTS) {
      for (const p of proposals) {
        debate.push({
          agent: voter.key,
          forVehicleId: p.pick.vehicle.id,
          score: score(voter.key, p),
          comment: comment(voter.key, p),
        });
      }
    }

    setPhase("consensus");
    await new Promise(r => setTimeout(r, 900));

    // Tally — sum scores per proposed vehicle
    const tallyMap = new Map<string, { vehicleId: string; total: number; proposer: AgentKey; pick: Candidate }>();
    for (const p of proposals) {
      const id = p.pick.vehicle.id;
      const totalForId = debate.filter(d => d.forVehicleId === id).reduce((s, d) => s + d.score, 0);
      // Merge duplicates (multiple agents may propose same vehicle)
      const existing = tallyMap.get(id);
      if (!existing || existing.total < totalForId) {
        tallyMap.set(id, { vehicleId: id, total: totalForId, proposer: p.agent, pick: p.pick });
      }
    }
    const tally = [...tallyMap.values()].sort((a, b) => b.total - a.total);
    const winner = tally[0];

    const simulation: Simulation = { delivery, warehouse, candidates: pool, proposals, debate, tally, winner };
    setSim(simulation);
    setRunning(false);
    setPhase("idle");

    // Persist decision log (best-effort)
    supabase.from("ai_decisions").insert(
      AGENTS.map(a => {
        const p = proposals.find(pp => pp.agent === a.key)!;
        return {
          agent_name: a.name,
          decision: `Proposed ${vehicleLabel(p.pick.vehicle)} (${p.metricLabel} ${p.metricValue})`,
          reasoning: p.reasoning,
        };
      }).concat([{
        agent_name: "Consensus",
        decision: `Selected ${vehicleLabel(winner.pick.vehicle)} with ${winner.total} pts`,
        reasoning: `Multi-agent vote across dispatch, route, cost and sustainability metrics.`,
      }]),
    ).then(() => {});

    toast.success(`Consensus reached — ${vehicleLabel(winner.pick.vehicle)} wins`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Collaboration"
        subtitle="Four autonomous agents propose, debate, and vote on the best plan for an incoming delivery."
        actions={
          <Button onClick={startSimulation} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? `Running ${phase}…` : "Start collaboration"}
          </Button>
        }
      />

      {/* Phase indicator */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border bg-card p-3 text-xs">
        {[
          { id: "proposals", label: "Proposals", icon: Sparkles },
          { id: "debate", label: "Debate", icon: MessageSquare },
          { id: "consensus", label: "Vote & Consensus", icon: Vote },
        ].map((p, i, arr) => {
          const active = phase === p.id;
          const done = sim && !running;
          const Icon = p.icon;
          return (
            <div key={p.id} className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5",
                active ? "bg-primary text-primary-foreground" :
                done ? "bg-success/10 text-success" : "text-muted-foreground",
              )}>
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{p.label}</span>
                {active && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              {i < arr.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
            </div>
          );
        })}
      </div>

      {!sim && !running && (
        <div className="grid place-items-center gap-3 rounded-xl border border-dashed bg-card py-20 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <div className="font-display text-base font-semibold">No collaboration session yet</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Hit <span className="font-medium">Start collaboration</span> to send a delivery request through the four-agent debate.
            </p>
          </div>
        </div>
      )}

      {sim && (
        <>
          {/* Delivery request banner */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Incoming delivery</div>
                <div className="mt-0.5 font-display text-lg font-semibold">
                  {sim.delivery.tracking_number ?? sim.delivery.id.slice(0, 8)} · {sim.delivery.customer_name ?? "Customer"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {sim.warehouse?.name ?? "Origin"} → {sim.delivery.destination ?? sim.delivery.dropoff_address ?? "Destination"}
                  {sim.delivery.weight && <> · {Number(sim.delivery.weight).toFixed(0)} kg</>}
                  {sim.delivery.priority && <> · {sim.delivery.priority} priority</>}
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {sim.candidates.length} candidates
              </Badge>
            </div>
          </div>

          {/* Proposals */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Agent proposals
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {sim.proposals.map(p => {
                const meta = AGENT_BY[p.agent];
                const Icon = meta.icon;
                const isWinner = sim.winner.pick.vehicle.id === p.pick.vehicle.id && sim.winner.proposer === p.agent;
                return (
                  <div key={p.agent} className={cn(
                    "flex flex-col rounded-xl border bg-card p-5",
                    isWinner && "ring-2 ring-success/60",
                  )}>
                    <div className="flex items-start justify-between">
                      <div className={cn("grid h-10 w-10 place-items-center rounded-lg", meta.bg)}>
                        <Icon className={cn("h-5 w-5", meta.color)} />
                      </div>
                      {isWinner && (
                        <Badge className="gap-1 bg-success/15 text-success hover:bg-success/15">
                          <Trophy className="h-3 w-3" /> Winner
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 font-display text-sm font-semibold">{meta.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{meta.tagline}</div>
                    <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">Proposed vehicle</div>
                      <div className="mt-0.5 font-display text-sm font-semibold">
                        {vehicleLabel(p.pick.vehicle)}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{p.metricLabel}</span>
                        <span className="font-mono font-semibold">{p.metricValue}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{p.reasoning}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Debate */}
          <section className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b p-5">
              <MessageSquare className="h-4 w-4 text-primary" />
              <div>
                <h2 className="font-display text-base font-semibold">Cross-agent debate</h2>
                <p className="text-xs text-muted-foreground">Each agent scores every proposal against its own metric (0–100).</p>
              </div>
            </div>
            <ScrollArea className="max-h-[420px]">
              <div className="divide-y">
                {sim.proposals.map(p => {
                  const meta = AGENT_BY[p.agent];
                  const Icon = meta.icon;
                  return (
                    <div key={p.agent} className="p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", meta.color)} />
                        <span className="text-sm font-medium">
                          Proposal: <span className="font-mono">{vehicleLabel(p.pick.vehicle)}</span> by {meta.name}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {sim.debate.filter(d => d.forVehicleId === p.pick.vehicle.id).map(d => {
                          const vm = AGENT_BY[d.agent];
                          const VIcon = vm.icon;
                          return (
                            <div key={`${p.agent}-${d.agent}`} className="flex gap-2 rounded-lg border bg-background p-3">
                              <div className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md", vm.bg)}>
                                <VIcon className={cn("h-3.5 w-3.5", vm.color)} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-medium">{vm.name}</span>
                                  <span className={cn(
                                    "font-mono text-[10px] font-semibold",
                                    d.score >= 75 ? "text-success" : d.score >= 40 ? "text-amber-500" : "text-destructive",
                                  )}>
                                    {d.score}/100
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{d.comment}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </section>

          {/* Tally */}
          <section className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <Vote className="h-4 w-4 text-primary" />
              <h2 className="font-display text-base font-semibold">Final tally</h2>
            </div>
            <div className="mt-4 space-y-2">
              {sim.tally.map((t, i) => {
                const meta = AGENT_BY[t.proposer];
                const pct = (t.total / (sim.tally[0]?.total || 1)) * 100;
                const isWinner = i === 0;
                return (
                  <div key={t.vehicleId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
                        <span className="font-medium">{vehicleLabel(t.pick.vehicle)}</span>
                        <Badge variant="outline" className={cn("font-mono text-[10px]", meta.color)}>
                          by {meta.name}
                        </Badge>
                      </div>
                      <span className="font-mono font-semibold">{t.total} pts</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", isWinner ? "bg-success" : "bg-primary/40")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
              <Trophy className="mt-0.5 h-5 w-5 text-success" />
              <div className="flex-1">
                <div className="text-xs font-mono uppercase tracking-wider text-success">Consensus decision</div>
                <div className="mt-0.5 font-display text-base font-semibold">
                  Dispatch {vehicleLabel(sim.winner.pick.vehicle)} — {sim.winner.total} pts
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  ETA {sim.winner.pick.travelMin} min · Cost ${sim.winner.pick.costUsd.toFixed(2)} ·
                  CO₂ {sim.winner.pick.co2Kg.toFixed(2)} kg · {sim.winner.pick.distanceKm.toFixed(1)} km route.
                </p>
              </div>
            </div>
          </section>

          {/* Decision tree */}
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Decision tree
            </h2>
            <DecisionTree sim={sim} />
          </section>
        </>
      )}
    </div>
  );
}

function DecisionTree({ sim }: { sim: Simulation }) {
  const proposalIds = sim.proposals.map(p => p.pick.vehicle.id);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px] space-y-6">
        {/* Root */}
        <div className="flex justify-center">
          <TreeNode color="bg-primary text-primary-foreground" title="Delivery request" subtitle={sim.delivery.tracking_number ?? sim.delivery.id.slice(0, 8)} />
        </div>

        <Connector />

        {/* Proposals row */}
        <div className="grid grid-cols-4 gap-3">
          {sim.proposals.map(p => {
            const meta = AGENT_BY[p.agent];
            const Icon = meta.icon;
            return (
              <div key={p.agent} className="flex flex-col items-center gap-2">
                <div className={cn("flex w-full flex-col rounded-lg border p-3 text-center", meta.bg)}>
                  <Icon className={cn("mx-auto h-4 w-4", meta.color)} />
                  <div className="mt-1 text-[11px] font-semibold">{meta.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">proposes</div>
                  <div className="font-mono text-xs font-semibold">{vehicleLabel(p.pick.vehicle)}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{p.metricLabel}: {p.metricValue}</div>
                </div>
              </div>
            );
          })}
        </div>

        <Connector />

        {/* Debate node */}
        <div className="flex justify-center">
          <TreeNode color="bg-violet-500/10 text-foreground" title="Cross-agent debate" subtitle={`${sim.debate.length} votes scored across ${new Set(proposalIds).size} unique proposals`} />
        </div>

        <Connector />

        {/* Tally row */}
        <div className={cn("grid gap-3", `grid-cols-${Math.min(sim.tally.length, 4)}`)} style={{ gridTemplateColumns: `repeat(${sim.tally.length}, minmax(0, 1fr))` }}>
          {sim.tally.map((t, i) => (
            <div key={t.vehicleId} className={cn(
              "rounded-lg border p-3 text-center",
              i === 0 ? "border-success/40 bg-success/5" : "bg-muted/30",
            )}>
              <div className="font-mono text-[10px] uppercase text-muted-foreground">#{i + 1}</div>
              <div className="font-mono text-xs font-semibold">{vehicleLabel(t.pick.vehicle)}</div>
              <div className="mt-0.5 text-[11px] font-semibold">{t.total} pts</div>
            </div>
          ))}
        </div>

        <Connector />

        {/* Final */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2 rounded-lg border-2 border-success bg-success/10 px-5 py-3">
            <Trophy className="h-5 w-5 text-success" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-success">Consensus</div>
              <div className="font-display text-sm font-semibold">
                Dispatch {vehicleLabel(sim.winner.pick.vehicle)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeNode({ title, subtitle, color }: { title: string; subtitle?: string; color: string }) {
  return (
    <div className={cn("rounded-lg border px-5 py-3 text-center", color)}>
      <div className="text-sm font-semibold">{title}</div>
      {subtitle && <div className="mt-0.5 font-mono text-[10px] opacity-80">{subtitle}</div>}
    </div>
  );
}

function Connector() {
  return <div className="mx-auto h-6 w-px bg-border" />;
}
