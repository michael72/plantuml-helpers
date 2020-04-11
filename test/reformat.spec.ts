import { expect } from 'chai';
import * as reformat from "../src/reformat";

describe("Reformat", () => {
	it("should order depending lines from -> to", () => {
		let lines = ['[B] -> [C]', '[A] -> [B]'];
	        let orig = lines.join("\n");
		let expected = lines.reverse().join("\n");
		expect(reformat.autoFormatTxt(orig)).to.be.equal(expected);
	});
});
