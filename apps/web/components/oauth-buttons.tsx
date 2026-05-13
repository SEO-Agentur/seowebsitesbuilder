"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Props {
  /** Shown above the buttons. e.g. "Sign in with" or "Sign up with" */
  verb?: string;
}

export function OAuthButtons({ verb = "Continue with" }: Props) {
  const [providers, setProviders] = useState<{ id: "github" | "google"; enabled: boolean }[] | null>(null);

  useEffect(() => {
    api.oauthProviders().then((r) => setProviders(r.providers));
  }, []);

  if (!providers) return null;
  const enabled = providers.filter((p) => p.enabled);
  if (enabled.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        {enabled.find((p) => p.id === "github") && (
          <a
            href={api.oauthStartUrl("github")}
            className="w-full flex items-center justify-center gap-2 border border-black/10 rounded-md px-4 py-2.5 text-sm font-medium hover:bg-black/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.8 2.9 1.3 3.6 1 .1-.8.4-1.4.8-1.7-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.3-3.2-.2-.3-.6-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
            {verb} GitHub
          </a>
        )}
        {enabled.find((p) => p.id === "google") && (
          <a
            href={api.oauthStartUrl("google")}
            className="w-full flex items-center justify-center gap-2 border border-black/10 rounded-md px-4 py-2.5 text-sm font-medium hover:bg-black/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            {verb} Google
          </a>
        )}
      </div>
      <div className="flex items-center my-5 text-xs text-muted">
        <span className="flex-1 border-t border-black/10" />
        <span className="px-3">or with email</span>
        <span className="flex-1 border-t border-black/10" />
      </div>
    </>
  );
}
