import { equal } from "assert";
import * as helpers from "../src/helpers";

describe("Helpers", () => {
  it("should reverse an arrow head", () => {
    equal(helpers.reverseHead("<--"), ">--");
    equal(helpers.reverseHead("<"), ">");
    equal(helpers.reverseHead("?!"), "?!");
  });
});
