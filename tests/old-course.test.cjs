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
const { getCourse, courseParLabel } = load("../src/lib/course.ts");
const { holePar, netScoreForHole } = load("../src/lib/scoring.ts");
const { oldHoleMaps } = load("../src/lib/hole-maps.ts");

test("every Old Course row matches the supplied scorecard, including the second nine", () => {
  // White/yellow/red yards, main par/index, red men's/women's par and red index.
  const rows = [
    [395,385,263,4,5,4,4,5], [305,298,284,4,17,4,4,16], [467,454,403,5,13,4,5,11],
    [159,153,141,3,11,3,3,9], [383,354,337,4,2,4,4,2], [390,350,302,4,7,4,4,7],
    [179,150,141,3,15,3,3,13], [210,204,196,3,9,3,4,18], [370,358,350,4,6,4,4,3],
    [427,385,375,4,3,4,5,6], [331,329,325,4,16,4,4,15], [487,454,403,5,12,4,5,12],
    [159,153,141,3,10,3,3,10], [406,383,354,4,1,4,4,1], [352,350,316,4,8,4,4,8],
    [184,161,160,3,14,3,3,14], [245,244,244,4,18,4,4,17], [401,358,350,4,4,4,4,4],
  ];
  const course = getCourse("old", 18);
  assert.equal(course.holes.length, 18);
  course.holes.forEach((hole, index) => {
    assert.equal(hole.number, index + 1);
    assert.deepEqual([hole.tees.white, hole.tees.yellow, hole.tees.red, hole.par, hole.strokeIndex,
      hole.redPar.men, hole.redPar.women, hole.redStrokeIndex], rows[index]);
  });
});

test("9- and 18-hole tee and par totals match the printed front/overall totals", () => {
  for (const [length, totals, pars] of [[9, [2858,2706,2417], [34,33,35]], [18, [5850,5523,5085], [69,67,71]]]) {
    const course = getCourse("old", length);
    ["white", "yellow", "red"].forEach((tee, index) => assert.equal(course.holes.reduce((sum, hole) => sum + hole.tees[tee], 0), totals[index]));
    const players = [{ tee: "white" }, { tee: "red", redPar: "men" }, { tee: "red", redPar: "women" }];
    players.forEach((player, index) => assert.equal(course.holes.reduce((sum, hole) => sum + holePar(hole, player), 0), pars[index]));
    assert.equal(courseParLabel(course), `${Math.min(...pars)}-${Math.max(...pars)}`);
  }
  assert.equal(getCourse("new", 18).holes.length, 9);
});

test("net scoring uses red/main indexes and scales 18-hole handicaps for nine holes", () => {
  for (const length of [9, 18]) {
    const course = getCourse("old", length);
    for (const tee of ["red", "white", "yellow"]) {
      for (const handicap of [0,4,9,12,18,36,54]) {
        const player = { tee, handicap };
        const received = course.holes.reduce((sum, hole) => sum + 6 - netScoreForHole(6, player, hole, course.holes), 0);
        assert.equal(received, length === 9 ? Math.round(handicap / 2) : handicap);
      }
    }
  }
  const course = getCourse("old", 18), hole = course.holes[2];
  assert.equal(netScoreForHole(5, { tee: "white", handicap: 12 }, hole, course.holes), 5);
  assert.equal(netScoreForHole(5, { tee: "red", handicap: 12 }, hole, course.holes), 4);
});

test("all nine physical Old Course maps contain their tee and green", () => {
  assert.equal(oldHoleMaps.length, 9);
  assert.ok(fs.existsSync(require.resolve("../public/maps/billingbear-old-course-2024.webp")));
  for (const map of oldHoleMaps) {
    const [x,y,w,h] = map.viewBox.split(" ").map(Number);
    assert.ok(x >= 0 && y >= 0 && x+w <= 1980 && y+h <= 1320);
    for (const [px,py] of [map.tee,map.green]) assert.ok(px >= x && px <= x+w && py >= y && py <= y+h);
  }
});
