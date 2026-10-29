// Tiny WebAudio chiptune: UI blips, battle effects and looping area themes.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const TRACKS = {
  title:    { tempo: 150, notes: [60, 64, 67, 72, 67, 64, 62, 67], bass: 48, wave: 'triangle' },
  town:     { tempo: 165, notes: [67, 72, 76, 72, 74, 79, 76, 72], bass: 55, wave: 'square' },
  route:    { tempo: 150, notes: [64, 67, 71, 67, 62, 67, 72, 67], bass: 52, wave: 'square' },
  forest:   { tempo: 175, notes: [62, 65, 69, 72, 69, 65, 62, 60], bass: 50, wave: 'triangle' },
  cave:     { tempo: 190, notes: [50, 53, 57, 53, 48, 53, 58, 53], bass: 38, wave: 'triangle' },
  sanctum:  { tempo: 200, notes: [48, 51, 55, 58, 55, 51, 48, 46], bass: 36, wave: 'sine' },
  battle:   { tempo: 135, notes: [64, 64, 67, 71, 74, 71, 67, 69], bass: 52, wave: 'square' },
  victory:  { tempo: 140, notes: [72, 76, 79, 84, 79, 84, 88, 84], bass: 60, wave: 'square' },
};

const SFX = {
  select: [[660, 0.04, 'square', 0.035]],
  confirm: [[660, 0.05, 'square', 0.04], [880, 0.07, 'square', 0.04]],
  cancel: [[330, 0.06, 'square', 0.035], [220, 0.07, 'square', 0.03]],
  open: [[523, 0.04, 'triangle', 0.04], [784, 0.05, 'triangle', 0.035]],
  bump: [[140, 0.05, 'square', 0.03]],
  error: [[180, 0.08, 'sawtooth', 0.03], [140, 0.1, 'sawtooth', 0.03]],
  hit: [[200, 0.05, 'square', 0.04], [120, 0.07, 'square', 0.03]],
  superhit: [[420, 0.05, 'sawtooth', 0.045], [260, 0.08, 'square', 0.04], [130, 0.1, 'square', 0.035]],
  faint: [[400, 0.1, 'triangle', 0.04], [300, 0.1, 'triangle', 0.04], [200, 0.16, 'triangle', 0.035], [120, 0.2, 'triangle', 0.03]],
  heal: [[660, 0.06, 'sine', 0.05], [880, 0.06, 'sine', 0.05], [1100, 0.1, 'sine', 0.04]],
  level: [[523, 0.06, 'square', 0.04], [659, 0.06, 'square', 0.04], [784, 0.06, 'square', 0.04], [1047, 0.12, 'square', 0.04]],
  evolve: [[392, 0.08, 'triangle', 0.04], [523, 0.08, 'triangle', 0.04], [659, 0.08, 'triangle', 0.04], [784, 0.2, 'triangle', 0.05]],
  orb: [[520, 0.05, 'sine', 0.04], [390, 0.05, 'sine', 0.04]],
  catch: [[660, 0.06, 'square', 0.04], [880, 0.06, 'square', 0.04], [1047, 0.1, 'square', 0.04], [1319, 0.16, 'square', 0.04]],
  encounter: [[330, 0.07, 'square', 0.04], [440, 0.07, 'square', 0.04], [554, 0.1, 'square', 0.04], [659, 0.14, 'square', 0.04]],
  run: [[440, 0.05, 'square', 0.03], [330, 0.05, 'square', 0.03], [220, 0.08, 'square', 0.03]],
  status: [[300, 0.08, 'sawtooth', 0.03], [260, 0.1, 'sawtooth', 0.03]],
  stat: [[500, 0.05, 'triangle', 0.03], [700, 0.06, 'triangle', 0.03]],
  save: [[700, 0.06, 'sine', 0.04], [900, 0.08, 'sine', 0.04], [1200, 0.12, 'sine', 0.035]],
  quest: [[523, 0.08, 'square', 0.04], [659, 0.08, 'square', 0.04], [784, 0.08, 'square', 0.04], [1047, 0.18, 'square', 0.045]],
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('mythlings.muted') === '1'; } catch (e) { /* ignore */ }
    this.track = null;
    this.timer = null;
    this.step = 0;
    this.musicGain = null;
    this.sfxGain = null;
  }

  ensure() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem('mythlings.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.musicGain) this.musicGain.gain.value = muted ? 0 : 0.22;
    if (this.sfxGain) this.sfxGain.gain.value = muted ? 0 : 0.5;
  }

  toggleMuted() { this.setMuted(!this.muted); return this.muted; }

  tone(freq, dur, type = 'square', vol = 0.04, when = 0, dest = null) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur));
    osc.connect(gain);
    gain.connect(dest || this.sfxGain || ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  sfx(name) {
    const notes = SFX[name];
    if (!notes) return;
    let when = 0;
    for (const [freq, dur, type, vol] of notes) {
      this.tone(freq, dur, type, vol * 1.6, when);
      when += dur * 0.8;
    }
  }

  playMusic(trackName) {
    const track = TRACKS[trackName];
    if (!track) return;
    if (this.track === trackName && this.timer) return;
    this.stopMusic();
    this.track = trackName;
    this.step = 0;
    const interval = 60000 / (track.tempo * 2);
    this.timer = setInterval(() => this.tick(track), interval);
    this.tick(track);
  }

  tick(track) {
    if (this.muted) return;
    const idx = this.step % track.notes.length;
    const n = track.notes[idx];
    const vol = this.track === 'battle' ? 0.05 : 0.035;
    this.tone(NOTE(n), 0.16, track.wave, vol, 0, this.musicGain);
    if (this.step % 4 === 0) {
      this.tone(NOTE(track.bass), 0.3, 'triangle', 0.045, 0, this.musicGain);
      this.tone(NOTE(track.bass + 7), 0.24, 'triangle', 0.03, 0.14, this.musicGain);
    }
    this.step++;
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }
}

export const audio = new AudioEngine();
