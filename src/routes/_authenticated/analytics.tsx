import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Activity, DollarSign, Leaf, Truck } from "lucide-react";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — SkyRoute AI" }] }),
  component: AnalyticsPage,
});

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [d, v] = await Promise.all([
        supabase.from("deliveries").select("status,priority,cost_usd,co2_kg,created_at"),
        supabase.from("vehicles").select("type,status"),
      ]);
      return { deliveries: d.data ?? [], vehicles: v.data ?? [] };
    },
  });

  const deliveries = data?.deliveries ?? [];
  const totalCost = deliveries.reduce((s, x) => s + Number(x.cost_usd ?? 0), 0);
  const totalCo2 = deliveries.reduce((s, x) => s + Number(x.co2_kg ?? 0), 0);
  const delivered = deliveries.filter(x => x.status === "delivered").length;
  const onTime = deliveries.length ? Math.round((delivered / deliveries.length) * 100) : 0;

  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = subDays(new Date(), 13 - i);
    const key = format(d, "yyyy-MM-dd");
    const dayDeliveries = deliveries.filter(x => format(new Date(x.created_at), "yyyy-MM-dd") === key);
    return {
      day: format(d, "MM-dd"),
      deliveries: dayDeliveries.length,
      cost: +dayDeliveries.reduce((s, x) => s + Number(x.cost_usd ?? 0), 0).toFixed(2),
      co2: +dayDeliveries.reduce((s, x) => s + Number(x.co2_kg ?? 0), 0).toFixed(2),
    };
  });

  const priorityData = ["standard", "express", "overnight"].map(p => ({
    name: p, value: deliveries.filter(x => x.priority === p).length,
  }));

  const vehicleTypes = Object.entries(
    (data?.vehicles ?? []).reduce((acc, v) => {
      acc[v.type] = (acc[v.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Operational performance across the network." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="On-time rate" value={`${onTime}%`} icon={Activity} accent delta={{ value: "0.6%", positive: true }} />
        <StatCard label="Total cost" value={`$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} delta={{ value: "2.1%", positive: false }} />
        <StatCard label="CO₂ saved (est.)" value={`${(totalCo2 * 0.18).toFixed(1)} kg`} icon={Leaf} delta={{ value: "9.2%", positive: true }} />
        <StatCard label="Fleet size" value={data?.vehicles.length ?? 0} icon={Truck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily delivery volume" subtitle="Last 14 days">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={days}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="deliveries" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cost vs CO₂" subtitle="Trends over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={days}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="cost" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="co2" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Delivery priority mix" subtitle="By volume">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
                {priorityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Fleet composition" subtitle="By vehicle type">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={vehicleTypes} layout="vertical">
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} width={80} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

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
