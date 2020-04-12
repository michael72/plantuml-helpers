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

});

describe("Line class", () => {
    it ('should parse a simple component line', () => {
        let line = "A -> B";
        let parsed = uml.Line.fromString(line)!;
        equalArr(parsed.sides, ["",""]);
        equalArr(parsed.multiplicities, ["",""]);
        equalArr(parsed.components, ["A", "B"]);
        parsed.arrow.direction.should.equal(uml.ArrowDirection.Right);
        parsed.toString().should.equal(line);
    });

    it ('should reverse a complex component line', () => {
        let line = '   (CompA) "1-2" <|~~o "0:*" [CompB] : funny arrow ';
        let parsed = uml.Line.fromString(line)!;
        let expected = '   [CompB] "0:*" o~~|> "1-2" (CompA) : funny arrow ';
        parsed.reverse().toString().should.equal(expected);
    });

    it ('should preserve a hidden horizontal line', () => {
        let line = 'A -[hidden] B';
        let parsed = uml.Line.fromString(line)!;
        let expected = 'B -[hidden] A';
        parsed.reverse().toString().should.equal(expected);

    });

    it ('should preserve a hidden vertical line', () => {
        let line = 'B -[hidden]- C';
        let parsed = uml.Line.fromString(line)!;
        let expected = 'C -[hidden]- B';
        parsed.reverse().toString().should.equal(expected);
    });

    it ('should preserve an elongated line', () => {
        let line = 'A ---> B';
        let parsed = uml.Line.fromString(line)!;
        let expected = 'B <--- A';
        parsed.reverse().toString().should.equal(expected);
    });
});

