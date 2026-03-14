import { describe, it, expect } from "vitest";
import { findUmlBoundaries } from "../src/umlBoundary";

describe("findUmlBoundaries", () => {
  describe("@startuml/@enduml blocks", () => {
    // Note: The function returns content lines between markers,
    // skipping past @startuml and stopping before @enduml

    it.each([true, false])(
      "should find content boundaries when cursor is inside the block (flag=%s)",
      (flag) => {
        const lines = ["@startuml", "A -> B", "B -> C", "@enduml"];
        const result = findUmlBoundaries(lines, 1, flag);
        expect(result).toEqual({ startLine: 1, endLine: 2 });
      }
    );

    it.each([true, false])(
      "should find content boundaries when cursor is on @startuml line (flag=%s)",
      (flag) => {
        const lines = ["@startuml", "A -> B", "@enduml"];
        const result = findUmlBoundaries(lines, 0, flag);
        // Skips @startuml, content is line 1
        expect(result).toEqual({ startLine: 1, endLine: 1 });
      }
    );

    it.each([true, false])(
      "should find content boundaries when cursor is on content line (flag=%s)",
      (flag) => {
        const lines = ["@startuml", "A -> B", "C -> D", "@enduml"];
        const result = findUmlBoundaries(lines, 2, flag);
        // Content is lines 1-2
        expect(result).toEqual({ startLine: 1, endLine: 2 });
      }
    );

    it.each([true, false])(
      "should find content with named diagram (flag=%s)",
      (flag) => {
        const lines = ["@startuml myDiagram", "A -> B", "@enduml"];
        const result = findUmlBoundaries(lines, 1, flag);
        expect(result).toEqual({ startLine: 1, endLine: 1 });
      }
    );
  });

  describe("markdown plantuml blocks", () => {
    it.each([true, false])(
      "should find content in markdown code block (flag=%s)",
      (flag) => {
        const lines = ["# Header", "```plantuml", "A -> B", "```", "text"];
        const result = findUmlBoundaries(lines, 2, flag);
        // Content is line 2, stops before closing ```
        expect(result).toEqual({ startLine: 2, endLine: 2 });
      }
    );

    it.each([true, false])(
      "should find content when cursor is on opening fence (flag=%s)",
      (flag) => {
        const lines = ["```plantuml", "A -> B", "```"];
        const result = findUmlBoundaries(lines, 0, flag);
        // Skips opening fence, content is line 1
        expect(result).toEqual({ startLine: 1, endLine: 1 });
      }
    );
  });

  describe("package/component with braces", () => {
    it("should find package boundaries including braces", () => {
      const lines = ["package MyPackage {", "  class A", "  class B", "}"];
      const result = findUmlBoundaries(lines, 1, true);
      // Package with braces: includes opening and closing
      expect(result).toEqual({ startLine: 0, endLine: 3 });
    });

    it("should find package with brace on next line", () => {
      const lines = ["package MyPackage", "{", "  class A", "}"];
      const result = findUmlBoundaries(lines, 2, true);
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
      const result = findUmlBoundaries(lines, 2, true);
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
      const result = findUmlBoundaries(lines, 0, true);
      // From cursor at line 0, finds Outer package and skips past Inner's closing brace
      expect(result).toEqual({ startLine: 0, endLine: 4 });
    });

    it("should find component diagram", () => {
      const lines = ["component MyComponent {", "  [A] -> [B]", "}"];
      const result = findUmlBoundaries(lines, 1, true);
      expect(result).toEqual({ startLine: 0, endLine: 2 });
    });
  });

  describe("edge cases", () => {
    it.each([true, false])(
      "should return undefined for empty lines array (flag=%s)",
      (flag) => {
        const result = findUmlBoundaries([], 0, flag);
        expect(result).toBeUndefined();
      }
    );

    it.each([true, false])(
      "should return undefined when no UML markers found (flag=%s)",
      (flag) => {
        const lines = ["just some text", "more text", "nothing here"];
        const result = findUmlBoundaries(lines, 1, flag);
        expect(result).toBeUndefined();
      }
    );

    it.each([true, false])(
      "should return undefined when cursor is before any UML (flag=%s)",
      (flag) => {
        const lines = ["some text", "@startuml", "A -> B", "@enduml"];
        const result = findUmlBoundaries(lines, 0, flag);
        expect(result).toBeUndefined();
      }
    );

    it.each([true, false])(
      "should return undefined for single line with balanced braces (flag=%s)",
      (flag) => {
        const lines = ["class A { field: int }"];
        const result = findUmlBoundaries(lines, 0, flag);
        // Single line with balanced braces - bracketCount goes to 1 then 0
        // so the closing brace condition (bracketCount === 1) is never met
        expect(result).toBeUndefined();
      }
    );
  });

  describe("mixed content", () => {
    it.each([true, false])(
      "should find UML content in file with other content before (flag=%s)",
      (flag) => {
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
        const result = findUmlBoundaries(lines, 5, flag);
        // Content is line 5, stops before @enduml
        expect(result).toEqual({ startLine: 5, endLine: 5 });
      }
    );

    it.each([true, false])(
      "should find correct diagram content when multiple exist (flag=%s)",
      (flag) => {
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
        const result = findUmlBoundaries(lines, 5, flag);
        // Content is line 5
        expect(result).toEqual({ startLine: 5, endLine: 5 });
      }
    );
  });

  describe("whitespace handling", () => {
    it.each([true, false])(
      "should handle indented @startuml (flag=%s)",
      (flag) => {
        const lines = ["  @startuml", "  A -> B", "  @enduml"];
        const result = findUmlBoundaries(lines, 1, flag);
        // Content is line 1
        expect(result).toEqual({ startLine: 1, endLine: 1 });
      }
    );

    it.each([true, false])("should handle tabs (flag=%s)", (flag) => {
      const lines = ["\t@startuml", "\tA -> B", "\t@enduml"];
      const result = findUmlBoundaries(lines, 1, flag);
      // Content is line 1
      expect(result).toEqual({ startLine: 1, endLine: 1 });
    });
  });
});
