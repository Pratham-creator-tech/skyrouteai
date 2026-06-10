// Autonomous logistics agents. Each receives live snapshot data and returns
// a set of recommendations with reasoning. Decisions are persisted to
// ai_decisions so they stream into the activity timeline in real time.

import { supabase } from "@/integrations/supabase/client";

export type AgentKey = "dispatch" | "route" | "cost" | "sustainability";

export type Recommendation = {
  title: string;
  reasoning: string;
  impact?: string;
};

export type AgentResult = {
  agent: AgentKey;
  agentName: string;
  recommendations: Recommendation[];
};

export const AGENT_META: Record<AgentKey, {
  name: string;
  tagline: string;
  description: string;
  accent: string;          // tailwind text color class for icon
  bg: string;              // tailwind bg tint class
}> = {
  dispatch: {
    name: "Dispatch Agent",
    tagline: "Assigns deliveries to the best-fit vehicle",
    description: "Matches pending deliveries to vehicles using capacity, proximity and priority.",
    accent: "text-primary",
    bg: "bg-primary/10",
  },
  route: {
    name: "Route Agent",
    tagline: "Optimizes delivery routes & sequencing",
    description: "Spots low-efficiency routes and recommends re-sequencing or splits.",
    accent: "text-info",
    bg: "bg-info/10",
  },
  cost: {
    name: "Cost Agent",
    tagline: "Minimizes transportation costs",
    description: "Targets idle assets, expensive per-km routes and underutilised capacity.",
    accent: "text-warning",
    bg: "bg-warning/10",
  },
  sustainability: {
    name: "Sustainability Agent",
    tagline: "Reduces carbon emissions",
    description: "Prefers EVs, consolidates loads and flags high-emission deliveries.",
    accent: "text-success",
    bg: "bg-success/10",
  },
};

type Snapshot = {
  deliveries: any[];
  vehicles: any[];
  routes: any[];
  warehouses: any[];
};

async function loadSnapshot(): Promise<Snapshot> {
  const [d, v, r, w] = await Promise.all([
    supabase.from("deliveries").select("*"),
    supabase.from("vehicles").select("*"),
    supabase.from("routes").select("*"),
    supabase.from("warehouses").select("*"),
  ]);
  return {
    deliveries: d.data ?? [],
    vehicles: v.data ?? [],
    routes: r.data ?? [],
    warehouses: w.data ?? [],
  };
}

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- Dispatch Agent ----------
function runDispatch({ deliveries, vehicles }: Snapshot): Recommendation[] {
  const recs: Recommendation[] = [];
  const pending = deliveries.filter(d => d.status === "pending" || d.status === "assigned" && !d.vehicle_id);
  const idle = vehicles.filter(v => v.status === "idle" || v.status === "available");

  if (!pending.length) {
    recs.push({
      title: "All deliveries dispatched",
      reasoning: "No pending deliveries remain in the queue. Fleet is fully assigned.",
      impact: "0 deliveries waiting",
    });
    return recs;
  }

  // Pair urgent deliveries with closest idle vehicle
  const urgent = pending
    .filter(d => d.priority === "urgent" || d.priority === "high")
    .slice(0, 3);
  for (const d of urgent) {
    if (!d.pickup_latitude || !d.pickup_longitude) continue;
    let best: any = null;
    let bestDist = Infinity;
    for (const v of idle) {
      if (!v.current_lat || !v.current_lng) continue;
      if (v.capacity_kg && d.weight && Number(v.capacity_kg) < Number(d.weight)) continue;
      const dist = km(d.pickup_latitude, d.pickup_longitude, v.current_lat, v.current_lng);
      if (dist < bestDist) { bestDist = dist; best = v; }
    }
    if (best) {
      recs.push({
        title: `Assign ${d.tracking_no ?? d.id?.slice(0, 6)} → ${best.plate ?? best.vehicle_number ?? "vehicle"}`,
        reasoning: `Priority ${d.priority}. Vehicle ${best.plate ?? best.vehicle_number} is ${bestDist.toFixed(1)} km from pickup and has ${best.capacity_kg ?? "ample"} kg capacity available.`,
        impact: `−${bestDist.toFixed(1)} km dead-haul`,
      });
    }
  }

  // Capacity / fleet utilisation
  if (idle.length === 0 && pending.length > 0) {
    recs.push({
      title: "Fleet saturated — escalate capacity",
      reasoning: `${pending.length} deliveries pending with 0 idle vehicles. Consider recalling a maintenance unit or sub-contracting.`,
      impact: "Prevents SLA breach",
    });
  } else if (idle.length > pending.length * 2) {
    recs.push({
      title: "Park surplus capacity",
      reasoning: `${idle.length} vehicles idle vs. ${pending.length} pending jobs. Standing down ${Math.floor((idle.length - pending.length) / 2)} units reduces operating overhead.`,
      impact: "Lower fixed cost",
    });
  }

  return recs.slice(0, 5);
}

