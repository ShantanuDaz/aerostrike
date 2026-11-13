import type { WeaponType } from '../combat/types';

export interface AudioSettingsPayload {
  volume?: number; // 0..100
  muted?: boolean;
  jetpackEnabled?: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.8; // 0..1
  private jetpackEnabled: boolean = true;
  private jetpackOsc: OscillatorNode | null = null;
  private jetpackGain: GainNode | null = null;
  private shotgunNoiseBuffer: AudioBuffer | null = null;
  private dashNoiseBuffer: AudioBuffer | null = null;
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

      // Soft broadcast master limiter to prevent clipping during simultaneous multi-kill explosions
      if (typeof this.ctx.createDynamicsCompressor === 'function') {
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
        this.masterCompressor.knee.setValueAtTime(10, this.ctx.currentTime);
        this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.masterCompressor.release.setValueAtTime(0.12, this.ctx.currentTime);
        this.masterGain.connect(this.masterCompressor);
        this.masterCompressor.connect(this.ctx.destination);
      } else {
        this.masterGain.connect(this.ctx.destination);
      }
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
      case 'grenade':
        this.playGrenadeThrow();
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

    // 1. Initial supersonic transient crack (instant attack < 25ms)
    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(1450, t);
    crackOsc.frequency.exponentialRampToValueAtTime(75, t + 0.025);
    crackGain.gain.setValueAtTime(0.55, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    crackOsc.connect(crackGain);
    crackGain.connect(dest);
    crackOsc.start(t);
    crackOsc.stop(t + 0.025);

    // 2. High-density pellet discharge body with resonant filter
    if (!this.shotgunNoiseBuffer || this.shotgunNoiseBuffer.sampleRate !== this.ctx.sampleRate) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
      }
      this.shotgunNoiseBuffer = buffer;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.shotgunNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(2.2, t);
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(t);

