import { Campaign } from "./core/Campaign.js";
import { Hub } from "./world/Hub.js";
import { STATES, LEVELS } from "./config.js";
import { $, rand, v3, fmt, mesh, group, place } from "./core/primitives.js";
import { segmentPointDistance } from "./core/math.js";
import { Renderer } from "./engine/Renderer.js";
import { disposeChildren } from "./engine/prims.js";
import { Particles } from "./engine/Particles.js";
import { Audio } from "./core/Audio.js";
import { Input } from "./core/Input.js";
import { Player } from "./actors/Player.js";
import { Boss } from "./actors/Boss.js";
import { Collectibles } from "./world/Collectibles.js";
import { LevelBuilder } from "./world/LevelBuilder.js";
import { HUD } from "./ui/HUD.js";
import { lightCheckpoint } from "./world/CampaignRoutes.js";
class Game {
  constructor() {
    this.state = STATES.MENU;
    this.renderer = new Renderer($("world"));
    this.scene = this.renderer.scene;
    this.world = this.renderer.root;
    this.camPos = v3(14, 15, 28);
    this.look = v3(0, 1, 0);
    this.shake = 0;
    this.hitstop = 0;
    this.fovKick = 0;
    this.audio = new Audio();
    this.input = new Input(this);
    this.hud = new HUD(this);
    this.particles = new Particles(this.scene);
    this.lastTime = performance.now();
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
    this.renderer.engine.onContextLostObservable.add(() => {
      this.pause();
      $("loading").hidden = false;
      $("loadingText").textContent =
        "The graphics context was interrupted. Reload this page to play again.";
    });
    clearTimeout(window.bootTimer);
    $("loading").hidden = true;
    this.renderer.engine.runRenderLoop(() => this.frame());
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
    this.renderer.resize();
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
    this.camPos.copy(this.player.pos).add(v3(0, 7.5, 12));
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
      p.root.setEnabled(p.alive);
    });
    this.builder.tokens.forEach((t, i) => {
      t.alive = snap.tokenAlive[i];
      t.root.setEnabled(t.alive);
    });
    this.builder.checkpoints.forEach((c, i) => {
      if (snap.checkpoints[i]) lightCheckpoint(this.builder, c);
    });
    this.aliens.forEach((a, i) => {
      const saved = snap.aliens[i];
      a.pos.fromArray(saved.pos);
      for (const k of ["waypoint", "caught", "loot", "age", "dropClock"])
        a[k] = saved[k];
      a.root.setEnabled(!a.caught);
      place(a.root, a.pos);
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
    this.camPos.copy(this.player.pos).add(v3(0, 7.5, 12));
    this.look.copy(this.player.pos).add(v3(0, 1.6, -4));
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
    // Shared geometry sources and cached materials survive; level nodes go.
    this.player?.rig.skeleton.dispose();
    for (const a of this.aliens || []) a.rig.skeleton.dispose();
    this.boss?.rig.skeleton.dispose();
    disposeChildren(this.world);
    this.particles.clear();
    this.projectiles = [];
    this.boss = null;
    this.aliens = [];
  }
  loadLevel(index) {
    this.clearWorld();
    this.bounds = { minX: -15.3, maxX: 15.3, minZ: -22, maxZ: 103 };
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
    this.camPos.set(0, 12, 32);
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
    place(this.player.root, this.player.pos);
    this.aliens[0].pos.set(8, 0, 10);
    this.aliens[1].pos.set(3, 0, 7);
    this.aliens[2].pos.set(11, 0, 4);
    for (const a of this.aliens) place(a.root, a.pos);
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
    this.player.rig.animator.throw();
    const origin = this.player.pos.clone().add(v3(0, 2.3, 0));
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
    const root = group(this.world, origin.x, origin.y, origin.z);
    mesh(root, "oct", 0xfff1bb, [0, 0, 0], [0.12, 0.36, 0.12], 1.8);
    this.projectiles.push({
      root,
      pos: origin,
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
      const old = p.pos.clone();
      if (p.target && !p.target.caught && !p.target.defeated) {
        const aim = p.target.pos
          .clone()
          .add(v3(0, 1, 0))
          .sub(old)
          .normalize()
          .multiplyScalar(29);
        p.velocity.lerp(aim, 1 - Math.exp(-9 * dt));
      }
      p.pos.addScaledVector(p.velocity, dt);
      place(p.root, p.pos);
      p.root.rotation.x += dt * 18;
      this.particles.emit(p.pos, 0xffe39a, 2, 0.8, 0.3, 0.12);
      const hit = (point, r) => segmentPointDistance(old, p.pos, point) < r;
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
      if (impacted) {
        this.particles.emit(p.pos, 0xfff1bb, 22, 4, 0.5, 0.2);
        this.kick(0.25, 0.05);
      }
      if (impacted || p.life <= 0) {
        p.root.dispose(false, false);
        this.projectiles.splice(i, 1);
      }
    }
  }
  /** Screen shake plus a few frames of hit-stop: weight for impacts. */
  kick(shake = 0.4, stop = 0) {
    this.shake = Math.max(this.shake, shake);
    this.hitstop = Math.max(this.hitstop, stop);
  }
  chaseCamera(dt, rate = 4.5) {
    const p = this.player.pos,
      v = this.player.velocity;
    const aheadX = Math.max(-2.5, Math.min(2.5, v.x * 0.22)),
      aheadZ = Math.max(-3, Math.min(3, v.z * 0.3));
    const target = v3(p.x * 0.85 + aheadX * 0.4, 7.4 + p.y * 0.4, p.z + 11.5 + aheadZ * 0.3);
    const look = v3(p.x + aheadX, 1.7 + p.y * 0.45, p.z - 4 + aheadZ);
    this.camPos.lerp(target, 1 - Math.exp(-rate * dt));
    this.look.lerp(look, 1 - Math.exp(-(rate + 1.5) * dt));
  }
  frame() {
    const now = performance.now();
    let dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    if (this.fixedDelta) dt = this.fixedDelta;
    try {
      // Hit-stop freezes simulation (not rendering) for a few frames.
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        dt *= 0.08;
      }
      if (this.state === STATES.HUB) {
        this.elapsed += dt;
        this.player.update(dt);
        this.builder.update(dt);
        this.chaseCamera(dt);
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
        if (this.playing) this.chaseCamera(dt);
      } else if (this.state === STATES.MENU || this.state === STATES.VICTORY) {
        this.elapsed += dt;
        this.builder.update(dt, true);
        this.collectibles.draw(this.elapsed);
        this.player.pose(dt, {
          celebrate: this.state === STATES.VICTORY || (!this.heroView && this.elapsed % 9 > 6.5),
        });
        this.aliens.forEach((a, i) => a.idle(this.elapsed + i));
        const mobile = innerWidth < 600,
          target = this.heroView
            ? this.player.pos
                .clone()
                .add(this.heroCloseup ? v3(0, 2.85, 1.75) : v3(0.35, 2.3, 6.2))
            : mobile
              ? v3(10, 7, 24)
              : v3(15 + Math.sin(this.elapsed * 0.15), 7.5, 24);
        this.camPos.lerp(target, 1 - Math.exp(-2 * dt));
        this.look.lerp(
          this.heroView
            ? this.player.pos
                .clone()
                .add(this.heroCloseup ? v3(0, 2.8, 0) : v3(0, 1.6, 0))
            : mobile
              ? v3(3, 2.2, 9)
              : v3(-1, 2.2, 6),
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
        this.player.pose(dt, {});
        this.camPos.lerp(
          v3(Math.sin(this.transitionClock * 0.4) * 7, 6 + Math.sin(this.transitionClock * 0.2) * 2, 4),
          1 - Math.exp(-dt),
        );
        this.look.lerp(v3(0, 2.5, -20), 1 - Math.exp(-dt * 2));
      }
      const animated =
        this.state !== STATES.PAUSED && this.state !== STATES.GAME_OVER;
      this.particles.update(animated ? dt : 0);
      this.audio.update(animated);
      this.hud.update(dt);
      this.renderer.follow(this.player.pos);
      this.applyCamera(dt);
      if (!this.renderer.headless) this.renderer.render();
      this.input.endFrame();
    } catch (error) {
      console.error(error);
      this.renderer.engine.stopRenderLoop();
      $("loading").hidden = false;
      $("loadingText").textContent =
        "The game encountered a graphics error. Reload to try again.";
    }
  }
  applyCamera(dt) {
    const cam = this.renderer.camera;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * this.shake,
      t = this.elapsed * 37;
    cam.position.set(
      this.camPos.x + Math.sin(t) * s * 0.6,
      this.camPos.y + Math.sin(t * 1.3 + 1) * s * 0.5,
      this.camPos.z,
    );
    const dashing = this.player?.dashTime > 0 ? 1 : 0;
    this.fovKick += ((dashing ? 0.14 : this.player?.coffee > 0 ? 0.05 : 0) - this.fovKick) * (1 - Math.exp(-8 * dt));
    cam.fov = (innerWidth < innerHeight ? 1.05 : 0.86) + this.fovKick;
    cam.setTarget(cam.position.clone().set(this.look.x, this.look.y, this.look.z));
  }
}
export { Game };
