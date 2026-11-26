// Module: src/config/constants.js
__define("src/config/constants.js", (__exports, __require) => {
/**
 * AETHER DROP: RECLAIM EARTH — Core Game Constants, Event Bus Keys & Balance Tunings
 * Zero external dependencies. ES2022 module.
 */

const EVENTS = Object.freeze({
  WEAPON_FIRED: 'weapon:fired',
  WEAPON_RELOADED: 'weapon:reloaded',
  WEAPON_RELOAD_START: 'weapon:reload_start',
  WEAPON_SWITCHED: 'weapon:switched',
  WEAPON_MELEE: 'weapon:melee',
  DAMAGE_DEALT: 'damage:dealt',
  ENEMY_KILLED: 'enemy:killed',
  PLAYER_DAMAGED: 'player:damaged',
  PLAYER_HEALED: 'player:healed',
  PLAYER_DASH: 'player:dash',
  PLAYER_SLIDE: 'player:slide',
  PLAYER_JUMP: 'player:jump',
  PLAYER_JUMPPAD: 'player:jumppad',
  PLAYER_FOOTSTEP: 'player:footstep',
  BARREL_EXPLODED: 'barrel:exploded',
  PICKUP_COLLECTED: 'pickup:collected',
  ZONE_PROGRESS: 'zone:progress',
  WAVE_STARTED: 'wave:started',
  WAVE_CLEARED: 'wave:cleared',
  BOSS_PHASE: 'boss:phase',
  GAME_STATE: 'game:state',
  MAP_TRANSITION: 'map:transition',
  GOLD_COLLECTED: 'gold:collected',
  WEAPON_DROPPED: 'weapon:dropped',
  UPGRADE_SELECTED: 'upgrade:selected',
});



const HEAT_CONTRACTS = [
  { level: 0, label: 'HEAT 0 · 표준', enemyHpMult: 1.0, goldMult: 1.0, desc: '기본 난이도' },
  { level: 1, label: 'HEAT 1 · 경계', enemyHpMult: 1.25, goldMult: 1.35, desc: '적 HP +25% → 골드 +35%' },
  { level: 2, label: 'HEAT 2 · 격전', enemyHpMult: 1.55, goldMult: 1.75, desc: '적 HP +55% → 골드 +75%' },
  { level: 3, label: 'HEAT 3 · 극한', enemyHpMult: 1.90, goldMult: 2.25, desc: '적 HP +90% → 골드 +125%' },
];

const DAILY_MODIFIERS = [
  { id: 'hyper_mobility', name: '고속 기동전', desc: '이동속도 +28% · 대시 쿨 -28%', speedMult: 1.28, dashCdMult: 0.72 },
  { id: 'deadeye', name: '정밀 사격전', desc: '헤드샷 배율 +0.8x · 적 HP +25%', headshotBonus: 0.8, enemyHpMult: 1.25 },
  { id: 'glass_cannon', name: '초화력 교전', desc: '무기 피해 +35% · 적 HP +35%', dmgMult: 1.35, enemyHpMult: 1.35 },
  { id: 'vanguard_surge', name: '방호 돌파전', desc: '처치 쉴드 +22 · 최대 실드 +35', killShield: 22, shieldBonus: 35 },
];

const ACHIEVEMENTS = [
  { id: 'first_blood', cat: 'combat', catLabel: '전투', reward: 30, name: '첫 교전', desc: '적 1기 이상 격파' },
  { id: 'kills_50', cat: 'combat', catLabel: '전투', reward: 50, name: '전선 청소부', desc: '누적 적 50기 격파' },
  { id: 'kills_200', cat: 'combat', catLabel: '전투', reward: 100, name: '강철 수확자', desc: '누적 적 200기 격파' },
  { id: 'hs_15', cat: 'combat', catLabel: '전투', reward: 60, name: '정밀 사수', desc: '한 판 헤드샷 15회 달성' },
  { id: 'combo_5', cat: 'combat', catLabel: '전투', reward: 50, name: '연쇄 화력', desc: '최대 콤보 x5 달성' },
  { id: 'style_a', cat: 'combat', catLabel: '전투', reward: 40, name: '전술 리듬', desc: '스타일 랭크 A 이상 달성' },
  { id: 'style_s', cat: 'combat', catLabel: '전투', reward: 80, name: '스타일 마스터', desc: '스타일 랭크 S 이상 달성' },
  { id: 'style_sss', cat: 'combat', catLabel: '전투', reward: 150, name: '에이서 폭풍', desc: '스타일 랭크 SSS 달성' },
  { id: 'air_ace', cat: 'mobility', catLabel: '기동', reward: 60, name: '하늘의 지배자', desc: '한 판 공중 처치 5회' },
  { id: 'slide_ace', cat: 'mobility', catLabel: '기동', reward: 60, name: '지면 돌파자', desc: '한 판 슬라이드 처치 5회' },
  { id: 'melee_ace', cat: 'mobility', catLabel: '기동', reward: 60, name: '열선 블레이드', desc: '한 판 근접 처치 5회' },
  { id: 'swap_ace', cat: 'mobility', catLabel: '기동', reward: 60, name: '퀵드로우', desc: '한 판 무기 전환 처치 5회' },
  { id: 'drone_hunter', cat: 'ops', catLabel: '작전', reward: 50, name: '보급 사냥꾼', desc: '황금 보급 드론 격추' },
  { id: 'first_clear', cat: 'ops', catLabel: '작전', reward: 120, name: '지구 수복', desc: '캠페인 웨이브 5 보스 격파' },
  { id: 'heat_clear', cat: 'ops', catLabel: '작전', reward: 150, name: '극한 돌파', desc: 'HEAT 2 이상에서 보스 격파' },
  { id: 'endless_8', cat: 'ops', catLabel: '작전', reward: 120, name: '무한의 생존자', desc: '무한 강하 8웨이브 도달' },
];

function getTodayDailyModifier() {
  const now = new Date();
  const key = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return DAILY_MODIFIERS[key % DAILY_MODIFIERS.length];
}

const PILOT_FRAMES = [
  {
    id: 'vanguard',
    name: 'VANGUARD-09',
    tier: '표준형',
    cost: 0,
    color: '#f59e0b',
    hpBonus: 0,
    shieldBonus: 0,
    dashMax: 2,
    speedMult: 1.0,
    dmgMult: 1.0,
    airBonus: 0.0,
    dashCdMult: 1.0,
    killShield: 0,
    specialName: '균형 기동 체계',
    specialDesc: '안정적인 표준 스펙 (HP 100 / 쉴드 100 / 대시 2회)',
  },
  {
    id: 'strider',
    name: 'STRIDER-04',
    tier: '고기동형',
    cost: 250,
    color: '#38bdf8',
    hpBonus: -10,
    shieldBonus: -5,
    dashMax: 3,
    speedMult: 1.12,
    dmgMult: 1.0,
    airBonus: 0.22,
    dashCdMult: 0.85,
    killShield: 0,
    specialName: '에어 스트라이크',
    specialDesc: '대시 3회 + 이동 +12% · 공중/슬라이드 사격 피해 +22% & 대시 쿨 -15%',
  },
  {
    id: 'bastion',
    name: 'BASTION-12',
    tier: '중장갑형',
    cost: 500,
    color: '#22c55e',
    hpBonus: 55,
    shieldBonus: 45,
    dashMax: 2,
    speedMult: 0.94,
    dmgMult: 1.05,
    airBonus: 0.0,
    dashCdMult: 1.0,
    killShield: 12,
    dashSlam: true,
    specialName: '충격 돌파',
    specialDesc: 'HP +55 / 쉴드 +45 · 대시 시 주변 6.5m 적에게 45 충격 피해+넉백 & 처치 실드 +12',
  },
  {
    id: 'apex',
    name: 'APEX-ZERO',
    tier: '최상위 프로토타입',
    cost: 950,
    color: '#ef4444',
    hpBonus: 35,
    shieldBonus: 35,
    dashMax: 3,
    speedMult: 1.15,
    dmgMult: 1.15,
    airBonus: 0.15,
    dashCdMult: 0.80,
    killShield: 10,
    apexOverdrive: true,
    specialName: '오버드라이브 코어',
    specialDesc: '대시 3회 + 화력 +15% · 처치 시 대시 1회 즉시 충전 + 2.5초 탄약무한·연사 +30%',
  },
];

const PILOT_FRAME_ART = {
  vanguard: "./assets/pilot-vanguard.webp",
  strider: "./assets/pilot-strider.webp",
  bastion: "./assets/pilot-bastion.webp",
  apex: "./assets/pilot-apex.webp",
};

const META_UPGRADES = [
  {
    id: 'firepower',
    name: '화력 코어',
    maxLevel: 10,
    baseCost: 70,
    costStep: 55,
    desc: '모든 무기 기본 피해량 +4% / Lv (최대 +40%)',
    formatBonus: (lv) => `기본 화력 +${lv * 4}%`,
  },
  {
    id: 'hull',
    name: '강화 장갑판',
    maxLevel: 10,
    baseCost: 70,
    costStep: 55,
    desc: '최대 체력 +12 / Lv (최대 +120 HP)',
    formatBonus: (lv) => `최대 체력 +${lv * 12}`,
  },
  {
    id: 'shield',
    name: '쉴드 캐패시터',
    maxLevel: 10,
    baseCost: 70,
    costStep: 55,
    desc: '최대 쉴드 +12 & 재생 속도 +8% / Lv',
    formatBonus: (lv) => `쉴드 +${lv * 12} · 재생 +${lv * 8}%`,
  },
  {
    id: 'thruster',
    name: '전술 추진기',
    maxLevel: 10,
    baseCost: 80,
    costStep: 60,
    desc: '이동 속도 +2.5% & 대시 쿨타임 -4.5% / Lv',
    formatBonus: (lv) => `이속 +${(lv * 2.5).toFixed(1)}% · 쿨 -${(lv * 4.5).toFixed(1)}%`,
  },
  {
    id: 'reload',
    name: '고속 급탄 장치',
    maxLevel: 10,
    baseCost: 75,
    costStep: 55,
    desc: '재장전 속도 +5% & 연사 속도 +2% / Lv',
    formatBonus: (lv) => `재장전 +${lv * 5}% · 연사 +${lv * 2}%`,
  },
  {
    id: 'crit',
    name: '정밀 사격 광학',
    maxLevel: 10,
    baseCost: 85,
    costStep: 60,
    desc: '헤드샷 치명타 배율 +0.08x / Lv (최대 +0.80x)',
    formatBonus: (lv) => `헤드샷 배율 +${(lv * 0.08).toFixed(2)}x`,
  },
  {
    id: 'siphon',
    name: '전투 회복 모듈',
    maxLevel: 10,
    baseCost: 80,
    costStep: 60,
    desc: '적 처치 시 쉴드 추가 회복 +3 / Lv (최대 +30)',
    formatBonus: (lv) => `처치 시 쉴드 +${lv * 3}`,
  },
  {
    id: 'salvage',
    name: '전리품 회수 코어',
    maxLevel: 10,
    baseCost: 65,
    costStep: 50,
    desc: '전투 중 획득 골드 +8% / Lv (최대 +80%)',
    formatBonus: (lv) => `골드 획득 +${lv * 8}%`,
  },
];

const SYNERGIES = Object.freeze({
  assault: {
    id: 'assault',
    name: '화력 공명',
    tagLabel: '화력',
    color: '#f59e0b',
    threshold: 2,
    desc: '헤드샷 시 반경 4m 폭발 충격(+35 피해)',
  },
  mobility: {
    id: 'mobility',
    name: '기동 과부하',
    tagLabel: '기동',
    color: '#22c55e',
    threshold: 2,
    desc: '대시 후 2초간 연사속도 +30% & 탄약 미소모',
  },
  vanguard: {
    id: 'vanguard',
    name: '선봉 요새',
    tagLabel: '방어',
    color: '#38bdf8',
    threshold: 2,
    desc: '쉴드 50% 이상 유지 시 전 무기 피해 +20%',
  },
});

const TACTICAL_CARDS = [
  {
    id: 'tungsten_core',
    tag: 'assault',
    name: '텅스텐 코어 탄두',
    desc: '모든 무기 피해량 +18%',
  },
  {
    id: 'overclock_mag',
    tag: 'assault',
    name: '고속 탄창 급탄',
    desc: '재장전 속도 +30%, 연사속도 +12%',
  },
  {
    id: 'precision_refund',
    tag: 'assault',
    name: '정밀 관통 회수',
    desc: '헤드샷 배율 +0.4x, 적 처치 시 탄창 3발 즉시 환급',
  },
  {
    id: 'thruster_tune',
    tag: 'mobility',
    name: '추진기 튜닝',
    desc: '이동 속도 +12%, 옴니 대시 쿨타임 -25%',
  },
  {
    id: 'slide_reload',
    tag: 'mobility',
    name: '슬라이드 자동 장전',
    desc: '슬라이드 또는 대시 발동 시 현재 탄창 40% 즉시 장전',
  },
  {
    id: 'aerial_gunner',
    tag: 'mobility',
    name: '공중·슬라이드 사격술',
    desc: '공중 또는 슬라이드 중 무기 피해량 +28%',
  },
  {
    id: 'siphon_boost',
    tag: 'vanguard',
    name: '쉴드 사이펀 증폭',
    desc: '최대 쉴드 +25, 처치 시 쉴드 회복량 +15',
  },
  {
    id: 'beacon_resonance',
    tag: 'vanguard',
    name: '테라비콘 공명',
    desc: '거점 구역 내 초당 체력 +7 회복 & 피해량 추가 +20%',
  },
  {
    id: 'reactive_armor',
    tag: 'vanguard',
    name: '반응형 충격 장갑',
    desc: '피격 시 주변 6m 적에게 35 반사 피해 + 넉백',
  },
  {
    id: 'repulsor_slam',
    tag: 'mobility',
    rare: true,
    name: '충격 강하',
    desc: '공중·로켓점프 후 착지 시 반경 7.5m 적에게 55 충격 피해 + 강넉백',
  },
  {
    id: 'mark_contagion',
    tag: 'assault',
    rare: true,
    name: '표식 전이',
    desc: 'T-4 표식 적 처치 시 반경 10m 내 적 2기에게 표식 자동 전이 + 20 피해',
  },
  {
    id: 'thermal_nova',
    tag: 'assault',
    rare: true,
    name: '과열 폭발',
    desc: 'W-01 열기 100% 도달 시 과열 잠금 대신 전방 9m 화염 폭발(75 피해) + 즉시 55% 냉각',
  },
  {
    id: 'slide_overclock',
    tag: 'mobility',
    rare: true,
    name: '슬라이드 폭주',
    desc: '슬라이드 중 사격 시 탄약·열기 미소모 + 확정 치명타(피해 1.6배)',
  },
];

const PLAYER_CONFIG = {
  // Capsule & camera dimensions (meters)
  radius: 0.45,
  standHeight: 1.75,
  crouchHeight: 1.05,
  eyeOffset: 0.15,
  stepHeight: 0.55,

  // Ground & air locomotion (m/s, m/s^2)
  walkSpeed: 7.8,
  sprintSpeed: 11.4,
  adsSpeedMultiplier: 0.62,
  airControl: 0.40,
  groundAccel: 68,
  groundFriction: 11,
  gravity: 26,

  // Jump & forgiveness windows
  jumpVelocity: 10.4,
  doubleJumpVelocity: 9.6,
  coyoteTime: 0.14,
  jumpBufferTime: 0.14,

  // Momentum slide
  slideBoostSpeed: 16.0,
  slideMinSpeed: 5.5,
  slideDuration: 0.72,
  slideFriction: 3.0,
  slideCameraRollDeg: 5.5,

  // 2-charge directional omni-dash
  dashSpeed: 24.5,
  dashDuration: 0.16,
  dashMaxCharges: 2,
  dashCooldown: 2.2,

  // Vitality & aggressive shield-siphon loop
  maxHealth: 100,
  maxShield: 100,
  shieldRegenDelay: 3.0,
  shieldRegenRate: 28,
  killShieldBonus: 25,
  headshotShieldBonus: 15,

  // Dynamic camera FOV (degrees)
  baseFov: 80,
  sprintFovBonus: 4.5,
  slideFovBonus: 8.5,
  dashFovBonus: 12.0,

  // Mobile / tablet aim assist
  touchAimAssistConeDeg: 7.5,
  touchAimAssistStrength: 0.35,

  // Quick thermal pry-blade melee
  meleeRange: 2.8,
  meleeDamage: 65,
  meleeCooldown: 0.55,
};

const QUALITY_PRESETS = {
  low: {
    label: 'LOW',
    dprMax: 0.85,
    bloomEnabled: false,
    bloomStrength: 0.0,
    bloomRadius: 0.0,
    bloomThreshold: 1.0,
    shadowsEnabled: false,
    shadowMapSize: 512,
    maxParticles: 80,
    maxDecals: 24,
    dynamicLights: 1,
    fogDensity: 0.014,
  },
  medium: {
    label: 'MEDIUM',
    dprMax: 1.0,
    bloomEnabled: true,
    bloomStrength: 0.28,
    bloomRadius: 0.30,
    bloomThreshold: 0.85,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    maxParticles: 180,
    maxDecals: 56,
    dynamicLights: 2,
    fogDensity: 0.0125,
  },
  high: {
    label: 'HIGH',
    dprMax: 1.35,
    bloomEnabled: true,
    bloomStrength: 0.36,
    bloomRadius: 0.38,
    bloomThreshold: 0.82,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    maxParticles: 320,
    maxDecals: 96,
    dynamicLights: 2,
    fogDensity: 0.011,
  },
};

const ARENA_CONFIG = {
  name: 'SECTOR-09 // DEAD METROPOLIS',
  size: 64,
  halfSize: 32,
  wallHeight: 11,
  controlZoneRadius: 7.5,
  controlZoneCaptureTime: 22,
  barrelDamage: 165,
  barrelRadius: 8.5,
  barrelRespawnTime: 24,
};

const MAPS = [
  {
    index: 0,
    id: 'dead_metropolis',
    code: 'SEC-09',
    name: 'SECTOR-09 // DEAD METROPOLIS',
    subtitle: 'RUINED OVERPASS & TERRA-BEACON PLAZA',
    waves: [1, 2],
  },
  {
    index: 1,
    id: 'sunken_refinery',
    code: 'SEC-14',
    name: 'SECTOR-14 // SUNKEN REFINERY',
    subtitle: 'SMOG-CHOKED INDUSTRIAL CRUCIBLE',
    waves: [3, 4],
  },
  {
    index: 2,
    id: 'crater_citadel',
    code: 'SEC-00',
    name: 'SECTOR-00 // THE CRATER CITADEL',
    subtitle: 'SHATTERED ORBITAL ELEVATOR — BOSS CRUCIBLE',
    waves: [5],
  },
];

const SCORE_CONFIG = {
  comboTimeout: 4.8,
  maxComboMultiplier: 5,
  headshotBonus: 50,
  zoneCaptureBonus: 1200,
  waveClearBaseBonus: 500,
};
  __exports.EVENTS = EVENTS;
  __exports.PLAYER_CONFIG = PLAYER_CONFIG;
  __exports.QUALITY_PRESETS = QUALITY_PRESETS;
  __exports.ARENA_CONFIG = ARENA_CONFIG;
  __exports.MAPS = MAPS;
  __exports.SCORE_CONFIG = SCORE_CONFIG;
  __exports.META_UPGRADES = META_UPGRADES;
  __exports.SYNERGIES = SYNERGIES;
  __exports.TACTICAL_CARDS = TACTICAL_CARDS;
  __exports.PILOT_FRAMES = PILOT_FRAMES;
  __exports.PILOT_FRAME_ART = PILOT_FRAME_ART;
  __exports.HEAT_CONTRACTS = HEAT_CONTRACTS;
  __exports.DAILY_MODIFIERS = DAILY_MODIFIERS;
  __exports.ACHIEVEMENTS = ACHIEVEMENTS;
  __exports.getTodayDailyModifier = getTodayDailyModifier;
});
