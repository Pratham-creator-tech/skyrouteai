import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Workflow, Truck, Route as RouteIcon, DollarSign, Leaf,
  Play, Loader2, CheckCircle2, Clock, XCircle, ChevronRight,
  Activity, Zap, Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { startWorkflow, AGENT_PIPELINE, type AgentKey, type StepStatus } from "@/lib/workflow-engine";

export const Route = createFileRoute("/_authenticated/workflows")({
  head: () => ({ meta: [{ title: "Autonomous Workflows — SkyRoute AI" }] }),
  component: WorkflowsPage,
});

const AGENT_ICON: Record<AgentKey, typeof Truck> = {
  dispatch: Truck,
  route: RouteIcon,
  cost: DollarSign,
  sustainability: Leaf,
};

const STATUS_META: Record<StepStatus, { label: string; color: string; bg: string; ring: string }> = {
  pending:    { label: "Pending",    color: "text-muted-foreground", bg: "bg-muted",          ring: "ring-border" },
  processing: { label: "Processing", color: "text-primary",          bg: "bg-primary/15",     ring: "ring-primary/40" },
  completed:  { label: "Completed",  color: "text-success",          bg: "bg-success/15",     ring: "ring-success/40" },
  failed:     { label: "Failed",     color: "text-destructive",      bg: "bg-destructive/15", ring: "ring-destructive/40" },
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "processing") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function WorkflowsPage() {
  const qc = useQueryClient();
  const [selectedExec, setSelectedExec] = useState<string | null>(null);
  const [pickDelivery, setPickDelivery] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Eligible deliveries (pending, no vehicle yet)
  const { data: deliveries } = useQuery({
    queryKey: ["wf-deliveries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, tracking_no, customer_name, dest_city, status, priority")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  // Recent executions
  const { data: executions, isLoading: execLoading } = useQuery({
    queryKey: ["wf-executions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workflow_executions")
        .select("*, deliveries(tracking_no, customer_name, dest_city)")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  // Steps for selected execution
  const { data: steps } = useQuery({
    queryKey: ["wf-steps", selectedExec],
    enabled: !!selectedExec,
    queryFn: async () => {
      const { data } = await supabase
        .from("workflow_steps").select("*")
        .eq("execution_id", selectedExec!)
        .order("step_order");
      return data ?? [];
    },
    refetchInterval: 1500,
  });

  // Pick the most recent execution by default
  useEffect(() => {
    if (!selectedExec && executions?.length) setSelectedExec(executions[0].id);
  }, [executions, selectedExec]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("wf-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_executions" },
        () => qc.invalidateQueries({ queryKey: ["wf-executions"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_steps" },
        () => qc.invalidateQueries({ queryKey: ["wf-steps", selectedExec] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, selectedExec]);

  async function handleStart() {
    if (!pickDelivery) { toast.error("Pick a delivery first"); return; }
    setBusy(true);
    try {
      const id = await startWorkflow(pickDelivery);
      setSelectedExec(id);
      toast.success("Workflow started");
      qc.invalidateQueries({ queryKey: ["wf-executions"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start workflow");
    } finally { setBusy(false); }
  }

  const selectedExecution = useMemo(
    () => executions?.find(e => e.id === selectedExec),
    [executions, selectedExec],
  );

  // Build a complete step list (fill in pending defaults for steps not yet inserted)
  const pipelineSteps = useMemo(() => {
    const byKey = new Map((steps ?? []).map(s => [s.agent_key, s]));
    return AGENT_PIPELINE.map(a => byKey.get(a.key) ?? {
      agent_key: a.key, agent_name: a.name, step_order: a.order, status: "pending" as StepStatus,
    });
  }, [steps]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Autonomous Workflows"
        subtitle="When a delivery is created, four agents collaborate end-to-end: dispatch → route → cost → carbon."
      />

      {/* Trigger card */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold">Run workflow on a delivery</h3>
            <p className="text-xs text-muted-foreground">
              Triggers the full agent pipeline. Each step is persisted to the execution log in real time.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <Select value={pickDelivery} onValueChange={setPickDelivery}>
            <SelectTrigger className="md:w-[420px]">
              <SelectValue placeholder="Select a delivery..." />
            </SelectTrigger>
            <SelectContent>
              {(deliveries ?? []).map(d => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="font-mono text-xs">{d.tracking_no}</span>
                  <span className="ml-2 text-muted-foreground">
                    · {d.customer_name} → {d.dest_city ?? "—"} · {d.priority}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleStart} disabled={busy || !pickDelivery} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start workflow
          </Button>
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-display text-base font-semibold">Execution pipeline</h3>
              <p className="text-xs text-muted-foreground">
                {selectedExecution
                  ? <>Delivery <span className="font-mono">{selectedExecution.deliveries?.tracking_no ?? selectedExecution.delivery_id.slice(0, 8)}</span> · started {formatDistanceToNow(new Date(selectedExecution.started_at), { addSuffix: true })}</>
                  : "Select or start a workflow to view its pipeline"}
              </p>
            </div>
          </div>
          {selectedExecution && (
            <Badge variant="outline" className={cn(
              "font-mono text-[10px] uppercase",
              STATUS_META[selectedExecution.status as StepStatus]?.color,
            )}>
              {selectedExecution.status}
            </Badge>
          )}
        </div>

        {/* Pipeline lanes */}
        <div className="p-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(4,1fr_auto)_1fr] lg:items-center">
            {pipelineSteps.map((step, i) => {
              const Icon = AGENT_ICON[step.agent_key as AgentKey];
              const meta = STATUS_META[step.status as StepStatus];
              return (
                <>
                  <div
                    key={step.agent_key}
                    className={cn(
                      "relative flex flex-col rounded-lg border bg-background p-4 ring-1 transition-all",
                      meta.ring,
                      step.status === "processing" && "shadow-lg shadow-primary/10",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn("grid h-9 w-9 place-items-center rounded-md", meta.bg)}>
                        <Icon className={cn("h-4 w-4", meta.color)} />
                      </div>
                      <StatusIcon status={step.status as StepStatus} />
                    </div>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Step {step.step_order}
                    </div>
                    <div className="text-sm font-semibold">{step.agent_name}</div>
                    {step.decision && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{step.decision}</div>
                    )}
                    {step.duration_ms != null && (
                      <div className="mt-2 font-mono text-[10px] text-muted-foreground/70">
                        {step.duration_ms} ms
                      </div>
                    )}
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <ChevronRight
                      key={`sep-${i}`}
                      className={cn(
                        "mx-auto hidden h-5 w-5 lg:block",
                        pipelineSteps[i].status === "completed" ? "text-success" : "text-muted-foreground/40",
                      )}
                    />
                  )}
                </>
              );
            })}
          </div>
        </div>
      </div>

      {/* Executions + logs */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Executions list */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-5">
            <Package className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <h3 className="font-display text-base font-semibold">Recent executions</h3>
              <p className="text-xs text-muted-foreground">Click to inspect</p>
            </div>
          </div>
          <ScrollArea className="h-[460px]">
            {execLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !executions?.length ? (
              <div className="grid place-items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <Workflow className="h-7 w-7 opacity-40" />
                No executions yet. Start one above.
              </div>
            ) : (
              <ul className="divide-y">
                {executions.map(e => {
                  const meta = STATUS_META[e.status as StepStatus] ?? STATUS_META.pending;
                  const active = e.id === selectedExec;
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => setSelectedExec(e.id)}
                        className={cn(
                          "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/40",
                          active && "bg-muted/60",
                        )}
                      >
                        <StatusIcon status={e.status as StepStatus} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">
                              {e.deliveries?.tracking_no ?? e.delivery_id.slice(0, 8)}
                            </span>
                            <Badge variant="outline" className={cn("font-mono text-[10px]", meta.color)}>
                              {e.status}
                            </Badge>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {e.deliveries?.customer_name ?? "—"} · {e.deliveries?.dest_city ?? ""}
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                            {formatDistanceToNow(new Date(e.started_at), { addSuffix: true })}
                            {e.current_step && e.status === "processing" && <> · @ {e.current_step}</>}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Execution log */}
        <div className="lg:col-span-2 rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-5">
            <Activity className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <h3 className="font-display text-base font-semibold">Execution log</h3>
              <p className="text-xs text-muted-foreground">
                Step-by-step reasoning, output and timing
              </p>
            </div>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
          </div>
          <ScrollArea className="h-[460px]">
            {!selectedExec ? (
              <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <Activity className="h-7 w-7 opacity-40" />
                Select an execution to view its log.
              </div>
            ) : (
              <ol className="relative ml-4 border-l py-2">
                {pipelineSteps.map(s => {
                  const Icon = AGENT_ICON[s.agent_key as AgentKey];
                  const meta = STATUS_META[s.status as StepStatus];
                  return (
                    <li key={s.agent_key} className="relative py-3 pl-5 pr-4">
                      <span className={cn(
                        "absolute -left-[7px] top-4 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-background",
                        meta.bg,
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full",
                          s.status === "completed" && "bg-success",
                          s.status === "processing" && "bg-primary animate-pulse",
                          s.status === "failed" && "bg-destructive",
                          s.status === "pending" && "bg-muted-foreground/50",
                        )} />
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {s.agent_name}
                          </span>
                          <Badge variant="outline" className={cn("font-mono text-[10px]", meta.color)}>
                            {meta.label}
                          </Badge>
                        </div>
                        {s.completed_at && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {format(new Date(s.completed_at), "HH:mm:ss")}
                            {s.duration_ms != null && <> · {s.duration_ms}ms</>}
                          </span>
                        )}
                      </div>
                      {s.decision && (
                        <div className="mt-1 text-sm font-medium">{s.decision}</div>
                      )}
                      {s.reasoning && (
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>
                      )}
                      {s.output && (
                        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
                          {JSON.stringify(s.output, null, 2)}
                        </pre>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
