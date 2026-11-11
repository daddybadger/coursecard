const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const compile = (file) => ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function load(file) {
  const context = { exports: {} };
  vm.runInNewContext(compile(file), context);
  return context.exports;
}
const course = load("../src/lib/course.ts");
const scoring = load("../src/lib/scoring.ts");
const maps = load("../src/lib/hole-maps.ts");
const code = compile("../src/components/scorecard.tsx");
const nodes = (node) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];

function app(saved = null) {
  let stored = saved && JSON.stringify(saved);
  let cursor = 0;
  const state = [];
  const confirmations = [];
  const components = { HolePager: () => null, Button: () => null };
  const context = {
    exports: {}, process: { env: { NODE_ENV: "test" } }, Event: class {},
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; }, removeItem: () => { stored = null; } },
    window: { dispatchEvent() {}, confirm(message) { confirmations.push(message); return context.approve; } },
    require(name) {
      if (name === "react") return {
        useEffect() {}, useSyncExternalStore: (_, get) => get(),
        useState(initial) {
          const slot = cursor++;
          if (!(slot in state)) state[slot] = initial;
          return [state[slot], (next) => { state[slot] = typeof next === "function" ? next(state[slot]) : next; }];
        },
      };
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === "@/lib/course") return course;
      if (name === "@/lib/scoring") return scoring;
      if (name === "@/lib/hole-maps") return maps;
      if (name === "@/components/hole-pager" || name === "@/components/ui/button") return components;
      if (name === "next/link") return () => null;
      if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
      throw Error(name);
    },
  };
  vm.runInNewContext(code, context);
  const render = () => { cursor = 0; return context.exports.Scorecard(); };
  const setup = () => nodes(render()).find((node) => node.props?.onStart);
  const hole = () => {
    const pager = nodes(render()).find((node) => node.type === components.HolePager);
    return pager.props.renderHole(JSON.parse(stored).currentHole, () => {});
  };
  return { render, setup, hole, context, confirmations, stored: () => stored && JSON.parse(stored) };
}

test("setup persists optional handicaps, including zero, alongside the right player", () => {
  const game = app();
  game.setup().props.onNameChange(0, "Alex");
  game.setup().props.onHandicapChange(0, "18");
  game.setup().props.onAddPlayer();
  game.setup().props.onNameChange(1, "Sam");
  game.setup().props.onAddPlayer();
  game.setup().props.onNameChange(2, "Pat");
  game.setup().props.onHandicapChange(2, "0");
  game.setup().props.onStart();
  assert.deepEqual(game.stored().players.map((player) => player.handicap), [18, undefined, 0]);
  assert.equal(nodes(game.hole()).filter((node) => node.props?.className === "net-score").length, 0);
  nodes(game.hole()).find((node) => node.props?.["aria-label"] === "Raise Alex's score").props.onClick();
  const net = nodes(game.hole()).find((node) => node.props?.className === "net-score");
  assert.equal(net.props.children.join(""), "Net 2");
  nodes(game.hole()).find((node) => node.props?.["aria-label"] === "Raise Sam's score").props.onClick();
  assert.equal(nodes(game.hole()).filter((node) => node.props?.className === "net-score").length, 1);
});

test("tapping the blank score region enters par once without resetting an adjusted score", () => {
  const game = app();
  game.setup().props.onNameChange(0, "Alex");
  game.setup().props.onHandicapChange(0, "18");
  game.setup().props.onStart();
  const blank = byClass(game.hole(), "score-placeholder-button")[0];
  assert.equal(blank.type, "button");
  assert.equal(blank.props["aria-label"], "Enter par 3 for Alex");
  blank.props.onClick();
  assert.equal(game.stored().scores[1][0], 3);
  assert.equal(byClass(game.hole(), "score-placeholder-button").length, 0);
  assert.equal(byClass(game.hole(), "net-score")[0].props.children.join(""), "Net 2");
  nodes(game.hole()).find((node) => node.props?.["aria-label"] === "Raise Alex's score").props.onClick();
  blank.props.onClick();
  assert.equal(game.stored().scores[1][0], 4);
});

