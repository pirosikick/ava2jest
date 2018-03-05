import test from "ava";

test.cb("with callback", t => {
  setTimeout(() => {
    t.end();
  });
});
