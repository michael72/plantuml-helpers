import { expect } from 'chai';
import * as reformat from "../src/reformat";

describe("Reformat", () => {
	it("should order depending lines from -> to", () => {
		let lines = ['[B] -> [C]', '[A] -> [B]'];
		let orig = lines.join("\n");
		let expected = lines.reverse().join("\n");
		expect(reformat.autoFormatTxt(orig)).to.be.equal(expected);
	});

	it("should draw inheritance vertical up, others horizontal", () => {
		let original =
			"[Src] o-> [MyDerived2]\n" +
			"[Derived] o-> Db\n" +
			"[Foo] -|> IFoo\n" +
			"[Foo] o-> [Proxy]\n" +
			"[MyDerived2] -|> [Base]\n" +
			"[Proxy] o-> [MyDerived1]\n" +
			"IFoo o-> IBase\n" +
			"IBase <-o [Base]\n" + // subtle change in direction here
			"[MyDerived1] -|> [Base]\n" +
			"[Derived] -|> IBase\n";

		let expected =
			"IFoo o-> IBase\n" +
			"IFoo <|-- [Foo]\n" +
			"IBase <-o [Base]\n" +
			"IBase <|-- [Derived]\n" +
			"[Foo] o-> [Proxy]\n" +
			"[Base] <|-- [MyDerived2]\n" +
			"[Base] <|-- [MyDerived1]\n" +
			"[Derived] o-> Db\n" +
			"[Proxy] o-> [MyDerived1]\n" +
			"[Src] o-> [MyDerived2]\n";

		let actual = reformat.autoFormatTxt(original);
		expect(actual).to.be.equal(expected);

	});
});
