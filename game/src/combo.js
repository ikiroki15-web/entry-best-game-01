// The kill combo: chained kills inside a short window raise the score multiplier,
// and taking a hit breaks the chain. Pure logic, no drawing and no browser in it —
// the world owns one combo object and calls these helpers on kills, hits and steps.

import { COMBO } from './config.js';

/** A fresh combo: no chain, no time left on it, no best chain yet. */
export function createCombo() {
  return { count: 0, timer: 0, best: 0 };
}

/** The score multiplier a chain of `count` kills earns: +0.5 every 4 kills, to x4. */
export function comboMultiplier(count) {
  const steps = Math.floor(count / COMBO.killsPerStep);
  return Math.min(1 + steps * COMBO.perStep, COMBO.maxMult);
}

/** One more kill in the chain: the count grows and the window restarts. */
export function comboRegisterKill(combo) {
  combo.count += 1;
  combo.timer = COMBO.window;
  if (combo.count > combo.best) combo.best = combo.count;
}

/** A hit breaks the chain outright. */
export function comboBreak(combo) {
  combo.count = 0;
  combo.timer = 0;
}

/** Let the window run down; an expired window ends the chain. */
export function comboTick(combo, dt) {
  if (combo.timer > 0) {
    combo.timer = Math.max(0, combo.timer - dt);
    if (combo.timer === 0) combo.count = 0;
  }
}
