import { STATES, LEVELS } from "../config.js";
import { $, TAU, v3, fmt } from "../core/primitives.js";
class HUD {
  constructor(game) {
    this.game = game;
    this.toastTime = 0;
    this.pickupTime = 0;
    this.flash = 0;
    this.map = $("map").getContext("2d");
    this.tick = 0;
  }
  toast(text, time = 2.5) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    this.toastTime = time;
  }
  pickup(text) {
    $("pickup").textContent = text;
    $("pickup").hidden = false;
    this.pickupTime = 0.9;
  }
  update(dt) {
    const g = this.game;
    this.toastTime -= dt;
    this.pickupTime -= dt;
    this.flash = Math.max(0, this.flash - dt);
    $("toast").hidden = this.toastTime <= 0;
    $("pickup").hidden = this.pickupTime <= 0;
    $("flash").style.opacity = this.flash > 0 ? 1 : 0;
    if (!g.playing) return;
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 0.08;
    if (g.state === STATES.HUB) {
      $("caughtLabel").textContent = "ERAS";
      $("sweets").textContent = `${g.campaign.totals.sweets} / 212`;
      $("caught").textContent =
        `${g.campaign.data.records.filter(Boolean).length} / 4`;
      $("timer").textContent = "∞";
      $("lives").textContent = "♥ 5";
      $("score").textContent = `${g.score.toLocaleString()} POINTS`;
      $("objective").textContent =
        "Walk into a glowing portal to begin or replay an era.";
      $("powerText").textContent =
        "Campaign progress saves at every checkpoint.";
      $("map").parentElement.hidden = true;
      $("bossHud").hidden = true;
      $("journal").hidden = false;
      this.journal();
      return;
    }
    $("journal").hidden = true;
    $("map").parentElement.hidden = false;
    $("caughtLabel").textContent = "CAUGHT";
    $("sweets").textContent = `${g.collected} / ${g.config.target}`;
    $("caught").textContent = `${g.caught} / ${g.config.aliens}`;
    $("timer").textContent = fmt(Math.ceil(g.timeLeft));
    $("timer").classList.toggle("urgent", g.timeLeft < 30);
    $("lives").textContent = `♥ ${g.lives}`;
    $("score").textContent = `${g.score.toLocaleString()} POINTS`;
    $("dashBar").style.width = `${(1 - g.player.dashCooldown / 1.65) * 100}%`;
    const power = [];
    if (g.player.coffee > 0)
      power.push(`☕ Coffee ${Math.ceil(g.player.coffee)}s`);
    if (g.player.magnet > 0)
      power.push(`✿ Jasmine ${Math.ceil(g.player.magnet)}s`);
    $("powerText").textContent =
      (power.join(" · ") || "Dash ready in the green.") +
      ` · Tokens ${g.tokens} / 3`;
    $("objective").textContent = g.builder.portalReady
      ? "Portal open! Follow the green diamond."
      : g.boss?.defeated && !g.boss.boxOpened
        ? "Touch the golden box at the north end."
        : g.state === STATES.BOSS && !g.boss.defeated
          ? "Dodge, wait for gold, then throw!"
          : g.caught < g.config.aliens
            ? "Stun with a sparkler → touch → collect."
            : `Find the last ${g.config.target - g.collected} sweets on your map.`;
    $("bossHud").hidden = !g.boss?.active;
    if (g.boss?.active) {
      $("bossBar").style.width = `${(g.boss.hp / 3) * 100}%`;
      $("bossPhase").textContent =
        g.boss.stunTime > 0
          ? "DIZZY! Give the Chief a moment…"
          : g.boss.vulnerable
            ? "SHIELD OPEN · Throw a sparkler!"
            : "SHIELD UP · Dodge the warning circles";
      $("bossPhase").style.color = g.boss.vulnerable ? "#d7f96a" : "#fff6dc";
    }
    this.drawMap();
  }
  journal() {
    const g = this.game;
    const html = LEVELS.map((l, i) => {
      const r = g.campaign.data.records[i];
      return `<div class="journal-era ${i <= g.campaign.data.unlocked ? "unlocked" : ""}"><b>0${i + 1} · ${l.name}</b><span>${r ? `${r.medal.toUpperCase()} · ${r.tokens}/3 tokens · ${fmt(r.time)}` : i <= g.campaign.data.unlocked ? "Portal open" : "Complete the previous era"}</span>${i <= g.campaign.data.unlocked ? `<button data-era="${i}" aria-label="${r ? "Replay" : "Enter"} ${l.name}">${r ? "Replay era" : "Enter era"} ↗</button>` : ""}</div>`;
    }).join("");
    if ($("journal").innerHTML !== html) $("journal").innerHTML = html;
  }
  drawMap() {
    const g = this.game,
      c = this.map;
    c.clearRect(0, 0, 248, 292);
    c.fillStyle = "#29424a";
    c.fillRect(0, 0, 248, 292);
    const pos = (x, z) => [
      124 + (x / 17) * 116,
      10 + ((z - g.bounds.minZ) / (g.bounds.maxZ - g.bounds.minZ)) * 272,
    ];
    c.strokeStyle = "#ffffff0d";
    for (let x = 0; x < 248; x += 31) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 292);
      c.stroke();
    }
    g.builder.hazards.forEach((h) => {
      const [x, y] = pos(h.x, h.z);
      c.fillStyle = "#ee806d77";
      c.beginPath();
      c.arc(x, y, h.r * 6, 0, TAU);
      c.fill();
    });
    g.collectibles.items
      .filter((i) => i.alive)
      .forEach((i) => {
        const [x, y] = pos(i.pos.x, i.pos.z);
        c.fillStyle = "#ffd66f";
        c.beginPath();
        c.arc(x, y, 3.2, 0, TAU);
        c.fill();
      });
    g.collectibles.powerups
      .filter((p) => p.alive)
      .forEach((p) => {
        const [x, y] = pos(p.x, p.z);
        c.fillStyle = "#e6e7ff";
        c.fillRect(x - 3, y - 3, 6, 6);
      });
    g.aliens
      .filter((a) => !a.caught)
      .forEach((a) => {
        const [x, y] = pos(a.pos.x, a.pos.z);
        c.fillStyle = a.stunTime > 0 ? "#fff" : "#a7f37b";
        c.beginPath();
        c.moveTo(x, y - 6);
        c.lineTo(x + 5, y + 4);
        c.lineTo(x - 5, y + 4);
        c.fill();
      });
    const [x, y] = pos(0, -20.8);
    c.strokeStyle = g.builder.portalReady ? "#d7f96a" : "#97d9ef";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y - 9);
    c.lineTo(x + 7, y);
    c.lineTo(x, y + 9);
    c.lineTo(x - 7, y);
    c.closePath();
    c.stroke();
    if (g.boss && !g.boss.boxOpened) {
      const p = g.boss.defeated ? v3(0, 0, -9) : g.boss.pos,
        [bx, by] = pos(p.x, p.z);
      c.fillStyle = "#ffc367";
      c.fillRect(bx - 6, by - 6, 12, 12);
    }
    const [px, py] = pos(g.player.pos.x, g.player.pos.z);
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(px, py, 6, 0, TAU);
    c.fill();
    c.strokeStyle = "#0b303c";
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = "#fff";
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px + g.player.facing.x * 12, py + g.player.facing.z * 12);
    c.stroke();
  }
}
export { HUD };
