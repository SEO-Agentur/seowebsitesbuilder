"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm bg-white border border-black/5 rounded-2xl p-8">
        <Link href="/" className="font-semibold text-lg block mb-6">Seowebsitesbuilder</Link>
        <h1 className="text-2xl font-semibold mb-2">Reset password</h1>
        {sent ? (
          <>
            <p className="text-sm text-muted mb-6">
              If an account exists for <span className="text-ink font-medium">{email}</span>, we&apos;ve sent a reset link. The link expires in 1 hour.
            </p>
            <Link href="/login" className="block text-center bg-ink text-white py-2 rounded-md font-medium hover:bg-black">
              Back to login
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted mb-6">
              Enter your email. We&apos;ll send you a link to choose a new password.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Email</span>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
                />
              </label>
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button disabled={busy} className="w-full bg-ink text-white py-2 rounded-md font-medium hover:bg-black disabled:opacity-50">
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="text-sm text-muted mt-6 text-center">
              Remembered it? <Link href="/login" className="text-accent">Log in</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
