"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveSession } from "@/lib/auth";

const ORCH = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "https://seowebsitesbuilder.com";

export default function OAuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The orchestrator redirects to /auth/callback#token=<jwt> — the URL hash
    // never hits server logs or referrer headers, so it's a safe handoff.
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get("token");
    if (!token) {
      setError("No token in callback URL.");
      return;
    }
    // Fetch the user profile so we can store both pieces of session state.
    (async () => {
      try {
        const r = await fetch(`${ORCH}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(`/auth/me returned ${r.status}`);
        const { user } = await r.json();
        saveSession(token, user);
        // Wipe the hash before navigating, so a Back button doesn't expose it.
        history.replaceState(null, "", "/auth/callback");
        const pending = localStorage.getItem("seo_pending_prompt");
        window.location.replace(pending ? "/onboarding" : "/dashboard");
      } catch (e: any) {
        setError(e?.message || "Sign-in failed");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen grid place-items-center px-6 text-center">
      <div className="max-w-sm">
        {error ? (
          <>
            <h1 className="text-xl font-semibold mb-2">Sign-in failed</h1>
            <p className="text-sm text-muted mb-6">{error}</p>
            <Link href="/login" className="bg-ink text-white px-4 py-2 rounded-md text-sm font-medium">Back to log in</Link>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-4" aria-hidden="true" />
            <p className="text-sm text-muted">Signing you in…</p>
          </>
        )}
      </div>
    </main>
  );
}
