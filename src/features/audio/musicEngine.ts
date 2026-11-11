import { sounds } from './soundEngine';

export type MusicTrackId = 'landing' | 'connecting' | 'war_room' | 'combat' | 'victory';

export interface MusicTrackMeta {
  id: MusicTrackId;
  title: string;
  subtitle: string;
  bpm: number;
}

export const MUSIC_TRACKS: Record<MusicTrackId, MusicTrackMeta> = {
  landing: {
    id: 'landing',
    title: 'Orbital Hangar',
    subtitle: 'Ambient synthwave pads & cosmic chimes',
    bpm: 92,
  },
  connecting: {
    id: 'connecting',
    title: 'Frequency Lock',
    subtitle: 'Sonar telemetry pings & uplink pulse',
    bpm: 110,
  },
  war_room: {
    id: 'war_room',
    title: 'Tactical Briefing',
    subtitle: 'Driving mid-tempo staging groove',
    bpm: 118,
  },
  combat: {
    id: 'combat',
    title: 'Omega Skirmish',
    subtitle: 'High-octane 136 BPM arena pulse',
    bpm: 136,
  },
  victory: {
    id: 'victory',
    title: 'Extraction Fanfare',
    subtitle: 'Uplifting post-match resolution chords',
    bpm: 98,
  },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface MusicSettingsPayload {
  enabled?: boolean;
  musicVolume?: number; // 0..100
  masterVolume?: number; // 0..100
  muted?: boolean;
}

class MusicEngine {
  private musicMasterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private enabled: boolean = true;
  private musicVolume: number = 0.55;
  private masterVolume: number = 0.8;
  private muted: boolean = false;

  private desiredTrack: MusicTrackId = 'landing';
  private previewTrack: MusicTrackId | null = null;
  private currentTrack: MusicTrackId | null = null;

  private schedulerTimer: number | null = null;
  private nextNoteTime: number = 0;
  private stepIndex: number = 0;
  private isUnlocked: boolean = false;
  private isTabHidden: boolean = typeof document !== 'undefined' ? document.hidden : false;
  private gestureBound: boolean = false;

  constructor() {
    this.bindLifecycleListeners();
  }

  private bindLifecycleListeners() {
    if (typeof window === 'undefined' || this.gestureBound) return;
    this.gestureBound = true;

    const handleGesture = () => {
      this.unlock();
    };

    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    window.addEventListener('touchstart', handleGesture, { passive: true });

    document.addEventListener('visibilitychange', () => {
      this.isTabHidden = document.hidden;
      const ctx = sounds.getSharedContext(false);
      if (!ctx || !this.musicMasterGain) return;

      if (this.isTabHidden) {
        this.musicMasterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      } else {
        this.syncGainNode();
        this.nextNoteTime = ctx.currentTime + 0.08;
      }
    });
  }

  private getEffectiveGain(): number {
    if (this.muted || !this.enabled || this.isTabHidden) return 0;
    // Keep music comfortably below weapon & explosion SFX
    return Math.max(0, Math.min(0.45, this.masterVolume * this.musicVolume * 0.34));
  }

  private ensureAudioGraph(ctx: AudioContext) {
    if (!this.musicMasterGain) {
      this.musicMasterGain = ctx.createGain();
      this.musicMasterGain.gain.setValueAtTime(this.getEffectiveGain(), ctx.currentTime);
      this.musicMasterGain.connect(ctx.destination);
    }

    if (!this.filterNode) {
      this.filterNode = ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(1600, ctx.currentTime);
      this.filterNode.Q.setValueAtTime(0.7, ctx.currentTime);
      this.filterNode.connect(this.musicMasterGain);
    }

    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.4);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
  }

  private syncGainNode() {
    const ctx = sounds.getSharedContext(false);
    if (!ctx || !this.musicMasterGain) return;
    this.musicMasterGain.gain.setTargetAtTime(this.getEffectiveGain(), ctx.currentTime, 0.12);
  }

  public unlock() {
    const ctx = sounds.getSharedContext(true);
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        this.ensureAudioGraph(ctx);
        this.isUnlocked = true;
        this.startSchedulerIfNeeded();
      });
    } else {
      this.ensureAudioGraph(ctx);
      this.isUnlocked = true;
      this.startSchedulerIfNeeded();
    }
  }

  public applySettings({ enabled, musicVolume, masterVolume, muted }: MusicSettingsPayload) {
    if (typeof enabled === 'boolean') this.enabled = enabled;
    if (typeof musicVolume === 'number') {
      this.musicVolume = Math.max(0, Math.min(1, musicVolume / 100));
    }
    if (typeof masterVolume === 'number') {
      this.masterVolume = Math.max(0, Math.min(1, masterVolume / 100));
    }
    if (typeof muted === 'boolean') this.muted = muted;

    this.syncGainNode();
  }

  public setTrack(track: MusicTrackId) {
    this.desiredTrack = track;
    this.evaluateActiveTrack();
  }

  public setPreviewTrack(track: MusicTrackId | null) {
    this.previewTrack = track;
    if (track) {
      this.unlock();
    }
    this.evaluateActiveTrack();
  }

  public getActiveTrack(): MusicTrackId {
    return this.previewTrack ?? this.desiredTrack;
  }

  private evaluateActiveTrack() {
    const target = this.previewTrack ?? this.desiredTrack;
    if (this.currentTrack === target) return;

    this.currentTrack = target;
    this.stepIndex = 0;

    const ctx = sounds.getSharedContext(false);
    if (ctx && this.filterNode) {
      const cutoffs: Record<MusicTrackId, number> = {
        landing: 1350,
        connecting: 1200,
        war_room: 1950,
        combat: 2500,
        victory: 1750,
      };
      this.filterNode.frequency.setTargetAtTime(cutoffs[target], ctx.currentTime, 0.25);
      this.nextNoteTime = ctx.currentTime + 0.06;
    }
  }

  private startSchedulerIfNeeded() {
    if (this.schedulerTimer !== null) return;
    const ctx = sounds.getSharedContext(false);
    if (!ctx) return;

    if (!this.currentTrack) {
      this.currentTrack = this.previewTrack ?? this.desiredTrack;
    }
    this.nextNoteTime = ctx.currentTime + 0.05;

    this.schedulerTimer = window.setInterval(() => {
      this.tickScheduler();
    }, 55);
  }

  private tickScheduler() {
    if (!this.isUnlocked || !this.enabled || this.muted || this.isTabHidden) return;
    const ctx = sounds.getSharedContext(false);
    if (!ctx || ctx.state !== 'running') return;

    this.ensureAudioGraph(ctx);
    const active = this.previewTrack ?? this.desiredTrack;
    if (this.currentTrack !== active) {
      this.evaluateActiveTrack();
    }

    const bpm = MUSIC_TRACKS[active].bpm;
    const stepDuration = 60 / bpm / 4; // 16th note duration in seconds
    const lookahead = 0.16;

    // Catch up safely if browser throttled timers
    if (this.nextNoteTime < ctx.currentTime - 0.3) {
      this.nextNoteTime = ctx.currentTime + 0.04;
    }

    while (this.nextNoteTime < ctx.currentTime + lookahead) {
      this.scheduleStep(ctx, active, this.stepIndex, this.nextNoteTime, stepDuration);
      this.nextNoteTime += stepDuration;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  // --- SYNTHESIS VOICES ---

  private playTone(
    ctx: AudioContext,
    freq: number,
    time: number,
    duration: number,
    opts: {
      type?: OscillatorType;
      gain?: number;
      attack?: number;
      detune?: number;
      cutoffEnv?: number;
    } = {},
  ) {
    if (!this.filterNode) return;
    const {
      type = 'triangle',
      gain = 0.18,
      attack = 0.015,
      detune = 0,
    } = opts;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (detune !== 0) {
      osc.detune.setValueAtTime(detune, time);
    }

    const safeAttack = Math.min(attack, duration * 0.45);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gain, time + safeAttack);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(env);
    env.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playPadChord(ctx: AudioContext, notes: number[], time: number, duration: number, gain: number) {
    for (const midi of notes) {
      const f = midiToFreq(midi);
      this.playTone(ctx, f, time, duration, {
        type: 'sawtooth',
        gain: gain * 0.38,
        attack: 0.35,
        detune: -5,
      });
      this.playTone(ctx, f, time, duration, {
        type: 'triangle',
        gain: gain * 0.55,
        attack: 0.35,
        detune: 5,
      });
    }
  }

  private playKick(ctx: AudioContext, time: number, gain: number) {
    if (!this.filterNode) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(env);
    env.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + 0.18);
  }

  private playSnare(ctx: AudioContext, time: number, gain: number) {
    if (!this.filterNode || !this.noiseBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1500, time);
    bp.Q.setValueAtTime(0.9, time);

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    src.connect(bp);
    bp.connect(env);
    env.connect(this.filterNode);

    src.start(time);
    src.stop(time + 0.12);
  }

  private playHat(ctx: AudioContext, time: number, gain: number) {
    if (!this.filterNode || !this.noiseBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(5200, time);

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    src.connect(hp);
    hp.connect(env);
    env.connect(this.filterNode);

    src.start(time);
    src.stop(time + 0.045);
  }

  // --- TRACK SEQUENCERS (64-step 4-bar 16th-note grids) ---

  private scheduleStep(
    ctx: AudioContext,
    track: MusicTrackId,
    step: number,
    time: number,
    stepDur: number,
  ) {
    const bar = Math.floor(step / 16);
    const beatStep = step % 16;

    switch (track) {
      case 'landing':
        this.scheduleLanding(ctx, bar, beatStep, time, stepDur);
        break;
      case 'connecting':
        this.scheduleConnecting(ctx, bar, beatStep, time, stepDur);
        break;
      case 'war_room':
        this.scheduleWarRoom(ctx, bar, beatStep, time, stepDur);
        break;
      case 'combat':
        this.scheduleCombat(ctx, bar, beatStep, time, stepDur);
        break;
      case 'victory':
        this.scheduleVictory(ctx, bar, beatStep, time, stepDur);
        break;
    }
  }

  // 1. LANDING (Orbital Hangar — 92 BPM, D Dorian atmospheric synth)
  private scheduleLanding(ctx: AudioContext, bar: number, step: number, time: number, stepDur: number) {
    const chords = [
      [50, 57, 60, 64], // Dm9
      [46, 53, 57, 62], // Bbmaj7
      [48, 55, 60, 64], // C6
      [45, 52, 57, 60], // Am7
    ];
    const bassRoots = [38, 34, 36, 33];
    const chimes = [
      [74, 76, 72, 69],
      [70, 74, 77, 74],
      [72, 76, 79, 76],
      [69, 72, 76, 72],
    ];

    if (step === 0) {
      this.playPadChord(ctx, chords[bar], time, stepDur * 16.5, 0.2);
    }

    // Gentle sub-bass pulse
    if (step === 0 || step === 6 || step === 8 || step === 12) {
      this.playTone(ctx, midiToFreq(bassRoots[bar]), time, stepDur * 3.5, {
        type: 'triangle',
        gain: 0.24,
        attack: 0.03,
      });
    }

    // Floating crystalline space chimes
    if (step === 2 || step === 6 || step === 10 || step === 14) {
      const idx = Math.floor(step / 4);
      const note = chimes[bar][idx];
      this.playTone(ctx, midiToFreq(note), time, stepDur * 3.2, {
        type: 'sine',
        gain: 0.11,
        attack: 0.02,
      });
    }
  }

  // 2. CONNECTING (Frequency Lock — 110 BPM, F minor sonar telemetry)
  private scheduleConnecting(ctx: AudioContext, bar: number, step: number, time: number, stepDur: number) {
    const bassRoots = [41, 37, 39, 36]; // F2, Db2, Eb2, C2
    const pings = [77, 72, 75, 79]; // F5, C5, Eb5, G5

    if (step === 0) {
      this.playPadChord(ctx, [bassRoots[bar] + 12, bassRoots[bar] + 19], time, stepDur * 15.5, 0.14);
    }

    // Telemetry bass pulse every 8th note
    if (step % 2 === 0) {
      const accent = step % 4 === 0 ? 0.2 : 0.12;
      this.playTone(ctx, midiToFreq(bassRoots[bar]), time, stepDur * 1.4, {
        type: 'triangle',
        gain: accent,
        attack: 0.01,
      });
    }

    // Sonar ping every half-bar
    if (step === 0 || step === 8) {
      const freq = midiToFreq(step === 0 ? pings[bar] : pings[bar] + 7);
      this.playTone(ctx, freq, time, stepDur * 5.0, {
        type: 'sine',
        gain: 0.13,
        attack: 0.008,
      });
    }

    // Subtle telemetry clock tick
    if (step % 4 === 2) {
      this.playHat(ctx, time, 0.06);
    }
  }

  // 3. WAR ROOM (Tactical Briefing — 118 BPM, E minor staging groove)
  private scheduleWarRoom(ctx: AudioContext, bar: number, step: number, time: number, stepDur: number) {
    const chords = [
      [52, 59, 64], // Em
      [48, 55, 60], // C
      [50, 57, 62], // D
      [47, 54, 59], // Bm
    ];
    const bassRoots = [40, 36, 38, 35];
    const leadPattern = [
      [64, 0, 67, 0, 71, 0, 67, 0, 66, 0, 64, 0, 62, 0, 59, 0],
      [60, 0, 64, 0, 67, 0, 64, 0, 62, 0, 60, 0, 55, 0, 60, 0],
      [62, 0, 66, 0, 69, 0, 66, 0, 64, 0, 62, 0, 57, 0, 62, 0],
      [59, 0, 62, 0, 66, 0, 62, 0, 64, 0, 62, 0, 59, 0, 54, 0],
    ];

    if (step === 0) {
      this.playPadChord(ctx, chords[bar], time, stepDur * 15, 0.16);
    }

    // Syncopated tactical bassline
    if (step === 0 || step === 3 || step === 6 || step === 8 || step === 11 || step === 14) {
      const oct = step === 14 ? 12 : 0;
      this.playTone(ctx, midiToFreq(bassRoots[bar] + oct), time, stepDur * 2.1, {
        type: 'sawtooth',
        gain: 0.16,
        attack: 0.01,
      });
    }

    // Minimalist tactical percussion
    if (step === 0 || step === 8) {
      this.playKick(ctx, time, 0.34);
    }
    if (step === 4 || step === 12) {
      this.playSnare(ctx, time, 0.11);
    }
    if (step % 2 === 0) {
      this.playHat(ctx, time, step % 4 === 2 ? 0.09 : 0.045);
    }

    // Pluck motif
    const leadNote = leadPattern[bar][step];
    if (leadNote > 0) {
      this.playTone(ctx, midiToFreq(leadNote), time, stepDur * 1.7, {
        type: 'triangle',
        gain: 0.13,
        attack: 0.008,
      });
    }
  }

  // 4. COMBAT (Omega Skirmish — 136 BPM, A minor high-energy battle beat)
  private scheduleCombat(ctx: AudioContext, bar: number, step: number, time: number, stepDur: number) {
    const bassRoots = [33, 29, 31, 28]; // A1, F1, G1, E1
    const leadRiff = [
      [69, 0, 72, 0, 76, 0, 72, 74, 76, 0, 72, 0, 69, 0, 67, 0],
      [65, 0, 69, 0, 72, 0, 69, 72, 74, 0, 72, 0, 69, 0, 65, 0],
      [67, 0, 71, 0, 74, 0, 71, 74, 76, 0, 74, 0, 71, 0, 67, 0],
      [64, 0, 67, 0, 71, 0, 67, 71, 72, 0, 71, 0, 67, 0, 64, 0],
    ];

    // Rolling octave synthwave bass on every 8th note
    if (step % 2 === 0) {
      const oct = step % 4 === 2 ? 12 : 0;
      this.playTone(ctx, midiToFreq(bassRoots[bar] + oct), time, stepDur * 1.5, {
        type: 'sawtooth',
        gain: 0.21,
        attack: 0.006,
      });
    }

    // Driving action drums
    if (step === 0 || step === 4 || step === 8 || step === 10 || step === 12) {
      this.playKick(ctx, time, step === 10 ? 0.26 : 0.42);
    }
    if (step === 4 || step === 12) {
      this.playSnare(ctx, time, 0.22);
    }
    // Energetic 16th hi-hats
    this.playHat(ctx, time, step % 4 === 2 ? 0.11 : 0.045);

    // Action lead synth
    const leadNote = leadRiff[bar][step];
    if (leadNote > 0) {
      this.playTone(ctx, midiToFreq(leadNote), time, stepDur * 1.6, {
        type: 'sawtooth',
        gain: 0.1,
        attack: 0.008,
        detune: -4,
      });
      this.playTone(ctx, midiToFreq(leadNote), time, stepDur * 1.6, {
        type: 'triangle',
        gain: 0.12,
        attack: 0.008,
        detune: 4,
      });
    }
  }

  // 5. VICTORY (Extraction Fanfare — 98 BPM, uplifting synth resolution)
  private scheduleVictory(ctx: AudioContext, bar: number, step: number, time: number, stepDur: number) {
    const chords = [
      [53, 57, 60, 64], // Fmaj7
      [55, 59, 62, 64], // G6
      [57, 60, 64, 67], // Am7
      [48, 55, 60, 64], // Cmaj7
    ];
    const bassRoots = [41, 43, 45, 36];
    const arps = [69, 72, 76, 79];

    if (step === 0) {
      this.playPadChord(ctx, chords[bar], time, stepDur * 16, 0.22);
    }
    if (step === 0 || step === 8) {
      this.playTone(ctx, midiToFreq(bassRoots[bar]), time, stepDur * 6, {
        type: 'triangle',
        gain: 0.24,
        attack: 0.03,
      });
    }
    if (step % 4 === 0) {
      const note = arps[step / 4] + (bar === 3 ? 0 : 0);
      this.playTone(ctx, midiToFreq(note), time, stepDur * 2.8, {
        type: 'sine',
        gain: 0.14,
        attack: 0.015,
      });
    }
  }
}

export const music = new MusicEngine();
