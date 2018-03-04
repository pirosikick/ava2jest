let context = {};

beforeEach(() => {
  context = { key: "value" };
});

test("title", () => {
  console.log(context.key);
});
