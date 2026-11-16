// The game's rules and state, with no drawing and no browser in it: the moth, the shadows,
// the embers, spawning, collisions, light, score, waves and blessings. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react (sounds, screens)
// without the world knowing about them. Nothing here allocates after createWorld returns.

import {
  BLESSINGS, EMBER, ENEMY, FIELD, FLARE, LIGHT, MOONPETAL, PLAYER, POOL, SCORE,
  WAVE_DEFS, WAVES,
} from './config.js';

export const KIND_WISP = 0;
export const KIND_DART = 1;
export const KIND_BRUTE = 2;
export const KIND_EMBER = 3;
export const KIND_PETAL = 4;

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_ORB = 4;
export const EVENT_FLARE = 8;
export const EVENT_WAVE_CLEAR = 16;
export const EVENT_OVER = 32;
export const EVENT_WIN = 64;
export const EVENT_CHARM = 128;
export const EVENT_PETAL = 256;

/** Dart states: chasing, winding up a lunge, lunging, recovering. */
const DART_CHASE = 0;
const DART_WINDUP = 1;
const DART_LUNGE = 2;
const DART_RECOVER = 3;

/** Thorn Light: seconds between burn ticks on the same enemy (was every frame). */
const THORN_COOLDOWN = 0.5;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pickBlessings(random, owned) {
  const available = BLESSINGS.filter((b) => (owned[b.id] ?? 0) < b.max);
  const picks = [];
  while (picks.length < 3 && available.length > 0) {
    const index = Math.floor(random() * available.length);
    picks.push(available.splice(index, 1)[0]);
  }
  return picks;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    radius: PLAYER.radius, invulnerable: 0, flap: 0, moving: false,
  };
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({
      active: false, kind: KIND_WISP, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1,
      radius: 14, speed: 90, wobble: 0, state: DART_CHASE, timer: 0, flash: 0,
      lx: 0, ly: 0, thornCd: 0,
    });
  }
  const orbs = [];
  for (let i = 0; i < POOL.orbs; i += 1) {
    orbs.push({ active: false, kind: KIND_EMBER, x: 0, y: 0, vx: 0, vy: 0, radius: 9, bob: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff' });
  }
  const texts = [];
  for (let i = 0; i < POOL.texts; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 20 });
  }
  // Fixed garden decor, drawn by the renderer: stars, grass tufts and night flowers.
  const stars = [];
  for (let i = 0; i < 90; i += 1) stars.push({ x: random() * FIELD.width, y: random() * FIELD.height * 0.7, r: 0.6 + random() * 1.4, phase: random() * Math.PI * 2 });
  const tufts = [];
  for (let i = 0; i < 70; i += 1) tufts.push({ x: random() * FIELD.width, y: 120 + random() * (FIELD.height - 140), s: 0.6 + random() * 0.9 });
  const flowers = [];
  for (let i = 0; i < 26; i += 1) flowers.push({ x: random() * FIELD.width, y: 120 + random() * (FIELD.height - 140), hue: random(), phase: random() * Math.PI * 2 });

  const state = {
    player, enemies, orbs, particles, texts, stars, tufts, flowers,
    light: LIGHT.max, maxLight: LIGHT.max,
    score: 0, kills: 0, orbsCollected: 0, time: 0,
    wave: 1, waveState: 'fighting', spawnQueue: [], spawnTimer: 0, emberTimer: EMBER.interval,
    blessings: {}, offered: [], flareCooldown: 0, shake: 0, flareRing: 0, flareRadius: 0,
    dawn: 0, charmUsed: false, victory: false, over: false, lastKillKind: -1,
  };

  function burst(x, y, color, count, speed, size) {
    let made = 0;
    for (let i = 0; i < particles.length && made < count; i += 1) {
      const p = particles[i];
      if (p.active) continue;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = 0.4 + random() * 0.5;
      p.life = p.maxLife;
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
      made += 1;
    }
  }

  function floatText(x, y, text, color, size) {
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (t.active) continue;
      t.active = true;
      t.x = x;
      t.y = y;
      t.maxLife = 0.9;
      t.life = t.maxLife;
      t.text = text;
      t.color = color;
      t.size = size || 20;
      return;
    }
  }

  function addScore(base) {
    const mult = 1 + 0.5 * (state.blessings.greed ?? 0);
    state.score += Math.round(base * mult);
  }

  function freeEnemy() {
    for (let i = 0; i < enemies.length; i += 1) if (!enemies[i].active) return enemies[i];
    return null;
  }

  function freeOrb() {
    for (let i = 0; i < orbs.length; i += 1) if (!orbs[i].active) return orbs[i];
    return null;
  }

  function spawnEnemy(kind) {
    const e = freeEnemy();
    if (!e) return;
    const def = kind === KIND_BRUTE ? ENEMY.brute : kind === KIND_DART ? ENEMY.dart : ENEMY.wisp;
    // Enter from a random edge, away from the moth so nothing spawns on top of it.
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 8; tries += 1) {
      const side = Math.floor(random() * 4);
      if (side === 0) { x = random() * FIELD.width; y = -30; }
      else if (side === 1) { x = random() * FIELD.width; y = FIELD.height + 30; }
      else if (side === 2) { x = -30; y = random() * FIELD.height; }
      else { x = FIELD.width + 30; y = random() * FIELD.height; }
      if (dist2(x, y, player.x, player.y) > 240 * 240) break;
    }
    e.active = true;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.hp = def.hp;
    e.maxHp = def.hp;
    e.radius = def.radius;
    e.speed = def.speed * (1 + 0.05 * (state.wave - 1));
    e.wobble = random() * Math.PI * 2;
    e.state = DART_CHASE;
    e.timer = 0;
    e.flash = 0;
    e.thornCd = 0;
  }

  function spawnOrb(kind, x, y) {
    const o = freeOrb();
    if (!o) return;
    o.active = true;
    o.kind = kind;
    o.x = x;
    o.y = y;
    const angle = random() * Math.PI * 2;
    o.vx = Math.cos(angle) * 40;
    o.vy = Math.sin(angle) * 40;
    o.radius = kind === KIND_PETAL ? MOONPETAL.radius : EMBER.radius;
    o.bob = random() * Math.PI * 2;
  }

  function dropOrbs(enemy) {
    const def = enemy.kind === KIND_BRUTE ? ENEMY.brute : enemy.kind === KIND_DART ? ENEMY.dart : ENEMY.wisp;
    for (let i = 0; i < def.orbs; i += 1) spawnOrb(KIND_EMBER, enemy.x, enemy.y);
    for (let i = 0; i < (def.petals ?? 0); i += 1) spawnOrb(KIND_PETAL, enemy.x, enemy.y);
  }

  function killEnemy(enemy, award) {
    enemy.active = false;
    state.kills += 1;
    state.lastKillKind = enemy.kind;
    const def = enemy.kind === KIND_BRUTE ? ENEMY.brute : enemy.kind === KIND_DART ? ENEMY.dart : ENEMY.wisp;
    if (award) {
      addScore(def.score);
      // A scattered shadow gives its stolen light back.
      state.light = Math.min(state.maxLight, state.light + LIGHT.killRefund);
      floatText(enemy.x, enemy.y - 10, `+${Math.round(def.score * (1 + 0.5 * (state.blessings.greed ?? 0)))}`, '#f2c94c', 20);
    }
    burst(enemy.x, enemy.y, '#8f6fd8', enemy.kind === KIND_BRUTE ? 26 : 12, 180, 4);
    burst(enemy.x, enemy.y, '#ffb347', 6, 120, 3);
    dropOrbs(enemy);
    if (enemy.kind === KIND_BRUTE) {
      spawnEnemy(KIND_WISP);
      spawnEnemy(KIND_WISP);
    }
    return 1;
  }

  function flareRadius() {
    return FLARE.radius * (1 + FLARE.radiusPerBlessing * (state.blessings.wide ?? 0));
  }

  function flareCooldownMax() {
    return FLARE.cooldown * (1 - FLARE.cooldownPerBlessing * (state.blessings.quick ?? 0));
  }

  function doFlare() {
    const radius = flareRadius();
    state.flareCooldown = flareCooldownMax();
    state.light = Math.max(0, state.light - LIGHT.flareCost);
    state.flareRing = 1;
    state.flareRadius = radius;
    state.shake = Math.max(state.shake, 4);
    burst(player.x, player.y, '#ffe9a8', 18, 260, 3);
    let kills = 0;
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      if (!e.active) continue;
      const d = Math.sqrt(dist2(e.x, e.y, player.x, player.y));
      if (d > radius + e.radius) continue;
      const nx = d > 0.01 ? (e.x - player.x) / d : 1;
      const ny = d > 0.01 ? (e.y - player.y) / d : 0;
      e.vx += nx * FLARE.knockback;
      e.vy += ny * FLARE.knockback;
      e.hp -= FLARE.damage;
      e.flash = 0.15;
      if (e.hp <= 0) kills += killEnemy(e, true);
    }
    return kills;
  }

  function startWave(wave) {
    const def = WAVE_DEFS[wave - 1];
    state.wave = wave;
    state.waveState = 'fighting';
    state.spawnQueue = [];
    for (let i = 0; i < def.wisp; i += 1) state.spawnQueue.push(KIND_WISP);
    for (let i = 0; i < def.dart; i += 1) state.spawnQueue.push(KIND_DART);
    for (let i = 0; i < def.brute; i += 1) state.spawnQueue.push(KIND_BRUTE);
    // Shuffle the queue so the wave never arrives in one kind's block.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = state.spawnQueue[i];
      state.spawnQueue[i] = state.spawnQueue[j];
      state.spawnQueue[j] = tmp;
    }
    state.spawnTimer = 0.8;
  }

  function offerBlessings() {
    state.offered = pickBlessings(random, state.blessings);
    state.waveState = 'blessing';
  }

  /** For a staged scene: clear the field and offer blessings at once. */
  function stageBlessing() {
    for (const e of enemies) e.active = false;
    state.spawnQueue = [];
    offerBlessings();
  }

  function applyBlessing(index) {
    const b = state.offered[index];
    if (!b) return false;
    state.blessings[b.id] = (state.blessings[b.id] ?? 0) + 1;
    if (b.id === 'heart') {
      state.maxLight += 25;
      state.light = Math.min(state.maxLight, state.light + 25);
    }
    state.offered = [];
    if (state.wave >= WAVES) {
      state.victory = true;
      state.waveState = 'done';
      return true;
    }
    startWave(state.wave + 1);
    return true;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.invulnerable = 0;
    player.flap = 0;
    player.moving = false;
    for (const e of enemies) e.active = false;
    for (const o of orbs) o.active = false;
    for (const p of particles) p.active = false;
    for (const t of texts) t.active = false;
    state.light = LIGHT.max;
    state.maxLight = LIGHT.max;
    state.score = 0;
    state.kills = 0;
    state.orbsCollected = 0;
    state.time = 0;
    state.blessings = {};
    state.offered = [];
    state.flareCooldown = 0;
    state.shake = 0;
    state.flareRing = 0;
    state.dawn = 0;
    state.charmUsed = false;
    state.victory = false;
    state.over = false;
    state.lastKillKind = -1;
    startWave(1);
  }

  /**
   * One fixed step. `dir` is the steering direction (-1..1 per axis), `flare` asks for a
   * flare burst. With `harmless` set (the title screen's backdrop) shadows drift and embers
   * glow, but nothing touches the moth and nothing scores.
   */
  function step(dt, dir, flare, harmless) {
    let events = 0;
    state.time += dt;
    if (state.flareCooldown > 0) state.flareCooldown = Math.max(0, state.flareCooldown - dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.flareRing > 0) state.flareRing = Math.max(0, state.flareRing - dt * 2.2);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    // The moth steers with acceleration and drag, so it feels weighty but answers at once.
    const speed = PLAYER.speed * (1 + 0.12 * (state.blessings.swift ?? 0));
    player.vx += dir.x * PLAYER.accel * dt;
    player.vy += dir.y * PLAYER.accel * dt;
    const drag = Math.exp(-6 * dt);
    player.vx *= drag;
    player.vy *= drag;
    const v = Math.hypot(player.vx, player.vy);
    if (v > speed) {
      player.vx = (player.vx / v) * speed;
      player.vy = (player.vy / v) * speed;
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
    player.moving = v > 40;
    player.flap += dt * (player.moving ? 26 : 12);

    if (!harmless && !state.over && !state.victory) {
      state.light -= (LIGHT.drain + LIGHT.drainPerWave * (state.wave - 1)) * dt;
      if (state.light <= 0) {
        state.light = 0;
        if ((state.blessings.charm ?? 0) > 0 && !state.charmUsed) {
          state.charmUsed = true;
          state.light = LIGHT.charmRestore;
          player.invulnerable = 2;
          burst(player.x, player.y, '#c9b8ff', 40, 320, 4);
          floatText(player.x, player.y - 30, 'SECOND DAWN!', '#c9b8ff', 28);
          events |= EVENT_CHARM;
        } else {
          state.over = true;
          burst(player.x, player.y, '#ffe9a8', 40, 240, 4);
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    if (flare && !harmless && state.flareCooldown === 0 && state.light > LIGHT.flareCost && !state.over && !state.victory) {
      doFlare();
      events |= EVENT_FLARE;
    }

    // Spawn the wave, one shadow at a time.
    if (!harmless && state.waveState === 'fighting' && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = WAVE_DEFS[state.wave - 1].interval;
      }
    }

    // Ambient embers drift in while the moth flies.
    if (state.waveState !== 'blessing') {
      state.emberTimer -= dt;
      if (state.emberTimer <= 0) {
        let ambient = 0;
        for (const o of orbs) if (o.active && o.kind === KIND_EMBER) ambient += 1;
        if (ambient < EMBER.maxAmbient) {
          spawnOrb(KIND_EMBER, 60 + random() * (FIELD.width - 120), 60 + random() * (FIELD.height - 120));
        }
        state.emberTimer = EMBER.interval;
      }
    }

    // Enemies: chase, wobble, lunge, recover; the thorn blessing burns them on touch.
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      if (!e.active) continue;
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
      if (e.thornCd > 0) e.thornCd = Math.max(0, e.thornCd - dt);
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.kind === KIND_WISP) {
        const wob = Math.sin(state.time * 3 + e.wobble) * 46;
        const nx = dx / d;
        const ny = dy / d;
        e.vx += (nx * e.speed + -ny * wob - e.vx) * Math.min(1, dt * 3);
        e.vy += (ny * e.speed + nx * wob - e.vy) * Math.min(1, dt * 3);
      } else if (e.kind === KIND_BRUTE) {
        e.vx += ((dx / d) * e.speed - e.vx) * Math.min(1, dt * 2);
        e.vy += ((dy / d) * e.speed - e.vy) * Math.min(1, dt * 2);
      } else {
        // Dart: stalk, telegraph, lunge, recover.
        e.timer -= dt;
        if (e.state === DART_CHASE) {
          e.vx += ((dx / d) * e.speed - e.vx) * Math.min(1, dt * 3);
          e.vy += ((dy / d) * e.speed - e.vy) * Math.min(1, dt * 3);
          if (d < ENEMY.dart.lungeRange) {
            e.state = DART_WINDUP;
            e.timer = ENEMY.dart.windup;
          }
        } else if (e.state === DART_WINDUP) {
          e.vx *= Math.exp(-8 * dt);
          e.vy *= Math.exp(-8 * dt);
          if (e.timer <= 0) {
            e.state = DART_LUNGE;
            e.timer = ENEMY.dart.lungeTime;
            e.lx = dx / d;
            e.ly = dy / d;
            e.vx = e.lx * ENEMY.dart.lungeSpeed;
            e.vy = e.ly * ENEMY.dart.lungeSpeed;
          }
        } else if (e.state === DART_LUNGE) {
          if (e.timer <= 0) {
            e.state = DART_RECOVER;
            e.timer = ENEMY.dart.recover;
          }
        } else {
          e.vx *= Math.exp(-4 * dt);
          e.vy *= Math.exp(-4 * dt);
          if (e.timer <= 0) e.state = DART_CHASE;
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = Math.min(FIELD.width + 40, Math.max(-40, e.x));
      e.y = Math.min(FIELD.height + 40, Math.max(-40, e.y));

      if (harmless || state.over || state.victory) continue;
      if (d < e.radius + player.radius) {
        if ((state.blessings.thorns ?? 0) > 0 && e.thornCd <= 0) {
          e.thornCd = THORN_COOLDOWN;
          e.hp -= 1;
          e.flash = 0.15;
          burst(e.x, e.y, '#ffd76a', 6, 140, 3);
          if (e.hp <= 0) {
            killEnemy(e, true);
            events |= EVENT_KILL;
            continue;
          }
        }
        if (player.invulnerable === 0) {
          player.invulnerable = PLAYER.invulnerable;
          state.light = Math.max(0, state.light - LIGHT.hitLoss);
          state.shake = Math.max(state.shake, 9);
          burst(player.x, player.y, '#ff5d7a', 14, 220, 4);
          events |= EVENT_HIT;
          if (state.light <= 0) {
            if ((state.blessings.charm ?? 0) > 0 && !state.charmUsed) {
              state.charmUsed = true;
              state.light = LIGHT.charmRestore;
              player.invulnerable = 2;
              burst(player.x, player.y, '#c9b8ff', 40, 320, 4);
              floatText(player.x, player.y - 30, 'SECOND DAWN!', '#c9b8ff', 28);
              events |= EVENT_CHARM;
            } else {
              state.over = true;
              burst(player.x, player.y, '#ffe9a8', 40, 240, 4);
              events |= EVENT_OVER;
              return events;
            }
          }
        }
      }
    }

    // Orbs: drift, bob, magnetise toward the moth, and get collected on touch.
    for (let i = 0; i < orbs.length; i += 1) {
      const o = orbs[i];
      if (!o.active) continue;
      o.bob += dt * 3;
      if ((state.blessings.magnet ?? 0) > 0 && !harmless) {
        const dx = player.x - o.x;
        const dy = player.y - o.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < EMBER.magnetRadius) {
          o.vx += (dx / d) * EMBER.magnetSpeed * dt * 4;
          o.vy += (dy / d) * EMBER.magnetSpeed * dt * 4;
        }
      }
      o.vx *= Math.exp(-2 * dt);
      o.vy *= Math.exp(-2 * dt);
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (harmless || state.over || state.victory) continue;
      if (dist2(o.x, o.y, player.x, player.y) < (o.radius + player.radius + 6) ** 2) {
        o.active = false;
        state.orbsCollected += 1;
        const isPetal = o.kind === KIND_PETAL;
        const def = isPetal ? MOONPETAL : EMBER;
        state.light = Math.min(state.maxLight, state.light + def.light);
        addScore(def.score);
        floatText(o.x, o.y - 12, `+${def.score}`, isPetal ? '#c9b8ff' : '#f2c94c', isPetal ? 24 : 18);
        burst(o.x, o.y, isPetal ? '#c9b8ff' : '#ffb347', isPetal ? 14 : 8, 130, 3);
        events |= isPetal ? EVENT_PETAL : EVENT_ORB;
      }
    }

    // Particles and floating texts age out.
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-3 * dt);
      p.vy *= Math.exp(-3 * dt);
    }
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) t.active = false;
      else t.y -= 34 * dt;
    }

    // The wave is clear when nothing is queued and nothing hunts.
    if (!harmless && state.waveState === 'fighting' && state.spawnQueue.length === 0) {
      let alive = false;
      for (let i = 0; i < enemies.length; i += 1) if (enemies[i].active) { alive = true; break; }
      if (!alive) {
        addScore(SCORE.waveClear * state.wave);
        if (state.wave >= WAVES) {
          state.victory = true;
          state.waveState = 'done';
          events |= EVENT_WIN;
        } else {
          offerBlessings();
          events |= EVENT_WAVE_CLEAR;
        }
      }
    }

    // Dawn breaks slowly over the victory screen.
    if (state.victory && state.dawn < 1) state.dawn = Math.min(1, state.dawn + dt * 0.25);

    return events;
  }

  reset();
  return { state, reset, step, applyBlessing, stageBlessing, flareRadius, flareCooldownMax };
}
