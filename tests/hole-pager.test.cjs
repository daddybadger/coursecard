const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const code = ts.transpileModule(fs.readFileSync(require.resolve("../src/components/hole-pager.tsx"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function pager(hole = 4) {
  const refs = [], effects = [], listeners = new Map(), moves = [], animations = [];
  class Element { closest() { return null; } }
  const target = new Element();
  const viewport = {
    clientWidth: 390, setPointerCapture() {}, hasPointerCapture: () => false,
    addEventListener(type, fn, options) { listeners.set(type, { fn, options }); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const track = { style: {}, animate(frames) {
    let resolve;
    const finished = new Promise((done) => { resolve = done; });
    const animation = { frames, finished, resolve, cancel() {} };
    animations.push(animation);
    return animation;
  } };
  const context = {
    exports: {}, Element, window: { matchMedia: () => ({ matches: false }) },
    require(name) {
      if (name === "react") return {
        useRef(value) {
          const ref = { current: refs.length === 0 ? viewport : refs.length === 1 ? track : value };
          refs.push(ref); return ref;
        },
        useEffect(fn) { effects.push(fn); },
      };
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      throw Error(name);
    },
  };
  vm.runInNewContext(code, context);
  const root = context.exports.HolePager({ hole, lastHole: 18, onNavigate: (direction) => moves.push(direction), renderHole: () => null });
  const cleanup = effects.map((fn) => fn());
  const point = (x, y = 0, identifier = 1) => ({ identifier, clientX: x, clientY: y });
  function touch(type, touches, changedTouches = touches, eventTarget = target) {
    const event = { touches, changedTouches, target: eventTarget, cancelable: true, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; } };
    listeners.get(type).fn(event);
    return event;
  }
  const pointer = (x, y = 0, pointerType = "mouse") => ({ pointerId: 1, clientX: x, clientY: y, pointerType,
    isPrimary: true, button: 0, target, currentTarget: viewport });
  const finish = async () => { animations.at(-1).resolve(); await Promise.resolve(); };
  return { root, listeners, animations, moves, point, touch, pointer, finish, cleanup, track, Element };
}

test("slow touch swipes stay horizontal despite substantial later vertical drift", async () => {
  for (const direction of [-1, 1]) {
    const p = pager();
    assert.equal(p.listeners.get("touchmove").options.passive, false);
    p.touch("touchstart", [p.point(200)]);
    for (const [dx, dy] of [[4, 1], [12, 3], [30, 12], [50, 70], [100, 140]]) {
      const event = p.touch("touchmove", [p.point(200 - direction * dx, dy)]);
      assert.equal(event.defaultPrevented, true);
    }
    // Browsers may cancel their pointer stream; the touch stream owns this drag.
    p.root.props.onPointerCancel(p.pointer(200 - direction * 100, 140, "touch"));
    assert.equal(p.animations.length, 0);
    p.touch("touchend", [], [p.point(200 - direction * 100, 140)]);
    await p.finish();
    assert.deepEqual(p.moves, [direction]);
  }
});

test("vertical scrolling remains native and cannot later turn into a hole swipe", () => {
  const p = pager();
  p.touch("touchstart", [p.point(200)]);
  assert.equal(p.touch("touchmove", [p.point(202, 30)]).defaultPrevented, false);
  assert.equal(p.touch("touchmove", [p.point(100, 40)]).defaultPrevented, false);
  p.touch("touchend", [], [p.point(100, 40)]);
  assert.equal(p.animations.length, 0);
  assert.deepEqual(p.moves, []);
});

test("short and genuinely cancelled swipes snap back", async () => {
  for (const cancelled of [false, true]) {
    const p = pager();
    p.touch("touchstart", [p.point(200)]);
    p.touch("touchmove", [p.point(cancelled ? 100 : 180)]);
    p.touch(cancelled ? "touchcancel" : "touchend", [], [p.point(cancelled ? 100 : 180)]);
    await p.finish();
    assert.deepEqual(p.moves, []);
    assert.match(p.track.style.transform, /0px/);
  }
});

test("pinch gestures are not prevented and abandon an existing horizontal drag", async () => {
  const p = pager();
  p.touch("touchstart", [p.point(200)]);
  p.touch("touchmove", [p.point(100)]);
  assert.equal(p.touch("touchstart", [p.point(100), p.point(200, 0, 2)]).defaultPrevented, false);
  assert.equal(p.touch("touchmove", [p.point(90), p.point(210, 0, 2)]).defaultPrevented, false);
  await p.finish();
  assert.deepEqual(p.moves, []);
});

test("score controls retain normal touch behaviour", () => {
  const p = pager();
  const button = new p.Element(); button.closest = () => button;
  p.touch("touchstart", [p.point(200)], undefined, button);
  assert.equal(p.touch("touchmove", [p.point(100)]).defaultPrevented, false);
  p.touch("touchend", [], [p.point(100)]);
  assert.equal(p.animations.length, 0);
});

test("mouse swipes still work and native listeners are removed on cleanup", async () => {
  const p = pager();
  p.root.props.onPointerDown(p.pointer(200));
  p.root.props.onPointerMove(p.pointer(100));
  p.root.props.onPointerUp(p.pointer(100));
  await p.finish();
  assert.deepEqual(p.moves, [1]);
  p.cleanup.forEach((fn) => fn?.());
  assert.equal(p.listeners.size, 0);
});
