import { describe, it, expect } from "vitest";
import { encodePlantUml } from "../src/plantumlEncoder";

describe("encodePlantUml", () => {
  describe("basic encoding", () => {
    it("should encode a simple diagram", () => {
      const input = "@startuml\nA -> B\n@enduml";
      const result = encodePlantUml(input);

      // Result should be non-empty string
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("should produce consistent output for same input", () => {
      const input = "@startuml\nBob -> Alice: Hello\n@enduml";
      const result1 = encodePlantUml(input);
      const result2 = encodePlantUml(input);

      expect(result1).toBe(result2);
    });

    it("should produce different output for different inputs", () => {
      const input1 = "@startuml\nA -> B\n@enduml";
      const input2 = "@startuml\nC -> D\n@enduml";

      const result1 = encodePlantUml(input1);
      const result2 = encodePlantUml(input2);

      expect(result1).not.toBe(result2);
    });
  });

  describe("output format", () => {
    it("should only contain valid PlantUML base64 characters", () => {
      const input = "@startuml\nactor User\nUser -> System: Request\n@enduml";
      const result = encodePlantUml(input);

      // PlantUML uses: 0-9, A-Z, a-z, -, _
      const validPattern = /^[0-9A-Za-z\-_]+$/;
      expect(result).toMatch(validPattern);
    });

    it("should not contain standard base64 special characters", () => {
      const input = "@startuml\nClass1 -> Class2\n@enduml";
      const result = encodePlantUml(input);

      // Should not contain + or / (standard base64) or = (padding)
      expect(result).not.toContain("+");
      expect(result).not.toContain("/");
      expect(result).not.toContain("=");
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      const result = encodePlantUml("");

      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("should handle single character", () => {
      const result = encodePlantUml("A");

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });

    it("should handle whitespace only", () => {
      const result = encodePlantUml("   \n\t  ");

      expect(result).toBeTruthy();
    });
  });

  describe("unicode support", () => {
    it("should handle unicode characters", () => {
      const input = "@startuml\nユーザー -> システム: リクエスト\n@enduml";
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });

    it("should handle emoji", () => {
      const input = "@startuml\nnote right: Hello 👋\n@enduml";
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });

    it("should handle mixed ASCII and unicode", () => {
      const input = "@startuml\nUser -> Système: Héllo Wörld\n@enduml";
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });
  });

  describe("various diagram types", () => {
    it("should encode sequence diagram", () => {
      const input = `@startuml
Alice -> Bob: Authentication Request
Bob --> Alice: Authentication Response
Alice -> Bob: Another authentication Request
Alice <-- Bob: another authentication Response
@enduml`;
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });

    it("should encode class diagram", () => {
      const input = `@startuml
class Car {
  +String brand
  +int wheels
  +void drive()
}
class Engine {
  +int horsepower
}
Car *-- Engine
@enduml`;
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });

    it("should encode activity diagram", () => {
      const input = `@startuml
start
:Step 1;
if (condition?) then (yes)
  :Step 2;
else (no)
  :Step 3;
endif
stop
@enduml`;
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });

    it("should encode use case diagram", () => {
      const input = `@startuml
left to right direction
actor Guest as g
package Professional {
  actor Chef as c
  actor "Sous Chef" as sc
}
g --> (Order food)
c --> (Prepare ingredients)
@enduml`;
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });
  });

  describe("special characters", () => {
    it("should handle quotes and brackets", () => {
      const input = '@startuml\nnote: "hello {world} [test]"\n@enduml';
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });

    it("should handle arrows with various styles", () => {
      const input = `@startuml
A -> B
A --> B
A ->> B
A -->> B
A <-> B
@enduml`;
      const result = encodePlantUml(input);

      expect(result).toBeTruthy();
    });

    it("should handle newlines in different formats", () => {
      const inputLF = "@startuml\nA -> B\n@enduml";
      const inputCRLF = "@startuml\r\nA -> B\r\n@enduml";

      const resultLF = encodePlantUml(inputLF);
      const resultCRLF = encodePlantUml(inputCRLF);

      // Both should encode successfully (but may produce different results)
      expect(resultLF).toBeTruthy();
      expect(resultCRLF).toBeTruthy();
    });
  });

  describe("compression behavior", () => {
    it("should produce compact output for repetitive content", () => {
      // Compression should help with repetitive content
      const repetitive = "@startuml\n" + "A -> B\n".repeat(100) + "@enduml";
      const result = encodePlantUml(repetitive);

      // Should be much shorter than input due to compression
      expect(result.length).toBeLessThan(repetitive.length);
    });

    it("should handle very long input", () => {
      const longContent =
        "@startuml\n" +
        Array.from({ length: 500 }, (_, i) => `Class${i} -> Class${i + 1}`).join(
          "\n"
        ) +
        "\n@enduml";

      const result = encodePlantUml(longContent);

      expect(result).toBeTruthy();
      expect(result).toMatch(/^[0-9A-Za-z\-_]+$/);
    });
  });
});
