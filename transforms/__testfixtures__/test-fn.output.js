test("with callback", done => {
  setTimeout(() => {
    done();
  });
});

test.only("only", () => {});
test.skip("skip", () => {});
test("serial", () => {});

test("done is already used in scope", done2 => {
  const done = () => {};

  setTimeout(() => {
    done2();
  });
});
