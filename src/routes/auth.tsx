import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import logoImg from "@/assets/skyroute-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — SkyRoute AI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleEmail(mode: "signin" | "signup", e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    const full_name = String(fd.get("full_name") || "");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name } },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) { toast.error(result.error.message || "Google sign-in failed"); setLoading(false); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute right-4 top-4 z-10"><ThemeToggle /></div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-2">
        <div className="hidden lg:block">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img src={logoImg} alt="SkyRoute AI logo" className="h-9 w-9 rounded-md object-cover" />
            <div className="font-display text-lg font-semibold tracking-tight">SkyRoute AI</div>
          </Link>
          <h2 className="mt-12 font-display text-4xl font-semibold leading-tight tracking-tight">
            The control center for autonomous logistics.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Sign in to monitor deliveries, fleet, warehouses, routes and AI agents in real time.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" /> 99.9% uptime SLA</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Role-based access for Admins, Dispatchers, Fleet Managers</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> SOC-2 ready architecture</li>
          </ul>
        </div>

        <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
          <Link to="/" className="mb-6 inline-flex items-center gap-2.5 lg:hidden">
            <img src={logoImg} alt="SkyRoute AI logo" className="h-8 w-8 rounded-md object-cover" />
            <div className="font-display font-semibold">SkyRoute AI</div>
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in or create your account to continue.</p>

          <Button variant="outline" onClick={handleGoogle} disabled={loading} className="mt-6 w-full">
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or with email</span>
            </div>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <form onSubmit={(e) => handleEmail("signin", e)} className="space-y-3">
                <div><Label htmlFor="si-email">Email</Label><Input id="si-email" name="email" type="email" required autoComplete="email" /></div>
                <div><Label htmlFor="si-pw">Password</Label><Input id="si-pw" name="password" type="password" required autoComplete="current-password" /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in…" : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <form onSubmit={(e) => handleEmail("signup", e)} className="space-y-3">
                <div><Label htmlFor="su-name">Full name</Label><Input id="su-name" name="full_name" required /></div>
                <div><Label htmlFor="su-email">Email</Label><Input id="su-email" name="email" type="email" required autoComplete="email" /></div>
                <div><Label htmlFor="su-pw">Password</Label><Input id="su-pw" name="password" type="password" required minLength={6} autoComplete="new-password" /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating…" : "Create account"}</Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to SkyRoute AI's Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.2-5.5 4.2-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.4 14.7 2.5 12 2.5 6.8 2.5 2.7 6.7 2.7 11.9S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.7 0-.5-.1-.9-.1-1.3H12z"/>
    </svg>
  );
}
