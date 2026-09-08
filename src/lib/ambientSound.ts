// In-browser ambient audio generator using Web Audio API
// Generates soothing, non-melodic textures and gentle completion sounds.

import { AmbientTexture } from '../types';

type AudioContextType = typeof window.AudioContext;

export interface AmbientSoundState {
  isPlaying: boolean;
  enabled: boolean;
  volume: number; // 0.0 to 1.0
  texture: AmbientTexture;
  isSupported: boolean;
}

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Individual texture gain nodes for smooth crossfading
  private washGain: GainNode | null = null;
  private airyGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private rainGain: GainNode | null = null;

  // Nodes for textures
  private brownNoiseSource: AudioBufferSourceNode | null = null;
  private brownFilter: BiquadFilterNode | null = null;

  private pinkNoiseSource: AudioBufferSourceNode | null = null;
  private pinkFilter: BiquadFilterNode | null = null;
  private pinkLfo: OscillatorNode | null = null;
  private pinkLfoGain: GainNode | null = null;

  private droneOscs: OscillatorNode[] = [];

  private rainNoiseSource: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainLfo: OscillatorNode | null = null;
  private rainLfoGain: GainNode | null = null;

  private isPlaying: boolean = false;
  private enabled: boolean = true; // Defaults to true
  private interactionSoundsEnabled: boolean = true; // Independent interaction sounds (Item 7)
  private volume: number = 0.5; // 0.0 to 1.0 (defaults to 50%)
  private texture: AmbientTexture = 'soft-wash';
  private isStillnessContext: boolean = false;
  private hasUserInteracted: boolean = false;
  private removeGestureListeners: (() => void) | null = null;
  private limiter: DynamicsCompressorNode | null = null;

  private listeners: Set<(state: AmbientSoundState) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Load stored enabled state (defaults to true for new user)
      const savedEnabled = localStorage.getItem('mindful_journal_ambient_sound_enabled');
      if (savedEnabled !== null) {
        this.enabled = savedEnabled === 'true';
      } else {
        this.enabled = true; // Default ON
      }

      // 1b. Load stored interaction sounds enabled state (Item 7)
      const savedInteraction = localStorage.getItem('mindful_journal_interaction_sounds_enabled');
      if (savedInteraction !== null) {
        this.interactionSoundsEnabled = savedInteraction === 'true';
      } else {
        this.interactionSoundsEnabled = true;
      }

      // 2. Load stored volume
      const savedVolume = localStorage.getItem('mindful_journal_ambient_volume');
      if (savedVolume !== null) {
        const parsed = parseFloat(savedVolume);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }

      // 3. Load stored texture
      const savedTexture = localStorage.getItem('mindful_journal_ambient_texture') as AmbientTexture;
      if (savedTexture && ['soft-wash', 'airy', 'warm-drone', 'rain'].includes(savedTexture)) {
        this.texture = savedTexture;
      }

      // 4. Setup one-time gesture listener to respect browser autoplay policies
      this.setupAutoplayListener();
    }
  }

  /**
   * Translates linear UI volume slider (0.0 to 1.0) into a logarithmic / perceptual audio taper curve
   * with a raised master ceiling so 100% volume is clearly and comfortably audible on laptop and mobile speakers (Item 8).
   */
  private getPerceptualGain(sliderValue: number): number {
    if (sliderValue <= 0.001) return 0;
    // Perceptual curve: v^1.8 (natural logarithmic response for human ears)
    const perceptual = Math.pow(sliderValue, 1.8);
    // Raised master gain ceiling (up to 0.85 instead of the previous 0.35)
    return perceptual * 0.85;
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  public getState(): AmbientSoundState {
    return {
      isPlaying: this.isPlaying,
      enabled: this.enabled,
      volume: this.volume,
      texture: this.texture,
      isSupported: this.isSupported(),
    };
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getTexture(): AmbientTexture {
    return this.texture;
  }

  public subscribe(fn: (state: AmbientSoundState) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  // Setup one-time interaction listener so sound begins on user's first click/tap/keypress
  public setupAutoplayListener() {
    if (typeof window === 'undefined' || this.hasUserInteracted) return;

    const onFirstGesture = () => {
      this.hasUserInteracted = true;
      if (this.removeGestureListeners) {
        this.removeGestureListeners();
        this.removeGestureListeners = null;
      }

      if (this.enabled) {
        this.start();
      }
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'click'];
    const handler = () => {
      onFirstGesture();
    };

    events.forEach((evt) => {
      window.addEventListener(evt, handler, { once: true, passive: true });
    });

    this.removeGestureListeners = () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handler);
      });
    };
  }

  private initAudioContext() {
    if (this.ctx) return;
    const AudioCtxClass: AudioContextType =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    this.ctx = new AudioCtxClass();

    // Master gain node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    // Subtle dynamics compressor / limiter to ensure clean headroom and zero distortion at higher volumes
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-3, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(10, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(4, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);

    // Build the 4 distinct ambient generators
    this.buildSoftWashTexture();
    this.buildAiryTexture();
    this.buildWarmDroneTexture();
    this.buildRainTexture();

    // Set initial gains based on active texture
    this.updateTextureGains(true);
  }

  // 1. Soft Low Wash: Low-passed brownian noise
  private buildSoftWashTexture() {
    if (!this.ctx || !this.masterGain) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 5;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = noiseBuffer.getChannelData(channel);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = Math.max(-1, Math.min(1, lastOut * 2.0)) * 0.7;
      }
    }

    this.brownNoiseSource = this.ctx.createBufferSource();
    this.brownNoiseSource.buffer = noiseBuffer;
    this.brownNoiseSource.loop = true;

    this.brownFilter = this.ctx.createBiquadFilter();
    this.brownFilter.type = 'lowpass';
    this.brownFilter.frequency.setValueAtTime(
      this.isStillnessContext ? 340 : 230,
      this.ctx.currentTime
    );
    this.brownFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    this.washGain = this.ctx.createGain();
    this.washGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.brownNoiseSource.connect(this.brownFilter);
    this.brownFilter.connect(this.washGain);
    this.washGain.connect(this.masterGain);

    this.brownNoiseSource.start(0);
  }

  // 2. Airy Atmosphere: Filtered pink noise with slow gentle breath modulation
  private buildAiryTexture() {
    if (!this.ctx || !this.masterGain) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 6;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5) * 0.085;
      }
    }

    this.pinkNoiseSource = this.ctx.createBufferSource();
    this.pinkNoiseSource.buffer = noiseBuffer;
    this.pinkNoiseSource.loop = true;

    this.pinkFilter = this.ctx.createBiquadFilter();
    this.pinkFilter.type = 'bandpass';
    this.pinkFilter.frequency.setValueAtTime(460, this.ctx.currentTime);
    this.pinkFilter.Q.setValueAtTime(1.1, this.ctx.currentTime);

    // Subtle slow breath modulation
    this.pinkLfo = this.ctx.createOscillator();
    this.pinkLfo.type = 'sine';
    this.pinkLfo.frequency.setValueAtTime(0.12, this.ctx.currentTime);

    this.pinkLfoGain = this.ctx.createGain();
    this.pinkLfoGain.gain.setValueAtTime(80, this.ctx.currentTime);

    this.pinkLfo.connect(this.pinkLfoGain);
    this.pinkLfoGain.connect(this.pinkFilter.frequency);

    this.airyGain = this.ctx.createGain();
    this.airyGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.pinkNoiseSource.connect(this.pinkFilter);
    this.pinkFilter.connect(this.airyGain);
    this.airyGain.connect(this.masterGain);

    this.pinkNoiseSource.start(0);
    this.pinkLfo.start(0);
  }

  // 3. Warm Drone: Very quiet, slowly drifting low harmonic sine layers
  private buildWarmDroneTexture() {
    if (!this.ctx || !this.masterGain) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.droneGain.connect(this.masterGain);

    const frequencies = [54.0, 108.0, 162.3, 216.0];
    const gains = [0.035, 0.04, 0.028, 0.016];

    frequencies.forEach((freq, idx) => {
      if (!this.ctx || !this.droneGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(gains[idx], this.ctx.currentTime);

      osc.connect(oscGain);
      oscGain.connect(this.droneGain);
      osc.start(0);

      this.droneOscs.push(osc);
    });
  }

  // 4. Quiet Rain: Filtered noise with subtle amplitude modulation
  private buildRainTexture() {
    if (!this.ctx || !this.masterGain) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 5;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = noiseBuffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        // High density granular noise
        const r = Math.random() * 2 - 1;
        data[i] = r * 0.32;
      }
    }

    this.rainNoiseSource = this.ctx.createBufferSource();
    this.rainNoiseSource.buffer = noiseBuffer;
    this.rainNoiseSource.loop = true;

    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.setValueAtTime(950, this.ctx.currentTime);
    this.rainFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    // Subtle amplitude fluctuation for rainfall rhythm
    const ampGain = this.ctx.createGain();
    ampGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    this.rainLfo = this.ctx.createOscillator();
    this.rainLfo.type = 'triangle';
    this.rainLfo.frequency.setValueAtTime(0.4, this.ctx.currentTime);

    this.rainLfoGain = this.ctx.createGain();
    this.rainLfoGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    this.rainLfo.connect(this.rainLfoGain);
    this.rainLfoGain.connect(ampGain.gain);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.rainNoiseSource.connect(this.rainFilter);
    this.rainFilter.connect(ampGain);
    ampGain.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    this.rainNoiseSource.start(0);
    this.rainLfo.start(0);
  }

  // Smooth crossfade between texture gain nodes
  private updateTextureGains(immediate: boolean = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = immediate ? 0 : 1.2;

    const targets = {
      'soft-wash': this.texture === 'soft-wash' ? 1.0 : 0.0,
      'airy': this.texture === 'airy' ? 0.9 : 0.0,
      'warm-drone': this.texture === 'warm-drone' ? 1.0 : 0.0,
      'rain': this.texture === 'rain' ? 0.75 : 0.0,
    };

    const applyGain = (node: GainNode | null, targetVal: number) => {
      if (!node || !this.ctx) return;
      node.gain.cancelScheduledValues(now);
      if (immediate || duration === 0) {
        node.gain.setValueAtTime(targetVal, now);
      } else {
        node.gain.setValueAtTime(node.gain.value, now);
        node.gain.linearRampToValueAtTime(targetVal, now + duration);
      }
    };

    applyGain(this.washGain, targets['soft-wash']);
    applyGain(this.airyGain, targets['airy']);
    applyGain(this.droneGain, targets['warm-drone']);
    applyGain(this.rainGain, targets['rain']);
  }

  public async start(): Promise<void> {
    if (!this.isSupported()) return;

    if (!this.ctx) {
      this.initAudioContext();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('Web Audio resume failed:', err);
      }
    }

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      const targetGain = this.getPerceptualGain(this.volume);
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      // Smooth 1.5s fade in with raised perceptual volume
      this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 1.5);
    }

    this.isPlaying = true;
    this.notify();
  }

  public stop(immediate: boolean = false): void {
    if (!this.isPlaying) return;

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);

      if (immediate) {
        this.masterGain.gain.setValueAtTime(0, now);
      } else {
        // Smooth 1.5s fade out
        this.masterGain.gain.linearRampToValueAtTime(0, now + 1.5);
      }
    }

    this.isPlaying = false;
    this.notify();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('mindful_journal_ambient_sound_enabled', String(enabled));
    }

    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  public toggle(): void {
    this.setEnabled(!this.enabled);
  }

  public setInteractionSoundsEnabled(enabled: boolean): void {
    this.interactionSoundsEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('mindful_journal_interaction_sounds_enabled', String(enabled));
    }
  }

  public isInteractionSoundsEnabled(): boolean {
    return this.interactionSoundsEnabled;
  }

  public setVolume(newVol: number): void {
    const clamped = Math.max(0, Math.min(1, newVol));
    this.volume = clamped;
    if (typeof window !== 'undefined') {
      localStorage.setItem('mindful_journal_ambient_volume', String(clamped));
    }

    if (this.isPlaying && this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      const targetGain = this.getPerceptualGain(this.volume);
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.1);
    }

    this.notify();
  }

  public setTexture(newTexture: AmbientTexture): void {
    if (this.texture === newTexture) return;
    this.texture = newTexture;
    if (typeof window !== 'undefined') {
      localStorage.setItem('mindful_journal_ambient_texture', newTexture);
    }

    this.updateTextureGains(false);
    this.notify();
  }

  public setStillnessContext(isStillness: boolean): void {
    this.isStillnessContext = isStillness;
    if (this.brownFilter && this.ctx) {
      const now = this.ctx.currentTime;
      const targetFreq = isStillness ? 340 : 230;
      this.brownFilter.frequency.cancelScheduledValues(now);
      this.brownFilter.frequency.setValueAtTime(this.brownFilter.frequency.value, now);
      this.brownFilter.frequency.linearRampToValueAtTime(targetFreq, now + 2.0);
    }
  }

  /**
   * Generates a brief, soft completion sound in Stillness activities.
   * - Untangle: Soft two-note resolving chime (D4 -> G4, quiet exhale, slow decay).
   * - Constellation: Soft ascending starlight triad (E5 -> G5 -> C6, celestial shimmer).
   * Gated independently by interactionSoundsEnabled (Item 7).
   */
  public playCompletionSound(type: 'untangle' | 'constellation'): void {
    // If interaction sounds are toggled off or audio is not supported, return
    if (!this.interactionSoundsEnabled || !this.isSupported()) return;

    try {
      if (!this.ctx) {
        this.initAudioContext();
      }

      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;
      const chimeGain = this.ctx.createGain();
      // Perceptually scaled base gain so it's always gentle and clearly audible
      const baseGain = Math.max(0.12, Math.min(0.32, this.getPerceptualGain(this.volume) * 0.45));
      chimeGain.gain.setValueAtTime(0, now);
      chimeGain.connect(this.ctx.destination);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(type === 'untangle' ? 1200 : 1600, now);
      filter.connect(chimeGain);

      if (type === 'untangle') {
        // Untangle: Two softly resolving resonant notes (D4=293.66Hz -> G4=392.00Hz)
        const notes = [
          { freq: 293.66, startTime: now, duration: 1.2 },
          { freq: 392.00, startTime: now + 0.16, duration: 1.1 },
        ];

        notes.forEach(({ freq, startTime, duration }) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          const noteGain = this.ctx.createGain();
          noteGain.gain.setValueAtTime(0, startTime);
          // Soft attack
          noteGain.gain.linearRampToValueAtTime(baseGain, startTime + 0.08);
          // Quiet exhale / gentle decay
          noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

          osc.connect(noteGain);
          noteGain.connect(filter);

          osc.start(startTime);
          osc.stop(startTime + duration);
        });

        chimeGain.gain.setValueAtTime(1, now);
      } else {
        // Constellation: Celestial gentle ascending starlight triad (E5=659.25Hz, G5=783.99Hz, C6=1046.5Hz)
        const notes = [
          { freq: 659.25, startTime: now, duration: 1.4 },
          { freq: 783.99, startTime: now + 0.15, duration: 1.3 },
          { freq: 1046.5, startTime: now + 0.3, duration: 1.2 },
        ];

        notes.forEach(({ freq, startTime, duration }) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          const noteGain = this.ctx.createGain();
          noteGain.gain.setValueAtTime(0, startTime);
          // Soft attack
          noteGain.gain.linearRampToValueAtTime(baseGain * 0.85, startTime + 0.09);
          // Exhale slow decay
          noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

          osc.connect(noteGain);
          noteGain.connect(filter);

          osc.start(startTime);
          osc.stop(startTime + duration);
        });

        chimeGain.gain.setValueAtTime(1, now);
      }
    } catch (e) {
      console.warn('Could not play stillness completion sound:', e);
    }
  }

  // Cleanup completely on sign-out
  public dispose(): void {
    this.stop(true);
    if (this.removeGestureListeners) {
      this.removeGestureListeners();
      this.removeGestureListeners = null;
    }
    try {
      if (this.ctx) {
        this.ctx.close();
      }
    } catch (e) {
      // Ignore
    }
    this.ctx = null;
    this.masterGain = null;
    this.washGain = null;
    this.airyGain = null;
    this.droneGain = null;
    this.rainGain = null;
    this.brownNoiseSource = null;
    this.pinkNoiseSource = null;
    this.droneOscs = [];
    this.rainNoiseSource = null;
    this.isPlaying = false;
    this.notify();
  }
}

export const ambientSound = new AmbientSoundEngine();
