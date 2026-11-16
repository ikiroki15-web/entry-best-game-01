// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. The night garden is drawn from the world's fixed decor (stars, grass, flowers),
// the moth glows against the dark, and the darker the moth's light the darker the edges of
// the screen grow. All animation reads the world's own time, never the wall clock, so a
// staged scene always paints the same frame.

import { BLESSINGS, FIELD, FLARE, FONT, LIGHT, PALETTE, WAVES } from './config.js';
import { KIND_BRUTE, KIND_DART, KIND_EMBER, KIND_PETAL, KIND_WISP } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BLESSING = 'blessing';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CARD = { width: 300, height: 210, gap: 24, top: 296 };
const BLESSING_ICON = { swift: '»', wide: '◎', heart: '♥', magnet: '◉', quick: '↯', thorns: '✷', charm: '☀', greed: '◆' };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const waveLabel = cachedLabel('Night ');
  const shadowsLabel = cachedLabel('Shadows ');
  const lightLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.dpr = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function font(size, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, weight) {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGarden(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    for (const star of state.stars) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(state.time * 1.4 + star.phase));
      context.globalAlpha = twinkle;
      context.fillStyle = '#dfe6ff';
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.globalAlpha = 1;

    // The garden floor: soft grass and night flowers the moth flies over.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 96, FIELD.width, FIELD.height - 96);
    for (const tuft of state.tufts) {
      context.strokeStyle = PALETTE.grassTuft;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(tuft.x - 5 * tuft.s, tuft.y);
      context.lineTo(tuft.x - 7 * tuft.s, tuft.y - 12 * tuft.s);
      context.moveTo(tuft.x, tuft.y);
      context.lineTo(tuft.x, tuft.y - 15 * tuft.s);
      context.moveTo(tuft.x + 5 * tuft.s, tuft.y);
      context.lineTo(tuft.x + 7 * tuft.s, tuft.y - 12 * tuft.s);
      context.stroke();
    }
    for (const flower of state.flowers) {
      const glow = 0.5 + 0.5 * Math.sin(state.time * 2 + flower.phase);
      context.globalAlpha = 0.55 + 0.35 * glow;
      context.fillStyle = flower.hue > 0.5 ? '#7a5fd0' : '#4f7fd0';
      context.beginPath();
      context.arc(flower.x, flower.y, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.arc(flower.x, flower.y, 1.8, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawOrbs(state) {
    for (const orb of state.orbs) {
      if (!orb.active) continue;
      const bobY = orb.y + Math.sin(orb.bob) * 3;
      const isPetal = orb.kind === KIND_PETAL;
      const color = isPetal ? PALETTE.petal : PALETTE.ember;
      const halo = context.createRadialGradient(orb.x, bobY, 1, orb.x, bobY, orb.radius * 3.2);
      halo.addColorStop(0, color);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      context.globalAlpha = 0.5;
      context.fillStyle = halo;
      context.beginPath();
      context.arc(orb.x, bobY, orb.radius * 3.2, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = color;
      context.beginPath();
      context.arc(orb.x, bobY, orb.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff8e0';
      context.beginPath();
      context.arc(orb.x - 2, bobY - 2, orb.radius * 0.35, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!e.active) continue;
      const flash = e.flash > 0;
      const body = flash ? '#ffffff' : PALETTE.shadow;
      if (e.kind === KIND_WISP) {
        const wob = 1 + 0.08 * Math.sin(state.time * 6 + e.wobble);
        context.fillStyle = body;
        context.beginPath();
        context.arc(e.x, e.y, e.radius * wob, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = PALETTE.shadowRim;
        context.lineWidth = 2.5;
        context.stroke();
        context.fillStyle = PALETTE.eye;
        context.beginPath();
        context.arc(e.x - 5, e.y - 2, 2.6, 0, Math.PI * 2);
        context.arc(e.x + 5, e.y - 2, 2.6, 0, Math.PI * 2);
        context.fill();
      } else if (e.kind === KIND_DART) {
        const winding = e.state === 1;
        const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);
        context.save();
        context.translate(e.x, e.y);
        context.rotate(angle);
        context.fillStyle = winding ? '#ff8fa8' : body;
        context.beginPath();
        context.moveTo(18, 0);
        context.lineTo(-10, -11);
        context.lineTo(-16, 0);
        context.lineTo(-10, 11);
        context.closePath();
        context.fill();
        context.strokeStyle = PALETTE.shadowRim;
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = PALETTE.eye;
        context.beginPath();
        context.arc(6, 0, 3, 0, Math.PI * 2);
        context.fill();
        context.restore();
        if (winding) {
          context.globalAlpha = 0.35 + 0.3 * Math.sin(state.time * 24);
          context.strokeStyle = '#ff5d7a';
          context.lineWidth = 2;
          context.beginPath();
          context.arc(e.x, e.y, e.radius + 8, 0, Math.PI * 2);
          context.stroke();
          context.globalAlpha = 1;
        }
      } else {
        // Brute: a big spiked shadow with a health bar.
        context.fillStyle = body;
        context.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + state.time * 0.4;
          const r = i % 2 === 0 ? e.radius + 7 : e.radius - 2;
          const px = e.x + Math.cos(a) * r;
          const py = e.y + Math.sin(a) * r;
          if (i === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
        context.strokeStyle = PALETTE.shadowRim;
        context.lineWidth = 3;
        context.stroke();
        context.fillStyle = PALETTE.eye;
        context.beginPath();
        context.arc(e.x - 8, e.y - 4, 3.4, 0, Math.PI * 2);
        context.arc(e.x + 8, e.y - 4, 3.4, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#3a2a55';
        context.fillRect(e.x - 20, e.y - e.radius - 14, 40, 5);
        context.fillStyle = PALETTE.danger;
        context.fillRect(e.x - 20, e.y - e.radius - 14, 40 * (e.hp / e.maxHp), 5);
      }
    }
  }

  function drawMoth(state) {
    const p = state.player;
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
    // Warm glow that shrinks as the moth's light runs low.
    const glowR = 70 + (state.light / state.maxLight) * 90;
    const glow = context.createRadialGradient(p.x, p.y, 4, p.x, p.y, glowR);
    glow.addColorStop(0, 'rgba(255, 214, 106, 0.5)');
    glow.addColorStop(1, 'rgba(255, 214, 106, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(p.x, p.y, glowR, 0, Math.PI * 2);
    context.fill();
    if (blink) return;
    const flap = Math.sin(p.flap);
    const tilt = Math.max(-0.35, Math.min(0.35, p.vx * 0.0009));
    context.save();
    context.translate(p.x, p.y);
    context.rotate(tilt);
    // Wings: two ellipses that flap, upper pair bright, lower pair dimmer.
    for (const side of [-1, 1]) {
      context.save();
      context.scale(side, 1);
      context.fillStyle = PALETTE.mothWing;
      context.beginPath();
      context.ellipse(13, -6 - flap * 3, 15, 9 - flap * 3.5, -0.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e8a94c';
      context.beginPath();
      context.ellipse(12, 8 + flap * 2, 11, 6 - flap * 2, 0.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Body and antennae.
    context.fillStyle = '#5a3a1a';
    context.beginPath();
    context.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#5a3a1a';
    context.lineWidth = 1.6;
    context.beginPath();
    context.moveTo(-2, -10);
    context.quadraticCurveTo(-7, -18, -10, -20);
    context.moveTo(2, -10);
    context.quadraticCurveTo(7, -18, 10, -20);
    context.stroke();
    context.fillStyle = '#2a1a08';
    context.beginPath();
    context.arc(-2, -3, 1.4, 0, Math.PI * 2);
    context.arc(2, -3, 1.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawParticles(state) {
    context.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  function drawTexts(state) {
    context.textBaseline = 'alphabetic';
    for (const t of state.texts) {
      if (!t.active) continue;
      context.globalAlpha = Math.max(0, t.life / t.maxLife);
      text(t.text, t.x, t.y, t.size, t.color, 'center', '700');
    }
    context.globalAlpha = 1;
  }

  function drawFlareRing(state) {
    if (state.flareRing <= 0) return;
    const radius = state.flareRadius * (1.2 - state.flareRing * 0.2);
    context.globalAlpha = state.flareRing;
    context.strokeStyle = '#ffe9a8';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(state.player.x, state.player.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = state.flareRing * 0.5;
    context.strokeStyle = '#ffb347';
    context.lineWidth = 10;
    context.beginPath();
    context.arc(state.player.x, state.player.y, radius * 0.85, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawVignette(state) {
    const lightFrac = state.light / state.maxLight;
    const dark = 0.25 + (1 - lightFrac) * 0.5;
    const gradient = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.32,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    gradient.addColorStop(0, 'rgba(4, 6, 16, 0)');
    gradient.addColorStop(1, `rgba(4, 6, 16, ${dark})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    if (state.dawn > 0) {
      const dawn = context.createLinearGradient(0, 0, 0, FIELD.height);
      dawn.addColorStop(0, `rgba(255, 196, 110, ${0.5 * state.dawn})`);
      dawn.addColorStop(1, `rgba(255, 140, 90, ${0.25 * state.dawn})`);
      context.fillStyle = dawn;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawHud(state, muted) {
    context.textBaseline = 'top';
    // Light bar, top left: the moth's life, in gold.
    text('LIGHT', 24, 18, 15, PALETTE.muted, 'left', '700');
    const barX = 24;
    const barY = 40;
    const barW = 250;
    context.fillStyle = '#0a0e22';
    roundRect(barX, barY, barW, 18, 9);
    context.fill();
    const frac = Math.max(0, state.light / state.maxLight);
    context.fillStyle = frac < 0.25 ? PALETTE.danger : PALETTE.gold;
    if (frac > 0) {
      roundRect(barX, barY, barW * frac, 18, 9);
      context.fill();
    }
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1.5;
    roundRect(barX, barY, barW, 18, 9);
    context.stroke();
    text(lightLabel(`${Math.floor(state.light)} / ${state.maxLight}`), barX + barW + 10, 40, 18, PALETTE.text, 'left', '700');
    // Wave and shadows, top centre.
    text(waveLabel(`${state.wave} / ${WAVES}`), FIELD.width / 2, 18, 26, PALETTE.text, 'center', '700');
    let shadows = state.spawnQueue.length;
    for (const e of state.enemies) if (e.active) shadows += 1;
    text(shadowsLabel(shadows), FIELD.width / 2, 48, 16, PALETTE.muted, 'center');
    // Score and best, top right.
    text(scoreLabel(state.score), FIELD.width - 24, 18, 26, PALETTE.text, 'right', '700');
    text(`Best ${state.best ?? 0}`, FIELD.width - 24, 48, 16, PALETTE.muted, 'right');
    // Flare cooldown, bottom left.
    text('FLARE  ·  Space / Click', 24, FIELD.height - 52, 15, PALETTE.muted, 'left', '700');
    const cdMax = FLARE.cooldown * (1 - FLARE.cooldownPerBlessing * (state.blessings.quick ?? 0));
    const cdFrac = 1 - state.flareCooldown / cdMax;
    context.fillStyle = '#0a0e22';
    roundRect(24, FIELD.height - 30, 160, 10, 5);
    context.fill();
    context.fillStyle = state.flareCooldown === 0 ? PALETTE.mothWing : '#5a6a9a';
    if (cdFrac > 0) {
      roundRect(24, FIELD.height - 30, 160 * Math.max(0, cdFrac), 10, 5);
      context.fill();
    }
    // Blessings owned, bottom right, as letter chips.
    let chipX = FIELD.width - 24;
    for (const blessing of BLESSINGS) {
      const stacks = state.blessings[blessing.id] ?? 0;
      if (stacks === 0) continue;
      chipX -= 34;
      context.fillStyle = PALETTE.card;
      context.beginPath();
      context.arc(chipX + 14, FIELD.height - 34, 14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.cardEdge;
      context.lineWidth = 1.5;
      context.stroke();
      text(BLESSING_ICON[blessing.id], chipX + 14, FIELD.height - 44, 16, PALETTE.gold, 'center', '700');
      if (stacks > 1) text(`x${stacks}`, chipX + 14, FIELD.height - 16, 11, PALETTE.muted, 'center');
    }
    if (muted) text('Muted (M)', FIELD.width - 24, FIELD.height - 66, 14, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, titleSize) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(x, y, width, height, 16);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 74, titleSize || 46, PALETTE.text, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 128 + i * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.gold, 'center', '700');
  }

  function blessingCards(state) {
    const total = CARD.width * 3 + CARD.gap * 2;
    const x0 = (FIELD.width - total) / 2;
    return state.offered.map((blessing, i) => ({
      blessing,
      x: x0 + i * (CARD.width + CARD.gap),
      y: CARD.top,
      width: CARD.width,
      height: CARD.height,
    }));
  }

  function drawBlessing(state) {
    context.fillStyle = 'rgba(4, 6, 16, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textBaseline = 'alphabetic';
    text('Night cleared — choose a blessing', FIELD.width / 2, 150, 40, PALETTE.text, 'center', '800');
    text(`Wave ${state.wave} of ${WAVES} done  ·  Score ${state.score}`, FIELD.width / 2, 196, 20, PALETTE.muted, 'center');
    for (const card of blessingCards(state)) {
      const b = card.blessing;
      const owned = state.blessings[b.id] ?? 0;
      context.fillStyle = PALETTE.card;
      roundRect(card.x, card.y, card.width, card.height, 14);
      context.fill();
      context.strokeStyle = PALETTE.cardEdge;
      context.lineWidth = 2;
      roundRect(card.x, card.y, card.width, card.height, 14);
      context.stroke();
      text(BLESSING_ICON[b.id], card.x + card.width / 2, card.y + 74, 44, PALETTE.gold, 'center');
      text(b.name, card.x + card.width / 2, card.y + 122, 24, PALETTE.text, 'center', '700');
      text(b.desc, card.x + card.width / 2, card.y + 156, 18, PALETTE.muted, 'center');
      text(owned > 0 ? `Owned x${owned}` : 'Press 1, 2 or 3 — or click', card.x + card.width / 2, card.y + card.height - 22, 16, PALETTE.gold, 'center');
    }
  }

  /** Map a pointer position in CSS pixels to a blessing card index, or -1. */
  function blessingCardAt(cssX, cssY) {
    const lx = (cssX * view.dpr - view.x) / view.scale;
    const ly = (cssY * view.dpr - view.y) / view.scale;
    const cards = blessingCards({ offered: [{}, {}, {}], blessings: {}, wave: 1, score: 0 });
    for (let i = 0; i < cards.length; i += 1) {
      const c = cards[i];
      if (lx >= c.x && lx <= c.x + c.width && ly >= c.y && ly <= c.y + c.height) return i;
    }
    return -1;
  }

  /** Paint one frame: the garden, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? Math.sin(state.time * 91.7) * state.shake : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.time * 113.3) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawGarden(state);
    drawOrbs(state);
    drawEnemies(state);
    drawMoth(state);
    drawParticles(state);
    drawFlareRing(state);
    drawTexts(state);
    drawVignette(state);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(4, 6, 16, 0.45)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.textBaseline = 'alphabetic';
      text('LUMA', FIELD.width / 2, 250, 110, PALETTE.mothWing, 'center', '800');
      text('Night of the Ember Moth', FIELD.width / 2, 300, 30, PALETTE.text, 'center');
      text('Your light is your life. Gather embers, flare back the shadows,', FIELD.width / 2, 372, 20, PALETTE.muted, 'center');
      text('and hold the garden until dawn breaks after Night 5.', FIELD.width / 2, 402, 20, PALETTE.muted, 'center');
      text('Fly with WASD or Arrow keys  ·  Space or Click to flare  ·  P to pause  ·  M to mute', FIELD.width / 2, 452, 19, PALETTE.text, 'center');
      if (best > 0) text(`Best score ${best}`, FIELD.width / 2, 500, 20, PALETTE.gold, 'center', '700');
      const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
      context.globalAlpha = pulse;
      text('Press Space or click to begin', FIELD.width / 2, 566, 26, PALETTE.gold, 'center', '700');
      context.globalAlpha = 1;
      return;
    }
    state.best = best;
    drawHud(state, state.muted);
    if (screen === SCREEN_BLESSING) drawBlessing(state);
    else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The shadows wait for you.'], 'Press P to keep flying');
    } else if (screen === SCREEN_OVER) {
      drawPanel('The Light Fades', [`Score ${state.score}`, `Best ${best}`, `Reached Night ${state.wave}  ·  ${state.kills} shadows scattered`], 'Press Space or click to fly again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('Dawn Breaks', [`Score ${state.score}`, `Best ${best}`, `All ${WAVES} nights survived`, `${state.kills} shadows scattered  ·  ${state.orbsCollected} orbs gathered, ${state.petalsCollected ?? 0} moonpetals`], 'Press Space or click to fly again');
    } else if (screen === SCREEN_PLAY && state.time < 6 && state.wave === 1) {
      text('Gather the glowing embers — your light is draining', FIELD.width / 2, 120, 20, PALETTE.text, 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, blessingCardAt };
}
