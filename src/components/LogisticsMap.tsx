import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, LayersControl, LayerGroup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Warehouse as WhIcon, Package } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

type Vehicle = {
  id: string; plate: string; model: string; type: string; status: string;
  current_lat: number | null; current_lng: number | null;
  fuel_pct: number | null; battery_pct: number | null;
};
type Warehouse = {
  id: string; name: string; code: string; city: string;
  lat: number | null; lng: number | null;
  capacity_units: number; used_units: number; status: string;
};
type Delivery = {
  id: string; tracking_no: string; customer_name: string; status: string;
  priority: string; dest_lat: number | null; dest_lng: number | null;
  origin_warehouse_id: string | null; vehicle_id: string | null;
  cost_usd: number | null; co2_kg: number | null; weight_kg: number;
};
type Route = {
  id: string; vehicle_id: string | null; origin_warehouse_id: string | null;
  total_distance_km: number; total_duration_min: number;
  estimated_cost_usd: number; estimated_co2_kg: number;
  optimization_score: number; status: string;
};

function divIcon(html: string, className = "") {
  return L.divIcon({
    html,
    className: `skyroute-marker ${className}`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

const warehouseIcon = divIcon(
  renderToStaticMarkup(
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: "hsl(var(--primary) / 0.95)", color: "white",
      display: "grid", placeItems: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      border: "2px solid white",
    }}>
      <WhIcon size={16} strokeWidth={2.5} />
    </div>
  )
);

const deliveryIcon = divIcon(
  renderToStaticMarkup(
    <div style={{
      width: 26, height: 26, borderRadius: "50%",
      background: "hsl(45 95% 55%)", color: "#222",
      display: "grid", placeItems: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      border: "2px solid white",
    }}>
      <Package size={13} strokeWidth={2.5} />
    </div>
  )
);

function vehicleIcon(status: string) {
  const colors: Record<string, string> = {
    in_transit: "#10b981",
    idle: "#64748b",
    maintenance: "#ef4444",
  };
  const bg = colors[status] ?? "#3b82f6";
  return divIcon(
    renderToStaticMarkup(
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        background: bg, color: "white",
        display: "grid", placeItems: "center",
        boxShadow: `0 0 0 4px ${bg}33, 0 2px 8px rgba(0,0,0,0.4)`,
        border: "2px solid white",
        transition: "all 0.6s ease",
      }}>
        <Truck size={14} strokeWidth={2.5} />
      </div>
    ),
    "vehicle-marker"
  );
}

function routeColor(route: Route): { color: string; label: "Optimal" | "Moderate" | "Delayed" } {
  if (route.status === "delayed" || route.optimization_score < 70) {
    return { color: "#ef4444", label: "Delayed" };
  }
  if (route.optimization_score < 85) {
    return { color: "#f59e0b", label: "Moderate" };
  }
  return { color: "#10b981", label: "Optimal" };
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }, [map, points.length]);
  return null;
}

