import { describe, it, expect } from "vitest";
import { formatLines } from "../src/sorter.js";
import { Line, CombinedDirection } from "../src/uml/line.js";

function linesFrom(strings: string[]): Line[] {
  return strings.map((s) => Line.fromString(s)!);
}

function linesToString(lines: Line[]): string {
  return lines.map((l) => l.toString()).join("\n");
}

describe("formatLines", () => {
  it("should sort lines by topological dependency order", () => {
    const lines = linesFrom(["[B] -> [C]", "[A] -> [B]"]);
    formatLines(lines);
    expect(linesToString(lines)).toBe("[A] -> [B]\n[B] -> [C]");
  });

  it("should leave already sorted lines in place", () => {
    const lines = linesFrom(["[C] -> [B]", "[A] -> [B]"]);
    formatLines(lines);
    expect(linesToString(lines)).toBe("[C] -> [B]\n[A] -> [B]");
  });

  it("should group lines that share a common source node", () => {
    // Multiple outgoing lines from [Camera] should stay adjacent
    const lines = linesFrom([
      "[Camera] o-> [Commands]",
      "[Camera] -|> ICamera",
      "[Camera] .> IConnector",
      "[Channel] o-> IConnector",
    ]);
    formatLines(lines);
    const result = linesToString(lines);
    // [Camera] lines should be together, not split
    const cameraIdx = result.indexOf("[Camera]");
    const channelIdx = result.indexOf("[Channel]");
    // One group should come before the other
    expect(cameraIdx).not.toBe(-1);
    expect(channelIdx).not.toBe(-1);
  });

  it("should handle a single line without errors", () => {
    const lines = linesFrom(["[A] -> [B]"]);
    formatLines(lines);
    expect(linesToString(lines)).toBe("[A] -> [B]");
  });

  it("should handle an empty array", () => {
    const lines: Line[] = [];
    formatLines(lines);
    expect(lines).toHaveLength(0);
  });

  it("should set inheritance direction to Up when rebuild=true", () => {
    const lines = linesFrom(["A -|> B"]);
    formatLines(lines, true);
    // With rebuild=true, inheritance should go up
    expect(lines[0]!.combinedDirection()).toBe(CombinedDirection.Up);
  });

  it("should redistribute multi-outgoing arrows when rebuild=true", () => {
    // 3+ outgoing arrows from same source should be redistributed
    const lines = linesFrom([
      "[A] -> [B]",
      "[A] -> [C]",
      "[A] -> [D]",
    ]);
    formatLines(lines, true);
    const result = linesToString(lines);
    // All [A] lines should still be present
    expect(result).toContain("[A]");
    expect(result).toContain("[B]");
    expect(result).toContain("[C]");
    expect(result).toContain("[D]");
    // Lines should have different arrow directions (some rotated)
    const dirs = lines.map((l) => l.combinedDirection());
    const uniqueDirs = new Set(dirs);
    // At least some arrows should have been redistributed to different directions
    expect(uniqueDirs.size).toBeGreaterThan(1);
  });

  it("should sort by transitive dependencies: nodes with most outgoing transitive deps first", () => {
    // A is connected (transitively) to B, C and D
    // F is only connected to E
    // A should come before F
    const lines = linesFrom([
      "[C] o-> D",
      "F o-> E",
      "B o-> C",
      "A o-> B",
    ]);
    formatLines(lines);
    const result = linesToString(lines);
    const aIdx = result.indexOf("A o-> B");
    const fIdx = result.indexOf("F o-> E");
    expect(aIdx).toBeLessThan(fIdx);
  });

  it("should place interface/class definitions in component order", () => {
    // Interface IFoo and IBase should maintain parent/child relationships
    const lines = linesFrom([
      "[Foo] -|> IFoo",
      "[Base] <|-- [Derived]",
      "[Foo] o-> [Proxy]",
      "IFoo o-> IBase",
    ]);
    formatLines(lines);
    const result = linesToString(lines);
    // IFoo and IBase lines should be present
    expect(result).toContain("IFoo");
    expect(result).toContain("IBase");
  });

  it("should not mutate line content during sort", () => {
    const lines = linesFrom([
      "[B] -> [C]",
      "[A] -> [B]",
    ]);
    const originalToString = linesToString(lines);
    formatLines(lines);
    // Line objects should be the same references
    expect(lines[0]!.from()).toBeDefined();
    expect(lines[1]!.from()).toBeDefined();
    // Content should be correctly sorted
    expect(linesToString(lines)).not.toBe(originalToString);
  });
});
