import test from "ava";

test.cb("with callback", t => {
  setTimeout(() => {
    t.end();
  });
});

test.only("only", t => {});
test.skip("skip", t => {});
test.serial("serial", t => {});

test.cb("done is already used in scope", t => {
  const done = () => {};

  setTimeout(() => {
    t.end();
  });
});

test("other id is used instead of t", tt => {
  tt.is(true, true);
});
