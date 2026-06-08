import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, delta, icon: Icon, accent,
}: {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean };
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "relative rounded-xl border bg-card p-5 transition-colors",
      "hover:border-primary/40",
      accent && "border-primary/30 bg-gradient-to-br from-primary/[0.04] to-transparent",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        {Icon && (
          <div className="rounded-md bg-primary/10 p-1.5 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 font-mono text-3xl font-semibold tabular-nums text-foreground">{value}</div>
      {delta && (
        <div className={cn(
          "mt-2 inline-flex items-center gap-1 text-xs font-medium",
          delta.positive ? "text-success" : "text-destructive",
        )}>
          {delta.positive ? "▲" : "▼"} {delta.value}
          <span className="text-muted-foreground"> vs last week</span>
        </div>
      )}
    </div>
  );
}
