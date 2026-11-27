import * as Tone from 'tone';
import { EnvironmentMap } from '../../types/robot';
import { computeAmbientAudioParams, AmbientAudioParams } from './audioMixMath';

class RobotAudioSynth {
  private isMuted: boolean = false;
  private isGraphInitialized: boolean = false;
  private isUnlockListenerBound: boolean = false;
  private isStartingTone: boolean = false;

  // Tone.js Master Bus & Limiter
  private masterGain: Tone.Gain | null = null;
  private masterLimiter: Tone.Limiter | null = null;

  // Tone.js Mars Wind & Arena Environment Nodes
  private windPinkNoise: Tone.Noise | null = null;
  private windBandpass: Tone.Filter | null = null;
  private windGain: Tone.Gain | null = null;
  private windGustLfo: Tone.LFO | null = null;

  private marsBrownNoise: Tone.Noise | null = null;
  private marsLowpass: Tone.Filter | null = null;
  private marsRumbleGain: Tone.Gain | null = null;

  // Tone.js Servo Motor "Rè Rè" (PWM Pulse + Geared Sawtooth + Chatter LFO)
  private servoBuzzOsc: Tone.PulseOscillator | null = null;
  private servoBuzzFilter: Tone.Filter | null = null;
  private servoBuzzGain: Tone.Gain | null = null;
  private servoChatterLfo: Tone.LFO | null = null;

  private servoWhirOsc: Tone.Oscillator | null = null;
  private servoWhirFilter: Tone.Filter | null = null;
  private servoWhirGain: Tone.Gain | null = null;

  private lastObstacleAlertAt: number = 0;
  private lastParams: AmbientAudioParams = computeAmbientAudioParams({
    isDriveMode: false,
    isMuted: false,
    environmentMap: 'mars-planet',
    linearVelocity: 0,
    angularVelocity: 0,
    elapsedSeconds: 0,
  });

  constructor() {
    this.bindGestureUnlock();
  }

  private bindGestureUnlock() {
    if (this.isUnlockListenerBound || typeof window === 'undefined') return;
    this.isUnlockListenerBound = true;

    const handleGesture = () => {
      void this.unlock();
    };

    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
  }

