/**
 * Procedural Web Audio Engine for Jet Engine Sounds.
 * Generates realistic turbine whine, compressor airflow rush, and combustion roar
 * directly in the browser with ZERO external audio files needed!
 */

class JetAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.throttle = 0.4; // 0.0 to 1.0 (Idle to Max Thrust)

    // Audio nodes
    this.masterGain = null;
    this.spoolGain = null;
    this.noiseGain = null;
    this.rumbleGain = null;

    // Oscillators for turbine whine
    this.whineOsc1 = null;
    this.whineOsc2 = null;
    this.subRumbleOsc = null;

    // Filters for airflow hiss & rumble
    this.airFilter = null;
    this.rumbleFilter = null;
  }

  /**
   * Initializes the Web Audio context upon user interaction.
   * Simple, reliable, works in all modern browsers.
   */
  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // 1. Airflow Hiss (White noise through bandpass)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.airFilter = this.ctx.createBiquadFilter();
    this.airFilter.type = 'bandpass';
    this.airFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    this.airFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.setValueAtTime(0.15, this.ctx.currentTime);

    whiteNoise.connect(this.airFilter);
    this.airFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);
    whiteNoise.start();

    // 2. High-speed Turbine Spool Whine (Dual Detuned Sine/Triangle)
    this.whineOsc1 = this.ctx.createOscillator();
    this.whineOsc1.type = 'triangle';
    this.whineOsc1.frequency.setValueAtTime(420, this.ctx.currentTime);

    this.whineOsc2 = this.ctx.createOscillator();
    this.whineOsc2.type = 'sine';
    this.whineOsc2.frequency.setValueAtTime(845, this.ctx.currentTime);

    this.spoolGain = this.ctx.createGain();
    this.spoolGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.whineOsc1.connect(this.spoolGain);
    this.whineOsc2.connect(this.spoolGain);
    this.spoolGain.connect(this.masterGain);
    this.whineOsc1.start();
    this.whineOsc2.start();

    // 3. Deep Combustion Rumble (Low frequency sine + low-pass)
    this.subRumbleOsc = this.ctx.createOscillator();
    this.subRumbleOsc.type = 'sawtooth';
    this.subRumbleOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

    this.rumbleFilter = this.ctx.createBiquadFilter();
    this.rumbleFilter.type = 'lowpass';
    this.rumbleFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    this.subRumbleOsc.connect(this.rumbleFilter);
    this.rumbleFilter.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);
    this.subRumbleOsc.start();
  }

  /**
   * Set throttle smoothly (0.0 to 1.0)
   * Updates pitch, airflow cutoffs, and volume realistically
   */
  setThrottle(value) {
    this.throttle = Math.max(0.05, Math.min(1.0, value));
    if (!this.ctx || !this.isPlaying) return;

    const t = this.ctx.currentTime;
    const rampTime = 0.4;

    // Pitch scales with engine RPM
    const baseWhine = 320 + this.throttle * 750; // 320Hz idle to 1070Hz takeoff whine
    this.whineOsc1.frequency.setTargetAtTime(baseWhine, t, rampTime);
    this.whineOsc2.frequency.setTargetAtTime(baseWhine * 2.05, t, rampTime);

    // Rumble frequency & airflow rush
    this.subRumbleOsc.frequency.setTargetAtTime(45 + this.throttle * 40, t, rampTime);
    this.airFilter.frequency.setTargetAtTime(600 + this.throttle * 1800, t, rampTime);
    this.rumbleFilter.frequency.setTargetAtTime(100 + this.throttle * 150, t, rampTime);

    // Dynamic gains
    this.spoolGain.gain.setTargetAtTime(0.04 + this.throttle * 0.08, t, rampTime);
    this.noiseGain.gain.setTargetAtTime(0.08 + this.throttle * 0.18, t, rampTime);
    this.rumbleGain.gain.setTargetAtTime(0.06 + this.throttle * 0.14, t, rampTime);
  }

  /**
   * Start or toggle the sound
   */
  async start() {
    this.init();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isPlaying = true;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0.35, this.ctx.currentTime, 0.3);
    this.setThrottle(this.throttle);
  }

  /**
   * Stop the sound gracefully with fade-out
   */
  stop() {
    if (!this.ctx || !this.isPlaying) return;
    this.isPlaying = false;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
  }

  /**
   * Toggle between playing and stopped
   */
  async toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      await this.start();
      return true;
    }
  }
}

export const jetAudio = new JetAudioEngine();