export function LogisticsMap({ height = 600 }: { height?: number }) {
  const [tick, setTick] = useState(0);

  const { data } = useQuery({
    queryKey: ["map-data", tick],
    refetchInterval: 5000,
    queryFn: async () => {
      const [v, w, d, r] = await Promise.all([
        supabase.from("vehicles").select("id,plate,model,type,status,current_lat,current_lng,fuel_pct,battery_pct"),
        supabase.from("warehouses").select("id,name,code,city,lat,lng,capacity_units,used_units,status"),
        supabase.from("deliveries").select("id,tracking_no,customer_name,status,priority,dest_lat,dest_lng,origin_warehouse_id,vehicle_id,cost_usd,co2_kg,weight_kg"),
        supabase.from("routes").select("id,vehicle_id,origin_warehouse_id,total_distance_km,total_duration_min,estimated_cost_usd,estimated_co2_kg,optimization_score,status"),
      ]);
      return {
        vehicles: (v.data ?? []) as Vehicle[],
        warehouses: (w.data ?? []) as Warehouse[],
        deliveries: (d.data ?? []) as Delivery[],
        routes: (r.data ?? []) as Route[],
      };
    },
  });

  // Live subscription — fires the query to refetch if realtime is enabled.
  useEffect(() => {
    const channel = supabase
      .channel("map-vehicles")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => setTick(t => t + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const warehouses = data?.warehouses.filter(w => w.lat != null && w.lng != null) ?? [];
  const deliveries = data?.deliveries.filter(d => d.dest_lat != null && d.dest_lng != null) ?? [];
  const vehicles = data?.vehicles.filter(v => v.current_lat != null && v.current_lng != null) ?? [];
  const routes = data?.routes ?? [];

  const whById = useMemo(() => new Map(warehouses.map(w => [w.id, w])), [warehouses]);
  const delByVehicle = useMemo(() => {
    const m = new Map<string, Delivery>();
    deliveries.forEach(d => { if (d.vehicle_id) m.set(d.vehicle_id, d); });
    return m;
  }, [deliveries]);

  // Build polylines from routes: origin warehouse -> delivery dest (via assigned vehicle).
  const routeLines = useMemo(() => {
    return routes.flatMap(r => {
      const origin = r.origin_warehouse_id ? whById.get(r.origin_warehouse_id) : null;
      const del = r.vehicle_id ? delByVehicle.get(r.vehicle_id) : null;
      if (!origin || !del || origin.lat == null || origin.lng == null || del.dest_lat == null || del.dest_lng == null) return [];
      const c = routeColor(r);
      return [{
        route: r, delivery: del, origin,
        positions: [[Number(origin.lat), Number(origin.lng)], [Number(del.dest_lat), Number(del.dest_lng)]] as [number, number][],
        color: c.color, label: c.label,
      }];
    });
  }, [routes, whById, delByVehicle]);

  const allPoints: [number, number][] = useMemo(() => [
    ...warehouses.map(w => [Number(w.lat), Number(w.lng)] as [number, number]),
    ...deliveries.map(d => [Number(d.dest_lat), Number(d.dest_lng)] as [number, number]),
    ...vehicles.map(v => [Number(v.current_lat), Number(v.current_lng)] as [number, number]),
  ], [warehouses, deliveries, vehicles]);

  const center: [number, number] = allPoints[0] ?? [39.5, -98.35];

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card" style={{ height }}>
      <MapContainer
        center={center}
        zoom={5}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />

        <LayersControl position="topright">
          <LayersControl.Overlay checked name="Routes">
            <LayerGroup>
              {routeLines.map((rl, i) => (
                <Polyline
                  key={rl.route.id + i}
                  positions={rl.positions}
                  pathOptions={{ color: rl.color, weight: 4, opacity: 0.85, dashArray: rl.label === "Delayed" ? "8 6" : undefined }}
                >
                  <Popup>
                    <div style={{ minWidth: 220, fontFamily: "system-ui" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{
                          background: rl.color, color: "white",
                          padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        }}>{rl.label}</span>
                        <strong style={{ fontSize: 13 }}>Route #{rl.route.id.slice(0, 6)}</strong>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                        <div><div style={{ color: "#64748b" }}>Distance</div><strong>{Number(rl.route.total_distance_km).toFixed(1)} km</strong></div>
                        <div><div style={{ color: "#64748b" }}>Duration</div><strong>{rl.route.total_duration_min} min</strong></div>
                        <div><div style={{ color: "#64748b" }}>Cost</div><strong>${Number(rl.route.estimated_cost_usd).toFixed(0)}</strong></div>
                        <div><div style={{ color: "#64748b" }}>CO₂</div><strong>{Number(rl.route.estimated_co2_kg).toFixed(1)} kg</strong></div>
                        <div><div style={{ color: "#64748b" }}>Score</div><strong>{rl.route.optimization_score}/100</strong></div>
                        <div><div style={{ color: "#64748b" }}>Status</div><strong style={{ textTransform: "capitalize" }}>{rl.route.status.replace("_", " ")}</strong></div>
                      </div>
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>
                        {rl.origin.name} → {rl.delivery.customer_name}
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Warehouses">
            <LayerGroup>
              {warehouses.map(w => (
                <Marker key={w.id} position={[Number(w.lat), Number(w.lng)]} icon={warehouseIcon}>
                  <Popup>
                    <div style={{ minWidth: 180, fontFamily: "system-ui" }}>
                      <strong style={{ fontSize: 13 }}>{w.name}</strong>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{w.code} · {w.city}</div>
                      <div style={{ fontSize: 12 }}>Capacity: <strong>{w.used_units}/{w.capacity_units}</strong></div>
                      <div style={{ fontSize: 12, textTransform: "capitalize" }}>Status: <strong>{w.status}</strong></div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Deliveries">
            <LayerGroup>
              {deliveries.map(d => (
                <Marker key={d.id} position={[Number(d.dest_lat), Number(d.dest_lng)]} icon={deliveryIcon}>
                  <Popup>
                    <div style={{ minWidth: 180, fontFamily: "system-ui" }}>
                      <strong style={{ fontSize: 13 }}>{d.tracking_no}</strong>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{d.customer_name}</div>
                      <div style={{ fontSize: 12, textTransform: "capitalize" }}>Status: <strong>{d.status.replace("_", " ")}</strong></div>
                      <div style={{ fontSize: 12, textTransform: "capitalize" }}>Priority: <strong>{d.priority}</strong></div>
                      <div style={{ fontSize: 12 }}>Weight: <strong>{d.weight_kg} kg</strong></div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Vehicles">
            <LayerGroup>
              {vehicles.map(v => (
                <Marker
                  key={v.id}
                  position={[Number(v.current_lat), Number(v.current_lng)]}
                  icon={vehicleIcon(v.status)}
                >
                  <Popup>
                    <div style={{ minWidth: 180, fontFamily: "system-ui" }}>
                      <strong style={{ fontSize: 13 }}>{v.plate}</strong>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{v.model} · {v.type}</div>
                      <div style={{ fontSize: 12, textTransform: "capitalize" }}>Status: <strong>{v.status.replace("_", " ")}</strong></div>
                      {v.fuel_pct != null && <div style={{ fontSize: 12 }}>Fuel: <strong>{v.fuel_pct}%</strong></div>}
                      {v.battery_pct != null && <div style={{ fontSize: 12 }}>Battery: <strong>{v.battery_pct}%</strong></div>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>
      </MapContainer>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
        <div className="mb-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Route Status</div>
        <div className="space-y-1">
          <LegendRow color="#10b981" label="Optimal" />
          <LegendRow color="#f59e0b" label="Moderate" />
          <LegendRow color="#ef4444" label="Delayed" dashed />
        </div>
      </div>

      {/* Live indicator */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-full border bg-card/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live
      </div>
    </div>
  );
}

function LegendRow({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="6">
        <line x1="0" y1="3" x2="22" y2="3" stroke={color} strokeWidth="3" strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      <span>{label}</span>
    </div>
  );
}
