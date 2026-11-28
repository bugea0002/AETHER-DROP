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
  ANNOUNCEMENT: 'hud:announcement',
  GUARD_BLOCKED: 'player:guard_blocked',
  ULTIMATE_USED: 'player:ultimate_used',
  VOID_GATE_SHATTERED: 'world:void_gate_shattered',
  ENEMY_TELEPORT: 'enemy:teleport',
  ENEMY_OVERLOAD: 'enemy:overload',
  BOSS_TURRET_SHATTERED: 'boss:turret_shattered',
  BOSS_WING_CORE_SHATTERED: 'boss:wing_core_shattered',
  BOSS_ORBITAL_SWEEP: 'boss:orbital_sweep',
  BOSS_DRONE_SALVO: 'boss:drone_salvo',
  BOSS_SINGULARITY_PULL: 'boss:singularity_pull',
  BOSS_EMP_PULSE: 'boss:emp_pulse',
  BOSS_HAZARD_FIELD: 'boss:hazard_field',
  BOSS_HOMING_MISSILES: 'boss:homing_missiles',
  DROP_POD_PHASE: 'drop_pod:phase',
  TRANSFER_GATE_OPEN: 'transfer_gate:open',
  TRANSFER_GATE_ENTERED: 'transfer_gate:entered',
});



const HEAT_CONTRACTS = [
  { level: 0, tier: '표준', label: '위협 0 · 표준', enemyHpMult: 1.00, enemyDmgMult: 1.00, goldMult: 1.00, debuffTitle: '', debuffShort: '', debuffDesc: '', desc: '표준 전장 프로토콜 · 추가 제약 없음 · 골드 100%' },
  { level: 1, tier: '경계', label: '위협 1 · 경계', enemyHpMult: 1.10, enemyDmgMult: 1.15, goldMult: 1.30, enemySpeedMult: 1.10, debuffTitle: '적 기동 가속', debuffShort: '적 이속 +10%', debuffDesc: '모든 적 이동 속도 +10%', desc: '적 체력 +10% · 공격력 +15% · [제약] 적 이동 속도 +10% → 골드 +30%' },
  { level: 2, tier: '교전', label: '위협 2 · 교전', enemyHpMult: 1.22, enemyDmgMult: 1.32, goldMult: 1.65, reloadMult: 0.88, debuffTitle: '탄창 지연', debuffShort: '재장전 -12%', debuffDesc: '무기 재장전 속도 -12%', desc: '적 체력 +22% · 공격력 +32% · [제약] 재장전 속도 -12% → 골드 +65%' },
  { level: 3, tier: '격전', label: '위협 3 · 격전', enemyHpMult: 1.35, enemyDmgMult: 1.52, goldMult: 2.05, dashCooldownMult: 1.30, debuffTitle: '추진기 과열', debuffShort: '대시 쿨 +30%', debuffDesc: '옴니 대시 재충전 시간 +30%', desc: '적 체력 +35% · 공격력 +52% · [제약] 대시 쿨다운 +30% → 골드 +105%' },
  { level: 4, tier: '위험', label: '위협 4 · 위험', enemyHpMult: 1.50, enemyDmgMult: 1.75, goldMult: 2.55, eliteChance: 0.40, debuffTitle: '정예 증원', debuffShort: '정예율 40%', debuffDesc: '정예 변이 적 출현 확률 22% → 40%', desc: '적 체력 +50% · 공격력 +75% · [제약] 정예 출현율 40% → 골드 +155%' },
  { level: 5, tier: '극한', label: '위협 5 · 극한', enemyHpMult: 1.65, enemyDmgMult: 2.00, goldMult: 3.15, healEfficiencyMult: 0.75, debuffTitle: '응급 수복 저하', debuffShort: '회복 효율 -25%', debuffDesc: '체력·실드 회복 및 거점 재생 효율 -25%', desc: '적 체력 +65% · 공격력 +100% · [제약] 회복 효율 -25% → 골드 +215%' },
  { level: 6, tier: '붕괴', label: '위협 6 · 붕괴', enemyHpMult: 1.80, enemyDmgMult: 2.28, goldMult: 3.85, guardCostMult: 1.45, debuffTitle: '방어 부하 증대', debuffShort: '가드 소모 +45%', debuffDesc: '[E] 방어 에너지 방어 소모량 +45%', desc: '적 체력 +80% · 공격력 +128% · [제약] [E] 가드 소모 +45% → 골드 +285%' },
  { level: 7, tier: '심연', label: '위협 7 · 심연', enemyHpMult: 1.95, enemyDmgMult: 2.60, goldMult: 4.65, spreadMult: 1.28, debuffTitle: '조준 교란장', debuffShort: '탄퍼짐 +28%', debuffDesc: '모든 무기 사격 분산(탄퍼짐) +28%', desc: '적 체력 +95% · 공격력 +160% · [제약] 탄퍼짐 +28% → 골드 +365%' },
  { level: 8, tier: '재앙', label: '위협 8 · 재앙', enemyHpMult: 2.12, enemyDmgMult: 2.95, goldMult: 5.60, spawnIntervalMult: 0.80, enemySpeedMult: 1.20, debuffTitle: '파상 공세 & 가속', debuffShort: '증원 -20% · 이속 +20%', debuffDesc: '적 증원 간격 -20% 단축 및 적 이동 속도 총 +20%', desc: '적 체력 +112% · 공격력 +195% · [제약] 증원 -20% & 적 이속 +20% → 골드 +460%' },
  { level: 9, tier: '소멸', label: '위협 9 · 소멸', enemyHpMult: 2.30, enemyDmgMult: 3.35, goldMult: 6.70, disableDoubleJump: true, shieldPenalty: 20, debuffTitle: '이단 점프 봉인 & 실드 손실', debuffShort: '2단점프 봉인 · 실드 -20', debuffDesc: '공중 2단 점프 사용 불가 및 최대 실드 -20', desc: '적 체력 +130% · 공격력 +235% · [제약] 2단 점프 봉인·실드 -20 → 골드 +570%' },
  { level: 10, tier: '초월', label: '위협 10 · 초월', enemyHpMult: 2.50, enemyDmgMult: 3.85, goldMult: 8.20, disableSprint: true, disableSlide: true, ultChargeMult: 0.75, dashCap: 1, debuffTitle: '질주·슬라이드 봉인 & 출력 제한', debuffShort: '질주/슬라이드 봉인 · 대시1 · 궁-25%', debuffDesc: '질주(Shift)·슬라이드(C) 봉인, 대시 최대 1회 제한, 궁극기 충전 -25%', desc: '적 체력 +150% · 공격력 +285% · [제약] 질주·슬라이드 봉인·대시1회·궁-25% → 골드 +720%' },
];

