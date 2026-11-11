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
  assert.equal(net.props.children.join(""), "Net 3");
  nodes(game.hole()).find((node) => node.props?.["aria-label"] === "Raise Sam's score").props.onClick();
  assert.equal(nodes(game.hole()).filter((node) => node.props?.className === "net-score").length, 1);
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

test("restored rounds show honours order while controls update the original player's score", () => {
  const game = app(round());
  const rows = nodes(game.hole()).filter((node) => node.props?.className === "player-score-row");
  assert.equal(nodes(rows[0]).find((node) => node.type === "strong").props.children, "Alex");
  nodes(rows[0]).find((node) => node.props?.["aria-label"] === "Raise Alex's score").props.onClick();
  assert.deepEqual(game.stored().scores[2], [null, 3]);
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
