import { Campaign } from "./core/Campaign.js";
import { Hub } from "./world/Hub.js";
import * as THREE from "three";
import { STATES, LEVELS, SWEETS } from "./config.js";
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
} from "./core/primitives.js";
import { Audio } from "./core/Audio.js";
import { Input } from "./core/Input.js";
import { Particles } from "./core/Particles.js";
import { Player } from "./actors/Player.js";
import { Boss } from "./actors/Boss.js";
import { Collectibles } from "./world/Collectibles.js";
import { LevelBuilder } from "./world/LevelBuilder.js";
import { HUD } from "./ui/HUD.js";
class Game {
  constructor() {
    this.state = STATES.MENU;
    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.renderer = new THREE.WebGLRenderer({
      canvas: $("world"),
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.camera = new THREE.PerspectiveCamera(
      48,
      innerWidth / innerHeight,
      0.1,
      140,
    );
    this.camera.position.set(14, 15, 28);
    this.look = v3(0, 1, 0);
    this.ambient = new THREE.HemisphereLight(0xc7dfff, 0x6d554d, 2.3);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.position.set(-12, 26, 13);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 30,
      bottom: -30,
      near: 1,
      far: 75,
    });
    this.sun.shadow.bias = -0.0007;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.audio = new Audio();
    this.input = new Input(this);
    this.hud = new HUD(this);
    this.particles = new Particles(this.scene);
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.totalTime = 0;
    this.score = 0;
    this.totalCollected = 0;
    this.lives = 5;
    this.best = 0;
    this.projectiles = [];
    this.boss = null;
    this.levelIndex = 0;
    this.checkpoint = null;
    this.campaign = new Campaign();
    this.bounds = { minX: -15.3, maxX: 15.3, minZ: -22, maxZ: 103 };
    this.spawn = v3(0, 0, 98);
    try {
      const value = Number(localStorage.getItem("mars-sweet-heist-best"));
      this.best = Number.isFinite(value) ? Math.max(0, value) : 0;
    } catch {}
    $("best").textContent = this.best.toLocaleString();
    this.bind();
    this.loadLevel(0);
    this.menuScene();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    $("world").addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.pause();
      $("loading").hidden = false;
      $("loadingText").textContent =
        "The graphics context was interrupted. Reload this page to play again.";
    });
    clearTimeout(window.bootTimer);
    $("loading").hidden = true;
    this.renderer.setAnimationLoop(() => this.frame());
  }
  get playing() {
    return [STATES.PLAYING, STATES.BOSS, STATES.HUB].includes(this.state);
  }
  get config() {
    return LEVELS[this.levelIndex];
  }
  bind() {
    $("journal").onclick = (event) => {
      const button = event.target.closest("button[data-era]");
      if (button && this.state === STATES.HUB)
        this.beginChapter(Number(button.dataset.era));
    };
    $("heroButton").onclick = () => {
      this.heroView = true;
      this.heroCloseup = false;
      this.heroAngle = 0;
      this.player.root.rotation.y = 0;
      $("heroZoom").textContent = "Face close-up";
      $("menu").hidden = true;
      $("heroView").hidden = false;
      $("heroBack").focus();
      this.audio.start();
    };
    $("heroBack").onclick = () => this.closeHero();
    $("heroLeft").onclick = () => {
      this.heroAngle -= Math.PI / 5;
    };
    $("heroRight").onclick = () => {
      this.heroAngle += Math.PI / 5;
    };
    $("heroZoom").onclick = () => {
      this.heroCloseup = !this.heroCloseup;
      $("heroZoom").textContent = this.heroCloseup
        ? "Full character"
        : "Face close-up";
    };
    $("play").onclick = () => this.start();
    $("continueSave").onclick = () =>
      this.restoreCheckpoint(this.campaign.data.checkpoint);
    $("hubButton").onclick = () => this.loadHub();
    $("victoryHub").onclick = () => this.loadHub();
    $("continueSave").hidden = !this.campaign.data.checkpoint;
    $("again").onclick = () => this.start();
    $("mute").onclick = () => this.audio.mute();
    $("pauseButton").onclick = () => this.togglePause();
    $("resume").onclick = () => this.resume();
    $("restart").onclick = () => this.retry();
    $("retry").onclick = () => this.retry();
    for (const id of ["quit", "overMenu", "victoryMenu"])
      $(id).onclick = () => this.menu();
    $("continue").onclick = () => this.enterLevel();
    $("helpButton").onclick = () => {
      $("help").hidden = false;
      this.audio.start();
    };
    $("helpClose").onclick = () => {
      $("help").hidden = true;
    };
  }
  resize() {
    const touch =
      matchMedia("(pointer:coarse)").matches ||
      navigator.maxTouchPoints > 0 ||
      innerWidth < 700;
    this.input.touch = touch;
    document.body.classList.toggle("touch-enabled", touch);
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  closeHero() {
    this.heroView = false;
    $("heroView").hidden = true;
    $("menu").hidden = false;
    this.player.root.rotation.y = 0.45;
    $("heroButton").focus();
  }
  hideOverlays() {
    $("journal").hidden = true;
    this.heroView = false;
    for (const id of [
      "menu",
      "pause",
      "help",
      "transition",
      "gameOver",
      "victory",
      "heroView",
    ])
      $(id).hidden = true;
  }
  start() {
    this.audio.start();
    this.loadHub();
  }
  loadHub() {
    this.hideOverlays();
    this.clearWorld();
    this.levelIndex = 0;
    this.state = STATES.HUB;
    this.lives = 5;
    const totals = this.campaign.totals;
    this.score = totals.score;
    this.totalCollected = totals.sweets;
    this.totalTime = totals.time;
    this.collected = 0;
    this.caught = 0;
    this.aliens = [];
    this.elapsed = 0;
    this.collectibles = new Collectibles(this);
    this.builder = new Hub(this);
    this.player = new Player(this);
    this.player.reset();
    this.input.reset();
    this.camera.position.copy(this.player.pos).add(v3(0, 10.5, 15));
    this.look.copy(this.player.pos);
    $("hud").hidden = false;
    $("touch").classList.add("play");
    $("bossHud").hidden = true;
    $("chapter").textContent = "THE TIME COURTYARD";
    $("levelName").textContent = "Choose your next era";
    this.hud.toast(
      "Walk into a glowing portal. Completed eras can be replayed for better medals.",
      5,
    );
    this.hud.tick = 0;
    this.hud.update(0);
  }
  beginChapter(index) {
    if (index > this.campaign.data.unlocked) return;
    const totals = this.campaign.totals;
    this.score = totals.score;
    this.totalCollected = totals.sweets;
    this.totalTime = totals.time;
    this.lives = 5;
    this.levelBase = {
      score: this.score,
      sweets: this.totalCollected,
      time: this.totalTime,
    };
    this.checkpoint = null;
    this.hideOverlays();
    this.loadLevel(index);
    this.showTransition(index === 0);
  }
  saveCheckpoint() {
    // Boss encounters restart from the last safe route checkpoint.
    if (this.state === STATES.HUB || this.boss?.active || this.boss?.defeated)
      return;
    const snap = {
      index: this.levelIndex,
      base: this.levelBase,
      score: this.score,
      sweets: this.totalCollected,
      totalTime: this.totalTime,
      timeLeft: this.timeLeft,
      lives: this.lives,
      collected: this.collected,
      caught: this.caught,
      elapsed: this.elapsed,
      spawn: this.spawn.toArray(),
      tokens: this.tokens,
      tokenAlive: this.builder.tokens.map((t) => t.alive),
      checkpoints: this.builder.checkpoints.map((c) => c.active),
      items: this.collectibles.items.map((i) => ({
        ...i,
        pos: i.pos.toArray(),
        velocity: i.velocity?.toArray() || null,
      })),
      powers: this.collectibles.powerups.map((p) => p.alive),
      aliens: this.aliens.map((a) => ({
        pos: a.pos.toArray(),
        waypoint: a.waypoint,
        caught: a.caught,
        loot: a.loot,
        age: a.age,
        dropClock: a.dropClock,
      })),
    };
    this.checkpoint = snap;
    this.campaign.data.checkpoint = snap;
    this.campaign.save();
  }
  restoreCheckpoint(snap) {
    if (
      !snap ||
      !Number.isInteger(snap.index) ||
      snap.index < 0 ||
      snap.index > 3 ||
      !Array.isArray(snap.items)
    )
      return this.loadHub();
    this.audio.start();
    this.hideOverlays();
    this.loadLevel(snap.index);
    this.levelBase = snap.base;
    this.score = snap.score;
    this.totalCollected = snap.sweets;
    this.totalTime = snap.totalTime;
    this.timeLeft = Math.max(90, snap.timeLeft);
    this.lives = Math.max(4, snap.lives);
    this.collected = snap.collected;
    this.caught = snap.caught;
    this.elapsed = snap.elapsed;
    this.tokens = snap.tokens;
    this.spawn.fromArray(snap.spawn);
    this.player.reset();
    this.collectibles.items = snap.items.map((i) => ({
      ...i,
      pos: v3().fromArray(i.pos),
      velocity: i.velocity ? v3().fromArray(i.velocity) : null,
    }));
    this.collectibles.powerups.forEach((p, i) => {
      p.alive = snap.powers[i];
      p.root.visible = p.alive;
    });
    this.builder.tokens.forEach((t, i) => {
      t.alive = snap.tokenAlive[i];
      t.root.visible = t.alive;
    });
    this.builder.checkpoints.forEach((c, i) => {
      c.active = snap.checkpoints[i];
    });
    this.aliens.forEach((a, i) => {
      const saved = snap.aliens[i];
      a.pos.fromArray(saved.pos);
      for (const k of ["waypoint", "caught", "loot", "age", "dropClock"])
        a[k] = saved[k];
      a.root.visible = !a.caught;
    });
    this.checkpoint = snap;
    this.enterLevel(false);
    this.hud.toast("Checkpoint restored. Your recovered sweets are safe.", 3);
  }
  showTransition(first = false) {
    this.state = STATES.PORTAL_TRANSITION;
    this.input.reset();
    $("hud").hidden = true;
    $("touch").classList.remove("play");
    $("transition").hidden = false;
    $("transitionLabel").textContent = first
      ? "A DIWALI NIGHT GONE SIDEWAYS"
      : "THE TIME-PORTAL TRAIL";
    $("transitionTitle").textContent = this.config.short;
    $("transitionText").textContent = this.config.description;
    $("route").innerHTML = LEVELS.map(
      (_, i) =>
        `<span class="${i <= this.levelIndex ? "done" : ""}">${i < this.levelIndex ? "✓" : String(i + 1).padStart(2, "0")}</span>`,
    ).join("");
    $("continue").textContent = first
      ? "Start the chase ↗"
      : "Into the portal ↗";
    this.transitionClock = 0;
    this.audio.play("portal");
  }
  enterLevel(save = true) {
    this.audio.start();
    this.hideOverlays();
    // Start behind the hero immediately after the portal's cinematic camera.
    this.camera.position.copy(this.player.pos).add(v3(0, 10.5, 15));
    this.look.copy(this.player.pos).add(v3(0, 1.2, -4));
    this.state = STATES.PLAYING;
    if (save) this.saveCheckpoint();
    $("hud").hidden = false;
    $("touch").classList.add("play");
    this.input.reset();
    this.hud.toast(
      this.levelIndex === 0
        ? "Move with WASD / arrows. Follow the sweets; E throws a sparkler."
        : "New era. Same hungry thieves.",
      4,
    );
    this.hud.tick = 0;
    this.hud.update(0);
  }
  clearWorld() {
    // Shared primitive resources survive chapter changes; dispose chapter-only geometry.
    const keepGeo = new Set(geos.values()),
      keepMat = new Set(mats.values());
    const disposed = new Set();
    this.world.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.userData.disposeTexture) o.material?.map?.dispose();
      if (o.geometry && !keepGeo.has(o.geometry) && !disposed.has(o.geometry)) {
        o.geometry.dispose();
        disposed.add(o.geometry);
      }
      if (o.material && !keepMat.has(o.material) && !disposed.has(o.material)) {
        o.material.dispose();
        disposed.add(o.material);
      }
    });
    this.world.clear();
    this.particles.clear();
    this.projectiles = [];
    this.boss = null;
  }
  loadLevel(index) {
    this.clearWorld();
    this.bounds = { minX: -15.3, maxX: 15.3, minZ: -22, maxZ: 103 };
    this.world.clear();
    this.particles.clear();
    this.projectiles = [];
    this.boss = null;
    this.levelIndex = index;
    this.collected = 0;
    this.caught = 0;
    this.timeLeft = this.config.time;
    this.elapsed = 0;
    this.collectibles = new Collectibles(this);
    this.builder = new LevelBuilder(this);
    this.builder.build(index);
    this.player = new Player(this);
    this.player.reset();
    this.camera.position.set(0, 12, 32);
    this.look.set(0, 1, 10);
    $("chapter").textContent =
      `CHAPTER ${String(index + 1).padStart(2, "0")} / 04`;
    $("levelName").textContent = this.config.name;
    $("bossHud").hidden = true;
    this.hud.toastTime = 0;
    this.hud.pickupTime = 0;
    this.collectibles.draw(0);
  }
  menuScene() {
    this.player.pos.set(5, 0, 13);
    this.player.root.rotation.y = 0.45;
    this.aliens[0].pos.set(8, 0, 10);
    this.aliens[1].pos.set(3, 0, 7);
    this.aliens[2].pos.set(11, 0, 4);
  }
  menu() {
    this.hideOverlays();
    this.state = STATES.MENU;
    $("menu").hidden = false;
    $("hud").hidden = true;
    $("touch").classList.remove("play");
    this.input.reset();
    this.loadLevel(0);
    this.menuScene();
    $("best").textContent = this.best.toLocaleString();
    $("continueSave").hidden = !this.campaign.data.checkpoint;
  }
  pause() {
    if (!this.playing) return;
    this.previousState = this.state;
    this.state = STATES.PAUSED;
    $("pause").hidden = false;
    $("touch").classList.remove("play");
    this.input.reset();
  }
  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.state = this.previousState;
    $("pause").hidden = true;
    $("touch").classList.add("play");
    this.input.reset();
    this.audio.start();
  }
  togglePause() {
    if (this.heroView) {
      this.closeHero();
      return;
    }
    if (this.state === STATES.PAUSED) this.resume();
    else this.pause();
  }
  retry() {
    if (this.previousState === STATES.HUB && this.state === STATES.PAUSED)
      return this.loadHub();
    this.restoreCheckpoint(this.checkpoint || this.campaign.data.checkpoint);
  }
  over(reason) {
    if (!this.playing) return;
    this.state = STATES.GAME_OVER;
    this.saveBest();
    this.input.reset();
    $("gameOver").hidden = false;
    $("overTitle").textContent = reason;
    $("overText").textContent =
      `The aliens got a head start, but your adventure is saved at this chapter. Retry with fresh time and at least four lives. Score so far: ${this.score.toLocaleString()}.`;
    $("touch").classList.remove("play");
  }
  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem("mars-sweet-heist-best", String(this.best));
      } catch {}
    }
  }
  finishLevel() {
    this.score += Math.ceil(this.timeLeft) * 5;
    this.audio.play("portal");
    const result = {
      score: this.score - this.levelBase.score,
      sweets: this.config.target,
      time: this.totalTime - this.levelBase.time,
      tokens: this.tokens,
      medal:
        this.tokens === 3 && this.timeLeft > this.config.time * 0.35
          ? "gold"
          : this.tokens >= 2
            ? "silver"
            : "bronze",
    };
    this.campaign.complete(this.levelIndex, result);
    this.checkpoint = null;
    this.score = this.campaign.totals.score;
    this.saveBest();
    if (this.levelIndex === 3) {
      this.win();
      return;
    }
    this.loadHub();
    this.hud.toast(
      `Era recovered · ${result.medal.toUpperCase()} medal! The next portal is open.`,
      5,
    );
  }
  win() {
    const totals = this.campaign.totals;
    this.score = totals.score;
    this.totalTime = totals.time;
    this.totalCollected = totals.sweets;
    const record = this.score > this.best;
    this.saveBest();
    this.state = STATES.VICTORY;
    $("hud").hidden = true;
    $("touch").classList.remove("play");
    $("victory").hidden = false;
    $("finalScore").textContent = this.score.toLocaleString();
    $("finalTime").textContent = fmt(this.totalTime);
    $("finalSweets").textContent = `${this.totalCollected} / 212`;
    $("record").textContent = record
      ? "A new personal best. Sweet work!"
      : "Every laddu accounted for. Every alien outsmarted.";
    this.loadLevel(0);
    this.player.pos.set(0, 0, 10);
    this.player.root.rotation.y = 0;
    this.input.reset();
  }
  throwSparkler() {
    if (
      !this.playing ||
      this.state === STATES.HUB ||
      this.player.throwCooldown > 0
    )
      return;
    this.player.throwCooldown = 0.42;
    const origin = this.player.pos.clone().add(v3(0, 1.5, 0));
    let target = null,
      best = 17;
    for (const a of this.aliens) {
      if (a.caught) continue;
      const distance = a.pos.distanceTo(this.player.pos);
      if (distance < best) {
        target = a;
        best = distance;
      }
    }
    if (this.boss?.active && this.boss.pos.distanceTo(this.player.pos) < 19)
      target = this.boss;
    const aim = target
      ? target.pos.clone().add(v3(0, target instanceof Boss ? 1 : 0.9, 0))
      : origin.clone().addScaledVector(this.player.facing, 15);
    const direction = aim.sub(origin).normalize();
    const root = group(this.world, ...origin.toArray());
    mesh(root, "oct", 0xfff1bb, [0, 0, 0], [0.12, 0.36, 0.12], 1.8);
    this.projectiles.push({
      root,
      velocity: direction.multiplyScalar(29),
      life: 0.8,
      target,
    });
    this.audio.play("throw");
  }
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const old = p.root.position.clone();
      if (p.target && !p.target.caught && !p.target.defeated) {
        const aim = p.target.pos
          .clone()
          .add(v3(0, 1, 0))
          .sub(old)
          .normalize()
          .multiplyScalar(29);
        p.velocity.lerp(aim, 1 - Math.exp(-9 * dt));
      }
      p.root.position.addScaledVector(p.velocity, dt);
      p.root.rotation.x += dt * 18;
      this.particles.emit(p.root.position, 0xffe39a, 2, 0.8, 0.3, 0.12);
      const segment = new THREE.Line3(old, p.root.position),
        nearest = v3();
      const hit = (point, r) =>
        segment.closestPointToPoint(point, true, nearest).distanceTo(point) < r;
      let impacted = false;
      for (const a of this.aliens) {
        if (!a.caught && hit(a.pos.clone().add(v3(0, 1, 0)), 0.85)) {
          a.stun();
          impacted = true;
          break;
        }
      }
      if (
        !impacted &&
        this.boss?.active &&
        hit(this.boss.pos.clone().add(v3(0, 1, 0)), 2)
      ) {
        if (this.boss.vulnerable) this.boss.hit();
        else if (this.boss.stunTime <= 0)
          this.hud.toast("Shield up! Wait for the golden opening.", 1.1);
        impacted = true;
      }
      if (impacted || p.life <= 0) {
        this.world.remove(p.root);
        this.projectiles.splice(i, 1);
      }
    }
  }
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    try {
      if (this.state === STATES.HUB) {
        this.elapsed += dt;
        this.player.update(dt);
        this.builder.update(dt);
        const target = this.player.pos.clone().add(v3(0, 10.5, 15));
        this.camera.position.lerp(target, 1 - Math.exp(-4.5 * dt));
        this.look.lerp(
          this.player.pos.clone().add(v3(0, 1.2, -3)),
          1 - Math.exp(-6 * dt),
        );
      } else if (this.playing) {
        this.elapsed += dt;
        this.totalTime += dt;
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        this.player.update(dt);
        this.aliens.forEach((a) => a.update(dt));
        this.collectibles.update(dt);
        this.builder.update(dt);
        if (this.boss && this.playing) {
          if (
            !this.boss.active &&
            !this.boss.defeated &&
            this.caught === this.config.aliens &&
            this.player.pos.z < 12
          )
            this.boss.activate();
          this.boss.update(dt);
        }
        if (this.playing) this.updateProjectiles(dt);
        if (this.playing && this.timeLeft <= 0) this.over("Time slipped away!");
        if (
          this.playing &&
          this.collected >= this.config.target &&
          this.caught === this.config.aliens &&
          !this.builder.portalReady
        ) {
          this.builder.portalReady = true;
          this.hud.toast(
            "Every sweet recovered! Head to the glowing portal.",
            4,
          );
          this.audio.play("portal");
        }
        if (
          this.playing &&
          this.builder.portalReady &&
          Math.hypot(this.player.pos.x, this.player.pos.z + 20.8) < 2 &&
          this.player.pos.y < 3
        )
          this.finishLevel();
        const target = this.player.pos.clone().add(v3(0, 10.5, 15)),
          look = this.player.pos.clone().add(v3(0, 1.2, -4));
        target.y = 10.5 + this.player.pos.y * 0.35;
        look.y = 1.2 + this.player.pos.y * 0.3;
        this.camera.position.lerp(target, 1 - Math.exp(-4.5 * dt));
        this.look.lerp(look, 1 - Math.exp(-6 * dt));
      } else if (this.state === STATES.MENU || this.state === STATES.VICTORY) {
        this.elapsed += dt;
        this.builder.update(dt, true);
        this.collectibles.draw(this.elapsed);
        this.player.body.position.y = Math.sin(this.elapsed * 2) * 0.06;
        this.player.arms.forEach(
          (a, i) => (a.rotation.x = Math.sin(this.elapsed * 2 + i) * 0.13),
        );
        this.aliens.forEach((a, i) => {
          a.model.body.rotation.z = Math.sin(this.elapsed * 3 + i) * 0.1;
          a.model.antennae.forEach(
            (ant) => (ant.rotation.z = Math.sin(this.elapsed * 6 + i) * 0.2),
          );
        });
        const mobile = innerWidth < 600,
          target = this.heroView
            ? this.player.pos
                .clone()
                .add(this.heroCloseup ? v3(0, 2.85, 1.65) : v3(0.35, 2.6, 5.6))
            : mobile
              ? v3(13, 12, 28)
              : v3(20 + Math.sin(this.elapsed * 0.15), 15, 29);
        this.camera.position.lerp(target, 1 - Math.exp(-2 * dt));
        this.look.lerp(
          this.heroView
            ? this.player.pos
                .clone()
                .add(this.heroCloseup ? v3(0, 2.78, 0) : v3(0, 1.5, 0))
            : mobile
              ? v3(1, 2, 7)
              : v3(-2, 1, 3),
          1 - Math.exp(-2 * dt),
        );
        if (this.heroView)
          this.player.root.rotation.y +=
            (this.heroAngle - this.player.root.rotation.y) *
            (1 - Math.exp(-8 * dt));
      } else if (this.state === STATES.PORTAL_TRANSITION) {
        this.elapsed += dt;
        this.transitionClock += dt;
        this.builder.update(dt, true);
        this.camera.position.lerp(
          v3(Math.sin(this.transitionClock * 0.4) * 7, 9, 1),
          1 - Math.exp(-dt),
        );
        this.look.lerp(v3(0, 2, -20), 1 - Math.exp(-dt * 2));
      }
      const animated =
        this.state !== STATES.PAUSED && this.state !== STATES.GAME_OVER;
      this.particles.update(animated ? dt : 0);
      this.audio.update(animated);
      this.hud.update(dt);
      this.sun.position.set(this.player.pos.x - 12, 26, this.player.pos.z + 13);
      this.sun.target.position.copy(this.player.pos);
      this.sun.target.updateMatrixWorld();
      this.camera.lookAt(this.look);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
    } catch (error) {
      console.error(error);
      this.renderer.setAnimationLoop(null);
      $("loading").hidden = false;
      $("loadingText").textContent =
        "The game encountered a graphics error. Reload to try again.";
    }
  }
}
export { Game };
