from pathlib import Path
def edit(path,fn):
 p=Path(path);p.write_text(fn(p.read_text(encoding='utf-8')),encoding='utf-8')
edit('src/config.js',lambda s:s.replace('MENU: "MENU",','MENU: "MENU",\n  HUB: "HUB",').replace('time: 210','time: 420').replace('time: 220','time: 450').replace('time: 230','time: 480').replace('time: 260','time: 500').replace('target: 30','target: 48').replace('target: 34','target: 52').replace('target: 42','target: 60').replace('all 30 sweets','all 48 sweets'))
edit('src/actors/Player.js',lambda s:s.replace('this.pos.set(0, 0, 16);','this.pos.copy(this.game.spawn || v3(0,0,16));').replace('-15.3, 15.3','g.bounds.minX, g.bounds.maxX').replace('-22, 21','g.bounds.minZ, g.bounds.maxZ').replace('this.velocity.y = 5;','this.pos.copy(g.spawn);\n    this.velocity.set(0,0,0);\n    this.dashTime=0;').replace('this.body.rotation.z =', 'this.arms.forEach(a=>{if(a.userData.elbow)a.userData.elbow.rotation.x=-.15-Math.min(.5,running*.04);});\n    this.body.rotation.z ='))
edit('src/world/Collectibles.js',lambda s:s.replace('clamp(z, -20.5, 20)','clamp(z, this.game.bounds.minZ+1, this.game.bounds.maxZ-1)').replace('clamp(item.pos.z, -20.5, 20)','clamp(item.pos.z, g.bounds.minZ+1, g.bounds.maxZ-1)'))
edit('src/world/LevelBuilder.js',lambda s:'import {extendRoute, updateRoute} from "./CampaignRoutes.js";\n'+s.replace('if (index === 3) g.boss = new Boss(g);','if (index === 3) g.boss = new Boss(g);\n    extendRoute(this,index);').replace('if (ambient) return;','if (ambient) return;\n    updateRoute(this,dt);'))
def game(s):
 s='import {Campaign} from "./core/Campaign.js";\nimport {Hub} from "./world/Hub.js";\n'+s
 s=s.replace('this.state = STATES.MENU;','this.state = STATES.MENU;',1)
 s=s.replace('this.checkpoint = null;','this.checkpoint = null;\n    this.campaign = new Campaign();\n    this.bounds={minX:-15.3,maxX:15.3,minZ:-22,maxZ:103};\n    this.spawn=v3(0,0,98);',1)
 s=s.replace('return this.state === STATES.PLAYING || this.state === STATES.BOSS;','return [STATES.PLAYING,STATES.BOSS,STATES.HUB].includes(this.state);')
 s=s.replace('$("play").onclick = () => this.start();','$("play").onclick = () => this.start();\n    $("continueSave").onclick=()=>this.restoreCheckpoint(this.campaign.data.checkpoint);\n    $("hubButton").onclick=()=>this.loadHub();\n    $("victoryHub").onclick=()=>this.loadHub();\n    $("continueSave").hidden=!this.campaign.data.checkpoint;')
 a=s.index('  start() {');b=s.index('  showTransition(',a)
 s=s[:a]+'''  start() {
    this.audio.start();
    this.loadHub();
  }
  loadHub() {
    this.hideOverlays();this.clearWorld();
    this.levelIndex=0;this.state=STATES.HUB;this.lives=5;
    const totals=this.campaign.totals;
    this.score=totals.score;this.totalCollected=totals.sweets;this.totalTime=totals.time;
    this.collected=0;this.caught=0;this.aliens=[];this.elapsed=0;
    this.collectibles=new Collectibles(this);this.builder=new Hub(this);
    this.player=new Player(this);this.player.reset();this.input.reset();
    this.camera.position.copy(this.player.pos).add(v3(0,10.5,15));this.look.copy(this.player.pos);
    $("hud").hidden=false;$("touch").classList.add("play");$("bossHud").hidden=true;
    $("chapter").textContent="THE TIME COURTYARD";$("levelName").textContent="Choose your next era";
    this.hud.toast("Walk into a glowing portal. Completed eras can be replayed for better medals.",5);
  }
  beginChapter(index) {
    if(index>this.campaign.data.unlocked)return;
    const totals=this.campaign.totals;
    this.score=totals.score;this.totalCollected=totals.sweets;this.totalTime=totals.time;this.lives=5;
    this.levelBase={score:this.score,sweets:this.totalCollected,time:this.totalTime};
    this.checkpoint=null;this.hideOverlays();this.loadLevel(index);this.showTransition(index===0);
  }
  saveCheckpoint() {
    // Boss encounters restart from the last safe route checkpoint.
    if(this.state===STATES.HUB || this.boss?.active || this.boss?.defeated)return;
    const snap={index:this.levelIndex,base:this.levelBase,score:this.score,sweets:this.totalCollected,
      totalTime:this.totalTime,timeLeft:this.timeLeft,lives:this.lives,collected:this.collected,caught:this.caught,
      elapsed:this.elapsed,spawn:this.spawn.toArray(),tokens:this.tokens,
      tokenAlive:this.builder.tokens.map(t=>t.alive),checkpoints:this.builder.checkpoints.map(c=>c.active),
      items:this.collectibles.items.map(i=>({...i,pos:i.pos.toArray(),velocity:i.velocity?.toArray()||null})),
      powers:this.collectibles.powerups.map(p=>p.alive),
      aliens:this.aliens.map(a=>({pos:a.pos.toArray(),waypoint:a.waypoint,caught:a.caught,loot:a.loot,age:a.age,dropClock:a.dropClock}))};
    this.checkpoint=snap;this.campaign.data.checkpoint=snap;this.campaign.save();
  }
  restoreCheckpoint(snap) {
    if(!snap || !Number.isInteger(snap.index) || snap.index<0 || snap.index>3 || !Array.isArray(snap.items))return this.loadHub();
    this.audio.start();this.hideOverlays();this.loadLevel(snap.index);
    this.levelBase=snap.base;this.score=snap.score;this.totalCollected=snap.sweets;this.totalTime=snap.totalTime;
    this.timeLeft=Math.max(90,snap.timeLeft);this.lives=Math.max(4,snap.lives);this.collected=snap.collected;this.caught=snap.caught;
    this.elapsed=snap.elapsed;this.tokens=snap.tokens;this.spawn.fromArray(snap.spawn);this.player.reset();
    this.collectibles.items=snap.items.map(i=>({...i,pos:v3().fromArray(i.pos),velocity:i.velocity?v3().fromArray(i.velocity):null}));
    this.collectibles.powerups.forEach((p,i)=>{p.alive=snap.powers[i];p.root.visible=p.alive;});
    this.builder.tokens.forEach((t,i)=>{t.alive=snap.tokenAlive[i];t.root.visible=t.alive;});
    this.builder.checkpoints.forEach((c,i)=>{c.active=snap.checkpoints[i];});
    this.aliens.forEach((a,i)=>{const saved=snap.aliens[i];a.pos.fromArray(saved.pos);for(const k of ['waypoint','caught','loot','age','dropClock'])a[k]=saved[k];a.root.visible=!a.caught;});
    this.checkpoint=snap;this.enterLevel(false);this.hud.toast('Checkpoint restored. Your recovered sweets are safe.',3);
  }
''' +s[b:]
 s=s.replace('enterLevel() {','enterLevel(save = true) {').replace('this.state = STATES.PLAYING;','this.state = STATES.PLAYING;\n    if(save)this.saveCheckpoint();',1)
 a=s.index('  loadLevel(index) {');b=s.index('    this.world.clear();',a)
 dispose=s[a+len('  loadLevel(index) {'):b]
 s=s[:a]+'  clearWorld() {'+dispose+'''    this.world.clear();this.particles.clear();this.projectiles=[];this.boss=null;
  }
  loadLevel(index) {
    this.clearWorld();this.bounds={minX:-15.3,maxX:15.3,minZ:-22,maxZ:103};
'''+s[b:]
 s=s.replace('this.hud.toastTime = 0;','this.hud.toastTime = 0;',1)
 # Dispose canvas label textures as well as their materials.
 s=s.replace('if (o.isInstancedMesh) o.dispose();','if (o.isInstancedMesh) o.dispose();\n      if(o.userData.disposeTexture)o.material?.map?.dispose();')
 s=s.replace('$("best").textContent = this.best.toLocaleString();\n  }','$("best").textContent = this.best.toLocaleString();\n    $("continueSave").hidden=!this.campaign.data.checkpoint;\n  }')
 a=s.index('  retry() {');b=s.index('  over(',a)
 s=s[:a]+'''  retry() {
    if(this.previousState===STATES.HUB && this.state===STATES.PAUSED)return this.loadHub();
    this.restoreCheckpoint(this.checkpoint || this.campaign.data.checkpoint);
  }
'''+s[b:]
 a=s.index('  finishLevel() {');b=s.index('  win()',a)
 s=s[:a]+'''  finishLevel() {
    this.score+=Math.ceil(this.timeLeft)*5;this.audio.play("portal");
    const result={score:this.score-this.levelBase.score,sweets:this.config.target,
      time:this.totalTime-this.levelBase.time,tokens:this.tokens,
      medal:this.tokens===3 && this.timeLeft>this.config.time*.35?'gold':this.tokens>=2?'silver':'bronze'};
    this.campaign.complete(this.levelIndex,result);this.checkpoint=null;this.saveBest();
    if(this.levelIndex===3){this.win();return;}
    this.loadHub();this.hud.toast(`Era recovered · ${result.medal.toUpperCase()} medal! The next portal is open.`,5);
  }
'''+s[b:]
 s=s.replace('const record = this.score > this.best;','const totals=this.campaign.totals;this.score=totals.score;this.totalTime=totals.time;this.totalCollected=totals.sweets;\n    const record = this.score > this.best;')
 s=s.replace('${this.totalCollected} / 140','${this.totalCollected} / 212')
 s=s.replace('if (!this.playing || this.player.throwCooldown > 0) return;','if (!this.playing || this.state===STATES.HUB || this.player.throwCooldown > 0) return;')
 s=s.replace('if (this.playing) {\n        this.elapsed', '''if(this.state===STATES.HUB) {
        this.elapsed+=dt;this.player.update(dt);this.builder.update(dt);
        const target=this.player.pos.clone().add(v3(0,10.5,15));
        this.camera.position.lerp(target,1-Math.exp(-4.5*dt));
        this.look.lerp(this.player.pos.clone().add(v3(0,1.2,-3)),1-Math.exp(-6*dt));
      } else if (this.playing) {
        this.elapsed''')
 s=s.replace('this.caught === this.config.aliens\n          )','this.caught === this.config.aliens && this.player.pos.z<12\n          )')
 s=s.replace('v3(0, 2.65, 2.4) : v3(0.35, 2.6, 5.6)','v3(0, 2.85, 1.65) : v3(0.35, 2.6, 5.6)').replace('v3(0, 2.08, 0) : v3(0, 1.12, 0)','v3(0, 2.78, 0) : v3(0, 1.5, 0)')
 # Move the only shadow light with the player so every route section is shadowed.
 s=s.replace('this.camera.lookAt(this.look);','this.sun.position.set(this.player.pos.x-12,26,this.player.pos.z+13);\n      this.sun.target.position.copy(this.player.pos);this.sun.target.updateMatrixWorld();\n      this.camera.lookAt(this.look);')
 s=s.replace('this.scene.add(this.sun);','this.scene.add(this.sun);this.scene.add(this.sun.target);')
 return s
