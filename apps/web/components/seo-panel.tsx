"use client";

import { useEffect, useState } from "react";
import { score, PUBLISH_MIN_SCORE, type SeoReport } from "@seo/seo-engine";
import { api } from "@/lib/api";

interface Props {
  html: string;
  projectId?: string;
}

export function SeoPanel({ html, projectId }: Props) {
  const [report, setReport] = useState<SeoReport | null>(null);
  const [prodReport, setProdReport] = useState<{ report: SeoReport; outputPath: string; buildLog?: string } | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditErr, setAuditErr] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgResult, setImgResult] = useState<{ processed: number; totalSaved: number } | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      try { setReport(score(html)); } catch { setReport(null); }
    }, 300);
    return () => clearTimeout(handle);
  }, [html]);

  async function runAudit() {
    if (!projectId) return;
    setAuditBusy(true); setAuditErr(null);
    try {
      const r = await api.auditBuild(projectId);
      setProdReport({ report: r.report as SeoReport, outputPath: r.outputPath, buildLog: r.buildLog });
    } catch (e: any) {
      setAuditErr(e.message);
    } finally { setAuditBusy(false); }
  }

  async function optimize() {
    if (!projectId) return;
    setImgBusy(true); setImgErr(null); setImgResult(null);
    try {
      const r = await api.optimizeImages(projectId);
      setImgResult({ processed: r.processed, totalSaved: r.totalSaved });
    } catch (e: any) {
      setImgErr(e.message);
    } finally { setImgBusy(false); }
  }

  if (!report) return <div className="p-4 text-sm text-muted">Scoring…</div>;

  const color =
    report.score >= 90 ? "text-green-600" :
    report.score >= 70 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="p-4 text-sm">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-muted mb-1">Live preview</div>
        <div className={`text-4xl font-semibold ${color}`}>{report.score}</div>
        <div className="text-xs text-muted">
          {report.score >= PUBLISH_MIN_SCORE ? "Ready to publish" : `Needs ${PUBLISH_MIN_SCORE - report.score} more to publish`}
        </div>
      </div>

      {projectId && (
        <div className="mb-5 space-y-2">
          <button
            onClick={runAudit}
            disabled={auditBusy}
            className="w-full text-xs px-3 py-2 border border-black/10 rounded hover:bg-black/5 disabled:opacity-50"
          >
            {auditBusy ? "Building & scoring…" : "Audit production build"}
          </button>
          {auditErr && <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">{auditErr}</div>}
          {prodReport && (
            <div className="border-l-2 border-accent pl-3 py-1">
              <div className="text-xs uppercase tracking-wider text-muted">Production build score</div>
              <div className={`text-2xl font-semibold ${prodReport.report.score >= 90 ? "text-green-600" : prodReport.report.score >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                {prodReport.report.score}
              </div>
              <div className="text-[10px] text-muted font-mono">{prodReport.outputPath}</div>
            </div>
          )}
          <button
            onClick={optimize}
            disabled={imgBusy}
            className="w-full text-xs px-3 py-2 border border-black/10 rounded hover:bg-black/5 disabled:opacity-50"
          >
            {imgBusy ? "Optimizing images…" : "Optimize images (→ WebP)"}
          </button>
          {imgErr && <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">{imgErr}</div>}
          {imgResult && (
            <div className="text-xs text-green-800 bg-green-50 rounded px-2 py-1">
              {imgResult.processed === 0
                ? "No PNG/JPG images found."
                : `${imgResult.processed} images → WebP, saved ${(imgResult.totalSaved / 1024).toFixed(1)} KB. Originals preserved.`}
            </div>
          )}
        </div>
      )}

      <h4 className="font-medium mb-2 text-xs uppercase tracking-wider text-muted">Checks (live)</h4>
      <ul className="space-y-1.5">
        {report.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span className={`mt-1 inline-block w-2 h-2 rounded-full flex-shrink-0 ${c.passed ? "bg-green-500" : "bg-red-500"}`} />
            <div className="flex-1">
              <div className={c.passed ? "text-ink" : "text-ink font-medium"}>{c.label}</div>
              {c.detail && <div className="text-xs text-muted">{c.detail}</div>}
            </div>
            <span className="text-xs text-muted">{c.passed ? "+" : "−"}{c.weight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
