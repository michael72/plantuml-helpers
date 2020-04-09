import * as assert from 'assert';
import * as helpers from '../../helpers';

suite('Helpers Test Suite', () => {

	test('reverse head', () => {
        assert.equal(helpers.reverseHead("<--"), ">--");
        assert.equal(helpers.reverseHead("<"), ">");
        assert.equal(helpers.reverseHead("?!"), "?!");
    });    
});
