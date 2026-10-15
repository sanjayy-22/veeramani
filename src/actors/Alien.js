import { clamp, v3, place } from "../core/primitives.js";
import { makeAlienRig } from "./hero/HeroBuilder.js";
class Alien {
  constructor(game, id, route) {
    this.game = game;
    this.id = id;
    this.route = route.map((p) => v3(p[0], 0, p[1]));
    this.waypoint = 1;
    this.rig = makeAlienRig(game.world);
    this.model = this.rig;
    this.root = this.rig.root;
    for (const m of this.rig.meshes) game.renderer.addCaster(m, false);
    this.pos = v3().copy(this.route[0]);
    place(this.root, this.pos);
    this.stunTime = 0;
    this.caught = false;
    this.loot = 4;
    this.dropClock = 10 + id * 2;
    this.age = id * 1.7;
    this.stumble = 0;
    this.runSpeed = 0;
    const firstLeg = this.route[1].clone().sub(this.route[0]);
    this.root.rotation.y = Math.atan2(firstLeg.x, firstLeg.z);
  }
  stun() {
    if (this.caught) return;
    this.stunTime = 2;
    this.rig.stars.setEnabled(true);
    this.game.audio.play("alien");
    this.game.particles.emit(
      this.pos.clone().add(v3(0, 1.8, 0)),
      0xffe86c,
      18,
      2,
      0.6,
    );
    this.game.hud.toast("Dizzy for 2 seconds — touch the alien!", 1.4);
  }
  update(dt) {
    if (this.caught) return;
    const g = this.game;
    this.age += dt;
    this.stunTime = Math.max(0, this.stunTime - dt);
    this.rig.stars.setEnabled(this.stunTime > 0);
    this.rig.stars.rotation.y += dt * 6;
    if (this.stunTime > 0) {
      this.pos.y = 0;
      this.rig.animate(this.age, 0, true);
      place(this.root, this.pos);
      if (
        Math.hypot(this.pos.x - g.player.pos.x, this.pos.z - g.player.pos.z) <
          1.35 &&
        g.player.pos.y < 2.2
      )
        this.catch();
      return;
    }
    // Original adaptation of general path-following ideas reviewed in Spyro's
    // public MoveMobyAlongPath reconstruction. This is NOT verified egg-thief
    // code: turning, acceleration, timings and stun rules are our own design.
    // Thieves turn before accelerating; corners become readable intercept points.
    this.stumble = this.age % 7.4 > 6.25 ? 1 : 0;
    const target = this.route[this.waypoint],
      delta = target.clone().sub(this.pos);
    delta.y = 0;
    const distance = delta.length(),
      near = this.pos.distanceTo(g.player.pos) < 5;
    if (distance < 0.3) {
      this.waypoint = (this.waypoint + 1) % this.route.length;
    } else {
      delta.normalize();
      const desiredYaw = Math.atan2(delta.x, delta.z);
      const turn = Math.atan2(
        Math.sin(desiredYaw - this.root.rotation.y),
        Math.cos(desiredYaw - this.root.rotation.y),
      );
      this.root.rotation.y += clamp(turn, -5.2 * dt, 5.2 * dt);
      const angle = Math.abs(turn);
      const speed =
        g.config.speed *
        (this.stumble ? 0.22 : near ? 1.14 : 1) *
        (angle > 1.15 ? 0 : Math.max(0.35, Math.cos(angle)));
      this.runSpeed += (speed - this.runSpeed) * (1 - Math.exp(-12 * dt));
      this.pos.addScaledVector(delta, Math.min(distance, this.runSpeed * dt));
    }
    this.pos.y = Math.abs(Math.sin(this.age * 6)) * 0.22;
    this.rig.animate(this.age, Math.min(1, this.runSpeed / 3), false);
    place(this.root, this.pos);
    this.dropClock -= dt;
    if (this.dropClock <= 0 && this.loot > 1) {
      this.loot--;
      g.collectibles.scatter(this.pos, 1, this.id);
      this.dropClock = 13;
      g.particles.emit(this.pos, 0xffd467, 10, 1, 0.5);
    }
  }
  /** Menu idle: bob and look around in place. */
  idle(t) {
    this.rig.animate(t, 0.15, false, Math.abs(Math.sin(t * 3)) * 0.06);
    place(this.root, this.pos);
  }
  catch() {
    this.caught = true;
    this.root.setEnabled(false);
    const g = this.game;
    g.kick(0.35, 0.09);
    g.caught++;
    g.score += 100;
    g.collectibles.scatter(this.pos, this.loot, this.id);
    this.loot = 0;
    g.audio.play("alien");
    g.particles.emit(this.pos.clone().add(v3(0, 1, 0)), 0xafff6a, 35, 4, 0.8);
    g.hud.toast(
      [
        "Caught! “I was only checking the quality!”",
        "Caught! “This box was already open!”",
        "Caught! “Can we at least keep the recipe?”",
      ][this.id % 3],
      2.3,
    );
  }
}
export { Alien };
