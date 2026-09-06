/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { sortByDependencies, rebuildArrows } from "./sortKernels.js";
import { Line } from "./uml/line.js";

/**
 * Sort lines by their dependency order and optionally rebuild arrow directions.
 *
 * Replaces the old two-class adapter layer (SortComponent / SortSequence)
 * with a single functional entry point.
 *
 * @param lines  The arrow lines to sort (mutated in place).
 * @param rebuild  If true, reset all directions to defaults, then
 *                 redistribute multi-outgoing arrows.
 * @returns The same array reference (sorted in place).
 */
export function formatLines(lines: Line[], rebuild = false): Line[] {
  if (lines.length === 0) return lines;

  // 1. Set default directions (always done in the original flow).
  for (const line of lines) {
    line.setDefaultDirection(rebuild);
  }

  if (lines.length > 1) {
    // 2. Compute topological node order.
    const nodeOrder = sortByDependencies(
      lines.map((l) => ({ from: l.from(), to: l.to() }))
    );

    // 3. Initial sort by (from-node index, direction, to-node index).
    const initialSorted = [...lines].sort((a, b) => {
      const aFrom = nodeOrder.indexOf(a.from());
      const bFrom = nodeOrder.indexOf(b.from());
      if (aFrom !== bFrom) return aFrom - bFrom;

      const dirCmp = a.combinedDirection() - b.combinedDirection();
      if (dirCmp !== 0) return dirCmp;

      return nodeOrder.indexOf(a.to()) - nodeOrder.indexOf(b.to());
    });

    // 4. Greedy connect-components grouping replacing the old
    //    _moveOrigToSorted mutation loop — preserves the grouping
    //    property where lines sharing component references are placed
    //    adjacent to an already-placed line that shares a component.
    const sorted: Line[] = [];
    const remaining = [...initialSorted];
    let idx = 0;

    while (remaining.length > 0) {
      if (idx === sorted.length) {
        sorted.push(remaining.shift()!);
      }
      const currentLine = sorted[idx]!;
      for (let oidx = 0; oidx < remaining.length; ++oidx) {
        const origLine = remaining[oidx]!;
        if (
          currentLine.components.some(
            (c) => c != null && origLine.has(c)
          )
        ) {
          sorted.push(...remaining.splice(oidx, 1));
          --oidx;
        }
      }
      idx++;
    }

    // 5. Copy sorted order back into the original array.
    lines.length = 0;
    lines.push(...sorted);

    // 6. Rebuild arrow directions (redistribute multi-outgoing arrows).
    if (rebuild) {
      const plainLines = lines.map((l) => ({
        from: l.from(),
        to: l.to(),
        direction: l.combinedDirection(),
      }));
      const result = rebuildArrows(plainLines);
      for (let i = 0; i < lines.length; i++) {
        const targetDir = result[i]!.direction;
        while (Number(lines[i]!.combinedDirection()) !== targetDir) {
          lines[i]!.rotateRight();
        }
      }
    }
  }

  return lines;
}
