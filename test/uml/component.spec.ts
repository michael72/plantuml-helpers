/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Component } from "../../src/uml/component";
import { Definition } from "../../src/uml/definition";

import { should } from "chai";
import { strictEqual } from "assert";
should();

describe("Component", () => {
  describe("Component class", () => {
    it("should parse a package", () => {
      const original =
        'package "fun" {\n' +
        "  component A\n" +
        "  note right: this is A\n" +
        "  A *--> B\n" +
        "  D *-> A\n" +
        "}\n";
      const parsed = Component.fromString(original);
      parsed.name!.should.equal("fun");
      parsed.type!.should.equal("package");
      parsed.content.length.should.equal(3); // note is attached to the component
      parsed.toString().should.equal(original);
    });
    it("should parse a package with `}` in next line", () => {
      const original = ["package bla <<something>>", "{", "[A]", "}"];
      // { is moved up when converting back to string - hence:
      const expected =
        "package bla <<something>> {\n" + "  component A\n" + "}\n";
      const parsed = Component.fromString(original);
      parsed.name!.should.equal("bla");
      parsed.type!.should.equal("package");
      parsed.content.length.should.equal(1);
      parsed.toString().should.equal(expected);
    });
    it("should parse an empty package", () => {
      const original = "package {\n}\n";
      const parsed = Component.fromString(original);
      const actual = parsed.toString();

      actual.should.equal(original);
    });
    it("should parse two sibling packages", () => {
      const original =
        "package a {\n" +
        "  component A\n" +
        "}\n" +
        "package b {\n" +
        "  [A] -> [B]\n" +
        "}";
      const expected = original;
      const parsed = Component.fromString(original);
      const actual = parsed.toString();
      actual.should.equal(expected);
    });
    it("should parse a nested component", () => {
      const original =
        'package "a" {\n' +
        " component A\n" +
        " interface IA\n" +
        ' package "b" {\n' +
        "   interface IB\n" +
        "   component B\n" +
        " }\n" +
        ' package "c" {\n' +
        "   interface IC\n" +
        "   component C\n" +
        "  package inner {\n" +
        "  }\n" +
        " }\n" +
        "\n" +
        " IA <|-- A\n" +
        " IB <|-- B\n" +
        " IC <|-- C\n" +
        "\n" +
        " A o-> IB\n" +
        " B o-> IC\n" +
        "}\n";
      const parsed = Component.fromString(original);
      const actual = parsed.toString();
      const expected =
        'package "a" {\n' +
        "  component A\n" +
        "  interface IA\n" +
        '  package "b" {\n' +
        "    interface IB\n" +
        "    component B\n" +
        "  }\n" +
        '  package "c" {\n' +
        "    interface IC\n" +
        "    component C\n" +
        "    package inner {\n" +
        "    }\n" +
        "  }\n" +
        "  IA <|-- A\n" +
        "  IB <|-- B\n" +
        "  IC <|-- C\n" +
        "  A o-> IB\n" +
        "  B o-> IC\n" +
        "}\n";
      actual.should.equal(expected);
    });
  });
  describe("Definition class", () => {
    it("should parse component definitions", () => {
      const c1 = Definition.fromString("[First component]")!;
      c1.type.should.equal("component");
      c1.name.should.equal("First component");
      strictEqual(c1.alias, undefined);

      const c2 = Definition.fromString("[Another component] as Comp2")!;
      c2.type.should.equal("component");
      c2.name.should.equal("Another component");
      c2.alias!.should.equal("Comp2");

      const c3 = Definition.fromString("component Comp3")!;
      c3.type.should.equal("component");
      c3.name.should.equal("Comp3");
      strictEqual(c3.alias, undefined);

      const c4 = Definition.fromString("component [Last\tcomponent] as Comp4")!;
      c4.type.should.equal("component");
      c4.name.should.equal("Last\tcomponent");
      c4.alias!.should.equal("Comp4");
    });

    it("should parse an interface definition", () => {
      const c1 = Definition.fromString('() "First Interface"')!;
      c1.type.should.equal("interface");
      c1.name.should.equal("First Interface");
      strictEqual(c1.alias, undefined);

      const c2 = Definition.fromString('() "Another interface" as Interf2')!;
      c2.type.should.equal("interface");
      c2.name.should.equal("Another interface");
      c2.alias!.should.equal("Interf2");

      const c3 = Definition.fromString("interface Interf3")!;
      c3.type.should.equal("interface");
      c3.name.should.equal("Interf3");
      strictEqual(c3.alias, undefined);

      const c4 = Definition.fromString(
        'interface "Last\\ninterface" as Interf4'
      )!;
      c4.type.should.equal("interface");
      c4.name.should.equal("Last\\ninterface");
      c4.alias!.should.equal("Interf4");
    });

    it("should not parse an invalid definition", () => {
      ["a b c", "ABC", 'package "blub"', "interf as bla"].forEach(
        (s: string) => {
          const def = Definition.fromString(s);
          strictEqual(def, undefined);
        }
      );
    });
  });
});
