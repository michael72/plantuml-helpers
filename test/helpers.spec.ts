import { strictEqual } from "assert";
import * as helpers from "../src/helpers";

describe("Helpers", () => {
  it("should reverse an arrow head", () => {
    strictEqual(helpers.reverseHead("<--"), ">--");
    strictEqual(helpers.reverseHead("<"), ">");
    strictEqual(helpers.reverseHead("?!"), "?!");
  });
});
