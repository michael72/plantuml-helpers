import { Component } from '../../src/uml/component';

import { should } from 'chai';
should();

describe("Component class", () => {
    it("should parse a package", () => {
        let original =
            'package "fun" {\n' +
            "  [A]\n" +
            "  note right: this is A\n" +
            "  A *--> B\n" +
            "  D *-> A\n" +
            "}\n";
        let parsed = Component.fromString(original);
        parsed.name!.should.equal("fun");
        parsed.type!.should.equal("package");
        parsed.content.length.should.equal(4);
        parsed.toString().should.equal(original);
    });
    it("should parse a package - } in next line", () => {
        let original = 'package bla <<something>>\n' +
            '{\n' +
            "  [A]\n" +
            "}";
        // { is moved up when converting back to string - hence:
        let expected = 'package bla <<something>> {\n' +
            "  [A]\n" +
            "}\n";
        let parsed = Component.fromString(original);
        parsed.name!.should.equal("bla");
        parsed.type!.should.equal("package");
        parsed.content.length.should.equal(1);
        parsed.toString().should.equal(expected);
    });
    it("should parse an empty package", () => {
        // kind of a special case (normally there is content): needs an extra blank line
        let original = 'package {\n\n}\n';
        let parsed = Component.fromString(original);
        let actual = parsed.toString();

        actual.should.equal(original);
    });
});
