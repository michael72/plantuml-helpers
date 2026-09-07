import { describe, it, expect } from "vitest";
import {
  findAllUmlBoundaries,
  findAllUmlFenceBoundaries,
} from "../src/umlBoundary";

describe("findAllUmlBoundaries", () => {
  it("should find a single @startuml/@enduml region", () => {
    const lines = [
      "some text",
      "@startuml",
      "content",
      "@enduml",
      "more text",
    ];
    const result = findAllUmlBoundaries(lines);
    expect(result).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("should find multiple regions", () => {
    const lines = [
      "@startuml a",
      "content1",
      "@enduml",
      "between",
      "@startuml b",
      "content2",
      "@enduml",
    ];
    const result = findAllUmlBoundaries(lines);
    expect(result).toEqual([
      { startLine: 0, endLine: 2 },
      { startLine: 4, endLine: 6 },
    ]);
  });

  it("should return empty array when no @startuml present", () => {
    const lines = ["no", "markers", "here"];
    expect(findAllUmlBoundaries(lines)).toEqual([]);
  });

  it("should ignore a dangling @enduml without @startuml", () => {
    const lines = ["@enduml", "stuff"];
    expect(findAllUmlBoundaries(lines)).toEqual([]);
  });

  it("should handle unclosed @startuml gracefully", () => {
    const lines = ["@startuml", "no end"];
    const result = findAllUmlBoundaries(lines);
    // No @enduml found, so start is never reset — region never pushed
    expect(result).toEqual([]);
  });

  it("should match case-insensitively", () => {
    const lines = ["@STARTUML", "content", "@ENDuml"];
    expect(findAllUmlBoundaries(lines)).toEqual([
      { startLine: 0, endLine: 2 },
    ]);
  });
});

describe("findAllUmlFenceBoundaries", () => {
  it("should find a single ```plantuml block", () => {
    const lines = [
      "text",
      "```plantuml",
      "[B] -> [C]",
      "[A] -> [B]",
      "```",
      "more text",
    ];
    const { boundaries, unterminatedFenceLine } =
      findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([{ startLine: 2, endLine: 3 }]);
    expect(unterminatedFenceLine).toBeUndefined();
  });

  it("should support the puml fence info string", () => {
    const lines = ["```puml", "content", "```"];
    const { boundaries } = findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([{ startLine: 1, endLine: 1 }]);
  });

  it("should find multiple plantuml blocks", () => {
    const lines = [
      "```plantuml",
      "block1",
      "```",
      "text",
      "```plantuml",
      "block2",
      "```",
    ];
    const { boundaries } = findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([
      { startLine: 1, endLine: 1 },
      { startLine: 5, endLine: 5 },
    ]);
  });

  it("should skip non-plantuml fences", () => {
    const lines = ["```js", "const x = 1;", "```"];
    const { boundaries } = findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([]);
  });

  it("should skip empty plantuml blocks", () => {
    const lines = ["```plantuml", "```"];
    const { boundaries } = findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([]);
  });

  it("should report unterminated plantuml block", () => {
    const lines = ["```plantuml", "[A] -> [B]", ""];
    const { boundaries, unterminatedFenceLine } =
      findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([]);
    // Content starts at line 1 (0-based, after the opening fence at line 0)
    expect(unterminatedFenceLine).toBe(1);
  });

  it("should stop scan at unterminated non-plantuml fence without error", () => {
    const lines = ["```js", "const x = 1;", ""];
    const { boundaries, unterminatedFenceLine } =
      findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([]);
    expect(unterminatedFenceLine).toBeUndefined();
  });

  it("should handle tilde fences", () => {
    const lines = ["~~~plantuml", "[B] -> [C]", "[A] -> [B]", "~~~"];
    const { boundaries } = findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([{ startLine: 1, endLine: 2 }]);
  });

  it("should handle longer fences and respect nesting", () => {
    const lines = [
      "````md",
      "```plantuml",
      "[B] -> [C]",
      "```",
      "````",
    ];
    const { boundaries } = findAllUmlFenceBoundaries(lines);
    // The ````md block encloses everything; inner ```plantuml is inside it
    // so only `````md's closer (````) is relevant. Since ````md is not a
    // plantuml block, no boundaries are found.
    expect(boundaries).toEqual([]);
  });

  it("should ignore content outside fences", () => {
    const lines = [
      "# Title",
      "",
      "```plantuml",
      "content",
      "```",
      "",
    ];
    const { boundaries } = findAllUmlFenceBoundaries(lines);
    expect(boundaries).toEqual([{ startLine: 3, endLine: 3 }]);
  });
});
