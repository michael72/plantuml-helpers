import { describe, it, expect } from "vitest";
import { Line, CombinedDirection } from "../../src/uml/line";
import { ArrowDirection } from "../../src/uml/arrow";

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

  it ("should rotate an arrow right", () => {
    const line = Line.fromString("A -> B")!;
    line.rotateRight();
    expect(line.toString()).toBe("A --> B");
    line.rotateRight();
    expect(line.toString()).toBe("B <- A");
    line.rotateRight();
    expect(line.toString()).toBe("B <-- A");
    line.rotateRight();
    expect(line.toString()).toBe("A -> B");
  })

  it ("should rotate an arrow left", () => {
    const line = Line.fromString("A -> B")!;
    line.rotateLeft();
    expect(line.toString()).toBe("B <-- A");
    line.rotateLeft();
    expect(line.toString()).toBe("B <- A");
    line.rotateLeft();
    expect(line.toString()).toBe("A --> B");
    line.rotateLeft();
    expect(line.toString()).toBe("A -> B");
  })
});
