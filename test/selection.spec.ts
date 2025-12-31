import { describe, it, expect } from "vitest";
import { findUmlBoundaries } from "../src/umlBoundary";

describe("findUmlBoundaries", () => {
  describe("@startuml/@enduml blocks", () => {
    // Note: The function returns content lines between markers,
    // skipping past @startuml and stopping before @enduml

    it("should find content boundaries when cursor is inside the block", () => {
      const lines = ["@startuml", "A -> B", "B -> C", "@enduml"];
      const result = findUmlBoundaries(lines, 1);
      // Content is lines 1-2, stops before @enduml
      expect(result).toEqual({ startLine: 1, endLine: 2 });
    });

    it("should find content boundaries when cursor is on @startuml line", () => {
      const lines = ["@startuml", "A -> B", "@enduml"];
      const result = findUmlBoundaries(lines, 0);
      // Skips @startuml, content is line 1
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });

    it("should find content boundaries when cursor is on content line", () => {
      const lines = ["@startuml", "A -> B", "C -> D", "@enduml"];
      const result = findUmlBoundaries(lines, 2);
      // Content is lines 1-2
      expect(result).toEqual({ startLine: 1, endLine: 2 });
    });

    it("should find content with named diagram", () => {
      const lines = ["@startuml myDiagram", "A -> B", "@enduml"];
      const result = findUmlBoundaries(lines, 1);
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });
  });

  describe("markdown plantuml blocks", () => {
    it("should find content in markdown code block", () => {
      const lines = ["# Header", "```plantuml", "A -> B", "```", "text"];
      const result = findUmlBoundaries(lines, 2);
      // Content is line 2, stops before closing ```
      expect(result).toEqual({ startLine: 2, endLine: 2 });
    });

    it("should find content when cursor is on opening fence", () => {
      const lines = ["```plantuml", "A -> B", "```"];
      const result = findUmlBoundaries(lines, 0);
      // Skips opening fence, content is line 1
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });
  });

  describe("package/component with braces", () => {
    it("should find package boundaries including braces", () => {
      const lines = ["package MyPackage {", "  class A", "  class B", "}"];
      const result = findUmlBoundaries(lines, 1);
      // Package with braces: includes opening and closing
      expect(result).toEqual({ startLine: 0, endLine: 3 });
    });

    it("should find package with brace on next line", () => {
      const lines = ["package MyPackage", "{", "  class A", "}"];
      const result = findUmlBoundaries(lines, 2);
      expect(result).toEqual({ startLine: 0, endLine: 3 });
    });

    it("should handle nested braces - finds innermost containing block", () => {
      const lines = [
        "package Outer {",
        "  package Inner {",
        "    class A",
        "  }",
        "}",
      ];
      const result = findUmlBoundaries(lines, 2);
      // From cursor at line 2, finds Inner package first
      expect(result).toEqual({ startLine: 1, endLine: 3 });
    });

    it("should handle nested braces - finds outer block when cursor at start", () => {
      const lines = [
        "package Outer {",
        "  package Inner {",
        "    class A",
        "  }",
        "}",
      ];
      const result = findUmlBoundaries(lines, 0);
      // From cursor at line 0, finds Outer package and skips past Inner's closing brace
      expect(result).toEqual({ startLine: 0, endLine: 4 });
    });

    it("should find component diagram", () => {
      const lines = ["component MyComponent {", "  [A] -> [B]", "}"];
      const result = findUmlBoundaries(lines, 1);
      expect(result).toEqual({ startLine: 0, endLine: 2 });
    });
  });

  describe("edge cases", () => {
    it("should return undefined for empty lines array", () => {
      const result = findUmlBoundaries([], 0);
      expect(result).toBeUndefined();
    });

    it("should return undefined when no UML markers found", () => {
      const lines = ["just some text", "more text", "nothing here"];
      const result = findUmlBoundaries(lines, 1);
      expect(result).toBeUndefined();
    });

    it("should return undefined when cursor is before any UML", () => {
      const lines = ["some text", "@startuml", "A -> B", "@enduml"];
      const result = findUmlBoundaries(lines, 0);
      expect(result).toBeUndefined();
    });

    it("should return undefined for single line with balanced braces", () => {
      const lines = ["class A { field: int }"];
      const result = findUmlBoundaries(lines, 0);
      // Single line with balanced braces - bracketCount goes to 1 then 0
      // so the closing brace condition (bracketCount === 1) is never met
      expect(result).toBeUndefined();
    });
  });

  describe("mixed content", () => {
    it("should find UML content in file with other content before", () => {
      const lines = [
        "# My Document",
        "",
        "Some description",
        "",
        "@startuml",
        "A -> B",
        "@enduml",
        "",
        "More text",
      ];
      const result = findUmlBoundaries(lines, 5);
      // Content is line 5, stops before @enduml
      expect(result).toEqual({ startLine: 5, endLine: 5 });
    });

    it("should find correct diagram content when multiple exist", () => {
      const lines = [
        "@startuml diagram1",
        "A -> B",
        "@enduml",
        "",
        "@startuml diagram2",
        "C -> D",
        "@enduml",
      ];
      // Cursor in second diagram content
      const result = findUmlBoundaries(lines, 5);
      // Content is line 5
      expect(result).toEqual({ startLine: 5, endLine: 5 });
    });
  });

  describe("whitespace handling", () => {
    it("should handle indented @startuml", () => {
      const lines = ["  @startuml", "  A -> B", "  @enduml"];
      const result = findUmlBoundaries(lines, 1);
      // Content is line 1
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });

    it("should handle tabs", () => {
      const lines = ["\t@startuml", "\tA -> B", "\t@enduml"];
      const result = findUmlBoundaries(lines, 1);
      // Content is line 1
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });
  });
});
