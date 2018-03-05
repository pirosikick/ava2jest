import test from "ava";
import somePkg from "some-pkg";

test.beforeEach(t => {
  t.context = { key: "value" };
});

test("title", t => {
  console.log(t.context.key);
});
