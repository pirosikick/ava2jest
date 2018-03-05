import test from "ava";

test.cb("with callback", t => {
  setTimeout(() => {
    t.end();
  });
});

test.only("only", t => {});
test.skip("skip", t => {});
test.serial("serial", t => {});
