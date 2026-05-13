"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isAuthed } from "@/lib/auth";

interface StackOption {
  id: string;                                // template id
  framework: "html" | "astro" | "nextjs" | "php";
  backend: "none" | "supabase" | "postgres" | "go";
  label: string;
  blurb: string;
  emoji: string;
}

const STACKS: StackOption[] = [
  { id: "html",   framework: "html",   backend: "none",     label: "Static HTML",         blurb: "Fastest. Pure semantic HTML, zero JS. Best for landing pages, blogs, brochure sites.", emoji: "📄" },
  { id: "astro",  framework: "astro",  backend: "none",     label: "Astro",               blurb: "Static-first with optional islands. Great for content-heavy sites and small blogs.",     emoji: "🚀" },
  { id: "nextjs", framework: "nextjs", backend: "none",     label: "Next.js (static)",    blurb: "React components, static-export. For richer UIs that don't need a database.",         emoji: "▲" },
  { id: "nextjs", framework: "nextjs", backend: "postgres", label: "Next.js + Postgres",  blurb: "Full-stack — your own Postgres, generated repo code, ready for auth + data.",         emoji: "🗄️" },
  { id: "html-lawyer",     framework: "html", backend: "none", label: "Lawyer template",     blurb: "Pre-loaded with LegalService schema, practice areas, and free-consultation CTA.", emoji: "⚖️" },
  { id: "html-plumber",    framework: "html", backend: "none", label: "Plumber template",    blurb: "24/7 emergency banner, Plumber schema, service-area block.",                      emoji: "🔧" },
  { id: "html-dentist",    framework: "html", backend: "none", label: "Dentist template",    blurb: "Family-dental template with Dentist schema, hours, transparent pricing.",        emoji: "🦷" },
  { id: "html-restaurant", framework: "html", backend: "none", label: "Restaurant template", blurb: "Wood-fired Italian sample with Restaurant schema, full menu, reservations.",     emoji: "🍝" },
];

/**
 * Smart default: pick the most-fitting stack from the prompt. Falls back to
 * "Static HTML" when nothing matches.
 */
function pickDefault(prompt: string): StackOption {
  const p = prompt.toLowerCase();
  // Niche templates first — most specific.
  if (/(law\s?firm|lawyer|attorney|legal)/.test(p)) return STACKS.find((s) => s.id === "html-lawyer")!;
  if (/(plumb|hvac|electrician|handyman|24\/?7\s*emergency)/.test(p)) return STACKS.find((s) => s.id === "html-plumber")!;
  if (/(dentist|dental|orthodont)/.test(p)) return STACKS.find((s) => s.id === "html-dentist")!;
  if (/(restaurant|cafe|coffee|bar|menu|reservation)/.test(p)) return STACKS.find((s) => s.id === "html-restaurant")!;
  // Backend hints
  if (/(saas|dashboard|database|auth|login|users|crud|marketplace|admin)/.test(p)) return STACKS.find((s) => s.framework === "nextjs" && s.backend === "postgres")!;
  // App-y
  if (/(app|react|interactive|component|spa)/.test(p)) return STACKS.find((s) => s.framework === "nextjs" && s.backend === "none")!;
  // Content-y
  if (/(blog|docs|mdx|content|articles?)/.test(p)) return STACKS.find((s) => s.framework === "astro")!;
  return STACKS.find((s) => s.id === "html")!;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<string>("");
  const [picked, setPicked] = useState<StackOption | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthed()) { router.replace("/signup"); return; }
    const p = (typeof window !== "undefined" ? localStorage.getItem("seo_pending_prompt") : null) || "";
    setPrompt(p);
    if (p) {
      setPicked(pickDefault(p));
      // Default name = first 60 chars of the prompt.
      const first = p.split("\n")[0]!.trim();
      setName(first.length > 60 ? first.slice(0, 57) + "…" : first);
    } else {
      setPicked(STACKS[0]);
      setName("My SEO site");
    }
  }, [router]);

  const recommended = useMemo(() => (prompt ? pickDefault(prompt) : STACKS[0]), [prompt]);

  async function submit() {
    if (!picked) return;
    setBusy(true); setErr(null);
    try {
      const { project } = await api.createProject(name || "My SEO site", picked.framework, picked.backend, picked.id);
      // Hand the prompt off to the editor — it'll pre-fill the chat panel.
      if (prompt) {
        localStorage.setItem(`seo_pending_prompt_${project.id}`, prompt);
        localStorage.removeItem("seo_pending_prompt");
      }
      router.push(`/editor/${project.id}`);
    } catch (e: any) {
      setErr(e?.message || "Couldn't create project");
      setBusy(false);
    }
  }

  function skipPrompt() {
    localStorage.removeItem("seo_pending_prompt");
    router.push("/dashboard");
  }

  if (!picked) return <div className="min-h-screen grid place-items-center text-muted">Loading…</div>;

  return (
    <main className="min-h-screen bg-[#fafafa]">
      <header className="bg-white border-b border-black/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="font-semibold tracking-tight text-lg">Seowebsitesbuilder</Link>
          <button onClick={skipPrompt} className="ml-auto text-sm text-muted hover:text-ink">Skip → empty dashboard</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-accent text-sm font-medium tracking-wide mb-3">STEP 2 OF 2 · PICK A STACK</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">Almost there.</h1>

        {prompt ? (
          <div className="bg-white border border-black/10 rounded-xl p-4 mb-8">
            <div className="text-xs uppercase tracking-wider text-muted mb-1">Your prompt</div>
            <p className="text-sm leading-relaxed">&ldquo;{prompt}&rdquo;</p>
            <p className="text-xs text-muted mt-3">
              Recommended: <strong className="text-ink">{recommended.label}</strong>. Pick anything else if you have a preference — you can switch later.
            </p>
          </div>
        ) : (
          <p className="text-muted mb-8">No prompt yet. Pick a stack and we&apos;ll scaffold a starter you can edit.</p>
        )}

        <label className="block mb-6">
          <span className="text-sm font-medium">Project name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full max-w-md px-3 py-2 border border-black/10 rounded-md outline-none focus:border-accent"
            placeholder="My SEO site"
          />
        </label>

        <h2 className="text-sm uppercase tracking-wider text-muted mb-3 font-medium">Choose a stack</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          {STACKS.map((s) => {
            const isPicked = picked.id === s.id && picked.framework === s.framework && picked.backend === s.backend;
            const isRecommended = recommended.id === s.id && recommended.framework === s.framework && recommended.backend === s.backend;
            return (
              <button
                key={s.id + s.framework + s.backend}
                onClick={() => setPicked(s)}
                type="button"
                className={`text-left border rounded-xl p-4 ${isPicked ? "border-accent bg-accent/5" : "border-black/10 hover:border-black/20 bg-white"} relative`}
              >
                {isRecommended && (
                  <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
                    Recommended
                  </span>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <span aria-hidden="true">{s.emoji}</span>
                  <span className="font-medium text-sm">{s.label}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{s.blurb}</p>
              </button>
            );
          })}
        </div>

        {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded mb-4">{err}</div>}

        <div className="flex gap-3">
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="bg-ink text-white px-6 py-3 rounded-lg font-medium hover:bg-black disabled:opacity-50"
          >
            {busy ? "Scaffolding…" : "Build it →"}
          </button>
          <button onClick={skipPrompt} className="px-6 py-3 rounded-lg font-medium border border-black/10 hover:bg-black/5">
            Cancel
          </button>
        </div>
      </div>
    </main>
  );
}