test("blank score entry uses the selected red-tee par on the Old Course", () => {
  for (const [redPar, expected] of [["men", 4], ["women", 5]]) {
    const old = course.getCourse("old", 18);
    const game = app({
      courseId: "old", holeCount: 18, tee: "red", currentHole: 3,
      players: [{ id: "alex", name: "Alex", tee: "red", redPar }],
      scores: Object.fromEntries(old.holes.map((hole) => [hole.number, [null]])),
    });
    byClass(game.hole(), "score-placeholder-button")[0].props.onClick();
    assert.equal(game.stored().scores[3][0], expected);
  }
});

test("removing a player keeps handicaps aligned and invalid handicaps block starting", () => {
  const game = app();
  game.setup().props.onNameChange(0, "Alex");
  game.setup().props.onHandicapChange(0, "18");
  game.setup().props.onAddPlayer();
  game.setup().props.onNameChange(1, "Sam");
  game.setup().props.onHandicapChange(1, "55");
  game.setup().props.onStart();
  assert.equal(game.stored(), null);
  game.setup().props.onHandicapChange(1, "9");
  game.setup().props.onRemovePlayer(0);
  game.setup().props.onStart();
  assert.equal(game.stored().players[0].name, "Sam");
  assert.equal(game.stored().players[0].handicap, 9);
});

function round() {
  return {
    players: [{ id: "sam", name: "Sam" }, { id: "alex", name: "Alex", handicap: 18 }],
    tee: "white", currentHole: 2,
    scores: Object.fromEntries(course.sampleCourse.holes.map((hole) => [hole.number, hole.number === 1 ? [4, 4] : [null, null]])),
  };
}

function setupView(game) {
  const setup = game.setup();
  return setup.type(setup.props);
}
const byClass = (tree, className) => nodes(tree).filter((node) => node.props?.className === className);

test("Add Player stays disabled for blank names and invalid handicaps", () => {
  const game = app();
  assert.equal(byClass(setupView(game), "add-player-button")[0].props.disabled, true);
  game.setup().props.onAddPlayer();
  assert.equal(game.setup().props.names.length, 1);
  game.setup().props.onNameChange(0, "   ");
  assert.equal(byClass(setupView(game), "add-player-button")[0].props.disabled, true);
  game.setup().props.onNameChange(0, "Alex");
  game.setup().props.onHandicapChange(0, "55");
  assert.equal(byClass(setupView(game), "add-player-button")[0].props.disabled, true);
  game.setup().props.onHandicapChange(0, "18");
  assert.equal(byClass(setupView(game), "add-player-button")[0].props.disabled, false);
});

test("adding a player collapses the previous entry into an editable summary", () => {
  const game = app();
  game.setup().props.onNameChange(0, "Alex");
  game.setup().props.onHandicapChange(0, "18");
  game.setup().props.onPlayerTeeChange(0, "red");
  game.setup().props.onAddPlayer();
  let view = setupView(game);
  assert.equal(byClass(view, "player-summary").length, 1);
  assert.equal(byClass(view, "player-setup-entry").length, 1);
  assert.equal(nodes(view).filter((node) => node.type === "input" && node.props.id.startsWith("player-")).length, 1);
  nodes(view).find((node) => node.props?.["aria-label"] === "Edit Alex").props.onClick();
  assert.equal(game.setup().props.editingPlayer, 0);
  assert.equal(game.setup().props.handicaps[0], "18");
  assert.equal(game.setup().props.playerTees[0], "red");
  game.setup().props.onNameChange(0, "Alexander");
  game.setup().props.onSavePlayer(0);
  assert.equal(game.setup().props.editingPlayer, 1);
  assert.equal(game.setup().props.names[0], "Alexander");
  game.setup().props.onNameChange(1, "Sam");
  game.setup().props.onSavePlayer(1);
  view = setupView(game);
  assert.equal(byClass(view, "player-summary").length, 2);
  assert.equal(byClass(view, "player-setup-entry").length, 0);
  assert.equal(byClass(view, "add-player-button")[0].props.disabled, false);
});

