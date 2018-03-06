import somePkg from "some-pkg";

let tContext = {};

beforeEach(() => {
  tContext = { key: "value" };
});

test("title", () => {
  console.log(tContext.key);
});
