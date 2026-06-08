import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-primary/15 text-primary border-primary/30",
  muted: "bg-muted text-muted-foreground border-border",
};

const STATUS_TONE: Record<string, keyof typeof tones> = {
  delivered: "success", active: "success", operational: "success", on_route: "success",
  in_transit: "info", assigned: "info", planned: "info", available: "info", idle: "info",
  pending: "muted", off_duty: "muted", completed: "muted", charging: "info",
  failed: "danger", error: "danger", cancelled: "danger",
  maintenance: "warning", paused: "warning",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "muted";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
      tones[tone],
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full",
        tone === "success" && "bg-success",
        tone === "warning" && "bg-warning",
        tone === "danger" && "bg-destructive",
        tone === "info" && "bg-primary",
        tone === "muted" && "bg-muted-foreground/60",
      )} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