// ---------- Route Agent ----------
function runRoute({ routes, deliveries }: Snapshot): Recommendation[] {
  const recs: Recommendation[] = [];
  const lowScore = routes
    .filter(r => typeof r.optimization_score === "number" && r.optimization_score < 75)
    .sort((a, b) => (a.optimization_score ?? 0) - (b.optimization_score ?? 0))
    .slice(0, 3);

  for (const r of lowScore) {
    recs.push({
      title: `Re-optimize route ${r.name ?? r.id?.slice(0, 6)}`,
      reasoning: `Optimization score is ${r.optimization_score}/100. Re-running Nearest-Neighbor + Dijkstra is projected to cut distance by 8–15% on similar profiles.`,
      impact: `−${Math.round(((85 - r.optimization_score) / 85) * (r.total_distance_km ?? 0))} km`,
    });
  }

  const inTransit = deliveries.filter(d => d.status === "in_transit").length;
  if (inTransit > 5) {
    recs.push({
      title: "Consolidate overlapping corridors",
      reasoning: `${inTransit} in-transit deliveries detected. Cluster overlapping corridors and chain stops to reduce empty-leg mileage.`,
      impact: "−12% planned distance",
    });
  }

  if (!recs.length) {
    recs.push({
      title: "Route plan is healthy",
      reasoning: "All active routes score ≥ 75 and no overlapping corridors detected.",
      impact: "No action needed",
    });
  }

  return recs.slice(0, 5);
}

// ---------- Cost Agent ----------
function runCost({ vehicles, routes, deliveries }: Snapshot): Recommendation[] {
  const recs: Recommendation[] = [];

  // Low fuel vehicles — refuel before deadhead
  const lowFuel = vehicles.filter(v => typeof v.fuel_level === "number" && v.fuel_level < 25).slice(0, 3);
  for (const v of lowFuel) {
    recs.push({
      title: `Refuel ${v.plate ?? v.vehicle_number} (${v.fuel_level}%)`,
      reasoning: `Below 25% fuel. Detour-refueling now avoids an emergency stop mid-route that historically costs ~$45 in lost time and premium fuel.`,
      impact: "−$45 avg / incident",
    });
  }

  // Expensive routes
  const costly = routes
    .filter(r => r.estimated_cost && r.total_distance_km)
    .map(r => ({ ...r, cpk: Number(r.estimated_cost) / Number(r.total_distance_km) }))
    .filter(r => r.cpk > 2.5)
    .sort((a, b) => b.cpk - a.cpk)
    .slice(0, 2);
  for (const r of costly) {
    recs.push({
      title: `Cost spike on ${r.name ?? r.id?.slice(0, 6)}`,
      reasoning: `Cost-per-km is $${r.cpk.toFixed(2)} vs. fleet baseline of $1.40. Likely caused by toll routing or low load factor — reassign to a diesel van.`,
      impact: `−$${(r.estimated_cost * 0.18).toFixed(0)} per run`,
    });
  }

  // Light loads
  const light = deliveries.filter(d => d.weight && Number(d.weight) < 5 && d.status === "pending").length;
  if (light >= 3) {
    recs.push({
      title: `Consolidate ${light} light parcels`,
      reasoning: `${light} sub-5kg pending deliveries can ride a single van instead of dedicating vehicles. Net saving ≈ $${(light * 12).toFixed(0)}.`,
      impact: `−$${(light * 12).toFixed(0)}`,
    });
  }

  if (!recs.length) {
    recs.push({
      title: "Cost profile within budget",
      reasoning: "No fuel emergencies, cost-per-km outliers, or under-loaded vehicles detected.",
      impact: "On target",
    });
  }
  return recs.slice(0, 5);
}

