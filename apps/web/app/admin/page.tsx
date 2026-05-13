"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthed, clearSession, currentUser } from "@/lib/auth";

export default function AdminLanding() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [okMe, setOkMe] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthed()) { router.replace("/login"); return; }
    // The /admin/trial-ai/config endpoint 403s for non-admins — use it as a gate.
    api.adminTrialConfig()
      .then(() => setOkMe(true))
      .catch((e) => { setOkMe(false); setErr(e.message); });
  }, [router]);

  function logout() { clearSession(); router.push("/"); }
  const user = currentUser();

  if (okMe === false) {
    return (
      <main className="min-h-screen grid place-items-center px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold mb-2">Admin access required</h1>
          <p className="text-sm text-muted mb-6">Your account isn&apos;t an admin. {err}</p>
          <Link href="/dashboard" className="bg-ink text-white px-4 py-2 rounded-md text-sm font-medium">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-black/5 p-6 flex flex-col">
        <Link href="/" className="font-semibold text-lg mb-8">Seowebsitesbuilder</Link>
        <nav className="space-y-1 text-sm flex-1">
          <Link href="/dashboard" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Projects</Link>
          <Link href="/domains" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Domains</Link>
          <Link href="/billing" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">Billing</Link>
          <Link href="/settings" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5">AI keys</Link>
          <div className="pt-2 mt-2 border-t border-black/5">
            <a className="block px-3 py-2 rounded-md bg-ink/5 font-medium">Admin</a>
            <Link href="/admin/trial-ai" className="block px-3 py-2 rounded-md text-muted hover:bg-black/5 ml-3">Trial AI pool</Link>
          </div>
        </nav>
        <div className="text-sm">
          <p className="text-muted mb-2">{user?.email}</p>
          <button onClick={logout} className="text-muted hover:text-ink">Log out</button>
        </div>
      </aside>

      <main className="flex-1 p-10 max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Admin</h1>
        <p className="text-muted mb-8">Internal controls for the trial pool, soon: users, abuse reports, system stats.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/admin/trial-ai" className="bg-white border border-black/5 rounded-2xl p-6 hover:border-accent/30 hover:shadow-sm transition">
            <h2 className="font-semibold mb-1">Trial AI pool</h2>
            <p className="text-sm text-muted">Model, input/output caps, daily $ ceiling, per-user lifetime cap. Today&apos;s spend.</p>
          </Link>
          <article className="bg-white border border-black/5 rounded-2xl p-6 opacity-50">
            <h2 className="font-semibold mb-1">Users</h2>
            <p className="text-sm text-muted">Search, plan, abuse flags. (Coming soon.)</p>
          </article>
        </div>
      </main>
    </div>
  );
}
