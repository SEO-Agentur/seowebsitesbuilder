/**
 * In-memory terminal scrollback per project. The WS endpoint streams a replay
 * on connect so reconnecting users see what happened before. Buffers are
 * cleared when the project's container stops or is removed.
 *
 * Capped per-project to keep memory bounded; total memory ≈ projects × BUFFER_LIMIT × avg_line.
 */

const BUFFER_LIMIT_BYTES = 64 * 1024; // 64 KiB per project — fits a screenful of typical dev-server log spam

const buffers = new Map<string, string>();

export function append(projectId: string, chunk: string): void {
  const cur = buffers.get(projectId) || "";
  const next = cur + chunk;
  // Trim from the front when over the byte limit. Trim aggressively in larger
  // chunks (rather than per-character) to keep this cheap.
  if (next.length > BUFFER_LIMIT_BYTES) {
    buffers.set(projectId, next.slice(next.length - BUFFER_LIMIT_BYTES));
  } else {
    buffers.set(projectId, next);
  }
}

export function replay(projectId: string): string {
  return buffers.get(projectId) || "";
}

export function clear(projectId: string): void {
  buffers.delete(projectId);
}
