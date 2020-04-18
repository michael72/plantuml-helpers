import { equal } from 'assert';
import { expect, should } from 'chai';
import * as uml from '../src/uml';

should();

let equalArr = (actual: Array<string>, expected: Array<string>) => {
    actual.length.should.equal(expected.length);
    actual.map((a: string, idx: number) => {
        a.should.equal(expected[idx]);
    });
};

describe('Uml spec', () => {

    describe('Arrow class', () => {

        it('should parse an arrow', () => {
            let arrow = uml.Arrow.fromString("->");
            expect(arrow).to.not.be.undefined;
            if (arrow) {
                arrow.direction.should.equal(uml.ArrowDirection.Right);
                arrow.left.should.equal("");
                arrow.line.should.equal("-");
                arrow.right.should.equal(">");
                arrow.layout.should.equal(uml.Layout.Horizontal);
            }
        });

        it('should return undefined when parsing something not an arrow', () => {
            let nonArrow = uml.Arrow.fromString("bla");
            equal(nonArrow, undefined);
        });

        it('should parse a left arrow', () => {
            let arrow = uml.Arrow.fromString("<~~");
            equal(arrow?.direction, uml.ArrowDirection.Left);
            equal(arrow?.left, "<");
            equal(arrow?.line, "~");
            equal(arrow?.right, "");
            equal(arrow?.layout, uml.Layout.Vertical);
        });

        it('should convert an arrow to a string', () => {
            let arrows = ["->", "-->", "<-", "<~", "<|-", "o->>"];
            arrows.forEach((arrow: string) => {
                equal(uml.Arrow.fromString(arrow)?.toString(), arrow, "converting '" + arrow + "' failed");
            });
        });

        it('should reverse an arrow', () => {
            let arrows: Array<[string, string]>
                = [["->", "<-"], ["<~~", "~~>"], ["<|-", "-|>"], ["o->", "<-o"]];
            arrows.forEach((arrowOp: [string, string]) => {
                let [fwd, rev] = arrowOp;
                equal(uml.Arrow.fromString(fwd)?.reverse().toString(), rev);
                equal(uml.Arrow.fromString(rev)?.reverse().toString(), fwd);
            });
        });

        it('should parse a damaged arrow', () => {
            let parsed = uml.Arrow.fromString("-[")!;
            parsed.line.should.equal("-");
            parsed.right.should.equal("");
            equal(parsed.tag, "[");
        });

    });

    describe("Line class", () => {

        it('should parse a simple component line', () => {
            let line = "A -> B";
            let parsed = uml.Line.fromString(line)!;
            equalArr(parsed.sides, ["", ""]);
            equalArr(parsed.multiplicities, ["", ""]);
            equalArr(parsed.components, ["A", "B"]);
            parsed.arrow.direction.should.equal(uml.ArrowDirection.Right);
            parsed.toString().should.equal(line);
        });

        it('should reverse a complex component line', () => {
            let line = '   (CompA) "1-2" <|~~o "0:*" [CompB] : funny arrow ';
            let parsed = uml.Line.fromString(line)!;
            let expected = '   [CompB] "0:*" o~~|> "1-2" (CompA) : funny arrow ';
            parsed.reverse().toString().should.equal(expected);
        });

        it('should preserve a hidden horizontal line', () => {
            let line = 'A -[hidden] B';
            let parsed = uml.Line.fromString(line)!;
            let expected = 'B -[hidden] A';
            parsed.reverse().toString().should.equal(expected);
        });

        it('should preserve a hidden vertical line', () => {
            let line = 'B -[hidden]- C';
            let parsed = uml.Line.fromString(line)!;
            let expected = 'C -[hidden]- B';
            parsed.reverse().toString().should.equal(expected);
        });

        it('should preserve an elongated line', () => {
            let line = 'A ---> B';
            let parsed = uml.Line.fromString(line)!;
            let expected = 'B <--- A';
            parsed.reverse().toString().should.equal(expected);
        });

        it('should preserve an elongated line also when rotating', () => {
            let line = 'A .... B';
            let parsed = uml.Line.fromString(line)!;
            // right and down is default
            parsed.combinedDirection().should.equal(uml.CombinedDirection.Down);
            // check left
            parsed.setCombinedDirection(uml.CombinedDirection.Left);
            parsed.toString().should.equal("B . A");
            // check right
            parsed.setCombinedDirection(uml.CombinedDirection.Right);
            parsed.toString().should.equal("A . B");
            // check up - now the length should be restored
            parsed.setCombinedDirection(uml.CombinedDirection.Up);
            parsed.toString().should.equal("B .... A");
        });

        it('should preserve explicit direction left', () => {
            for (let s of ['left', 'le', 'l']) {
                let line = `A -${s}-> B`;
                let parsed = uml.Line.fromString(line)!;
                let expected = "B <- A";
                parsed.toString().should.equal(expected);
            }
        });

        it('should preserve explicit direction up', () => {
            for (let s of ['up', 'u']) {
                let line = `A -${s}-> B`;
                let parsed = uml.Line.fromString(line)!;
                let expected = "B <-- A";
                parsed.toString().should.equal(expected);
            }
        });

        it('should preserve explicit direction right', () => {
            for (let s of ['right', 'ri', 'r']) {
                let line = `A -${s}-> B`;
                let parsed = uml.Line.fromString(line)!;
                let expected = "A -> B";
                parsed.toString().should.equal(expected);
            }
        });

        it('should preserve explicit direction down', () => {
            for (let s of ['down', 'do', 'd']) {
                let line = `A -${s}-> B`;
                let parsed = uml.Line.fromString(line)!;
                let expected = "A --> B";
                parsed.toString().should.equal(expected);
            }
        });

    });
    describe("Component class", () => {
        it("should parse a package", () => {
            let original =
                'package "fun" {\n' +
                "  [A]\n" +
                "  note right: this is A\n" +
                "  A *--> B\n" +
                "  D *-> A\n" +
                "}\n";
            let parsed = uml.Component.fromString(original);
            parsed.name!.should.equal("fun");
            parsed.type!.should.equal("package");
            parsed.content.length.should.equal(4);
            parsed.toString().should.equal(original);
        });
        it("should parse a package - } in next line", () => {
            let original = 'package "bla"\n' +
                '{\n' +
                "  [A]\n" +
                "}";
            // { is moved up when converting back to string - hence:
            let expected = 'package "bla" {\n' +
                "  [A]\n" +
                "}\n";
            let parsed = uml.Component.fromString(original);
            parsed.name!.should.equal("bla");
            parsed.type!.should.equal("package");
            parsed.content.length.should.equal(1);
            parsed.toString().should.equal(expected);
        });
    });
});

