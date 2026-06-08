# SkyRoute AI — Build Plan

## Design direction
Enterprise logistics control-center aesthetic: deep slate/near-black surfaces in dark mode, crisp white in light mode, single electric-cyan accent (signal/telemetry feel), a warm amber for alerts, mono-numeric typography for KPIs. Tight 8px grid, dense data tables, soft inner borders, no gradients on chrome. Fonts: Space Grotesk (display) + Inter (body) + JetBrains Mono (numbers/IDs).

## Stack
- TanStack Start (already scaffolded), Tailwind v4, shadcn/ui
- Lovable Cloud (Supabase) for DB + Auth
- TanStack Query for data fetching via `createServerFn`
- Recharts for analytics
- next-themes-style theme toggle (class-based `dark`)

## Auth & RBAC
- Email/password + Google sign-in
- `profiles` table (id → auth.users, full_name, company)
- `app_role` enum: admin, dispatcher, fleet_manager
- `user_roles` table + `has_role()` SECURITY DEFINER function
- `/auth` route, `_authenticated/` protected subtree (integration-managed gate)
- Role-gated nav items + per-route role checks via context

## Database schema (all RLS-enabled, GRANTed)
- `profiles` — user metadata
- `user_roles` — role assignments
- `warehouses` — id, name, address, lat, lng, capacity, manager_id
- `vehicles` — id, plate, type (van/truck/ev), capacity_kg, status (idle/in_transit/maintenance), fuel_type, battery_pct, current_lat/lng, assigned_driver
- `drivers` — id, name, license, phone, status
- `deliveries` — id, tracking_no, origin_warehouse, dest_address, dest_lat/lng, customer_name, status (pending/assigned/in_transit/delivered/failed), priority, scheduled_for, vehicle_id, weight_kg, eta
- `routes` — id, name, vehicle_id, planned_at, total_distance_km, total_duration_min, estimated_cost, estimated_co2_kg, optimization_score, status
- `route_stops` — route_id, delivery_id, sequence, arrival_eta
- `ai_agents` — id, name, type (router/dispatcher/predictor/optimizer), status (active/paused/error), last_run, runs_today, success_rate
- `ai_events` — agent_id, action, payload jsonb, created_at

RLS: authenticated users can read most operational tables; only admin/dispatcher can write deliveries/routes; only admin/fleet_manager can write vehicles; admin can do everything.

## Routes
- `/` — marketing landing (hero, features, CTA → /auth)
- `/auth` — sign in / sign up
- `/_authenticated/` — app shell with sidebar
  - `dashboard` — KPIs, active deliveries map placeholder, fleet status, AI agent status, recent events
  - `deliveries` — table, filters, status badges, create dialog
  - `vehicles` — grid of vehicle cards + table view, status, battery/fuel
  - `warehouses` — list + detail
  - `route-planner` — form to plan route, list of optimized routes with stops
  - `ai-control` — AI agents grid, toggle active/paused, recent events feed
  - `analytics` — charts: deliveries over time, on-time %, cost trends, CO2 saved
  - `settings` — profile, theme, role display, sign out

## Components
- `AppSidebar` (collapsible, shadcn sidebar)
- `ThemeToggle`
- `StatCard`, `StatusBadge`, `PageHeader`
- `DataTable` wrapper around shadcn table

## Seed
Insert ~6 warehouses, 12 vehicles, 8 drivers, 30 deliveries, 6 AI agents, sample routes/events so the dashboard looks alive.

## Out of scope (v1)
- Real map (use stylized placeholder); real route optimization (we display realistic mock metrics)
- Real-time GPS streaming
- Billing

Confirm and I'll build it end-to-end.