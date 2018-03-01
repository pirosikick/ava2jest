/* eslint-disable node/no-unpublished-require */
"use strict";
jest.autoMockOff();
const { defineTest } = require("jscodeshift/dist/testUtils");

defineTest(__dirname, "ava2jest", null, "assertion");
