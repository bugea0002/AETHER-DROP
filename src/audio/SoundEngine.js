// Module: src/audio/SoundEngine.js
__define("src/audio/SoundEngine.js", (__exports, __require) => {
const { EVENTS } = __require("src/config/constants.js");

// D minor cyberpunk synth bass & tension arp frequencies (Hz)
const BASS_PATTERN_HZ = [
  73.42, 73.42, 73.42, 87.31,
  73.42, 73.42, 65.41, 73.42,
  58.27, 58.27, 58.27, 65.41,
  55.00, 55.00, 65.41, 82.41,
];

const ARP_PATTERN_HZ = [
  293.66, 440.00, 349.23, 523.25,
  293.66, 440.00, 587.33, 440.00,
  233.08, 349.23, 440.00, 349.23,
  220.00, 329.63, 440.00, 523.25,
];

const STEP_DURATION_SEC = 60 / 124 / 4; // 124 BPM 16th notes (~0.121s)
const PANNER_POOL_SIZE = 12;

/**
 * NEON PROTOCOL — Studio-Grade Procedural Web Audio API Synthesizer & 3D Spatial Sound Engine
 * Zero external audio assets. Features layered weapon synthesis per firearm, tactile mechanical
 * foley, golden crystalline headshot chimes, combo-scaled kill confirms, 3D HRTF/equalpower
 * PannerNode spatialization for explosions & enemy fire, and a sample-accurate adaptive
 * cyberpunk synth combat pulse.
 */
class SoundEngine {
  /**
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {THREE.Camera|null} [camera=null]
   */
  constructor(eventBus, camera = null) {
    this.eventBus = eventBus || null;
    this.camera = camera || null;

    /** @type {AudioContext|null} */
    this.ctx = null;
    this._masterGain = null;
    this._sfxGain = null;
    this._musicGain = null;
    this._compressor = null;
    this._whiteNoiseBuffer = null;
    this._pinkNoiseBuffer = null;
    this._pannerPool = [];
    this._pannerCursor = 0;

    this._masterVolume = 0.78;
    this._muted = false;
    this._musicEnabled = true;
    this._inGameplay = true;
    this._disposed = false;

    // Adaptive cyberpunk synth pulse state
    this._targetIntensity = 0.0;
    this._currentIntensity = 0.0;
    this._nextStepTime = 0;
    this._stepIndex = 0;

    // Anti-stacking rate-limit timestamps (seconds)
    this._lastHitmarkerTime = -1;
    this._lastHeadshotTime = -1;
    this._lastKillSoundTime = -1;
    this._lastHealTime = -1;
    this._lastEnemyShotTime = -1;
    this._lastFootstepTime = -1;

    this._unsubs = [];
    this._bindEvents();
  }

  /**
   * Subscribe cleanly to all NEON PROTOCOL combat, movement, and wave events.
   * @private
   */
  _bindEvents() {
    if (!this.eventBus) return;
    const on = (evt, fn) => {
      this._unsubs.push(this.eventBus.on(evt, fn));
    };

    on(EVENTS.WEAPON_FIRED, (p) => this._onWeaponFired(p));
    on(EVENTS.WEAPON_RELOAD_START, () => this._playReloadStart());
    on(EVENTS.WEAPON_RELOADED, () => this._playReloadFinish());
    on(EVENTS.WEAPON_SWITCHED, () => this._playWeaponSwitch());
    on(EVENTS.WEAPON_MELEE, () => this._playMeleeSlash());
    on(EVENTS.DAMAGE_DEALT, (p) => this._onDamageDealt(p));
    on(EVENTS.ENEMY_KILLED, (p) => this._onEnemyKilled(p));
    on(EVENTS.PLAYER_DASH, () => this._playDash());
    on(EVENTS.PLAYER_SLIDE, () => this._playSlide());
    on(EVENTS.PLAYER_JUMP, (p) => this._playJump(p));
    on(EVENTS.PLAYER_JUMPPAD, () => this._playJumpPad());
    on(EVENTS.PLAYER_FOOTSTEP, (p) => this._playFootstep(p));
    on(EVENTS.PLAYER_DAMAGED, (p) => this._playPlayerDamaged(p));
    on(EVENTS.PLAYER_HEALED, () => this._playHeal());
    on(EVENTS.PICKUP_COLLECTED, (p) => this._playPickup(p));
    on(EVENTS.BARREL_EXPLODED, (p) => this._playBarrelExplosion(p));
    on(EVENTS.ZONE_PROGRESS, (p) => this._playZoneProgress(p));
    on(EVENTS.MAP_TRANSITION, () => this._playMapTransition());
    on(EVENTS.WAVE_STARTED, (p) => this._playWaveStarted(p));
    on(EVENTS.WAVE_CLEARED, (p) => this._playWaveCleared(p));
    on(EVENTS.BOSS_PHASE, (p) => this._playBossPhase(p));
    on(EVENTS.GOLD_COLLECTED, () => this._playGoldPickup());
    on(EVENTS.WEAPON_DROPPED, (p) => this._playWeaponDropPickup(p));
    on(EVENTS.UPGRADE_SELECTED, () => this._playUpgradeSelected());
    on(EVENTS.GAME_STATE, (p) => this._onGameState(p));
    on('SFX_SNIPER_LOCK', () => this._playSniperLock());
    on('SFX_BOSS_TELEGRAPH', (p) => this._playBossTelegraph(p));
    on('SFX_WEAPON_DRY', (p) => this._playDryOrOverheat(p));
    on('SFX_DASH_READY', () => this._playDashReady());
    on('SFX_RANK_UP', (p) => this._playRankUp(p));
    on('SFX_SYNERGY', () => this._playSynergy());
  }

  /**
   * Gracefully unlock or create Web Audio context on first user gesture.
   * Never throws if AudioContext is unsupported or blocked by autoplay policy.
   */
  unlock() {
    if (this._disposed) return;
    try {
      if (!this.ctx) {
        const AudioCtx =
          typeof window !== 'undefined'
            ? window.AudioContext || window.webkitAudioContext
            : null;
        if (!AudioCtx) return;

        this.ctx = new AudioCtx();
        this._buildAudioGraph();
        this._generateNoiseBuffers();
        this._initPannerPool();
        this._nextStepTime = this.ctx.currentTime + 0.08;
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        const p = this.ctx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }
    } catch {
      // Gracefully ignore restricted environments
    }
  }

  /** @private */
  _buildAudioGraph() {
    const ctx = this.ctx;
    this._compressor = ctx.createDynamicsCompressor();
    this._compressor.threshold.setValueAtTime(-14, ctx.currentTime);
    this._compressor.knee.setValueAtTime(12, ctx.currentTime);
    this._compressor.ratio.setValueAtTime(4.0, ctx.currentTime);
    this._compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    this._compressor.release.setValueAtTime(0.14, ctx.currentTime);

    this._masterGain = ctx.createGain();
    this._masterGain.gain.setValueAtTime(
      this._muted ? 0 : this._masterVolume,
      ctx.currentTime
    );

    this._sfxGain = ctx.createGain();
    this._sfxGain.gain.setValueAtTime(1.0, ctx.currentTime);

    this._musicGain = ctx.createGain();
    this._musicGain.gain.setValueAtTime(this._musicEnabled ? 0.24 : 0.0, ctx.currentTime);

    this._sfxGain.connect(this._masterGain);
    this._musicGain.connect(this._masterGain);
    this._masterGain.connect(this._compressor);
    this._compressor.connect(ctx.destination);
  }

  /**
   * Pre-generate stereo white & Paul Kellet pink noise AudioBuffers once on unlock.
   * @private
   */
  _generateNoiseBuffers() {
    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate || 44100;
    const length = Math.floor(sampleRate * 2.0);

    // White noise
    const white = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = white.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    this._whiteNoiseBuffer = white;

    // Warm 1/f Pink noise (Paul Kellet's filter)
    const pink = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = pink.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    this._pinkNoiseBuffer = pink;
  }

  /** @private */
  _isReady() {
    return Boolean(
      !this._disposed &&
        this.ctx &&
        !this._muted &&
        this._sfxGain &&
        this.ctx.state === 'running'
    );
  }

  /**
   * Set master output volume (0..1).
   * @param {number} vol
   */
  setMasterVolume(vol) {
    this._masterVolume = Math.max(0, Math.min(1, Number(vol) || 0));
    if (this.ctx && this._masterGain) {
      const target = this._muted ? 0 : this._masterVolume;
      try {
        this._masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
      } catch {
        this._masterGain.gain.value = target;
      }
    }
  }

  /**
   * Toggle mute state cleanly.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this._muted = Boolean(muted);
    if (this.ctx && this._masterGain) {
      const target = this._muted ? 0 : this._masterVolume;
      try {
        this._masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
      } catch {
        this._masterGain.gain.value = target;
      }
    }
  }

  /**
   * Set target adaptive combat intensity (0..1) driving the cyberpunk synth combat pulse.
   * @param {number} level
   */
  setCombatIntensity(level) {
    this._targetIntensity = Math.max(0, Math.min(1, Number(level) || 0));
  }

  /**
   * Enable or disable the adaptive cyberpunk synth combat pulse.
   * @param {boolean} enabled
   */
  setMusicEnabled(enabled) {
    this._musicEnabled = Boolean(enabled);
    if (this.ctx && this._musicGain) {
      const target = this._musicEnabled && this._inGameplay ? 0.24 : 0.0;
      try {
        this._musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      } catch {
        this._musicGain.gain.value = target;
      }
    }
  }

  /** @private */
  _onGameState(payload) {
    const state = typeof payload === 'string' ? payload : payload && payload.state;
    this._inGameplay = state === 'playing';
    if (this.ctx && this._musicGain) {
      const target = this._musicEnabled && this._inGameplay ? 0.24 : 0.0;
      try {
        this._musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
      } catch {
        this._musicGain.gain.value = target;
      }
    }
  }

  /**
   * Pre-allocate a fixed ring-buffer pool of 12 reusable 'equalpower' PannerNodes
   * connected once to _sfxGain (zero per-shot node leaks, mobile-friendly CPU cost).
   * @private
   */
  _initPannerPool() {
    const ctx = this.ctx;
    this._pannerPool.length = 0;
    this._pannerCursor = 0;
    if (!ctx || !this._sfxGain || typeof ctx.createPanner !== 'function') return;

    for (let i = 0; i < PANNER_POOL_SIZE; i++) {
      const panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 5.5;
      panner.maxDistance = 75;
      panner.rolloffFactor = 1.15;
      panner.connect(this._sfxGain);
      this._pannerPool.push(panner);
    }
  }

  /**
   * Acquire and reposition a pooled 3D PannerNode from the ring buffer.
   * @private
   */
  _getSpatialPanner(worldPos, refDistance = 5.5, maxDistance = 75, rolloff = 1.15) {
    if (!this._pannerPool.length) {
      return this._sfxGain;
    }

    const panner = this._pannerPool[this._pannerCursor];
    this._pannerCursor = (this._pannerCursor + 1) % this._pannerPool.length;

    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = rolloff;

    const x = worldPos ? Number(worldPos.x) || 0 : 0;
    const y = worldPos ? Number(worldPos.y) || 0 : 0;
    const z = worldPos ? Number(worldPos.z) || 0 : 0;
    const now = this.ctx.currentTime;

    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, now);
      panner.positionY.setValueAtTime(y, now);
      panner.positionZ.setValueAtTime(z, now);
    } else if (typeof panner.setPosition === 'function') {
      panner.setPosition(x, y, z);
    }

    return panner;
  }

  /**
   * Helper to play a filtered noise burst cleanly with leak-free leaf node teardown.
   * @private
   */
  _playNoiseBurst(
    dest,
    startTime,
    duration,
    gainPeak,
    filterType,
    freqStart,
    freqEnd,
    Q = 1.0,
    usePink = false
  ) {
    const ctx = this.ctx;
    const buf = usePink ? this._pinkNoiseBuffer : this._whiteNoiseBuffer;
    if (!buf) return;

    const safePeak = Math.max(0.0005, Number(gainPeak) || 0.0005);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const offset = Math.random() * Math.max(0.05, buf.duration - duration - 0.05);

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(Q, startTime);
    filter.frequency.setValueAtTime(Math.max(20, freqStart), startTime);
    if (freqEnd && freqEnd !== freqStart) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(safePeak, startTime + Math.min(0.008, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    src.onended = () => {
      try {
        src.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };

    src.start(startTime, offset, duration + 0.02);
    src.stop(startTime + duration + 0.03);
  }

  /**
   * Helper to play a pitched oscillator envelope with leak-free leaf node teardown.
   * @private
   */
  _playTone(
    dest,
    type,
    startTime,
    duration,
    freqStart,
    freqEnd,
    gainPeak,
    attack = 0.004,
    filterFreq = 0
  ) {
    const ctx = this.ctx;
    const safePeak = Math.max(0.0005, Number(gainPeak) || 0.0005);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), startTime);
    if (freqEnd && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(safePeak, startTime + Math.min(attack, duration * 0.4));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    let lp = null;
    if (filterFreq > 0) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(filterFreq, startTime);
      osc.connect(lp);
      lp.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(dest);

    osc.onended = () => {
      try {
        osc.disconnect();
        if (lp) lp.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.025);
  }

  // ===========================================================================
  // WEAPON SYNTHESIS (4 Distinct Layered Sci-Fi Firearms)
  // ===========================================================================

  /** @private */
  _onWeaponFired(payload) {
    if (!this._isReady()) return;
    try {
      const id =
        (typeof payload === 'string' && payload) ||
        (payload && (payload.weaponId || (payload.weapon && payload.weapon.id) || payload.id)) ||
        'pulse_rifle';

      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const pj = 0.95 + Math.random() * 0.10;

      // Grounded Military-SF Ballistic & Mechanical Foley (Zero Neon Laser Sweeps)
      switch (id) {
        case 'scattergun':
          // BR-12 12-GAUGE BREACHER: Massive chest-thump + wide gunpowder blast + heavy steel pump rack
          this._playTone(dest, 'sine', now, 0.24, 98 * pj, 22, 0.86, 0.001);
          this._playNoiseBurst(dest, now, 0.035, 0.72, 'bandpass', 1250 * pj, 420, 0.9, false);
          this._playNoiseBurst(dest, now, 0.26, 0.78, 'lowpass', 1900, 140, 0.75, true);
          this._playNoiseBurst(dest, now + 0.02, 0.18, 0.34, 'lowpass', 620, 110, 0.8, true);
          // Dual-stage steel pump rack (chk-chk)
          this._playNoiseBurst(dest, now + 0.19, 0.042, 0.26, 'bandpass', 1350, 780, 3.8, false);
          this._playNoiseBurst(dest, now + 0.29, 0.048, 0.30, 'bandpass', 1950, 1100, 4.2, false);
          break;

        case 'railgun':
          // HV-7 ANTI-MATERIEL LANCE: Dry supersonic ballistic whip-crack + crushing sub-cannon boom
          this._playTone(dest, 'sine', now, 0.42, 112 * pj, 20, 0.90, 0.001);
          this._playNoiseBurst(dest, now, 0.028, 0.74, 'bandpass', 2400 * pj, 650, 1.1, false);
          this._playNoiseBurst(dest, now + 0.008, 0.28, 0.72, 'lowpass', 1650, 130, 0.8, true);
          // Heavy steel breech lock slam
          this._playNoiseBurst(dest, now + 0.055, 0.07, 0.28, 'bandpass', 920, 420, 3.2, false);
          break;

        case 'plasma_smg':
          // K-9 SCRAPPER PDW: Tight high-RPM carbine bark + rapid steel bolt rattle
          this._playTone(dest, 'sine', now, 0.048, 128 * pj, 42, 0.46, 0.001);
          this._playNoiseBurst(dest, now, 0.032, 0.46, 'bandpass', 1650 * pj, 580, 1.3, false);
          this._playNoiseBurst(dest, now, 0.055, 0.34, 'lowpass', 2200, 320, 0.9, true);
          this._playNoiseBurst(dest, now + 0.022, 0.018, 0.16, 'bandpass', 2600, 1800, 3.5, false);
          break;

        case 'weld_pistol':
          // W-01 THERMAL TORCH PISTOL: Pressurized gas ignition whoomp + dry striker click
          this._playTone(dest, 'sine', now, 0.065, 135 * pj, 48, 0.36, 0.001);
          this._playNoiseBurst(dest, now, 0.09, 0.44, 'bandpass', 980 * pj, 320, 1.1, true);
          this._playNoiseBurst(dest, now, 0.045, 0.30, 'bandpass', 2400, 1200, 1.6, false);
          break;

        case 'arc_rivet':
          // T-4 PNEUMATIC RIVET DRIVER: Compressed-air piston slam + solid steel anvil thud
          this._playTone(dest, 'sine', now, 0.11, 165 * pj, 38, 0.56, 0.001);
          this._playNoiseBurst(dest, now, 0.024, 0.54, 'bandpass', 1900 * pj, 720, 2.4, false);
          this._playNoiseBurst(dest, now + 0.012, 0.095, 0.38, 'lowpass', 1400, 260, 1.0, true);
          break;

        case 'repulsor':
          // K-0 KINETIC AIR-CANNON: Deep concussive pressure wave + hydraulic exhaust hiss
          this._playTone(dest, 'sine', now, 0.28, 118 * pj, 22, 0.88, 0.001);
          this._playNoiseBurst(dest, now, 0.22, 0.68, 'lowpass', 1200, 120, 0.8, true);
          this._playNoiseBurst(dest, now + 0.08, 0.14, 0.28, 'bandpass', 2100, 950, 1.8, false);
          break;

        case 'pulse_rifle':
        default:
          // M41-A 7.62 KINETIC RIFLE: Punchy ballistic gunpowder crack + chest thump + steel bolt clack
          this._playTone(dest, 'sine', now, 0.082, 108 * pj, 32, 0.62, 0.001);
          this._playNoiseBurst(dest, now, 0.026, 0.56, 'bandpass', 1750 * pj, 620, 1.35, false);
          this._playNoiseBurst(dest, now, 0.095, 0.52, 'lowpass', 2350 * pj, 280, 0.9, true);
          this._playNoiseBurst(dest, now + 0.030, 0.022, 0.18, 'bandpass', 2800, 1900, 4.2, false);
          break;
      }

      // Low-Ammo Dry Metallic Chamber Ping (last 25% of magazine — mechanical, not synth)
      if (
        payload &&
        Number.isFinite(payload.ammo) &&
        Number.isFinite(payload.magSize) &&
        payload.magSize > 0 &&
        payload.ammo <= Math.ceil(payload.magSize * 0.25)
      ) {
        this._playNoiseBurst(dest, now + 0.028, 0.018, 0.20, 'bandpass', 3200, 2400, 6.0, false);
      }
    } catch {
      // Safe fallback
    }
  }

  // ===========================================================================
  // RELOAD, SWITCH & MELEE FOLEY
  // ===========================================================================

  /** @private */
  _playReloadStart() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Mechanical mag catch release click + hollow eject slide
      this._playNoiseBurst(dest, now, 0.03, 0.24, 'bandpass', 2600, 1600, 4.5, false);
      this._playTone(dest, 'triangle', now + 0.03, 0.095, 440, 175, 0.16, 0.004);
      this._playNoiseBurst(dest, now + 0.05, 0.08, 0.14, 'bandpass', 1100, 520, 2.4, true);
    } catch {}
  }

  /** @private */
  _playReloadFinish() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Stage 1: Heavy steel magazine lock-in thud
      this._playTone(dest, 'sine', now, 0.06, 155, 52, 0.36, 0.002);
      this._playNoiseBurst(dest, now, 0.035, 0.28, 'bandpass', 1750, 820, 3.6, false);
      // Stage 2: Dry mechanical bolt rack (chk-clack, zero synth beep)
      this._playNoiseBurst(dest, now + 0.10, 0.034, 0.26, 'bandpass', 2200, 1300, 4.4, false);
      this._playNoiseBurst(dest, now + 0.145, 0.042, 0.30, 'bandpass', 2900, 1650, 4.8, false);
    } catch {}
  }

  /** @private */
  _playWeaponSwitch() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Tactical weapon sling rustle + mechanical receiver click
      this._playNoiseBurst(dest, now, 0.065, 0.18, 'bandpass', 1100, 620, 2.2, true);
      this._playNoiseBurst(dest, now + 0.04, 0.024, 0.20, 'bandpass', 2500, 1700, 4.8, false);
    } catch {}
  }

  /** @private */
  _playMeleeSlash() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Heavy steel pry-blade air-cleave whoosh + servo swing (zero neon sawtooth)
      this._playNoiseBurst(dest, now, 0.16, 0.46, 'bandpass', 420, 2200, 1.4, true);
      this._playNoiseBurst(dest, now + 0.06, 0.14, 0.30, 'lowpass', 1800, 320, 1.1, true);
      this._playTone(dest, 'sine', now, 0.11, 140, 46, 0.38, 0.003);
    } catch {}
  }

  // ===========================================================================
  // COMBAT FEEDBACK (Hitmarkers, Golden Headshot Chime, Combo Kill Confirm)
  // ===========================================================================

  /** @private */
  _onDamageDealt(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isHeadshot = Boolean(payload && payload.isHeadshot);
      const blockedByShield = Boolean(payload && payload.blockedByShield);

      if (isHeadshot) {
        if (now - this._lastHeadshotTime < 0.035) return;
        this._lastHeadshotTime = now;
        this._lastHitmarkerTime = now;

        // Visceral Armored Helmet Metallic Crack/Dink (Dry Tactical Impact, Zero Neon Bell)
        this._playTone(dest, 'sine', now, 0.055, 220, 68, 0.36, 0.001);
        this._playNoiseBurst(dest, now, 0.024, 0.42, 'bandpass', 2900, 1400, 3.2, false);
        this._playNoiseBurst(dest, now + 0.012, 0.048, 0.34, 'bandpass', 1850, 920, 5.5, false);
        return;
      }

      if (now - this._lastHitmarkerTime < 0.025) return;
      this._lastHitmarkerTime = now;

      if (blockedByShield) {
        // Heavy Steel Riot-Shield Ricochet Thud
        this._playTone(dest, 'sine', now, 0.06, 320, 140, 0.24, 0.001);
        this._playNoiseBurst(dest, now, 0.045, 0.28, 'bandpass', 1450, 680, 4.0, false);
        return;
      }

      // Dry Tactile Ballistic Body Hitmarker Tick
      this._playTone(dest, 'sine', now, 0.025, 360, 140, 0.18, 0.001);
      this._playNoiseBurst(dest, now, 0.015, 0.24, 'bandpass', 2200, 1300, 2.5, false);
    } catch {}
  }

  /** @private */
  _onEnemyKilled(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const isBoss = Boolean(payload && payload.isBoss);
      if (!isBoss && now - this._lastKillSoundTime < 0.055) return;
      this._lastKillSoundTime = now;

      const dest = this._sfxGain;
      const combo = Math.max(1, Math.min(5, Number(payload && payload.combo) || 1));
      const pitchMult = 1 + (combo - 1) * 0.06;

      // Grounded Mechanical Kill-Confirm: Deep kinetic thump + scrap crunch + crisp tactical bolt click
      this._playTone(dest, 'sine', now, 0.13, 118, 32, 0.56, 0.002);
      this._playNoiseBurst(dest, now, 0.095, 0.42, 'bandpass', 1050 * pitchMult, 240, 1.4, true);
      this._playNoiseBurst(dest, now + 0.032, 0.028, 0.30, 'bandpass', 2350 * pitchMult, 1550, 4.8, false);
      this._playNoiseBurst(dest, now + 0.064, 0.024, 0.24, 'bandpass', 3100 * pitchMult, 2100, 5.2, false);

      if (isBoss) {
        // Colossal scrap-titan reactor collapse detonation
        this._playTone(dest, 'sine', now, 1.15, 92, 18, 0.90, 0.006);
        this._playNoiseBurst(dest, now, 1.30, 0.78, 'lowpass', 1800, 95, 0.8, true);
        this._playNoiseBurst(dest, now + 0.08, 0.55, 0.44, 'bandpass', 780, 180, 1.5, true);
      }
    } catch {}
  }

  // ===========================================================================
  // PLAYER MOVEMENT & VITALITY AUDIO
  // ===========================================================================

  /** @private */
  _playDash() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Pressurized Jump-Jet Thruster Burst (grounded pneumatic ignition + rush of air)
      this._playTone(dest, 'sine', now, 0.15, 135, 38, 0.50, 0.002);
      this._playNoiseBurst(dest, now, 0.19, 0.46, 'bandpass', 950, 280, 1.2, true);
      this._playNoiseBurst(dest, now, 0.08, 0.28, 'highpass', 2200, 1100, 1.4, false);
    } catch {}
  }

  /** @private */
  _playSlide() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Gritty armored-boot concrete/steel gravel slide scrape
      this._playNoiseBurst(dest, now, 0.42, 0.32, 'bandpass', 1050, 380, 1.9, true);
      this._playNoiseBurst(dest, now, 0.18, 0.18, 'highpass', 2600, 1600, 1.3, false);
      this._playTone(dest, 'sine', now, 0.11, 115, 44, 0.28, 0.004);
    } catch {}
  }

  /** @private */
  _playJump(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isDouble = Boolean(payload && payload.isDoubleJump);
      if (isDouble) {
        // Mid-air pneumatic thruster kick (no arcade rising triangle tone)
        this._playTone(dest, 'sine', now, 0.12, 148, 52, 0.36, 0.002);
        this._playNoiseBurst(dest, now, 0.15, 0.36, 'bandpass', 1200, 420, 1.3, true);
      } else {
        // Mechanical exo-leg hydraulic push-off
        this._playTone(dest, 'sine', now, 0.08, 120, 48, 0.26, 0.002);
        this._playNoiseBurst(dest, now, 0.07, 0.18, 'bandpass', 820, 440, 1.6, true);
      }
    } catch {}
  }

  /** @private */
  _playJumpPad() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Heavy industrial pneumatic piston launch + compressed air blast
      this._playTone(dest, 'sine', now, 0.28, 130, 36, 0.56, 0.003);
      this._playNoiseBurst(dest, now, 0.34, 0.48, 'bandpass', 720, 2100, 1.4, true);
      this._playNoiseBurst(dest, now + 0.04, 0.22, 0.26, 'highpass', 2400, 1200, 1.5, false);
    } catch {}
  }

  /** @private */
  _playFootstep(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      if (now - this._lastFootstepTime < 0.11) return;
      this._lastFootstepTime = now;

      const dest = this._sfxGain;
      const isLanding = Boolean(payload && payload.isLanding);
      const sprinting = Boolean(payload && payload.sprinting);
      const jitter = 0.9 + Math.random() * 0.2;

      if (isLanding) {
        this._playTone(dest, 'sine', now, 0.11, 115 * jitter, 38, 0.32, 0.003);
        this._playNoiseBurst(dest, now, 0.08, 0.20, 'lowpass', 750, 220, 1.0, true);
      } else {
        const vol = sprinting ? 0.11 : 0.075;
        this._playTone(dest, 'sine', now, 0.045, 98 * jitter, 46, vol, 0.002);
        this._playNoiseBurst(dest, now, 0.032, vol * 0.9, 'bandpass', 1200 * jitter, 520, 2.2, true);
      }
    } catch {}
  }

  /** @private */
  _playPlayerDamaged(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const shieldDmg = Number(payload && payload.shieldDamage) || 0;
      const healthDmg = Number(payload && payload.healthDamage) || 0;
      const shieldBroken = Boolean(payload && payload.shieldBroken);
      const isFatal = Boolean(payload && payload.isFatal);

      // Heavy directional impact thud
      this._playTone(dest, 'sine', now, 0.18, 125, 34, 0.55, 0.003);

      if (shieldBroken) {
        // Distinct Shield Shatter: ceramic/glass crack + pressure drop warning
        this._playNoiseBurst(dest, now, 0.28, 0.56, 'highpass', 2600, 900, 1.4, false);
        this._playTone(dest, 'sawtooth', now, 0.34, 780, 95, 0.28, 0.002, 1600);
        this._playTone(dest, 'sine', now, 0.32, 220, 44, 0.45, 0.003);
      } else if (shieldDmg > 0) {
        // Kinetic shield impact absorption
        this._playNoiseBurst(dest, now, 0.12, 0.26, 'bandpass', 2100, 620, 2.2, false);
        this._playTone(dest, 'triangle', now, 0.10, 460, 175, 0.15, 0.003, 1500);
      }
      if (healthDmg > 0) {
        // Visceral hull/vitality crunch
        this._playNoiseBurst(dest, now, 0.20, 0.42, 'lowpass', 950, 160, 1.1, true);
      }
      if (isFatal) {
        // System shutdown power-down sweep
        this._playTone(dest, 'sawtooth', now + 0.04, 0.72, 320, 38, 0.30, 0.01, 900);
      }
    } catch {}
  }

  /** @private */
  _playHeal() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      if (now - this._lastHealTime < 0.22) return;
      this._lastHealTime = now;
      const dest = this._sfxGain;
      // Pressurized med-injector pneumatic hiss + warm mechanical seal (zero arcade chime)
      this._playNoiseBurst(dest, now, 0.16, 0.26, 'bandpass', 2600, 1400, 2.0, false);
      this._playTone(dest, 'sine', now, 0.14, 190, 260, 0.20, 0.01);
      this._playNoiseBurst(dest, now + 0.10, 0.03, 0.18, 'bandpass', 1800, 1200, 4.5, false);
    } catch {}
  }

  /** @private */
  _playGoldPickup() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Crisp metallic coin clink (short high-Q steel/brass transients, not Mario beep)
      const jitter = 0.94 + Math.random() * 0.12;
      this._playNoiseBurst(dest, now, 0.032, 0.24, 'bandpass', 4200 * jitter, 3800 * jitter, 10.0, false);
      this._playNoiseBurst(dest, now + 0.036, 0.042, 0.20, 'bandpass', 5400 * jitter, 4900 * jitter, 11.0, false);
    } catch {}
  }

  /** @private */
  _playWeaponDropPickup(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isOverclock = Boolean(payload && !payload.unlocked);
      // Heavy steel weapon rack latch + chamber slide (overclock adds deeper power lock)
      this._playTone(dest, 'sine', now, 0.10, 155, 58, 0.42, 0.002);
      this._playNoiseBurst(dest, now, 0.045, 0.34, 'bandpass', 1850, 920, 3.8, false);
      this._playNoiseBurst(dest, now + 0.075, 0.042, 0.32, 'bandpass', 2700, 1650, 4.6, false);
      if (isOverclock) {
        this._playTone(dest, 'sine', now + 0.08, 0.22, 110, 220, 0.26, 0.01);
        this._playNoiseBurst(dest, now + 0.11, 0.12, 0.22, 'bandpass', 1400, 2600, 2.5, true);
      }
    } catch {}
  }

  /** @private */
  _playUpgradeSelected() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Heavy tactical module lock-in thud + mechanical servo engagement
      this._playTone(dest, 'sine', now, 0.20, 130, 48, 0.48, 0.003);
      this._playNoiseBurst(dest, now, 0.055, 0.30, 'bandpass', 1500, 720, 3.2, false);
      this._playNoiseBurst(dest, now + 0.09, 0.07, 0.24, 'bandpass', 2400, 1600, 4.5, false);
    } catch {}
  }

  /** @private */
  _playPickup(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const type = payload && payload.type;
      if (type === 'health') {
        this._playHeal();
      } else if (type === 'ammo') {
        // Metallic ammo box latch & cartridge rattle
        this._playTone(dest, 'sine', now, 0.07, 160, 64, 0.30, 0.002);
        this._playNoiseBurst(dest, now, 0.04, 0.28, 'bandpass', 2200, 1400, 4.2, false);
        this._playNoiseBurst(dest, now + 0.05, 0.035, 0.22, 'bandpass', 3100, 2000, 4.8, false);
      } else {
        // Shield cell magnetic dock + low capacitor hum
        this._playTone(dest, 'sine', now, 0.18, 125, 240, 0.26, 0.008);
        this._playNoiseBurst(dest, now, 0.05, 0.26, 'bandpass', 1900, 950, 3.8, false);
      }
    } catch {}
  }

  /** @private */
  _playZoneProgress(payload) {
    if (!this._isReady() || !payload) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      if (payload.captured && !this._lastZoneCaptured) {
        this._lastZoneCaptured = true;
        // Heavy orbital relay lock-in horn + mechanical confirmation
        this._playTone(dest, 'sine', now, 0.42, 110, 165, 0.42, 0.015);
        this._playNoiseBurst(dest, now, 0.14, 0.28, 'bandpass', 1200, 620, 2.6, true);
        return;
      }
      if (!payload.captured) {
        this._lastZoneCaptured = false;
        const pct = Math.floor((Number(payload.progress) || 0) * 10);
        if (payload.capturing && pct > (this._lastZoneDecile || 0)) {
          this._lastZoneDecile = pct;
          // Subtle tactical radar uplink tick
          this._playNoiseBurst(dest, now, 0.022, 0.14, 'bandpass', 2100 + pct * 90, 1800, 6.0, false);
        } else if (!payload.capturing) {
          this._lastZoneDecile = pct;
        }
      }
    } catch {}
  }

  /** @private */
  _playMapTransition() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Orbital airlock hiss + deep drop-pod thrust rumble
      this._playTone(dest, 'sine', now, 0.85, 78, 26, 0.62, 0.03);
      this._playNoiseBurst(dest, now, 0.72, 0.38, 'lowpass', 1400, 180, 1.0, true);
      this._playNoiseBurst(dest, now + 0.08, 0.35, 0.22, 'bandpass', 2400, 900, 2.2, false);
    } catch {}
  }

  /** @private */
  _playSniperLock() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      if (now - (this._lastSniperWarnTime || 0) < 1.15) return;
      this._lastSniperWarnTime = now;
      const dest = this._sfxGain;
      // Urgent tactical radar lock-on double pip
      this._playTone(dest, 'sine', now, 0.055, 1380, 1380, 0.16, 0.002);
      this._playTone(dest, 'sine', now + 0.09, 0.065, 1620, 1620, 0.18, 0.002);
    } catch {}
  }

  /** @private */
  _playBossTelegraph(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const type = payload && payload.type;
      if (type === 'shockwave') {
        // Seismic ground slam shockwave release
        this._playTone(dest, 'sine', now, 0.55, 105, 22, 0.78, 0.004);
        this._playNoiseBurst(dest, now, 0.45, 0.52, 'lowpass', 950, 120, 0.9, true);
      } else {
        // Heavy mortar missile tube launch thump
        this._playTone(dest, 'sine', now, 0.22, 160, 48, 0.44, 0.003);
        this._playNoiseBurst(dest, now, 0.18, 0.32, 'bandpass', 900, 320, 1.8, true);
      }
    } catch {}
  }

  /** @private */
  _playDryOrOverheat(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      if (now - (this._lastDryFireTime || 0) < 0.18) return;
      this._lastDryFireTime = now;
      const dest = this._sfxGain;
      if (payload && payload.overheat) {
        // High-pressure thermal vent steam hiss
        this._playNoiseBurst(dest, now, 0.38, 0.34, 'bandpass', 3200, 1200, 1.6, false);
        this._playTone(dest, 'sine', now, 0.14, 180, 72, 0.22, 0.004);
      } else {
        // Dry empty-chamber firing pin click
        this._playNoiseBurst(dest, now, 0.018, 0.28, 'bandpass', 3400, 2400, 6.5, false);
      }
    } catch {}
  }

  /** @private */
  _playDashReady() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Subtle pneumatic canister recharge click
      this._playNoiseBurst(dest, now, 0.032, 0.15, 'bandpass', 2400, 1800, 5.0, false);
      this._playTone(dest, 'sine', now, 0.055, 210, 280, 0.10, 0.004);
    } catch {}
  }

  /** @private */
  _playRankUp(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const tier = Number(payload && payload.tier) || 1;
      this._playTone(dest, 'sine', now, 0.16, 130 + tier * 18, 170 + tier * 24, 0.26, 0.006);
      this._playNoiseBurst(dest, now, 0.04, 0.22, 'bandpass', 2200, 1400, 4.2, false);
    } catch {}
  }

  /** @private */
  _playSynergy() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      // Heavy mechanical core surge for 2-card synergy activation
      this._playTone(dest, 'sine', now, 0.34, 98, 196, 0.42, 0.012);
      this._playNoiseBurst(dest, now, 0.16, 0.30, 'bandpass', 1600, 820, 2.8, true);
    } catch {}
  }

  // ===========================================================================
  // 3D SPATIALIZED EXPLOSIONS & ENEMY WEAPONRY (PannerNode)
  // ===========================================================================

  /** @private */
  _playBarrelExplosion(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const pos = payload && payload.position;
      const dest = pos ? this._getSpatialPanner(pos, 7.5, 85, 1.0) : this._sfxGain;

      // Colossal sub-bass pressure shockwave + multi-band pink-noise roar + plasma crackle
      this._playTone(dest, 'sine', now, 0.68, 98, 21, 0.92, 0.004);
      this._playTone(dest, 'triangle', now, 0.42, 165, 34, 0.45, 0.004, 520);
      this._playNoiseBurst(dest, now, 0.88, 0.78, 'lowpass', 2600, 110, 0.85, true);
      this._playNoiseBurst(dest, now + 0.02, 0.34, 0.42, 'bandpass', 1900, 420, 1.4, false);
    } catch {}
  }

  /**
   * Play a 3D spatialized enemy weapon discharge at worldPos.
   * @param {THREE.Vector3|{x:number,y:number,z:number}} worldPos
   * @param {string} archetypeId
   */
  playEnemyShot(worldPos, archetypeId = 'tactical_trooper') {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      if (now - this._lastEnemyShotTime < 0.028) return;
      this._lastEnemyShotTime = now;

      const dest = worldPos
        ? this._getSpatialPanner(worldPos, 6.0, 70, 1.2)
        : this._sfxGain;
      const jitter = 0.94 + Math.random() * 0.12;

      switch (archetypeId) {
        case 'rusher_drone':
          // Light ballistic drone carbine pop (no 1420Hz laser)
          this._playTone(dest, 'sine', now, 0.055, 165 * jitter, 54, 0.26, 0.001);
          this._playNoiseBurst(dest, now, 0.048, 0.24, 'bandpass', 1900 * jitter, 760, 1.6, false);
          break;
        case 'heavy_enforcer':
          // Heavy autocannon low-end thump
          this._playTone(dest, 'sine', now, 0.22, 130 * jitter, 34, 0.54, 0.002);
          this._playNoiseBurst(dest, now, 0.18, 0.44, 'lowpass', 1450, 190, 1.0, true);
          break;
        case 'sniper_stalker':
          // High-velocity anti-materiel sniper crack (dry ballistic snap, no 2900Hz laser)
          this._playTone(dest, 'sine', now, 0.18, 145 * jitter, 32, 0.52, 0.001);
          this._playNoiseBurst(dest, now, 0.032, 0.52, 'bandpass', 2600 * jitter, 900, 1.2, false);
          this._playNoiseBurst(dest, now + 0.01, 0.16, 0.38, 'lowpass', 1600, 220, 0.9, true);
          break;
        case 'cyber_mech_boss':
          // Colossal twin rotary cannon boom
          this._playTone(dest, 'sine', now, 0.24, 108 * jitter, 24, 0.64, 0.002);
          this._playNoiseBurst(dest, now, 0.19, 0.48, 'lowpass', 1350, 160, 1.0, true);
          break;
        case 'tactical_trooper':
        default:
          // Gritty rifle burst pop (no 680Hz triangle laser)
          this._playTone(dest, 'sine', now, 0.075, 145 * jitter, 46, 0.30, 0.001);
          this._playNoiseBurst(dest, now, 0.068, 0.28, 'bandpass', 1650 * jitter, 580, 1.5, true);
          break;
      }
    } catch {}
  }

  // ===========================================================================
  // CINEMATIC WAVE & BOSS STINGERS
  // ===========================================================================

  /** @private */
  _playWaveStarted(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isBoss = Boolean(payload && payload.isBossWave);

      if (isBoss) {
        this._playBossPhase({ phase: 1 });
        return;
      }

      // Cyberpunk dark synth-brass power fifth swell (D2 + A2)
      const freqs = [73.42, 110.0, 146.83];
      for (let i = 0; i < freqs.length; i++) {
        this._playTone(dest, 'sawtooth', now, 0.72, freqs[i], freqs[i] * 1.005, 0.13, 0.08, 1250);
      }
      this._playTone(dest, 'sine', now, 0.55, 587.33, 440.0, 0.12, 0.02);
    } catch {}
  }

  /** @private */
  _playWaveCleared(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isFinal = Boolean(payload && payload.isFinalWave);
      // Grounded military-SF low brass radio confirmation (no bright arcade arpeggio)
      const baseNotes = isFinal ? [110.0, 146.83, 220.0] : [110.0, 164.81];
      for (let i = 0; i < baseNotes.length; i++) {
        const t = now + i * 0.14;
        this._playTone(dest, 'sawtooth', t, 0.48, baseNotes[i], baseNotes[i], 0.14, 0.02, 720);
        this._playTone(dest, 'sine', t, 0.52, baseNotes[i] * 0.5, baseNotes[i] * 0.5, 0.24, 0.015);
      }
      this._playNoiseBurst(dest, now, 0.08, 0.16, 'bandpass', 1800, 1100, 3.0, false);
    } catch {}
  }

  /** @private */
  _playBossPhase(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const phase = Number(payload && payload.phase) || 2;
      const baseHz = phase >= 3 ? 55.0 : 65.41;

      // Menacing cyberpunk BWAAAHM brass drop + sub surge + red-alert pulse
      this._playTone(dest, 'sawtooth', now, 1.1, baseHz, baseHz * 0.94, 0.24, 0.05, 780);
      this._playTone(dest, 'sawtooth', now, 1.1, baseHz * 1.007, baseHz * 0.948, 0.24, 0.05, 840);
      this._playTone(dest, 'sine', now, 1.2, baseHz * 0.75, 28, 0.55, 0.02);
      this._playNoiseBurst(dest, now, 0.55, 0.30, 'bandpass', 620, 180, 2.0, true);
      // Dual cyber alert horn pips
      this._playTone(dest, 'square', now + 0.12, 0.12, 880, 622, 0.10, 0.005, 1600);
      this._playTone(dest, 'square', now + 0.32, 0.16, 880, 622, 0.10, 0.005, 1600);
    } catch {}
  }

  // ===========================================================================
  // PER-FRAME 3D LISTENER SYNC & ADAPTIVE CYBERPUNK SYNTH PULSE SEQUENCER
  // ===========================================================================

  /**
   * Sync Web Audio 3D AudioListener to camera transform and schedule adaptive
   * cyberpunk synth combat pulse notes via lookahead. Zero allocations.
   *
   * @param {number} dt
   */
  update(dt) {
    if (!this._isReady()) return;
    const clampedDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0.016;

    // 1. Update 3D AudioListener position & orientation from Three.js camera matrixWorld
    this._syncAudioListener();

    // 2. Smoothly blend combat intensity & schedule cyberpunk synth pulse steps
    const desiredIntensity = this._musicEnabled && this._inGameplay ? this._targetIntensity : 0;
    this._currentIntensity +=
      (desiredIntensity - this._currentIntensity) * (1 - Math.exp(-2.4 * clampedDt));

    if (this._currentIntensity < 0.05 || !this._musicEnabled || !this._inGameplay) {
      this._nextStepTime = this.ctx.currentTime + 0.06;
      return;
    }

    const now = this.ctx.currentTime;
    if (this._nextStepTime < now - 0.25) {
      this._nextStepTime = now + 0.04;
    }

    // Lookahead scheduling window (120ms) for rock-solid rhythm
    while (this._nextStepTime < now + 0.12) {
      this._schedulePulseStep(this._nextStepTime, this._stepIndex, this._currentIntensity);
      this._nextStepTime += STEP_DURATION_SEC;
      this._stepIndex = (this._stepIndex + 1) & 15;
    }
  }

  /**
   * Read camera world position, forward (-Z), and up (+Y) directly from matrixWorld.elements.
   * @private
   */
  _syncAudioListener() {
    if (!this.camera || !this.ctx || !this.ctx.listener) return;
    try {
      const m = this.camera.matrixWorld && this.camera.matrixWorld.elements;
      if (!m || m.length < 16) return;

      const px = m[12];
      const py = m[13];
      const pz = m[14];

      // Forward is -Z column (-m[8], -m[9], -m[10]); Up is +Y column (m[4], m[5], m[6])
      let fx = -m[8];
      let fy = -m[9];
      let fz = -m[10];
      const fLen = Math.hypot(fx, fy, fz);
      if (fLen > 1e-5) {
        fx /= fLen;
        fy /= fLen;
        fz /= fLen;
      }

      let ux = m[4];
      let uy = m[5];
      let uz = m[6];
      const uLen = Math.hypot(ux, uy, uz);
      if (uLen > 1e-5) {
        ux /= uLen;
        uy /= uLen;
        uz /= uLen;
      }

      const listener = this.ctx.listener;
      const now = this.ctx.currentTime;

      if (listener.positionX && listener.forwardX && listener.upX) {
        listener.positionX.setValueAtTime(px, now);
        listener.positionY.setValueAtTime(py, now);
        listener.positionZ.setValueAtTime(pz, now);
        listener.forwardX.setValueAtTime(fx, now);
        listener.forwardY.setValueAtTime(fy, now);
        listener.forwardZ.setValueAtTime(fz, now);
        listener.upX.setValueAtTime(ux, now);
        listener.upY.setValueAtTime(uy, now);
        listener.upZ.setValueAtTime(uz, now);
      } else {
        if (typeof listener.setPosition === 'function') {
          listener.setPosition(px, py, pz);
        }
        if (typeof listener.setOrientation === 'function') {
          listener.setOrientation(fx, fy, fz, ux, uy, uz);
        }
      }
    } catch {}
  }

  /**
   * Schedule one 16th-note step of the adaptive cyberpunk dark-synth combat pulse.
   * @private
   */
  _schedulePulseStep(time, step, intensity) {
    try {
      const dest = this._musicGain;
      const bassHz = BASS_PATTERN_HZ[step] * 0.75; // Deeper post-apocalyptic industrial drone register
      const isDownbeat = step % 4 === 0;
      const isBackbeat = step === 4 || step === 12;
      const isOffbeat = step % 4 === 2;

      // Layer 1: Gritty low-pass industrial drone sub-bass (zero bright neon synth)
      if (isDownbeat || step % 2 === 0) {
        const cutoff = 140 + intensity * 420 + (isDownbeat ? 120 : 0);
        const bassGain = (0.28 + intensity * 0.22) * (isDownbeat ? 1.18 : 0.75);
        this._playTone(dest, 'sawtooth', time, STEP_DURATION_SEC * 1.45, bassHz, bassHz * 0.98, bassGain, 0.008, cutoff);
      }

      // Layer 2: Heavy industrial war-drum kick & muffled steel shaker
      if (intensity > 0.28) {
        const drumScale = Math.min(1, (intensity - 0.28) / 0.45);
        if (isDownbeat) {
          this._playTone(dest, 'sine', time, 0.14, 112, 32, 0.56 * drumScale, 0.002);
          this._playNoiseBurst(dest, time, 0.04, 0.16 * drumScale, 'lowpass', 420, 140, 1.0, true);
        } else if (isOffbeat) {
          this._playNoiseBurst(dest, time, 0.032, 0.12 * drumScale, 'bandpass', 2400, 1100, 2.2, true);
        }
      }

      // Layer 3: Heavy industrial war-drum & metallic anvil slam (zero neon square synth)
      if (intensity > 0.52 && (isBackbeat || (intensity > 0.78 && step === 14))) {
        const clangScale = Math.min(1, (intensity - 0.52) / 0.42);
        this._playTone(dest, 'sine', time, 0.18, 92, 28, 0.48 * clangScale, 0.002);
        this._playNoiseBurst(dest, time, 0.13, 0.26 * clangScale, 'bandpass', 1180, 360, 2.8, true);
      }
    } catch {}
  }

  /**
   * Unsubscribe from EventBus and close AudioContext cleanly.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    for (let i = 0; i < this._unsubs.length; i++) {
      this._unsubs[i]();
    }
    this._unsubs.length = 0;

    for (let i = 0; i < this._pannerPool.length; i++) {
      try {
        this._pannerPool[i].disconnect();
      } catch {}
    }
    this._pannerPool.length = 0;

    if (this.ctx) {
      try {
        const p = this.ctx.close();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {}
      this.ctx = null;
    }
    this._masterGain = null;
    this._sfxGain = null;
    this._musicGain = null;
    this._compressor = null;
    this._whiteNoiseBuffer = null;
    this._pinkNoiseBuffer = null;
  }
}
  __exports.SoundEngine = SoundEngine;
});
