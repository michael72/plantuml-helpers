import { expect, should } from 'chai';
import * as reformat from "../src/reformat";
should();

describe("Reformat", () => {

	it ("should not crash when sorting an empty string", () => {
		expect(reformat.autoFormatTxt("")).to.be.equal("");
	});

	it ("should not crash when no sortable content", () => {
		let chk = "Hello World!";
		expect(reformat.autoFormatTxt(chk)).to.be.equal(chk);
	});

	it("should order depending lines from -> to", () => {
		let lines = ['[B] -> [C]', '[A] -> [B]'];
		let orig = lines.join("\n");
		let expected = lines.reverse().join("\n");
		expect(reformat.autoFormatTxt(orig)).to.be.equal(expected);
	});

	it("should leave the order intact when there is nothing to sort", () => {
		let lines = ['[C] -> [B]', '[A] -> [B]'];
		let orig = lines.join("\n");
		expect(reformat.autoFormatTxt(orig)).to.be.equal(orig);
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

	it("should auto format inheritance vertical up", () => {
		reformat.autoFormatTxt("A -|> B ").should.equal("B <|-- A ");
	});

	it ("should leave inheritance down when it is down", () => {
		reformat.autoFormatTxt("A --|> B").should.equal("A --|> B");
	});

	it("should auto format composition horizontal right", () => {
		let original = "A *--> B\n" +
			"D o--> A";
		let expected = "D o-> A\n" +
			"A *-> B";
		let actual = reformat.autoFormatTxt(original);
		actual.should.equal(expected);
	});

	it("should leave notes at their positions", () => {
		let original = "A *--> B\n" +
			"note right: this is A\n" +
			"note left: and another note\n" +
			"D *-> A\n";
		let expected = "D *-> A\n" +
			"A *-> B\n" +
			"note right: this is A\n" +
			"note left: and another note\n";
		let actual = reformat.autoFormatTxt(original);
		actual.should.equal(expected);
	});

	it("should leave forward declarations at the beginning", () => {
		let original = "[A] as compA\n" +
			"note right: this is compA\n" +
			"A *--> B\n" +
			"D *-> A\n";
		let expected = "component A as compA\n" +
			"note right: this is compA\n" +
			"D *-> A\n" + 
			"A *-> B\n";

		let actual = reformat.autoFormatTxt(original);
		actual.should.equal(expected);
	});

});
