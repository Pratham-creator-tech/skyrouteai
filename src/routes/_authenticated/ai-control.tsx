import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BrainCircuit, Truck, Route as RouteIcon, DollarSign, Leaf,
  Play, Sparkles, Activity, Loader2, ChevronRight, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  AGENT_META, runAgent, runAllAgents,
  type AgentKey, type AgentResult,
} from "@/lib/ai-agents";

export const Route = createFileRoute("/_authenticated/ai-control")({
  head: () => ({ meta: [{ title: "AI Control Center — SkyRoute AI" }] }),
  component: AIControl,
});

const AGENT_ICON: Record<AgentKey, typeof Truck> = {
  dispatch: Truck,
  route: RouteIcon,
  cost: DollarSign,
  sustainability: Leaf,
};

const AGENT_ORDER: AgentKey[] = ["dispatch", "route", "cost", "sustainability"];

function AIControl() {
  const qc = useQueryClient();
  const [results, setResults] = useState<Partial<Record<AgentKey, AgentResult>>>({});
  const [busy, setBusy] = useState<AgentKey | "all" | null>(null);

  const { data: decisions, isLoading } = useQuery({
    queryKey: ["ai-decisions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_decisions")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  // Realtime stream of new decisions
  useEffect(() => {
    const ch = supabase
      .channel("ai-decisions-stream")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_decisions" },
        () => qc.invalidateQueries({ queryKey: ["ai-decisions"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function handleRun(agent: AgentKey) {
    setBusy(agent);
    try {
      const res = await runAgent(agent);
      setResults(p => ({ ...p, [agent]: res }));
      toast.success(`${AGENT_META[agent].name} generated ${res.recommendations.length} recommendation${res.recommendations.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Agent failed");
    } finally { setBusy(null); }
  }

  async function handleRunAll() {
    setBusy("all");
    try {
      const all = await runAllAgents();
      const map: Partial<Record<AgentKey, AgentResult>> = {};
      all.forEach(r => { map[r.agent] = r; });
      setResults(map);
      toast.success("All agents executed");
    } catch (e: any) {
      toast.error(e.message ?? "Agents failed");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Control Center"
        subtitle="Four autonomous agents that watch your operation and recommend the next move."
        actions={
          <Button onClick={handleRunAll} disabled={busy !== null} className="gap-2">
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Run all agents
          </Button>
        }
      />

      {/* Agents grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {AGENT_ORDER.map(key => {
          const meta = AGENT_META[key];
          const Icon = AGENT_ICON[key];
          const res = results[key];
          const running = busy === key || busy === "all";
          return (
            <div key={key} className="flex flex-col rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div className={cn("grid h-11 w-11 place-items-center rounded-lg", meta.bg)}>
                  <Icon className={cn("h-5 w-5", meta.accent)} />
                </div>
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {res ? `${res.recommendations.length} recs` : "idle"}
                </Badge>
              </div>
              <h3 className="mt-3 font-display text-base font-semibold">{meta.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.tagline}</p>
              <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">{meta.description}</p>

              <Button
                size="sm"
                variant={res ? "outline" : "default"}
                className="mt-4 gap-2"
                onClick={() => handleRun(key)}
                disabled={busy !== null}
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {res ? "Re-run agent" : "Run agent"}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Recommendations + Timeline */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-5">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-display text-base font-semibold">Latest recommendations</h3>
              <p className="text-xs text-muted-foreground">
                Reasoning generated from live deliveries, vehicles and routes.
              </p>
            </div>
          </div>
          <div className="divide-y">
            {AGENT_ORDER.flatMap(key => {
              const r = results[key];
              if (!r) return [];
              const meta = AGENT_META[key];
              const Icon = AGENT_ICON[key];
              return r.recommendations.map((rec, i) => (
                <div key={`${key}-${i}`} className="flex gap-3 p-4">
                  <div className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md", meta.bg)}>
                    <Icon className={cn("h-4 w-4", meta.accent)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {meta.name}
                      </span>
                      {rec.impact && (
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {rec.impact}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm font-medium">{rec.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{rec.reasoning}</p>
                  </div>
                </div>
              ));
            })}
            {Object.keys(results).length === 0 && (
              <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <BrainCircuit className="h-8 w-8 opacity-40" />
                Run an agent to generate recommendations.
              </div>
            )}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-5">
            <Activity className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <h3 className="font-display text-base font-semibold">Agent activity</h3>
              <p className="text-xs text-muted-foreground">Real-time decisions across all agents</p>
            </div>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
          </div>
          <ScrollArea className="h-[520px]">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (decisions?.length ?? 0) === 0 ? (
              <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <ChevronRight className="h-6 w-6 opacity-40" />
                No agent decisions logged yet.
              </div>
            ) : (
              <ol className="relative ml-4 border-l py-2">
                {decisions!.map(d => (
                  <li key={d.id} className="relative pl-5 py-3 pr-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {d.agent_name}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(d.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm font-medium">{d.decision}</div>
                    {d.reasoning && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {d.reasoning}
                      </p>
                    )}
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground/60">
                      {format(new Date(d.timestamp), "MMM d, HH:mm:ss")}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
