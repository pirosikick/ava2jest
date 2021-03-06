/* eslint-disable node/no-unpublished-require */
"use strict";
jest.autoMockOff();
const { defineTest } = require("jscodeshift/dist/testUtils");

defineTest(__dirname, "ava2jest", null, "assertion");
defineTest(__dirname, "ava2jest", null, "setup-and-teardown");
defineTest(__dirname, "ava2jest", null, "context");
defineTest(__dirname, "ava2jest", null, "context2");
defineTest(__dirname, "ava2jest", null, "test-fn");
defineTest(__dirname, "ava2jest", null, "import-ava");
defineTest(__dirname, "ava2jest", null, "no-title");
