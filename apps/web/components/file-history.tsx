"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface Props {
  projectId: string;
  activePath: string | null;
  onRestored: (content: string) => void;
}

export function FileHistory({ projectId, activePath, onRestored }: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<{ id: string; saved_at: string; preview: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function toggle() {
    if (!activePath) return;
    if (!open) {
      setOpen(true);
      setBusy(true);
      try {
        const r = await api.fileHistory(projectId, activePath);
        setVersions(r.versions);
      } catch {
        setVersions([]);
      } finally { setBusy(false); }
    } else {
      setOpen(false);
    }
  }

  async function restore(vid: string) {
    if (!activePath) return;
    setBusy(true);
    try {
      const r = await api.restoreFileVersion(projectId, activePath, vid);
      onRestored(r.content);
      setOpen(false);
    } finally { setBusy(false); }
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={toggle}
        disabled={!activePath}
        title={activePath ? `History for ${activePath}` : "Open a file to see history"}
        className="text-sm px-3 py-1.5 border border-black/10 rounded-md hover:bg-black/5 disabled:opacity-40"
      >
        History
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-black/10 rounded-md shadow-lg z-20 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted border-b border-black/5">
            Versions of <span className="font-mono normal-case">{activePath}</span>
          </div>
          {busy && <div className="px-3 py-3 text-xs text-muted">Loading…</div>}
          {!busy && versions && versions.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted">No prior versions yet. Versions are saved each time you edit and save.</div>
          )}
          {!busy && versions && versions.map((v) => (
            <button
              key={v.id}
              onClick={() => restore(v.id)}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-black/5 border-b border-black/5 last:border-b-0"
            >
              <div className="text-ink font-medium">{new Date(v.saved_at).toLocaleString()}</div>
              <div className="text-muted font-mono truncate mt-0.5">{v.preview}…</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
