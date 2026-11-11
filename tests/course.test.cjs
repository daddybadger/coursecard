const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file) {
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}
const { sampleCourse: course } = load("../src/lib/course.ts");
const { holeMaps } = load("../src/lib/hole-maps.ts");
const { netScore, playingOrder } = load("../src/lib/scoring.ts");

test("Billingbear New Course matches every row of the supplied 2024 scorecard", () => {
  // Columns: hole, white yards, yellow yards, par, stroke index, red yards.
  const printed = [
    [1, 113, 113, 3, 7, 113], [2, 102, 102, 3, 9, 102],
    [3, 148, 96, 3, 3, 74], [4, 131, 131, 3, 1, 114],
    [5, 168, 132, 3, 5, 132], [6, 198, 140, 3, 4, 140],
    [7, 145, 145, 3, 6, 145], [8, 175, 175, 3, 2, 175],
    [9, 89, 89, 3, 8, 70],
  ];
  assert.equal(course.holes.length, 9);
  course.holes.forEach((hole, i) => assert.deepEqual(
    [hole.number, hole.tees.white, hole.tees.yellow, hole.par, hole.strokeIndex, hole.tees.red], printed[i],
  ));
  assert.equal(course.holes.reduce((sum, hole) => sum + hole.par, 0), 27);
  for (const [tee, total] of [["white", 1269], ["yellow", 1123], ["red", 1065]]) {
    assert.equal(course.holes.reduce((sum, hole) => sum + hole.tees[tee], 0), total);
  }
});

test("nine-hole rounds use half the entered 18-hole handicap", () => {
  for (const handicap of [0, 4, 9, 10, 18, 27, 54]) {
    const strokes = course.holes.reduce((sum, hole) => sum + (4 - netScore(4, handicap, hole.strokeIndex, course.holes.length)), 0);
    assert.equal(strokes, Math.round(handicap / 2));
  }
  assert.equal(netScore(4, 18, 7, 9), 3);
  assert.equal(netScore(4, 9, 5, 9), 3);
  assert.equal(netScore(4, 9, 6, 9), 4);
  assert.equal(netScore(4, 4, 2, 9), 3);
  assert.equal(netScore(4, 4, 3, 9), 4);
});

test("each real hole has a source-plan crop containing its tee and green", () => {
  assert.equal(holeMaps.length, course.holes.length);
  assert.ok(fs.existsSync(require.resolve("../public/maps/billingbear-new-course-2024.webp")));
  for (const map of holeMaps) {
    const [x, y, width, height] = map.viewBox.split(" ").map(Number);
    assert.ok(x >= 0 && y >= 0 && x + width <= 1710 && y + height <= 720);
    for (const [px, py] of [map.tee, map.green]) assert.ok(px >= x && px <= x + width && py >= y && py <= y + height);
  }
});

test("nine-hole honours use the same halved handicap as displayed net scores", () => {
  const round = {
    players: [{ id: "sam", name: "Sam" }, { id: "alex", name: "Alex", handicap: 9 }],
    scores: { 1: [4, 4], 2: [4, 4], 3: [4, 4] },
  };
  // SI 7 gets no shot from the five nine-hole strokes; the initial order holds.
  assert.deepEqual(Array.from(playingOrder(round, 2, course.holes)), [0, 1]);
  // SI 3 does get a shot, so Alex's lower net score earns the next honour.
  assert.deepEqual(Array.from(playingOrder(round, 4, course.holes)), [1, 0]);
});
