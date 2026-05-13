"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { OAuthButtons } from "@/components/oauth-buttons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { token, user } = await api.login(email, password);
      saveSession(token, user);
      const pending = typeof window !== "undefined" ? localStorage.getItem("seo_pending_prompt") : null;
      router.push(pending ? "/onboarding" : "/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm bg-white border border-black/5 rounded-2xl p-8">
        <Link href="/" className="font-semibold text-lg block mb-6">Seowebsitesbuilder</Link>
        <h1 className="text-2xl font-semibold mb-6">Log in</h1>
        <OAuthButtons verb="Continue with" />
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Password</span>
              <Link href="/forgot-password" className="text-xs text-accent hover:underline">Forgot?</Link>
            </div>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
            />
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="w-full bg-ink text-white py-2 rounded-md font-medium hover:bg-black disabled:opacity-50">
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="text-sm text-muted mt-6 text-center">
          No account? <Link href="/signup" className="text-accent">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
