// All sound is synthesised with WebAudio: short oscillator and noise envelopes, no audio
// files, so the game stays silent on disk and quiet until the player starts it (browsers
// only allow audio after a gesture). A soft two-voice pad hums under everything once started.

export function createAudio() {
  let context = null;
  let master = null;
  let pad = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    if (!context || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  function startPad() {
    if (!context || pad) return;
    pad = context.createGain();
    pad.gain.value = 0.05;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.connect(pad);
    pad.connect(master);
    for (const [freq, detune] of [[110, -4], [164.81, 5], [220, -2]]) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
    }
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(pad.gain);
    lfo.start();
  }

  return {
    /** Call from the start gesture: unlocks audio and starts the night pad. */
    unlock() {
      if (ensure()) startPad();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.22, 990);
    },
    petal() {
      tone(523, 0.1, 'sine', 0.2, 784);
      setTimeout(() => tone(784, 0.16, 'sine', 0.2, 1046), 70);
    },
    flare() {
      noise(0.28, 0.3, 2400);
      tone(220, 0.25, 'triangle', 0.18, 880);
    },
    shoot() {
      tone(520, 0.12, 'square', 0.08, 180);
    },
    roar() {
      tone(70, 0.7, 'sawtooth', 0.3, 45);
      noise(0.5, 0.18, 300);
    },
    kill() {
      noise(0.14, 0.22, 1400);
      tone(320, 0.14, 'square', 0.1, 90);
    },
    hit() {
      tone(140, 0.3, 'sawtooth', 0.28, 55);
      noise(0.2, 0.2, 500);
    },
    waveClear() {
      [523, 659, 784].forEach((freq, i) => setTimeout(() => tone(freq, 0.22, 'sine', 0.22), i * 90));
    },
    charm() {
      [392, 523, 659, 784, 1046].forEach((freq, i) => setTimeout(() => tone(freq, 0.3, 'sine', 0.2), i * 80));
    },
    victory() {
      [523, 659, 784, 1046, 1318].forEach((freq, i) => setTimeout(() => tone(freq, 0.4, 'sine', 0.22), i * 120));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((freq, i) => setTimeout(() => tone(freq, 0.4, 'triangle', 0.2), i * 160));
    },
    click() {
      tone(880, 0.06, 'sine', 0.14, 660);
    },
  };
}
