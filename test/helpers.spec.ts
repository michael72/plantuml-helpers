import { describe, it, expect } from "vitest";
import * as helpers from "../src/helpers";

describe("Helpers", () => {
  it("should reverse an arrow head", () => {
    expect(helpers.reverseHead("<--")).toBe(">--");
    expect(helpers.reverseHead("<")).toBe(">");
    expect(helpers.reverseHead("?!")).toBe("?!");
  });
});