    // 3. Sub-thump concussive body (chest kick)
    const thumpOsc = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(170, t);
    thumpOsc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    thumpGain.gain.setValueAtTime(0.45, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(dest);
    thumpOsc.start(t);
    thumpOsc.stop(t + 0.09);

    // 4. Subtle mechanical pump action click at +110ms
    const pumpOsc = this.ctx.createOscillator();
    const pumpGain = this.ctx.createGain();
    pumpOsc.type = 'triangle';
    pumpOsc.frequency.setValueAtTime(2200, t + 0.11);
    pumpOsc.frequency.exponentialRampToValueAtTime(1400, t + 0.135);
    pumpGain.gain.setValueAtTime(0.12, t + 0.11);
    pumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.135);
    pumpOsc.connect(pumpGain);
    pumpGain.connect(dest);
    pumpOsc.start(t + 0.11);
    pumpOsc.stop(t + 0.135);
  }

  public playSniper() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;

    // 1. High-voltage ionization crack (hypersonic transient snap)
    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(3400, t);
    crackOsc.frequency.exponentialRampToValueAtTime(320, t + 0.04);
    crackGain.gain.setValueAtTime(0.5, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    crackOsc.connect(crackGain);
    crackGain.connect(dest);
    crackOsc.start(t);
    crackOsc.stop(t + 0.04);

    // 2. Resonant electromagnetic rail hum
    const boreOsc = this.ctx.createOscillator();
    const boreGain = this.ctx.createGain();
    boreOsc.type = 'sine';
    boreOsc.frequency.setValueAtTime(1750, t);
    boreOsc.frequency.exponentialRampToValueAtTime(95, t + 0.38);
    boreGain.gain.setValueAtTime(0.42, t);
    boreGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    boreOsc.connect(boreGain);
    boreGain.connect(dest);
    boreOsc.start(t);
    boreOsc.stop(t + 0.38);

    // 3. Sub-bass kinetic recoil discharge
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(210, t);
    subOsc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    subGain.gain.setValueAtTime(0.48, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(t);
    subOsc.stop(t + 0.22);
  }

  public playGrenadeThrow() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    // Pin snap + soft lob whoosh
    const pinOsc = this.ctx.createOscillator();
    const pinGain = this.ctx.createGain();
    pinOsc.type = 'triangle';
    pinOsc.frequency.setValueAtTime(1150, t);
    pinOsc.frequency.exponentialRampToValueAtTime(520, t + 0.05);
    pinGain.gain.setValueAtTime(0.18, t);
    pinGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    pinOsc.connect(pinGain);
    pinGain.connect(dest);
    pinOsc.start(t);
    pinOsc.stop(t + 0.055);

    const whooshOsc = this.ctx.createOscillator();
    const whooshGain = this.ctx.createGain();
    whooshOsc.type = 'sine';
    whooshOsc.frequency.setValueAtTime(240, t + 0.02);
    whooshOsc.frequency.exponentialRampToValueAtTime(110, t + 0.16);
    whooshGain.gain.setValueAtTime(0.2, t + 0.02);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    whooshOsc.connect(whooshGain);
    whooshGain.connect(dest);
    whooshOsc.start(t + 0.02);
    whooshOsc.stop(t + 0.16);
  }

  public playGrenadeBounce() {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(920, t);
    osc.frequency.exponentialRampToValueAtTime(580, t + 0.045);

    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.045);
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

    // 1. Supersonic initial wavefront / transient crack (0 - 35ms)
    const crackOsc = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(2800, t);
    crackOsc.frequency.exponentialRampToValueAtTime(90, t + 0.035);
    crackGain.gain.setValueAtTime(0.7, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    crackOsc.connect(crackGain);
    crackGain.connect(dest);
    crackOsc.start(t);
    crackOsc.stop(t + 0.035);

    // 2. High-energy debris rattle and turbulent fireball noise
    if (!this.explosionNoiseBuffer || this.explosionNoiseBuffer.sampleRate !== this.ctx.sampleRate) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.55);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Multi-frequency decay with chaotic turbulence
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.14));
      }
      this.explosionNoiseBuffer = buffer;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.explosionNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(1.8, t);
    filter.frequency.setValueAtTime(1100, t);
    filter.frequency.exponentialRampToValueAtTime(45, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(t);

    // 3. Heavy concussive seismic sub-bass drop (0 - 340ms)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, t);
    subOsc.frequency.exponentialRampToValueAtTime(24, t + 0.34);
    subGain.gain.setValueAtTime(0.8, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(t);
    subOsc.stop(t + 0.34);

    // 4. Secondary terrain echo rumble (at +60ms)
    const echoOsc = this.ctx.createOscillator();
    const echoGain = this.ctx.createGain();
    echoOsc.type = 'triangle';
    echoOsc.frequency.setValueAtTime(85, t + 0.06);
    echoOsc.frequency.exponentialRampToValueAtTime(30, t + 0.26);
    echoGain.gain.setValueAtTime(0.35, t + 0.06);
    echoGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    echoOsc.connect(echoGain);
    echoGain.connect(dest);
    echoOsc.start(t + 0.06);
    echoOsc.stop(t + 0.26);
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

    // Dedicated high-velocity compressed air thruster burst
    if (!this.dashNoiseBuffer || this.dashNoiseBuffer.sampleRate !== this.ctx.sampleRate) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.16);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.06));
      }
      this.dashNoiseBuffer = buffer;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.dashNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.8, t);
    filter.frequency.setValueAtTime(2800, t);
    filter.frequency.exponentialRampToValueAtTime(380, t + 0.13);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.13);

    // Thruster ignition pitch flare (pneumatic gas expulsion swell)
    const flareOsc = this.ctx.createOscillator();
    const flareGain = this.ctx.createGain();
    flareOsc.type = 'sawtooth';
    flareOsc.frequency.setValueAtTime(140, t);
    flareOsc.frequency.exponentialRampToValueAtTime(320, t + 0.04);
    flareOsc.frequency.exponentialRampToValueAtTime(80, t + 0.13);

    flareGain.gain.setValueAtTime(0.24, t);
    flareGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    flareOsc.connect(flareGain);
    flareGain.connect(dest);
    flareOsc.start(t);
    flareOsc.stop(t + 0.13);
  }

  // --- WEAPON & EQUIPMENT FEEDBACK ---

  public playWeaponPickup(weapon?: WeaponType) {
    if (this.isMuted || this.masterVolume <= 0) return;
    const dest = this.getOutputNode();
    if (!this.ctx || !dest) return;

    const t = this.ctx.currentTime;

    // 1. Mechanical slide pull / rack transient (metallic scrape)
    const rackOsc = this.ctx.createOscillator();
    const rackGain = this.ctx.createGain();
    rackOsc.type = 'triangle';
    rackOsc.frequency.setValueAtTime(680, t);
    rackOsc.frequency.exponentialRampToValueAtTime(1250, t + 0.04);
    rackGain.gain.setValueAtTime(0.24, t);
    rackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    rackOsc.connect(rackGain);
    rackGain.connect(dest);
    rackOsc.start(t);
    rackOsc.stop(t + 0.045);

    // 2. Chamber snap / bolt locking forward
    const lockOsc = this.ctx.createOscillator();
    const lockGain = this.ctx.createGain();
    lockOsc.type = 'sawtooth';
    lockOsc.frequency.setValueAtTime(1600, t + 0.045);
    lockOsc.frequency.exponentialRampToValueAtTime(320, t + 0.08);
    lockGain.gain.setValueAtTime(0.35, t + 0.045);
    lockGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    lockOsc.connect(lockGain);
    lockGain.connect(dest);
    lockOsc.start(t + 0.045);
    lockOsc.stop(t + 0.085);

    // 3. High-tech tactical HUD lock chime
    const chimeOsc = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chimeOsc.type = 'sine';
    const baseFreq = weapon === 'rocket' ? 440 : weapon === 'sniper' ? 880 : 660;
    chimeOsc.frequency.setValueAtTime(baseFreq, t + 0.08);
    chimeOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.16);
    chimeGain.gain.setValueAtTime(0.22, t + 0.08);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    chimeOsc.connect(chimeGain);
    chimeGain.connect(dest);
    chimeOsc.start(t + 0.08);
    chimeOsc.stop(t + 0.17);
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
