import * as assert from 'assert';
import * as reformat from '../../reformat';

suite('Extension Test Suite', () => {

	test('depending lines ordered from -> to', () => {
        let lines = ['[B] -> [C]', '[A] -> [B]'];
        let orig = lines.join("\n");
        let expected = lines.reverse().join("\n");
        assert.equal(reformat.autoFormatTxt(orig), expected);
	});
});

