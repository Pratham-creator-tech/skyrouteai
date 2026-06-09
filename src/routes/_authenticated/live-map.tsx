import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { LogisticsMap } from "@/components/LogisticsMap";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/live-map")({
  head: () => ({ meta: [{ title: "Live Map — SkyRoute AI" }] }),
  component: LiveMapPage,
});

function LiveMapPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Operations Map"
        subtitle="Real-time fleet positions, warehouses, deliveries and route health on OpenStreetMap."
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => location.reload()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <LogisticsMap height={720} />
    </div>
  );
}
