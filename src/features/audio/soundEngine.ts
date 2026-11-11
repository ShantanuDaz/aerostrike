import type { WeaponType } from '../combat/types';

export interface AudioSettingsPayload {
  volume?: number; // 0..100
  muted?: boolean;
  jetpackEnabled?: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.8; // 0..1
  private jetpackEnabled: boolean = true;
  private jetpackOsc: OscillatorNode | null = null;
  private jetpackGain: GainNode | null = null;
  private shotgunNoiseBuffer: AudioBuffer | null = null;
  private explosionNoiseBuffer: AudioBuffer | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime,
      );
      this.masterGain.connect(this.ctx.destination);
    }
  }

  private getOutputNode(): AudioNode | null {
    this.initCtx();
    return this.masterGain ?? this.ctx?.destination ?? null;
  }

  public applyAudioSettings({ volume, muted, jetpackEnabled }: AudioSettingsPayload) {
    if (typeof volume === 'number') {
      this.masterVolume = Math.max(0, Math.min(1, volume / 100));
    }
    if (typeof muted === 'boolean') {
      this.isMuted = muted;
    }
    if (typeof jetpackEnabled === 'boolean') {
      this.jetpackEnabled = jetpackEnabled;
    }

    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.02,
      );
    }

    if ((this.isMuted || !this.jetpackEnabled) && this.jetpackGain) {
      this.jetpackGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
  }

  public toggleMute(): boolean {
    this.applyAudioSettings({ muted: !this.isMuted });
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getVolume(): number {
    return Math.round(this.masterVolume * 100);
  }

  public getSharedContext(createIfNeeded: boolean = false): AudioContext | null {
    if (createIfNeeded && !this.ctx) {
      this.initCtx();
    } else if (this.ctx && this.ctx.state === 'suspended' && createIfNeeded) {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  // --- UI FEEDBACK ---

  public playUiClick() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.045);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  public playWeaponSound(weapon: WeaponType) {
    switch (weapon) {
      case 'pistol':
        this.playPistol();
        break;
      case 'rifle':
        this.playRifle();
        break;
      case 'shotgun':
        this.playShotgun();
        break;
      case 'sniper':
        this.playSniper();
        break;
      case 'rocket':
        this.playRocketLaunch();
        break;
    }
  }

  // --- WEAPON SOUNDS ---

  public playPistol() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playRifle() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playShotgun() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    if (!this.shotgunNoiseBuffer || this.shotgunNoiseBuffer.sampleRate !== this.ctx.sampleRate) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.2);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.shotgunNoiseBuffer = buffer;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.shotgunNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(t);
  }

  public playSniper() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.35);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playRocketLaunch() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.25);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playExplosion() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    if (!this.explosionNoiseBuffer || this.explosionNoiseBuffer.sampleRate !== this.ctx.sampleRate) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.45);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.1));
      }
      this.explosionNoiseBuffer = buffer;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.explosionNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(40, t + 0.45);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(t);
  }

  // --- JETPACK CONTINUOUS SOUND ---

  public setJetpackBoosting(boosting: boolean) {
    if (this.isMuted || !this.jetpackEnabled || this.masterVolume <= 0) {
      if (this.jetpackGain && this.ctx) {
        this.jetpackGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      return;
    }
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    if (!this.jetpackOsc) {
      this.jetpackOsc = this.ctx.createOscillator();
      this.jetpackOsc.type = 'sawtooth';
      this.jetpackOsc.frequency.setValueAtTime(85, this.ctx.currentTime);

      this.jetpackGain = this.ctx.createGain();
      this.jetpackGain.gain.setValueAtTime(0, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, this.ctx.currentTime);

      this.jetpackOsc.connect(filter);
      filter.connect(this.jetpackGain);
      this.jetpackGain.connect(dest);

      this.jetpackOsc.start();
    }

    const targetGain = boosting ? 0.08 : 0;
    this.jetpackGain?.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
  }

  public playDash() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    if (!this.shotgunNoiseBuffer || this.shotgunNoiseBuffer.sampleRate !== this.ctx.sampleRate) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.2);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.shotgunNoiseBuffer = buffer;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.shotgunNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.6, t);
    filter.frequency.setValueAtTime(1100, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.14);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(t);
    noise.stop(t + 0.14);
  }

  // --- CTF FANFARES ---

  public playFlagPickup() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const notes = [440, 554, 659];
    notes.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.07;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  public playFlagCapture() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const fanfare = [523.25, 659.25, 783.99, 1046.5];
    fanfare.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.09;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playFlagReturn() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const notes = [659, 523];
    notes.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playHitMarker() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(1100, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  public playBouncePad() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(640, t + 0.16);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playRefill(stationType: 'medkit' | 'fuel' | 'supply') {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const notes =
      stationType === 'medkit'
        ? [523.25, 659.25]
        : stationType === 'fuel'
          ? [392.0, 587.33]
          : [523.25, 659.25, 783.99];

    notes.forEach((freq, idx) => {
      const t = this.ctx!.currentTime + idx * 0.06;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }
}

export const sounds = new SoundEngine();
