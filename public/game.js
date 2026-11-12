/* KILL THE SANTA — landscape side-scroller (480x270 logical) */
(() => {
'use strict';
const W = 480, H = 270, T = 16, GY = 14 * T;
const TILES = 330, BOSS_X = 300 * T, BOSS_TRIGGER = 302 * T, WORLD_W = TILES * T;
const PAR_TIME = 300, TIME_BONUS_PER_SEC = 100, CLEAR_BONUS = 10000, PROGRESS_MAX = 5000;
const BOSS_HP = 40, PLAYER_HP = 6;
let CHAR = 'ice'; try { CHAR = localStorage.getItem('kts_char') || 'ice'; } catch (e) {}
const SHOT_COLOR = { ice: ['#7ff', '#fff'], red: ['#ff4d6a', '#ffd0d8'] };

const $ = (id) => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sign = (v) => (v < 0 ? -1 : 1);
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* ───────────── sprite loader (optional external art) ───────────── */
const SPR = window.SPRITES || {};
for (const k in SPR) {
  const c = SPR[k]; c.img = new Image(); c.ok = false;
  c.img.onload = () => { c.ok = true; };
  c.img.src = c.src;
}
function drawSpr(key, anim, t, x, bottom, flip) {
  const c = SPR[key];
  if (!c || !c.ok) return false;
  const a = (c.anims && (c.anims[anim] || c.anims.idle)) || { f: [0], fps: 1 };
  const n = a.f.length, step = Math.floor(t * (a.fps || 8));
  const fi = a.f[a.loop === false ? Math.min(step, n - 1) : step % n];
  const cols = Math.max(1, Math.floor(c.img.width / c.fw));
  const dw = c.dw || c.fw, dh = c.dh || c.fh;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.translate(Math.round(x), Math.round(bottom));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(c.img, (fi % cols) * c.fw, Math.floor(fi / cols) * c.fh, c.fw, c.fh, -dw / 2, -dh + (c.oy || 0), dw, dh);
  ctx.restore();
  return true;
}

/* ───────────── audio (tiny synth) ───────────── */
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = false; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f0, f1, dur, type = 'square', vol = 0.06) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.1) {
  const a = audio(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; g.gain.value = vol;
  s.connect(g).connect(a.destination); s.start();
}
const sfx = {
  shoot: () => tone(900, 400, 0.07), jump: () => tone(280, 620, 0.12, 'triangle', 0.08),
  hit: () => tone(220, 70, 0.18, 'sawtooth', 0.09), kill: () => { tone(500, 150, 0.15, 'square', 0.07); noise(0.12, 0.06); },
  boom: () => noise(0.35, 0.16), pick: () => { tone(600, 900, 0.08, 'triangle'); setTimeout(() => tone(900, 1300, 0.1, 'triangle'), 70); },
  bossHit: () => tone(160, 110, 0.07, 'square', 0.07), warn: () => tone(300, 300, 0.25, 'sawtooth', 0.07),
  die: () => tone(500, 40, 0.8, 'sawtooth', 0.1), win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, f, 0.18, 'square', 0.07), i * 140)),
};

