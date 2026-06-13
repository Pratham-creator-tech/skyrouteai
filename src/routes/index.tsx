import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, BrainCircuit, Truck, Leaf, Route as RouteIcon,
  ShieldCheck, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoImg from "@/assets/skyroute-logo.png";
import heroBg from "@/assets/hero-bg.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkyRoute AI — Autonomous Logistics Optimization" },
      { name: "description", content: "AI agents for deliveries, fleet, warehouses, routes, cost and carbon. Built for logistics teams that ship at scale." },
      { property: "og:title", content: "SkyRoute AI — Autonomous Logistics" },
      { property: "og:description", content: "Autonomous AI agents that run your logistics operation 24/7." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: BrainCircuit, title: "Autonomous AI agents", desc: "Six specialized agents continuously plan, dispatch, and optimize across your network." },
  { icon: RouteIcon, title: "Real-time route optimization", desc: "Re-route the fleet in seconds as traffic, demand, and SLAs shift." },
  { icon: Truck, title: "Fleet telemetry", desc: "Battery, fuel, capacity, and driver availability on a single live surface." },
  { icon: Leaf, title: "Carbon-aware routing", desc: "Cut CO₂ per delivery with EV-priority planning and load consolidation." },
  { icon: ShieldCheck, title: "RBAC & audit", desc: "Admins, Dispatchers, and Fleet Managers each see exactly what they need." },
  { icon: Activity, title: "Live KPIs", desc: "On-time rate, cost per stop, kg CO₂ saved — updated in real time." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Real hero background image */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_80%)]"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img src={logoImg} alt="SkyRoute AI logo" className="h-9 w-9 rounded-md object-cover" />
          <div className="font-display text-lg font-semibold tracking-tight">SkyRoute AI</div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button>Get started</Button></Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6">
        <section className="pt-16 sm:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            6 AI agents online — 1,284 deliveries optimized today
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            The autonomous operating system for{" "}
            <span className="text-primary">modern logistics</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            SkyRoute AI runs your deliveries, fleet, warehouses, routes, cost and carbon — with a team of AI agents that never sleep.
            Built for logistics companies, fleet operators, and supply chain leaders.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-2">Launch the control center <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <a href="#features"><Button size="lg" variant="outline">See features</Button></a>
          </div>
        </section>

        {/* Stat strip */}
        <section className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border lg:grid-cols-4">
          {[
            { k: "On-time rate", v: "98.7%" },
            { k: "Avg cost / stop", v: "$4.21" },
            { k: "CO₂ saved / mo", v: "12.4t" },
            { k: "Active vehicles", v: "1,820" },
          ].map(s => (
            <div key={s.k} className="bg-card p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.k}</div>
              <div className="mt-2 font-mono text-3xl font-semibold tabular-nums">{s.v}</div>
            </div>
          ))}
        </section>

        <section id="features" className="mt-24">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to run a delivery network
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            One control surface. Six AI agents. Built for enterprise-scale operations.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-2 lg:grid-cols-3">
            {features.map(f => (
              <div key={f.title} className="group bg-card p-6 transition-colors hover:bg-accent/30">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="my-24 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-10 sm:p-14">
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Ship more. Spend less. Emit less.
              </h3>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Spin up SkyRoute AI in minutes. Your dispatchers and fleet managers will wonder how they ever ran ops without it.
              </p>
            </div>
            <Link to="/auth">
              <Button size="lg" className="gap-2">Start now <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <div>© {new Date().getFullYear()} SkyRoute AI. All rights reserved.</div>
          <div className="font-mono">v1.0 · enterprise</div>
        </div>
      </footer>
    </div>
  );
}
