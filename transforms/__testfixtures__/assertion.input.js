import ava from "ava";

test.beforeEach(() => {});

test.afterEach(() => {});

test("assertions", t => {
  const trueValue = true;
  t.true(trueValue);
  t.false(!trueValue);

  t.truthy(trueValue);
  t.falsy(!trueValue);

  const a = "a";
  const b = "b";
  t.is(a, b);
  t.is(a, undefined);
  t.is(a, null);

  t.not(a, b);
  t.not(a, undefined);
  t.not(a, null);

  const aObj = {};
  const bObj = {};
  t.deepEqual(aObj, bObj);
  t.notDeepEqual(aObj, bObj);

  const contents = "a string";
  t.regex(contents, /some pattern/);
  t.notRegex(contents, /some pattern/);

  t.throws(() => {
    throw new Error("ERROR");
  });
  t.notThrows(() => {
    throw new Error("ERROR");
  });
  t.throws(() => {
    throw new Error("ERROR");
  }, Error);

  const aNum = 5;
  t.true(aNum > 0);
  t.false(aNum > 0);
  t.true(aNum >= 0);
  t.true(aNum < 0);
  t.true(aNum <= 0);
});
