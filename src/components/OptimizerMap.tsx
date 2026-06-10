import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, LayersControl, LayerGroup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Truck, Package } from "lucide-react";
import type { Assignment } from "@/lib/route-optimizer";

const VEHICLE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#ef4444", "#84cc16"];

function divIcon(html: string) {
  return L.divIcon({ html, className: "skyroute-marker", iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
}

const startIcon = (color: string) => divIcon(renderToStaticMarkup(
  <div style={{ width: 28, height: 28, borderRadius: 6, background: color, color: "white", display: "grid", placeItems: "center", border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
    <Truck size={14} strokeWidth={2.5} />
  </div>
));

const stopIcon = (color: string, n: number) => divIcon(renderToStaticMarkup(
  <div style={{ width: 26, height: 26, borderRadius: "50%", background: color, color: "white", display: "grid", placeItems: "center", border: "2px solid white", boxShadow: "0 2px 6px rgba(0,0,0,0.3)", fontSize: 11, fontWeight: 700 }}>
    {n}
  </div>
));

function Fit({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!pts.length) return;
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 11 });
  }, [map, pts.length]);
  return null;
}

export function OptimizerMap({
  original, optimized, height = 520,
}: {
  original: Assignment[];
  optimized: Assignment[];
  height?: number;
}) {
  const allPts: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    [...original, ...optimized].forEach(a => {
      pts.push([a.vehicle.start.lat, a.vehicle.start.lng]);
      a.stops.forEach(s => pts.push([s.lat, s.lng]));
    });
    return pts;
  }, [original, optimized]);

  const center: [number, number] = allPts[0] ?? [39.5, -98.35];

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card" style={{ height }}>
      <MapContainer center={center} zoom={5} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
        <Fit pts={allPts} />

        <LayersControl position="topright">
          <LayersControl.Overlay name="Original routes">
            <LayerGroup>
              {original.map((a, i) => {
                const color = "#ef4444";
                const positions: [number, number][] = [
                  [a.vehicle.start.lat, a.vehicle.start.lng],
                  ...a.stops.map(s => [s.lat, s.lng] as [number, number]),
                ];
                if (positions.length < 2) return null;
                return (
                  <Polyline key={`o-${i}`} positions={positions} pathOptions={{ color, weight: 3, opacity: 0.7, dashArray: "6 6" }}>
                    <Popup>
                      <strong>Original — {a.vehicle.plate}</strong>
                      <div style={{ fontSize: 12 }}>Distance: {a.distance_km} km</div>
                      <div style={{ fontSize: 12 }}>Cost: ${a.fuel_cost_usd}</div>
                    </Popup>
                  </Polyline>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Optimized routes">
            <LayerGroup>
              {optimized.map((a, i) => {
                const color = VEHICLE_COLORS[i % VEHICLE_COLORS.length];
                // Flatten dijkstra legs into a single polyline path
                const positions: [number, number][] = [];
                a.legs.forEach((leg, idx) => {
                  leg.forEach((p, j) => {
                    if (idx > 0 && j === 0) return; // dedupe leg junctions
                    positions.push([p.lat, p.lng]);
                  });
                });
                if (positions.length < 2) {
                  positions.push([a.vehicle.start.lat, a.vehicle.start.lng]);
                  a.stops.forEach(s => positions.push([s.lat, s.lng]));
                }
                return (
                  <Polyline key={`n-${i}`} positions={positions} pathOptions={{ color, weight: 4.5, opacity: 0.95 }}>
                    <Popup>
                      <strong>{a.vehicle.plate}</strong>
                      <div style={{ fontSize: 12 }}>Stops: {a.stops.length}</div>
                      <div style={{ fontSize: 12 }}>Distance: {a.distance_km} km</div>
                      <div style={{ fontSize: 12 }}>Duration: {a.duration_min} min</div>
                      <div style={{ fontSize: 12 }}>Fuel cost: ${a.fuel_cost_usd}</div>
                      <div style={{ fontSize: 12 }}>Load: {a.load_kg}/{a.vehicle.capacity_kg} kg</div>
                    </Popup>
                  </Polyline>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>

        {optimized.map((a, i) => {
          const color = VEHICLE_COLORS[i % VEHICLE_COLORS.length];
          return (
            <LayerGroup key={`m-${i}`}>
              <Marker position={[a.vehicle.start.lat, a.vehicle.start.lng]} icon={startIcon(color)}>
                <Popup><strong>{a.vehicle.plate}</strong><div style={{ fontSize: 12 }}>Start</div></Popup>
              </Marker>
              {a.stops.map((s, j) => (
                <Marker key={s.id} position={[s.lat, s.lng]} icon={stopIcon(color, j + 1)}>
                  <Popup>
                    <strong>Stop {j + 1} — {s.label}</strong>
                    <div style={{ fontSize: 12 }}>Weight: {s.weight_kg} kg</div>
                    <div style={{ fontSize: 12 }}>Vehicle: {a.vehicle.plate}</div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg border bg-card/95 p-2.5 text-xs shadow-lg backdrop-blur">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Legend</div>
        <div className="flex items-center gap-2">
          <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#ef4444" strokeWidth="3" strokeDasharray="4 3" /></svg>
          <span>Original</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#10b981" strokeWidth="3" /></svg>
          <span>Optimized</span>
        </div>
      </div>
    </div>
  );
}
