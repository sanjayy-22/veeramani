import { Vec2 } from "./math.js";
import { $ } from "./primitives.js";
class Input {
  constructor(game) {
    this.game = game;
    this.keys = new Set();
    this.pressed = new Set();
    this.joy = new Vec2();
    this.pointer = null;
    this.throwHeld = false;
    this.touch =
      matchMedia("(pointer:coarse)").matches || navigator.maxTouchPoints > 0;
    document.body.classList.toggle("touch-enabled", this.touch);
    const controls = [
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ShiftLeft",
      "ShiftRight",
      "KeyE",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
    ];
    window.addEventListener("keydown", (e) => {
      if (controls.includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === "Escape" && !e.repeat) game.togglePause();
      game.audio.start();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.reset();
      game.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.reset();
        game.pause();
      }
    });
    $("world").addEventListener("pointerdown", (e) => {
      if (e.button === 0) {
        this.pressed.add("KeyE");
        game.audio.start();
      }
    });
    const joy = $("joystick"),
      stick = $("stick");
    const move = (e) => {
      if (e.pointerId !== this.pointer) return;
      const r = joy.getBoundingClientRect(),
        dx = e.clientX - r.left - r.width / 2,
        dy = e.clientY - r.top - r.height / 2,
        len = Math.hypot(dx, dy),
        s = len > 42 ? 42 / len : 1;
      this.joy.set((dx * s) / 42, (dy * s) / 42);
      stick.style.transform = `translate(${dx * s}px,${dy * s}px)`;
    };
    joy.addEventListener("pointerdown", (e) => {
      this.pointer = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      move(e);
      game.audio.start();
    });
    joy.addEventListener("pointermove", move);
    const release = (e) => {
      if (e.pointerId === this.pointer) {
        this.pointer = null;
        this.joy.set(0, 0);
        stick.style.transform = "";
      }
    };
    joy.addEventListener("pointerup", release);
    joy.addEventListener("pointercancel", release);
    joy.addEventListener("lostpointercapture", release);
    [
      ["jumpTouch", "Space"],
      ["dashTouch", "ShiftLeft"],
      ["throwTouch", "KeyE"],
    ].forEach(([id, key]) => {
      const el = $(id);
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.pressed.add(key);
        this.keys.add(key);
        game.audio.start();
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((event) =>
        el.addEventListener(event, () => this.keys.delete(key)),
      );
    });
  }
  movement() {
    const x =
        (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
        (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) +
        this.joy.x,
      z =
        (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
        (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) +
        this.joy.y;
    const v = new Vec2(x, z);
    if (v.length() > 1) v.normalize();
    return v;
  }
  take(k) {
    const p = this.pressed.has(k);
    this.pressed.delete(k);
    return p;
  }
  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.joy.set(0, 0);
    this.pointer = null;
    $("stick").style.transform = "";
  }
  endFrame() {
    this.pressed.clear();
  }
}

// Fixed-capacity particle pool: no per-frame GPU allocations, texture or asset files.
export { Input };