/* ───────────── input ───────────── */
const key = { left: 0, right: 0, jump: 0, shoot: 0 };
let jumpPressed = false;
function setKey(k, v) { if (k === 'jump' && v && !key.jump) jumpPressed = true; key[k] = v ? 1 : 0; }
const KMAP = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', z: 'jump', ' ': 'jump', ArrowUp: 'jump', w: 'jump', x: 'shoot', j: 'shoot', k: 'shoot', Control: 'shoot' };
addEventListener('keydown', (e) => { const k = KMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k) { setKey(k, 1); e.preventDefault(); } });
addEventListener('keyup', (e) => { const k = KMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k) { setKey(k, 0); e.preventDefault(); } });
const ctl = $('controls');
function touchSync(e) {
  const on = { left: 0, right: 0, jump: 0, shoot: 0 };
  for (const t of e.touches) {
    const el = document.elementFromPoint(t.clientX, t.clientY), b = el && el.closest && el.closest('[data-k]');
    if (b) on[b.dataset.k] = 1;
  }
  for (const k in on) { setKey(k, on[k]); }
  ctl.querySelectorAll('[data-k]').forEach((b) => b.classList.toggle('on', !!on[b.dataset.k]));
  e.preventDefault();
}
['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((n) => ctl.addEventListener(n, touchSync, { passive: false }));
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

/* ───────────── responsive stage ───────────── */
const stage = $('stage');
function resize() {
  const vw = innerWidth, vh = innerHeight, s = Math.min(vw / W, vh / H);
  stage.style.width = Math.floor(W * s) + 'px'; stage.style.height = Math.floor(H * s) + 'px';
  stage.style.fontSize = Math.max(8, (H * s) / 22) + 'px';
}
addEventListener('resize', resize); resize();
const isPortrait = () => innerHeight > innerWidth;

/* ───────────── level ───────────── */
const LV = { solids: [], spikes: [], spawns: [], items: [] };
const ground = (a, b) => LV.solids.push({ x: a * T, y: GY, w: (b - a) * T, h: 200 });
const plat = (a, row, len) => LV.solids.push({ x: a * T, y: row * T, w: len * T, h: T, plat: 1 });
const spike = (a, len, row = 14) => LV.spikes.push({ x: a * T, y: row * T - 8, w: len * T, h: 8 });
const en = (type, tx, row = 0) => LV.spawns.push({ type, tx, row });
const heart = (tx) => LV.items.push({ x: tx * T, y: GY - 14, w: 12, h: 12, t: 0 });
(function buildLevel() {
  ground(0, 36); en('snow', 20); en('snow', 29);
  ground(39, 58); spike(45, 2); en('snow', 50); en('bat', 54, 9);
  plat(60, 12, 3); plat(65, 11, 3); plat(70, 12, 3); plat(75, 11, 3); en('bat', 63, 7); en('bat', 72, 6);
  ground(80, 112); heart(84); en('turret', 90); spike(96, 3); en('snow', 102); en('snow', 106); en('icicle', 100, 3);
  ground(116, 172); en('icicle', 120, 3); spike(122, 2); en('icicle', 125, 3); spike(128, 2); en('icicle', 130, 3); en('icicle', 135, 3);
  en('snow', 138); heart(141); en('turret', 146); spike(150, 2); en('snow', 152); en('bat', 156, 8); en('turret', 160); spike(163, 2); en('bat', 166, 7);
  plat(174, 12, 2); plat(179, 11, 2);
  ground(184, 236); en('snow', 188); spike(192, 2); en('snow', 194); spike(198, 3); en('snow', 202); plat(206, 11, 4);
  en('turret', 212); en('bat', 215, 8); en('bat', 219, 6); spike(220, 2); en('icicle', 224, 3); heart(226); en('icicle', 228, 3); en('icicle', 232, 3);
  ground(240, 262); en('snow', 245); spike(249, 2); en('bat', 250, 8); en('snow', 252); en('turret', 257);
  plat(264, 12, 2);
  ground(268, 332); en('snow', 272); spike(276, 2); en('turret', 281); en('bat', 285, 8); heart(292);
  LV.solids.push({ x: WORLD_W, y: -400, w: 32, h: 800 }); // right boundary
  LV.solids.push({ x: -32, y: -400, w: 32, h: 800 });     // left boundary
})();

/* ───────────── state ───────────── */
let G = null, mode = 'title'; // title | play | dying | bossdead | result
let solids = [];
const cx = (e) => e.x + e.w / 2;

function mkEnemy(s) {
  const x = s.tx * T;
  switch (s.type) {
    case 'snow': return { type: 'snow', x, y: GY - 18, w: 14, h: 18, vx: 0, vy: 0, hp: 2, dir: -1, t: rand(0, 3), score: 100, fl: 0 };
    case 'bat': return { type: 'bat', x, y: s.row * T, w: 14, h: 10, hp: 1, baseY: s.row * T, t: rand(0, 3), act: false, score: 150, fl: 0 };
    case 'turret': return { type: 'turret', x, y: GY - 16, w: 16, h: 16, hp: 3, cd: 1, t: 0, score: 200, fl: 0, face: -1 };
    case 'icicle': return { type: 'icicle', x: x + 4, y: s.row * T, w: 8, h: 18, hp: 1, st: 0, t: 0, vy: 0, score: 50, fl: 0 };
  }
}
function newGame() {
  solids = LV.solids.slice();
  G = {
    t: 0, time: 0, cam: 0, shake: 0, maxX: 0, kill: 0, bossDmg: 0,
    p: { x: 40, y: GY - 22, w: 12, h: 22, vx: 0, vy: 0, face: 1, hp: PLAYER_HP, onGround: false, coyote: 0, inv: 0, hurt: 0, cd: 0, anim: 0, shotT: 0 },
    enemies: LV.spawns.map(mkEnemy), items: LV.items.map((i) => ({ ...i })),
    bullets: [], eb: [], parts: [], pops: [], sched: [], warns: [], boss: null, bossT: 0, dyingT: 0, endT: 0,
    snow: Array.from({ length: 50 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(10, 30), r: Math.random() < 0.3 ? 2 : 1 })),
  };
}
const score = () => (G ? progScore() + G.kill + G.bossDmg + (G.cleared ? CLEAR_BONUS + timeBonus() : 0) : 0);
const progScore = () => Math.floor(clamp(G.maxX / BOSS_TRIGGER, 0, 1) * PROGRESS_MAX);
const timeBonus = () => Math.max(0, Math.floor(PAR_TIME - G.finalTime)) * TIME_BONUS_PER_SEC;

/* ───────────── helpers: fx ───────────── */
function burst(x, y, n, colors, sp = 80) {
  for (let i = 0; i < n; i++) G.parts.push({ x, y, vx: rand(-sp, sp), vy: rand(-sp * 1.2, sp * 0.3), life: rand(0.3, 0.7), c: colors[i % colors.length], s: rand(1.5, 3.5) });
}
function pop(x, y, txt, c = '#ffd84d') { G.pops.push({ x, y, txt, c, life: 0.9 }); }
function schedule(d, fn) { G.sched.push({ t: d, fn }); }

/* ───────────── physics ───────────── */
function moveX(e, dx) {
  e.x += dx; e.hitWall = false;
  for (const s of solids) if (ov(e, s)) { e.x = dx > 0 ? s.x - e.w : s.x + s.w; e.hitWall = true; }
}
function moveY(e, dy) {
  e.y += dy; e.onGround = false;
  for (const s of solids) if (ov(e, s)) {
    if (dy > 0) { e.y = s.y - e.h; e.onGround = true; } else e.y = s.y + s.h;
    e.vy = 0;
  }
}
function solidAt(x, y) { for (const s of solids) if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true; return false; }

