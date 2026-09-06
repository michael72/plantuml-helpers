// ----------------------------------------------------------------
// Algorithmic kernels extracted from SortComponent and SortSequence.
// Pure functions operating on plain data — no Component/Line objects.
// ----------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-non-null-assertion */

// ---- sortcomponent kernels ----

/**
 * Topological sort: order node names so that dependencies come before dependents.
 * @param lines Pairs of (from → to) representing arrow connections.
 * @returns Ordered array of node names (sources first, sinks last).
 *
 * Uses pointed counts and transitive dependency propagation:
 * - Nodes with fewer incoming edges sort first.
 * - Among equal, nodes with more outgoing transitive edges sort last.
 * - Among equal, original order is preserved.
 */
export function sortByDependencies(
  lines: Array<{ from: string; to: string }>
): string[] {
  const deps = new Map<string, string[]>();
  const froms: string[] = [];
  const fromSet = new Set<string>();

  for (const { from, to } of lines) {
    if (!deps.has(from)) {
      deps.set(from, []);
    }
    deps.get(from)!.push(to);
    fromSet.add(from);
  }
  froms.push(...fromSet);

  // pointed counts with transitive dependencies
  const pointedCounts = new Map<string, number>();
  for (const [k, v] of deps) {
    pointedCounts.set(k, 0);
    _addTransitiveDeps(deps, v);
  }
  for (const v of deps.values()) {
    for (const d of v) {
      pointedCounts.set(d, (pointedCounts.get(d) ?? 0) + 1);
    }
  }

  return Array.from(deps.keys()).sort((s1: string, s2: string) => {
    let cmp = pointedCounts.get(s1)! - pointedCounts.get(s2)!;
    if (cmp === 0) {
      cmp = deps.get(s2)!.length - deps.get(s1)!.length;
      if (cmp === 0) {
        cmp = froms.indexOf(s1) - froms.indexOf(s2);
      }
    }
    return cmp;
  });
}

function _addTransitiveDeps(
  deps: Map<string, string[]>,
  savedDeps: string[]
): void {
  let addedDeps = savedDeps;
  while (addedDeps.length !== 0) {
    addedDeps = addedDeps.flatMap((c) =>
      Array.from(_itemDeps(deps.get(c), savedDeps))
    );
  }
}

function* _itemDeps(
  dependentComponents: string[] | undefined,
  savedDeps: string[]
): Generator<string> {
  if (dependentComponents) {
    for (const d of dependentComponents) {
      if (!savedDeps.includes(d)) {
        savedDeps.push(d);
        yield d;
      }
    }
  }
}

/**
 * Arrow redistribution when 3+ arrows go out from the same node.
 * Rotates arrows left/right to minimise visual overlap.
 *
 * @param lines Arrow connections with current {@link CombinedDirection} value (0=Right, 1=Down, 2=Left, 3=Up).
 * @returns Same list with modified direction values.
 */
export function rebuildArrows(
  lines: Array<{ from: string; to: string; direction: number }>
): Array<{ from: string; to: string; direction: number }> {
  // Work on a shallow copy that we mutate in place
  const result: Array<{ from: string; to: string; direction: number }> =
    lines.map((l) => ({ ...l }));

  // Identify groups of consecutive same-from same-direction lines
  // and apply rotations per group.
  let groupStart = 0;
  while (groupStart < result.length) {
    const { from, direction } = result[groupStart]!;
    let groupEnd = groupStart + 1;
    while (
      groupEnd < result.length &&
      result[groupEnd]!.from === from &&
      result[groupEnd]!.direction === direction
    ) {
      groupEnd++;
    }

    const cnt = groupEnd - groupStart;

    if (cnt === 2) {
      // special case: only 2 same arrows going out:
      // rotate the first to right
      result[groupStart]!.direction = _rotateRight(
        result[groupStart]!.direction
      );
    } else if (cnt >= 3) {
      // leave the last arrows in the same direction
      // rotate the first ones to the left
      // rotate the in-between arrows to the right
      // <- ... | -> ... | ^ ...
      // rotate more when in horizontal layout: vertical arrows can also be drawn diagonally
      const isHorizontal = direction === 0 || direction === 2; // Right or Left
      let c = Math.floor((cnt - (cnt % 3)) / 3);
      if (isHorizontal && cnt % 3 === 2) {
        c += 1;
      }
      let idx = groupStart;
      let end = idx + c;
      for (; idx < end; ++idx) {
        result[idx]!.direction = _rotateLeft(result[idx]!.direction);
      }
      end += c;
      if (isHorizontal && cnt % 3 === 1) {
        end += 1;
      }
      for (; idx < end; ++idx) {
        result[idx]!.direction = _rotateRight(result[idx]!.direction);
      }
    }

    groupStart = groupEnd;
  }

  return result;
}

function _rotateRight(dir: number): number {
  return (dir + 1) % 4;
}

function _rotateLeft(dir: number): number {
  return (dir + 3) % 4;
}

// ---- sortsequence kernels ----

/**
 * Cost function for a given participant order.
 * Sum of `(position_difference * weight)^2` for each connection.
 * Lower is better — zero means all arrows go left-to-right with no distance penalty.
 */
export function calculateWeight(
  components: string[],
  weights: Array<[string, string, number]>
): number {
  let sum = 0;
  const square = (a: number): number => a * a;
  for (const [l, r, num] of weights) {
    sum += square((components.indexOf(l) - components.indexOf(r)) * num);
  }
  return sum;
}

/**
 * Direction penalty — count of arrows pointing right-to-left (weighted by count).
 */
