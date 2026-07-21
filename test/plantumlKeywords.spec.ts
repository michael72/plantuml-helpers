import { describe, it, expect } from "vitest";
import { getPlantUmlCompletions } from "../src/plantumlKeywords";

describe("getPlantUmlCompletions", () => {
  const completions = getPlantUmlCompletions();
  const labels = completions.map((c) => c.label);

  it("includes the diagram markers", () => {
    expect(labels).toContain("@startuml");
    expect(labels).toContain("@enduml");
  });

  it("includes common element types with the 'type' kind", () => {
    for (const label of ["class", "interface", "component", "actor"]) {
      const entry = completions.find((c) => c.label === label);
      expect(entry, `missing ${label}`).toBeDefined();
      expect(entry?.kind).toBe("type");
    }
  });

  it("includes control keywords with the 'keyword' kind", () => {
    const entry = completions.find((c) => c.label === "activate");
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe("keyword");
  });

  it("includes preprocessor commands with the 'function' kind", () => {
    const entry = completions.find((c) => c.label === "!include");
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe("function");
  });

  it("provides snippet entries with an insertText body", () => {
    const snippets = completions.filter((c) => c.kind === "snippet");
    expect(snippets.length).toBeGreaterThan(0);
    for (const s of snippets) {
      expect(s.insertText, `snippet ${s.label} has no body`).toBeTruthy();
    }
  });

  it("has no duplicate labels", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const label of labels) {
      if (seen.has(label)) {
        duplicates.push(label);
      }
      seen.add(label);
    }
    expect(duplicates).toEqual([]);
  });

  it("gives every entry a non-empty label and detail", () => {
    for (const c of completions) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.detail.length).toBeGreaterThan(0);
    }
  });
});
