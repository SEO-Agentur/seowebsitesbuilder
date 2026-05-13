"use client";

import { useEffect, useRef, useState } from "react";
import { terminalWsUrl } from "@/lib/api";

interface Props {
  projectId: string;
  /** When false, the terminal renders a hint instead of attempting a WS connection. */
  containerRunning: boolean;
}

export function Terminal({ projectId, containerRunning }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRunning) return;
    if (!hostRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const [{ Terminal: Xterm }, { FitAddon }] = await Promise.all([
          import("xterm"),
          import("xterm-addon-fit"),
        ]);
        if (disposed) return;
        // xterm injects its own stylesheet via the consumer; load it once.
        if (typeof document !== "undefined" && !document.getElementById("xterm-style")) {
          const link = document.createElement("link");
          link.id = "xterm-style";
          link.rel = "stylesheet";
          link.href = "https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css";
          document.head.appendChild(link);
        }

        const term = new Xterm({
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: 12,
          theme: {
            background: "#0a0a0a",
            foreground: "#e5e7eb",
            cursor: "#2563eb",
            selectionBackground: "#1d4ed8",
          },
          cursorBlink: true,
          convertEol: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current!);
        fit.fit();

        xtermRef.current = term;
        fitRef.current = fit;

        const ws = new WebSocket(terminalWsUrl(projectId));
        wsRef.current = ws;
        ws.onopen = () => term.write("\x1b[2m[connected]\x1b[0m\r\n");
        ws.onmessage = (ev) => term.write(typeof ev.data === "string" ? ev.data : "");
        ws.onerror = () => setError("Connection error. Is the container running?");
        ws.onclose = () => term.write("\r\n\x1b[2m[disconnected]\x1b[0m\r\n");

        term.onData((d) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(d);
        });

        const onResize = () => fit.fit();
        window.addEventListener("resize", onResize);

        return () => {
          window.removeEventListener("resize", onResize);
        };
      } catch (e: any) {
        setError(String(e?.message || e));
      }
    })();

    return () => {
      disposed = true;
      try { wsRef.current?.close(); } catch { /* ignore */ }
      try { xtermRef.current?.dispose(); } catch { /* ignore */ }
      wsRef.current = null;
      xtermRef.current = null;
    };
  }, [projectId, containerRunning]);

  if (!containerRunning) {
    return (
      <div className="h-full grid place-items-center bg-[#0a0a0a] text-gray-400 text-xs px-4 text-center">
        Start the preview container to open a shell.
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0a0a0a] relative">
      <div ref={hostRef} className="h-full w-full" />
      {error && (
        <div className="absolute top-2 right-2 bg-red-900/90 text-red-100 text-xs px-2 py-1 rounded">{error}</div>
      )}
    </div>
  );
}
