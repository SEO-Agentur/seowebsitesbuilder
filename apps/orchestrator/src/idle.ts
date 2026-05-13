/**
 * Idle-container sweeper. Every CHECK_INTERVAL_MS, looks for projects whose
 * container has been running but unused for longer than IDLE_THRESHOLD, and
 * shuts them down. A 7.8 GB VPS can only host ~8 concurrent 512 MB containers
 * — without this, every user who clicks Start and walks away permanently
 * pins one.
 *
 * Activity is signaled by `touch(projectId)` in [activity.ts] from the preview
 * proxy and the WebSocket terminal upgrade.
 */

import { query } from "./db";
import { stopContainer } from "./docker";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const IDLE_THRESHOLD_MIN = parseInt(process.env.IDLE_THRESHOLD_MIN || "15", 10);

interface IdleRow {
  id: string;
  container_id: string;
}

async function sweep(): Promise<void> {
  let rows: IdleRow[];
  try {
    rows = await query<IdleRow>(
      `SELECT id, container_id
         FROM projects
        WHERE status = 'running'
          AND container_id IS NOT NULL
          AND last_request_at < now() - ($1 || ' minutes')::interval`,
      [String(IDLE_THRESHOLD_MIN)],
    );
  } catch (err: any) {
    console.error("[idle] sweep query failed:", err?.message || err);
    return;
  }

  for (const r of rows) {
    try {
      console.log(`[idle] stopping container ${r.container_id.slice(0, 12)} (project ${r.id}) — idle > ${IDLE_THRESHOLD_MIN}min`);
      await stopContainer(r.container_id);
      await query(
        "UPDATE projects SET status='stopped', container_id=NULL, preview_port=NULL WHERE id = $1",
        [r.id],
      );
    } catch (err: any) {
      console.error(`[idle] failed to stop project ${r.id}:`, err?.message || err);
    }
  }
}

export function startIdleStopper(): void {
  console.log(`[idle] stopper started — check every ${CHECK_INTERVAL_MS / 60000}min, threshold ${IDLE_THRESHOLD_MIN}min`);
  // Run once at boot so containers leftover from a crash don't linger forever,
  // then on the interval.
  sweep();
  setInterval(sweep, CHECK_INTERVAL_MS);
}
