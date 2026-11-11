"use client";

import { useEffect, useRef } from "react";
import type { PointerEvent, ReactNode } from "react";

type Direction = -1 | 1;

export function HolePager({ hole, lastHole, onNavigate, renderHole }: {
  hole: number;
  lastHole: number;
  onNavigate: (direction: Direction) => void;
  renderHole: (hole: number, navigate: (direction: Direction) => void) => ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; offset: number; axis: "x" | "y" | null } | null>(null);
  const animation = useRef<Animation | null>(null);
  const busy = useRef(false);

  useEffect(() => () => {
    animation.current?.cancel();
  }, []);

  function canNavigate(direction: Direction) {
    return direction === 1 ? hole <= lastHole : hole > 1;
  }

  function settle(offset: number, direction?: Direction) {
    const element = track.current;
    const width = viewport.current?.clientWidth;
    if (!element || !width || busy.current) return;
    busy.current = true;
    const destination = direction ? -direction * width : 0;
    const transform = (x: number) => `translate3d(calc(-100% + ${x}px), 0, 0)`;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    animation.current = element.animate(
      [{ transform: transform(offset) }, { transform: transform(destination) }],
      { duration: reducedMotion ? 0 : 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );
    void animation.current.finished.then(() => {
      if (direction) {
        // The parent remounts the pager at the new hole once the slide finishes.
        onNavigate(direction);
      } else {
        element.style.transform = transform(0);
        animation.current?.cancel();
        animation.current = null;
        busy.current = false;
      }
    }).catch(() => undefined);
  }

  function navigate(direction: Direction) {
    if (!busy.current && !gesture.current && canNavigate(direction)) settle(0, direction);
  }

  function begin(id: number, x: number, y: number, target: EventTarget | null) {
    if (busy.current || gesture.current) return;
    if (target instanceof Element && target.closest("button, input, a, select, textarea")) return;
    gesture.current = { id, x, y, offset: 0, axis: null };
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    // Touch input uses non-passive touch listeners below so we can stop native
    // scrolling after horizontal intent is established. Keep pointers for mouse/pen.
    if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0) return;
    begin(event.pointerId, event.clientX, event.clientY, event.target);
  }

  function drag(id: number, x: number, y: number, capture?: () => void) {
    const swipe = gesture.current;
    if (!swipe || swipe.id !== id || !track.current || !viewport.current) return;
    const dx = x - swipe.x;
    const dy = y - swipe.y;
    if (!swipe.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      swipe.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (swipe.axis === "x") capture?.();
    }
    if (swipe.axis !== "x") return;
    const width = viewport.current.clientWidth;
    // Resist dragging beyond the first hole and limit each swipe to one page.
    swipe.offset = Math.max(-width, Math.min(width, dx * (dx > 0 && hole === 1 ? 0.2 : 1)));
    track.current.style.transform = `translate3d(calc(-100% + ${swipe.offset}px), 0, 0)`;
  }

  function finish(id: number, cancelled = false) {
    const swipe = gesture.current;
    if (!swipe || swipe.id !== id) return;
    gesture.current = null;
    if (swipe.axis !== "x") return;
    const direction = swipe.offset < 0 ? 1 : -1;
    const threshold = Math.min(70, (viewport.current?.clientWidth ?? 350) * 0.2);
    settle(swipe.offset, !cancelled && Math.abs(swipe.offset) >= threshold && canNavigate(direction) ? direction : undefined);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    drag(event.pointerId, event.clientX, event.clientY,
      () => event.currentTarget.setPointerCapture(event.pointerId));
  }

  function end(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    if (event.pointerType === "touch") return;
    finish(event.pointerId, cancelled);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  // React's delegated touchmove listener is passive. Attach directly to the
  // viewport to prevent scrolling only for a horizontal, single-finger swipe.
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    function touchStart(event: TouchEvent) {
      if (event.touches.length !== 1) {
        if (gesture.current) finish(gesture.current.id, true);
        return;
      }
      const touch = event.touches[0];
      begin(touch.identifier, touch.clientX, touch.clientY, event.target);
    }
    function touchMove(event: TouchEvent) {
      const swipe = gesture.current;
      if (!swipe) return;
      if (event.touches.length !== 1) {
        finish(swipe.id, true);
        return;
      }
      const touch = Array.from(event.touches).find((touch) => touch.identifier === swipe.id);
      if (!touch) return;
      drag(touch.identifier, touch.clientX, touch.clientY);
      // Once locked horizontally, vertical drift must not hand the gesture to
      // native scrolling. Also protect a small horizontal lead before the lock.
      if (swipe.axis === "x" || (!swipe.axis && Math.abs(touch.clientX - swipe.x) > Math.abs(touch.clientY - swipe.y))) {
        if (event.cancelable) event.preventDefault();
      }
    }
    function touchEnd(event: TouchEvent) {
      const swipe = gesture.current;
      if (!swipe) return;
      const touch = Array.from(event.changedTouches).find((touch) => touch.identifier === swipe.id);
      if (!touch) return;
      drag(touch.identifier, touch.clientX, touch.clientY);
      finish(touch.identifier);
    }
    function touchCancel() {
      if (gesture.current) finish(gesture.current.id, true);
    }
    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: false });
    element.addEventListener("touchend", touchEnd, { passive: true });
    element.addEventListener("touchcancel", touchCancel, { passive: true });
    return () => {
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("touchend", touchEnd);
      element.removeEventListener("touchcancel", touchCancel);
    };
  });

  return (
    <div className="hole-viewport" ref={viewport}
      onPointerDown={start} onPointerMove={move}
      onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)}
      onLostPointerCapture={(event) => {
        // Touch input implicitly captures the child that was touched. Moving
        // capture to this viewport emits a bubbling loss event from that child;
        // only losing the viewport's own capture should cancel the swipe.
        if (event.target === event.currentTarget) end(event, true);
      }}>
      <div className="hole-track" ref={track}>
        {[-1, 0, 1].map((offset) => (
          <div className="hole-slide" key={offset} inert={offset !== 0} aria-hidden={offset !== 0}>
            {hole + offset > 0 && hole + offset <= lastHole + 1 ? renderHole(hole + offset, navigate) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