/**
 * Aggregate HEAT_CONTRACTS[1..level] cumulative debuffs and action constraints.
 * Higher tiers inherit all lower-tier constraints simultaneously.
 */
function getCumulativeHeatProfile(level) {
  const lv = Math.max(0, Math.min(HEAT_CONTRACTS.length - 1, Math.floor(Number(level) || 0)));
  const cfg = HEAT_CONTRACTS[lv] || HEAT_CONTRACTS[0];
  const prof = {
    level: lv,
    cfg,
    enemySpeedMult: 1.0,
    reloadMult: 1.0,
    dashCooldownMult: 1.0,
    eliteChance: 0.22,
    healEfficiencyMult: 1.0,
    guardCostMult: 1.0,
    spreadMult: 1.0,
    spawnIntervalMult: 1.0,
    shieldPenalty: 0,
    ultChargeMult: 1.0,
    disableDoubleJump: false,
    disableSprint: false,
    disableSlide: false,
    dashCap: null,
    debuffs: [],
  };
  for (let i = 1; i <= lv; i++) {
    const h = HEAT_CONTRACTS[i];
    if (!h) continue;
    if (h.debuffTitle) {
      prof.debuffs.push({
        level: h.level,
        tier: h.tier,
        title: h.debuffTitle,
        short: h.debuffShort,
        desc: h.debuffDesc,
      });
    }
    if (typeof h.enemySpeedMult === 'number') prof.enemySpeedMult = Math.max(prof.enemySpeedMult, h.enemySpeedMult);
    if (typeof h.reloadMult === 'number') prof.reloadMult *= h.reloadMult;
    if (typeof h.dashCooldownMult === 'number') prof.dashCooldownMult *= h.dashCooldownMult;
    if (typeof h.eliteChance === 'number') prof.eliteChance = Math.max(prof.eliteChance, h.eliteChance);
    if (typeof h.healEfficiencyMult === 'number') prof.healEfficiencyMult *= h.healEfficiencyMult;
    if (typeof h.guardCostMult === 'number') prof.guardCostMult *= h.guardCostMult;
    if (typeof h.spreadMult === 'number') prof.spreadMult *= h.spreadMult;
    if (typeof h.spawnIntervalMult === 'number') prof.spawnIntervalMult *= h.spawnIntervalMult;
    if (typeof h.shieldPenalty === 'number') prof.shieldPenalty += h.shieldPenalty;
    if (typeof h.ultChargeMult === 'number') prof.ultChargeMult *= h.ultChargeMult;
    if (h.disableDoubleJump) prof.disableDoubleJump = true;
    if (h.disableSprint) prof.disableSprint = true;
    if (h.disableSlide) prof.disableSlide = true;
    if (typeof h.dashCap === 'number') {
      prof.dashCap = prof.dashCap == null ? h.dashCap : Math.min(prof.dashCap, h.dashCap);
    }
  }
  return prof;
}

