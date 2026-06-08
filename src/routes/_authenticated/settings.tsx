import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Shield, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SkyRoute AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name,company").eq("id", user.id).maybeSingle().then(({ data }) => {
      setFullName(data?.full_name ?? "");
      setCompany(data?.company ?? "");
    });
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, company }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Profile, appearance, and access." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Profile</h3>
          <p className="text-xs text-muted-foreground">Update your name and company.</p>
          <div className="mt-5 space-y-3">
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div>
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="co">Company</Label>
              <Input id="co" value={company} onChange={e => setCompany(e.target.value)} />
            </div>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-semibold">Access</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Roles assigned to your account</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {roles.length === 0 && <span className="text-xs text-muted-foreground">No roles assigned</span>}
              {roles.map(r => (
                <span key={r} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-xs uppercase text-primary">
                  {r.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-display text-base font-semibold">Appearance</h3>
            <p className="text-xs text-muted-foreground">Choose your theme</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setTheme("light")}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${theme === "light" ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                <Sun className="h-4 w-4" /> Light
              </button>
              <button onClick={() => setTheme("dark")}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${theme === "dark" ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                <Moon className="h-4 w-4" /> Dark
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-display text-base font-semibold">Session</h3>
            <Button variant="outline" className="mt-3 w-full gap-2" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