/* ───────────── player ───────────── */
function hurtPlayer(dmg, srcX) {
  const p = G.p;
  if (p.inv > 0 || mode !== 'play') return;
  p.hp -= dmg; p.inv = 1.4; p.hurt = 0.25; p.vx = (cx(p) < srcX ? -1 : 1) * 90; p.vy = -150;
  G.shake = 0.25; sfx.hit(); burst(cx(p), p.y + 8, 8, ['#fff', '#9cf']);
  if (p.hp <= 0) { p.hp = 0; die(); }
}
function die() {
  if (mode === 'dying' || mode === 'result') return;
  mode = 'dying'; G.dyingT = 1.4; sfx.die();
  burst(cx(G.p), G.p.y + 10, 24, ['#3d86ff', '#fff', '#bff'], 140);
  G.p.dead = true; ctl.classList.add('hidden');
}
function shoot() {
  const p = G.p;
  if (p.cd > 0 || G.bullets.length >= 3) return;
  p.cd = 0.18; p.shotT = 0.15;
  G.bullets.push({ x: p.face > 0 ? p.x + p.w : p.x - 6, y: p.y + 7, w: 6, h: 4, vx: p.face * 290, life: 0.9 });
  sfx.shoot();
}
function updatePlayer(dt) {
  const p = G.p;
  p.cd -= dt; p.shotT -= dt; p.inv -= dt; p.hurt -= dt; p.anim += dt;
  if (p.hurt <= 0) {
    const dir = key.right - key.left;
    p.vx = dir * 105; if (dir) p.face = dir;
    if (key.shoot) shoot();
  }
  p.coyote = p.onGround ? 0.1 : p.coyote - dt;
  if (jumpPressed && p.coyote > 0 && p.hurt <= 0) { p.vy = -310; p.coyote = 0; p.onGround = false; sfx.jump(); }
  jumpPressed = false;
  if (!key.jump && p.vy < -120) p.vy = -120;
  p.vy = Math.min(p.vy + 900 * dt, 420);
  moveX(p, p.vx * dt); moveY(p, p.vy * dt);
  if (p.x + p.w > BOSS_X + 480) p.x = BOSS_X + 480 - p.w;
  if (p.y > H + 40 && mode === 'play') { p.hp = 0; die(); }
  if (mode === 'play') {
    G.maxX = Math.max(G.maxX, p.x);
    if (!G.boss && p.x > BOSS_TRIGGER) startBoss();
    for (const s of LV.spikes) if (ov({ x: p.x + 2, y: p.y + 4, w: p.w - 4, h: p.h - 4 }, s)) hurtPlayer(2, cx(s));
    for (const it of G.items) if (!it.got && ov(p, it)) { it.got = true; p.hp = Math.min(PLAYER_HP, p.hp + 2); sfx.pick(); pop(it.x, it.y - 6, '+HP', '#ff7a8a'); }
  }
}

/* ───────────── enemies ───────────── */
function killEnemy(e) {
  e.dead = true; G.kill += e.score; sfx.kill();
  burst(cx(e), e.y + e.h / 2, 10, ['#fff', '#ffd84d', '#f66']);
  pop(cx(e) - 10, e.y - 4, '+' + e.score);
  if (e.type !== 'icicle' && Math.random() < 0.12) G.items.push({ x: cx(e) - 6, y: e.y + e.h - 14, w: 12, h: 12, t: 0 });
}
function enemyAlive(e) { return !e.dead; }
function ebullet(o) { G.eb.push({ w: 6, h: 6, life: 3, ...o }); }
function updateEnemies(dt) {
  const p = G.p, pcx = cx(p);
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.fl = Math.max(0, e.fl - dt); e.t += dt;
    if (e.x < G.cam - 40 || e.x > G.cam + W + 40) continue;
    if (e.type === 'snow') {
      e.vy = Math.min(e.vy + 900 * dt, 400);
      moveX(e, e.dir * 28 * dt); if (e.hitWall) e.dir *= -1;
      moveY(e, e.vy * dt);
      const px = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      if (e.onGround && !solidAt(px, e.y + e.h + 2)) e.dir *= -1;
    } else if (e.type === 'bat') {
      const dx = pcx - cx(e);
      if (!e.act && Math.abs(dx) < 170) e.act = true;
      if (e.act) { e.x += sign(dx) * 52 * dt; e.baseY += (p.y - 26 - e.baseY) * 0.5 * dt; e.y = e.baseY + Math.sin(e.t * 5) * 16; }
      else e.y = e.baseY + Math.sin(e.t * 3) * 3;
      e.face = sign(dx);
    } else if (e.type === 'turret') {
      const dx = pcx - cx(e); e.face = sign(dx); e.cd -= dt;
      if (Math.abs(dx) < 240 && e.cd <= 0) {
        e.cd = 1.9; ebullet({ type: 'ball', x: cx(e) + e.face * 9 - 3, y: e.y + 4, vx: e.face * 95, vy: 0 });
      }
    } else if (e.type === 'icicle') {
      if (e.st === 0 && Math.abs(pcx - cx(e)) < 22 && p.y + p.h > e.y) { e.st = 1; e.t = 0; }
      else if (e.st === 1 && e.t > 0.35) e.st = 2;
      else if (e.st === 2) {
        e.vy += 700 * dt; e.y += e.vy * dt;
        if (solidAt(cx(e), e.y + e.h) || e.y > H + 20) { e.dead = true; burst(cx(e), e.y + e.h, 6, ['#bdf', '#fff']); }
      }
    }
    if (!e.dead && p.inv <= 0 && ov({ x: e.x + 1, y: e.y + 1, w: e.w - 2, h: e.h - 2 }, p)) hurtPlayer(1, cx(e));
  }
  G.enemies = G.enemies.filter(enemyAlive);
}

