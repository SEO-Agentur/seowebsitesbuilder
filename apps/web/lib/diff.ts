/**
 * Minimal unified-diff applier. Sufficient for AI-generated patches against a
 * known source; not designed to handle fuzzy context matching or large drifts.
 *
 * Throws if the patch's context lines don't match the source at the indicated
 * positions — caller catches and surfaces the failure rather than corrupting
 * the file.
 */

export function applyUnifiedDiff(source: string, patch: string): string {
  const sourceLines = source.split("\n");
  const patchLines = patch.split("\n");

  const result: string[] = [];
  let sourceIdx = 0;
  let i = 0;

  // Skip optional file headers (--- a/foo, +++ b/foo).
  while (i < patchLines.length && !patchLines[i].startsWith("@@")) i++;

  while (i < patchLines.length) {
    const header = patchLines[i].match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!header) {
      i++;
      continue;
    }
    const hunkStart = parseInt(header[1], 10) - 1; // 0-indexed
    if (hunkStart < sourceIdx) {
      throw new Error(`Hunk targets line ${hunkStart + 1} but source cursor already past it`);
    }
    // Copy through unchanged lines up to the hunk.
    while (sourceIdx < hunkStart) result.push(sourceLines[sourceIdx++]);
    i++;

    // Process hunk body until the next hunk header or EOF.
    while (i < patchLines.length && !patchLines[i].startsWith("@@")) {
      const line = patchLines[i];
      // Allow patches that don't terminate every line with a leading space
      // by treating empty lines as unchanged context.
      const marker = line[0] ?? " ";
      const rest = line.slice(1);
      if (marker === " " || line === "") {
        // context — must match the source
        if (sourceLines[sourceIdx] !== rest && line !== "") {
          throw new Error(
            `Context mismatch at source line ${sourceIdx + 1}: expected "${rest}" got "${sourceLines[sourceIdx]}"`,
          );
        }
        result.push(sourceLines[sourceIdx++]);
      } else if (marker === "-") {
        if (sourceLines[sourceIdx] !== rest) {
          throw new Error(
            `Removed line mismatch at source line ${sourceIdx + 1}: expected "${rest}" got "${sourceLines[sourceIdx]}"`,
          );
        }
        sourceIdx++;
      } else if (marker === "+") {
        result.push(rest);
      } else if (marker === "\\") {
        // "\ No newline at end of file" — ignore
      } else {
        throw new Error(`Unrecognized patch line at position ${i}: "${line}"`);
      }
      i++;
    }
  }

  // Copy any remaining unchanged tail.
  while (sourceIdx < sourceLines.length) result.push(sourceLines[sourceIdx++]);
  return result.join("\n");
}
