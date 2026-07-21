import { describe, it, expect, vi } from "vitest";

// The completion module imports `vscode` at the top level. The function under
// test (`isInsidePlantumlFence`) is pure and never touches the API, so an empty
// stub is enough to let the module load.
vi.mock("vscode", () => ({}));

import { isInsidePlantumlFence } from "../src/completion";

function lines(text: string): string[] {
  return text.split("\n");
}

describe("isInsidePlantumlFence", () => {
  const doc = lines(
    [
      "# Title", // 0
      "", // 1
      "```plantuml", // 2
      "@startuml", // 3
      "A -> B", // 4
      "@enduml", // 5
      "```", // 6
      "", // 7
      "some prose", // 8
      "```puml", // 9
      "C -> D", // 10
      "```", // 11
      "```ts", // 12
      "const x = 1;", // 13
      "```", // 14
    ].join("\n")
  );

  it("returns true for lines within a ```plantuml block", () => {
    expect(isInsidePlantumlFence(doc, 3)).toBe(true);
    expect(isInsidePlantumlFence(doc, 4)).toBe(true);
    expect(isInsidePlantumlFence(doc, 5)).toBe(true);
  });

  it("returns true within a ```puml block", () => {
    expect(isInsidePlantumlFence(doc, 10)).toBe(true);
  });

  it("returns false for the fence marker lines themselves", () => {
    expect(isInsidePlantumlFence(doc, 2)).toBe(false); // opening fence
    expect(isInsidePlantumlFence(doc, 6)).toBe(false); // closing fence
  });

  it("returns false outside any code block", () => {
    expect(isInsidePlantumlFence(doc, 0)).toBe(false);
    expect(isInsidePlantumlFence(doc, 8)).toBe(false);
  });

  it("returns false inside a non-plantuml code block", () => {
    expect(isInsidePlantumlFence(doc, 13)).toBe(false);
  });

  it("is case-insensitive on the fence info", () => {
    const upper = lines("```PlantUML\nA -> B\n```");
    expect(isInsidePlantumlFence(upper, 1)).toBe(true);
  });

  it("handles tilde fences", () => {
    const tilde = lines("~~~plantuml\nA -> B\n~~~");
    expect(isInsidePlantumlFence(tilde, 1)).toBe(true);
  });

  it("returns false for an unterminated non-plantuml block", () => {
    const doc2 = lines("```js\nconst x = 1;\nmore code");
    expect(isInsidePlantumlFence(doc2, 2)).toBe(false);
  });

  it("stays open until a matching-length closing fence", () => {
    // A shorter fence inside does not close a longer opening fence.
    const doc2 = lines("````plantuml\n```\nstill inside\n````");
    expect(isInsidePlantumlFence(doc2, 1)).toBe(true);
    expect(isInsidePlantumlFence(doc2, 2)).toBe(true);
  });
});