/* ───────────── boss (Evil Santa) ───────────── */
function startBoss() {
  solids.push({ x: BOSS_X, y: -400, w: 16, h: GY + 400 }); // door closes behind
  G.boss = { x: BOSS_X + 480 - 16 - 40 - 24, y: GY - 54, w: 40, h: 54, vx: 0, vy: 0, hp: BOSS_HP, face: -1, state: 'intro', t: 0, sub: 0, flash: 0, last: '', n: 0, nextT: 0, onGround: true };
  G.bossT = 0; G.eb = []; sfx.warn();
}
function bossSet(s) { const b = G.boss; b.state = s; b.t = 0; b.sub = 0; b.n = 0; b.nextT = 0; }
function pickAttack() {
  const b = G.boss, rage = b.hp <= BOSS_HP / 2;
  const pool = ['throw', 'dash', 'slam'].concat(rage ? ['rain', 'rain'] : []).filter((a) => a !== b.last);
  b.last = pool[Math.floor(Math.random() * pool.length)]; bossSet(b.last);
}
function throwGift(rain, x) {
  const b = G.boss, p = G.p, bx = cx(b), px = cx(p);
  if (!rain) {
    const vx = clamp((px - bx + rand(-30, 30)) / 0.55, -260, 260);
    ebullet({ type: 'gift', x: bx - 4, y: b.y + 6, w: 10, h: 10, vx, vy: -230, g: 900, shards: true });
  } else ebullet({ type: 'gift', x, y: -12, w: 10, h: 10, vx: 0, vy: 0, g: 500, shards: false });
  sfx.shoot();
}
function updateBoss(dt) {
  const b = G.boss; if (!b) return;
  const p = G.p, rage = b.hp <= BOSS_HP / 2, spd = rage ? 0.7 : 1;
  b.t += dt; b.flash = Math.max(0, b.flash - dt);
  const px = cx(p), bx = cx(b);
  let grav = true;
  switch (b.state) {
    case 'intro': b.face = -1; if (b.t > 2.4) bossSet('idle'); break;
    case 'idle': b.face = px < bx ? -1 : 1; b.vx = 0; if (b.t > 0.8 * spd) pickAttack(); break;
    case 'throw':
      b.face = px < bx ? -1 : 1;
      if (b.t >= b.nextT && b.n < (rage ? 4 : 3)) { throwGift(false); b.n++; b.nextT = b.t + 0.5 * spd; }
      if (b.n >= (rage ? 4 : 3) && b.t > b.nextT + 0.3) bossSet('idle');
      break;
    case 'dash':
      if (b.sub === 0) {
        b.face = px < bx ? -1 : 1; b.vx = 0;
        if (b.t > 0.75 * spd) { b.sub = 1; b.vx = b.face * (rage ? 250 : 205); sfx.warn(); }
      } else {
        moveX(b, b.vx * dt);
        if (b.hitWall) { b.vx = 0; G.shake = 0.35; sfx.boom(); bossSet('stun'); }
      }
      break;
    case 'stun': b.vx = 0; if (b.t > 0.9) bossSet('idle'); break;
    case 'slam':
      if (b.sub === 0) { b.vx = 0; if (b.t > 0.45 * spd) { b.sub = 1; b.vy = -390; b.vx = clamp((px - bx) / 0.9, -150, 150); b.face = sign(b.vx); b.onGround = false; sfx.jump(); } }
      else if (b.sub === 1) {
        moveX(b, b.vx * dt);
        if (b.onGround && b.t > 0.15) {
          b.sub = 2; b.t = 0; b.vx = 0; G.shake = 0.45; sfx.boom();
          for (const d of [-1, 1]) ebullet({ type: 'shard', x: bx - 5, y: GY - 10, w: 10, h: 10, vx: d * (rage ? 150 : 120), vy: 0, life: 2.2 });
        }
      } else if (b.t > 0.6 * spd) bossSet('idle');
      break;
    case 'rain':
      if (b.sub === 0) {
        b.sub = 1; b.vx = 0; const n = rage ? 8 : 6;
        for (let i = 0; i < n; i++) schedule(i * 0.32, () => {
          if (!G.boss || G.boss.state === 'dead') return;
          const x = i % 2 ? clamp(cx(G.p) + rand(-30, 30), BOSS_X + 40, BOSS_X + 440) : rand(BOSS_X + 40, BOSS_X + 440);
          G.warns.push({ x, t: 0.55 }); schedule(0.55, () => { if (G.boss && G.boss.state !== 'dead') throwGift(true, x - 5); });
        });
        b.nextT = n * 0.32 + 1.3;
      } else if (b.t > b.nextT) bossSet('idle');
      break;
    case 'dead':
      grav = false; b.vx = 0;
      if (Math.floor(b.t * 8) !== Math.floor((b.t - dt) * 8)) { burst(b.x + rand(0, b.w), b.y + rand(0, b.h), 8, ['#f33', '#fff', '#ffd84d'], 100); sfx.boom(); G.shake = 0.2; }
      break;
  }
  if (grav) { b.vy = Math.min(b.vy + 900 * dt, 500); moveY(b, b.vy * dt); }
  if (b.state !== 'dead' && b.state !== 'intro' && p.inv <= 0 && ov({ x: b.x + 3, y: b.y + 3, w: b.w - 6, h: b.h - 3 }, p)) hurtPlayer(2, bx);
}
function hitBoss(dmg) {
  const b = G.boss;
  if (!b || b.state === 'intro' || b.state === 'dead') return;
  b.hp -= dmg; b.flash = 0.1; G.bossDmg += 100 * dmg; sfx.bossHit();
  burst(cx(b), b.y + 14, 4, ['#fff', '#f66'], 60);
  if (b.hp <= 0) {
    b.hp = 0; bossSet('dead'); G.eb = []; G.sched = []; G.warns = []; mode = 'bossdead'; G.endT = 0;
    G.finalTime = G.time; G.cleared = true; sfx.boom();
  }
}

/* ───────────── bullets / projectiles ───────────── */
function updateBullets(dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.life -= dt;
    if (b.life <= 0 || solidAt(b.vx > 0 ? b.x + b.w : b.x, b.y + 2)) { b.dead = true; burst(b.x, b.y, 2, ['#fff'], 30); continue; }
    for (const e of G.enemies) if (!e.dead && ov(b, e)) {
      b.dead = true; e.hp--; e.fl = 0.1; burst(b.x, b.y, 3, ['#fff', '#ffd84d'], 50);
      if (e.hp <= 0) killEnemy(e); else sfx.bossHit();
      break;
    }
    if (!b.dead && G.boss && ov(b, G.boss)) { b.dead = true; hitBoss(1); }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
  for (const e of G.eb) {
    e.life -= dt; e.x += e.vx * dt;
    if (e.g) { e.vy += e.g * dt; e.y += e.vy * dt; }
    let boom = false;
    if (e.type === 'gift' && (e.y + e.h >= GY || solidAt(cx(e), e.y + e.h))) boom = true;
    if (e.type !== 'gift' && solidAt(e.vx > 0 ? e.x + e.w : e.x, e.y + 3)) e.dead = true;
    if (e.life <= 0 || e.y > H + 20 || e.x < G.cam - 60 || e.x > G.cam + W + 60) e.dead = true;
    if (!e.dead && mode === 'play' && ov(e, G.p)) { hurtPlayer(1, cx(e)); if (e.type === 'gift') boom = true; else if (e.type === 'ball') e.dead = true; }
    if (boom) {
      e.dead = true; sfx.boom(); burst(cx(e), GY - 4, 12, ['#ffd84d', '#f84', '#fff'], 90); G.shake = Math.max(G.shake, 0.12);
      if (e.shards) for (const d of [-1, 1]) ebullet({ type: 'shard', x: cx(e) - 5, y: GY - 10, w: 10, h: 10, vx: d * 100, vy: 0, life: 1.6 });
    }
  }
  G.eb = G.eb.filter((e) => !e.dead);
}

