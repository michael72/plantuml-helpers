import { describe, it, expect } from "vitest";
import { formatMarkdownContent, formatPlantUmlContent } from "../src/cliFormat";

describe("formatPlantUmlContent", () => {
  it("should format a bare diagram without @startuml markers", () => {
    const original = "[B] -> [C]\n[A] -> [B]\n";
    const expected = "[A] -> [B]\n[B] -> [C]\n";
    const result = formatPlantUmlContent(original);
    expect(result.text).toBe(expected);
    expect(result.found).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it("should report an unchanged diagram", () => {
    const original = "[A] -> [B]\n[B] -> [C]\n";
    const result = formatPlantUmlContent(original);
    expect(result.text).toBe(original);
    expect(result.found).toBe(1);
    expect(result.changed).toBe(0);
  });

  it("should format a diagram inside @startuml markers", () => {
    const original = "@startuml\n[B] -> [C]\n[A] -> [B]\n@enduml\n";
    // the formatter separates the markers with blank lines
    const expected = "@startuml\n\n[A] -> [B]\n[B] -> [C]\n\n@enduml\n";
    const result = formatPlantUmlContent(original);
    expect(result.text).toBe(expected);
    expect(result.found).toBe(1);
    expect(result.changed).toBe(1);
  });

  it("should format each diagram in a multi-diagram file separately", () => {
    const original = [
      "@startuml first",
      "[B] -> [C]",
      "[A] -> [B]",
      "@enduml",
      "some text in between",
      "@startuml second",
      "[Y] -> [Z]",
      "[X] -> [Y]",
      "@enduml",
      "",
    ].join("\n");
    const result = formatPlantUmlContent(original);
    expect(result.found).toBe(2);
    expect(result.changed).toBe(2);
    expect(result.text).toContain("some text in between");
    expect(result.text.indexOf("[A] -> [B]")).toBeLessThan(
      result.text.indexOf("[B] -> [C]")
    );
    expect(result.text.indexOf("[X] -> [Y]")).toBeLessThan(
      result.text.indexOf("[Y] -> [Z]")
    );
  });

  it("should reset arrow directions with rebuild", () => {
    // autoFormat keeps the explicit downward inheritance, reset rebuilds it
    const original = "A --|> B";
    expect(formatPlantUmlContent(original, false).text).toBe("A --|> B");
    expect(formatPlantUmlContent(original, true).text).toBe("B <|-- A");
  });

  it("should collect a warning for content that cannot be formatted", () => {
    const original = "Hello World!\n";
    const result = formatPlantUmlContent(original);
    expect(result.text).toBe(original);
    expect(result.changed).toBe(0);
    expect(result.warnings).toHaveLength(1);
  });

  it("should preserve CRLF line endings", () => {
    const original = "[B] -> [C]\r\n[A] -> [B]\r\n";
    const result = formatPlantUmlContent(original);
    expect(result.text).toBe("[A] -> [B]\r\n[B] -> [C]\r\n");
  });
});

describe("formatMarkdownContent", () => {
  it("should format plantuml code blocks and leave other content alone", () => {
    const original = [
      "# Title",
      "",
      "```plantuml",
      "[B] -> [C]",
      "[A] -> [B]",
      "```",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
    ].join("\n");
    const expected = [
      "# Title",
      "",
      "```plantuml",
      "[A] -> [B]",
      "[B] -> [C]",
      "```",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
    ].join("\n");
    const result = formatMarkdownContent(original);
    expect(result.text).toBe(expected);
    expect(result.found).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it("should support the puml fence info string", () => {
    const original = ["```puml", "[B] -> [C]", "[A] -> [B]", "```", ""].join(
      "\n"
    );
    const result = formatMarkdownContent(original);
    expect(result.text).toContain("[A] -> [B]\n[B] -> [C]");
    expect(result.found).toBe(1);
  });

  it("should format multiple plantuml blocks", () => {
    const original = [
      "```plantuml",
      "[B] -> [C]",
      "[A] -> [B]",
      "```",
      "text",
      "```plantuml",
      "[Y] -> [Z]",
      "[X] -> [Y]",
      "```",
      "",
    ].join("\n");
    const result = formatMarkdownContent(original);
    expect(result.found).toBe(2);
    expect(result.changed).toBe(2);
    expect(result.text.indexOf("[A] -> [B]")).toBeLessThan(
      result.text.indexOf("[B] -> [C]")
    );
    expect(result.text.indexOf("[X] -> [Y]")).toBeLessThan(
      result.text.indexOf("[Y] -> [Z]")
    );
  });

  it("should not report changes for markdown without plantuml blocks", () => {
    const original = "# Just text\n\nNothing to do here.\n";
    const result = formatMarkdownContent(original);
    expect(result.text).toBe(original);
    expect(result.found).toBe(0);
    expect(result.changed).toBe(0);
  });

  it("should warn about a block with unsupported content and keep it", () => {
    const original = ["```plantuml", "(Use Case)", "```", ""].join("\n");
    const result = formatMarkdownContent(original);
    expect(result.text).toBe(original);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("diagram at line 2");
  });

  it("should warn about an unterminated plantuml block and keep the file", () => {
    const original = ["```plantuml", "[A] -> [B]", ""].join("\n");
    const result = formatMarkdownContent(original);
    expect(result.text).toBe(original);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("unterminated");
  });

  it("should skip empty plantuml blocks", () => {
    const original = ["```plantuml", "```", ""].join("\n");
    const result = formatMarkdownContent(original);
    expect(result.text).toBe(original);
    expect(result.found).toBe(0);
  });

  it("should handle tilde fences and longer fences", () => {
    const original = [
      "~~~plantuml",
      "[B] -> [C]",
      "[A] -> [B]",
      "~~~",
      "````plantuml",
      "[D] -> [E]",
      "[C] -> [D]",
      "````",
      "",
    ].join("\n");
    const result = formatMarkdownContent(original);
    expect(result.found).toBe(2);
    expect(result.text.indexOf("[A] -> [B]")).toBeLessThan(
      result.text.indexOf("[B] -> [C]")
    );
    expect(result.text.indexOf("[C] -> [D]")).toBeLessThan(
      result.text.indexOf("[D] -> [E]")
    );
  });

  it("should ignore plantuml-looking fences inside other code blocks", () => {
    const original = [
      "````md",
      "```plantuml",
      "[B] -> [C]",
      "[A] -> [B]",
      "```",
      "````",
      "",
    ].join("\n");
    const result = formatMarkdownContent(original);
    // the outer ````md block ends at the first ```` line; the inner
    // ```plantuml fence is closed by the ``` line, so nothing outside a
    // md block is misinterpreted
    expect(result.found).toBe(0);
    expect(result.text).toBe(original);
  });

  it("should preserve CRLF line endings in markdown", () => {
    const original = "```plantuml\r\n[B] -> [C]\r\n[A] -> [B]\r\n```\r\n";
    const result = formatMarkdownContent(original);
    expect(result.text).toBe(
      "```plantuml\r\n[A] -> [B]\r\n[B] -> [C]\r\n```\r\n"
    );
  });
});
