import { describe, it, expect, vi } from "vitest";

vi.mock("vscode", () => ({}));

// import kept so the module loads (triggers the vscode mock).
// The fence-detection tests moved to fence.spec.ts.
import "../src/completion";

describe("completion module", () => {
  it("loads without error", () => {
    // The import above already validates the module loads cleanly with the
    // vscode mock in place.
    expect(true).toBe(true);
  });
});
