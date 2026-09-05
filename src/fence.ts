/**
 * Shared fence-detection utilities for PlantUML fenced code blocks.
 *
 * Extracted from completion.ts and cliFormat.ts so that the fence-open regex,
 * info-string set, and scanning logic live in one place.
 */

/** Fence info strings that mark a code block as PlantUML. */
export const PLANTUML_FENCE_INFOS: ReadonlySet<string> = new Set([
  "plantuml",
  "puml",
]);

/** Regex matching a potential markdown fence line. */
export const FENCE_OPEN_RE = /^\s*(`{3,}|~{3,})\s*(\S*)\s*$/;

/**
 * Determines whether the given line sits inside a ```plantuml / ```puml
 * fenced code block. The fence lines themselves are not considered "inside".
 *
 * @param lines     All lines of the document.
 * @param lineIndex The zero-based line to test.
 */
export function isInsidePlantumlFence(
  lines: string[],
  lineIndex: number
): boolean {
  let insidePlantuml = false;
  let fence: string | undefined;

  for (let i = 0; i <= lineIndex; i++) {
    /* v8 ignore next @preserve - i never exceeds the line count in practice */
    const line = lines[i] ?? "";
    if (fence === undefined) {
      const open = FENCE_OPEN_RE.exec(line);
      if (open !== null) {
        // An opening fence marker is markdown, not diagram content.
        if (i === lineIndex) {
          return false;
        }
        // Both capture groups always match when `open` is non-null.
        fence = open[1];
        /* v8 ignore next @preserve - the info capture group always matches */
        const info = (open[2] ?? "").toLowerCase();
        insidePlantuml = PLANTUML_FENCE_INFOS.has(info);
      }
    } else {
      // Inside a block - look for the matching closing fence (same character,
      // at least the same length).
      const fenceChar = fence.charAt(0);
      const trimmed = line.trim();
      const isClose =
        trimmed.length >= fence.length &&
        trimmed.split("").every((c) => c === fenceChar);
      if (isClose) {
        // A closing fence marker is markdown, not diagram content.
        if (i === lineIndex) {
          return false;
        }
        fence = undefined;
        insidePlantuml = false;
      } else if (i === lineIndex) {
        return insidePlantuml;
      }
    }
  }

  // Reachable only when the loop fell through the last line without matching or
  // closing a fence, i.e. the cursor line is not inside any block.
  return false;
}

/**
 * Finds the closing fence for an opening fence that starts at `fence`.
 *
 * @param lines All lines of the document.
 * @param from  The zero-based index to start searching from (the line after
 *              the opening fence).
 * @param fence The opening fence string (e.g. "```" or "~~~").
 * @returns The index of the closing fence line, or -1 if not found.
 */
export function findClosingFence(
  lines: string[],
  from: number,
  fence: string
): number {
  const fenceChar = fence.charAt(0);
  for (let i = from; i < lines.length; i++) {
    /* v8 ignore next @preserve - lines[i] is always defined for i < length */
    const trimmed = (lines[i] ?? "").trim();
    if (
      trimmed.length >= fence.length &&
      trimmed.split("").every((c) => c === fenceChar)
    ) {
      return i;
    }
  }
  return -1;
}