/* ───────────── main update ───────────── */
function update(dt) {
  if (!G) return;
  G.t += dt;
  if (mode === 'play') G.time += dt;
  for (const s of G.sched) s.t -= dt;
  const due = G.sched.filter((s) => s.t <= 0); G.sched = G.sched.filter((s) => s.t > 0); due.forEach((s) => s.fn());
  for (const w of G.warns) w.t -= dt; G.warns = G.warns.filter((w) => w.t > 0);
  G.shake = Math.max(0, G.shake - dt);

  if (mode === 'play' || mode === 'bossdead') {
    updatePlayer(dt); updateEnemies(dt); updateBoss(dt); updateBullets(dt);
    if (mode === 'bossdead') {
      G.endT += dt;
      if (G.endT > 2.6) { sfx.win(); showResult(true); }
    }
  } else if (mode === 'dying') {
    G.dyingT -= dt; if (G.dyingT <= 0) showResult(false);
  }
  for (const it of G.items) it.t += dt;
  const target = G.boss ? BOSS_X : clamp(cx(G.p) - W * 0.4, 0, BOSS_X);
  G.cam += (target - G.cam) * Math.min(1, dt * 8);
  if (G.boss && Math.abs(G.cam - BOSS_X) < 0.5) G.cam = BOSS_X;
  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.life -= dt; }
  G.parts = G.parts.filter((q) => q.life > 0);
  for (const q of G.pops) { q.y -= 20 * dt; q.life -= dt; }
  G.pops = G.pops.filter((q) => q.life > 0);
  for (const s of G.snow) { s.y += s.s * dt; s.x -= 6 * dt; if (s.y > H) { s.y = -2; s.x = rand(0, W); } if (s.x < 0) s.x = W; }
}

/* ───────────── rendering ───────────── */
const STARS = Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, 120), p: rand(0, 6) }));
let skyGrad = null;
function px(v) { return Math.round(v); }
function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(px(x), px(y), w, h); }

