import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/deliveries")({
  head: () => ({ meta: [{ title: "Deliveries — SkyRoute AI" }] }),
  component: DeliveriesPage,
});

const PRIORITY_TONE: Record<string, string> = {
  overnight: "text-destructive",
  express: "text-warning",
  standard: "text-muted-foreground",
};

function DeliveriesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id,tracking_no,customer_name,dest_city,dest_address,status,priority,weight_kg,scheduled_for,eta,cost_usd,co2_kg,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter(d => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return d.tracking_no.toLowerCase().includes(q) || d.customer_name.toLowerCase().includes(q) || (d.dest_city ?? "").toLowerCase().includes(q);
    });
  }, [data, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries"
        subtitle={`${filtered.length} of ${data?.length ?? 0} shown`}
        actions={<Button>+ New delivery</Button>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tracking, customer, city…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_transit">In transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tracking</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">CO₂</TableHead>
              <TableHead>ETA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">No deliveries match.</TableCell></TableRow>
            )}
            {filtered.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.tracking_no}</TableCell>
                <TableCell className="font-medium">{d.customer_name}</TableCell>
                <TableCell><div className="text-sm">{d.dest_city}</div><div className="text-xs text-muted-foreground">{d.dest_address}</div></TableCell>
                <TableCell className={`text-xs font-semibold uppercase tracking-wide ${PRIORITY_TONE[d.priority] ?? ""}`}>{d.priority}</TableCell>
                <TableCell><StatusBadge status={d.status} /></TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{Number(d.weight_kg).toFixed(1)} kg</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">${Number(d.cost_usd ?? 0).toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{Number(d.co2_kg ?? 0).toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{d.eta ? format(new Date(d.eta), "MMM d, HH:mm") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