const DAILY_MODIFIERS = [
  {
    dayOfWeek: 0,
    dayShort: '일',
    dayName: '일요일',
    id: 'golden_sunday',
    tag: 'GOLDEN RUSH',
    name: '일요 황금 총력전',
    concept: '주말 총력 보급전 — 화력과 생존력을 끌어올려 정예 부대를 돌파하고 200% 골드를 회수합니다.',
    desc: '무기 피해 +25% · 최대 HP/실드 +30 · 골드 200% | 적 체력 +45% · 공격력 +30% · 정예율 38%',
    dmgMult: 1.25,
    hpBonus: 30,
    shieldBonus: 30,
    enemyHpMult: 1.45,
    enemyDmgMult: 1.30,
    eliteChance: 0.38,
    goldMult: 2.00,
  },
  {
    dayOfWeek: 1,
    dayShort: '월',
    dayName: '월요일',
    id: 'blitz_monday',
    tag: 'BLITZKRIEG',
    name: '월요 기동 돌격전',
    concept: '초고속 기동 돌파 — 극대화된 이동·대시·재장전 속도로 가속화된 적군과 추격전을 펼칩니다.',
    desc: '이동 속도 +30% · 대시 쿨 -35% · 재장전 +20% · 골드 130% | 적 이동 속도 +15%',
    speedMult: 1.30,
    dashCdMult: 0.65,
    reloadMult: 1.20,
    enemySpeedMult: 1.15,
    goldMult: 1.30,
  },
  {
    dayOfWeek: 2,
    dayShort: '화',
    dayName: '화요일',
    id: 'overdrive_tuesday',
    tag: 'GLASS CANNON',
    name: '화요 화력 과부하',
    concept: '고위험 유리 대포 — 실드 용량을 희생하는 대신 압도적 화력과 연사 속도로 전선을 분쇄합니다.',
    desc: '무기 피해 +45% · 연사력 +15% · 골드 140% | 최대 실드 -25 · 적 공격력 +35%',
    dmgMult: 1.45,
    fireRateMult: 1.15,
    shieldPenalty: 25,
    enemyDmgMult: 1.35,
    goldMult: 1.40,
  },
  {
    dayOfWeek: 3,
    dayShort: '수',
    dayName: '수요일',
    id: 'weakpoint_wednesday',
    tag: 'DEADEYE',
    name: '수요 정밀 약점 사격',
    concept: '외과수술 정밀 사격 — 높은 탄착 안정성과 치명적 약점 헤드샷 배율로 단단한 적을 관통합니다.',
    desc: '헤드샷 배율 +1.35x · 탄퍼짐 -35% · 골드 135% | 적 체력 +35%',
    headshotBonus: 1.35,
    spreadMult: 0.65,
    enemyHpMult: 1.35,
    goldMult: 1.35,
  },
  {
    dayOfWeek: 4,
    dayShort: '목',
    dayName: '목요일',
    id: 'siphon_thursday',
    tag: 'BLOOD SIPHON',
    name: '목요 흡혈 강행군',
    concept: '끊이지 않는 교전과 흡수 — 몰아치는 증원을 격파하며 처치 실드와 회복량으로 전장을 버텨냅니다.',
    desc: '처치 실드 +25 · 드랍 회복 +40% · 골드 135% | 적 증원 주기 -18% · 적 체력 +20%',
    killShield: 25,
    dropHealMult: 1.40,
    spawnIntervalMult: 0.82,
    enemyHpMult: 1.20,
    goldMult: 1.35,
  },
  {
    dayOfWeek: 5,
    dayShort: '금',
    dayName: '금요일',
    id: 'ult_friday',
    tag: 'CORE SURGE',
    name: '금요 코어 과충전',
    concept: '초능력 & 방패 회전율 극대화 — 급속 충전되는 궁극기와 견고한 가드로 정예 부대에 맞섭니다.',
    desc: '궁극기 충전 +85% · 가드 소모 -35% · 골드 145% | 정예 출현율 42% · 적 체력 +25%',
    ultChargeMult: 1.85,
    guardCostMult: 0.65,
    eliteChance: 0.42,
    enemyHpMult: 1.25,
    goldMult: 1.45,
  },
  {
    dayOfWeek: 6,
    dayShort: '토',
    dayName: '토요일',
    id: 'zerog_saturday',
    tag: 'ORBITAL ZERO-G',
    name: '토요 궤도 공중전',
    concept: '입체 기동 공중 화력전 — 추가 대시 횟수와 공중 피해 증폭으로 지면 위 위협을 제압합니다.',
    desc: '공중 피해 +55% · 대시 +1회 · 이속 +15% · 골드 145% | 적 체력 +30% · 공격력 +20%',
    airBonus: 0.55,
    dashBonus: 1,
    speedMult: 1.15,
    enemyHpMult: 1.30,
    enemyDmgMult: 1.20,
    goldMult: 1.45,
  },
];

const ACHIEVEMENTS = [
  { id: 'first_blood', cat: 'combat', catLabel: '전투', reward: 100, name: '첫 교전', desc: '적 1기 이상 격파' },
  { id: 'kills_50', cat: 'combat', catLabel: '전투', reward: 180, name: '전선 청소부', desc: '누적 적 50기 격파' },
  { id: 'kills_200', cat: 'combat', catLabel: '전투', reward: 350, name: '강철 수확자', desc: '누적 적 200기 격파' },
  { id: 'hs_15', cat: 'combat', catLabel: '전투', reward: 220, name: '정밀 사수', desc: '한 판 헤드샷 15회 달성' },
  { id: 'combo_5', cat: 'combat', catLabel: '전투', reward: 160, name: '연쇄 화력', desc: '최대 콤보 x5 달성' },
  { id: 'style_a', cat: 'combat', catLabel: '전투', reward: 150, name: '전술 리듬', desc: '스타일 랭크 A 이상 달성' },
  { id: 'style_s', cat: 'combat', catLabel: '전투', reward: 260, name: '스타일 마스터', desc: '스타일 랭크 S 이상 달성' },
  { id: 'style_sss', cat: 'combat', catLabel: '전투', reward: 450, name: '에이서 폭풍', desc: '스타일 랭크 SSS 달성' },
  { id: 'air_ace', cat: 'mobility', catLabel: '기동', reward: 200, name: '하늘의 지배자', desc: '한 판 공중 처치 5회' },
  { id: 'slide_ace', cat: 'mobility', catLabel: '기동', reward: 200, name: '지면 돌파자', desc: '한 판 슬라이드 처치 5회' },
  { id: 'melee_ace', cat: 'mobility', catLabel: '기동', reward: 220, name: '열선 블레이드', desc: '한 판 근접 처치 5회' },
  { id: 'swap_ace', cat: 'mobility', catLabel: '기동', reward: 200, name: '퀵드로우', desc: '한 판 무기 전환 처치 5회' },
  { id: 'drone_hunter', cat: 'ops', catLabel: '작전', reward: 160, name: '보급 사냥꾼', desc: '황금 보급 드론 격추' },
  { id: 'emp_tactician', cat: 'ops', catLabel: '작전', reward: 220, name: '전자전 전문가', desc: 'EMP 파일런 또는 쉴드 중계기 파괴' },
  { id: 'elite_slayer', cat: 'combat', catLabel: '전투', reward: 280, name: '전선 분쇄자', desc: '한 판에 이지스 정예병 10기 격파' },
  { id: 'first_clear', cat: 'ops', catLabel: '작전', reward: 320, name: '지구 수복', desc: '캠페인 웨이브 5 보스 COLOSSUS-IV 격파' },
  { id: 'citadel_clear', cat: 'ops', catLabel: '작전', reward: 550, name: '이지스 성채 탈환', desc: '캠페인 웨이브 10 보스 AEGIS-IX 격파' },
  { id: 'abyss_gatebreaker', cat: 'ops', catLabel: '작전', reward: 320, name: '차원 게이트 파괴자', desc: '심연 차원 게이트 3회 파괴' },
  { id: 'abyss_clear', cat: 'ops', catLabel: '작전', reward: 900, name: '심연의 정복자', desc: '캠페인 웨이브 15 최종 보스 TRANSCENDENT-OMEGA 격파' },
  { id: 'heat_clear', cat: 'ops', catLabel: '작전', reward: 450, name: '열기 돌파', desc: '위협 단계 2 이상에서 작전 클리어' },
  { id: 'heat_5', cat: 'ops', catLabel: '작전', reward: 800, name: '극한 제압자', desc: '위협 단계 5 이상에서 작전 클리어' },
  { id: 'heat_10', cat: 'ops', catLabel: '작전', reward: 1800, name: '초월의 지배자', desc: '위협 단계 10 초월 난이도 작전 클리어' },
  { id: 'endless_8', cat: 'ops', catLabel: '작전', reward: 300, name: '무한의 생존자', desc: '무한 강하 8웨이브 도달' },
  { id: 'endless_12', cat: 'ops', catLabel: '작전', reward: 500, name: '궤도의 전설', desc: '무한 강하 12웨이브 도달' },
  { id: 'endless_15', cat: 'ops', catLabel: '작전', reward: 750, name: '심연의 생존자', desc: '무한 강하 15웨이브 도달' },
];

