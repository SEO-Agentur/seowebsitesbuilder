"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SUGGESTIONS = [
  "A landing page for my organic coffee roastery in Portland",
  "A portfolio site for a freelance illustrator with case studies",
  "A directory of local plumbers serving Phoenix metro",
  "A blog about indoor gardening with email signup",
];

export function HeroPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setBusy(true);
    // Stash the prompt — onboarding picks it up after signup completes.
    localStorage.setItem("seo_pending_prompt", trimmed);
    // Authed user? skip signup. Anon? sign up first.
    const hasToken = !!localStorage.getItem("seo_token");
    router.push(hasToken ? "/onboarding" : "/signup");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="bg-white border-2 border-black/10 rounded-2xl p-3 shadow-sm focus-within:border-accent transition">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe the site you want to build…"
          className="w-full px-3 py-2 outline-none resize-none text-base bg-transparent"
        />
        <div className="flex items-center justify-between gap-3 px-1 pt-2">
          <span className="text-xs text-muted">Stack pick comes next — focus on the idea.</span>
          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="bg-ink text-white px-5 py-2.5 rounded-lg font-medium hover:bg-black disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? "Loading…" : "Build it →"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span>Try:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt(s)}
            className="text-left text-accent hover:underline"
          >
            &ldquo;{s}&rdquo;
          </button>
        ))}
      </div>
    </form>
  );
}
