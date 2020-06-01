/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Line, CombinedDirection } from '../../src/uml/line';
import { ArrowDirection } from '../../src/uml/arrow';

import { should } from 'chai';
should();

const equalArr = (actual: Array<string>, expected: Array<string>) => {
    actual.length.should.equal(expected.length);
    actual.map((a: string, idx: number) => {
        a.should.equal(expected[idx]);
    });
};


describe("Line class", () => {

    it('should parse a simple component line', () => {
        const line = "A -> B";
        const parsed = Line.fromString(line)!;
        equalArr(parsed.sides, ["", ""]);
        equalArr(parsed.multiplicities, ["", ""]);
        equalArr(parsed.components, ["A", "B"]);
        parsed.arrow.direction.should.equal(ArrowDirection.Right);
        parsed.toString().should.equal(line);
    });

    it('should reverse a complex component line', () => {
        const line = '   (CompA) "1-2" <|~~o "0:*" [CompB] : funny arrow ';
        const parsed = Line.fromString(line)!;
        const expected = '   [CompB] "0:*" o~~|> "1-2" (CompA) : funny arrow ';
        parsed.reverse().toString().should.equal(expected);
    });

    it('should preserve a hidden horizontal line', () => {
        const line = 'A -[hidden] B';
        const parsed = Line.fromString(line)!;
        const expected = 'B -[hidden] A';
        parsed.reverse().toString().should.equal(expected);
    });

    it('should preserve a hidden vertical line', () => {
        const line = 'B -[hidden]- C';
        const parsed = Line.fromString(line)!;
        const expected = 'C -[hidden]- B';
        parsed.reverse().toString().should.equal(expected);
    });

    it('should preserve an elongated line', () => {
        const line = 'A ---> B';
        const parsed = Line.fromString(line)!;
        const expected = 'B <--- A';
        parsed.reverse().toString().should.equal(expected);
    });

    it('should preserve an elongated line also when rotating', () => {
        const line = 'A .... B';
        const parsed = Line.fromString(line)!;
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
        for (const s of ['left', 'le', 'l']) {
            const line = `A -${s}-> B`;
            const parsed = Line.fromString(line)!;
            const expected = "B <- A";
            parsed.toString().should.equal(expected);
        }
    });

    it('should preserve explicit direction up', () => {
        for (const s of ['up', 'u']) {
            const line = `A -${s}-> B`;
            const parsed = Line.fromString(line)!;
            const expected = "B <-- A";
            parsed.toString().should.equal(expected);
        }
    });

    it('should preserve explicit direction right', () => {
        for (const s of ['right', 'ri', 'r']) {
            const line = `A -${s}-> B`;
            const parsed = Line.fromString(line)!;
            const expected = "A -> B";
            parsed.toString().should.equal(expected);
        }
    });

    it('should preserve explicit direction down', () => {
        for (const s of ['down', 'do', 'd']) {
            const line = `A -${s}-> B`;
            const parsed = Line.fromString(line)!;
            const expected = "A --> B";
            parsed.toString().should.equal(expected);
        }
    });

    it("should parse a component with arrow with no spaces", () => {
        for (const [left, right] of [["A", "B"], ["A", "ABC"], ["ABC", "ABC"], ["ABC", "A"]]) {
            for (const arrow of ['->', '<-', '-->', '<--']) {
                const line = `${left}${arrow}${right}`;
                const expected = `${left} ${arrow} ${right}`;
                const parsed = Line.fromString(line)!;
                parsed.toString().should.equal(expected);
            }
        }
    });

});
