import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

/*
 * Battle sound, synthesized with Web Audio: no files to download, so it works offline and
 * adds nothing to the bundle but this code. Each cue is a few oscillators or a burst of
 * filtered noise shaped by a short envelope. The context starts on the first key or tap,
 * as browsers require.
 */

const SOUND_KEY = 'lanes.sound.v1';
/** Master level at full volume; cue peaks are written relative to it. */
const LOUDNESS = 2.5;
/** A band of filtered noise keeps little of its energy; this restores it. */
const NOISE_BOOST = 4;

export type Cue =
  | 'select'
  | 'swing'
  | 'shot'
  | 'spell'
  | 'hit'
  | 'crit'
  | 'miss'
  | 'guard'
  | 'heal'
  | 'buff'
  | 'fall'
  | 'just'
  | 'turn'
  | 'victory'
  | 'defeat';

interface Saved {
  on: boolean;
  volume: number;
}

function readSaved(): Saved {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(SOUND_KEY) ?? 'null') as Saved | null;
    if (raw && typeof raw.on === 'boolean' && typeof raw.volume === 'number') {
      return { on: raw.on, volume: Math.min(1, Math.max(0, raw.volume)) };
    }
  } catch {
    // Fall through to the defaults.
  }
  return { on: true, volume: 0.6 };
}

@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly document = inject(DOCUMENT);
  public readonly enabled = signal(readSaved().on);
  public readonly volume = signal(readSaved().volume);
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  constructor() {
    // Browsers only let audio start from a user gesture.
    const view = this.document.defaultView;
    const unlock = () => this.ensureContext();
    view?.addEventListener('pointerdown', unlock, { once: true, capture: true });
    view?.addEventListener('keydown', unlock, { once: true, capture: true });
  }

  public toggle(): void {
    this.enabled.update((on) => !on);
    this.save();
    if (this.enabled()) this.play('select');
  }

  public setVolume(volume: number): void {
    this.volume.set(Math.min(1, Math.max(0, volume)));
    if (this.master) this.master.gain.value = this.volume() * LOUDNESS;
    this.save();
  }

  /** Plays a cue now, or after `delayMs` (to land with a blow on the stage). */
  public play(cue: Cue, delayMs = 0): void {
    if (!this.enabled() || this.volume() === 0) return;
    const ctx = this.ensureContext();
    // A context may still be starting from the gesture that created it; it plays once running.
    if (!ctx || ctx.state === 'closed') return;
    const at = ctx.currentTime + Math.max(0, delayMs) / 1000;
    CUES[cue](this.voice(ctx, at));
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
      return this.context;
    }
    const Ctor = this.document.defaultView?.AudioContext;
    if (!Ctor) return null;
    try {
      this.context = new Ctor();
    } catch {
      return null;
    }
    this.master = this.context.createGain();
    this.master.gain.value = this.volume() * LOUDNESS;
    // Several blows can land at once; a compressor keeps them from clipping.
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 8;
    this.master.connect(limiter);
    limiter.connect(this.context.destination);
    const length = Math.floor(this.context.sampleRate * 0.5);
    this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noise.getChannelData(0);
    // Deterministic noise: a tiny LCG, so the buffer needs no Math.random.
    let seed = 12345;
    for (let i = 0; i < length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    return this.context;
  }

  /** The building blocks every cue is made of, starting at time `at`. */
  private voice(ctx: AudioContext, at: number): Voice {
    const out = this.master!;
    const envelope = (start: number, peak: number, attack: number, decay: number) => {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at + start);
      gain.gain.exponentialRampToValueAtTime(peak, at + start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + start + attack + decay);
      gain.connect(out);
      return gain;
    };
    return {
      tone: (freq, { start = 0, length = 0.2, peak = 0.3, type = 'sine', slideTo } = {}) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, at + start);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + start + length);
        osc.connect(envelope(start, peak, 0.008, length));
        osc.start(at + start);
        osc.stop(at + start + length + 0.05);
      },
      hiss: (filterFreq, { start = 0, length = 0.15, peak = 0.3, q = 1, slideTo } = {}) => {
        const source = ctx.createBufferSource();
        source.buffer = this.noise;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = q;
        filter.frequency.setValueAtTime(filterFreq, at + start);
        if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, at + start + length);
        source.connect(filter);
        filter.connect(envelope(start, peak * NOISE_BOOST, 0.005, length));
        source.start(at + start);
        source.stop(at + start + length + 0.05);
      },
    };
  }

  private save(): void {
    try {
      globalThis.localStorage?.setItem(
        SOUND_KEY,
        JSON.stringify({ on: this.enabled(), volume: this.volume() } satisfies Saved),
      );
    } catch {
      // The choice still holds for this session.
    }
  }
}

