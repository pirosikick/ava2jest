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

  const isFunction = node =>
    j.FunctionExpression.check(node) || j.ArrowFunctionExpression.check(node);

  const isLiteral = node =>
    j.Literal.check(node) || j.TemplateLiteral.check(node);

  // t.*** => expect
  const transformAssertions = (rootNode, tName) => {
    j(rootNode)
      .find(
        j.CallExpression,
        node =>
          j.MemberExpression.check(node.callee) &&
          j.Identifier.check(node.callee.object) &&
          node.callee.object.name === tName
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
          const arg = path.node.arguments[0];
          let newExpression;

          // t.true(arg > value) or t.false(arg > value)
          if (
            j.BinaryExpression.check(arg) &&
            /^(<=?|>=?)$/.test(arg.operator)
          ) {
            const not = assertionName === "false";
            const matchers = {
              ">": "toBeGreaterThan",
              ">=": "toBeGreaterThanOrEqual",
              "<": "toBeLessThan",
              "<=": "toBeLessThanOrEqual"
            };

            // => expect(arg).toBeGreaterThan(value);
            // => expect(arg).not.toBeGreaterThan(value);
            newExpression = expectCallExpression(
              arg.left,
              matchers[arg.operator],
              arg.right,
              not
            );
          } else {
            // => expect(...).toBe(true or false);
            newExpression = expectCallExpression(
              path.node.arguments[0],
              "toBe",
              j.literal(assertionName === "true")
            );
          }

          return path.replace(newExpression);
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

        // t.throws(..., Error) or t.notThrows(..., Error)
        if (assertionName === "throws" || assertionName === "notThrows") {
          const [firstArg, secondArg] = path.node.arguments;
          // => expect(...).toThrow(Error)
          // => expect(...).not.toThrow(Error)
          return path.replace(
            expectCallExpression(
              firstArg,
              "toThrow",
              j.Identifier.check(secondArg) ? secondArg : null,
              assertionName === "notThrows"
            )
          );
        }

        // t.log(message...)
        if (assertionName === "log") {
          // => console.log(message...)
          path.node.callee = j.memberExpression(
            j.identifier("console"),
            j.identifier("log")
          );
          return;
        }

        // t.plan(count)
        if (assertionName === "plan") {
          // => expect.assertions(count)
          path.node.callee = j.memberExpression(
            j.identifier("expect"),
            j.identifier("assertions")
          );
          return;
        }

        // t.fail('message')
        if (assertionName === "fail") {
          const args = path.node.arguments[0] ? [path.node.arguments[0]] : [];
          // => throw new Error('message')
          path.parentPath.replace(
            j.throwStatement(j.newExpression(j.identifier("Error"), args))
          );
        }
      });
  };

  // testId is a local identifier of ava
  // ex:
  //   import test from 'ava' => testId === 'test'
  //   import tt from 'ava' => testId === 'tt'
  let testId;

  // Remove "import test from 'ava'"
  root
    .find(j.ImportDeclaration, {
      source: { value: "ava" }
    })
    .forEach(path => {
      path.node.specifiers.forEach(specifier => {
        if (j.ImportDefaultSpecifier.check(specifier)) {
          testId = specifier.local.name;
        }
      });

      path.prune();
    });

  if (!testId) {
    return;
  }

  root
    .find(
      j.CallExpression,
      node =>
        // test(...)
        (j.Identifier.check(node.callee) && node.callee.name === testId) ||
        // test.only(...), test.skip(...), test.serial(...)
        (j.MemberExpression.check(node.callee) &&
          j.Identifier.check(node.callee.object) &&
          node.callee.object.name === testId &&
          j.Identifier.check(node.callee.property) &&
          /^(?:only|skip|serial)$/.test(node.callee.property.name))
    )
    .forEach(path => {
      if (testId !== "test") {
        if (j.Identifier.check(path.node.callee)) {
          path.node.callee = j.identifier("test");
        } else {
          // node.callee is a MemberExpression
          path.node.callee.object = j.identifier("test");
        }
      }

      // test(t => {}) => test("", t => {})
      if (!isLiteral(path.node.arguments[0])) {
        path.node.arguments = [j.literal(""), ...path.node.arguments];
      }

      if (!isFunction(path.node.arguments[1])) {
        return;
      }

      const fn = path.node.arguments[1];

      // ex:
      //   test(t => {}) => tName === 't'
      //   test(someVar => {}) => tName === 'someVar'
      const tName = j.Identifier.check(fn.params[0])
        ? fn.params[0].name
        : false;

      // Remove t param on calling test function
      // ex: test(t => {}) => test(() => {})
      fn.params = [];

      // test.serial(...) => test(...)
      if (
        j.MemberExpression.check(path.node.callee) &&
        path.node.callee.property.name === "serial"
      ) {
        path.node.callee = j.identifier("test");
      }

      transformAssertions(fn, tName);

      // t.pass is called in implementation
      const isPassUsed = !!j(fn).find(j.CallExpression, {
        callee: {
          object: { name: "t" },
          property: { name: "pass" }
        }
      }).length;

      // test => test.skip
      if (isPassUsed) {
        path.node.callee = j.memberExpression(
          j.identifier("test"),
          j.identifier("skip")
        );
      }
    });

  // setup & teardown
  root
    .find(
      j.CallExpression,
      node =>
        // t.beforeEach(...), t.afterEach(...)
        // t.before(...), t.after(...)
        j.MemberExpression.check(node.callee) &&
        j.Identifier.check(node.callee.object) &&
        node.callee.object.name === testId &&
        j.Identifier.check(node.callee.property) &&
        /^(?:before|after)(?:Each)?$/.test(node.callee.property.name)
    )
    .forEach(path => {
      // test.beforeEach(t => {}) => test.beforeEach(() => {})
      path.node.arguments.forEach(arg => {
        if (isFunction(arg) && arg.params.length) {
          const tName = arg.params[0].name;
          arg.params = [];
          transformAssertions(arg, tName);
        }
      });
      if (/Each$/.test(path.node.callee.property.name)) {
        // t.beforeEach(...) => beforeEach(...)
        path.node.callee = path.node.callee.property;
      } else {
        // t.before(...) => beforeAll(...)
        path.node.callee =
          path.node.callee.property.name === "before"
            ? j.identifier("beforeAll")
            : j.identifier("afterAll");
      }
    });

  // context
  let contextDefined = false;
  root
    .find(j.MemberExpression, {
      object: { name: "t" },
      property: { name: "context" }
    })
    .forEach(path => {
      const contextId = j.identifier("tContext");

      if (!contextDefined) {
        // let context = {};
        const defineContext = j.variableDeclaration("let", [
          j.variableDeclarator(contextId, j.objectExpression([]))
        ]);
        const imports = root.find(j.ImportDeclaration);
        if (imports.length) {
          imports.at(imports.length - 1).insertAfter(defineContext);
        } else {
          const firstPath = root.find(j.Program).get("body", 0);
          j(firstPath).insertBefore(defineContext);
        }
        contextDefined = true;
      }
      // t.context => tContext
      path.replace(contextId);
    });

  // test.cb
  root
    .find(j.CallExpression, {
      callee: {
        object: { name: "test" },
        property: { name: "cb" }
      }
    })
    .forEach(path => {
      // test.cb(...) => test(...)
      path.node.callee = j.identifier("test");

      if (!isLiteral(path.node.arguments[0])) {
        path.node.arguments = [j.Literal(""), ...path.node.arguments];
      }

      if (!isFunction(path.node.arguments[1])) {
        return;
      }

      const fn = path.node.arguments[1];

      // test.cb(() => {}) is not correct for AVA
      if (!j.Identifier.check(fn.params[0])) {
        return;
      }

      const tName = fn.params[0].name;
      const idExists = name => j(fn).find(j.Identifier, { name }).length > 0;

      // if 'done' is already used, 'done2' is used as test callback.
      // if 'done2' is already used, 'done3' is used as test callback.
      // ...
      let doneName = "done";
      for (let i = 2; i <= 10; i++) {
        if (!idExists(doneName)) {
          break;
        }
        doneName = `done${i}`;
      }

      const doneId = j.identifier(doneName);

      // test(t => { ... }) => test(done => { ... })
      fn.params[0] = doneId;

      // t.end() => done()
      j(fn)
        .find(j.CallExpression, {
          callee: {
            object: { name: tName },
            property: { name: "end" }
          }
        })
        .forEach(tEndCall => {
          tEndCall.node.callee = doneId;
        });

      transformAssertions(fn, tName);
    });

  return root.toSource({ quote: "single" });
};