function getDailyModifierForDay(dayIndex) {
  const safeDay = ((Math.floor(Number(dayIndex) || 0) % 7) + 7) % 7;
  return DAILY_MODIFIERS.find((d) => d.dayOfWeek === safeDay) || DAILY_MODIFIERS[safeDay] || DAILY_MODIFIERS[0];
}

function getTodayDailyModifier(dateObj = new Date()) {
  const d = dateObj instanceof Date ? dateObj : new Date();
  return getDailyModifierForDay(d.getDay());
}

const PILOT_FRAMES = [
  {
    id: 'vanguard',
    name: 'VANGUARD-09',
    tier: '표준 전술형',
    cost: 0,
    color: '#f59e0b',
    visorColor: 'rgba(245, 158, 11, 0.24)',
    baseFov: 80,
    hpBonus: 0,
    shieldBonus: 0,
    dashMax: 2,
    speedMult: 1.0,
    dmgMult: 1.0,
    airBonus: 0.0,
    dashCdMult: 1.0,
    killShield: 0,
    tacticalReload: true,
    guardMax: 100,
    guardCostMult: 1.0,
    defaultPrimaryIndex: 0,
    defaultSecondaryIndex: 4,
    defaultLoadoutLabel: 'M41-A 펄스 라이플 + W-01 용접 피스톨',
    specialName: '전술 리로드 집중',
    specialDesc: '표준 속도(1.0x) · 재장전 완료 시 2.5초간 연사속도 +25% & 반동 -35%',
    ultName: '궤도 포격',
    ultDesc: '[X] 전방 적들에게 5발의 연쇄 궤도 폭격 투하 (각 180 광역 피해)',
  },
  {
    id: 'strider',
    name: 'STRIDER-04',
    tier: '초고속 기동형',
    cost: 1200,
    color: '#38bdf8',
    visorColor: 'rgba(56, 189, 248, 0.30)',
    baseFov: 88,
    hpBonus: -15,
    shieldBonus: -10,
    dashMax: 3,
    speedMult: 1.35,
    dmgMult: 1.0,
    airBonus: 0.40,
    dashCdMult: 0.70,
    killShield: 0,
    phaseBlink: true,
    lowGravity: true,
    guardMax: 85,
    guardCostMult: 1.05,
    defaultPrimaryIndex: 3,
    defaultSecondaryIndex: 6,
    defaultLoadoutLabel: 'K-9 스크래퍼 PDW + K-0 충격 리펄서',
    specialName: '위상 도약 & 공중 사격',
    specialDesc: '초고속 기동(1.35배) · 대시 시 0.35초 위상 무적 + 공중 중력 -25% & 공중/슬라이드 피해 +40%',
    ultName: '시간 감속 과부하',
    ultDesc: '[X] 6초간 적 시간 60% 감속 + 초고속 연사·무한 탄창',
  },
  {
    id: 'bastion',
    name: 'BASTION-12',
    tier: '초중장갑 요새형',
    cost: 2400,
    color: '#22c55e',
    visorColor: 'rgba(34, 197, 94, 0.32)',
    baseFov: 74,
    hpBonus: 90,
    shieldBonus: 80,
    dashMax: 2,
    speedMult: 0.76,
    dmgMult: 1.08,
    airBonus: 0.0,
    dashCdMult: 1.05,
    killShield: 0,
    dashSlam: true,
    guardMax: 200,
    guardCostMult: 0.50,
    defaultPrimaryIndex: 1,
    defaultSecondaryIndex: 4,
    defaultLoadoutLabel: 'BR-12 브리처 샷건 + W-01 용접 피스톨',
    specialName: '지진 돌파 & 철벽 방패',
    specialDesc: '중장갑(0.76배) · 체력 +90/쉴드 +80 · 대시 시 7.5m 지진 강타(65피해) & [E] 방패 용량 2배·소모 절반',
    ultName: '절대 방벽 돔',
    ultDesc: '[X] 7초간 완전 무적 에너지 돔 전개 + 주변 12m 지속 전기 충격 + 방패 즉시 완충',
  },
  {
    id: 'apex',
    name: 'APEX-ZERO',
    tier: '최상위 프로토타입',
    cost: 4800,
    color: '#ef4444',
    visorColor: 'rgba(239, 68, 68, 0.32)',
    baseFov: 84,
    hpBonus: 40,
    shieldBonus: 40,
    dashMax: 3,
    speedMult: 1.24,
    dmgMult: 1.18,
    airBonus: 0.20,
    dashCdMult: 0.78,
    killShield: 0,
    apexOverdrive: true,
    chainLightning: true,
    guardMax: 130,
    guardCostMult: 0.80,
    defaultPrimaryIndex: 2,
    defaultSecondaryIndex: 5,
    defaultLoadoutLabel: 'HV-7 레일 랜스 + T-4 아크 리벳건',
    specialName: '폭주 가속 & 연쇄 번개',
    specialDesc: '고속 기동(1.24배) · 화력 +18% · 처치 시 대시 충전+3초 폭주 & 헤드샷 시 7m 연쇄 아크 번개(50피해)',
    ultName: '초신성 대폭발',
    ultDesc: '[X] 반경 28m 초신성 플라즈마 폭발(260 피해 + 3초 기절) & 5초간 화력 1.6배 폭주',
  },
];