function _calculateDirCount(
  components: string[],
  weights: Array<[string, string, number]>
): number {
  let sum = 0;
  for (const [l, r, num] of weights) {
    const dist = components.indexOf(l) - components.indexOf(r);
    if (dist > 0) {
      sum += num;
    }
  }
  return sum;
}

/**
 * Permutation minimizer for sequence diagram participant order.
 *
 * For <9 elements: uses Heap's algorithm to find the optimal permutation.
 * For >=9 elements: uses a greedy heuristic (rotations).
 *
 * @param names Full participant name array (may include `[`/`]` sentinels).
 * @param weights Connection weights as (left, right, count) tuples.
 * @returns Ordered participant names (including sentinels if they were present).
 */
export function orderNames(
  names: string[],
  weights: Array<[string, string, number]>
): string[] {
  let offLeft = names[0] === "[" ? 1 : 0;
  while (
    offLeft !== 0 &&
    weights.filter((w) => w[0] === "[" && w[1] === names[offLeft]).length > 0
  ) {
    offLeft += 1;
  }
  const offRight = names[names.length - 1] === "]" ? 1 : 0;

  let numElems = names.length - offLeft - offRight;

  // For >= 9 elements we filter "simple connections" (nodes with only one connection)
  // The original _orderNames did this by mutating names via _filterSimpleConnections
  let filtered: string[] = [];
  const workingNames = [...names];

  if (numElems >= 9) {
    // We need depCount to filter simple connections — build from weights
    const depCount = new Map<string, number>();
    for (const [l, r, num] of weights) {
      const key = l + "," + r;
      depCount.set(key, (depCount.get(key) ?? 0) + num);
    }
    filtered = _filterSimpleConnections(workingNames, depCount);
    // workingNames is mutated by _filterSimpleConnections
    numElems = workingNames.length - offLeft - offRight;
  }

  let ordered: string[] = [...workingNames];
  let checklist = [...ordered];
  let minWeight = calculateWeight(ordered, weights);
  let minDirCount = _calculateDirCount(ordered, weights);

  const swap = (arr: string[], i: number, j: number): void => {
    const elemI = arr[i]!;
    const elemJ = arr[j]!;
    arr[i] = elemJ;
    arr[j] = elemI;
  };

  const checkWeight = (recalc = false): boolean => {
    const weight = calculateWeight(checklist, weights);
    if (weight <= minWeight || recalc) {
      const dirCount = _calculateDirCount(checklist, weights);
      if (
        recalc ||
        weight < minWeight ||
        (weight === minWeight && dirCount < minDirCount)
      ) {
        minWeight = weight;
        minDirCount = dirCount;
        ordered = [...checklist];
        return true;
      }
    }
    return false;
  };

  const rotate = (left: number, right: number): void => {
    let rotated: string[] = checklist.slice(left, right);
    const popped = rotated.pop()!;
    rotated.unshift(popped);
    if (left > 0) {
      rotated = [...checklist.slice(0, left), ...rotated];
    }
    if (right < checklist.length) {
      rotated = [...rotated, ...checklist.slice(right)];
    }
    checklist = rotated;
  };

  if (numElems < 9) {
    // Heap's algorithm — all permutations
    const counters: number[] = new Array<number>(numElems).fill(0);
    let i = 1;
    while (i < ordered.length - offLeft - offRight) {
      const counterI = counters[i]!;
      if (counterI < i) {
        const k = i % 2 && counterI;
        /* v8 ignore next 2 */
        if (k !== undefined) {
          swap(checklist, i + offLeft, k + offLeft);
        }
        counters[i] = counterI + 1;
        i = 1;
        checkWeight();
      } else {
        counters[i] = 0;
        ++i;
      }
    }
  } else {
    // Greedy heuristic
    let finished = false;
    while (!finished) {
      finished = true;
      for (let i = offLeft; i < ordered.length - offRight; i += 1) {
        for (let j = i + 1; j < ordered.length - offRight; j += 1) {
          for (let k = j - i - 1; k > 0; k--) {
            rotate(i, j + 1);
            if (checkWeight()) {
              finished = false;
            }
          }
          rotate(i, j);
        }
      }
    }
  }

  // Re-add simple connections
  for (const name of filtered) {
    let first = true;
    for (let i = checklist.length - offRight; i >= offLeft; i -= 1) {
      checklist.splice(i, 0, name);
      checkWeight(first);
      first = false;
      checklist.splice(i, 1);
    }
    checklist = ordered;
  }

  return ordered.filter((c) => _isRealComponent(c));
}

function _isRealComponent(name: string): boolean {
  return (
    name.length > 1 ||
    (name.length === 1 && name[0] !== "[" && name[0] !== "]")
  );
}

function _filterSimpleConnections(
  names: string[],
  depCount: Map<string, number>
): string[] {
  const filtered: string[] = [];
  const deps = new Map<string, string[]>();

  for (const connection of depCount.keys()) {
    const arr = connection.split(",");
    const left = arr[0]!;
    const right = arr[1]!;
    /* v8 ignore start */
    if (left.length > 0) {
      if (right.length > 0) {
        const isLeftReal = _isRealComponent(left);
        const isRightReal = _isRealComponent(right);
        if (isLeftReal && isRightReal) {
          if (!deps.has(left)) deps.set(left, []);
          deps.get(left)!.push(right);
          if (!deps.has(right)) deps.set(right, []);
          deps.get(right)!.push(left);
        }
      }
    }
    /* v8 ignore stop */
  }

  for (const name of names) {
    const depsForName = deps.get(name);
    if (depsForName?.length === 1) {
      filtered.push(name);
    }
  }
  /* v8 ignore start */
  for (const name of filtered) {
    const idx = names.indexOf(name);
    if (idx !== -1) {
      names.splice(idx, 1);
    }
  }
  /* v8 ignore stop */
  return filtered;
}
