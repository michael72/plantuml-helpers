import { expect, should } from "chai";
import * as reformat from "../src/reformat";
import { DiagramType } from "../src/uml/diagramtype";
should();

describe("Reformat", () => {
  it("should throw an exception when sorting an empty string", () => {
    expect(() => reformat.autoFormatTxt("")).to.throw(
      reformat.UNKNOWN_DIAGRAM_TYPE
    );
  });

  it("should throw an exception with no sortable content", () => {
    const chk = "Hello World!";
    expect(() => reformat.autoFormatTxt(chk)).to.throw(
      reformat.UNKNOWN_DIAGRAM_TYPE
    );
  });

  it("should throw an exception with an unsupported diagram type", () => {
    const chk = "(Use Case)";
    expect(() => reformat.autoFormatTxt(chk)).to.throw(
      "Unsupported diagram type: " + DiagramType.UseCase.toString()
    );
  });

  it("should order depending lines from -> to", () => {
    const lines = ["[B] -> [C]", "[A] -> [B]"];
    const orig = lines.join("\n");
    const expected = lines.reverse().join("\n");
    expect(reformat.autoFormatTxt(orig)).to.be.equal(expected);
  });

  it("should leave the order intact when there is nothing to sort", () => {
    const lines = ["[C] -> [B]", "[A] -> [B]"];
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
    const original = "A *--> B\n" + "D o--> A";
    const expected = "D o-> A\n" + "A *-> B";
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should leave notes at their positions", () => {
    const original =
      "A *--> B\n" +
      "note right: this is A\n" +
      "note left: and another note\n" +
      "D *-> A\n";
    const expected =
      "D *-> A\n" +
      "A *-> B\n" +
      "note right: this is A\n" +
      "note left: and another note\n";
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should leave forward declarations at the beginning", () => {
    const original =
      "[A] as compA\n" +
      "note right: this is compA\n" +
      "A *--> B\n" +
      "D *-> A\n";
    const expected =
      "component A as compA\n" +
      "note right: this is compA\n" +
      "D *-> [compA]\n" +
      "[compA] *-> B\n";

    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should add brackets on components where applicable", () => {
    const original =
      "[A] as compA\n" +
      "component B\n" +
      "interface IC\n" +
      "A -> B\n" +
      "compA -> [IC]\n";
    const expected =
      "component A as compA\n" +
      "component B\n" +
      "interface IC\n" +
      "[compA] -> [B]\n" +
      "[compA] -> IC\n";
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should add brackets on components - simple case", () => {
    const original = "A -> [B]\nB -> C\n";
    const expected = "A -> [B]\n[B] -> C\n";
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should sort the components with most outgoing transitive dependencies first", () => {
    const original =
      "component E\n" +
      "[C] o-> D\n" +
      "F o-> E\n" +
      "B o-> C\n" +
      "B <--o A\n";
    // A is connected (transitively) to B,C and D, F is only connected to E -> A comes first
    const expected =
      "component E\n" +
      "A o-> B\n" +
      "B o-> [C]\n" +
      "[C] o-> D\n" +
      "F o-> [E]\n";
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should reverse sort packages depending on content dependencencies", () => {
    const original =
      "package b {\n" +
      "  component B\n" +
      "}\n" +
      "package c {\n" +
      "  component C\n" +
      "}\n" +
      "package a {\n" +
      "  component A\n" +
      "}\n" +
      "[B] -> [C]\n" +
      "[A] -> [B]\n";
    const expected =
      "package c {\n" +
      "  component C\n" +
      "}\n" +
      "package b {\n" +
      "  component B\n" +
      "}\n" +
      "package a {\n" +
      "  component A\n" +
      "}\n\n" +
      "[A] -> [B]\n" +
      "[B] -> [C]\n";
    const actual = reformat.autoFormatTxt(original);
    expect(actual).to.be.equal(expected);
  });

  it("should re-arrange the package structure", () => {
    const original =
      "package foo {\n" +
      "IA <|-- [A]\n" +
      "package inner {\n" +
      "package ii2 {\n" +
      "interface IC as InterC\n" +
      "}\n" +
      "package ii1 {\n" +
      "component C\n" +
      "}\n" +
      "IC <|-- C\n" +
      "}\n" +
      "package inner2 {\n" +
      "interface D\n" +
      "}\n" +
      "}\n" +
      "package bar {\n" +
      "interface B\n" +
      "}\n" +
      "A o-> B\n" +
      "A *-> C\n" +
      "D <|-- C\n" +
      "[E] o-> F\n";
    const expected =
      "package bar {\n" +
      "  interface B\n" +
      "}\n" +
      "package foo {\n" +
      "  component A\n" +
      "  interface IA\n" +
      "  package inner2 {\n" +
      "    interface D\n" +
      "  }\n" +
      "  package inner {\n" +
      "    package ii2 {\n" +
      "      interface IC as InterC\n" +
      "    }\n" +
      "    package ii1 {\n" +
      "      component C\n" +
      "    }\n" +
      "  }\n" +
      "}\n\n" +
      "IA <|-- [A]\n" +
      "[A] o-> B\n" +
      "[A] *-> [C]\n" +
      "InterC <|-- [C]\n" +
      "D <|-- [C]\n" +
      "[E] o-> F\n";
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should re-format nested components", () => {
    const original =
      "package Foo <<bla>> #red-green {\n" + "  A -> B\n" + "}\n" + "A -> C\n";
    const expected =
      "package Foo <<bla>> #red-green {\n" +
      "  class B\n" +
      "  class A\n" +
      "}\n\n" +
      "A -> B\n" +
      "A -> C\n";
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });
  it("should reformat nested with global classes", () => {
    const original =
      "class BaseClass\n" +
      "package net.dummy #DDDDDD {\n" +
      "  BaseClass <|-- DPerson\n" +
      "}\n" +
      'package "net foo" {\n' +
      "  BaseClass <|-- Person\n" +
      "}\n" +
      '"net foo" -- net.dummy\n';
    const expected =
      'package "net foo" {\n' +
      "  class Person\n" +
      "}\n" +
      "package net.dummy #DDDDDD {\n" +
      "  class DPerson\n" +
      "}\n\n" +
      "class BaseClass\n" +
      "BaseClass <|-- DPerson\n" +
      "BaseClass <|-- Person\n" +
      '"net foo" -- net.dummy\n';
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should reformat nested empty components", () => {
    const original =
      "package foo {\n" + "  component A {\n" + "  }\n" + "}\n" + "A --|> IA\n";
    const expected =
      "package foo {\n" +
      "  component A {\n" +
      "  }\n" +
      "}\n\n" +
      "[A] --|> IA\n";
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should support namespaces", () => {
    const original = `         
class BaseClass
namespace net.foo {
  net.dummy.Person  <|- Person
  .BaseClass <|-- Person
  .net.dummy.Meeting o-- Person
}
namespace net.dummy #DDDDDD {
  class Person
  .BaseClass <|-- Person
  Meeting o-- Person
  .BaseClass <|-- Meeting
}
namespace {
  class Foo;
}
IBase <|-- BaseClass
BaseClass <|-- net.unused.Person
`;
    const expected = `namespace {
  class Foo;
}
namespace net.dummy #DDDDDD {
  class Meeting
  class Person
}
namespace net.foo {
  class Person
}

class BaseClass
IBase <|-- BaseClass
BaseClass <|-- net.unused.Person
BaseClass <|-- net.foo.Person
BaseClass <|-- net.dummy.Meeting
BaseClass <|-- net.dummy.Person
net.dummy.Meeting o- net.foo.Person
net.dummy.Person <|-- net.foo.Person
net.dummy.Meeting o- net.dummy.Person
`;
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should rearrange on reformat", () => {
    const original = `         
class BaseClass
namespace net.foo {
  net.dummy.Person  <|- Person
  .BaseClass <|-- Person
  .net.dummy.Meeting o-- Person
}
namespace net.dummy #DDDDDD {
  class Person
  .BaseClass <|-- Person
  Meeting o-- Person
  .BaseClass <|-- Meeting
}
namespace {
  class Foo;
}
IBase <|-- BaseClass
BaseClass <|-- net.unused.Person
`;
    const expected = `namespace {
  class Foo;
}
namespace net.dummy #DDDDDD {
  class Meeting
  class Person
}
namespace net.foo {
  class Person
}

class BaseClass
IBase <|-- BaseClass
BaseClass <|- net.unused.Person
net.foo.Person -|> BaseClass
net.dummy.Meeting -|> BaseClass
BaseClass <|-- net.dummy.Person
net.dummy.Meeting o- net.foo.Person
net.dummy.Person <|-- net.foo.Person
net.dummy.Meeting o- net.dummy.Person
`;
    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  });

  it("should order a sequence diagram by dependency and clean it up", () => {
    const original = `participant B
A -> B
`;
    const expected = `A -> B
`;
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should order a sequence diagram by dependency", () => {
    const original = `actor B
A -> B
`;
    const expected = `participant A
actor B
A -> B
`;
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should reformat sequence diagrams", () => {
    const original = `A -> B
B -> C
D -> A
`;

    const expected = `participant D
participant A
participant B
participant C
A -> B
B -> C
D -> A
`;
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should leave the order of disjoint participants", () => {
    const original = `A -> B
C -> D
`;

    const expected = `A -> B
C -> D
`;

    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should preserve line endings - only one", () => {
    const original = "A -> B\r\nB -> C\r\n\r\n";
    const expected = "A -> B\r\nB -> C\r\n";

    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should preserve notes", () => {
    const original = `title Foo

A -> B
note left of A: this is an A
`;
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(original);
  });

  it("should preserve notes and add footer", () => {
    const original = `title Foo

A -> B
note left of A: this is an A

footer
`;
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(original);
  });

  it("should put spaces between header, classes, connections and footer", () => {
    const original = `header
class A {
}
A -> B
footer
`;
    const expected = `header

class A {
}

A -> B

footer
`;
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });


  it("should sort classes and preserve their content", () => {
    const original = `title "some title"
hide empty members
package a
{
class A {
  + foo();
}
class B {
  + bar() : string
}
}
package c
{
  class C {
    - bla() : int
  }
}
A -> C
B -> A
`
    const expected = `title "some title"
hide empty members

package c {
  class C {
    - bla() : int
  }
}
package a {
  class A {
    + foo();
  }
  class B {
    + bar() : string
  }
}

B -> A
A -> C
`
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(expected);
  });

  it("should leave the content of a class as is", () => {
    const original = `class A {
  + foo();
}
`
    const actual = reformat.autoFormatTxt(original);
    actual.should.equal(original);
  });

  it("should reformat in all directions", () => {
    const original = `[A] -> [B]
[B] -> [C]
[C] -> [D]
[B] -> [E]
[B] -> [F]
[C] -> [G]
[C] -> [H]
[C] -> [J]
[C] -> [K]
`
    const expected = `[A] -> [B]
[E] <-- [B]
[B] --> [F]
[B] -> [C]
[D] <-- [C]
[G] <-- [C]
[C] --> [H]
[C] --> [J]
[C] -> [K]
`

    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  })

  it("should reformat 2 outgoing same arrows - first is rotated left", () => {
    const original = `[A] -> [B]
[A] -> [C]
E <|-- [F]
E <|-- [G]`
    const expected = `[A] --> [B]
[A] -> [C]
[F] -|> E
E <|-- [G]`
    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  })

  it("should reformat the doc example code", () => {
    const original = `[Camera] o-> [Commands]
[Camera] -|> ICamera
[Camera] .> IConnector
[Channel] o-> IConnector
[CommandChannel] -|> [Channel]  
[Commands] o-> [CommandChannel] 
[DataChannel] -|> [Channel]
[Connector] -|> IConnector 
[Connector] o-> Socket
[ImageProvider] o-> [DataChannel]`;
    const expected = `ICamera <|-- [Camera]
[Camera] o--> [Commands]
[Camera] .> IConnector
[Commands] o-> [CommandChannel]
[Channel] o-> IConnector
IConnector <|-- [Connector]
[CommandChannel] -|> [Channel]
[Channel] <|-- [DataChannel]
[Connector] o-> Socket
[ImageProvider] o-> [DataChannel]`;
    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  })

  it("should reformat a simple sequence diagram", () => {
    const original = `A -> C : c
A -> B : b
A -> B : bb`
    // A and B are stronger connected than A and C
    const expected = `participant A
participant B
participant C
A -> C : c
A -> B : b
A -> B : bb`
    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  })

  it("should leave simple outgoing and incoming connections", () => {
    const original = `-> A
A ->`
    const expected = `-> A
A ->`
    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  })

  it("should remove brackets of outgoing and incoming connections", () => {
    const original = `[ -> A
A -> ]`
    const expected = `-> A
A ->`
    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  })

  it("should leave return arrows as is", () => {
    const original = `A -> B
A <-- B`
    const expected = `A -> B
A <-- B`
    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  })

  it("should consider ... (dot dot dot)", () => {
    const original = `A -> B
...
A <-- B`
    const expected = `A -> B
...
A <-- B`
    const actual = reformat.autoFormatTxt(original, true);
    actual.should.equal(expected);
  })
});
