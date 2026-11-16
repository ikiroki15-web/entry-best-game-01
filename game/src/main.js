// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is there.
// The game moves between six screens: title, play, blessing, paused, game over and victory.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|blessing|win|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld, EVENT_CHARM, EVENT_FLARE, EVENT_HIT, EVENT_KILL, EVENT_ORB,
  EVENT_OVER, EVENT_PETAL, EVENT_WAVE_CLEAR, EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_FLARE, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1,
  ACTION_PICK_2, ACTION_PICK_3, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_BLESSING, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and hits.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Gather embers, flare back the shadows, survive five nights.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.victory();
      announce(`Dawn breaks. You survived. Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.gameOver();
      announce(`The light fades. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function pickBlessing(index) {
    if (screen !== SCREEN_BLESSING) return;
    if (world.applyBlessing(index)) {
      audio.click();
      if (world.state.victory) endGame(true);
      else {
        screen = SCREEN_PLAY;
        announce(`Night ${world.state.wave}. The blessing is yours.`);
      }
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      world.state.muted = muted;
    }
    if (screen === SCREEN_BLESSING) {
      if (actions & ACTION_PICK_1) pickBlessing(0);
      else if (actions & ACTION_PICK_2) pickBlessing(1);
      else if (actions & ACTION_PICK_3) pickBlessing(2);
      else if (actions & ACTION_CONFIRM) {
        const pointer = input.pointer();
        const card = renderer.blessingCardAt(pointer.x, pointer.y);
        if (card >= 0) pickBlessing(card);
      }
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions, firstStep, wasPlaying) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const dir = input.direction();
    // A press only flares on the frame's first step, and only when the game was already in
    // play when it happened: the click that starts the game must not spend light on a flare.
    const pressed = firstStep && wasPlaying && (actions & (ACTION_FLARE | ACTION_CONFIRM)) !== 0;
    // A held pointer keeps flaring whenever the burst is ready; holding Space
    // does the same for keyboard players.
    const held = input.flareHeld() && wasPlaying;
    const events = world.step(STEP, dir, pressed || held, false);
    if (events & EVENT_ORB) audio.pickup();
    if (events & EVENT_PETAL) audio.petal();
    if (events & EVENT_FLARE) audio.flare();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_HIT) {
      audio.hit();
      announce(`Hit. Light ${Math.floor(world.state.light)}.`);
    }
    if (events & EVENT_CHARM) {
      audio.charm();
      announce('Second Dawn! The moth burns bright again.');
    }
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveClear();
      screen = SCREEN_BLESSING;
      announce(`Night ${world.state.wave} cleared. Choose a blessing.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One take of the one-shot presses per frame: handleActions reads them, and the first
    // simulation step of the frame may spend the flare press.
    const wasPlaying = screen === SCREEN_PLAY;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions, firstStep, wasPlaying);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    world.state.muted = muted;
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the night drain unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Luma, Night of the Ember Moth. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
