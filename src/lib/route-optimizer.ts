// Route optimization core: Nearest Neighbor (TSP) + Dijkstra shortest paths.
// All distances in km via haversine. Travel time assumes avg 50 km/h.

export type GeoPoint = { id: string; label: string; lat: number; lng: number };

export type OptVehicle = {
  id: string;
  plate: string;
  capacity_kg: number;
  fuel_efficiency: number; // km per liter (or per kWh equivalent)
  fuel_price: number;      // $ per liter
  start: GeoPoint;         // current/home location
};

export type OptDelivery = GeoPoint & { weight_kg: number };

export type Assignment = {
  vehicle: OptVehicle;
  stops: OptDelivery[];          // in visit order
  legs: GeoPoint[][];            // dijkstra-derived path nodes per leg (incl. waypoints)
  distance_km: number;
  duration_min: number;
  fuel_cost_usd: number;
  load_kg: number;
};

export type OptimizationResult = {
  original: { assignments: Assignment[]; totals: Totals };
  optimized: { assignments: Assignment[]; totals: Totals };
  savings: { distance_pct: number; cost_pct: number; time_pct: number };
};

export type Totals = { distance_km: number; duration_min: number; fuel_cost_usd: number };

const AVG_SPEED_KMH = 50;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ── Dijkstra shortest path on a weighted graph (adjacency: node -> {to, w}) ──
export function dijkstra(
  nodes: GeoPoint[],
  edges: { from: string; to: string; weight: number }[],
  startId: string,
  endId: string,
): { path: GeoPoint[]; distance: number } {
  const adj = new Map<string, { to: string; w: number }[]>();
  nodes.forEach(n => adj.set(n.id, []));
  edges.forEach(e => {
    adj.get(e.from)?.push({ to: e.to, w: e.weight });
    adj.get(e.to)?.push({ to: e.from, w: e.weight });
  });
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();
  nodes.forEach(n => { dist.set(n.id, Infinity); prev.set(n.id, null); });
  dist.set(startId, 0);
  const queue = new Set(nodes.map(n => n.id));

  while (queue.size > 0) {
    let u: string | null = null;
    let best = Infinity;
    for (const id of queue) {
      const d = dist.get(id)!;
      if (d < best) { best = d; u = id; }
    }
    if (u == null || best === Infinity) break;
    queue.delete(u);
    visited.add(u);
    if (u === endId) break;
    for (const { to, w } of adj.get(u) ?? []) {
      if (visited.has(to)) continue;
      const alt = best + w;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, u);
      }
    }
  }

  const path: GeoPoint[] = [];
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  let cur: string | null = endId;
  while (cur) {
    const n = nodeById.get(cur);
    if (!n) break;
    path.unshift(n);
    cur = prev.get(cur) ?? null;
  }
  return { path, distance: dist.get(endId) ?? Infinity };
}

// Build a sparse graph: connect every delivery/start to its K nearest neighbours
// + all warehouses as potential waypoints. This lets Dijkstra prefer hub-routing
// when it's shorter than a direct hop.
function buildGraph(points: GeoPoint[], k = 4) {
  const edges: { from: string; to: string; weight: number }[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const dists = points
      .filter(q => q.id !== p.id)
      .map(q => ({ q, d: haversineKm(p, q) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
    for (const { q, d } of dists) {
      const key = [p.id, q.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: p.id, to: q.id, weight: d });
    }
  }
  return edges;
}

// ── Nearest-Neighbor TSP order from a fixed start ──
function nearestNeighborOrder(start: GeoPoint, stops: OptDelivery[]): OptDelivery[] {
  const remaining = [...stops];
  const order: OptDelivery[] = [];
  let cur: GeoPoint = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cur, remaining[i]);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    order.push(next);
    cur = next;
  }
  return order;
}

