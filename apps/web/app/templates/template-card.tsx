"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { isAuthed } from "@/lib/auth";

interface Template {
  id: string;
  name: string;
  framework: "html" | "astro" | "nextjs" | "php";
  blurb: string;
  thumb: { bg: string; emoji: string };
}

/** Maps templateId → the backend it implies. Niche templates are all
 *  backend-less; frameworks default to "none" too (user picks a backend
 *  separately in the onboarding flow when they want one). */
function backendFor(_id: string): "none" | "supabase" | "postgres" | "go" {
  return "none";
}

export function TemplateCard({ t }: { t: Template }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go(e: React.MouseEvent) {
    // Public visitor — stash the choice for the onboarding step after
    // signup, then let the <Link> fallback fire (href below).
    if (!isAuthed()) {
      if (typeof window !== "undefined") {
        localStorage.setItem("seo_pending_template", t.id);
      }
      return;
    }
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { project } = await api.createProject(t.name, t.framework, backendFor(t.id), t.id);
      router.push(`/editor/${project.id}`);
    } catch (err: any) {
      // Most likely: 402 Free-plan project limit. Send them to billing.
      const msg = String(err?.message || "");
      if (/Free plan|402|limit/i.test(msg)) {
        router.push("/billing?from=template");
      } else {
        alert(`Couldn't create project: ${msg}`);
        setBusy(false);
      }
    }
  }

  return (
    <Link
      href={`/signup?template=${t.id}`}
      onClick={go}
      className={`block bg-white border border-black/5 rounded-xl overflow-hidden hover:border-accent/30 hover:shadow-sm transition group ${busy ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div
        className="aspect-[5/3] grid place-items-center text-5xl"
        style={{ background: t.thumb.bg, color: t.thumb.bg === "#fafafa" ? "#0a0a0a" : "white" }}
        aria-hidden="true"
      >
        {t.thumb.emoji}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="font-semibold text-sm">{t.name}</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted">{t.framework}</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">{t.blurb}</p>
        {busy && <p className="text-xs text-accent mt-2">Creating project…</p>}
      </div>
    </Link>
  );
}
