import { equal } from "assert";
import * as reformat from "../src/reformat";

describe("Reformat", () => {
	it("should order depending lines from -> to", () => {
		let lines = ['[B] -> [C]', '[A] -> [B]'];
	        let orig = lines.join("\n");
		let expected = lines.reverse().join("\n");
		equal(reformat.autoFormatTxt(orig), expected);
	});
});
