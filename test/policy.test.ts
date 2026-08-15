// Policy unit tests: the frozen L1/L2 prompt bodies and reader-level parsing.

import assert from "node:assert/strict";
import test from "node:test";

import {
  POLICY_TEXT_L1,
  POLICY_TEXT_L2,
  isReaderLevel,
  parseReaderLevel,
  policyTextForLevel,
} from "../src/policy.ts";

test("policy/level-1-exact: L1 body carries the 30-50 字 contract", () => {
  assert.match(POLICY_TEXT_L1, /30-50 字/);
  assert.match(POLICY_TEXT_L1, /↳ /);
  assert.match(POLICY_TEXT_L1, /DIRECTLY BELOW/);
  assert.match(POLICY_TEXT_L1, /SCOPE AND PRECEDENCE/);
});

test("policy/level-2-exact: L2 body carries the 15-25 字 contract", () => {
  assert.match(POLICY_TEXT_L2, /15-25 字/);
  assert.match(POLICY_TEXT_L2, /↳ /);
  assert.match(POLICY_TEXT_L2, /DIRECTLY BELOW/);
  assert.match(POLICY_TEXT_L2, /SCOPE AND PRECEDENCE/);
});

test("policy/text-selection: level maps to the matching body", () => {
  assert.equal(policyTextForLevel(1), POLICY_TEXT_L1);
  assert.equal(policyTextForLevel(2), POLICY_TEXT_L2);
});

test("policy/is-reader-level: only 1 and 2 are valid", () => {
  assert.equal(isReaderLevel(1), true);
  assert.equal(isReaderLevel(2), true);
  assert.equal(isReaderLevel(0), false);
  assert.equal(isReaderLevel(3), false);
  assert.equal(isReaderLevel("1"), false);
  assert.equal(isReaderLevel(null), false);
});

test("policy/parse-level: numeric and alias forms", () => {
  assert.equal(parseReaderLevel("1"), 1);
  assert.equal(parseReaderLevel("beginner"), 1);
  assert.equal(parseReaderLevel("入门"), 1);
  assert.equal(parseReaderLevel("ru-men"), 1);
  assert.equal(parseReaderLevel("RU-MEN"), 1);
  assert.equal(parseReaderLevel("2"), 2);
  assert.equal(parseReaderLevel("standard"), 2);
  assert.equal(parseReaderLevel("标准"), 2);
  assert.equal(parseReaderLevel("biao-zhun"), 2);
  assert.equal(parseReaderLevel(" 1 "), 1, "trims whitespace");
});

test("policy/parse-level: invalid input rejects", () => {
  assert.equal(parseReaderLevel("3"), null);
  assert.equal(parseReaderLevel("beginner2"), null);
  assert.equal(parseReaderLevel(""), null);
  assert.equal(parseReaderLevel("yes"), null);
});
