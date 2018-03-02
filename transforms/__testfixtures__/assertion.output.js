test("assertions", () => {
  const trueValue = true;
  expect(trueValue).toBe(true);
  expect(!trueValue).toBe(false);

  expect(trueValue).toBeTruthy();
  expect(!trueValue).toBeFalsy();

  const a = "a";
  const b = "b";
  expect(a).toBe(b);
  expect(a).toBeUndefined();
  expect(a).toBeNull();

  expect(a).not.toBe(b);
  expect(a).toBeDefined();
  expect(a).not.toBeNull();

  const aObj = {};
  const bObj = {};
  expect(aObj).toEqual(bObj);
  expect(aObj).not.toEqual(bObj);

  const contents = "a string";
  expect(contents).toMatch(/some pattern/);
  expect(contents).not.toMatch(/some pattern/);

  expect(() => {
    throw new Error("ERROR");
  }).toThrow();
  expect(() => {
    throw new Error("ERROR");
  }).not.toThrow();

  const aNum = 5;
  expect(aNum).toBeGreaterThan(0);
  expect(aNum).not.toBeGreaterThan(0);
  expect(aNum).toBeGreaterThanOrEqual(0);
  expect(aNum).toBeLessThan(0);
  expect(aNum).toBeLessThanOrEqual(0);
});
