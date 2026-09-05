import { describe, it, expect } from "vitest";
import {
  isInsidePlantumlFence,
  findClosingFence,
  FENCE_OPEN_RE,
  PLANTUML_FENCE_INFOS,
} from "../src/fence.js";

function lines(text: string): string[] {
  return text.split("\n");
}

describe("FENCE_OPEN_RE", () => {
  it("matches triple backtick fences", () => {
    const m = FENCE_OPEN_RE.exec("```plantuml");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("```");
    expect(m![2]).toBe("plantuml");
  });

  it("matches tilde fences", () => {
    const m = FENCE_OPEN_RE.exec("~~~plantuml");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("~~~");
    expect(m![2]).toBe("plantuml");
  });

  it("allows leading whitespace", () => {
    const m = FENCE_OPEN_RE.exec("  ```plantuml");
    expect(m).not.toBeNull();
  });

  it("matches fences without an info string", () => {
    const m = FENCE_OPEN_RE.exec("```");
    expect(m).not.toBeNull();
    expect(m![2]).toBe("");
  });
});

describe("PLANTUML_FENCE_INFOS", () => {
  it("includes plantuml and puml", () => {
    expect(PLANTUML_FENCE_INFOS.has("plantuml")).toBe(true);
    expect(PLANTUML_FENCE_INFOS.has("puml")).toBe(true);
  });

  it("excludes non-plantuml info strings", () => {
    expect(PLANTUML_FENCE_INFOS.has("ts")).toBe(false);
    expect(PLANTUML_FENCE_INFOS.has("js")).toBe(false);
    expect(PLANTUML_FENCE_INFOS.has("python")).toBe(false);
  });
});

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

describe("findClosingFence", () => {
  it("finds a matching closing fence", () => {
    const doc = "```plantuml\ncontent\n```\ntrailing".split("\n");
    expect(findClosingFence(doc, 1, "```")).toBe(2);
  });

  it("returns -1 when no closing fence exists", () => {
    const doc = "```plantuml\ncontent".split("\n");
    expect(findClosingFence(doc, 1, "```")).toBe(-1);
  });

  it("does not match a shorter fence", () => {
    const doc = "````plantuml\ncontent\n```\nstill open\n````".split("\n");
    expect(findClosingFence(doc, 1, "````")).toBe(4);
  });
});
