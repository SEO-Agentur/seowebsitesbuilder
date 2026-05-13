"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const FIELD_TYPES = ["string", "text", "int", "float", "bool", "timestamp", "uuid", "json"] as const;
type FieldType = typeof FIELD_TYPES[number];

interface Field {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  default?: string;
}

interface Model {
  name: string;
  fields: Field[];
}

interface Props {
  projectId: string;
  backend: string;
}

export function ModelsPanel({ projectId, backend }: Props) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    api.listModels(projectId)
      .then((r) => { setModels(r.models || []); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [projectId]);

  if (backend === "none") {
    return (
      <div className="p-4 text-sm text-muted">
        This project doesn&apos;t have a backend. Schema models are only used by the Supabase, Postgres, and Go backends. Recreate the project with a backend choice to use this panel.
      </div>
    );
  }

  function addModel() {
    setModels([...models, { name: "NewModel", fields: [{ name: "title", type: "string", required: true }] }]);
  }

  function updateModel(idx: number, patch: Partial<Model>) {
    setModels(models.map((m, i) => i === idx ? { ...m, ...patch } : m));
  }

  function removeModel(idx: number) {
    setModels(models.filter((_, i) => i !== idx));
  }

  function addField(mi: number) {
    const m = models[mi];
    updateModel(mi, { fields: [...m.fields, { name: "field", type: "string" }] });
  }

  function updateField(mi: number, fi: number, patch: Partial<Field>) {
    const m = models[mi];
    updateModel(mi, { fields: m.fields.map((f, i) => i === fi ? { ...f, ...patch } : f) });
  }

  function removeField(mi: number, fi: number) {
    const m = models[mi];
    updateModel(mi, { fields: m.fields.filter((_, i) => i !== fi) });
  }

  async function save(forceOverwrite = false) {
    setSaving(true); setErr(null); setInfo(null);
    try {
      const r = await api.saveModels(projectId, models, forceOverwrite);
      setInfo(`Saved. ${r.generatedFiles.written} files written, ${r.generatedFiles.skipped} skipped (already exist).`);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-4 text-sm text-muted">Loading…</div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b border-black/5">
        <div className="text-xs uppercase tracking-wider text-muted mb-2">Backend: {backend}</div>
        <p className="text-xs text-muted leading-relaxed">
          Define models here. Each model becomes a table in your database, plus typed handlers / repositories in your project code.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {models.length === 0 && (
          <p className="text-sm text-muted text-center py-8">No models yet. Add one below.</p>
        )}

        {models.map((m, mi) => (
          <article key={mi} className="border border-black/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <input
                value={m.name}
                onChange={(e) => updateModel(mi, { name: e.target.value })}
                className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-black/10 focus:border-accent outline-none flex-1"
                placeholder="ModelName"
              />
              <button onClick={() => removeModel(mi)} className="text-xs text-muted hover:text-red-600">remove</button>
            </div>

            <table className="w-full text-xs">
              <thead><tr className="text-muted">
                <th className="text-left font-normal pb-1">Name</th>
                <th className="text-left font-normal pb-1">Type</th>
                <th className="font-normal pb-1">Req</th>
                <th className="font-normal pb-1">Uniq</th>
                <th />
              </tr></thead>
              <tbody>
                {m.fields.map((f, fi) => (
                  <tr key={fi}>
                    <td><input value={f.name} onChange={(e) => updateField(mi, fi, { name: e.target.value })} className="w-full bg-transparent border-b border-black/5 focus:border-accent outline-none py-0.5 font-mono" /></td>
                    <td><select value={f.type} onChange={(e) => updateField(mi, fi, { type: e.target.value as FieldType })} className="bg-transparent border-b border-black/5 focus:border-accent outline-none py-0.5">
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select></td>
                    <td className="text-center"><input type="checkbox" checked={!!f.required} onChange={(e) => updateField(mi, fi, { required: e.target.checked })} /></td>
                    <td className="text-center"><input type="checkbox" checked={!!f.unique} onChange={(e) => updateField(mi, fi, { unique: e.target.checked })} /></td>
                    <td className="text-right"><button onClick={() => removeField(mi, fi)} className="text-muted hover:text-red-600">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => addField(mi)} className="text-xs text-accent mt-2 hover:underline">+ add field</button>
          </article>
        ))}

        <button onClick={addModel} className="w-full text-sm border border-dashed border-black/15 rounded-lg py-3 text-muted hover:bg-black/5">
          + add model
        </button>

        {err && <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded">{err}</div>}
        {info && <div className="bg-green-50 text-green-800 text-xs px-3 py-2 rounded">{info}</div>}

        <div className="flex gap-2 pt-2 border-t border-black/5">
          <button onClick={() => save(false)} disabled={saving} className="bg-accent text-white text-sm px-4 py-2 rounded-md font-medium disabled:opacity-50 flex-1">
            {saving ? "Saving…" : "Save + generate"}
          </button>
          <button onClick={() => save(true)} disabled={saving} className="text-sm px-3 py-2 border border-black/10 rounded-md hover:bg-black/5" title="Force-overwrite any existing generated files">
            Force
          </button>
        </div>
      </div>
    </div>
  );
}
