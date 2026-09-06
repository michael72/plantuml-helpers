import { describe, it, expect } from "vitest";
import {
  sortByDependencies,
  rebuildArrows,
  orderNames,
  calculateWeight,
} from "../src/sortKernels.js";

// ----------------------------------------------------------------
// sortByDependencies
// ----------------------------------------------------------------
describe("sortByDependencies", () => {
  it("should order a simple chain A→B→C", () => {
    const result = sortByDependencies([
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ]);
    // Returns sorted from-keys: A has 0 pointed counts, B has 1
    expect(result).toEqual(["A", "B"]);
  });

  it("should order fan-in A→C, B→C (both valid)", () => {
    const result = sortByDependencies([
      { from: "A", to: "C" },
      { from: "B", to: "C" },
    ]);
    // A and B both have 0 pointed counts, equal deps length, preserve original order
    expect(result).toEqual(["A", "B"]);
  });

  it("should preserve order within disjoint groups", () => {
    const result = sortByDependencies([
      { from: "A", to: "B" },
      { from: "C", to: "D" },
    ]);
    // Only from-keys are returned (A and C)
    expect(result).toEqual(["A", "C"]);
  });

  it("should return empty array for empty input", () => {
    expect(sortByDependencies([])).toEqual([]);
  });

  it("should handle single from node", () => {
    const result = sortByDependencies([{ from: "A", to: "B" }]);
    expect(result).toEqual(["A"]);
  });

  it("should handle nodes with no outgoing edges (sinks only)", () => {
    const result = sortByDependencies([
      { from: "A", to: "B" },
      { from: "A", to: "C" },
    ]);
    expect(result).toEqual(["A"]);
  });

  it("should sort nodes with higher pointed count later", () => {
    // A→B, A→C, B→C → A is pointed to 0 times, B is pointed to once, C never appears as from-key
    const result = sortByDependencies([
      { from: "A", to: "B" },
      { from: "A", to: "C" },
      { from: "B", to: "C" },
    ]);
    // deps keys: A, B. A has 0 pointed, B has 1 pointed → [A, B]
    expect(result).toEqual(["A", "B"]);
  });

  it("should sort by deps length when pointed counts are equal", () => {
    // A→B, A→C, D→C → both A and D have pointedCount=0,
    // but A has deps length 2 (B, C) vs D has deps length 1 (C)
    // The sort's second tiebreaker (descending deps length) puts A before D.
    const result = sortByDependencies([
      { from: "A", to: "B" },
      { from: "A", to: "C" },
      { from: "D", to: "C" },
    ]);
    expect(result).toEqual(["A", "D"]);
  });
});

