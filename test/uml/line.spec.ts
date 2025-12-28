import { describe, it, expect } from "vitest";
import { Line, CombinedDirection } from "../../src/uml/line";
import { Arrow, ArrowDirection, Layout } from "../../src/uml/arrow";
import { Component } from "../../src/uml/component";

const equalArr = (actual: Array<string>, expected: Array<string>) => {
  expect(actual.length).toBe(expected.length);
  actual.map((a: string, idx: number) => {
    expect(a).toBe(expected[idx]);
  });
};

describe("Line class", () => {
  it("should parse a simple component line", () => {
    const line = "A -> B";
    const parsed = Line.fromString(line)!;
    equalArr(parsed.sides, ["", ""]);
    equalArr(parsed.multiplicities, ["", ""]);
    equalArr(parsed.components, ["A", "B"]);
    expect(parsed.arrow.direction).toBe(ArrowDirection.Right);
    expect(parsed.toString()).toBe(line);
  });

  it("should reverse a complex component line", () => {
    const line = '   (CompA) "1-2" <|~~o "0:*" [CompB] : funny arrow ';
    const parsed = Line.fromString(line)!;
    const expected = '   [CompB] "0:*" o~~|> "1-2" (CompA) : funny arrow ';
    expect(parsed.reverse().toString()).toBe(expected);
  });

  it("should preserve a hidden horizontal line", () => {
    const line = "A -[hidden] B";
    const parsed = Line.fromString(line)!;
    const expected = "B -[hidden] A";
    expect(parsed.reverse().toString()).toBe(expected);
  });

  it("should preserve a hidden vertical line", () => {
    const line = "B -[hidden]- C";
    const parsed = Line.fromString(line)!;
    const expected = "C -[hidden]- B";
    expect(parsed.reverse().toString()).toBe(expected);
  });

  it("should preserve an elongated line", () => {
    const line = "A ---> B";
    const parsed = Line.fromString(line)!;
    const expected = "B <--- A";
    expect(parsed.reverse().toString()).toBe(expected);
  });

  it("should preserve an elongated line also when rotating", () => {
    const line = "A .... B";
    const parsed = Line.fromString(line)!;
    // right and down is default
    expect(parsed.combinedDirection()).toBe(CombinedDirection.Down);
    // check left
    parsed.setCombinedDirection(CombinedDirection.Left);
    expect(parsed.toString()).toBe("B . A");
    // check right
    parsed.setCombinedDirection(CombinedDirection.Right);
    expect(parsed.toString()).toBe("A . B");
    // check up - now the length should be restored
    parsed.setCombinedDirection(CombinedDirection.Up);
    expect(parsed.toString()).toBe("B .... A");
  });

  it("should preserve explicit direction left", () => {
    for (const s of ["left", "le", "l"]) {
      const line = `A -${s}-> B`;
      const parsed = Line.fromString(line)!;
      const expected = "B <- A";
      expect(parsed.toString()).toBe(expected);
    }
  });

  it("should preserve explicit direction up", () => {
    for (const s of ["up", "u"]) {
      const line = `A -${s}-> B`;
      const parsed = Line.fromString(line)!;
      const expected = "B <-- A";
      expect(parsed.toString()).toBe(expected);
    }
  });

  it("should preserve explicit direction right", () => {
    for (const s of ["right", "ri", "r"]) {
      const line = `A -${s}-> B`;
      const parsed = Line.fromString(line)!;
      const expected = "A -> B";
      expect(parsed.toString()).toBe(expected);
    }
  });

  it("should preserve explicit direction down", () => {
    for (const s of ["down", "do", "d"]) {
      const line = `A -${s}-> B`;
      const parsed = Line.fromString(line)!;
      const expected = "A --> B";
      expect(parsed.toString()).toBe(expected);
    }
  });

  it("should parse a component with arrow with no spaces", () => {
    for (const [left, right] of [
      ["A", "B"],
      ["A", "ABC"],
      ["ABC", "ABC"],
      ["ABC", "A"],
    ]) {
      for (const arrow of ["->", "<-", "-->", "<--"]) {
        const line = `${left}${arrow}${right}`;
        const expected = `${left} ${arrow} ${right}`;
        const parsed = Line.fromString(line)!;
        expect(parsed.toString()).toBe(expected);
      }
    }
  });

  it("should parse a line with quotes and dots as components", () => {
    const line = '"net foo" -- net.dummy';
    const parsed = Line.fromString(line)!;
    expect(parsed.components[0]!).toBe('"net foo"');
    expect(parsed.components[1]!).toBe("net.dummy");
    expect(parsed.arrow.line).toBe("-");
    expect(parsed.toString()).toBe(line);
  });

  it("should rotate an arrow right", () => {
    const line = Line.fromString("A -> B")!;
    line.rotateRight();
    expect(line.toString()).toBe("A --> B");
    line.rotateRight();
    expect(line.toString()).toBe("B <- A");
    line.rotateRight();
    expect(line.toString()).toBe("B <-- A");
    line.rotateRight();
    expect(line.toString()).toBe("A -> B");
  });

  it("should rotate an arrow left", () => {
    const line = Line.fromString("A -> B")!;
    line.rotateLeft();
    expect(line.toString()).toBe("B <-- A");
    line.rotateLeft();
    expect(line.toString()).toBe("B <- A");
    line.rotateLeft();
    expect(line.toString()).toBe("A --> B");
    line.rotateLeft();
    expect(line.toString()).toBe("A -> B");
  });

  it("should initialize components with defaults", () => {
    const line = new Line([], Arrow.fromString("->")!, [], []);
    expect(line.components[0]).toBe("[");
    expect(line.components[1]).toBe("]");
  });

  it("should return undefined for comment lines", () => {
    expect(Line.fromString("' this is a comment")).toBeUndefined();
  });

  it("should return undefined for ellipsis lines", () => {
    expect(Line.fromString("...")).toBeUndefined();
    expect(Line.fromString("  ...  ")).toBeUndefined();
  });

  it("should return undefined for invalid arrow lines", () => {
    expect(Line.fromString("A B")).toBeUndefined();
    expect(Line.fromString("no arrow here")).toBeUndefined();
  });

  it("should return layout correctly", () => {
    const horizontal = Line.fromString("A -> B")!;
    const vertical = Line.fromString("A --> B")!;
    expect(horizontal.layout()).toBe(Layout.Horizontal);
    expect(vertical.layout()).toBe(Layout.Vertical);
  });

  it("should check if line has component with has()", () => {
    const line = Line.fromString("A -> B")!;
    expect(line.has("A")).toBe(true);
    expect(line.has("B")).toBe(true);
    expect(line.has("C")).toBe(false);
  });

  it("should extract component names correctly", () => {
    const line = Line.fromString("[CompA] -> [CompB]")!;
    expect(line.componentNames()).toEqual(["CompA", "CompB"]);
  });

  it("should filter single bracket chars from componentNames", () => {
    const line = new Line(["[", "]"], Arrow.fromString("->")!, [], []);
    expect(line.componentNames()).toEqual([]);
  });

  it("should set default direction for inheritance arrows", () => {
    const line = Line.fromString("A <|- B")!;
    line.setDefaultDirection(false);
    expect(line.combinedDirection()).toBe(CombinedDirection.Up);
  });

  it("should set default direction for composition arrows", () => {
    const line = Line.fromString("A o--> B")!;
    line.setDefaultDirection(false);
    expect(line.combinedDirection()).toBe(CombinedDirection.Right);
  });

  it("should set default direction with rebuild=true for inheritance", () => {
    const line = Line.fromString("A <|-- B")!;
    line.setDefaultDirection(true);
    expect(line.combinedDirection()).toBe(CombinedDirection.Up);
  });

  it("should set default direction with rebuild=true for non-inheritance", () => {
    const line = Line.fromString("A --> B")!;
    line.setDefaultDirection(true);
    expect(line.combinedDirection()).toBe(CombinedDirection.Right);
  });

  it("should not change direction for already correct layout", () => {
    // Inheritance already vertical
    const inheritanceLine = Line.fromString("A <|-- B")!;
    inheritanceLine.setDefaultDirection(false);
    expect(inheritanceLine.combinedDirection()).toBe(CombinedDirection.Up);

    // Composition already horizontal
    const compLine = Line.fromString("A o-> B")!;
    compLine.setDefaultDirection(false);
    // No change expected for already correct layout
  });

  it("should handle includes() with Component", () => {
    const line = Line.fromString("A -> B")!;
    const compA = Component.fromString(["component A {", "}"]);
    const compC = Component.fromString(["component C {", "}"]);
    expect(line.includes(compA)).toBe(true);
    expect(line.includes(compC)).toBe(false);
  });

  it("should return false for includes when no match", () => {
    const line = Line.fromString("A -> B")!;
    const comp = Component.fromString(["component X {", "}"]);
    expect(line.includes(comp)).toBe(false);
  });

  it("should handle reverse with sparse arrays", () => {
    // Create line with minimal arrays to test ?? fallbacks
    const line = new Line(
      ["A"], // Only one component - constructor sets [1] to "]"
      Arrow.fromString("->")!,
      ["m1"], // Only one multiplicity
      ["s1"] // Only one side
    );
    const reversed = line.reverse();
    // After constructor: ["A", "]"], reversed becomes ["]", "A"]
    expect(reversed.components).toEqual(["]", "A"]);
    expect(reversed.multiplicities).toEqual(["", "m1"]);
  });

  it("should handle toString with sparse sides array", () => {
    // Create line with undefined sides
    const line = new Line(["A", "B"], Arrow.fromString("->")!, [], []);
    expect(line.toString()).toBe("A -> B");
  });

  it("should handle reverse with empty side correctly", () => {
    const line = new Line(
      ["A", "B"],
      Arrow.fromString("->")!,
      [],
      ["", ""] // Both sides empty
    );
    const reversed = line.reverse();
    expect(reversed.sides).toEqual(["", ""]);
  });
});
