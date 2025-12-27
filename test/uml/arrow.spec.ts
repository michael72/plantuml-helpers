import { describe, it, expect } from "vitest";
import { Arrow, ArrowDirection, Layout } from "../../src/uml/arrow";

describe("Arrow class", () => {
  it("should parse an arrow", () => {
    const arrow = Arrow.fromString("->");
    expect(arrow).toBeDefined();
    if (arrow) {
      expect(arrow.direction).toBe(ArrowDirection.Right);
      expect(arrow.left).toBe("");
      expect(arrow.line).toBe("-");
      expect(arrow.right).toBe(">");
      expect(arrow.layout).toBe(Layout.Horizontal);
    }
  });

  it("should return undefined when parsing something not an arrow", () => {
    const nonArrow = Arrow.fromString("bla");
    expect(nonArrow).toBe(undefined);
  });

  it("should parse a left arrow", () => {
    const arrow = Arrow.fromString("<~~")!;
    expect(arrow.direction).toBe(ArrowDirection.Left);
    expect(arrow.left).toBe("<");
    expect(arrow.line).toBe("~");
    expect(arrow.right).toBe("");
    expect(arrow.layout).toBe(Layout.Vertical);
  });

  it("should convert an arrow to a string", () => {
    const arrows = ["->", "-->", "<-", "<~", "<|-", "o->>", "..>>"];
    for (const arrow of arrows) {
      expect(
        Arrow.fromString(arrow)!.toString(),
        "converting '" + arrow + "' failed"
      ).toBe(arrow);
    }
  });

  it("should reverse an arrow", () => {
    const arrows: Array<[string, string]> = [
      ["..>>", "<<.."],
      ["->", "<-"],
      ["<~~", "~~>"],
      ["<|-", "-|>"],
      ["o->", "<-o"],
    ];
    arrows.forEach((arrowOp: [string, string]) => {
      const [fwd, rev] = arrowOp;
      expect(Arrow.fromString(fwd)!.reverse().toString()).toBe(rev);
      expect(Arrow.fromString(rev)!.reverse().toString()).toBe(fwd);
    });
  });

  it("should parse a damaged arrow", () => {
    const parsed = Arrow.fromString("-[")!;
    expect(parsed.line).toBe("-");
    expect(parsed.right).toBe("[");
    expect(parsed.tag).toBe("");
  });

  it("should detect composition with 'o'", () => {
    const arrowO = Arrow.fromString("o->")!;
    expect(arrowO.left).toBe("o");
    expect(arrowO.isComposition()).toBe(true);
  });

  it("should detect composition with '*'", () => {
    const arrowStar = Arrow.fromString("*->")!;
    expect(arrowStar.left).toBe("*");
    expect(arrowStar.isComposition()).toBe(true);
  });

  it("should detect non-composition arrows", () => {
    const arrow = Arrow.fromString("->")!;
    expect(arrow.isComposition()).toBe(false);
  });

  it("should detect inheritance with |> on right", () => {
    const arrow = Arrow.fromString("-|>")!;
    expect(arrow.isInheritance()).toBe(true);
  });

  it("should detect inheritance with <| on left", () => {
    const arrow = Arrow.fromString("<|-")!;
    expect(arrow.isInheritance()).toBe(true);
  });

  it("should detect non-inheritance arrows", () => {
    const arrow = Arrow.fromString("->")!;
    expect(arrow.isInheritance()).toBe(false);
  });

  it("should parse arrows with different line types", () => {
    expect(Arrow.fromString("==>")!.line).toBe("=");
    expect(Arrow.fromString("~~>")!.line).toBe("~");
    expect(Arrow.fromString("..>")!.line).toBe(".");
  });

  it("should handle vertical arrow string conversion correctly", () => {
    const verticalArrow = Arrow.fromString("---->")!;
    expect(verticalArrow.layout).toBe(Layout.Vertical);
    expect(verticalArrow.toString()).toBe("---->");
  });
});