const PILOT_FRAME_ART = {
  vanguard: "./assets/pilot-vanguard.webp",
  strider: "./assets/pilot-strider.webp",
  bastion: "./assets/pilot-bastion.webp",
  apex: "./assets/pilot-apex.webp",
};

const PILOT_FRAME_OUTCOME_ART = {
  vanguard: {
    victory: "./assets/pilot-vanguard-victory.webp",
    defeat: "./assets/pilot-vanguard-defeat.webp",
  },
  strider: {
    victory: "./assets/pilot-strider-victory.webp",
    defeat: "./assets/pilot-strider-defeat.webp",
  },
  bastion: {
    victory: "./assets/pilot-bastion-victory.webp",
    defeat: "./assets/pilot-bastion-defeat.webp",
  },
  apex: {
    victory: "./assets/pilot-apex-victory.webp",
    defeat: "./assets/pilot-apex-defeat.webp",
  },
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
    tier4Threshold: 4,
    desc: '2장: 헤드샷 시 4m 폭발(+35) · 4장: 전 무기 피해 +25% & 폭발 반경 7m',
  },
  mobility: {
    id: 'mobility',
    name: '기동 과부하',
    tagLabel: '기동',
    color: '#22c55e',
    threshold: 2,
    tier4Threshold: 4,
    desc: '2장: 대시 후 2초 탄약무한·연사 +30% · 4장: 이속 +18% & 대시 쿨 -30%',
  },
  vanguard: {
    id: 'vanguard',
    name: '철벽 방벽',
    tagLabel: '방어',
    color: '#38bdf8',
    threshold: 2,
    tier4Threshold: 4,
    desc: '2장: [E] 방패 내구도 +40% & 충전 +30% · 4장: 방패 파괴 시 10m 충격파(110 피해)',
  },
  tactical: {
    id: 'tactical',
    name: '전술 과충전',
    tagLabel: '전술',
    color: '#c084fc',
    threshold: 2,
    tier4Threshold: 4,
    desc: '2장: 궁극기 충전 +30% & 드랍 회복 +25% · 4장: 궁극기 발동 시 방패 완충 + 4초 화력 +35%',
  },
});

const CROSS_SYNERGIES = Object.freeze([
  {
    id: 'hyper_barrage',
    name: '초음속 탄막',
    requires: ['assault', 'mobility'],
    desc: '[화력2 + 기동2] 대시 후 2.5초간 사격 피해 1.35배 증폭',
  },
  {
    id: 'aegis_converter',
    name: '절대 방벽 변환',
    requires: ['vanguard', 'tactical'],
    desc: '[방어2 + 전술2] 방패 소모 -25% & 방패로 막을 때마다 궁극기 +4% 충전',
  },
]);