function drawBG(cam) {
  if (!skyGrad) { skyGrad = ctx.createLinearGradient(0, 0, 0, H); skyGrad.addColorStop(0, '#070b24'); skyGrad.addColorStop(0.6, '#1b2a5c'); skyGrad.addColorStop(1, '#3a4c86'); }
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
  for (const s of STARS) { if (Math.sin(G.t * 2 + s.p) > -0.5) rect(s.x, s.y, 1, 1, '#fff'); }
  ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(390, 44, 16, 0, 7); ctx.fill();
  ctx.fillStyle = '#0b1026'; ctx.beginPath(); ctx.arc(396, 40, 13, 0, 7); ctx.fill();
  ctx.fillStyle = '#26396f'; // far hills
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, 190 + Math.sin((x + cam * 0.15) / 40) * 14 + Math.sin((x + cam * 0.15) / 17) * 5);
  ctx.lineTo(W, H); ctx.fill();
  ctx.fillStyle = '#16244d'; // pines
  const off = (cam * 0.4) % 40;
  for (let x = -40 - off; x < W + 40; x += 40) {
    const hgt = 38 + ((Math.floor((x + cam * 0.4) / 40) * 7) % 5) * 5;
    ctx.beginPath(); ctx.moveTo(x, GY + 6); ctx.lineTo(x + 10, GY + 6 - hgt); ctx.lineTo(x + 20, GY + 6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 2, GY - hgt * 0.3); ctx.lineTo(x + 10, GY - hgt); ctx.lineTo(x + 18, GY - hgt * 0.3); ctx.fill();
  }
}
function drawSolids(cam) {
  for (const s of solids) {
    if (s.x + s.w < cam || s.x > cam + W || s.h > 300 && s.y < 0) continue;
    const x0 = Math.max(s.x, cam - 16), x1 = Math.min(s.x + s.w, cam + W + 16);
    if (s.plat) {
      rect(x0 - cam, s.y, x1 - x0, s.h, '#8fd3ff'); rect(x0 - cam, s.y, x1 - x0, 4, '#fff');
      rect(x0 - cam, s.y + s.h - 3, x1 - x0, 3, '#5aa5d6');
      for (let x = Math.ceil(x0 / T) * T; x < x1; x += T) rect(x - cam, s.y + 4, 1, s.h - 7, '#6fb8e8');
    } else if (s.y >= 0) {
      rect(x0 - cam, s.y, x1 - x0, H - s.y, '#3b4766'); rect(x0 - cam, s.y, x1 - x0, 5, '#eaf6ff');
      rect(x0 - cam, s.y + 5, x1 - x0, 2, '#9bb8d8');
      for (let x = Math.ceil(x0 / T) * T; x < x1; x += T) { rect(x - cam, s.y + 7, 1, H, '#2b3555'); }
      for (let y = s.y + 7 + T; y < H; y += T) rect(x0 - cam, y, x1 - x0, 1, '#2b3555');
    } else { rect(s.x - cam, 0, s.w, H, '#2b3555'); } // boss door
  }
}
function drawSpikes(cam) {
  for (const s of LV.spikes) {
    if (s.x + s.w < cam || s.x > cam + W) continue;
    ctx.fillStyle = '#cfeaff';
    for (let x = s.x; x < s.x + s.w; x += 8) { ctx.beginPath(); ctx.moveTo(x - cam, s.y + 8); ctx.lineTo(x - cam + 4, s.y); ctx.lineTo(x - cam + 8, s.y + 8); ctx.fill(); }
    ctx.fillStyle = '#6aa8d8';
    for (let x = s.x; x < s.x + s.w; x += 8) { ctx.beginPath(); ctx.moveTo(x - cam + 4, s.y); ctx.lineTo(x - cam + 8, s.y + 8); ctx.lineTo(x - cam + 4, s.y + 8); ctx.fill(); }
  }
}
function drawHeart(x, y, c = '#ff4d6a', s = 1) {
  ctx.fillStyle = c;
  const r = [[1, 0, 2], [4, 0, 2], [0, 1, 7], [0, 2, 7], [1, 3, 5], [2, 4, 3], [3, 5, 1]];
  for (const [dx, dy, w] of r) ctx.fillRect(px(x + dx * s), px(y + dy * s), w * s, s);
}
function bottomOf(e) { return e.y + e.h; }
function drawEnemy(e, cam) {
  const x = cx(e) - cam, b = bottomOf(e), t = G.t;
  const flash = e.fl > 0;
  if (e.type === 'snow') {
    if (drawSpr('snowman', 'walk', t, x, b, e.dir > 0)) return;
    const f = flash ? '#fff' : '#eef6ff';
    ctx.fillStyle = '#222'; ctx.fillRect(px(x - 4), b - 22, 8, 5); ctx.fillRect(px(x - 6), b - 18, 12, 2);
    ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, b - 6, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x, b - 14, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(px(x - 2 + e.dir), b - 15, 1, 2); ctx.fillRect(px(x + 1 + e.dir), b - 15, 1, 2);
    ctx.fillStyle = '#f80'; ctx.fillRect(px(x + e.dir * 3), b - 13, 4 * e.dir || 4, 2);
    ctx.fillStyle = '#c33'; ctx.fillRect(px(x - 5), b - 11, 10, 2);
  } else if (e.type === 'bat') {
    if (drawSpr('bat', 'fly', t, x, e.y + e.h, e.face > 0)) return;
    const fl = Math.sin(t * 20) * 4;
    ctx.fillStyle = flash ? '#fff' : '#5b3a8a';
    ctx.beginPath(); ctx.moveTo(x, e.y + 4); ctx.lineTo(x - 12, e.y - 2 + fl); ctx.lineTo(x - 6, e.y + 8); ctx.lineTo(x + 6, e.y + 8); ctx.lineTo(x + 12, e.y - 2 + fl); ctx.fill();
    ctx.fillStyle = '#7a52b8'; ctx.beginPath(); ctx.arc(x, e.y + 6, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(px(x - 2), e.y + 5, 1, 1); ctx.fillRect(px(x + 1), e.y + 5, 1, 1);
  } else if (e.type === 'turret') {
    if (drawSpr('turret', 'idle', t, x, b, e.face > 0)) return;
    ctx.fillStyle = flash ? '#fff' : '#fff'; ctx.fillRect(px(x - 8), b - 8, 16, 8);
    ctx.fillStyle = '#d22'; for (let i = 0; i < 4; i++) ctx.fillRect(px(x - 8 + i * 4 + 1), b - 8, 2, 8);
    ctx.fillStyle = flash ? '#fff' : '#c33'; ctx.fillRect(px(x + (e.face > 0 ? 2 : -12)), b - 13, 10, 5);
    ctx.fillStyle = '#fff'; ctx.fillRect(px(x + (e.face > 0 ? 6 : -10)), b - 13, 2, 5);
  } else if (e.type === 'icicle') {
    if (drawSpr('icicle', 'idle', t, x, b, false)) return;
    const sh = e.st === 1 ? Math.sin(t * 80) * 1.5 : 0;
    ctx.fillStyle = flash ? '#fff' : '#bfe6ff'; ctx.beginPath(); ctx.moveTo(x - 5 + sh, e.y); ctx.lineTo(x + 5 + sh, e.y); ctx.lineTo(x + sh, b + 2); ctx.fill();
    ctx.fillStyle = '#7fc2ee'; ctx.beginPath(); ctx.moveTo(x + sh, e.y); ctx.lineTo(x + 5 + sh, e.y); ctx.lineTo(x + sh, b + 2); ctx.fill();
  }
}
function drawBoss(cam) {
  const b = G.boss; if (!b) return;
  const x = cx(b) - cam, bt = b.y + b.h, t = G.t, face = b.face;
  if (b.state === 'dead' && Math.floor(b.t * 20) % 2) return;
  const anim = { dash: 'dash', slam: 'slam', throw: 'throw', stun: 'stun', dead: 'dead' }[b.state] || (Math.abs(b.vx) > 5 ? 'walk' : 'idle');
  if (b.state === 'dash' && b.sub === 0 && Math.floor(t * 16) % 2) ctx.globalAlpha = 0.6;
  if (drawSpr('santa', anim, b.t, x, bt, face > 0)) { ctx.globalAlpha = 1; return; }
  ctx.save(); ctx.translate(px(x), bt); ctx.scale(face > 0 ? 1 : -1, 1);
  const fl = b.flash > 0, rage = b.hp <= BOSS_HP / 2;
  const red = fl ? '#fff' : (rage ? '#e01818' : '#c4202a'), dark = fl ? '#ddd' : '#8a1018';
  const squat = b.state === 'slam' && b.sub === 0 ? 5 : 0, bob = b.state === 'idle' ? Math.sin(t * 5) : 0;
  ctx.translate(0, squat);
  rect(-10, -8, 8, 8, '#222'); rect(2, -8, 8, 8, '#222');                       // boots
  rect(-14, -32 + bob, 28, 26, red); rect(-14, -32 + bob, 28, 3, '#fff');       // coat
  rect(-14, -9, 28, 3, '#fff'); rect(-14, -20 + bob, 28, 4, '#222'); rect(-3, -21 + bob, 6, 6, '#fc3'); // trim,belt
  rect(-18, -30 + bob, 6, 16, dark); rect(12, -30 + bob, 6, 16, dark);          // arms
  rect(12, -16 + bob, 7, 6, '#fff');                                           // glove
  rect(-9, -42 + bob, 18, 12, '#f2c9a0');                                      // face
  rect(-10, -34 + bob, 20, 9, '#fff'); rect(-6, -29 + bob, 12, 5, '#fff');      // beard
  rect(-9, -47 + bob, 18, 6, red); rect(-11, -42 + bob, 22, 3, '#fff'); rect(7, -50 + bob, 5, 5, '#fff'); // hat
  rect(-6, -39 + bob, 4, 3, '#200'); rect(2, -39 + bob, 4, 3, '#200');         // eyes
  rect(-5, -38 + bob, 2, 1, '#f33'); rect(3, -38 + bob, 2, 1, '#f33');
  rect(-7, -41 + bob, 5, 1, '#600'); rect(2, -41 + bob, 5, 1, '#600');        // brows
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawPlayer(cam) {
  const p = G.p;
  if (p.dead) return;
  if (p.inv > 0 && Math.floor(G.t * 25) % 2) return;
  const x = cx(p) - cam, b = p.y + p.h, face = p.face;
  const anim = p.hurt > 0 ? 'hurt' : !p.onGround ? 'jump' : p.shotT > 0 ? 'shoot' : Math.abs(p.vx) > 5 ? 'run' : 'idle';
  if (drawSpr('player_' + CHAR, anim, p.anim, x, b, face < 0)) return;
  ctx.save(); ctx.translate(px(x), b); ctx.scale(face, 1);
  const run = anim === 'run' ? Math.floor(p.anim * 10) % 2 : 0, air = anim === 'jump';
  rect(-5, -6 + (air ? -1 : 0), 4, 6 - run * 2, '#1d4ba0'); rect(1, -6, 4, 4 + run * 2, '#1d4ba0');
  rect(-5, -15, 10, 10, '#2f6fdf'); rect(-5, -15, 10, 2, '#5aa0ff');
  rect(-6, -23, 12, 9, '#3d86ff'); rect(-6, -23, 12, 3, '#fff');
  rect(0, -19, 6, 4, '#bff'); rect(2, -18, 2, 2, '#124');
  rect(4, -13, 7, 4, '#9bd'); if (p.shotT > 0) rect(11, -13, 3, 4, '#ffd84d');
  ctx.restore();
}
function drawEBullet(e, cam) {
  const x = e.x - cam, y = e.y;
  if (e.type === 'ball') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 3, y + 3, 3.5, 0, 7); ctx.fill(); }
  else if (e.type === 'shard') {
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(x, y + e.h); ctx.lineTo(x + e.w / 2, y); ctx.lineTo(x + e.w, y + e.h); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.moveTo(x + 2, y + e.h); ctx.lineTo(x + e.w / 2, y + 4); ctx.lineTo(x + e.w - 2, y + e.h); ctx.fill();
  } else if (e.type === 'gift') {
    if (drawSpr('gift', 'idle', G.t, x + e.w / 2, y + e.h, false)) return;
    rect(x, y, 10, 10, '#2aa84a'); rect(x + 4, y, 2, 10, '#ffd84d'); rect(x, y + 4, 10, 2, '#ffd84d'); rect(x + 2, y - 2, 6, 2, '#ffd84d');
  }
}
function drawHUD() {
  ctx.font = '9px "DotGothic16", monospace'; ctx.textBaseline = 'top';
  for (let i = 0; i < PLAYER_HP; i++) drawHeart(6 + i * 11, 6, i < G.p.hp ? '#ff4d6a' : '#3a2a40');
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('SCORE ' + String(score()).padStart(6, '0'), W / 2, 5);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd84d'; ctx.fillText(fmtTime(G.cleared ? G.finalTime : G.time), W - 6, 5);
  // progress bar
  const pw = 120, pxl = W - 6 - pw; rect(pxl, 20, pw, 3, '#223'); rect(pxl, 20, pw * clamp(G.maxX / BOSS_TRIGGER, 0, 1), 3, '#4df');
  ctx.textAlign = 'left'; ctx.fillStyle = '#f66'; ctx.fillText('🎅', pxl + pw - 4, 15);
  if (G.boss && G.boss.state !== 'intro') {
    const bw = 200, bx = (W - bw) / 2, by = H - 16;
    rect(bx - 2, by - 2, bw + 4, 10, '#000'); rect(bx, by, bw, 6, '#401018');
    rect(bx, by, bw * G.boss.hp / BOSS_HP, 6, G.boss.hp <= BOSS_HP / 2 ? '#ff3030' : '#e8474f');
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('EVIL SANTA', W / 2, by - 12);
  }
  if (G.boss && G.boss.state === 'intro') {
    ctx.textAlign = 'center';
    if (Math.floor(G.boss.t * 4) % 2) { ctx.fillStyle = '#ff3030'; ctx.font = '22px "DotGothic16", monospace'; ctx.fillText('WARNING!', W / 2, 90); }
    ctx.font = '10px "DotGothic16", monospace'; ctx.fillStyle = '#fff'; ctx.fillText('사악한 산타가 나타났다', W / 2, 120);
  }
  if (mode === 'bossdead' && G.endT > 0.6) { ctx.textAlign = 'center'; ctx.fillStyle = '#ffd84d'; ctx.font = '20px "DotGothic16", monospace'; ctx.fillText('SANTA DEFEATED!', W / 2, 90); }
}
function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!G) { ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, W, H); return; }
  const cam = Math.round(G.cam);
  ctx.save();
  if (G.shake > 0) ctx.translate(px(rand(-2, 2)), px(rand(-2, 2)));
  drawBG(cam); drawSolids(cam); drawSpikes(cam);
  for (const it of G.items) if (!it.got && it.x > cam - 20 && it.x < cam + W) drawItem(it, cam);
  for (const w of G.warns) { ctx.fillStyle = Math.floor(G.t * 16) % 2 ? '#ff3030' : '#ff9090'; ctx.fillRect(px(w.x - cam - 1), 0, 2, GY); ctx.fillRect(px(w.x - cam - 8), GY - 5, 16, 2); }
  for (const e of G.enemies) if (e.x > cam - 30 && e.x < cam + W + 30) drawEnemy(e, cam);
  drawBoss(cam);
  for (const e of G.eb) drawEBullet(e, cam);
  for (const b of G.bullets) { rect(b.x - cam, b.y, b.w, b.h, SHOT_COLOR[CHAR][0]); rect(b.x - cam + 1, b.y + 1, b.w - 2, 2, SHOT_COLOR[CHAR][1]); }
  drawPlayer(cam);
  for (const q of G.parts) rect(q.x - cam, q.y, q.s, q.s, q.c);
  ctx.font = '8px "DotGothic16", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (const q of G.pops) { ctx.fillStyle = q.c; ctx.fillText(q.txt, px(q.x - cam), px(q.y)); }
  ctx.fillStyle = 'rgba(255,255,255,.8)'; for (const s of G.snow) ctx.fillRect(px(s.x), px(s.y), s.r, s.r);
  ctx.restore();
  drawHUD();
}
function drawItem(it, cam) {
  const x = it.x - cam, y = it.y + Math.sin(it.t * 4) * 2;
  if (drawSpr('heart', 'idle', it.t, x + 6, y + 12, false)) return;
  drawHeart(x + 1, y + 1, '#ff4d6a', 1.4);
}

