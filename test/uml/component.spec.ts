import { describe, it, expect } from "vitest";
import { Component } from "../../src/uml/component";
import { Definition } from "../../src/uml/definition";

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
      expect(parsed.name!).toBe("fun");
      expect(parsed.type!).toBe("package");
      expect(parsed.content.length).toBe(3); // note is attached to the component
      expect(parsed.toString()).toBe(original);
    });
    it("should parse a package with `}` in next line", () => {
      const original = ["package bla <<something>>", "{", "[A]", "}"];
      // { is moved up when converting back to string - hence:
      const expected =
        "package bla <<something>> {\n" + "  component A\n" + "}\n";
      const parsed = Component.fromString(original);
      expect(parsed.name!).toBe("bla");
      expect(parsed.type!).toBe("package");
      expect(parsed.content.length).toBe(1);
      expect(parsed.toString()).toBe(expected);
    });
    it("should parse an empty package", () => {
      const original = "package {\n}\n";
      const parsed = Component.fromString(original);
      const actual = parsed.toString();

      expect(actual).toBe(original);
    });
    it("should parse an empty array", () => {
      const parsed = Component.fromString(["", ""], true);
      const actual = parsed.toString();

      expect(actual).toBe("");
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
      expect(actual).toBe(expected);
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
      expect(actual).toBe(expected);
    });
  });
  describe("Definition class", () => {
    it("should parse component definitions", () => {
      const c1 = Definition.fromString("[First component]")!;
      expect(c1.type).toBe("component");
      expect(c1.name).toBe("First component");
      expect(c1.alias).toBe(undefined);

      const c2 = Definition.fromString("[Another component] as Comp2")!;
      expect(c2.type).toBe("component");
      expect(c2.name).toBe("Another component");
      expect(c2.alias!).toBe("Comp2");

      const c3 = Definition.fromString("component Comp3")!;
      expect(c3.type).toBe("component");
      expect(c3.name).toBe("Comp3");
      expect(c3.alias).toBe(undefined);

      const c4 = Definition.fromString("component [Last\tcomponent] as Comp4")!;
      expect(c4.type).toBe("component");
      expect(c4.name).toBe("Last\tcomponent");
      expect(c4.alias!).toBe("Comp4");
    });

    it("should parse an interface definition", () => {
      const c1 = Definition.fromString('() "First Interface"')!;
      expect(c1.type).toBe("interface");
      expect(c1.name).toBe("First Interface");
      expect(c1.alias).toBe(undefined);

      const c2 = Definition.fromString('() "Another interface" as Interf2')!;
      expect(c2.type).toBe("interface");
      expect(c2.name).toBe("Another interface");
      expect(c2.alias!).toBe("Interf2");

      const c3 = Definition.fromString("interface Interf3")!;
      expect(c3.type).toBe("interface");
      expect(c3.name).toBe("Interf3");
      expect(c3.alias).toBe(undefined);

      const c4 = Definition.fromString(
        'interface "Last\\ninterface" as Interf4'
      )!;
      expect(c4.type).toBe("interface");
      expect(c4.name).toBe("Last\\ninterface");
      expect(c4.alias!).toBe("Interf4");
    });

    it("should not parse an invalid definition", () => {
      ["a b c", "ABC", 'package "blub"', "interf as bla"].forEach(
        (s: string) => {
          const def = Definition.fromString(s);
          expect(def).toBe(undefined);
        }
      );
    });
  });
});