edit('src/Game.js',game)
def hud(s):
 s=s.replace('$("sweets").textContent =', '''if(g.state===STATES.HUB) {
      $("sweets").textContent=`${g.campaign.totals.sweets} / 212`;
      $("caught").textContent=`${g.campaign.data.records.filter(Boolean).length} / 4`;
      $("timer").textContent="∞";$("lives").textContent="♥ 5";
      $("score").textContent=`${g.score.toLocaleString()} POINTS`;
      $("objective").textContent="Walk into a glowing portal to begin or replay an era.";
      $("powerText").textContent="Campaign progress saves at every checkpoint.";
      $("map").parentElement.hidden=true;$("bossHud").hidden=true;
      $("journal").hidden=false;this.journal();return;
    }
    $("journal").hidden=true;$("map").parentElement.hidden=false;
    $("sweets").textContent =''',1)
 s=s.replace('power.join(" · ") || "Dash ready in the green."','(power.join(" · ") || "Dash ready in the green.") + ` · Tokens ${g.tokens} / 3`')
 s=s.replace('const pos = (x, z) => [124 + (x / 17) * 116, 146 + (z / 24) * 138];','const pos = (x,z)=>[124+(x/17)*116, 10+(z-g.bounds.minZ)/(g.bounds.maxZ-g.bounds.minZ)*272];')
 a=s.index('  drawMap() {')
 s=s[:a]+'''  journal() {
    const g=this.game;
    const html=LEVELS.map((l,i)=>{const r=g.campaign.data.records[i];return `<div class="journal-era ${i<=g.campaign.data.unlocked?'unlocked':''}"><b>0${i+1} · ${l.name}</b><span>${r?`${r.medal.toUpperCase()} · ${r.tokens}/3 tokens · ${fmt(r.time)}`:i<=g.campaign.data.unlocked?'Portal open':'Complete the previous era'}</span></div>`;}).join('');
    if($("journal").innerHTML!==html)$("journal").innerHTML=html;
  }
'''+s[a:]
 return s
edit('src/ui/HUD.js',hud)
def html(s):
 s=s.replace('<div class="best">','<button id="continueSave" class="secondary" hidden>Continue checkpoint ↗</button>\n          <div class="best">',1)
 s=s.replace('Let’s get them back <b>↗</b>','Enter the courtyard <b>↗</b>')
 s=s.replace('<div id="toast"','<aside id="journal" hidden aria-label="Campaign progress"></aside>\n    <div id="toast"',1)
 s=s.replace('Restart chapter','Retry checkpoint')
 s=s.replace('<button class="secondary" id="quit">','<button class="secondary" id="hubButton">Portal courtyard</button><button class="secondary" id="quit">')
 s=s.replace('<button class="secondary" id="victoryMenu">','<button class="secondary" id="victoryHub">Replay eras</button><button class="secondary" id="victoryMenu">')
 s=s.replace('>140<','>212<')
 return s
edit('index.html',html)