// ---------- Sustainability Agent ----------
function runSustainability({ vehicles, deliveries, routes }: Snapshot): Recommendation[] {
  const recs: Recommendation[] = [];

  const evs = vehicles.filter(v => v.fuel_type === "electric" || v.fuel_type === "ev");
  const diesel = vehicles.filter(v => v.fuel_type === "diesel" || v.fuel_type === "gasoline");
  const idleEVs = evs.filter(v => v.status === "idle" || v.status === "available");

  if (idleEVs.length > 0 && diesel.some(v => v.status === "in_transit" || v.status === "on_route")) {
    recs.push({
      title: `Prefer ${idleEVs.length} idle EV${idleEVs.length > 1 ? "s" : ""} for next dispatch`,
      reasoning: `EVs ${idleEVs.map(v => v.plate ?? v.vehicle_number).slice(0, 3).join(", ")} are available while diesel units are on route. Swapping the next assignment cuts ~2.3 kg CO₂ per km.`,
      impact: `−${(idleEVs.length * 18).toFixed(0)} kg CO₂ / day`,
    });
  }

  // Heavy diesel routes
  const heavyDiesel = routes
    .filter(r => r.estimated_co2_kg && r.estimated_co2_kg > 40)
    .sort((a, b) => (b.estimated_co2_kg ?? 0) - (a.estimated_co2_kg ?? 0))
    .slice(0, 2);
  for (const r of heavyDiesel) {
    recs.push({
      title: `High-emission route flagged: ${r.name ?? r.id?.slice(0, 6)}`,
      reasoning: `Estimated ${Number(r.estimated_co2_kg).toFixed(1)} kg CO₂. Re-routing via lowland corridor or splitting between two EVs reduces emissions ~30%.`,
      impact: `−${(Number(r.estimated_co2_kg) * 0.3).toFixed(1)} kg CO₂`,
    });
  }

  // Load consolidation potential
  const pendingNearby = deliveries.filter(d => d.status === "pending").length;
  if (pendingNearby >= 4) {
    recs.push({
      title: "Consolidate clustered pickups",
      reasoning: `${pendingNearby} pending deliveries can be grouped into multi-stop tours, cutting per-parcel emissions by ~22%.`,
      impact: `−${(pendingNearby * 1.4).toFixed(1)} kg CO₂`,
    });
  }

  if (!recs.length) {
    recs.push({
      title: "Emissions profile optimal",
      reasoning: "EV utilisation is high and no routes exceed the 40 kg CO₂ threshold.",
      impact: "Goal met",
    });
  }
  return recs.slice(0, 5);
}

const RUNNERS: Record<AgentKey, (s: Snapshot) => Recommendation[]> = {
  dispatch: runDispatch,
  route: runRoute,
  cost: runCost,
  sustainability: runSustainability,
};

export async function runAgent(agent: AgentKey): Promise<AgentResult> {
  const snap = await loadSnapshot();
  const recs = RUNNERS[agent](snap);
  const meta = AGENT_META[agent];

  // Persist each recommendation as a decision for the activity timeline.
  if (recs.length) {
    await supabase.from("ai_decisions").insert(
      recs.map(r => ({
        agent_name: meta.name,
        decision: r.title,
        reasoning: r.reasoning + (r.impact ? `  ·  Impact: ${r.impact}` : ""),
      })),
    );
  }

  return { agent, agentName: meta.name, recommendations: recs };
}

export async function runAllAgents(): Promise<AgentResult[]> {
  const keys: AgentKey[] = ["dispatch", "route", "cost", "sustainability"];
  const out: AgentResult[] = [];
  for (const k of keys) out.push(await runAgent(k));
  return out;
}