// ----------------------------------------------------------------
// rebuildArrows
// ----------------------------------------------------------------
describe("rebuildArrows", () => {
  // Direction values: 0=Right, 1=Down, 2=Left, 3=Up

  it("should not change arrows when no node has multiple same-direction outputs", () => {
    const input = [
      { from: "A", to: "B", direction: 0 },
      { from: "B", to: "C", direction: 0 },
    ];
    const result = rebuildArrows(input);
    expect(result).toEqual(input);
  });

  it("should rotate first arrow right when 2 same-direction arrows go from same node", () => {
    const result = rebuildArrows([
      { from: "A", to: "B", direction: 0 },
      { from: "A", to: "C", direction: 0 },
    ]);
    // First rotates right: 0→1 (Down), second stays: 0 (Right)
    expect(result[0]).toEqual({ from: "A", to: "B", direction: 1 });
    expect(result[1]).toEqual({ from: "A", to: "C", direction: 0 });
  });

  it("should rotate arrows left/right/original when 3 go from same node", () => {
    const result = rebuildArrows([
      { from: "A", to: "B", direction: 0 },
      { from: "A", to: "C", direction: 0 },
      { from: "A", to: "D", direction: 0 },
    ]);
    // First: left (0→3 = Up), second: right (0→1 = Down), third: stays (0 = Right)
    expect(result[0]!.direction).toBe(3); // left
    expect(result[1]!.direction).toBe(1); // right
    expect(result[2]!.direction).toBe(0); // original
  });

  it("should rotate arrows when 5 go from same node", () => {
    const result = rebuildArrows([
      { from: "A", to: "1", direction: 0 },
      { from: "A", to: "2", direction: 0 },
      { from: "A", to: "3", direction: 0 },
      { from: "A", to: "4", direction: 0 },
      { from: "A", to: "5", direction: 0 },
    ]);
    // With cnt=5, cnt%3=2, and isHorizontal=true:
    // c = (5-2)/3 = 1, +1 extra = 2
    // First 2 go left: direction 3
    // Next 2 go right: direction 1
    // Last 1 stays: direction 0
    expect(result[0]!.direction).toBe(3); // left
    expect(result[1]!.direction).toBe(3); // left
    expect(result[2]!.direction).toBe(1); // right
    expect(result[3]!.direction).toBe(1); // right
    expect(result[4]!.direction).toBe(0); // original
  });

  it("should not mutate input array", () => {
    const input = [
      { from: "A", to: "B", direction: 0 },
      { from: "A", to: "C", direction: 0 },
    ];
    const inputCopy = input.map((l) => ({ ...l }));
    rebuildArrows(input);
    expect(input).toEqual(inputCopy);
  });

  it("should handle 4 same-direction arrows in horizontal layout (cnt%3===1 case)", () => {
    const result = rebuildArrows([
      { from: "A", to: "1", direction: 0 },
      { from: "A", to: "2", direction: 0 },
      { from: "A", to: "3", direction: 0 },
      { from: "A", to: "4", direction: 0 },
    ]);
    // With cnt=4, cnt%3=1, isHorizontal=true:
    // c = (4-1)/3 = 1, no extra (cnt%3 !== 2)
    // First 1 goes left: direction 3
    // end += c → end = start + 2
    // cnt%3 === 1 and isHorizontal → end += 1 → end = start + 3
    // Next 2 go right: direction 1
    // Last 1 stays: direction 0
    expect(result[0]!.direction).toBe(3); // left
    expect(result[1]!.direction).toBe(1); // right
    expect(result[2]!.direction).toBe(1); // right
    expect(result[3]!.direction).toBe(0); // original
  });

  it("should handle same-direction arrows in Left layout (direction===2 branch)", () => {
    // Need cnt >= 3 to exercise the isHorizontal check. direction=2 (Left)
    // means direction === 0 is false, then direction === 2 is evaluated.
    const result = rebuildArrows([
      { from: "A", to: "B", direction: 2 },
      { from: "A", to: "C", direction: 2 },
      { from: "A", to: "D", direction: 2 },
      { from: "A", to: "E", direction: 2 },
    ]);
    // cnt=4, direction=2 (Left), isHorizontal=true, cnt%3=1
    // First 1: left → (2+3)%4 = 1 (Down)
    // Next 2: right → (2+1)%4 = 3 (Up)
    // Last 1: stays → 2 (Left)
    expect(result[0]!.direction).toBe(1); // left → down
    expect(result[1]!.direction).toBe(3); // right → up
    expect(result[2]!.direction).toBe(3); // right → up
    expect(result[3]!.direction).toBe(2); // original
  });
});

// ----------------------------------------------------------------
// calculateWeight
// ----------------------------------------------------------------
describe("calculateWeight", () => {
  it("should return 0 when there are no weights", () => {
    expect(calculateWeight(["A", "B"], [])).toBe(0);
  });

  it("should calculate weight for adjacent flipped components", () => {
    // A at index 1, B at index 0 -> distance = 1
    const weight = calculateWeight(
      ["B", "A"],
      [["A", "B", 2]]
    );
    // (1 * 2)^2 = 4
    expect(weight).toBe(4);
  });

  it("should calculate weight for non-adjacent components", () => {
    // A at index 2, B at index 0 -> distance = 2
    const weight = calculateWeight(
      ["B", "C", "A"],
      [["A", "B", 1]]
    );
    // (2 * 1)^2 = 4
    expect(weight).toBe(4);
  });

  it("should sum multiple weights", () => {
    const weight = calculateWeight(
      ["B", "C", "A"],
      [
        ["A", "B", 1], // dist 2 -> (2*1)^2 = 4
        ["A", "C", 1], // dist 1 -> (1*1)^2 = 1
      ]
    );
    expect(weight).toBe(5);
  });

  it("should calculate weight for components in natural order", () => {
    // A at index 0, B at index 1 -> distance = -1
    const weight = calculateWeight(
      ["A", "B"],
      [["A", "B", 1]]
    );
    // (-1 * 1)^2 = 1
    expect(weight).toBe(1);
  });

  it("should calculate weight for components with same positions", () => {
    // A at index 0, B at index 1 -> distance = -1 for both
    // But what does "same position" mean? If we have A->B and B->A,
    // A is at index 0 and B at index 1, so:
    // A->B: (0-1)*1 = -1, squared = 1
    // B->A: (1-0)*1 = 1, squared = 1
    const weight = calculateWeight(
      ["A", "B"],
      [
        ["A", "B", 1],
        ["B", "A", 1],
      ]
    );
    expect(weight).toBe(2);
  });
});

