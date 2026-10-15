import * as THREE from "three";
import { STATES, LEVELS, SWEETS } from "../config.js";
import {
  $,
  clamp,
  rand,
  TAU,
  v3,
  fmt,
  mats,
  geos,
  mat,
  geo,
  mesh,
  group,
  flatRing,
  instanced,
} from "../core/primitives.js";
class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.note = 0;
    this.next = 0;
    this.enabled = true;
  }
  start() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.32;
        this.master.connect(this.ctx.destination);
        this.next = this.ctx.currentTime;
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    } catch {}
  }
  mute() {
    this.muted = !this.muted;
    this.start();
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.32,
        this.ctx.currentTime,
        0.04,
      );
    $("mute").textContent = this.muted ? "♫ MUTED" : "♫ SOUND ON";
    $("mute").setAttribute("aria-pressed", String(this.muted));
    $("mute").setAttribute(
      "aria-label",
      this.muted ? "Unmute audio" : "Mute audio",
    );
  }
  tone(f, d = 0.15, type = "sine", vol = 0.2, end = f, delay = 0) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(25, end), t + d);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + d + 0.03);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  noise(d = 0.22, vol = 0.14) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const n = Math.ceil(this.ctx.sampleRate * d),
      buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate),
      data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(),
      g = this.ctx.createGain();
    s.buffer = buf;
    g.gain.value = vol;
    s.connect(g);
    g.connect(this.master);
    s.start();
    s.onended = () => {
      s.disconnect();
      g.disconnect();
    };
  }
  play(name) {
    if (name === "collect") {
      this.tone(880, 0.12, "sine", 0.22, 1000);
      this.tone(1320, 0.18, "sine", 0.12, 1320, 0.06);
    }
    if (name === "jump") this.tone(180, 0.23, "sine", 0.22, 560);
    if (name === "throw") {
      this.noise(0.22, 0.11);
      this.tone(1300, 0.18, "triangle", 0.09, 300);
    }
    if (name === "alien") {
      this.tone(550, 0.13, "square", 0.06, 1000);
      this.tone(1000, 0.2, "sine", 0.15, 220, 0.1);
    }
    if (name === "portal") {
      this.noise(0.8, 0.18);
      [220, 330, 440, 660].forEach((f, i) =>
        this.tone(f, 0.8, "sine", 0.12, f * 2, i * 0.08),
      );
    }
    if (name === "firework") {
      this.noise(0.3, 0.18);
      this.tone(80, 0.13, "sine", 0.14, 30);
    }
    if (name === "hurt") this.tone(260, 0.25, "triangle", 0.2, 90);
    if (name === "power")
      [440, 554, 660, 880].forEach((f, i) =>
        this.tone(f, 0.2, "sine", 0.12, f, i * 0.08),
      );
  }
  update(active) {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (!active || this.muted) {
      this.next = this.ctx.currentTime;
      return;
    }
    const melody = [
      64, 67, 69, 72, 69, 67, 64, 62, 64, 67, 74, 72, 69, 67, 62, 60,
    ];
    if (this.ctx.currentTime >= this.next) {
      const f = 440 * 2 ** ((melody[this.note % melody.length] - 69) / 12);
      this.tone(f, 0.2, "triangle", 0.055, f);
      if (this.note % 4 === 0) this.tone(f / 2, 0.35, "sine", 0.07, f / 2);
      this.note++;
      this.next = this.ctx.currentTime + 0.28;
    }
  }
}
export { Audio };
