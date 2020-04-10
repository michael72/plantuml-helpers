import * as assert from 'assert';
import * as uml from '../../uml';

suite('UML Test Suite', () => {

    test('parse arrow', () => {
        let arrow = uml.Arrow.fromString("->");
        assert.equal(arrow?.direction, uml.Direction.Right);
        assert.equal(arrow?.left, "");
        assert.equal(arrow?.line, "-");
        assert.equal(arrow?.right, ">");
        assert.equal(arrow?.layout, uml.Layout.Horizontal);
    });

    test('parse left arrow', () => {
        let arrow = uml.Arrow.fromString("<~~");
        assert.equal(arrow?.direction, uml.Direction.Left);
        assert.equal(arrow?.left, "<");
        assert.equal(arrow?.line, "~");
        assert.equal(arrow?.right, "");
        assert.equal(arrow?.layout, uml.Layout.Vertical);
    });

    test('arrow toString', () => {
        let arrows = ["->", "-->", "<-", "<~", "<|-", "o->>"];
        arrows.forEach((arrow: string) => {
            assert.equal(uml.Arrow.fromString(arrow)?.toString(), arrow, "converting '" + arrow + "' failed");
        });
    });

    test('reverse arrow', () => {
        let arrows: Array<[string, string]>
            = [["->", "<-"], ["<~~", "~~>"], ["<|-", "-|>"], ["o->", "<-o"]];
        arrows.forEach((arrowOp: [string, string]) => {
            let [fwd, rev] = arrowOp;
            assert.equal(uml.Arrow.fromString(fwd)?.reverse().toString(), rev);
            assert.equal(uml.Arrow.fromString(rev)?.reverse().toString(), fwd);
        });
    });

});
