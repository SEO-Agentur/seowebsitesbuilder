/** Mark a project as recently active. Fire-and-forget; never blocks the request. */

import { query } from "./db";

export function touch(projectId: string): void {
  query(
    "UPDATE projects SET last_request_at = now() WHERE id = $1",
    [projectId],
  ).catch((err) => {
    // Activity tracking is best-effort — don't crash the request path.
    console.warn("[activity] touch failed:", err?.message || err);
  });
}