interface ToneOptions {
  start?: number;
  length?: number;
  peak?: number;
  type?: OscillatorType;
  slideTo?: number;
}

interface HissOptions {
  start?: number;
  length?: number;
  peak?: number;
  q?: number;
  slideTo?: number;
}

interface Voice {
  tone(freq: number, options?: ToneOptions): void;
  hiss(filterFreq: number, options?: HissOptions): void;
}

/** Each cue's recipe: a few tones and hisses, kept short so overlapping cues stay clear. */
const CUES: Record<Cue, (v: Voice) => void> = {
  select: (v) => v.tone(880, { length: 0.05, peak: 0.16, type: 'triangle' }),
  swing: (v) => v.hiss(900, { length: 0.18, peak: 0.25, q: 0.8, slideTo: 2600 }),
  shot: (v) => {
    v.tone(320, { length: 0.08, peak: 0.12, type: 'triangle', slideTo: 180 });
    v.hiss(3000, { length: 0.12, peak: 0.12, q: 2 });
  },
  spell: (v) => {
    v.tone(660, { length: 0.3, peak: 0.08, type: 'sine', slideTo: 1320 });
    v.tone(990, { start: 0.05, length: 0.3, peak: 0.06, type: 'sine', slideTo: 1980 });
  },
  hit: (v) => {
    v.tone(150, { length: 0.16, peak: 0.45, type: 'sine', slideTo: 60 });
    v.hiss(1200, { length: 0.09, peak: 0.35, q: 0.7 });
  },
  crit: (v) => {
    v.tone(170, { length: 0.22, peak: 0.55, type: 'sine', slideTo: 55 });
    v.hiss(1800, { length: 0.12, peak: 0.45, q: 0.7 });
    v.tone(1760, { start: 0.02, length: 0.18, peak: 0.12, type: 'triangle' });
  },
  miss: (v) => v.hiss(600, { length: 0.25, peak: 0.18, q: 0.6, slideTo: 2200 }),
  guard: (v) => {
    v.tone(1250, { length: 0.25, peak: 0.16, type: 'square' });
    v.tone(1870, { length: 0.2, peak: 0.2, type: 'triangle' });
  },
  heal: (v) => {
    for (const [i, f] of [784, 988, 1175].entries()) {
      v.tone(f, { start: i * 0.07, length: 0.3, peak: 0.12, type: 'sine' });
    }
  },
  buff: (v) => v.tone(523, { length: 0.35, peak: 0.25, type: 'triangle', slideTo: 1047 }),
  fall: (v) => {
    v.tone(110, { length: 0.5, peak: 0.4, type: 'sine', slideTo: 40 });
    v.hiss(300, { start: 0.1, length: 0.3, peak: 0.2, q: 0.5 });
  },
  just: (v) => {
    v.tone(1568, { length: 0.25, peak: 0.16, type: 'triangle' });
    v.tone(2093, { start: 0.04, length: 0.25, peak: 0.12, type: 'sine' });
  },
  turn: (v) => {
    v.tone(659, { length: 0.18, peak: 0.1, type: 'sine' });
    v.tone(988, { start: 0.08, length: 0.25, peak: 0.08, type: 'sine' });
  },
  victory: (v) => {
    for (const [i, f] of [523, 659, 784, 1047].entries()) {
      v.tone(f, { start: i * 0.12, length: i === 3 ? 0.7 : 0.2, peak: 0.16, type: 'triangle' });
    }
  },
  defeat: (v) => {
    for (const [i, f] of [392, 311, 262].entries()) {
      v.tone(f, { start: i * 0.2, length: i === 2 ? 0.8 : 0.25, peak: 0.14, type: 'sawtooth' });
    }
  },
};