const TACTICAL_CARDS = [
  // === ASSAULT (화력 6장) ===
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
    id: 'armor_piercer',
    tag: 'assault',
    name: '아머 피어서',
    desc: '모든 무기 피해 +14%, 헤드샷 배율 +0.35x, 방패·보스 대상 추가 피해 +22%',
  },
  {
    id: 'mark_contagion',
    tag: 'assault',
    rare: true,
    name: '표식 전이',
    desc: '표식/헤드샷 적 처치 시 반경 10m 내 적 2기에게 표식 전이 + 25 피해',
  },
  {
    id: 'thermal_nova',
    tag: 'assault',
    rare: true,
    name: '과열 폭발',
    desc: 'W-01 과열 도달 또는 재장전 완료 시 전방 9m 화염 폭발(75 피해)',
  },
  {
    id: 'void_breaker',
    tag: 'assault',
    name: '차원 파쇄 탄두',
    desc: '방패·차원 게이트·부유 포탑·보스 대상 추가 피해 +24%',
  },

  // === MOBILITY (기동 6장) ===
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
    id: 'kinetic_momentum',
    tag: 'mobility',
    name: '운동 에너지 순환',
    desc: '이동 속도 +12%, 대시 쿨타임 -18%, 적 처치 시 탄창 3발 회수 & 방패 에너지 +10',
  },
  {
    id: 'repulsor_slam',
    tag: 'mobility',
    rare: true,
    name: '충격 강하',
    desc: '공중·로켓점프 후 착지 시 반경 7.5m 적에게 60 충격 피해 + 강넉백',
  },
  {
    id: 'slide_overclock',
    tag: 'mobility',
    rare: true,
    name: '슬라이드 폭주',
    desc: '슬라이드 중 사격 시 탄약·열기 미소모 + 확정 치명타(피해 1.6배)',
  },
  {
    id: 'gravity_thruster',
    tag: 'mobility',
    name: '반중력 부스터',
    desc: '공중 제어력 +30%, 저중력 구역 가속 +20%, 대시 쿨타임 -12%',
  },

  // === VANGUARD (방어 6장 — 전방 방패 & 드랍 생존 특화!) ===
  {
    id: 'siphon_boost',
    tag: 'vanguard',
    name: '강화 방패 셀',
    desc: '최대 쉴드 +25, [E] 전방 방패 최대 내구도 +40 & 방패 충전 속도 +30%',
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
    desc: '피격 시 주변 6m 적에게 40 반사 피해 + 넉백',
  },
  {
    id: 'aegis_capacitor',
    tag: 'vanguard',
    name: '이지스 캐패시터',
    desc: '최대 체력 +35, 최대 쉴드 +35, [E] 방패 피격 소모량 -22%',
  },
  {
    id: 'shield_counter',
    tag: 'vanguard',
    rare: true,
    name: '방패 역충격',
    desc: '[E] 방패로 탄환을 막을 때 전방 9m 충격파 반사(45 피해) & 방패 최대치 +35',
  },
  {
    id: 'field_medic',
    tag: 'vanguard',
    name: '야전 보급 효율',
    desc: '바닥 회복/쉴드 드랍 아이템 회복량 +55% & [E] 방패 충전 속도 +35%',
  },

  // === TACTICAL (전술 6장 — 궁극기 · 자동 업그레이드 · 드랍 특화!) ===
  {
    id: 'ult_accelerator',
    tag: 'tactical',
    name: '궁극기 가속 코어',
    desc: '[X] 궁극기 게이지 충전 속도 +40%',
  },
  {
    id: 'auto_forge',
    tag: 'tactical',
    name: '자동 병기 제련',
    desc: '무기 자동 업그레이드(MK)당 추가 피해 +12% & 재장전 속도 +18%',
  },
  {
    id: 'scavenger_protocol',
    tag: 'tactical',
    name: '전리품 탐색기',
    desc: '획득 골드 +30% & 바닥 아이템 회복량 +25% & 궁극기 충전 +15%',
  },
  {
    id: 'orbital_overload',
    tag: 'tactical',
    rare: true,
    name: '궤도 과부하',
    desc: '연사 속도 +16%, 헤드샷 처치 시 주변 7.5m 적에게 65 아크 충격파 연쇄 피해',
  },
  {
    id: 'ult_overdrive',
    tag: 'tactical',
    rare: true,
    name: '초임계 궁극기',
    desc: '[X] 궁극기 피해량 +45% & 궁극기 지속시간 +2초',
  },
  {
    id: 'shield_to_ult',
    tag: 'tactical',
    rare: true,
    name: '에너지 변환 장치',
    desc: '[E] 방패로 막은 피해의 60%를 [X] 궁극기 게이지로 즉시 전환',
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

  // 2-charge directional omni-dash (2.5x reach: 39.2 * 0.25 = 9.8m)
  dashSpeed: 39.2,
  dashDuration: 0.25,
  dashMaxCharges: 2,
  dashCooldown: 2.2,

  // Vitality & aggressive shield-siphon loop
  maxHealth: 100,
  maxShield: 100,
  shieldRegenDelay: 3.0,
  shieldRegenRate: 0,
  killShieldBonus: 0,
  headshotShieldBonus: 0,

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
    label: '낮음',
    renderScale: 0.65,
    dprMax: 0.72,
    bloomEnabled: false,
    bloomStrength: 0.0,
    bloomRadius: 0.0,
    bloomThreshold: 1.0,
    shadowsEnabled: false,
    shadowMapSize: 512,
    shadowType: 'pcf',
    maxParticles: 60,
    maxDecals: 12,
    dynamicLights: 0,
    fogDensity: 0.0155,
    envIntensity: 0.35,
    vmEnvIntensity: 0.55,
    exposure: 1.02,
  },
  medium: {
    label: '보통',
    renderScale: 1.0,
    dprMax: 1.0,
    bloomEnabled: true,
    bloomStrength: 0.24,
    bloomRadius: 0.24,
    bloomThreshold: 0.88,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowType: 'pcf',
    maxParticles: 180,
    maxDecals: 56,
    dynamicLights: 2,
    fogDensity: 0.0125,
    envIntensity: 0.85,
    vmEnvIntensity: 1.10,
    exposure: 1.12,
  },
  high: {
    label: '높음',
    renderScale: 1.35,
    dprMax: 2.0,
    bloomEnabled: true,
    bloomStrength: 0.56,
    bloomRadius: 0.48,
    bloomThreshold: 0.72,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowType: 'pcfSoft',
    maxParticles: 420,
    maxDecals: 120,
    dynamicLights: 4,
    fogDensity: 0.0088,
    envIntensity: 1.38,
    vmEnvIntensity: 1.48,
    exposure: 1.24,
  },
};

