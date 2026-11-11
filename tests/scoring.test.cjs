const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(require.resolve("../src/lib/scoring.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, context);
const { validHandicap, netScore, playingOrder } = context.exports;
const holes = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, strokeIndex: i + 1 }));
const order = (round, hole) => Array.from(playingOrder(round, hole, holes));

test("optional handicap distinguishes blank from scratch and rejects invalid values", () => {
  for (const value of ["", " ", "0", "18", "54"]) assert.equal(validHandicap(value), true);
  for (const value of ["-1", "55", "18.2", "invalid", "Infinity"]) assert.equal(validHandicap(value), false);
});

test("strokes are allocated by stroke index, including handicaps over 18", () => {
  assert.equal(netScore(4, 18, 1), 3);
  assert.equal(netScore(4, 18, 18), 3);
  assert.equal(netScore(4, 0, 1), 4);
  assert.equal(netScore(4, 9, 9), 3);
  assert.equal(netScore(4, 9, 10), 4);
  assert.equal(netScore(4, 19, 1), 2);
  assert.equal(netScore(4, 19, 2), 3);
  assert.equal(netScore(4, 36, 18), 2);
  assert.equal(netScore(4, 54, 18), 1);
});

test("honours use previous-hole net scores without mutating score ownership", () => {
  const round = { players: [{ handicap: 0 }, { handicap: 18 }, {}], scores: { 1: [4, 4, 5], 2: [3, 5, 4] } };
  const original = JSON.stringify(round);
  assert.deepEqual(order(round, 1), [0, 1, 2]);
  assert.deepEqual(order(round, 2), [1, 0, 2]);
  assert.deepEqual(order(round, 3), [0, 1, 2]);
  assert.equal(JSON.stringify(round), original);
});

test("ties preserve previous honours rather than the original player list", () => {
  const round = { players: [{}, {}, {}], scores: { 1: [5, 3, 4], 2: [4, 4, 4] } };
  assert.deepEqual(order(round, 3), [1, 2, 0]);
  round.scores[1] = [2, 3, 4];
  assert.deepEqual(order(round, 3), [0, 1, 2]);
});

test("missing scores retain the previous tee order until everyone has scored", () => {
  const round = { players: [{}, {}, {}], scores: { 1: [5, 3, 4], 2: [2, null, 5] } };
  assert.deepEqual(order(round, 3), [1, 2, 0]);
  round.scores[2][1] = 3;
  assert.deepEqual(order(round, 3), [0, 1, 2]);
});
