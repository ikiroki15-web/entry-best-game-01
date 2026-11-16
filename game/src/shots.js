// The screenshot scenes behind ?shot=start|play|blessing|win|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (chase the nearest ember, keep clear of shadows, flare when they crowd in), so the frame is
// what a short game really looks like and the same seed always gives the same frame. The win
// scene flies all five nights with a steadier pilot; if it falls short of the dawn, the world
// is set to its victory state and the dawn is painted over the real field, so the shot still
// shows the game's own victory screen.

import { FIELD, FLARE, STEP } from './config.js';
import { EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { SCREEN_BLESSING, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 15;
const SCENE_LIMIT_SECONDS = 420;

/** Steer toward the nearest ember, pushed away from shadows that get too close. When its
 *  light is healthy it dives at the nearest shadow instead, to flare it at close range. */
function autopilot(state, brave) {
  const player = state.player;
  let orb = null;
  let orbD = Infinity;
  for (const o of state.orbs) {
    if (!o.active) continue;
    const d = (o.x - player.x) ** 2 + (o.y - player.y) ** 2;
    if (d < orbD) {
      orbD = d;
      orb = o;
    }
  }
  let target = null;
  let targetD = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < targetD) {
      targetD = d;
      target = e;
    }
  }
  let mx = 0;
  let my = 0;
  const hunting = target !== null && state.light > (brave ? 25 : 35) && targetD < (brave ? 380 : 320);
  if (hunting) {
    mx += (target.x - player.x) / targetD;
    my += (target.y - player.y) / targetD;
  } else if (orb) {
    mx += (orb.x - player.x) / Math.max(1, Math.sqrt(orbD));
    my += (orb.y - player.y) / Math.max(1, Math.sqrt(orbD));
  }
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = hunting ? 90 : 170;
    if (d < range) {
      const push = (range - d) / range;
      mx += (dx / d) * push * 2.2;
      my += (dy / d) * push * 2.2;
    }
  }
  // Stay inside the garden's edges.
  if (player.x < 90) mx += 1;
  if (player.x > FIELD.width - 90) mx -= 1;
  if (player.y < 90) my += 1;
  if (player.y > FIELD.height - 90) my -= 1;
  const len = Math.hypot(mx, my) || 1;
  const dir = { x: mx / len, y: my / len };
  let flare = false;
  if (state.flareCooldown === 0 && state.light > 30) {
    let near = 0;
    for (const e of state.enemies) {
      if (!e.active) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) < FLARE.radius * 0.9) near += 1;
    }
    flare = near >= 1;
  }
  return { dir, flare };
}

/** Run the world forward with the autopilot until `stop` says so, at most `limit` seconds. */
function fly(world, limit, stop, brave) {
  const steps = Math.floor(limit / STEP);
  for (let i = 0; i < steps; i += 1) {
    const { dir, flare } = autopilot(world.state, brave);
    const events = world.step(STEP, dir, flare, false);
    if (world.state.over) return events;
    if (stop(events)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, blessing, win or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'blessing' && name !== 'win' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    fly(world, PLAY_SECONDS, () => false, false);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    // A passive moth that never flares: the dark takes it quickly.
    for (let i = 0; i < SCENE_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, { x: 0, y: 0 }, false, false);
      if (events & EVENT_OVER) break;
    }
    if (!world.state.over) {
      world.state.light = 0;
      world.state.over = true;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  if (name === 'blessing') {
    fly(world, SCENE_LIMIT_SECONDS, (events) => (events & EVENT_WAVE_CLEAR) !== 0, false);
    if (world.state.waveState !== 'blessing') {
      // The pilot could not clear the night: stage the choice over a cleared field.
      world.stageBlessing();
    }
    return { screen: SCREEN_BLESSING, best: world.state.score };
  }
  // win: fly all five nights with a brave pilot, taking a blessing after each clear:
  // Bright Heart when the moth is hurt, else the first offered. A night that ends in
  // darkness is flown again from a fresh reset, up to three times, before the victory is
  // staged over the field: the shot then still shows the game's own victory screen.
  let won = false;
  for (let attempt = 0; attempt < 3 && !won; attempt += 1) {
    if (attempt > 0) world.reset();
    for (let i = 0; i < 5; i += 1) {
      fly(world, SCENE_LIMIT_SECONDS, (events) => (events & (EVENT_WIN | EVENT_WAVE_CLEAR)) !== 0, true);
      if (world.state.victory || world.state.over) break;
      if (world.state.waveState === 'blessing') {
        let pick = 0;
        if (world.state.light < 60) {
          const heart = world.state.offered.findIndex((b) => b.id === 'heart');
          if (heart >= 0) pick = heart;
        }
        world.applyBlessing(pick);
      } else break;
    }
    won = world.state.victory;
  }
  if (won) {
    // Let the dawn break over the field before the frame is painted.
    for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, false);
  }
  if (!won) {
    for (const e of world.state.enemies) e.active = false;
    world.state.spawnQueue = [];
    world.state.victory = true;
    world.state.waveState = 'done';
    world.state.wave = 5;
    world.state.dawn = 1;
    world.state.score = Math.max(world.state.score, 1250);
  }
  return { screen: SCREEN_WIN, best: world.state.score };
}
