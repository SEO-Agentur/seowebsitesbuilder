"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!token) { setErr("Missing reset token in URL."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (e: any) {
      setErr(e?.message || "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm bg-white border border-black/5 rounded-2xl p-8">
        <Link href="/" className="font-semibold text-lg block mb-6">Seowebsitesbuilder</Link>
        <h1 className="text-2xl font-semibold mb-2">Choose a new password</h1>
        {done ? (
          <>
            <p className="text-sm text-muted mb-6">Password updated. Redirecting to login…</p>
            <Link href="/login" className="block text-center bg-ink text-white py-2 rounded-md font-medium hover:bg-black">
              Log in
            </Link>
          </>
        ) : token === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : !token ? (
          <>
            <p className="text-sm text-red-600 mb-4">This reset link is missing its token. Request a new one.</p>
            <Link href="/forgot-password" className="block text-center bg-ink text-white py-2 rounded-md font-medium hover:bg-black">
              Request reset link
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted mb-6">At least 8 characters.</p>
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium">New password</span>
                <input
                  type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Confirm password</span>
                <input
                  type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
                />
              </label>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button disabled={busy} className="w-full bg-ink text-white py-2 rounded-md font-medium hover:bg-black disabled:opacity-50">
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
