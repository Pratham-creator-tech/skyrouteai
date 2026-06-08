import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, Pause, Play, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai-control")({
  head: () => ({ meta: [{ title: "AI Control Center — SkyRoute AI" }] }),
  component: AIControl,
});

function AIControl() {
  const qc = useQueryClient();
  const { data: agents } = useQuery({
    queryKey: ["ai-agents"],
    queryFn: async () => (await supabase.from("ai_agents").select("*").order("name")).data ?? [],
  });
  const { data: events } = useQuery({
    queryKey: ["ai-events"],
    queryFn: async () => (await supabase.from("ai_events").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  const toggle = useMutation({
    mutationFn: async (agent: { id: string; status: string }) => {
      const newStatus = agent.status === "active" ? "paused" : "active";
      const { error } = await supabase.from("ai_agents").update({ status: newStatus, last_run_at: new Date().toISOString() }).eq("id", agent.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agent updated"); qc.invalidateQueries({ queryKey: ["ai-agents"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="AI Control Center" subtitle="Monitor and govern autonomous agents running your operation." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(agents ?? []).map(a => (
          <div key={a.id} className="rounded-xl border bg-card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-base font-semibold">{a.name}</div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{a.type}</div>
                </div>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{a.description}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Runs today</div>
                <div className="font-mono text-sm font-semibold">{a.runs_today}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Success</div>
                <div className="font-mono text-sm font-semibold text-success">{a.success_rate}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Last run</div>
                <div className="font-mono text-[11px]">{a.last_run_at ? format(new Date(a.last_run_at), "HH:mm:ss") : "—"}</div>
              </div>
            </div>

            <Button
              variant={a.status === "active" ? "outline" : "default"}
              className="mt-4 w-full gap-2"
              onClick={() => toggle.mutate(a)}
              disabled={toggle.isPending}
            >
              {a.status === "active" ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Resume</>}
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-5">
          <Activity className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-display text-base font-semibold">Live event stream</h3>
            <p className="text-xs text-muted-foreground">Last {events?.length ?? 0} agent actions</p>
          </div>
        </div>
        <ul className="divide-y">
          {(events ?? []).map(e => (
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
              <div className="font-mono text-[11px] text-muted-foreground">{format(new Date(e.created_at), "MMM d, HH:mm")}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
