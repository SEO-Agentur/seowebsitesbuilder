"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { OAuthButtons } from "@/components/oauth-buttons";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { token, user } = await api.signup(email, password, name || undefined);
      saveSession(token, user);
      const pendingPrompt = typeof window !== "undefined" ? localStorage.getItem("seo_pending_prompt") : null;
      const pendingTemplate = typeof window !== "undefined" ? localStorage.getItem("seo_pending_template") : null;
      router.push((pendingPrompt || pendingTemplate) ? "/onboarding" : "/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm bg-white border border-black/5 rounded-2xl p-8">
        <Link href="/" className="font-semibold text-lg block mb-6">Seowebsitesbuilder</Link>
        <h1 className="text-2xl font-semibold mb-2">Create your account</h1>
        <p className="text-sm text-muted mb-6">Free starter project. Upgrade any time.</p>
        <OAuthButtons verb="Sign up with" />
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Name (optional)</span>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">8+ characters</span>
          </label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="w-full bg-ink text-white py-2 rounded-md font-medium hover:bg-black disabled:opacity-50">
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-muted mt-6 text-center">
          Already have an account? <Link href="/login" className="text-accent">Log in</Link>
        </p>
      </div>
    </main>
  );
}
