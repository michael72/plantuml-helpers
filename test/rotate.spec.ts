import { describe, it, expect } from "vitest";
import * as r from "../src/rotate";

describe("Rotate", () => {
  it("should rotate arrows", () => {
    expect(r.rotateLine("", r.RotateDirection.Right)).toBe("");
    expect(r.rotateLine("A --> B : hello", r.RotateDirection.Swap)).toBe(
      "B <-- A : hello"
    );
    expect(r.rotateLine("  A --> B : hello", r.RotateDirection.Right)).toBe(
      "  B <- A : hello"
    );
    expect(r.rotateLine("\tA -> B", r.RotateDirection.Left)).toBe("\tB <-- A");
    expect(r.rotateLine("[Main] ..> App : use", r.RotateDirection.Swap)).toBe(
      "App <.. [Main] : use"
    );
    expect(
      r.rotateLine("    Main <.  [App]   : register", r.RotateDirection.Swap)
    ).toBe("    [App] .> Main   : register");
  });

  it("will format to only 1 space in the arrow", () => {
    // spaces are added automatically
    expect(r.rotateLine("A->B", r.RotateDirection.Swap)).toBe("B <- A");
    // spaces may also be removed
    expect(r.rotateLine("A ..  B", r.RotateDirection.Right)).toBe("B . A");
  });

  it("should rotate an asymetrical arrow", () => {
    expect(r.rotateLine("   B <|-- A", r.RotateDirection.Swap)).toBe(
      "   A --|> B"
    );
  });

  it("should rotate arrows with multiplicities", () => {
    expect(
      r.rotateLine('   B "1-2" <- "0:*" D : chk', r.RotateDirection.Left)
    ).toBe('   D "0:*" --> "1-2" B : chk');
    // o-|> isn't a real arrow, but just for testing...
    expect(r.rotateLine('A "0" o-|> "1-2" B', r.RotateDirection.Swap)).toBe(
      'B "1-2" <|-o "0" A'
    );
    expect(
      r.rotateLine('(IBar) "*" <-o "1" [Foo]', r.RotateDirection.Right)
    ).toBe('(IBar) "*" <--o "1" [Foo]');
  });

  it("should keep arrow direction in labels", () => {
    expect(
      r.rotateLine("Car *- Wheel : have 4 >", r.RotateDirection.Swap)
    ).toBe("Wheel -* Car : have 4 <");
  });
});
