import test from "ava";

test.beforeEach(t => {
  t.context = { key: "value" };
});

test("title", t => {
  console.log(t.context.key);
});