const ARENA_CONFIG = {
  name: '제09구역 · 폐허 메트로폴리스',
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
    code: '제09구역',
    name: '제09구역 · 폐허 메트로폴리스',
    subtitle: '붕괴된 고가도로 및 테라비콘 광장',
    waves: [1, 2],
  },
  {
    index: 1,
    id: 'sunken_refinery',
    code: '제14구역',
    name: '제14구역 · 가라앉은 정유소',
    subtitle: '매연이 가득한 산업 용광로 구역',
    waves: [3, 4],
  },
  {
    index: 2,
    id: 'crater_citadel',
    code: '제00구역',
    name: '제00구역 · 분화구 요새',
    subtitle: '파괴된 궤도 승강기 — 보스 결전 구역',
    waves: [5],
  },
  {
    index: 3,
    id: 'aegis_flight_deck',
    code: '제61구역',
    name: '제61구역 · 이지스 비행갑판',
    subtitle: '궤도 격납고 및 공중 통로',
    waves: [6, 7],
  },
  {
    index: 4,
    id: 'aegis_reactor_bay',
    code: '제74구역',
    name: '제74구역 · 이지스 원자로실',
    subtitle: '추진 노심 및 방열 냉각 구역',
    waves: [8, 9],
  },
  {
    index: 5,
    id: 'aegis_drydock',
    code: '제99구역',
    name: '제99구역 · 이지스 건조 도크',
    subtitle: '궤도 사령부 및 기함 선체 — 2막 보스 구역',
    waves: [10],
  },
  {
    index: 6,
    id: 'tactical_tutorial',
    code: '훈련장',
    name: '제01구역 · 전술 훈련장',
    subtitle: '궤도 사격 훈련 및 기동 시험장',
    waves: [],
  },
  {
    index: 7,
    id: 'abyss_conduit_ring',
    code: '제108구역',
    name: '제108구역 · 심연 도관 링',
    subtitle: '저중력 궤도 도관 및 차원 균열',
    waves: [11, 12, 13],
  },
  {
    index: 8,
    id: 'transcendent_sanctum',
    code: '제120구역',
    name: '제120구역 · 초월 심연 성소',
    subtitle: '궤도 특이점 노심 — 최종 결전 구역',
    waves: [14, 15],
  },
];

const PLAYER_TITLES = [
  { id: 'rookie_dropper', label: '신병 강하병', color: '#cbd5e1', tier: 'standard', icon: 'chevron', desc: '기본 파일럿 지급 칭호' },
  { id: 'master_pulse', label: '펄스 마스터', color: '#f59e0b', tier: 'mastery', icon: 'pulse', desc: 'M41-A 펄스 라이플 60킬 & 헤드샷 12회 달성' },
  { id: 'master_scatter', label: '근접 분쇄자', color: '#ea580c', tier: 'mastery', icon: 'scatter', desc: 'BR-12 브리처 샷건 60킬 & 헤드샷 12회 달성' },
  { id: 'master_rail', label: '궤도 저격수', color: '#fbbf24', tier: 'mastery', icon: 'rail', desc: 'HV-7 레일 랜스 60킬 & 헤드샷 12회 달성' },
  { id: 'master_smg', label: '고속 사신', color: '#d4a359', tier: 'mastery', icon: 'smg', desc: 'K-9 스크래퍼 PDW 60킬 & 헤드샷 12회 달성' },
  { id: 'master_weld', label: '고열 공병', color: '#f97316', tier: 'mastery', icon: 'weld', desc: 'W-01 용접 피스톨 60킬 & 헤드샷 12회 달성' },
  { id: 'master_arc', label: '아크 헌터', color: '#38bdf8', tier: 'mastery', icon: 'arc', desc: 'T-4 아크 리벳건 60킬 & 헤드샷 12회 달성' },
  { id: 'master_repulsor', label: '충격의 파도', color: '#22c55e', tier: 'mastery', icon: 'repulsor', desc: 'K-0 충격 리펄서 60킬 & 헤드샷 12회 달성' },
  { id: 'heat_3_conq', label: '철혈 정복자', color: '#fb923c', tier: 'heat', icon: 'heat3', desc: '위협 단계 3 최초 정복 보상' },
  { id: 'heat_5_conq', label: '극한 돌파자', color: '#38bdf8', tier: 'heat', icon: 'heat5', desc: '위협 단계 5 최초 정복 보상' },
  { id: 'heat_7_conq', label: '심연 감시자', color: '#f43f5e', tier: 'heat', icon: 'heat7', desc: '위협 단계 7 최초 정복 보상' },
  { id: 'heat_10_conq', label: '초월의 군주', color: '#fde047', tier: 'legend', icon: 'heat10', desc: '위협 단계 10 초월 최초 정복 보상' },
  { id: 'streak_3', label: '꾸준한 파일럿', color: '#4ade80', tier: 'streak', icon: 'streak3', desc: '연속 출석 3일 달성' },
  { id: 'streak_7', label: '궤도 개근 영웅', color: '#c084fc', tier: 'streak', icon: 'streak7', desc: '연속 출석 7일 달성' },
  { id: 'endless_survivor', label: '무한의 전설', color: '#facc15', tier: 'legend', icon: 'endless', desc: '무한 강하 12웨이브 도달' },
];

const FRAME_SKINS = [
  {
    id: 'standard',
    name: '표준 제식 코팅',
    tier: '기본',
    desc: '기체 고유 기본 장갑 도색 및 방패 파형',
    armorHex: null,
    accentHex: null,
    glowHex: null,
    shieldHex: null,
    previewBg: 'linear-gradient(135deg, #334155, #1e293b)',
    unlockDesc: '기본 지급',
  },
  {
    id: 'ember_forge',
    name: '화염 단조 장갑',
    tier: 'HEAT 3 정복',
    desc: '검은 흑철 장갑과 작열하는 호박색 에너지 방패 코팅',
    armorHex: 0x26211d,
    accentHex: 0xc2410c,
    glowHex: 0xf97316,
    shieldHex: 0xf97316,
    previewBg: 'linear-gradient(135deg, #431407, #ea580c)',
    unlockDesc: '위협 단계 3 최초 클리어',
  },
  {
    id: 'cryo_titanium',
    name: '크라이오 티타늄',
    tier: 'HEAT 5 정복',
    desc: '극저온 백은 티타늄 장갑과 빙하 시안 방패 코팅',
    armorHex: 0xdbeafe,
    accentHex: 0x0284c7,
    glowHex: 0x22d3ee,
    shieldHex: 0x22d3ee,
    previewBg: 'linear-gradient(135deg, #082f49, #22d3ee)',
    unlockDesc: '위협 단계 5 최초 클리어',
  },
  {
    id: 'void_crimson',
    name: '심연 크림슨',
    tier: 'HEAT 7 정복',
    desc: '심연 흑요석 장갑과 진홍빛 특이점 방패 코팅',
    armorHex: 0x1a1025,
    accentHex: 0xbe123c,
    glowHex: 0xf43f5e,
    shieldHex: 0xf43f5e,
    previewBg: 'linear-gradient(135deg, #3b0764, #e11d48)',
    unlockDesc: '위협 단계 7 최초 클리어',
  },
  {
    id: 'omega_gold',
    name: '오메가 골드 에디션',
    tier: 'HEAT 10 정복',
    desc: '황금빛 크라운 티타늄과 눈부신 태양 방패 코팅',
    armorHex: 0xfef3c7,
    accentHex: 0xd97706,
    glowHex: 0xfacc15,
    shieldHex: 0xfde047,
    previewBg: 'linear-gradient(135deg, #451a03, #facc15)',
    unlockDesc: '위협 단계 10 초월 클리어',
  },
];