/* ───────────── ranking (server + local fallback) ───────────── */
const API = (window.API_BASE || '').replace(/\/$/, '');
const LS_KEY = 'kts_ranking_v1';
const localRank = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; } };
function saveLocal(entry) {
  const list = localRank(); list.push(entry);
  list.sort((a, b) => b.score - a.score || a.time - b.time); const top = list.slice(0, 10);
  try { localStorage.setItem(LS_KEY, JSON.stringify(top)); } catch (e) {}
  return { ranking: top, rank: top.indexOf(entry) + 1, offline: true };
}
async function fetchRanking() {
  try {
    const r = await fetch(API + '/api/ranking', { cache: 'no-store' });
    if (!r.ok) throw 0; return { ranking: (await r.json()).ranking, offline: false };
  } catch (e) { return { ranking: localRank(), offline: true }; }
}
async function postScore(entry) {
  try {
    const r = await fetch(API + '/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    if (!r.ok) throw 0; const j = await r.json(); return { ...j, offline: false };
  } catch (e) { return saveLocal(entry); }
}
function renderRank(ol, list, hi) {
  ol.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const r = list[i], li = document.createElement('li');
    if (!r) { li.className = 'empty'; li.innerHTML = '<b>---</b><i>0</i>'; }
    else {
      const b = document.createElement('b'); b.textContent = r.name; if (r.cleared) { const m = document.createElement('em'); m.textContent = ' CLEAR'; b.appendChild(m); }
      const s = document.createElement('i'); s.textContent = r.score.toLocaleString();
      li.append(b, s); if (hi === i + 1) li.className = 'me';
    }
    ol.appendChild(li);
  }
}

