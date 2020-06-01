import { expect, should } from 'chai';
import * as reformat from "../src/reformat";
should();

describe("Reformat", () => {

	it("should not crash when sorting an empty string", () => {
		expect(reformat.autoFormatTxt("")).to.be.equal("");
	});

	it("should not crash when no sortable content", () => {
		const chk = "Hello World!";
		expect(reformat.autoFormatTxt(chk)).to.be.equal(chk);
	});

	it("should order depending lines from -> to", () => {
		const lines = ['[B] -> [C]', '[A] -> [B]'];
		const orig = lines.join("\n");
		const expected = lines.reverse().join("\n");
		expect(reformat.autoFormatTxt(orig)).to.be.equal(expected);
	});

	it("should leave the order intact when there is nothing to sort", () => {
		const lines = ['[C] -> [B]', '[A] -> [B]'];
		const orig = lines.join("\n");
		expect(reformat.autoFormatTxt(orig)).to.be.equal(orig);
	});

	it("should draw inheritance vertical up, others horizontal", () => {
		const original =
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

		const expected =
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

		const actual = reformat.autoFormatTxt(original);
		expect(actual).to.be.equal(expected);

	});

	it("should auto format inheritance vertical up", () => {
		reformat.autoFormatTxt("A -|> B ").should.equal("B <|-- A ");
	});

	it("should leave inheritance down when it is down", () => {
		reformat.autoFormatTxt("A --|> B").should.equal("A --|> B");
	});

	it("should auto format composition horizontal right", () => {
		const original = "A *--> B\n" +
			"D o--> A";
		const expected = "D o-> A\n" +
			"A *-> B";
		const actual = reformat.autoFormatTxt(original);
		actual.should.equal(expected);
	});

	it("should leave notes at their positions", () => {
		const original = "A *--> B\n" +
			"note right: this is A\n" +
			"note left: and another note\n" +
			"D *-> A\n";
		const expected = "D *-> A\n" +
			"A *-> B\n" +
			"note right: this is A\n" +
			"note left: and another note\n";
		const actual = reformat.autoFormatTxt(original);
		actual.should.equal(expected);
	});

	it("should leave forward declarations at the beginning", () => {
		const original = "[A] as compA\n" +
			"note right: this is compA\n" +
			"A *--> B\n" +
			"D *-> A\n";
		const expected = "component A as compA\n" +
			"note right: this is compA\n" +
			"D *-> [compA]\n" +
			"[compA] *-> B\n";

		const actual = reformat.autoFormatTxt(original);
		actual.should.equal(expected);
	});

	it("should add brackets on components where applicable", () => {
		const original = "[A] as compA\n" +
			"component B\n" +
			"interface IC\n" +
			"A -> B\n" +
			"compA -> [IC]\n";
		const expected = "component A as compA\n" +
			"component B\n" +
			"interface IC\n" +
			"[compA] -> [B]\n" +
			"[compA] -> IC\n";
		const actual = reformat.autoFormatTxt(original);
		actual.should.equal(expected);
	});

	it("should re-arrange the package structure", () => {
		const original = "package foo {\n" +
			"component A\n" +
			"interface IA\n" +
			"IA <|-- A\n" +
			"package inner {\n" +
			"interface IC as InterC\n" +
			"component C\n" +
			"IC <|-- C\n" +
			"}\n" +
			"package inner2 {\n" +
			"}\n" +
			"}\n" +
			"package bar {\n" +
			"interface B\n" + 
			"}\n" +
			"A o-> B\n" +
			"A *-> C\n";
		const expected = "package foo {\n" + 
		"  component A\n" + 
		"  interface IA\n" + 
		"  package inner {\n" + 
		"    interface IC as InterC\n" + 
		"    component C\n" + 
		"  }\n" + 
		"  package inner2 {\n" +
		"  }\n" +
		"}\n" + 
		"package bar {\n" + 
		"  interface B\n" + 
		"}\n" + 
		"IA <|-- [A]\n" + 
		"[A] o-> B\n" + 
		"[A] *-> [C]\n" + 
		"InterC <|-- [C]\n";
		const actual = reformat.autoFormatTxt(original);
		actual.should.equal(expected);
	});

});
