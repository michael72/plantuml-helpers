import { equal } from 'assert';
import * as uml from '../src/uml';

describe('UML parser', () => {

    it ('parse an arrow', () => {
        let arrow = uml.Arrow.fromString("->");
        equal(arrow?.direction, uml.Direction.Right);
        equal(arrow?.left, "");
        equal(arrow?.line, "-");
        equal(arrow?.right, ">");
        equal(arrow?.layout, uml.Layout.Horizontal);
    });

    it('should parse a left arrow', () => {
        let arrow = uml.Arrow.fromString("<~~");
        equal(arrow?.direction, uml.Direction.Left);
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
