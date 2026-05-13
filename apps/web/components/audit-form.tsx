"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function AuditForm({ defaultUrl = "" }: { defaultUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    setBusy(true);
    try {
      const r = await api.auditUrl(normalized);
      router.push(`/audit/${r.id}`);
    } catch (e: any) {
      setErr(e?.message || "Audit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-black/10 rounded-xl p-3 flex flex-col sm:flex-row gap-3">
      <input
        type="text"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        className="flex-1 px-4 py-3 text-base outline-none border-0 bg-transparent"
        autoFocus
      />
      <button
        type="submit"
        disabled={busy || !url.trim()}
        className="bg-accent text-white font-medium px-6 py-3 rounded-lg disabled:opacity-50 whitespace-nowrap"
      >
        {busy ? "Auditing…" : "Audit URL"}
      </button>
      {err && (
        <div className="basis-full bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{err}</div>
      )}
    </form>
  );
}
