import { Line, CombinedDirection } from '../../src/uml/line';
import { ArrowDirection } from '../../src/uml/arrow';

import { should } from 'chai';
should();

let equalArr = (actual: Array<string>, expected: Array<string>) => {
    actual.length.should.equal(expected.length);
    actual.map((a: string, idx: number) => {
        a.should.equal(expected[idx]);
    });
};


describe("Line class", () => {

    it('should parse a simple component line', () => {
        let line = "A -> B";
        let parsed = Line.fromString(line)!;
        equalArr(parsed.sides, ["", ""]);
        equalArr(parsed.multiplicities, ["", ""]);
        equalArr(parsed.components, ["A", "B"]);
        parsed.arrow.direction.should.equal(ArrowDirection.Right);
        parsed.toString().should.equal(line);
    });

    it('should reverse a complex component line', () => {
        let line = '   (CompA) "1-2" <|~~o "0:*" [CompB] : funny arrow ';
        let parsed = Line.fromString(line)!;
        let expected = '   [CompB] "0:*" o~~|> "1-2" (CompA) : funny arrow ';
        parsed.reverse().toString().should.equal(expected);
    });

    it('should preserve a hidden horizontal line', () => {
        let line = 'A -[hidden] B';
        let parsed = Line.fromString(line)!;
        let expected = 'B -[hidden] A';
        parsed.reverse().toString().should.equal(expected);
    });

    it('should preserve a hidden vertical line', () => {
        let line = 'B -[hidden]- C';
        let parsed = Line.fromString(line)!;
        let expected = 'C -[hidden]- B';
        parsed.reverse().toString().should.equal(expected);
    });

    it('should preserve an elongated line', () => {
        let line = 'A ---> B';
        let parsed = Line.fromString(line)!;
        let expected = 'B <--- A';
        parsed.reverse().toString().should.equal(expected);
    });

    it('should preserve an elongated line also when rotating', () => {
        let line = 'A .... B';
        let parsed = Line.fromString(line)!;
        // right and down is default
        parsed.combinedDirection().should.equal(CombinedDirection.Down);
        // check left
        parsed.setCombinedDirection(CombinedDirection.Left);
        parsed.toString().should.equal("B . A");
        // check right
        parsed.setCombinedDirection(CombinedDirection.Right);
        parsed.toString().should.equal("A . B");
        // check up - now the length should be restored
        parsed.setCombinedDirection(CombinedDirection.Up);
        parsed.toString().should.equal("B .... A");
    });

    it('should preserve explicit direction left', () => {
        for (let s of ['left', 'le', 'l']) {
            let line = `A -${s}-> B`;
            let parsed = Line.fromString(line)!;
            let expected = "B <- A";
            parsed.toString().should.equal(expected);
        }
    });

    it('should preserve explicit direction up', () => {
        for (let s of ['up', 'u']) {
            let line = `A -${s}-> B`;
            let parsed = Line.fromString(line)!;
            let expected = "B <-- A";
            parsed.toString().should.equal(expected);
        }
    });

    it('should preserve explicit direction right', () => {
        for (let s of ['right', 'ri', 'r']) {
            let line = `A -${s}-> B`;
            let parsed = Line.fromString(line)!;
            let expected = "A -> B";
            parsed.toString().should.equal(expected);
        }
    });

    it('should preserve explicit direction down', () => {
        for (let s of ['down', 'do', 'd']) {
            let line = `A -${s}-> B`;
            let parsed = Line.fromString(line)!;
            let expected = "A --> B";
            parsed.toString().should.equal(expected);
        }
    });

});
