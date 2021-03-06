/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Arrow, ArrowDirection, Layout } from "../../src/uml/arrow";

import { equal } from "assert";
import { expect, should } from "chai";
should();

describe("Arrow class", () => {
  it("should parse an arrow", () => {
    const arrow = Arrow.fromString("->");
    expect(arrow).to.not.be.undefined;
    if (arrow) {
      arrow.direction.should.equal(ArrowDirection.Right);
      arrow.left.should.equal("");
      arrow.line.should.equal("-");
      arrow.right.should.equal(">");
      arrow.layout.should.equal(Layout.Horizontal);
    }
  });

  it("should return undefined when parsing something not an arrow", () => {
    const nonArrow = Arrow.fromString("bla");
    equal(nonArrow, undefined);
  });

  it("should parse a left arrow", () => {
    const arrow = Arrow.fromString("<~~")!;
    equal(arrow.direction, ArrowDirection.Left);
    equal(arrow.left, "<");
    equal(arrow.line, "~");
    equal(arrow.right, "");
    equal(arrow.layout, Layout.Vertical);
  });

  it("should convert an arrow to a string", () => {
    const arrows = ["->", "-->", "<-", "<~", "<|-", "o->>", "..>>"];
    for (const arrow of arrows) {
      equal(
        Arrow.fromString(arrow)!.toString(),
        arrow,
        "converting '" + arrow + "' failed"
      );
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
      equal(Arrow.fromString(fwd)!.reverse().toString(), rev);
      equal(Arrow.fromString(rev)!.reverse().toString(), fwd);
    });
  });

  it("should parse a damaged arrow", () => {
    const parsed = Arrow.fromString("-[")!;
    parsed.line.should.equal("-");
    parsed.right.should.equal("[");
    equal(parsed.tag, "");
  });
});
