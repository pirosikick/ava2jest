"use strict";

module.exports = function(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // generates expect(${expectArg}).${matcherName}($matcherArg)
  const expectCallExpression = (expectArg, matcherName, matcherArg, not) => {
    // expect(${expectArg})
    const expectCall = j.callExpression(j.identifier("expect"), [expectArg]);
    const callee = not
      ? // expect(${expectArg}).not.${matcherName}
        j.memberExpression(
          j.memberExpression(expectCall, j.identifier("not")),
          j.identifier(matcherName)
        )
      : // expect(${expectArg}).${matcherName}
        j.memberExpression(expectCall, j.identifier(matcherName));

    return j.callExpression(callee, matcherArg ? [matcherArg] : []);
  };

  // Remove "import test from 'ava'"
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value === "ava")
    .forEach(path => {
      path.prune();
    });

  const callExpressions = root.find(j.CallExpression);

  // Remove t param on calling test function
  //   before: test('desc', t => {});
  //   after: test('desc', () => {});
  callExpressions
    .filter(path => path.node.callee.name === "test")
    .forEach(path => {
      path.node.arguments
        .filter(
          arg =>
            j.FunctionExpression.check(arg) ||
            j.ArrowFunctionExpression.check(arg)
        )
        .forEach(node => {
          const firstParam = node.params[0];
          if (j.Identifier.check(firstParam) && firstParam.name === "t") {
            node.params = node.params.slice(1);
          }
        });
    });

  callExpressions
    .filter(
      path =>
        // t.***(...);
        j.MemberExpression.check(path.node.callee) &&
        j.Identifier.check(path.node.callee.object) &&
        path.node.callee.object.name === "t"
    )
    .forEach(path => {
      // t.${assertionName}
      const assertionName = path.node.callee.property.name;

      // t.is(a, b) or t.not(a, b)
      if (assertionName === "is" || assertionName === "not") {
        const not = assertionName === "not";
        const [firstArg, secondArg] = path.node.arguments;
        let newExpression;

        if (
          // t.is(a, undefined) or t.not(a, undefined)
          j.Identifier.check(secondArg) &&
          secondArg.name === "undefined"
        ) {
          // expect(a).toBeUndefined() or expect(a).toBeDefined()
          const matcherName = not ? "toBeDefined" : "toBeUndefined";
          newExpression = expectCallExpression(firstArg, matcherName);
        } else if (
          // t.is(a, null);
          j.Literal.check(secondArg) &&
          secondArg.value === null
        ) {
          // => expect(a).toBeNull() or expect(a).not.toBeNull();
          newExpression = expectCallExpression(
            firstArg,
            "toBeNull",
            false,
            not
          );
        } else {
          // => expect(a).toBe(b) or  expect(a).not.toBe(b);
          newExpression = expectCallExpression(
            firstArg,
            "toBe",
            secondArg,
            not
          );
        }

        return path.replace(newExpression);
      }

      // t.deepEqual(a, b) or t.notDeepEqual(a, b)
      if (assertionName === "deepEqual" || assertionName === "notDeepEqual") {
        // expect(a).toEqual(b) or expect(a).not.toEqual(b)
        return path.replace(
          expectCallExpression(
            path.node.arguments[0],
            "toEqual",
            path.node.arguments[1],
            assertionName === "notDeepEqual"
          )
        );
      }

      // t.truthy(a) or t.falsy(a)
      if (assertionName === "truthy" || assertionName === "falsy") {
        // => expect(a).toBeTruthy(); or expect(a).toBeFalsy();
        return path.replace(
          expectCallExpression(
            path.node.arguments[0],
            assertionName === "truthy" ? "toBeTruthy" : "toBeFalsy"
          )
        );
      }

      // t.true(...); or t.false(...);
      if (assertionName === "true" || assertionName === "false") {
        // => expect(...).toBe(true or false);
        return path.replace(
          expectCallExpression(
            path.node.arguments[0],
            "toBe",
            j.literal(assertionName === "true")
          )
        );
      }

      // t.regex(contents, pattern) or t.notRegex(cotents, pattern);
      if (assertionName === "regex" || assertionName === "notRegex") {
        // => expect(contents).toMatch(pattern);
        // => expect(contents).not.toMatch(pattern);
        return path.replace(
          expectCallExpression(
            path.node.arguments[0],
            "toMatch",
            path.node.arguments[1],
            assertionName === "notRegex"
          )
        );
      }

      if (assertionName === "throws" || assertionName === "notThrows") {
        return path.replace(
          expectCallExpression(
            path.node.arguments[0],
            "toThrow",
            null,
            assertionName === "notThrows"
          )
        );
      }
    });

  return root.toSource({ quote: "single" });
};
