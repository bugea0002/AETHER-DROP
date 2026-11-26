// Module: src/audio/SoundEngine.js
__define("src/audio/SoundEngine.js", (__exports, __require) => {
const { EVENTS } = __require("src/config/constants.js");

// Monumental & Destructive Post-Apocalyptic Main Theme (D Phrygian / D Harmonic Minor, 108 BPM, 64-step 4-bar cycle)
const APOC_MAIN_THEME = Object.freeze({
  id: 'main_theme',
  baseStepSec: 60 / 108 / 4, // 108 BPM 16th-note = 0.13889s
  bossStepSec: 60 / 118 / 4, // 118 BPM Boss Overdrive
  // Colossal brass braam root hits (steps 0, 16, 32, 48 + destructive turnaround hit at 58)
  braam: {
    0: { freq: 36.71, dur: 2.15, gain: 0.44 },  // D1
    16: { freq: 29.14, dur: 2.15, gain: 0.42 }, // Bb0 (heavy sub octave + 2x overtone)
    32: { freq: 49.00, dur: 1.95, gain: 0.42 }, // G1
    44: { freq: 38.89, dur: 0.95, gain: 0.36 }, // Eb1 (Phrygian doom drop)
    48: { freq: 55.00, dur: 1.45, gain: 0.44 }, // A1 (dominant tension)
    58: { freq: 38.89, dur: 0.72, gain: 0.40 }, // Eb1 violent smash before loop
  },
  // Haunting desolate cathedral choir / dark brass-string chords on each bar
  chords: {
    0:  [146.83, 220.00, 293.66, 349.23], // Dm (D3 A3 D4 F4)
    16: [116.54, 174.61, 233.08, 293.66], // Bb maj (Bb2 F3 Bb3 D4)
    32: [146.83, 196.00, 233.08, 311.13], // Gm / Eb6 (D3 G3 Bb3 Eb4)
    48: [138.59, 164.81, 220.00, 349.23], // A7b9 dark tension (C#3 E3 A3 F4)
  },
  // 64-step destructive drop-D industrial bass riff (0 = rest)
  bass: [
    // Bar 1: Dm crushing chug (D2 = 73.42, Eb2 = 77.78, F2 = 87.31)
    73.42, 0, 73.42, 73.42, 0, 0, 77.78, 0, 73.42, 0, 73.42, 0, 87.31, 0, 77.78, 73.42,
    // Bar 2: Bb falling ruins (Bb1 = 58.27, C2 = 65.41, D2 = 73.42)
    58.27, 0, 58.27, 58.27, 0, 0, 65.41, 0, 58.27, 0, 58.27, 0, 73.42, 0, 65.41, 58.27,
    // Bar 3: Gm -> Eb Phrygian devastation (G1 = 49.00, G2 = 98.00, Eb2 = 77.78, F2 = 87.31)
    49.00, 0, 98.00, 49.00, 0, 0, 87.31, 0, 77.78, 0, 77.78, 77.78, 87.31, 0, 77.78, 0,
    // Bar 4: A Phrygian dominant fury (A1 = 55.00, Bb1 = 58.27, C#2 = 69.30, Eb2 = 77.78)
    55.00, 0, 55.00, 55.00, 0, 0, 58.27, 0, 69.30, 0, 77.78, 0, 69.30, 58.27, 55.00, 77.78,
  ],
  // 64-step iconic tragic-heroic theme melody (freq + duration in steps)
  lead: {
    0:  { f: 293.66, d: 6 },  // D4
    6:  { f: 349.23, d: 4 },  // F4
    10: { f: 311.13, d: 3 },  // Eb4 (Phrygian lament)
    13: { f: 293.66, d: 3 },  // D4
    16: { f: 233.08, d: 6 },  // Bb3
    22: { f: 293.66, d: 4 },  // D4
    26: { f: 349.23, d: 3 },  // F4
    29: { f: 329.63, d: 3 },  // E4
    32: { f: 392.00, d: 6 },  // G4 (soaring peak)
    38: { f: 349.23, d: 3 },  // F4
    41: { f: 311.13, d: 3 },  // Eb4
    44: { f: 293.66, d: 4 },  // D4
    48: { f: 329.63, d: 4 },  // E4
    52: { f: 440.00, d: 4 },  // A4 (climax)
    56: { f: 349.23, d: 3 },  // F4
    59: { f: 277.18, d: 5 },  // C#4 (harmonic minor tension resolving to D4)
  },
  // Half-time monumental war-drum hits (active even on Title!)
  warDrum: [
    2,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,2,0,
    2,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,1,0,
    2,0,0,0, 0,0,1,0, 2,0,0,0, 1,0,2,0,
    2,0,0,1, 0,0,2,0, 0,0,2,0, 2,1,2,1,
  ],
  // Crushing industrial combat double-kick (ignites during combat & boss)
  combatKick: [
    2,0,1,0, 0,0,2,0, 2,0,0,1, 0,0,2,0,
    2,0,1,0, 0,0,2,0, 2,0,0,1, 0,1,2,0,
    2,0,1,0, 0,0,2,0, 2,0,1,0, 0,0,2,1,
    2,0,1,1, 0,0,2,0, 2,1,2,0, 2,1,2,1,
  ],
  // Metallic anvil / scrap-iron slam on heavy backbeats (1=heavy snare, 2=anvil clang + slam)
  anvil: [
    0,0,0,0, 1,0,0,0, 2,0,0,0, 1,0,0,0,
    0,0,0,0, 1,0,0,0, 2,0,0,0, 1,0,0,1,
    0,0,0,0, 1,0,0,0, 2,0,0,0, 1,0,0,0,
    0,0,0,0, 1,0,0,1, 2,0,2,0, 1,0,2,0,
  ],
  // Gritty industrial percussion hat/shaker (active in combat)
  hat: [
    1,0,1,1, 2,0,1,0, 1,0,1,1, 2,0,1,1,
    1,0,1,1, 2,0,1,0, 1,0,1,1, 2,1,2,0,
    1,0,1,1, 2,0,1,0, 1,0,1,1, 2,0,1,1,
    1,1,2,1, 2,0,1,1, 2,1,2,1, 2,2,2,1,
  ],
});

// 6 Distinct Zone BGM Tracks (kept for backward compatibility)
const BGM_TRACKS = {
  main_theme: APOC_MAIN_THEME,
  // 1구역 일반 (Waves 1-4): 폐허 지구 정유소/메트로폴리스 — D minor, 120 BPM 인더스트리얼 록 그루브
  zone1_normal: {
    id: 'zone1_normal',
    isBoss: false,
    stepSec: 60 / 120 / 4,
    bassWave: 'sawtooth',
    bassFilterBase: 190,
    bassFilterSpan: 420,
    bassGain: 0.28,
    leadWave: 'triangle',
    leadFilter: 1750,
    leadGain: 0.14,
    padWave: 'triangle',
    padFilter: 680,
    padGain: 0.065,
    bass: [
      73.42, 0, 73.42, 73.42, 87.31, 0, 73.42, 0,
      65.41, 0, 73.42, 0, 87.31, 0, 82.41, 0,
      58.27, 0, 58.27, 58.27, 65.41, 0, 73.42, 0,
      55.00, 0, 65.41, 0, 73.42, 0, 82.41, 0,
    ],
    lead: [
      293.66, 0, 349.23, 0, 440.00, 0, 392.00, 349.23,
      293.66, 0, 0, 261.63, 293.66, 0, 329.63, 0,
      233.08, 0, 293.66, 0, 349.23, 0, 329.63, 293.66,
      220.00, 0, 261.63, 0, 329.63, 0, 293.66, 0,
    ],
    chords: [
      [146.83, 220.00],
      [130.81, 196.00],
      [116.54, 174.61],
      [110.00, 164.81],
    ],
    kick:  [2,0,0,0, 0,0,1,0, 2,0,0,0, 0,0,1,0, 2,0,0,0, 0,0,1,0, 2,0,0,0, 0,1,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
    hat:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,2,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,2,0],
  },

  // 1구역 보스 (Wave 5 COLOSSUS-IV): 잿빛 거신 — C# Phrygian, 138 BPM 중장갑 공성 행진
  zone1_boss: {
    id: 'zone1_boss',
    isBoss: true,
    stepSec: 60 / 138 / 4,
    bassWave: 'sawtooth',
    bassFilterBase: 230,
    bassFilterSpan: 560,
    bassGain: 0.31,
    leadWave: 'sawtooth',
    leadFilter: 1550,
    leadGain: 0.13,
    padWave: 'sawtooth',
    padFilter: 520,
    padGain: 0.06,
    bass: [
      69.30, 69.30, 0, 73.42, 69.30, 0, 82.41, 73.42,
      69.30, 69.30, 0, 73.42, 103.83, 0, 82.41, 73.42,
      69.30, 69.30, 0, 73.42, 69.30, 0, 110.00, 103.83,
      61.74, 61.74, 65.41, 69.30, 73.42, 0, 82.41, 73.42,
    ],
    lead: [
      277.18, 0, 293.66, 0, 329.63, 0, 293.66, 277.18,
      277.18, 0, 415.30, 0, 392.00, 329.63, 293.66, 0,
      277.18, 293.66, 329.63, 0, 440.00, 0, 415.30, 329.63,
      246.94, 0, 293.66, 277.18, 220.00, 0, 246.94, 0,
    ],
    chords: [
      [138.59, 207.65],
      [146.83, 220.00],
      [138.59, 207.65],
      [123.47, 185.00],
    ],
    kick:  [2,0,1,0, 0,0,2,0, 2,0,1,0, 0,0,1,0, 2,0,1,0, 0,0,2,0, 2,0,1,0, 2,0,1,0],
    snare: [0,0,0,0, 2,0,0,1, 0,0,0,0, 2,0,0,0, 0,0,0,0, 2,0,0,1, 0,0,0,0, 2,0,2,0],
    hat:   [1,0,1,1, 0,0,1,0, 1,0,1,1, 0,0,2,0, 1,0,1,1, 0,0,1,0, 1,0,1,1, 0,1,2,1],
  },

  // 2구역 일반 (Waves 6-9): 이지스 궤도 격납고/원자로 — F minor, 128 BPM 냉철한 사이버 펄스
  zone2_normal: {
    id: 'zone2_normal',
    isBoss: false,
    stepSec: 60 / 128 / 4,
    bassWave: 'sawtooth',
    bassFilterBase: 210,
    bassFilterSpan: 480,
    bassGain: 0.25,
    leadWave: 'triangle',
    leadFilter: 2200,
    leadGain: 0.15,
    padWave: 'sine',
    padFilter: 900,
    padGain: 0.08,
    bass: [
      87.31, 0, 174.61, 0, 87.31, 0, 130.81, 0,
      77.78, 0, 155.56, 0, 77.78, 0, 116.54, 0,
      69.30, 0, 138.59, 0, 69.30, 0, 103.83, 0,
      65.41, 0, 130.81, 0, 77.78, 0, 98.00, 0,
    ],
    lead: [
      349.23, 523.25, 415.30, 0, 392.00, 0, 311.13, 0,
      349.23, 0, 466.16, 415.30, 392.00, 349.23, 311.13, 0,
      277.18, 415.30, 349.23, 0, 311.13, 0, 261.63, 0,
      261.63, 311.13, 392.00, 0, 466.16, 392.00, 349.23, 0,
    ],
    chords: [
      [174.61, 261.63],
      [155.56, 233.08],
      [138.59, 207.65],
      [130.81, 196.00],
    ],
    kick:  [2,0,0,0, 1,0,0,0, 2,0,0,0, 1,0,0,0, 2,0,0,0, 1,0,0,0, 2,0,0,0, 1,0,1,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    hat:   [0,1,2,1, 0,1,2,1, 0,1,2,1, 0,1,2,1, 0,1,2,1, 0,1,2,1, 0,1,2,1, 0,1,2,1],
  },

  // 2구역 보스 (Wave 10 AEGIS-IX): 궤도 군주 — E minor, 144 BPM 고속 사이버 보스 러시
  zone2_boss: {
    id: 'zone2_boss',
    isBoss: true,
    stepSec: 60 / 144 / 4,
    bassWave: 'sawtooth',
    bassFilterBase: 250,
    bassFilterSpan: 640,
    bassGain: 0.29,
    leadWave: 'sawtooth',
    leadFilter: 1950,
    leadGain: 0.14,
    padWave: 'triangle',
    padFilter: 820,
    padGain: 0.065,
    bass: [
      82.41, 164.81, 82.41, 82.41, 164.81, 82.41, 98.00, 110.00,
      82.41, 164.81, 82.41, 82.41, 123.47, 82.41, 110.00, 98.00,
      65.41, 130.81, 65.41, 65.41, 130.81, 65.41, 73.42, 82.41,
      73.42, 146.83, 73.42, 98.00, 123.47, 110.00, 98.00, 82.41,
    ],
    lead: [
      329.63, 0, 493.88, 392.00, 440.00, 0, 392.00, 329.63,
      493.88, 0, 587.33, 493.88, 440.00, 392.00, 329.63, 293.66,
      261.63, 0, 392.00, 329.63, 392.00, 440.00, 493.88, 0,
      587.33, 493.88, 440.00, 392.00, 493.88, 0, 659.25, 0,
    ],
    chords: [
      [164.81, 246.94],
      [164.81, 246.94],
      [130.81, 196.00],
      [146.83, 220.00],
    ],
    kick:  [2,0,0,1, 2,0,0,0, 2,0,0,1, 2,0,1,0, 2,0,0,1, 2,0,0,0, 2,0,0,1, 2,0,1,0],
    snare: [0,0,0,0, 2,0,0,1, 0,0,0,0, 2,0,0,0, 0,0,0,0, 2,0,0,1, 0,0,0,0, 2,1,2,1],
    hat:   [1,1,2,1, 1,1,2,1, 1,1,2,1, 1,1,2,1, 1,1,2,1, 1,1,2,1, 1,1,2,1, 2,1,2,2],
  },

  // 3구역 일반 (Waves 11-14): 심연 도관 링/저중력 성소 — A Phrygian, 132 BPM 몽환적 심연 공명
  zone3_normal: {
    id: 'zone3_normal',
    isBoss: false,
    stepSec: 60 / 132 / 4,
    bassWave: 'triangle',
    bassFilterBase: 170,
    bassFilterSpan: 360,
    bassGain: 0.30,
    leadWave: 'sine',
    leadFilter: 2400,
    leadGain: 0.16,
    padWave: 'triangle',
    padFilter: 1100,
    padGain: 0.085,
    bass: [
      55.00, 0, 0, 55.00, 110.00, 0, 58.27, 0,
      55.00, 0, 0, 65.41, 73.42, 0, 58.27, 0,
      55.00, 0, 0, 55.00, 98.00, 0, 87.31, 0,
      58.27, 0, 73.42, 0, 65.41, 0, 55.00, 0,
    ],
    lead: [
      440.00, 0, 523.25, 0, 466.16, 0, 440.00, 0,
      349.23, 0, 440.00, 0, 392.00, 0, 329.63, 0,
      440.00, 0, 659.25, 0, 587.33, 0, 466.16, 0,
      440.00, 349.23, 329.63, 0, 293.66, 0, 220.00, 0,
    ],
    chords: [
      [220.00, 329.63],
      [233.08, 349.23],
      [196.00, 293.66],
      [174.61, 261.63],
    ],
    kick:  [2,0,0,0, 0,0,1,0, 0,0,2,0, 0,0,0,0, 2,0,0,0, 0,0,1,0, 0,0,2,0, 0,1,0,0],
    snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,1],
    hat:   [1,0,1,0, 2,0,1,0, 1,0,1,1, 2,0,1,0, 1,0,1,0, 2,0,1,0, 1,0,1,1, 2,1,2,0],
  },

  // 3구역 보스 (Wave 15 TRANSCENDENT-OMEGA): 최종 결전 — G Harmonic minor, 152 BPM 초월 클라이맥스
  zone3_boss: {
    id: 'zone3_boss',
    isBoss: true,
    stepSec: 60 / 152 / 4,
    bassWave: 'sawtooth',
    bassFilterBase: 260,
    bassFilterSpan: 680,
    bassGain: 0.30,
    leadWave: 'sawtooth',
    leadFilter: 2250,
    leadGain: 0.15,
    padWave: 'sawtooth',
    padFilter: 880,
    padGain: 0.068,
    bass: [
      49.00, 98.00, 49.00, 49.00, 98.00, 49.00, 58.27, 65.41,
      77.78, 155.56, 77.78, 77.78, 155.56, 77.78, 65.41, 58.27,
      65.41, 130.81, 65.41, 65.41, 130.81, 65.41, 73.42, 77.78,
      73.42, 146.83, 73.42, 92.50, 146.83, 92.50, 73.42, 65.41,
    ],
    lead: [
      392.00, 0, 466.16, 587.33, 392.00, 0, 587.33, 622.25,
      622.25, 0, 587.33, 466.16, 392.00, 0, 466.16, 587.33,
      523.25, 0, 587.33, 622.25, 523.25, 0, 466.16, 392.00,
      369.99, 440.00, 587.33, 0, 739.99, 587.33, 523.25, 440.00,
    ],
    chords: [
      [196.00, 293.66],
      [155.56, 233.08],
      [130.81, 196.00],
      [146.83, 220.00],
    ],
    kick:  [2,0,1,0, 0,0,2,0, 0,0,2,0, 1,0,0,1, 2,0,1,0, 0,0,2,0, 0,1,2,0, 1,0,2,0],
    snare: [0,0,0,0, 2,0,0,1, 0,0,0,0, 2,0,1,0, 0,0,0,0, 2,0,0,1, 0,0,0,0, 2,1,2,1],
    hat:   [1,1,2,1, 1,0,2,1, 1,1,2,1, 1,1,2,1, 1,1,2,1, 1,0,2,1, 1,1,2,1, 2,2,2,1],
  },
};

const PANNER_POOL_SIZE = 12;

/**
 * AETHER DROP — Procedural Web Audio API Synthesizer & 3D Spatial Sound Engine
 * Zero external audio assets. Features layered weapon synthesis per firearm, tactile mechanical
 * foley, 3D PannerNode spatialization, and 6 adaptive zone/boss BGM tracks.
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
    this._musicSceneFilter = null;
    this._trackGain = null;
    this._musicReverbSend = null;
    this._musicReverbDelay = null;
    this._musicReverbFilter = null;
    this._musicReverbFeedback = null;
    this._subFilter = null;
    this._compressor = null;
    this._whiteNoiseBuffer = null;
    this._pinkNoiseBuffer = null;
    this._pannerPool = [];
    this._pannerCursor = 0;

    this._masterVolume = 0.78;
    this._muted = false;
    this._musicEnabled = true;
    this._sceneMode = 'title'; // 'title' | 'playing' | 'paused' | 'result'
    this._bossOverdrive = false;
    this._inGameplay = false;
    this._bgmStopped = false;
    this._disposed = false;

    // Scene-separated BGM sequencer state (Title Main Theme / Stage Normal / Grand Boss)
    this._currentTrackId = 'main_theme';
    this._targetIntensity = 0.0;
    this._currentIntensity = 0.35;
    this._nextStepTime = 0;
    this._stepIndex = 0;
    this._bgmIntervalId = null;
    this._lastBgmTickMs = 0;

    // Anti-stacking rate-limit timestamps (seconds)
    this._lastHitmarkerTime = -1;
    this._lastHeadshotTime = -1;
    this._lastKillSoundTime = -1;
    this._lastPlayerDamagedTime = -1;
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
    on(EVENTS.GUARD_BLOCKED, (p) => this._playGuardBlocked(p));
    on(EVENTS.ULTIMATE_USED, (p) => this._playUltimateActivated(p));
    on('SFX_GUARD_TOGGLE', (p) => this._playGuardToggle(p));
    on(EVENTS.GAME_STATE, (p) => this._onGameState(p));
    on('SFX_SNIPER_LOCK', () => this._playSniperLock());
    on('SFX_BOSS_TELEGRAPH', (p) => this._playBossTelegraph(p));
    on('SFX_WEAPON_DRY', (p) => this._playDryOrOverheat(p));
    on('SFX_DASH_READY', () => this._playDashReady());
    on('SFX_RANK_UP', (p) => this._playRankUp(p));
    on('SFX_SYNERGY', () => this._playSynergy());
    on(EVENTS.VOID_GATE_SHATTERED, (p) => this._playVoidGateShatter(p));
    on(EVENTS.ENEMY_TELEPORT, (p) => this._playTeleportRift(p));
    on(EVENTS.ENEMY_OVERLOAD, (p) => this._playEnemyOverload(p));
    on(EVENTS.BOSS_TURRET_SHATTERED, (p) => this._playTurretShatter(p));
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
        this._nextStepTime = this.ctx.currentTime + 0.06;
        this._startBgmLoop();
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        const p = this.ctx.resume();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            this._syncMusicMix();
            this._tickBgm();
          }).catch(() => {});
        }
      }
      this._syncMusicMix();
      this._tickBgm();
    } catch {
      // Gracefully ignore restricted environments
    }
  }

  /** @private */
  _startBgmLoop() {
    if (this._bgmIntervalId !== null || typeof window === 'undefined') return;
    this._lastBgmTickMs = performance.now();
    this._bgmIntervalId = window.setInterval(() => {
      this._tickBgm();
    }, 45);
  }

  /** @private */
  _buildAudioGraph() {
    const ctx = this.ctx;
    this._subFilter = ctx.createBiquadFilter();
    this._subFilter.type = 'highpass';
    this._subFilter.frequency.setValueAtTime(28, ctx.currentTime);
    this._subFilter.Q.setValueAtTime(0.7, ctx.currentTime);

    this._compressor = ctx.createDynamicsCompressor();
    this._compressor.threshold.setValueAtTime(-9, ctx.currentTime);
    this._compressor.knee.setValueAtTime(12, ctx.currentTime);
    this._compressor.ratio.setValueAtTime(3.4, ctx.currentTime);
    this._compressor.attack.setValueAtTime(0.004, ctx.currentTime);
    this._compressor.release.setValueAtTime(0.09, ctx.currentTime);

    this._masterGain = ctx.createGain();
    this._masterGain.gain.setValueAtTime(
      this._muted ? 0 : this._masterVolume,
      ctx.currentTime
    );

    this._sfxGain = ctx.createGain();
    this._sfxGain.gain.setValueAtTime(0.66, ctx.currentTime);

    // Music bus with scene-adaptive lowpass filter & dark canyon delay-reverb send
    this._musicGain = ctx.createGain();
    this._musicGain.gain.setValueAtTime(this._musicEnabled ? 0.28 : 0.0, ctx.currentTime);

    this._musicSceneFilter = ctx.createBiquadFilter();
    this._musicSceneFilter.type = 'lowpass';
    this._musicSceneFilter.frequency.setValueAtTime(18000, ctx.currentTime);
    this._musicSceneFilter.Q.setValueAtTime(0.65, ctx.currentTime);

    this._musicGain.connect(this._musicSceneFilter);
    this._musicSceneFilter.connect(this._masterGain);

    this._sfxGain.connect(this._masterGain);
    this._masterGain.connect(this._subFilter);
    this._subFilter.connect(this._compressor);
    this._compressor.connect(ctx.destination);

    // Allocate disposable per-track bus so track/stage transitions have ZERO audio bleed
    this._ensureMusicTrackBus();
  }

  /**
   * Allocate a fresh disposable track output + canyon reverb bus feeding _musicGain.
   * Severing this bus on stopBgmHard() instantly eliminates lingering braams, pads, and reverb tails.
   * @private
   */
  _ensureMusicTrackBus() {
    if (!this.ctx || !this._musicGain || this._trackGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(1.0, now);

    const revSend = ctx.createGain();
    revSend.gain.setValueAtTime(0.32, now);

    const revDelay = ctx.createDelay(1.0);
    revDelay.delayTime.setValueAtTime(0.30, now);

    const revFilter = ctx.createBiquadFilter();
    revFilter.type = 'lowpass';
    revFilter.frequency.setValueAtTime(1450, now);

    const revFb = ctx.createGain();
    revFb.gain.setValueAtTime(0.35, now);

    trackGain.connect(this._musicGain);
    revSend.connect(revDelay);
    revDelay.connect(revFilter);
    revFilter.connect(revFb);
    revFb.connect(revDelay);
    revFilter.connect(trackGain);

    this._trackGain = trackGain;
    this._musicReverbSend = revSend;
    this._musicReverbDelay = revDelay;
    this._musicReverbFilter = revFilter;
    this._musicReverbFeedback = revFb;
  }

  /**
   * Hard-stop active BGM immediately with zero reverb tail or note bleed across scene/stage boundaries.
   */
  stopBgmHard() {
    this._bgmStopped = true;
    this._stepIndex = 0;

    const oldTrackGain = this._trackGain;
    const oldRevSend = this._musicReverbSend;
    const oldRevDelay = this._musicReverbDelay;
    const oldRevFilter = this._musicReverbFilter;
    const oldRevFb = this._musicReverbFeedback;

    this._trackGain = null;
    this._musicReverbSend = null;
    this._musicReverbDelay = null;
    this._musicReverbFilter = null;
    this._musicReverbFeedback = null;

    if (this.ctx && oldTrackGain) {
      const now = this.ctx.currentTime;
      try {
        oldTrackGain.gain.cancelScheduledValues(now);
        oldTrackGain.gain.setValueAtTime(Math.max(0.0001, oldTrackGain.gain.value), now);
        oldTrackGain.gain.linearRampToValueAtTime(0.0001, now + 0.015);
      } catch {}
      if (oldRevFb) {
        try {
          oldRevFb.gain.cancelScheduledValues(now);
          oldRevFb.gain.setValueAtTime(0.0, now);
        } catch {}
      }
      if (oldRevSend) {
        try {
          oldRevSend.gain.cancelScheduledValues(now);
          oldRevSend.gain.setValueAtTime(0.0, now);
        } catch {}
      }
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          try { oldTrackGain.disconnect(); } catch {}
          try { if (oldRevSend) oldRevSend.disconnect(); } catch {}
          try { if (oldRevDelay) oldRevDelay.disconnect(); } catch {}
          try { if (oldRevFilter) oldRevFilter.disconnect(); } catch {}
          try { if (oldRevFb) oldRevFb.disconnect(); } catch {}
        }, 45);
      }
    }
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
   * Resolve stage or boss BGM track for a given wave number.
   * Normal waves use classic per-zone stage BGM; Boss waves switch to Grand Boss BGM.
   * @param {number} wave
   * @param {boolean} [isBossWave=false]
   * @returns {string}
   */
  resolveTrackForWave(wave, isBossWave = false) {
    const w = ((Math.max(1, Math.floor(Number(wave) || 1)) - 1) % 15) + 1;
    const boss = Boolean(isBossWave) || w === 5 || w === 10 || w === 15;
    if (w <= 5) return boss ? 'zone1_boss' : 'zone1_normal';
    if (w <= 10) return boss ? 'zone2_boss' : 'zone2_normal';
    return boss ? 'zone3_boss' : 'zone3_normal';
  }

  /**
   * Switch active BGM track cleanly. Whenever the track changes, forceReset is true,
   * or playback was hard-stopped for a transition, severs the previous bus cleanly
   * and starts the new track fresh from step 0 with zero audio bleed.
   * @param {string} trackId
   * @param {boolean} [forceReset=false]
   */
  setBgmTrack(trackId, forceReset = false) {
    const nextId = BGM_TRACKS[trackId] ? trackId : 'main_theme';
    const needsFreshStart = forceReset || nextId !== this._currentTrackId || this._bgmStopped;

    if (needsFreshStart) {
      this.stopBgmHard();
      this._currentTrackId = nextId;
      this._bossOverdrive = nextId.includes('boss');
      this._bgmStopped = false;
      this._stepIndex = 0;
      if (this.ctx) {
        this._ensureMusicTrackBus();
        this._nextStepTime = this.ctx.currentTime + 0.045;
      }
    } else {
      this._bossOverdrive = nextId.includes('boss');
    }
    this._syncMusicMix();
  }

  /**
   * Set current game scene mode ('title' | 'playing' | 'paused' | 'result').
   * @param {'title'|'playing'|'paused'|'result'} mode
   */
  setSceneMode(mode) {
    const safe =
      mode === 'playing' || mode === 'paused' || mode === 'result' ? mode : 'title';
    this._sceneMode = safe;
    this._inGameplay = safe === 'playing';
    if (safe !== 'playing') {
      this._bossOverdrive = false;
    }
    this._syncMusicMix();
  }

  /** @private */
  _syncMusicMix() {
    if (!this.ctx || !this._musicGain) return;
    const now = this.ctx.currentTime;
    let targetGain = 0.0;
    let targetCutoff = 18000;

    if (this._musicEnabled && !this._bgmStopped) {
      if (this._sceneMode === 'playing') {
        targetGain = this._bossOverdrive ? 0.30 : 0.25;
        targetCutoff = 18000;
      } else if (this._sceneMode === 'paused') {
        targetGain = 0.13;
        targetCutoff = 1100;
      } else if (this._sceneMode === 'result') {
        targetGain = 0.0;
        targetCutoff = 4000;
      } else {
        // Title screen: monumental apocalyptic main theme
        targetGain = 0.28;
        targetCutoff = 15500;
      }
    }

    try {
      this._musicGain.gain.setTargetAtTime(targetGain, now, 0.06);
      if (this._musicSceneFilter) {
        this._musicSceneFilter.frequency.setTargetAtTime(targetCutoff, now, 0.09);
      }
    } catch {
      this._musicGain.gain.value = targetGain;
      if (this._musicSceneFilter) {
        this._musicSceneFilter.frequency.value = targetCutoff;
      }
    }
  }

  /**
   * Enable or disable procedural BGM synthesis.
   * @param {boolean} enabled
   */
  setMusicEnabled(enabled) {
    this._musicEnabled = Boolean(enabled);
    if (!this._musicEnabled) {
      // Silence smoothly while preserving track state
      this._syncMusicMix();
    } else {
      if (!this._bgmStopped && this.ctx) {
        this._ensureMusicTrackBus();
        this._nextStepTime = this.ctx.currentTime + 0.05;
      }
      this._syncMusicMix();
    }
  }

  /** @private */
  _onGameState(payload) {
    const state = typeof payload === 'string' ? payload : payload && payload.state;
    if (state === 'playing') {
      this.setSceneMode('playing');
    } else if (state === 'paused') {
      this.setSceneMode('paused');
    } else if (state === 'victory' || state === 'gameover' || state === 'result') {
      this.setSceneMode('result');
    } else {
      this.setSceneMode('title');
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
  /**
   * Warm analog saturation curve for heavy, gritty real-firearm transient punch (zero neon synth).
   * @private
   */
  _getDriveCurve() {
    if (this._driveCurve) return this._driveCurve;
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 2.5);
    }
    this._driveCurve = curve;
    return curve;
  }

  /**
   * Heavy asymmetric post-apocalyptic industrial overdrive curve for brass braams & distorted bass.
   * @private
   */
  _getMetalDriveCurve() {
    if (this._metalDriveCurve) return this._metalDriveCurve;
    const n = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * 5.2 + 0.18 * x * x);
    }
    this._metalDriveCurve = curve;
    return curve;
  }

  /**
   * Synthesize a heavy saturated sub-bass firearm kick / mechanical thump (zero pitch-laser sweep).
   * @private
   */
  _playHeavyPunch(dest, startTime, duration, startHz, endHz, gainVal) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(Math.max(28, startHz), startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, endHz), startTime + Math.min(duration, 0.055));

    shaper.curve = this._getDriveCurve();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(380, startTime);

    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(gainVal, startTime + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(shaper);
    shaper.connect(lp);
    lp.connect(g);
    g.connect(dest);

    osc.onended = () => {
      try {
        osc.disconnect();
        shaper.disconnect();
        lp.disconnect();
        g.disconnect();
      } catch {}
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

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
      const pj = 0.94 + Math.random() * 0.12;

      // Grounded Heavy Real-Firearm Gunpowder & Steel Bolt Foley (balanced headroom so hits cut through)
      switch (id) {
        case 'scattergun':
          // BR-12 12-GAUGE BREACHER: Thunderous chest kick + sharp muzzle crack + booming gunpowder tail + steel pump
          this._playHeavyPunch(dest, now, 0.20, 84 * pj, 28, 0.68);
          this._playNoiseBurst(dest, now, 0.018, 0.68, 'highpass', 1100 * pj, 600, 0.9, false);
          this._playNoiseBurst(dest, now, 0.26, 0.66, 'lowpass', 1500, 130, 0.7, true);
          this._playNoiseBurst(dest, now + 0.015, 0.18, 0.34, 'lowpass', 480, 95, 0.7, true);
          // Heavy steel pump-action rack (chk-clack)
          this._playNoiseBurst(dest, now + 0.18, 0.036, 0.26, 'bandpass', 1400, 900, 3.8, false);
          this._playNoiseBurst(dest, now + 0.28, 0.042, 0.30, 'bandpass', 2000, 1200, 4.2, false);
          break;

        case 'railgun':
          // HV-7 ANTI-MATERIEL CANNON: Massive .50-cal supersonic crack + earth-shaking low boom + steel breech slam
          this._playHeavyPunch(dest, now, 0.32, 92 * pj, 26, 0.72);
          this._playNoiseBurst(dest, now, 0.022, 0.72, 'bandpass', 1950 * pj, 700, 0.9, false);
          this._playNoiseBurst(dest, now + 0.006, 0.28, 0.64, 'lowpass', 1350, 115, 0.75, true);
          this._playNoiseBurst(dest, now + 0.06, 0.075, 0.28, 'bandpass', 850, 380, 3.0, false);
          break;

        case 'plasma_smg':
          // K-9 SCRAPPER PDW: Snappy 9mm/PDW dry tactical bark + rapid steel bolt rattle
          this._playHeavyPunch(dest, now, 0.055, 98 * pj, 36, 0.42);
          this._playNoiseBurst(dest, now, 0.014, 0.50, 'bandpass', 1800 * pj, 800, 1.1, false);
          this._playNoiseBurst(dest, now, 0.060, 0.34, 'lowpass', 1750, 240, 0.8, true);
          this._playNoiseBurst(dest, now + 0.018, 0.016, 0.18, 'bandpass', 2600, 1800, 3.6, false);
          break;

        case 'weld_pistol':
          // W-01 HEAVY SIDEARM: Crisp compact pistol crack + compressed gas punch
          this._playHeavyPunch(dest, now, 0.072, 102 * pj, 38, 0.40);
          this._playNoiseBurst(dest, now, 0.020, 0.46, 'bandpass', 1550 * pj, 650, 1.2, false);
          this._playNoiseBurst(dest, now, 0.080, 0.36, 'lowpass', 1200, 220, 0.9, true);
          break;

        case 'arc_rivet':
          // T-4 HEAVY NAIL/RIVET DRIVER: Hard pneumatic piston slam + solid steel anvil thud
          this._playHeavyPunch(dest, now, 0.10, 110 * pj, 34, 0.50);
          this._playNoiseBurst(dest, now, 0.020, 0.52, 'bandpass', 1650 * pj, 720, 2.2, false);
          this._playNoiseBurst(dest, now + 0.010, 0.085, 0.34, 'lowpass', 1100, 210, 0.9, true);
          break;

        case 'repulsor':
          // K-0 CONCUSSIVE AIR-CANNON: Deep sub-pressure thump + heavy compressed exhaust blast
          this._playHeavyPunch(dest, now, 0.22, 88 * pj, 26, 0.68);
          this._playNoiseBurst(dest, now, 0.22, 0.58, 'lowpass', 980, 110, 0.75, true);
          this._playNoiseBurst(dest, now + 0.06, 0.14, 0.26, 'bandpass', 1700, 820, 1.6, false);
          break;

        case 'pulse_rifle':
        default:
          // M41-A 7.62 ASSAULT RIFLE: Heavy punchy gunpowder snap + warm low-end thump + steel bolt clack
          this._playHeavyPunch(dest, now, 0.085, 90 * pj, 32, 0.52);
          this._playNoiseBurst(dest, now, 0.018, 0.56, 'bandpass', 1650 * pj, 680, 1.1, false);
          this._playNoiseBurst(dest, now, 0.095, 0.46, 'lowpass', 1850 * pj, 220, 0.8, true);
          this._playNoiseBurst(dest, now + 0.026, 0.020, 0.20, 'bandpass', 2700, 1850, 4.2, false);
          break;
      }

      // Subtle realistic brass/steel shell casing bounce on floor for ballistic guns
      if (id === 'pulse_rifle' || id === 'scattergun' || id === 'plasma_smg' || id === 'railgun') {
        const delay = 0.28 + Math.random() * 0.14;
        const j = 0.92 + Math.random() * 0.16;
        this._playNoiseBurst(dest, now + delay, 0.016, 0.055, 'bandpass', 4600 * j, 3900 * j, 11.0, false);
        this._playNoiseBurst(dest, now + delay + 0.065, 0.014, 0.038, 'bandpass', 5400 * j, 4700 * j, 12.0, false);
      }

      // Low-Ammo Dry Metallic Chamber Click (last 25% of magazine)
      if (
        payload &&
        Number.isFinite(payload.ammo) &&
        Number.isFinite(payload.magSize) &&
        payload.magSize > 0 &&
        payload.ammo <= Math.ceil(payload.magSize * 0.25)
      ) {
        this._playNoiseBurst(dest, now + 0.028, 0.016, 0.22, 'bandpass', 3200, 2400, 6.0, false);
      }
    } catch {}
  }

  // ===========================================================================
  // RELOAD, SWITCH & MELEE FOLEY (Pure Mechanical Steel — Zero Synth)
  // ===========================================================================

  /** @private */
  _playReloadStart() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playNoiseBurst(dest, now, 0.026, 0.28, 'bandpass', 2400, 1450, 4.2, false);
      this._playHeavyPunch(dest, now + 0.025, 0.055, 110, 48, 0.24);
      this._playNoiseBurst(dest, now + 0.045, 0.075, 0.18, 'bandpass', 950, 460, 2.2, true);
    } catch {}
  }

  /** @private */
  _playReloadFinish() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playHeavyPunch(dest, now, 0.065, 118, 42, 0.42);
      this._playNoiseBurst(dest, now, 0.032, 0.32, 'bandpass', 1650, 780, 3.6, false);
      this._playNoiseBurst(dest, now + 0.10, 0.030, 0.28, 'bandpass', 2100, 1250, 4.4, false);
      this._playNoiseBurst(dest, now + 0.145, 0.038, 0.34, 'bandpass', 2800, 1600, 4.8, false);
    } catch {}
  }

  /** @private */
  _playWeaponSwitch() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playNoiseBurst(dest, now, 0.060, 0.20, 'bandpass', 1050, 580, 2.2, true);
      this._playNoiseBurst(dest, now + 0.038, 0.022, 0.24, 'bandpass', 2400, 1600, 4.8, false);
    } catch {}
  }

  /** @private */
  _playMeleeSlash() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playNoiseBurst(dest, now, 0.15, 0.48, 'bandpass', 420, 1900, 1.3, true);
      this._playNoiseBurst(dest, now + 0.055, 0.13, 0.32, 'lowpass', 1500, 280, 1.0, true);
      this._playHeavyPunch(dest, now, 0.10, 105, 36, 0.42);
    } catch {}
  }

  // ===========================================================================
  // COMBAT FEEDBACK (Dry Ballistic Hit, Steel Helmet Headshot Crack, Heavy Kill Thud)
  // ===========================================================================

  /** @private */
  _onDamageDealt(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isHeadshot = Boolean(payload && payload.isHeadshot);
      const blockedByShield = Boolean(payload && payload.blockedByShield);
      // Offset +12ms so hit confirmation separates cleanly from 0ms weapon muzzle blast
      const t = now + 0.012;

      if (isHeadshot) {
        if (now - this._lastHeadshotTime < 0.032) return;
        this._lastHeadshotTime = now;
        this._lastHitmarkerTime = now;

        // Crisp metallic helmet-crack + dual-harmonic headshot dink
        this._playHeavyPunch(dest, t, 0.075, 138, 38, 0.46);
        this._playTone(dest, 'triangle', t, 0.075, 2050, 1680, 0.34, 0.001, 5200);
        this._playTone(dest, 'sine', t + 0.008, 0.095, 3120, 2640, 0.24, 0.001);
        this._playNoiseBurst(dest, t, 0.034, 0.42, 'bandpass', 3400, 1450, 2.6, false);
        return;
      }

      if (now - this._lastHitmarkerTime < 0.024) return;
      this._lastHitmarkerTime = now;

      if (blockedByShield) {
        // Metallic riot-shield ricochet clink
        this._playHeavyPunch(dest, t, 0.055, 118, 48, 0.26);
        this._playTone(dest, 'triangle', t, 0.048, 1240, 820, 0.28, 0.001, 3800);
        this._playNoiseBurst(dest, t, 0.034, 0.28, 'bandpass', 1800, 780, 3.6, false);
        return;
      }

      // Crisp dry tactical hit-confirm tick + armor thwack
      this._playHeavyPunch(dest, t, 0.050, 128, 44, 0.34);
      this._playTone(dest, 'triangle', t, 0.028, 1520, 620, 0.34, 0.001, 4200);
      this._playTone(dest, 'sine', t, 0.020, 2350, 1450, 0.22, 0.001);
      this._playNoiseBurst(dest, t, 0.024, 0.28, 'bandpass', 2400, 1100, 2.4, false);
    } catch {}
  }

  /** @private */
  _playGuardBlocked(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const broken = Boolean(payload && payload.guardBroken);
      if (broken) {
        this._playHeavyPunch(dest, now, 0.20, 102, 28, 0.56);
        this._playTone(dest, 'sawtooth', now, 0.22, 1480, 260, 0.26, 0.002, 3200);
        this._playNoiseBurst(dest, now, 0.09, 0.48, 'highpass', 3200, 1600, 1.4, false);
        this._playNoiseBurst(dest, now + 0.045, 0.14, 0.38, 'bandpass', 3800, 1900, 2.2, false);
      } else {
        this._playHeavyPunch(dest, now, 0.070, 116, 40, 0.38);
        this._playTone(dest, 'triangle', now, 0.045, 1320, 720, 0.28, 0.001, 3600);
        this._playNoiseBurst(dest, now, 0.028, 0.34, 'bandpass', 2600, 1350, 3.2, false);
      }
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
      const t = now + 0.018;

      // Authoritative kill-confirm mechanical punch + crisp two-tone confirm
      this._playHeavyPunch(dest, t, 0.13, 108, 32, 0.48);
      this._playTone(dest, 'triangle', t, 0.055, 760 * pitchMult, 580 * pitchMult, 0.28, 0.001, 3200);
      this._playTone(dest, 'sine', t + 0.028, 0.080, 1480 * pitchMult, 1280 * pitchMult, 0.24, 0.001);
      this._playNoiseBurst(dest, t, 0.085, 0.36, 'bandpass', 1400 * pitchMult, 360, 1.5, true);
      this._playNoiseBurst(dest, t + 0.030, 0.024, 0.24, 'bandpass', 2600 * pitchMult, 1600, 4.4, false);

      if (isBoss) {
        this._playHeavyPunch(dest, now, 0.95, 82, 24, 0.80);
        this._playNoiseBurst(dest, now, 1.15, 0.68, 'lowpass', 1650, 95, 0.75, true);
        this._playNoiseBurst(dest, now + 0.08, 0.48, 0.40, 'bandpass', 720, 160, 1.4, true);
      }
    } catch {}
  }

  // ===========================================================================
  // PLAYER MOVEMENT & VITALITY AUDIO (Zero Arcade Sweeps)
  // ===========================================================================

  /** @private */
  _playDash() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playHeavyPunch(dest, now, 0.14, 102, 32, 0.54);
      this._playNoiseBurst(dest, now, 0.18, 0.46, 'bandpass', 880, 240, 1.2, true);
      this._playNoiseBurst(dest, now, 0.075, 0.28, 'highpass', 2100, 1050, 1.4, false);
    } catch {}
  }

  /** @private */
  _playSlide() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playNoiseBurst(dest, now, 0.40, 0.32, 'bandpass', 980, 340, 1.8, true);
      this._playNoiseBurst(dest, now, 0.16, 0.18, 'highpass', 2400, 1400, 1.3, false);
      this._playHeavyPunch(dest, now, 0.10, 92, 36, 0.30);
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
        this._playHeavyPunch(dest, now, 0.11, 108, 42, 0.40);
        this._playNoiseBurst(dest, now, 0.14, 0.36, 'bandpass', 1100, 380, 1.3, true);
      } else {
        this._playHeavyPunch(dest, now, 0.075, 96, 40, 0.28);
        this._playNoiseBurst(dest, now, 0.065, 0.18, 'bandpass', 780, 400, 1.6, true);
      }
    } catch {}
  }

  /** @private */
  _playJumpPad() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playHeavyPunch(dest, now, 0.26, 98, 28, 0.62);
      this._playNoiseBurst(dest, now, 0.32, 0.48, 'bandpass', 680, 1850, 1.3, true);
      this._playNoiseBurst(dest, now + 0.04, 0.20, 0.26, 'highpass', 2200, 1100, 1.5, false);
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
        this._playHeavyPunch(dest, now, 0.10, 96 * jitter, 32, 0.38);
        this._playNoiseBurst(dest, now, 0.08, 0.22, 'lowpass', 720, 200, 1.0, true);
      } else {
        const vol = sprinting ? 0.12 : 0.08;
        this._playHeavyPunch(dest, now, 0.042, 86 * jitter, 38, vol);
        this._playNoiseBurst(dest, now, 0.030, vol * 0.9, 'bandpass', 1150 * jitter, 480, 2.2, true);
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

      if (!shieldBroken && !isFatal && now - this._lastPlayerDamagedTime < 0.055) {
        return;
      }
      this._lastPlayerDamagedTime = now;

      if (shieldBroken) {
        // Unmistakable shield collapse + arc shatter + chest slam
        this._playHeavyPunch(dest, now, 0.24, 106, 28, 0.56);
        this._playTone(dest, 'sawtooth', now, 0.24, 1680, 240, 0.30, 0.002, 3400);
        this._playNoiseBurst(dest, now, 0.14, 0.50, 'highpass', 2600, 1000, 1.4, false);
        this._playNoiseBurst(dest, now + 0.04, 0.20, 0.38, 'bandpass', 1800, 520, 1.8, false);
      } else if (shieldDmg > 0) {
        // Crisp kinetic shield impact crack + solid body thud
        this._playHeavyPunch(dest, now, 0.11, 118, 38, 0.38);
        this._playTone(dest, 'triangle', now, 0.065, 1380, 480, 0.34, 0.001, 4200);
        this._playNoiseBurst(dest, now, 0.075, 0.36, 'bandpass', 2400, 900, 2.0, false);
      }

      if (healthDmg > 0) {
        // Sharp visceral armor-pierce thwack + chest impact
        this._playHeavyPunch(dest, now, 0.15, 132, 34, 0.48);
        this._playTone(dest, 'triangle', now, 0.068, 860, 220, 0.36, 0.001, 2800);
        this._playNoiseBurst(dest, now, 0.085, 0.38, 'bandpass', 1750, 420, 1.4, false);
        // Helmeted Pilot Pain Grunt delayed slightly so initial impact transient stays crisp
        if (now - (this._lastGruntTime || 0) >= 0.42) {
          this._lastGruntTime = now;
          this._playPilotPainGrunt(dest, now + 0.025, healthDmg >= 20);
        }
        // Low-HP warning double pulse when below 35% health
        if (payload && Number.isFinite(payload.health) && payload.health > 0 && payload.health <= 35) {
          this._playHeavyPunch(dest, now + 0.14, 0.10, 74, 34, 0.36);
          this._playTone(dest, 'sine', now + 0.14, 0.06, 480, 380, 0.14, 0.002);
          this._playHeavyPunch(dest, now + 0.30, 0.09, 66, 32, 0.28);
        }
      }

      if (isFatal) {
        this._playHeavyPunch(dest, now + 0.04, 0.55, 76, 22, 0.64);
        this._playNoiseBurst(dest, now + 0.04, 0.50, 0.38, 'lowpass', 640, 100, 1.0, true);
      }
    } catch {}
  }

  /**
   * Formant-filtered vocal grunt for grounded helmeted pilot pain feedback.
   * @private
   */
  _playPilotPainGrunt(dest, startTime, isHeavy) {
    const ctx = this.ctx;
    const dur = isHeavy ? 0.18 : 0.13;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const basePitch = (isHeavy ? 102 : 118) * (0.94 + Math.random() * 0.12);
    osc.frequency.setValueAtTime(basePitch, startTime);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.70, startTime + dur);

    // Dual vocal tract formants (F1 ~620Hz, F2 ~1350Hz)
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(620, startTime);
    f1.Q.value = 3.0;

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(1350, startTime);
    f2.Q.value = 3.8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(isHeavy ? 0.24 : 0.18, startTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(g);
    f2.connect(g);
    g.connect(dest);

    osc.onended = () => {
      try {
        osc.disconnect();
        f1.disconnect();
        f2.disconnect();
        g.disconnect();
      } catch {}
    };

    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
    // Breathy helmet exhalation layer
    this._playNoiseBurst(dest, startTime + 0.01, dur * 0.85, isHeavy ? 0.14 : 0.10, 'bandpass', 1450, 680, 2.2, true);
  }

  /** @private */
  _playGuardToggle(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const raised = Boolean(payload && payload.raised);
      if (raised) {
        // Mechanical shield frame lock-in + pressurized deployment hiss
        this._playHeavyPunch(dest, now, 0.08, 108, 42, 0.36);
        this._playNoiseBurst(dest, now, 0.028, 0.26, 'bandpass', 2200, 1300, 4.2, false);
        this._playNoiseBurst(dest, now + 0.02, 0.14, 0.22, 'bandpass', 1800, 920, 1.8, false);
      } else {
        // Crisp retract latch click
        this._playNoiseBurst(dest, now, 0.024, 0.20, 'bandpass', 1900, 1100, 4.5, false);
        this._playHeavyPunch(dest, now + 0.02, 0.055, 88, 38, 0.22);
      }
    } catch {}
  }

  /** @private */
  _playUltimateActivated(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const fid = (payload && payload.frameId) || 'vanguard';
      if (fid === 'vanguard') {
        // Orbital Barrage: descending sky-roar + 3 staggered colossal ground impacts
        this._playNoiseBurst(dest, now, 0.45, 0.48, 'bandpass', 1600, 260, 1.2, true);
        for (let i = 0; i < 3; i++) {
          const t = now + 0.08 + i * 0.18;
          this._playHeavyPunch(dest, t, 0.45, 88, 20, 0.85);
          this._playNoiseBurst(dest, t, 0.55, 0.68, 'lowpass', 1500, 95, 0.8, true);
        }
      } else if (fid === 'strider') {
        // Time Dilation: heavy deep sub-bass drop + vacuum air-rush
        this._playHeavyPunch(dest, now, 0.85, 112, 22, 0.88);
        this._playNoiseBurst(dest, now, 0.65, 0.52, 'lowpass', 2400, 140, 1.1, true);
      } else if (fid === 'bastion') {
        // Aegis Fortress: monumental armored bulkhead slam + deep protective hum
        this._playHeavyPunch(dest, now, 0.55, 84, 24, 0.92);
        this._playNoiseBurst(dest, now, 0.08, 0.46, 'bandpass', 1400, 620, 3.0, false);
        this._playTone(dest, 'sawtooth', now + 0.04, 0.85, 65.41, 65.41, 0.22, 0.05, 380);
      } else {
        // Apex Apocalypse Nova: earth-shaking supernova blast
        this._playHeavyPunch(dest, now, 1.15, 96, 18, 0.98);
        this._playNoiseBurst(dest, now, 1.25, 0.86, 'lowpass', 2200, 85, 0.75, true);
        this._playNoiseBurst(dest, now + 0.03, 0.45, 0.50, 'bandpass', 1600, 320, 1.4, false);
      }
    } catch {}
  }

  _playHeal() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      if (now - this._lastHealTime < 0.22) return;
      this._lastHealTime = now;
      const dest = this._sfxGain;
      // Pure pressurized med-injector hiss + dry mechanical latch click
      this._playNoiseBurst(dest, now, 0.15, 0.28, 'bandpass', 2400, 1250, 1.9, false);
      this._playNoiseBurst(dest, now + 0.09, 0.028, 0.22, 'bandpass', 1850, 1200, 4.5, false);
      this._playHeavyPunch(dest, now + 0.09, 0.05, 92, 42, 0.22);
    } catch {}
  }

  /** @private */
  _playGoldPickup() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const jitter = 0.94 + Math.random() * 0.12;
      this._playNoiseBurst(dest, now, 0.028, 0.24, 'bandpass', 3800 * jitter, 3200 * jitter, 9.0, false);
      this._playNoiseBurst(dest, now + 0.036, 0.036, 0.20, 'bandpass', 4800 * jitter, 4200 * jitter, 10.0, false);
    } catch {}
  }

  /** @private */
  _playWeaponDropPickup(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isOverclock = Boolean(payload && !payload.unlocked);
      this._playHeavyPunch(dest, now, 0.10, 110, 42, 0.48);
      this._playNoiseBurst(dest, now, 0.042, 0.34, 'bandpass', 1750, 880, 3.8, false);
      this._playNoiseBurst(dest, now + 0.075, 0.038, 0.34, 'bandpass', 2600, 1550, 4.6, false);
      if (isOverclock) {
        this._playHeavyPunch(dest, now + 0.09, 0.18, 95, 34, 0.52);
        this._playNoiseBurst(dest, now + 0.11, 0.12, 0.26, 'bandpass', 1500, 2200, 2.4, true);
      }
    } catch {}
  }

  /** @private */
  _playUpgradeSelected() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playHeavyPunch(dest, now, 0.18, 105, 36, 0.52);
      this._playNoiseBurst(dest, now, 0.050, 0.32, 'bandpass', 1450, 680, 3.2, false);
      this._playNoiseBurst(dest, now + 0.085, 0.060, 0.26, 'bandpass', 2300, 1500, 4.5, false);
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
        this._playHeavyPunch(dest, now, 0.07, 115, 48, 0.34);
        this._playNoiseBurst(dest, now, 0.038, 0.28, 'bandpass', 2100, 1300, 4.2, false);
        this._playNoiseBurst(dest, now + 0.048, 0.032, 0.24, 'bandpass', 2900, 1850, 4.8, false);
      } else {
        this._playHeavyPunch(dest, now, 0.12, 102, 40, 0.36);
        this._playNoiseBurst(dest, now, 0.048, 0.28, 'bandpass', 1800, 900, 3.8, false);
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
        this._playHeavyPunch(dest, now, 0.36, 92, 34, 0.52);
        this._playNoiseBurst(dest, now, 0.14, 0.28, 'bandpass', 1200, 600, 2.6, true);
        return;
      }
      if (!payload.captured) {
        this._lastZoneCaptured = false;
        const pct = Math.floor((Number(payload.progress) || 0) * 10);
        if (payload.capturing && pct > (this._lastZoneDecile || 0)) {
          this._lastZoneDecile = pct;
          this._playNoiseBurst(dest, now, 0.020, 0.15, 'bandpass', 1900 + pct * 70, 1500, 5.5, false);
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
      this._playHeavyPunch(dest, now, 0.80, 72, 22, 0.68);
      this._playNoiseBurst(dest, now, 0.72, 0.40, 'lowpass', 1300, 160, 1.0, true);
      this._playNoiseBurst(dest, now + 0.08, 0.34, 0.22, 'bandpass', 2200, 850, 2.2, false);
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
      // Dry mechanical rangefinder double-click (no high sine beep)
      this._playNoiseBurst(dest, now, 0.018, 0.24, 'bandpass', 2600, 1900, 5.5, false);
      this._playNoiseBurst(dest, now + 0.085, 0.022, 0.28, 'bandpass', 3100, 2300, 5.5, false);
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
        this._playHeavyPunch(dest, now, 0.52, 86, 20, 0.84);
        this._playNoiseBurst(dest, now, 0.45, 0.54, 'lowpass', 880, 110, 0.9, true);
      } else {
        this._playHeavyPunch(dest, now, 0.20, 108, 34, 0.52);
        this._playNoiseBurst(dest, now, 0.18, 0.34, 'bandpass', 850, 280, 1.8, true);
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
        this._playNoiseBurst(dest, now, 0.36, 0.34, 'bandpass', 3000, 1100, 1.6, false);
        this._playHeavyPunch(dest, now, 0.12, 105, 42, 0.26);
      } else {
        this._playNoiseBurst(dest, now, 0.016, 0.28, 'bandpass', 3200, 2200, 6.5, false);
      }
    } catch {}
  }

  /** @private */
  _playDashReady() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playNoiseBurst(dest, now, 0.026, 0.16, 'bandpass', 2200, 1500, 4.8, false);
    } catch {}
  }

  /** @private */
  _playRankUp(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playHeavyPunch(dest, now, 0.14, 105, 38, 0.36);
      this._playNoiseBurst(dest, now, 0.038, 0.24, 'bandpass', 2100, 1300, 4.2, false);
    } catch {}
  }

  /** @private */
  _playSynergy() {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      this._playHeavyPunch(dest, now, 0.28, 92, 30, 0.50);
      this._playNoiseBurst(dest, now, 0.15, 0.30, 'bandpass', 1500, 760, 2.8, true);
    } catch {}
  }

  // ===========================================================================
  // 3D SPATIALIZED EXPLOSIONS & ENEMY WEAPONRY (Heavy Ballistic — Zero Neon)
  // ===========================================================================

  /** @private */
  _playBarrelExplosion(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const pos = payload && payload.position;
      const dest = pos ? this._getSpatialPanner(pos, 7.5, 85, 1.0) : this._sfxGain;

      this._playHeavyPunch(dest, now, 0.65, 84, 19, 0.96);
      this._playNoiseBurst(dest, now, 0.88, 0.82, 'lowpass', 2200, 95, 0.8, true);
      this._playNoiseBurst(dest, now + 0.02, 0.32, 0.44, 'bandpass', 1750, 380, 1.4, false);
    } catch {}
  }

  /** @private */
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
        case 'interceptor_drone':
        case 'void_swarmer':
          this._playHeavyPunch(dest, now, 0.055, 108 * jitter, 38, 0.32);
          this._playNoiseBurst(dest, now, 0.044, 0.28, 'bandpass', 1800 * jitter, 720, 1.5, false);
          break;
        case 'volatile_rusher':
          this._playHeavyPunch(dest, now, 0.075, 130 * jitter, 46, 0.38);
          this._playNoiseBurst(dest, now, 0.055, 0.34, 'bandpass', 2000 * jitter, 640, 1.4, false);
          break;
        case 'shock_breacher':
          this._playHeavyPunch(dest, now, 0.15, 96 * jitter, 28, 0.56);
          this._playNoiseBurst(dest, now, 0.14, 0.48, 'lowpass', 1600, 200, 1.0, true);
          break;
        case 'vanguard_assassin':
        case 'void_warper':
          this._playHeavyPunch(dest, now, 0.055, 114 * jitter, 42, 0.34);
          this._playNoiseBurst(dest, now, 0.040, 0.30, 'bandpass', 2100 * jitter, 850, 1.4, false);
          break;
        case 'heavy_enforcer':
        case 'rail_warden':
        case 'abyss_sentinel':
          this._playHeavyPunch(dest, now, 0.20, 94 * jitter, 26, 0.60);
          this._playNoiseBurst(dest, now, 0.16, 0.48, 'lowpass', 1400, 180, 1.0, true);
          break;
        case 'boss_turret':
          this._playTone(dest, 'triangle', now, 0.12, 680 * jitter, 240, 0.22, 0.02, 2400);
          this._playNoiseBurst(dest, now, 0.045, 0.24, 'bandpass', 2200 * jitter, 800, 1.6, false);
          break;
        case 'mortar_artillery':
          this._playHeavyPunch(dest, now, 0.25, 82 * jitter, 22, 0.64);
          this._playNoiseBurst(dest, now, 0.22, 0.44, 'lowpass', 1050, 130, 0.9, true);
          break;
        case 'sniper_stalker':
          this._playHeavyPunch(dest, now, 0.16, 104 * jitter, 28, 0.58);
          this._playNoiseBurst(dest, now, 0.028, 0.56, 'bandpass', 2400 * jitter, 820, 1.1, false);
          this._playNoiseBurst(dest, now + 0.01, 0.16, 0.40, 'lowpass', 1500, 190, 0.9, true);
          break;
        case 'aegis_overlord_boss':
        case 'cyber_mech_boss':
        case 'transcendent_omega_boss':
          this._playHeavyPunch(dest, now, 0.26, 84 * jitter, 20, 0.72);
          this._playNoiseBurst(dest, now, 0.20, 0.54, 'lowpass', 1400, 140, 0.95, true);
          break;
        case 'tactical_trooper':
        default:
          this._playHeavyPunch(dest, now, 0.070, 102 * jitter, 36, 0.36);
          this._playNoiseBurst(dest, now, 0.062, 0.30, 'bandpass', 1550 * jitter, 520, 1.4, true);
          break;
      }
    } catch {}
  }

  /** @private */
  _playVoidGateShatter(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const pos = payload && payload.position ? payload.position : null;
      const dest = pos ? this._getSpatialPanner(pos, 8.0, 90, 1.0) : this._sfxGain;
      this._playHeavyPunch(dest, now, 0.52, 92, 22, 0.85);
      this._playTone(dest, 'sawtooth', now, 0.48, 320, 74, 0.28, 0.04, 1600);
      this._playNoiseBurst(dest, now, 0.45, 0.62, 'bandpass', 1900, 260, 1.3, true);
    } catch {}
  }

  /** @private */
  _playTeleportRift(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const pos = (payload && (payload.toPos || payload.fromPos)) || null;
      const dest = pos ? this._getSpatialPanner(pos, 6.0, 70, 1.1) : this._sfxGain;
      this._playTone(dest, 'sine', now, 0.24, 180, 920, 0.22, 0.02, 2600);
      this._playNoiseBurst(dest, now, 0.16, 0.26, 'bandpass', 2400, 750, 2.0, false);
    } catch {}
  }

  /** @private */
  _playEnemyOverload(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const pos = payload && payload.position ? payload.position : null;
      const dest = pos ? this._getSpatialPanner(pos, 7.0, 80, 1.0) : this._sfxGain;
      if (payload && payload.phase === 'detonate') {
        this._playHeavyPunch(dest, now, 0.58, 88, 20, 0.92);
        this._playNoiseBurst(dest, now, 0.62, 0.78, 'lowpass', 2100, 110, 0.9, true);
      } else {
        this._playTone(dest, 'sawtooth', now, 0.42, 260, 780, 0.20, 0.03, 2200);
      }
    } catch {}
  }

  /** @private */
  _playTurretShatter(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const pos = payload && payload.position ? payload.position : null;
      const dest = pos ? this._getSpatialPanner(pos, 8.0, 85, 1.0) : this._sfxGain;
      this._playHeavyPunch(dest, now, 0.44, 110, 26, 0.78);
      this._playNoiseBurst(dest, now, 0.36, 0.54, 'bandpass', 2100, 380, 1.5, true);
      if (payload && payload.shieldBroken) {
        this._playTone(this._sfxGain, 'triangle', now + 0.06, 0.62, 520, 140, 0.32, 0.05, 1900);
      }
    } catch {}
  }

  // ===========================================================================
  // CINEMATIC WAVE & BOSS STINGERS (Deep War-Horn & Mechanical Impact — Zero Beeps)
  // ===========================================================================

  /** @private */
  _playWaveStarted(payload) {
    if (payload && payload.wave != null) {
      const trackId = this.resolveTrackForWave(payload.wave, payload.isBossWave);
      const shouldForceReset =
        this._bgmStopped || trackId !== this._currentTrackId || Boolean(payload.isBossWave);
      this.setBgmTrack(trackId, shouldForceReset);
    }
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isBoss = Boolean(payload && payload.isBossWave);
      if (isBoss) {
        this._playBossPhase({ phase: 1 });
        return;
      }
      this._playHeavyPunch(dest, now, 0.45, 78, 28, 0.50);
      const freqs = [73.42, 110.0];
      for (let i = 0; i < freqs.length; i++) {
        this._playTone(dest, 'sawtooth', now, 0.65, freqs[i], freqs[i], 0.12, 0.08, 620);
      }
    } catch {}
  }

  /** @private */
  _playWaveCleared(payload) {
    if (!this._isReady()) return;
    try {
      const now = this.ctx.currentTime;
      const dest = this._sfxGain;
      const isFinal = Boolean(payload && payload.isFinalWave);
      const baseNotes = isFinal ? [82.41, 110.0, 146.83] : [82.41, 110.0];
      for (let i = 0; i < baseNotes.length; i++) {
        const t = now + i * 0.16;
        this._playTone(dest, 'sawtooth', t, 0.45, baseNotes[i], baseNotes[i], 0.13, 0.03, 520);
        this._playHeavyPunch(dest, t, 0.25, baseNotes[i], 36, 0.32);
      }
      this._playNoiseBurst(dest, now, 0.07, 0.16, 'bandpass', 1600, 900, 3.0, false);
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

      // Deep Cinematic War-Horn + Sub Impact (Zero square alert pips!)
      this._playTone(dest, 'sawtooth', now, 1.15, baseHz, baseHz * 0.96, 0.24, 0.06, 560);
      this._playTone(dest, 'sawtooth', now, 1.15, baseHz * 1.006, baseHz * 0.966, 0.24, 0.06, 600);
      this._playHeavyPunch(dest, now, 1.10, 74, 20, 0.72);
      this._playNoiseBurst(dest, now, 0.55, 0.34, 'lowpass', 620, 140, 1.4, true);
    } catch {}
  }

  /**
   * Sync Web Audio 3D AudioListener to camera transform during gameplay.
   * BGM scheduling is driven reliably across all scenes by _tickBgm().
   *
   * @param {number} _dt
   */
  update(_dt) {
    if (!this._isReady()) return;
    this._syncAudioListener();
  }

  /**
   * Background lookahead scheduler dispatching:
   * - Title Screen ('main_theme'): 64-step Post-Apocalyptic Main Theme
   * - Normal Stages ('zone1_normal' | 'zone2_normal' | 'zone3_normal'): Original 32-step Stage BGM
   * - Boss Rooms ('zone1_boss' | 'zone2_boss' | 'zone3_boss'): Grand Orchestral-Industrial Boss BGM
   * @private
   */
  _tickBgm() {
    if (!this._isReady() || !this._musicEnabled || this._bgmStopped) {
      if (this.ctx) {
        this._nextStepTime = this.ctx.currentTime + 0.05;
      }
      return;
    }

    this._ensureMusicTrackBus();
    if (!this._trackGain) return;

    const nowMs = performance.now();
    const dt = Math.min(0.12, Math.max(0.01, (nowMs - (this._lastBgmTickMs || nowMs)) * 0.001));
    this._lastBgmTickMs = nowMs;

    let desiredIntensity = 0.28;
    if (this._sceneMode === 'playing') {
      const floor = this._bossOverdrive ? 0.85 : 0.45;
      desiredIntensity = Math.max(floor, this._targetIntensity);
    } else if (this._sceneMode === 'paused') {
      desiredIntensity = 0.18;
    } else if (this._sceneMode === 'result') {
      return;
    }

    this._currentIntensity +=
      (desiredIntensity - this._currentIntensity) * (1 - Math.exp(-2.8 * dt));

    const now = this.ctx.currentTime;
    if (this._nextStepTime < now - 0.25) {
      this._nextStepTime = now + 0.04;
    }

    if (this._currentTrackId === 'main_theme') {
      const stepSec = APOC_MAIN_THEME.baseStepSec;
      while (this._nextStepTime < now + 0.14) {
        this._scheduleApocMainStep(this._nextStepTime, this._stepIndex, this._currentIntensity, stepSec);
        this._nextStepTime += stepSec;
        this._stepIndex = (this._stepIndex + 1) & 63;
      }
    } else {
      const track = BGM_TRACKS[this._currentTrackId] || BGM_TRACKS.zone1_normal;
      const stepSec = track.stepSec || 0.125;
      while (this._nextStepTime < now + 0.13) {
        if (track.isBoss) {
          this._scheduleGrandBossStep(this._nextStepTime, this._stepIndex, this._currentIntensity, track);
        } else {
          this._scheduleZoneNormalStep(this._nextStepTime, this._stepIndex, this._currentIntensity, track);
        }
        this._nextStepTime += stepSec;
        this._stepIndex = (this._stepIndex + 1) & 31;
      }
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
   * Colossal Post-Apocalyptic Brass Braam (3 detuned saws + sub square through industrial overdrive).
   * @private
   */
  _playApocBraam(time, baseFreq, duration, gainPeak) {
    const ctx = this.ctx;
    const dest = this._trackGain || this._musicGain;
    const rev = this._musicReverbSend;
    const freq = Math.max(32, baseFreq < 45 ? baseFreq * 2 : baseFreq);

    const shaper = ctx.createWaveShaper();
    shaper.curve = this._getMetalDriveCurve();

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.2, time);
    filter.frequency.setValueAtTime(160, time);
    filter.frequency.exponentialRampToValueAtTime(1250, time + Math.min(0.24, duration * 0.25));
    filter.frequency.exponentialRampToValueAtTime(240, time + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + 0.055);
    env.gain.setValueAtTime(gainPeak * 0.88, time + duration * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    const detunes = [-12, 0, 12];
    const oscs = [];
    for (let i = 0; i < detunes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(detunes[i], time);
      osc.connect(shaper);
      oscs.push(osc);
    }
    const subOsc = ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(Math.max(28, baseFreq), time);
    subOsc.connect(shaper);
    oscs.push(subOsc);

    shaper.connect(filter);
    filter.connect(env);
    env.connect(dest);
    if (rev) env.connect(rev);

    oscs[0].onended = () => {
      try {
        for (let i = 0; i < oscs.length; i++) oscs[i].disconnect();
        shaper.disconnect();
        filter.disconnect();
        env.disconnect();
      } catch {}
    };

    for (let i = 0; i < oscs.length; i++) {
      oscs[i].start(time);
      oscs[i].stop(time + duration + 0.04);
    }
  }

  /**
   * Desolate Cathedral Choir / Dark Brass-Strings Pad swelling across each bar.
   * @private
   */
  _playApocChoirPad(time, freqs, duration, gainPeak) {
    const ctx = this.ctx;
    const dest = this._trackGain || this._musicGain;
    const rev = this._musicReverbSend;

    const f1 = ctx.createBiquadFilter();
    f1.type = 'lowpass';
    f1.frequency.setValueAtTime(980, time);
    f1.Q.setValueAtTime(1.1, time);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainPeak, time + Math.min(0.42, duration * 0.3));
    env.gain.setValueAtTime(gainPeak * 0.82, time + duration * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    const oscs = [];
    for (let i = 0; i < freqs.length; i++) {
      const oA = ctx.createOscillator();
      oA.type = i === 0 ? 'sawtooth' : 'triangle';
      oA.frequency.setValueAtTime(freqs[i], time);
      oA.detune.setValueAtTime(i % 2 === 0 ? -7 : 7, time);
      oA.connect(f1);
      oscs.push(oA);
    }

    f1.connect(env);
    env.connect(dest);
    if (rev) env.connect(rev);

    oscs[0].onended = () => {
      try {
        for (let i = 0; i < oscs.length; i++) oscs[i].disconnect();
        f1.disconnect();
        env.disconnect();
      } catch {}
    };

    for (let i = 0; i < oscs.length; i++) {
      oscs[i].start(time);
      oscs[i].stop(time + duration + 0.05);
    }
  }

  /**
   * Destructive Industrial Drop-D Distorted Bass Chug.
   * @private
   */
  _playApocDistBass(time, freq, duration, gainPeak, aggression) {
    const ctx = this.ctx;
    const dest = this._trackGain || this._musicGain;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.992, time + duration);

    const shaper = ctx.createWaveShaper();
    shaper.curve = aggression > 0.45 ? this._getMetalDriveCurve() : this._getDriveCurve();

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const peakCut = 240 + aggression * 980;
    lp.frequency.setValueAtTime(peakCut, time);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, peakCut * 0.38), time + duration);
    lp.Q.setValueAtTime(2.2, time);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gainPeak, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(shaper);
    shaper.connect(lp);
    lp.connect(g);
    g.connect(dest);

    osc.onended = () => {
      try {
        osc.disconnect();
        shaper.disconnect();
        lp.disconnect();
        g.disconnect();
      } catch {}
    };

    osc.start(time);
    osc.stop(time + duration + 0.025);
  }

  /**
   * Iconic Soaring Post-Apocalyptic Theme Lead (tragic orchestral brass on Title -> roaring lead in Combat).
   * @private
   */
  _playApocLead(time, freq, duration, gainPeak, aggression) {
    const ctx = this.ctx;
    const dest = this._trackGain || this._musicGain;
    const rev = this._musicReverbSend;

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = aggression > 0.5 ? 'sawtooth' : 'triangle';
    o1.frequency.setValueAtTime(freq, time);
    o2.frequency.setValueAtTime(freq, time);
    o1.detune.setValueAtTime(-6, time);
    o2.detune.setValueAtTime(6, time);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1250 + aggression * 1550, time);
    lp.Q.setValueAtTime(1.6, time);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gainPeak, time + 0.028);
    g.gain.setValueAtTime(gainPeak * 0.78, time + duration * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    if (aggression > 0.55) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this._getDriveCurve();
      o1.connect(shaper);
      o2.connect(shaper);
      shaper.connect(lp);
      o1.onended = () => {
        try {
          o1.disconnect();
          o2.disconnect();
          shaper.disconnect();
          lp.disconnect();
          g.disconnect();
        } catch {}
      };
    } else {
      o1.connect(lp);
      o2.connect(lp);
      o1.onended = () => {
        try {
          o1.disconnect();
          o2.disconnect();
          lp.disconnect();
          g.disconnect();
        } catch {}
      };
    }

    lp.connect(g);
    g.connect(dest);
    if (rev) g.connect(rev);

    o1.start(time);
    o2.start(time);
    o1.stop(time + duration + 0.04);
    o2.stop(time + duration + 0.04);
  }

  /**
   * Thunderous Apocalyptic War-Drum / Demolition Taiko Boom.
   * @private
   */
  _playWarDrum(time, strength, aggression) {
    const dest = this._trackGain || this._musicGain;
    const rev = this._musicReverbSend;
    const amp = (strength >= 2 ? 0.54 : 0.36) * (0.76 + aggression * 0.36);
    const dur = strength >= 2 ? 0.34 : 0.20;
    this._playHeavyPunch(dest, time, dur, strength >= 2 ? 122 : 98, 28, amp);
    if (strength >= 2) {
      this._playNoiseBurst(dest, time, 0.14, 0.22 * (0.7 + aggression * 0.4), 'lowpass', 520, 110, 0.9, true);
      if (rev) {
        this._playNoiseBurst(rev, time, 0.12, 0.14, 'lowpass', 360, 95, 0.8, true);
      }
    }
  }

  /**
   * Crushing Scrap-Iron Anvil / Industrial Steel Slam.
   * @private
   */
  _playAnvilClang(time, strength, aggression) {
    const dest = this._trackGain || this._musicGain;
    const rev = this._musicReverbSend;
    const scale = 0.65 + aggression * 0.5;
    if (strength >= 2) {
      // Heavy metallic anvil crash + punchy industrial snare body
      this._playHeavyPunch(dest, time, 0.16, 155, 44, 0.34 * scale);
      this._playNoiseBurst(dest, time, 0.18, 0.24 * scale, 'bandpass', 1680, 480, 2.8, false);
      this._playTone(dest, 'triangle', time, 0.22, 418, 396, 0.11 * scale, 0.001, 2400);
      this._playTone(dest, 'sine', time, 0.19, 1140, 1085, 0.08 * scale, 0.001);
      if (rev) {
        this._playNoiseBurst(rev, time, 0.16, 0.14 * scale, 'bandpass', 1400, 520, 2.4, false);
      }
    } else {
      // Tight industrial rim/snare crack
      this._playTone(dest, 'triangle', time, 0.08, 185, 78, 0.16 * scale, 0.002);
      this._playNoiseBurst(dest, time, 0.095, 0.17 * scale, 'bandpass', 2100, 760, 1.8, false);
    }
  }

  /**
   * Schedule one 16th-note step of the 64-step Post-Apocalyptic Main Theme (Title Screen).
   * @private
   */
  _scheduleApocMainStep(time, step, intensity, stepSec) {
    try {
      const idx = step & 63;
      const aggression = 0.26;

      // 1. Colossal Brass Braam on major structural hits
      const braam = APOC_MAIN_THEME.braam[idx];
      if (braam) {
        this._playApocBraam(time, braam.freq, braam.dur, braam.gain * 0.94);
      }

      // 2. Desolate Cathedral Choir / Dark Strings Pad on each 16-step bar
      const chord = APOC_MAIN_THEME.chords[idx];
      if (chord) {
        this._playApocChoirPad(time, chord, stepSec * 15.5, 0.12);
      }

      // 3. Destructive Industrial Drop-D Bass Riff (heavy brooding pulse on Title)
      const bassHz = APOC_MAIN_THEME.bass[idx];
      if (bassHz > 0) {
        const isTitleHeavyBeat = (idx & 3) === 0 || (idx & 7) === 6;
        if (isTitleHeavyBeat) {
          this._playApocDistBass(time, bassHz, stepSec * 2.1, 0.18, aggression);
        }
      }

      // 4. Iconic Soaring Theme Melody
      const leadNote = APOC_MAIN_THEME.lead[idx];
      if (leadNote) {
        this._playApocLead(time, leadNote.f, stepSec * leadNote.d * 0.96, 0.15, aggression);
      }

      // 5. Monumental Half-Time War-Drums
      const kickLv = APOC_MAIN_THEME.warDrum[idx];
      if (kickLv > 0) {
        this._playWarDrum(time, kickLv, aggression);
      }

      // 6. Crushing Metallic Anvil Slams on Heavy Backbeats
      const anvilLv = APOC_MAIN_THEME.anvil[idx];
      if (anvilLv >= 2) {
        this._playAnvilClang(time, anvilLv, aggression);
      }
    } catch {}
  }

  /**
   * Original 32-step Zone Stage BGM Scheduler (zone1_normal, zone2_normal, zone3_normal).
   * @private
   */
  _scheduleZoneNormalStep(time, step, intensity, track) {
    try {
      const dest = this._trackGain || this._musicGain;
      const idx = step & 31;
      const stepSec = track.stepSec || 0.125;

      // 1. Driving Zone Bassline
      const bassHz = track.bass[idx];
      if (bassHz > 0) {
        const cut = (track.bassFilterBase || 190) + intensity * (track.bassFilterSpan || 420);
        this._playTone(
          dest,
          track.bassWave || 'sawtooth',
          time,
          stepSec * 1.35,
          bassHz,
          bassHz * 0.995,
          (track.bassGain || 0.26) * (0.72 + intensity * 0.35),
          0.004,
          cut
        );
      }

      // 2. Atmospheric Pad Chords every 8 steps
      if ((idx & 7) === 0 && track.chords && track.chords.length > 0) {
        const chord = track.chords[(idx >> 3) % track.chords.length];
        for (let i = 0; i < chord.length; i++) {
          this._playTone(
            dest,
            track.padWave || 'triangle',
            time,
            stepSec * 7.6,
            chord[i],
            chord[i],
            track.padGain || 0.07,
            0.09,
            track.padFilter || 760
          );
        }
      }

      // 3. Signature Zone Lead Arpeggio
      const leadHz = track.lead[idx];
      if (leadHz > 0) {
        this._playTone(
          dest,
          track.leadWave || 'triangle',
          time,
          stepSec * 1.45,
          leadHz,
          leadHz,
          (track.leadGain || 0.14) * (0.68 + intensity * 0.42),
          0.006,
          track.leadFilter || 1900
        );
      }

      // 4. Kick Drum
      const kickLv = track.kick[idx];
      if (kickLv > 0) {
        this._playHeavyPunch(
          dest,
          time,
          kickLv === 2 ? 0.17 : 0.11,
          kickLv === 2 ? 128 : 96,
          36,
          (kickLv === 2 ? 0.44 : 0.28) * (0.78 + intensity * 0.28)
        );
      }

      // 5. Snare
      const snareLv = track.snare[idx];
      if (snareLv > 0) {
        this._playTone(dest, 'triangle', time, 0.065, 195, 86, 0.14, 0.002);
        this._playNoiseBurst(dest, time, 0.09, 0.16, 'bandpass', 2200, 880, 1.5, false);
      }

      // 6. Hi-Hat (scales with combat intensity)
      const hatLv = track.hat[idx];
      if (hatLv > 0 && intensity > 0.22) {
        this._playNoiseBurst(
          dest,
          time,
          hatLv === 2 ? 0.048 : 0.02,
          (hatLv === 2 ? 0.095 : 0.055) * Math.min(1, intensity + 0.2),
          'highpass',
          6200,
          3600,
          1.4,
          false
        );
      }
    } catch {}
  }

  /**
   * Grand Monumental Boss Room BGM Scheduler (zone1_boss, zone2_boss, zone3_boss).
   * Combines each boss's signature fast motif with colossal brass braams, cathedral choir chords,
   * distorted drop bass, thunderous taiko war-drums, and heavy metallic anvil slams.
   * @private
   */
  _scheduleGrandBossStep(time, step, intensity, track) {
    try {
      const dest = this._trackGain || this._musicGain;
      const idx = step & 31;
      const stepSec = track.stepSec || 0.108;
      const aggression = Math.min(1.0, 0.72 + intensity * 0.28);

      // 1. Colossal Brass Braam + Cathedral Choir Swell on every bar downbeat (steps 0, 8, 16, 24)
      if ((idx & 7) === 0 && track.chords && track.chords.length > 0) {
        const barIdx = (idx >> 3) % track.chords.length;
        const baseChord = track.chords[barIdx];
        const rootHz = baseChord[0] || 138.59;
        const braamHz = rootHz * 0.5;
        this._playApocBraam(time, braamHz, stepSec * 7.6, idx === 0 || idx === 16 ? 0.42 : 0.34);

        // Expand 2-note chord into a lush 4-voice ominous choir chord (root, fifth, octave, minor 10th)
        const choirFreqs = [
          rootHz,
          baseChord[1] || rootHz * 1.498,
          rootHz * 2.0,
          (baseChord[1] || rootHz * 1.498) * 1.587,
        ];
        this._playApocChoirPad(time, choirFreqs, stepSec * 7.8, 0.11);
      }

      // 2. Crushing Overdriven Boss Bassline
      const bassHz = track.bass[idx];
      if (bassHz > 0) {
        this._playApocDistBass(time, bassHz, stepSec * 1.32, 0.27 + intensity * 0.08, aggression);
      }

      // 3. Soaring Heroic-Menacing Boss Lead (detuned dual-saw brass/synth lead)
      const leadHz = track.lead[idx];
      if (leadHz > 0) {
        this._playApocLead(time, leadHz, stepSec * 1.55, 0.145 + intensity * 0.045, aggression);
      }

      // 4. Thunderous Double-Kick War-Drums
      const kickLv = track.kick[idx];
      if (kickLv > 0) {
        this._playWarDrum(time, kickLv, aggression);
      }

      // 5. Heavy Scrap-Iron Anvil & Industrial Snare Slams
      const snareLv = track.snare[idx];
      if (snareLv > 0) {
        this._playAnvilClang(time, snareLv, aggression);
      }

      // 6. Relentless Metallic Boss Hi-Hat
      const hatLv = track.hat[idx];
      if (hatLv > 0) {
        this._playNoiseBurst(
          dest,
          time,
          hatLv === 2 ? 0.05 : 0.022,
          hatLv === 2 ? 0.105 : 0.062,
          'highpass',
          5800,
          3400,
          1.5,
          false
        );
      }
    } catch {}
  }

  /**
   * Unsubscribe from EventBus and close AudioContext cleanly.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.stopBgmHard();

    if (this._bgmIntervalId !== null) {
      try {
        window.clearInterval(this._bgmIntervalId);
      } catch {}
      this._bgmIntervalId = null;
    }

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
    this._subFilter = null;
    this._compressor = null;
    this._whiteNoiseBuffer = null;
    this._pinkNoiseBuffer = null;
  }
}
  __exports.SoundEngine = SoundEngine;
});