test("removing an edited player restores the pending draft and caps the group at four", () => {
  const game = app();
  game.setup().props.onNameChange(0, "Alex");
  game.setup().props.onAddPlayer();
  game.setup().props.onEditPlayer(0);
  game.setup().props.onRemovePlayer(0);
  assert.equal(game.setup().props.editingPlayer, 0);
  assert.equal(byClass(setupView(game), "player-setup-entry").length, 1);
  for (let index = 0; index < 4; index++) {
    game.setup().props.onNameChange(index, `Player ${index + 1}`);
    game.setup().props.onAddPlayer();
  }
  assert.equal(game.setup().props.names.length, 4);
  assert.equal(byClass(setupView(game), "add-player-button").length, 0);
});

test("restored rounds show honours order while controls update the original player's score", () => {
  const game = app(round());
  const rows = nodes(game.hole()).filter((node) => node.props?.className === "player-score-row");
  assert.equal(nodes(rows[0]).find((node) => node.type === "strong").props.children, "Alex");
  nodes(rows[0]).find((node) => node.props?.["aria-label"] === "Raise Alex's score").props.onClick();
  assert.deepEqual(game.stored().scores[2], [null, 3]);
});

test("the real New Course finishes after hole nine with par-27 results", () => {
  const saved = round();
  saved.currentHole = 9;
  saved.scores = Object.fromEntries(course.sampleCourse.holes.map((hole) => [hole.number, [3, 3]]));
  const game = app(saved);
  const pager = nodes(game.render()).find((node) => typeof node.props?.renderHole === "function");
  assert.equal(pager.props.lastHole, 9);
  pager.props.onNavigate(1);
  assert.equal(game.stored().currentHole, 10);
  const result = nodes(game.render()).find((node) => node.props?.onNewRound);
  const totals = nodes(result.type(result.props)).filter((node) => node.props?.className === "total-score");
  assert.equal(totals.length, 2);
  totals.forEach((node) => assert.equal(node.props.children[0], 27));
});

test("switching courses preserves player details and starts a real 18-hole Old Course round", () => {
  const game = app();
  game.setup().props.onNameChange(0, "Alex");
  game.setup().props.onHandicapChange(0, "18");
  const view = setupView(game);
  byClass(view, "course-switch-link")[0].props.onClick();
  const oldView = setupView(game);
  assert.equal(nodes(oldView).find((node) => node.type === "h2").props.children, "Old Course");
  assert.equal(byClass(oldView, "course-distance").length, 3);
  assert.equal(byClass(oldView, "start-button")[0].props.disabled, false);
  game.setup().props.onHoleCountChange(18);
  assert.equal(game.setup().props.names[0], "Alex");
  assert.equal(game.setup().props.handicaps[0], "18");
  assert.equal(game.setup().props.course.holes.length, 18);
  game.setup().props.onStart();
  assert.equal(game.stored().courseId, "old");
  assert.equal(game.stored().holeCount, 18);
  assert.equal(Object.keys(game.stored().scores).length, 18);
});

test("Old Course 9- and 18-hole rounds restore and produce correctly sized results", () => {
  for (const length of [9, 18]) {
    const old = course.getCourse("old", length);
    const saved = {
      courseId: "old", holeCount: length, tee: "white", currentHole: length,
      players: [{ id: "alex", name: "Alex", tee: "white", handicap: 18 }],
      scores: Object.fromEntries(old.holes.map((hole) => [hole.number, [hole.par]])),
    };
    const game = app(saved);
    const pager = nodes(game.render()).find((node) => node.props?.renderHole);
    assert.equal(pager.props.lastHole, length);
    pager.props.onNavigate(1);
    assert.equal(game.stored().currentHole, length + 1);
    const result = nodes(game.render()).find((node) => node.props?.onNewRound);
    const view = result.type(result.props);
    const total = byClass(view, "total-score")[0];
    assert.equal(total.props.children[0], length === 9 ? 34 : 69);
    assert.equal(nodes(byClass(view, "result-hole-table")[0]).filter((node) => node.type === "tr").length, length + 1);
  }
});

test("second-nine holes use their own yardages, par and scores with the shared physical map", () => {
  const old = course.getCourse("old", 18);
  const game = app({
    courseId: "old", holeCount: 18, tee: "white", currentHole: 17,
    players: [{ id: "alex", name: "Alex", tee: "white" }],
    scores: Object.fromEntries(old.holes.map((hole) => [hole.number, [null]])),
  });
  const map = nodes(game.hole()).find((node) => node.props?.courseId === "old");
  assert.equal(nodes(map.type(map.props)).find((node) => node.type === "svg").props.viewBox, maps.oldHoleMaps[7].viewBox);
  const distance = byClass(game.hole(), "map-distance")[0];
  assert.equal(nodes(distance).find((node) => node.type === "strong").props.children[0], 245);
  nodes(game.hole()).find((node) => node.props?.["aria-label"] === "Raise Alex's score").props.onClick();
  assert.equal(game.stored().scores[17][0], 4);
  assert.equal(game.stored().scores[8][0], null);
});

