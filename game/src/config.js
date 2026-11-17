// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// LUMA is a night-garden arena: an ember moth gathers light to survive the dark. Light is
// health, score and the night itself: it drains as the night deepens, embers refill it, and
// shadows that touch the moth drink it away.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Five waves, one per hour of the night; clearing the fifth brings the dawn and the win. */
export const WAVES = 5;

export const PLAYER = {
  radius: 15,
  speed: 330,
  accel: 2600,
  invulnerable: 0.9,
};

export const LIGHT = {
  max: 100,
  /** Light lost per second, before the wave's deepening. */
  drain: 0.8,
  /** Extra drain per wave above the first. */
  drainPerWave: 0.12,
  /** Light lost when a shadow touches the moth. */
  hitLoss: 10,
  /** Light a flare burst costs. */
  flareCost: 5,
  /** Light a scattered shadow gives back: a good flare pays for itself. */
  killRefund: 4,
  /** Light the Second Dawn blessing restores when it saves the moth. */
  charmRestore: 50,
};

/** A night may not be stalled forever: after its time the dark deepens. */
export const NIGHT = {
  /** Seconds a night may last before the dark deepens: base plus per shadow. */
  baseTime: 75,
  perShadow: 3,
  /** Light drain multiplier once the dark has deepened. */
  deepenDrainMult: 3,
};

export const FLARE = {
  radius: 150,
  radiusPerBlessing: 0.25,
  cooldown: 1.15,
  cooldownPerBlessing: 0.25,
  damage: 1,
  knockback: 520,
};

export const EMBER = {
  radius: 9,
  light: 12,
  score: 5,
  /** Seconds between ambient embers drifting in. */
  interval: 1.8,
  maxAmbient: 8,
  magnetRadius: 230,
  magnetSpeed: 260,
};

export const MOONPETAL = {
  radius: 13,
  light: 30,
  score: 25,
};

export const ENEMY = {
  wisp: { hp: 1, speed: 96, radius: 14, score: 10, orbs: 1 },
  dart: { hp: 1, speed: 78, radius: 13, score: 20, orbs: 1, lungeSpeed: 430, lungeRange: 270, windup: 0.55, lungeTime: 0.34, recover: 0.6 },
  brute: { hp: 4, speed: 56, radius: 27, score: 40, orbs: 2, petals: 1 },
  /** Spitter: keeps its distance and fires shadow bolts the moth must dodge. */
  spitter: { hp: 2, speed: 72, radius: 14, score: 30, orbs: 1, shotInterval: 2.8, shotRange: 430, windup: 0.5 },
  /** The Night Warden: Night 5's boss — slow, huge, summons wisps and bursts bolts. */
  warden: { hp: 14, speed: 44, radius: 46, score: 500, orbs: 0, petals: 3 },
};

/** Shadow bolts: what spitters and the Warden fire. */
export const BOLT = {
  speed: 230,
  radius: 7,
  /** Light lost when a bolt hits the moth. */
  hitLoss: 6,
};

/** Combo: kills chained within the window raise the score multiplier. */
export const COMBO = {
  /** Seconds a combo survives without another kill. */
  window: 3,
  /** Kills per multiplier step, and the score gained per step. */
  killsPerStep: 4,
  perStep: 0.5,
  maxMult: 4,
};

/** Waves: how many of each shadow marches in, and how fast they arrive. */
export const WAVE_DEFS = [
  { wisp: 10, dart: 0, brute: 0, spitter: 0, warden: 0, interval: 1.05 },
  { wisp: 12, dart: 4, brute: 0, spitter: 2, warden: 0, interval: 0.95 },
  { wisp: 14, dart: 7, brute: 1, spitter: 3, warden: 0, interval: 0.85 },
  { wisp: 16, dart: 8, brute: 2, spitter: 4, warden: 0, interval: 0.8 },
  { wisp: 14, dart: 10, brute: 3, spitter: 4, warden: 1, interval: 0.7 },
];

export const SCORE = {
  waveClear: 50,
};

/** How many of each thing can exist at once; pools are allocated once, at boot. */
export const POOL = { enemies: 48, orbs: 48, particles: 240, texts: 28, bolts: 40 };

/** Blessings offered between waves. id, name, one-line promise, max stacks. */
export const BLESSINGS = [
  { id: 'swift', name: 'Swift Wings', desc: '+12% flight speed', max: 3 },
  { id: 'wide', name: 'Wide Glow', desc: '+25% flare radius', max: 3 },
  { id: 'heart', name: 'Bright Heart', desc: '+25 max light, refill 25', max: 3 },
  { id: 'magnet', name: 'Ember Magnet', desc: 'Embers drift to you', max: 2 },
  { id: 'quick', name: 'Quick Flare', desc: 'Flare recharges 25% faster', max: 3 },
  { id: 'thorns', name: 'Thorn Light', desc: 'Shadows that catch you burn', max: 2 },
  { id: 'charm', name: 'Second Dawn', desc: 'Once: survive death at 50 light', max: 1 },
  { id: 'greed', name: 'Greedy Glow', desc: '+50% score from everything', max: 2 },
];

export const PALETTE = {
  backdrop: '#070a18',
  skyTop: '#0b1030',
  skyBottom: '#141a3d',
  grass: '#101d2e',
  grassTuft: '#1a2f45',
  flower: '#3b2a55',
  text: '#f4ead8',
  muted: '#9aa3c7',
  gold: '#f2c94c',
  ember: '#ffb347',
  petal: '#c9b8ff',
  moth: '#ffe9a8',
  mothWing: '#ffd76a',
  shadow: '#241a3a',
  shadowRim: '#6b4fa8',
  eye: '#ff5d7a',
  panel: '#141a33',
  panelEdge: '#3a4470',
  card: '#1b2347',
  cardEdge: '#4d5da0',
  danger: '#ff5d7a',
  heal: '#7fe0a8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'luma-ember-moth.best';