  public async unlock(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const ctx = Tone.getContext();
      if (ctx.state !== 'running' && !this.isStartingTone) {
        this.isStartingTone = true;
        await Tone.start();
        this.isStartingTone = false;
      }
      if (Tone.getContext().state === 'running') {
        this.ensureAmbienceGraph();
        this.applyParams(this.lastParams, 0.12);
        return true;
      }
    } catch {
      this.isStartingTone = false;
    }
    return false;
  }

  private getRawContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const ctx = Tone.getContext();
      if (ctx.state !== 'running') {
        void this.unlock();
      }
      return ctx.rawContext as AudioContext;
    } catch {
      return null;
    }
  }

  private ensureAmbienceGraph() {
    if (this.isGraphInitialized || typeof window === 'undefined') return;
    if (Tone.getContext().state !== 'running') return;

    try {
      this.masterLimiter = new Tone.Limiter(-2).toDestination();
      this.masterGain = new Tone.Gain(this.isMuted ? 0 : 1).connect(this.masterLimiter);

      // 1. Martian Wind Layer: Pink noise through sweeping resonant bandpass + slow LFO gusts
      this.windGain = new Tone.Gain(0).connect(this.masterGain);
      this.windBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 300,
        Q: 2.1,
      }).connect(this.windGain);
      this.windPinkNoise = new Tone.Noise('pink').connect(this.windBandpass);
      this.windPinkNoise.start();

      this.windGustLfo = new Tone.LFO({
        frequency: 0.17,
        min: 190,
        max: 620,
      }).connect(this.windBandpass.frequency);
      this.windGustLfo.start();

      // 2. Martian Low Atmospheric Pressure Rumble Layer: Brown noise through lowpass
      this.marsRumbleGain = new Tone.Gain(0).connect(this.masterGain);
      this.marsLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 175,
        Q: 1.0,
      }).connect(this.marsRumbleGain);
      this.marsBrownNoise = new Tone.Noise('brown').connect(this.marsLowpass);
      this.marsBrownNoise.start();

      // 3. Servo Motor PWM "Rè Rè" Layer: Narrow-pulse digital servo buzz + chatter LFO
      this.servoBuzzGain = new Tone.Gain(0).connect(this.masterGain);
      this.servoBuzzFilter = new Tone.Filter({
        type: 'bandpass',
        frequency: 520,
        Q: 1.4,
      }).connect(this.servoBuzzGain);
      this.servoBuzzOsc = new Tone.PulseOscillator({
        frequency: 92,
        width: 0.24,
      }).connect(this.servoBuzzFilter);
      this.servoBuzzOsc.start();

      this.servoChatterLfo = new Tone.LFO({
        frequency: 24,
        min: 320,
        max: 860,
      }).connect(this.servoBuzzFilter.frequency);
      this.servoChatterLfo.start();

      // 4. Geared DC Motor / RPLIDAR Rotor Whir Layer
      this.servoWhirGain = new Tone.Gain(0).connect(this.masterGain);
      this.servoWhirFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: 480,
        Q: 0.9,
      }).connect(this.servoWhirGain);
      this.servoWhirOsc = new Tone.Oscillator({
        type: 'sawtooth',
        frequency: 132,
      }).connect(this.servoWhirFilter);
      this.servoWhirOsc.start();

      this.isGraphInitialized = true;
    } catch {
      // Ignore Web Audio initialization failure in restricted environments
    }
  }

  private applyParams(params: AmbientAudioParams, rampSec = 0.08) {
    if (!this.isGraphInitialized) return;
    const now = Tone.now();

    if (this.masterGain) {
      this.masterGain.gain.rampTo(this.isMuted ? 0 : 1, 0.06, now);
    }
    if (this.windGain) {
      this.windGain.gain.rampTo(params.windGain, rampSec, now);
    }
    if (this.windGustLfo) {
      const minHz = Math.max(120, params.windCutoffHz * 0.55);
      const maxHz = Math.min(1400, params.windCutoffHz * 1.45);
      this.windGustLfo.min = minHz;
      this.windGustLfo.max = maxHz;
    }
    if (this.marsRumbleGain) {
      this.marsRumbleGain.gain.rampTo(params.marsRumbleGain, rampSec, now);
    }
    if (this.servoBuzzGain) {
      this.servoBuzzGain.gain.rampTo(params.servoBuzzGain, rampSec, now);
    }
    if (this.servoBuzzOsc) {
      this.servoBuzzOsc.frequency.rampTo(params.servoBuzzFreqHz, rampSec, now);
    }
    if (this.servoChatterLfo) {
      this.servoChatterLfo.frequency.rampTo(params.servoChatterRateHz, rampSec, now);
      this.servoChatterLfo.min = Math.max(240, params.servoFilterHz * 0.6);
      this.servoChatterLfo.max = Math.min(2200, params.servoFilterHz * 1.45);
    }
    if (this.servoWhirGain) {
      this.servoWhirGain.gain.rampTo(params.servoWhirGain, rampSec, now);
    }
    if (this.servoWhirOsc) {
      this.servoWhirOsc.frequency.rampTo(params.servoWhirFreqHz, rampSec, now);
    }
    if (this.servoWhirFilter) {
      this.servoWhirFilter.frequency.rampTo(params.servoFilterHz, rampSec, now);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!muted) {
      void this.unlock();
    }
    this.lastParams = {
      ...this.lastParams,
      ...(muted
        ? {
            active: false,
            windGain: 0,
            marsRumbleGain: 0,
            servoBuzzGain: 0,
            servoWhirGain: 0,
          }
        : {}),
    };
    if (this.isGraphInitialized) {
      const now = Tone.now();
      this.masterGain?.gain.rampTo(muted ? 0 : 1, 0.06, now);
      if (muted) {
        this.windGain?.gain.rampTo(0, 0.06, now);
        this.marsRumbleGain?.gain.rampTo(0, 0.06, now);
        this.servoBuzzGain?.gain.rampTo(0, 0.06, now);
        this.servoWhirGain?.gain.rampTo(0, 0.06, now);
      }
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  public toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Updates environmental ambient audio (Martian wind + servo buzzing) continuously during Drive Mode.
   */
  public updateDriveAmbience(
    isDriveMode: boolean,
    environmentMap: EnvironmentMap,
    linearVelocity: number,
    angularVelocity: number,
    elapsedSeconds: number
  ) {
    const nextParams = computeAmbientAudioParams({
      isDriveMode,
      isMuted: this.isMuted,
      environmentMap,
      linearVelocity,
      angularVelocity,
      elapsedSeconds,
    });
    this.lastParams = nextParams;

    if (!isDriveMode || this.isMuted) {
      if (this.isGraphInitialized) {
        this.applyParams(nextParams, 0.18);
      }
      return;
    }

    if (Tone.getContext().state === 'running') {
      this.ensureAmbienceGraph();
      this.applyParams(nextParams, 0.08);
    }
  }

  // Preserved backward-compatible API
  public updateMotorSound(speed: number) {
    this.updateDriveAmbience(Math.abs(speed) > 0.02, 'mars-planet', speed, 0, performance.now() * 0.001);
  }

  public getStatus() {
    let contextState = 'unavailable';
    try {
      contextState = Tone.getContext().state;
    } catch {}
    return {
      library: 'tone',
      contextState,
      isGraphInitialized: this.isGraphInitialized,
      isMuted: this.isMuted,
      active: this.lastParams.active,
      windGain: this.lastParams.windGain,
      servoBuzzGain: this.lastParams.servoBuzzGain,
    };
  }

  public playClick(pitch = 800) {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // Audio autoplay policy catch
    }
  }

  public playObstacleAlert(distance: number) {
    if (this.isMuted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastObstacleAlertAt < 190) return;
    this.lastObstacleAlertAt = nowMs;

    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const freq = Math.max(400, Math.min(1200, 1500 - distance * 1000));
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.085);
    } catch {
      // Ignore
    }
  }

  public playObstacleCrash() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const thumpOsc = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thumpOsc.type = 'triangle';
      thumpOsc.frequency.setValueAtTime(140, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

      thumpGain.gain.setValueAtTime(0.2, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      thumpOsc.connect(thumpGain);
      thumpGain.connect(ctx.destination);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.23);

      for (let i = 0; i < 3; i++) {
        const clatterTime = now + 0.04 + i * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320 - i * 60, clatterTime);
        osc.frequency.exponentialRampToValueAtTime(120, clatterTime + 0.06);

        gain.gain.setValueAtTime(0.08 / (i + 1), clatterTime);
        gain.gain.exponentialRampToValueAtTime(0.001, clatterTime + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(clatterTime);
        osc.stop(clatterTime + 0.07);
      }
    } catch {
      // Ignore audio error
    }
  }

  public playAlienChirp() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.16);
      osc.frequency.exponentialRampToValueAtTime(1450, now + 0.24);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.28);
    } catch {}
  }

  public playAlienEncounter() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [587.33, 880, 1174.66].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.04);
        gain.gain.setValueAtTime(0.04, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + 0.46);
      });
    } catch {}
  }

  public playChargingDock() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.06, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.36);
      });
    } catch {}
  }

  public playAstronautPanic() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [987.77, 1318.51, 1567.98].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.045, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.13);
      });
    } catch {}
  }

  public playDiggingSound() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const clinkOsc = ctx.createOscillator();
      const clinkGain = ctx.createGain();
      clinkOsc.type = 'triangle';
      clinkOsc.frequency.setValueAtTime(240, now);
      clinkOsc.frequency.exponentialRampToValueAtTime(110, now + 0.16);
      clinkGain.gain.setValueAtTime(0.09, now);
      clinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      clinkOsc.connect(clinkGain);
      clinkGain.connect(ctx.destination);
      clinkOsc.start(now);
      clinkOsc.stop(now + 0.2);

      const metalOsc = ctx.createOscillator();
      const metalGain = ctx.createGain();
      metalOsc.type = 'sine';
      metalOsc.frequency.setValueAtTime(1480, now + 0.05);
      metalOsc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
      metalGain.gain.setValueAtTime(0.04, now + 0.05);
      metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      metalOsc.connect(metalGain);
      metalGain.connect(ctx.destination);
      metalOsc.start(now + 0.05);
      metalOsc.stop(now + 0.25);
    } catch {}
  }

  public playDiscoveryFanfare(tier: 'red' | 'purple' | 'blue' | 'green' | 'gray') {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      let notes: number[] = [];
      let baseGain = 0.07;

      switch (tier) {
        case 'red':
          notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
          baseGain = 0.09;
          break;
        case 'purple':
          notes = [440, 554.37, 659.25, 880, 1108.73];
          baseGain = 0.08;
          break;
        case 'blue':
          notes = [523.25, 659.25, 783.99, 1046.5];
          baseGain = 0.07;
          break;
        case 'green':
          notes = [587.33, 739.99, 880];
          baseGain = 0.06;
          break;
        case 'gray':
        default:
          notes = [523.25, 659.25];
          baseGain = 0.05;
          break;
      }

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tier === 'red' || tier === 'purple' ? 'sine' : 'triangle';
        const startT = now + idx * 0.075;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(baseGain, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.45);
      });
    } catch {}
  }

  public playBackpackOpen() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [600, 900, 1200].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.04, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.09);
      });
    } catch {}
  }

  public playAstronautReceiveChime() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [659.25, 880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const startT = now + idx * 0.055;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.065, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.24);
      });
    } catch {}
  }

  public playAirlockHiss(isPressurize = true) {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dur = 0.65;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.45));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isPressurize ? 900 : 1800, now);
      filter.frequency.exponentialRampToValueAtTime(isPressurize ? 2200 : 520, now + dur);
      filter.Q.value = 1.6;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    } catch {}
  }

  public playAirlockReadyChime() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const startT = now + idx * 0.08;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.06, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.25);
      });
    } catch {}
  }

  public playWateringMist() {
    if (this.isMuted) return;
    const ctx = this.getRawContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const dur = 0.28;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2600;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.028, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    } catch {}
  }

  public stopAll() {
    if (!this.isGraphInitialized) return;
    try {
      const now = Tone.now();
      this.windGain?.gain.rampTo(0, 0.05, now);
      this.marsRumbleGain?.gain.rampTo(0, 0.05, now);
      this.servoBuzzGain?.gain.rampTo(0, 0.05, now);
      this.servoWhirGain?.gain.rampTo(0, 0.05, now);
    } catch {}
  }
}

export const robotAudio = new RobotAudioSynth();
