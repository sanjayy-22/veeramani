import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Campaign, SAVE_KEY } from "../src/core/Campaign.js";
import { Game } from "../src/Game.js";
import { STATES, LEVELS } from "../src/config.js";
import { v3 } from "../src/core/primitives.js";

const noop = () => {};
const elements = new Map();
globalThis.document = {
  getElementById(id) {
    if (!elements.has(id))
      elements.set(id, {
        hidden: false,
        style: {},
        classList: { add: noop, remove: noop, toggle: noop },
        focus: noop,
      });
    return elements.get(id);
  },
  createElement() {
    return { width: 0, height: 0, getContext: () => ({ fillText: noop }) };
  },
};
function storage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
}
function harness() {
  const g = Object.create(Game.prototype);
  Object.assign(g, {
    scene: new THREE.Scene(),
    world: new THREE.Group(),
    sun: new THREE.DirectionalLight(),
    ambient: new THREE.HemisphereLight(),
    camera: new THREE.PerspectiveCamera(),
    look: v3(),
    audio: { start: noop, play: noop, tone: noop, update: noop },
    particles: { clear: noop, emit: noop, update: noop },
    hud: { toast: noop, pickup: noop, update: noop },
    input: {
      reset: noop,
      take: () => false,
      keys: new Set(),
      movement: () => new THREE.Vector2(),
      endFrame: noop,
    },
    renderer: { render: noop, setAnimationLoop: noop },
    clock: { getDelta: () => 1 / 60 },
    campaign: new Campaign(storage()),
    state: STATES.PLAYING,
    score: 0,
    totalTime: 0,
    totalCollected: 0,
    lives: 5,
    best: 0,
  });
  g.scene.add(g.world);
  return g;
}
function collectAll(g) {
  // Use real pickup rules; let each scattered sweet settle before collecting it.
  for (const item of g.collectibles.items) {
    if (!item.alive) continue;
    if (item.velocity) {
      item.pos.y = 0.7;
      item.velocity = null;
    }
    g.player.pos.copy(item.pos);
    g.player.pos.y = 0;
    g.collectibles.update(0);
  }
}
test("all four authored stages conserve sweets, unlock portals and reach victory", () => {
  const g = harness();
  for (let index = 0; index < 4; index++) {
    g.beginChapter(index);
    g.enterLevel();
    assert.equal(g.collectibles.items.length, 36);
    assert.equal(
      g.collectibles.items.length +
        g.aliens.reduce((n, a) => n + a.loot, 0) +
        (index === 3 ? 12 : 0),
      LEVELS[index].target,
    );
    // Dropped loot must never duplicate the caught alien's remaining stash.
    for (const alien of g.aliens) {
      alien.dropClock = 0;
      alien.update(0.01);
      alien.stun();
      g.player.pos.copy(alien.pos);
      alien.update(0.01);
      assert.equal(alien.caught, true);
    }
    if (g.boss) {
      g.boss.activate();
      g.boss.age = 0;
      g.boss.hit();
      assert.equal(g.boss.hp, 3);
      for (let hit = 0; hit < 3; hit++) {
        g.boss.age = 4;
        g.boss.stunTime = 0;
        g.boss.hit();
      }
      assert.equal(g.boss.defeated, true);
      g.player.pos.set(0, 0, -9);
      g.boss.update(0);
      g.boss.update(0);
      assert.equal(g.collectibles.items.length, 60);
    }
    collectAll(g);
    assert.equal(g.collected, LEVELS[index].target);
    g.player.pos.set(0, 0, -20.8);
    g.player.invuln = 100;
    g.frame();
    assert.equal(g.campaign.data.unlocked, Math.min(3, index + 1));
    assert.equal(g.state, index === 3 ? STATES.VICTORY : STATES.HUB);
  }
  assert.equal(g.campaign.totals.sweets, 212);
});
test("checkpoint survives JSON roundtrip with caught aliens, scattered sweets and tokens", () => {
  const g = harness();
  g.beginChapter(0);
  g.enterLevel();
  const a = g.aliens[0];
  a.catch();
  collectAll(g);
  g.tokens = 1;
  g.builder.tokens[0].alive = false;
  g.spawn.set(0, 0, 64);
  g.timeLeft = 301;
  g.builder.checkpoints[0].active = true;
  g.saveCheckpoint();
  const saved = JSON.parse(JSON.stringify(g.campaign.data.checkpoint));
  const count = g.collected,
    score = g.score;
  g.score = 99999;
  g.restoreCheckpoint(saved);
  assert.equal(g.collected, count);
  assert.equal(g.score, score);
  assert.equal(g.caught, 1);
  assert.equal(g.aliens[0].root.visible, false);
  assert.equal(g.tokens, 1);
  assert.equal(g.timeLeft, 301);
  assert.deepEqual(g.player.pos.toArray(), [0, 0, 64]);
  const remaining =
    g.collectibles.items.filter((i) => i.alive).length +
    g.aliens.reduce((n, a) => n + a.loot, 0);
  assert.equal(g.collected + remaining, g.config.target);
});
test("blocked storage is nonfatal; records persist and replays do not duplicate totals", () => {
  const denied = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  const blocked = new Campaign(denied);
  blocked.complete(0, {
    score: 500,
    sweets: 48,
    time: 100,
    tokens: 0,
    medal: "bronze",
  });
  assert.equal(blocked.data.unlocked, 1);
  assert.equal(blocked.available, false);
  const s = storage(),
    c = new Campaign(s);
  c.complete(0, {
    score: 500,
    sweets: 48,
    time: 100,
    tokens: 0,
    medal: "bronze",
  });
  c.complete(0, {
    score: 400,
    sweets: 48,
    time: 150,
    tokens: 0,
    medal: "bronze",
  });
  assert.equal(c.totals.score, 500);
  assert.equal(c.totals.sweets, 48);
  assert.equal(new Campaign(s).data.unlocked, 1);
  s.setItem(SAVE_KEY, "bad json");
  assert.equal(new Campaign(s).data.unlocked, 0);
});
test("movement, jumping and stun durations are stable across frame rates", () => {
  const sample = (hz) => {
    const g = harness();
    g.beginChapter(0);
    g.enterLevel();
    g.player.pos.set(0, 0, 98);
    g.input.movement = () => new THREE.Vector2(0, -1);
    for (let i = 0; i < hz * 2; i++) g.player.update(1 / hz);
    const z = g.player.pos.z;
    g.input.movement = () => new THREE.Vector2();
    let jump = true;
    g.input.take = (key) =>
      key === "Space" && jump ? ((jump = false), true) : false;
    let peak = 0;
    for (let i = 0; i < hz * 2; i++) {
      g.player.update(1 / hz);
      peak = Math.max(peak, g.player.pos.y);
    }
    return { z, peak };
  };
  const a = sample(30),
    b = sample(120);
  assert.ok(Math.abs(a.z - b.z) < 0.2);
  assert.ok(Math.abs(a.peak - b.peak) < 0.15);
  const g = harness();
  g.beginChapter(0);
  g.enterLevel();
  const thief = g.aliens[0];
  thief.stun();
  for (let i = 0; i < 119; i++) thief.update(1 / 60);
  assert.ok(thief.stunTime > 0);
  thief.update(0.03);
  assert.equal(thief.stunTime, 0);
});
test("damage respawns at the lit checkpoint and pause freezes campaign time", () => {
  const g = harness();
  g.beginChapter(0);
  g.enterLevel();
  g.spawn.set(0, 0, 31);
  g.player.invuln = 0;
  g.player.hurt();
  assert.equal(g.lives, 4);
  assert.equal(g.player.pos.z, 31);
  const time = g.timeLeft;
  g.pause();
  g.frame();
  assert.equal(g.timeLeft, time);
  g.resume();
  assert.equal(g.state, STATES.PLAYING);
});
