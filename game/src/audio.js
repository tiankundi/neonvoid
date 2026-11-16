// Sound from oscillators alone: every effect is a short shaped blip and the music is a
// slow minor-key pulse sequenced under the fight. Nothing loads, so the game stays silent
// until the player's first click or key press opens the audio context, as browsers require.

const MUSIC = {
  stepSeconds: 0.21,
  // A minor: a low root pulse with a sparse lead line over it, two bars of sixteen steps.
  bass: [55, 0, 0, 55, 0, 0, 65.41, 0, 49, 0, 0, 49, 0, 0, 73.42, 0],
  lead: [220, 0, 261.63, 0, 329.63, 0, 261.63, 0, 196, 0, 246.94, 0, 293.66, 0, 0, 0],
};

/** Create the sound kit: play(name) for effects, setPlaying(bool) for the music, toggleMute(). */
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function open() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, { type = 'square', gain = 0.12, slideTo = 0, delay = 0 } = {}) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + seconds);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  const EFFECTS = {
    shoot() { tone(880 + Math.random() * 120, 0.07, { type: 'square', gain: 0.035, slideTo: 320 }); },
    hit() { tone(220, 0.05, { type: 'sawtooth', gain: 0.05, slideTo: 140 }); },
    explode() {
      tone(160, 0.22, { type: 'sawtooth', gain: 0.12, slideTo: 40 });
      tone(90, 0.3, { type: 'triangle', gain: 0.14, slideTo: 30 });
    },
    pickup() { tone(1240, 0.06, { type: 'sine', gain: 0.06, slideTo: 1860 }); },
    levelup() {
      tone(523.25, 0.12, { type: 'triangle', gain: 0.12 });
      tone(659.25, 0.12, { type: 'triangle', gain: 0.12, delay: 0.09 });
      tone(783.99, 0.2, { type: 'triangle', gain: 0.12, delay: 0.18 });
    },
    hurt() { tone(140, 0.18, { type: 'sawtooth', gain: 0.16, slideTo: 70 }); },
    dash() { tone(300, 0.14, { type: 'sine', gain: 0.08, slideTo: 900 }); },
    click() { tone(660, 0.06, { type: 'sine', gain: 0.09 }); },
    warn() {
      tone(196, 0.25, { type: 'sawtooth', gain: 0.14 });
      tone(196, 0.25, { type: 'sawtooth', gain: 0.14, delay: 0.32 });
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.12, delay: i * 0.13 }));
    },
  };

  function musicTick() {
    if (!context || muted) return;
    const bass = MUSIC.bass[musicStep % 16];
    const lead = MUSIC.lead[musicStep % 16];
    if (bass) tone(bass, 0.2, { type: 'triangle', gain: 0.11 });
    if (lead) tone(lead, 0.16, { type: 'sine', gain: 0.045 });
    musicStep += 1;
  }

  return {
    unlock() {
      open();
    },
    play(name) {
      if (!open()) return;
      const effect = EFFECTS[name];
      if (effect) effect();
    },
    setPlaying(playing) {
      if (playing && !musicTimer) {
        if (!open()) return;
        musicStep = 0;
        musicTimer = window.setInterval(musicTick, MUSIC.stepSeconds * 1000);
      } else if (!playing && musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