test("red-tee players can choose the printed men's par and retain their correct net score", () => {
  const game = app();
  game.setup().props.onCourseChange("old");
  game.setup().props.onHoleCountChange(18);
  game.setup().props.onNameChange(0, "Alex");
  game.setup().props.onPlayerTeeChange(0, "red");
  game.setup().props.onRedParChange(0, "men");
  game.setup().props.onHandicapChange(0, "18");
  game.setup().props.onStart();
  assert.equal(game.stored().players[0].redPar, "men");
  for (let hole = 1; hole < 3; hole++) nodes(game.render()).find((node) => node.props?.renderHole).props.onNavigate(1);
  nodes(game.hole()).find((node) => node.props?.["aria-label"] === "Raise Alex's score").props.onClick();
  assert.equal(game.stored().scores[3][0], 4);
  assert.equal(byClass(game.hole(), "net-score")[0].props.children.join(""), "Net 3");
});

test("results show one card per player with vertical hole tables and optional net totals", () => {
  const saved = round();
  saved.currentHole = 10;
  saved.players[1].handicap = 9;
  saved.scores = Object.fromEntries(course.sampleCourse.holes.map((hole) => [hole.number, [3, 3]]));
  const game = app(saved);
  const result = nodes(game.render()).find((node) => node.props?.onNewRound);
  const cards = byClass(result.type(result.props), "result-player-card");
  assert.equal(cards.length, 2);
  assert.equal(byClass(cards[0], "result-net-total").length, 0);
  assert.equal(nodes(byClass(cards[1], "result-net-total")[0]).find((node) => node.type === "strong").props.children, 22);
  for (const [index, card] of cards.entries()) {
    const table = byClass(card, "result-hole-table")[0];
    assert.equal(nodes(table).filter((node) => node.type === "tr").length, 10);
    assert.equal(nodes(table).filter((node) => node.props?.scope === "col").length, index === 0 ? 3 : 4);
  }
});

test("incomplete results retain dashes and show only the entered scores in totals", () => {
  const saved = round();
  saved.currentHole = 10;
  saved.players[1].handicap = 9;
  saved.scores = Object.fromEntries(course.sampleCourse.holes.map((hole) => [hole.number, [null, hole.number === 1 ? 4 : null]]));
  const game = app(saved);
  const result = nodes(game.render()).find((node) => node.props?.onNewRound);
  const cards = byClass(result.type(result.props), "result-player-card");
  assert.equal(byClass(cards[0], "total-score")[0].props.children[0], "\u2014");
  assert.equal(byClass(cards[1], "total-score")[0].props.children[0], 4);
  assert.equal(byClass(cards[1], "result-progress")[0].props.children, "1 / 9 holes scored");
  assert.equal(nodes(byClass(cards[1], "result-net-total")[0]).find((node) => node.type === "strong").props.children, 4);
});

test("Homepage and logo require confirmation during a round and preserve scores on rejection", () => {
  const game = app(round());
  const before = JSON.stringify(game.stored());
  let closed = false;
  const clickHome = () => nodes(game.render()).find((node) => node.type === "button" && node.props.children.includes(" Homepage")).props.onClick({
    currentTarget: { closest: () => ({ removeAttribute: () => { closed = true; } }) },
  });
  clickHome();
  assert.equal(JSON.stringify(game.stored()), before);
  assert.equal(closed, false);
  nodes(game.render()).find((node) => node.props?.className === "wordmark").props.onClick({ preventDefault() {} });
  assert.equal(game.confirmations.length, 2);
  assert.equal(JSON.stringify(game.stored()), before);
  game.context.approve = true;
  clickHome();
  assert.equal(game.stored(), null);
  assert.equal(closed, true);
  assert.deepEqual(Array.from(game.setup().props.handicaps), [""]);
});