/* ───────────── screens ───────────── */
const el = { title: $('title'), result: $('result'), rankPanel: $('rankPanel') };
async function showTitle() {
  mode = 'title'; G = null; ctl.classList.add('hidden');
  el.result.classList.add('hidden'); el.title.classList.remove('hidden');
  const r = await fetchRanking(); renderRank($('titleRank'), r.ranking);
}
function startGame() {
  audio(); newGame(); mode = 'play'; jumpPressed = false;
  el.title.classList.add('hidden'); el.result.classList.add('hidden');
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) ctl.classList.remove('hidden');
}
let submitted = false;
function showResult(won) {
  mode = 'result'; ctl.classList.add('hidden'); submitted = false;
  for (const k in key) key[k] = 0;
  const t = won ? G.finalTime : G.time;
  $('resTitle').textContent = won ? 'VICTORY!' : 'GAME OVER';
  $('resTitle').style.color = won ? '#7dff9a' : '#ff4d4d';
  const rows = [['진행 점수', progScore()], ['처치 점수', G.kill], ['보스 데미지', G.bossDmg]];
  if (won) rows.push(['클리어 보너스', CLEAR_BONUS], [`시간 보너스 (${fmtTime(t)})`, timeBonus()]);
  $('resBreak').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1].toLocaleString()}</td></tr>`).join('');
  $('resTotal').textContent = 'TOTAL ' + score().toLocaleString();
  $('nameForm').classList.remove('hidden'); $('skipBtn').classList.remove('hidden'); el.rankPanel.classList.add('hidden');
  let last = ''; try { last = localStorage.getItem('kts_name') || ''; } catch (e) {}
  $('nameInput').value = last;
  el.result.classList.remove('hidden');
}
$('nameForm').addEventListener('submit', async (e) => {
  e.preventDefault(); if (submitted) return;
  const name = $('nameInput').value.replace(/[<>&"'`]/g, '').trim().slice(0, 8);
  if (!name) { $('nameInput').focus(); return; }
  submitted = true; try { localStorage.setItem('kts_name', name); } catch (er) {}
  const res = await postScore({ name, score: score(), time: Math.floor(G.cleared ? G.finalTime : G.time), cleared: !!G.cleared });
  renderRank($('resRank'), res.ranking, res.rank);
  $('nameForm').classList.add('hidden'); $('skipBtn').classList.add('hidden'); el.rankPanel.classList.remove('hidden');
  $('resTotal').textContent = 'TOTAL ' + score().toLocaleString() + (res.rank ? `  —  ${res.rank}위!` : '  (TOP10 밖)') + (res.offline ? ' [로컬]' : '');
});
document.querySelectorAll('.pick').forEach((b) => {
  b.classList.toggle('sel', b.dataset.c === CHAR);
  b.onclick = () => { CHAR = b.dataset.c; try { localStorage.setItem('kts_char', CHAR); } catch (e) {} document.querySelectorAll('.pick').forEach((x) => x.classList.toggle('sel', x === b)); };
});
$('startBtn').onclick = startGame;
$('retryBtn').onclick = startGame;
$('skipBtn').onclick = startGame;
$('fsBtn').onclick = async () => {
  try { await document.documentElement.requestFullscreen(); } catch (e) {}
  try { await screen.orientation.lock('landscape'); } catch (e) {}
};

/* ───────────── loop ───────────── */
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!isPortrait() && !document.hidden) {
    acc += dt;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
  }
  render();
}
requestAnimationFrame(frame);
showTitle();
window.__KTS = { get G() { return G; }, get mode() { return mode; }, startGame, key };
})();