const HEAT_MILESTONE_REWARDS = [
  {
    heat: 3,
    gold: 600,
    titleId: 'heat_3_conq',
    frameSkinId: 'ember_forge',
    label: '위협 3 최초 정복',
    summary: '600 G + 칭호 [철혈 정복자] + 기체 스킨 [화염 단조 장갑]',
  },
  {
    heat: 5,
    gold: 1200,
    titleId: 'heat_5_conq',
    frameSkinId: 'cryo_titanium',
    label: '위협 5 최초 정복',
    summary: '1,200 G + 칭호 [극한 돌파자] + 기체 스킨 [크라이오 티타늄]',
  },
  {
    heat: 7,
    gold: 2200,
    titleId: 'heat_7_conq',
    frameSkinId: 'void_crimson',
    label: '위협 7 최초 정복',
    summary: '2,200 G + 칭호 [심연 감시자] + 기체 스킨 [심연 크림슨]',
  },
  {
    heat: 10,
    gold: 4500,
    titleId: 'heat_10_conq',
    frameSkinId: 'omega_gold',
    label: '위협 10 초월 정복',
    summary: '4,500 G + 칭호 [초월의 군주] + 기체 스킨 [오메가 골드 에디션]',
  },
];

const DAILY_QUEST_TEMPLATES = [
  { id: 'dq_kills', stat: 'kills', target: 45, reward: 160, name: '적 병력 소탕', desc: '적 45기 격파하기' },
  { id: 'dq_headshots', stat: 'headshots', target: 12, reward: 180, name: '정밀 약점 사격', desc: '헤드샷 12회 달성하기' },
  { id: 'dq_waves', stat: 'waves', target: 5, reward: 170, name: '전선 돌파', desc: '웨이브 5회 클리어하기' },
  { id: 'dq_melee', stat: 'meleeKills', target: 6, reward: 150, name: '열선 블레이드 일격', desc: '[V] 근접 공격으로 적 6기 처치하기' },
  { id: 'dq_mobility', stat: 'mobilityKills', target: 8, reward: 175, name: '기동 사격전', desc: '공중 또는 슬라이드 중 적 8기 처치하기' },
  { id: 'dq_guard', stat: 'guardBlocks', target: 10, reward: 165, name: '철벽 방어', desc: '[E] 전방 방패로 공격 10회 막기' },
  { id: 'dq_boss', stat: 'bossKills', target: 1, reward: 240, name: '거대 병기 토벌', desc: '구역 보스 1기 이상 격파하기' },
];

const STREAK_REWARDS = [
  { day: 1, gold: 100, label: '1일차' },
  { day: 2, gold: 130, label: '2일차' },
  { day: 3, gold: 170, titleId: 'streak_3', label: '3일차 (+칭호)' },
  { day: 4, gold: 200, label: '4일차' },
  { day: 5, gold: 240, label: '5일차' },
  { day: 6, gold: 280, label: '6일차' },
  { day: 7, gold: 400, titleId: 'streak_7', label: '7일차 (+칭호)' },
];

function getTodayDateKey(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDailyQuestsForDate(dateKey = getTodayDateKey()) {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const pool = DAILY_QUEST_TEMPLATES.slice();
  const chosen = [];
  for (let k = 0; k < 3 && pool.length > 0; k++) {
    const idx = (hash + k * 5) % pool.length;
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen;
}

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
  __exports.CROSS_SYNERGIES = CROSS_SYNERGIES;
  __exports.TACTICAL_CARDS = TACTICAL_CARDS;
  __exports.PILOT_FRAMES = PILOT_FRAMES;
  __exports.PILOT_FRAME_ART = PILOT_FRAME_ART;
  __exports.PILOT_FRAME_OUTCOME_ART = PILOT_FRAME_OUTCOME_ART;
  __exports.HEAT_CONTRACTS = HEAT_CONTRACTS;
  __exports.getCumulativeHeatProfile = getCumulativeHeatProfile;
  __exports.DAILY_MODIFIERS = DAILY_MODIFIERS;
  __exports.ACHIEVEMENTS = ACHIEVEMENTS;
  __exports.PLAYER_TITLES = PLAYER_TITLES;
  __exports.FRAME_SKINS = FRAME_SKINS;
  __exports.HEAT_MILESTONE_REWARDS = HEAT_MILESTONE_REWARDS;
  __exports.DAILY_QUEST_TEMPLATES = DAILY_QUEST_TEMPLATES;
  __exports.STREAK_REWARDS = STREAK_REWARDS;
  __exports.getTodayDailyModifier = getTodayDailyModifier;
  __exports.getDailyModifierForDay = getDailyModifierForDay;
  __exports.getTodayDateKey = getTodayDateKey;
  __exports.getDailyQuestsForDate = getDailyQuestsForDate;
});