// ── Capacity-aware greedy assignment: each delivery → nearest vehicle with room ──
function assignDeliveries(
  vehicles: OptVehicle[],
  deliveries: OptDelivery[],
): Map<string, OptDelivery[]> {
  const buckets = new Map<string, OptDelivery[]>();
  const load = new Map<string, number>();
  vehicles.forEach(v => { buckets.set(v.id, []); load.set(v.id, 0); });

  // Sort heaviest/most-constrained first for better packing.
  const sorted = [...deliveries].sort((a, b) => b.weight_kg - a.weight_kg);

  for (const d of sorted) {
    let bestV: OptVehicle | null = null;
    let bestScore = Infinity;
    for (const v of vehicles) {
      const remaining = v.capacity_kg - (load.get(v.id) ?? 0);
      if (remaining < d.weight_kg) continue;
      // proximity to vehicle's current trailing point
      const tail = buckets.get(v.id)!.at(-1) ?? v.start;
      const score = haversineKm(tail, d);
      if (score < bestScore) { bestScore = score; bestV = v; }
    }
    if (bestV) {
      buckets.get(bestV.id)!.push(d);
      load.set(bestV.id, (load.get(bestV.id) ?? 0) + d.weight_kg);
    }
  }
  return buckets;
}

function buildAssignment(
  vehicle: OptVehicle,
  order: OptDelivery[],
  graphNodes: GeoPoint[],
  graphEdges: { from: string; to: string; weight: number }[],
  useDijkstra: boolean,
): Assignment {
  const legs: GeoPoint[][] = [];
  let distance = 0;
  let cur: GeoPoint = vehicle.start;
  for (const stop of order) {
    if (useDijkstra) {
      const { path, distance: d } = dijkstra(graphNodes, graphEdges, cur.id, stop.id);
      legs.push(path.length > 1 ? path : [cur, stop]);
      distance += isFinite(d) ? d : haversineKm(cur, stop);
    } else {
      legs.push([cur, stop]);
      distance += haversineKm(cur, stop);
    }
    cur = stop;
  }
  const duration = (distance / AVG_SPEED_KMH) * 60;
  const liters = distance / Math.max(vehicle.fuel_efficiency, 0.1);
  const cost = liters * vehicle.fuel_price;
  const load = order.reduce((s, d) => s + d.weight_kg, 0);
  return {
    vehicle, stops: order, legs,
    distance_km: +distance.toFixed(2),
    duration_min: Math.round(duration),
    fuel_cost_usd: +cost.toFixed(2),
    load_kg: +load.toFixed(2),
  };
}

function sumTotals(assignments: Assignment[]): Totals {
  return assignments.reduce(
    (t, a) => ({
      distance_km: +(t.distance_km + a.distance_km).toFixed(2),
      duration_min: t.duration_min + a.duration_min,
      fuel_cost_usd: +(t.fuel_cost_usd + a.fuel_cost_usd).toFixed(2),
    }),
    { distance_km: 0, duration_min: 0, fuel_cost_usd: 0 },
  );
}

export function optimize(
  vehicles: OptVehicle[],
  deliveries: OptDelivery[],
  waypoints: GeoPoint[] = [],
): OptimizationResult {
  // Graph for Dijkstra: vehicle starts + deliveries + warehouses as waypoints.
  const graphNodes: GeoPoint[] = [
    ...vehicles.map(v => v.start),
    ...deliveries,
    ...waypoints,
  ];
  const graphEdges = buildGraph(graphNodes, 5);

  // ── Original: round-robin deliveries to vehicles, original (id) order, direct hops ──
  const origBuckets = new Map<string, OptDelivery[]>();
  vehicles.forEach(v => origBuckets.set(v.id, []));
  deliveries.forEach((d, i) => {
    const v = vehicles[i % vehicles.length];
    if (v) origBuckets.get(v.id)!.push(d);
  });
  const originalAssignments = vehicles.map(v =>
    buildAssignment(v, origBuckets.get(v.id) ?? [], graphNodes, graphEdges, false),
  );

  // ── Optimized: capacity-aware assignment + NN order + Dijkstra paths ──
  const optBuckets = assignDeliveries(vehicles, deliveries);
  const optimizedAssignments = vehicles.map(v => {
    const stops = optBuckets.get(v.id) ?? [];
    const order = nearestNeighborOrder(v.start, stops);
    return buildAssignment(v, order, graphNodes, graphEdges, true);
  });

  const oT = sumTotals(originalAssignments);
  const nT = sumTotals(optimizedAssignments);
  const pct = (a: number, b: number) => (a > 0 ? +(((a - b) / a) * 100).toFixed(1) : 0);

  return {
    original: { assignments: originalAssignments, totals: oT },
    optimized: { assignments: optimizedAssignments, totals: nT },
    savings: {
      distance_pct: pct(oT.distance_km, nT.distance_km),
      cost_pct: pct(oT.fuel_cost_usd, nT.fuel_cost_usd),
      time_pct: pct(oT.duration_min, nT.duration_min),
    },
  };
}