// ----------------------------------------------------------------
// orderNames
// ----------------------------------------------------------------
describe("orderNames", () => {
  it("should return single-element array unchanged", () => {
    const result = orderNames(["A"], []);
    expect(result).toEqual(["A"]);
  });

  it("should keep 2 elements in natural order when weight matches", () => {
    // A→B means A should be before B
    const result = orderNames(
      ["A", "B"],
      [["A", "B", 1]]
    );
    expect(result).toEqual(["A", "B"]);
  });

  it("should swap 2 elements when reversed order has higher weight", () => {
    // [B, A] has weight (1*1)^2 = 1, dirCount = 1
    // [A, B] has weight 1, dirCount = 0
    // dirCount favors [A, B] since weight is equal
    const result = orderNames(
      ["B", "A"],
      [["A", "B", 1]]
    );
    expect(result).toEqual(["A", "B"]);
  });

  it("should find optimal permutation for 3 elements", () => {
    // A→B, B→C means A before B before C is ideal
    const result = orderNames(
      ["C", "B", "A"],
      [
        ["A", "B", 1],
        ["B", "C", 1],
      ]
    );
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("should handle 9+ elements via greedy heuristic", () => {
    // Build a chain of 9 elements: A→B→C→D→E→F→G→H→I
    const names = ["I", "H", "G", "F", "E", "D", "C", "B", "A"];
    const weights: Array<[string, string, number]> = [];
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    for (let i = 0; i < letters.length - 1; i++) {
      weights.push([letters[i]!, letters[i + 1]!, 1]);
    }
    const result = orderNames(names, weights);
    // Expect the order to be A→B→C→D→E→F→G→H→I (or close to it)
    expect(result[0]).toBe("A");
    expect(result[result.length - 1]).toBe("I");
  });

  it("should handle 9+ elements with no simple connections (exercises rotate in greedy path)", () => {
    // A cycle of 9 elements: each node has exactly 2 connections, so none are "simple"
    // (no node has only 1 connection). numElems stays >= 9, exercising the greedy
    // heuristic path that calls rotate().
    const names = ["I", "H", "G", "F", "E", "D", "C", "B", "A"];
    const weights: Array<[string, string, number]> = [
      ["A", "B", 1],
      ["B", "C", 1],
      ["C", "D", 1],
      ["D", "E", 1],
      ["E", "F", 1],
      ["F", "G", 1],
      ["G", "H", 1],
      ["H", "I", 1],
      ["I", "A", 1],
    ];
    const result = orderNames(names, weights);
    // Should return 9 elements with no duplicates
    expect(result).toHaveLength(9);
    expect(new Set(result).size).toBe(9);
    // The result should be a permutation of A-I
    for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H", "I"]) {
      expect(result).toContain(letter);
    }
  });

  it("should filter out non-real right components in simple connection filtering", () => {
    // Build a chain of 9 elements with an extra weight connecting to a bracket,
    // which is not a "real component" in _isRealComponent's view.
    // This exercises the _isRealComponent(right) === false branch.
    const names = ["I", "H", "G", "F", "E", "D", "C", "B", "A"];
    const weights: Array<[string, string, number]> = [
      ["A", "B", 1],
      ["B", "C", 1],
      ["C", "D", 1],
      ["D", "E", 1],
      ["E", "F", 1],
      ["F", "G", 1],
      ["G", "H", 1],
      ["H", "I", 1],
      ["A", "[", 1], // "[" is not a real component
    ];
    const result = orderNames(names, weights);
    // A and I get filtered as simple then re-added; result has all 9
    expect(result).toHaveLength(9);
    expect(new Set(result).size).toBe(9);
  });

  it("should return empty array for empty input", () => {
    const result = orderNames([], []);
    expect(result).toEqual([]);
  });

  it("should handle names array with bracket sentinels", () => {
    // When names starts with "[", offLeft=1. The while loop checks
    // if any weight has w[0]="[" and w[1]=names[offLeft]. If so,
    // it increments offLeft to skip that bracket-paired entry too.
    const result = orderNames(
      ["[", "A", "B"],
      [["[", "A", 1]],
    );
    // offLeft: 0→1 (names[0]="["), loop sees ["[","A",1] → offLeft=2
    // No weight matches ["[", "B", ...] → loop exits, offLeft=2
    // offRight=0, numElems=1 → Heap runs on 1 element (trivial)
    // Returns all real components from the ordered list
    expect(result).toEqual(["A", "B"]);
  });

  it("should handle names array with right bracket sentinel", () => {
    // offRight should be 1 when names ends with "]"
    const result = orderNames(["A", "B", "]"], [["A", "B", 1]]);
    // offLeft=0, offRight=1, numElems=2
    expect(result).toEqual(["A", "B"]);
  });
});
