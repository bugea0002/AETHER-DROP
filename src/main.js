// Module: src/main.js
__define("src/main.js", (__exports, __require) => {
const {
  EVENTS,
  PLAYER_CONFIG,
  QUALITY_PRESETS,
  MAPS,
  META_UPGRADES,
  SYNERGIES,
  CROSS_SYNERGIES,
  TACTICAL_CARDS,
  PILOT_FRAMES,
  PILOT_FRAME_ART,
  PILOT_FRAME_OUTCOME_ART,
  HEAT_CONTRACTS,
  getCumulativeHeatProfile,
  DAILY_MODIFIERS,
  ACHIEVEMENTS,
  PLAYER_TITLES,
  FRAME_SKINS,
  HEAT_MILESTONE_REWARDS,
  STREAK_REWARDS,
  getTodayDailyModifier,
  getDailyModifierForDay,
  getTodayDateKey,
  getDailyQuestsForDate,
} = __require("src/config/constants.js");
const { WAVES } = __require("src/config/waves.js");
const { WEAPONS, WEAPON_SKINS, WEAPON_MASTERY_TITLES } = __require("src/config/weapons.js");
const FirebaseService = __require("src/firebase/FirebaseService.js");
const { WeaponModelFactory } = __require("src/weapons/WeaponModelFactory.js");
const { EventBus } = __require("src/core/EventBus.js");
const { Engine } = __require("src/core/Engine.js");
const { InputManager } = __require("src/core/InputManager.js");
const { CollisionWorld } = __require("src/physics/CollisionWorld.js");
const { PlayerController } = __require("src/player/PlayerController.js");
const { MapManager } = __require("src/world/MapManager.js");
const { MapPropFactory } = __require("src/world/MapPropFactory.js");
const { Interactables } = __require("src/world/Interactables.js");
const { VfxManager } = __require("src/vfx/VfxManager.js");
const { WeaponSystem } = __require("src/weapons/WeaponSystem.js");
const { WaveDirector } = __require("src/ai/WaveDirector.js");
const { SoundEngine } = __require("src/audio/SoundEngine.js");
const { HudManager } = __require("src/ui/HudManager.js");
const { TouchOverlay } = __require("src/ui/TouchOverlay.js");

const FADE_DURATION_MS = 300;
const ENDING_LINGER_SEC = 0.5;
const ENDING_SLOWMO_SCALE = 0.25;

/**
 * AETHER DROP: RECLAIM EARTH — Independent 3-Scene Architecture (TITLE / PLAYING / RESULT),
 * Lazy Zero-Stutter GPU Initialization, 3-Map Campaign Transition & 60FPS Game Loop.
 */
function bootstrap() {
  const byId = (id) => document.getElementById(id);

  // Independent Scene Containers & Global Curtains
  const sceneTitle = byId('scene-title');
  const scenePlaying = byId('scene-playing');
  const sceneResult = byId('scene-result');
  const sceneFade = byId('scene-fade');
  const fallbackEl = byId('webgl-fallback');
  const fallbackMsg = byId('webgl-fallback-msg');
  const canvas = byId('game-canvas');

  // Title Scene Controls & Sub-Panels
  const titleDeviceBadge = byId('title-device-badge');
  const titleQualityBadge = byId('title-quality-badge');
  const titleMenuMain = byId('title-menu-main');
  const btnDeploy = byId('btn-deploy');
  const panelDeploy = byId('title-panel-deploy');
  const btnDeployBack = byId('btn-deploy-back');
  const btnDeployLaunch = byId('btn-deploy-launch');
  const deployHeatGrid = byId('deploy-heat-grid');
  const btnTutorial = byId('btn-tutorial');
  const btnTutExit = byId('btn-tut-exit');
  if (btnTutorial) btnTutorial.addEventListener('click', () => startTutorialRun());
  if (btnTutExit) btnTutExit.addEventListener('click', () => finishTutorial(false));
  const titleGoldBadge = byId('title-gold-badge');
  const btnTitleArmory = byId('btn-title-armory');
  const panelArmory = byId('title-panel-armory');
  const btnArmoryBack = byId('btn-armory-back');
  const btnArmoryReset = byId('btn-armory-reset');
  const armoryGoldAmount = byId('armory-gold-amount');
  const armoryGrid = byId('armory-grid');
  const upgradePanel = byId('upgrade-panel');
  const upgradeKicker = byId('upgrade-kicker');
  const upgradeCardsGrid = byId('upgrade-cards-grid');
  const btnTitleArsenal = byId('btn-title-arsenal');
  const missionDiamondWidget = byId('title-mission-diamond');
  const btnMissionDiamondTrigger = byId('btn-mission-diamond-trigger');
  const diamondQuestCount = byId('diamond-quest-count');
  const btnOpenAttendancePopup = byId('btn-open-attendance-popup');
  const attendancePopupModal = byId('attendance-popup-modal');
  const btnAttendanceClose = byId('btn-attendance-close');
  const btnAttendanceLater = byId('btn-attendance-later');
  const btnTitleLeaderboard = byId('btn-title-leaderboard');
  const btnTitleControls = byId('btn-title-controls');
  const btnTitleSettings = byId('btn-title-settings');
  const btnTitleAchievements = byId('btn-title-achievements');
  const titleAchBadge = byId('title-ach-badge');
  const titleEquippedTitleBadge = byId('title-equipped-title-badge');
  const titlePilotCallsign = byId('title-pilot-callsign');
  const titleTestBadge = byId('title-test-badge');
  const titleTestModePanel = byId('title-test-mode-panel');
  const testStageGroups = byId('test-stage-groups');
  const chkTestSkipDroppod = byId('chk-test-skip-droppod');
  const testPanelOpsSummary = byId('test-panel-ops-summary');
  const titleUnlockToast = byId('title-unlock-toast');

  const panelArsenal = byId('title-panel-arsenal');
  const btnArsenalBack = byId('btn-arsenal-back');
  const panelLeaderboard = byId('title-panel-leaderboard');
  const btnLeaderboardBack = byId('btn-leaderboard-back');
  const panelControls = byId('title-panel-controls');
  const btnControlsBack = byId('btn-controls-back');
  const panelSettings = byId('title-panel-settings');
  const btnSettingsBack = byId('btn-settings-back');
  const panelAchievements = byId('title-panel-achievements');
  const btnAchievementsBack = byId('btn-achievements-back');
  const btnAchClaimAll = byId('btn-ach-claim-all');
  const achievementsGrid = byId('achievements-grid');
  const achProgressText = byId('ach-progress-text');
  const achProgressFill = byId('ach-progress-fill');
  const achStatsInline = byId('ach-stats-inline');

  const titleSelQuality = byId('title-setting-quality');
  const titleSelControls = byId('title-setting-controls');
  const titleRngSensitivity = byId('title-setting-sensitivity');
  const titleValSensitivity = byId('title-setting-sensitivity-val');
  const titleRngVolume = byId('title-setting-volume');
  const titleValVolume = byId('title-setting-volume-val');
  const titleChkMusic = byId('title-setting-music');
  const titleChkFps = byId('title-setting-fps');
  const titleRngAdsSens = byId('title-setting-ads-sens');
  const titleValAdsSens = byId('title-setting-ads-sens-val');
  const titleRngFov = byId('title-setting-fov');
  const titleValFov = byId('title-setting-fov-val');
  const titleChkInvertY = byId('title-setting-invert-y');
  const titleRngSfxVol = byId('title-setting-sfx-volume');
  const titleValSfxVol = byId('title-setting-sfx-volume-val');
  const titleRngShake = byId('title-setting-shake');
  const titleValShake = byId('title-setting-shake-val');
  const titleFullscreenStatus = byId('title-setting-fullscreen-status');
  const btnTitleFullscreen = byId('btn-title-setting-fullscreen');

  // Playing Scene HUD / Pause Controls
  const btnHudPause = byId('hud-pause-btn');
  const pausePanel = byId('pause-panel');
  const btnResume = byId('btn-resume');
  const btnRestartPause = byId('btn-restart-pause');
  const btnQuitTitle = byId('btn-quit-title');

  const pauseSelQuality = byId('setting-quality');
  const pauseSelControls = byId('setting-controls');
  const pauseRngSensitivity = byId('setting-sensitivity');
  const pauseValSensitivity = byId('setting-sensitivity-val');
  const pauseRngVolume = byId('setting-volume');
  const pauseValVolume = byId('setting-volume-val');
  const pauseChkMusic = byId('setting-music');
  const pauseChkFps = byId('setting-fps');
  const pauseRngAdsSens = byId('setting-ads-sens');
  const pauseValAdsSens = byId('setting-ads-sens-val');
  const pauseRngFov = byId('setting-fov');
  const pauseValFov = byId('setting-fov-val');
  const pauseChkInvertY = byId('setting-invert-y');
  const pauseRngSfxVol = byId('setting-sfx-volume');
  const pauseValSfxVol = byId('setting-sfx-volume-val');
  const pauseRngShake = byId('setting-shake');
  const pauseValShake = byId('setting-shake-val');
  const pauseFullscreenStatus = byId('pause-setting-fullscreen-status');
  const btnPauseFullscreen = byId('btn-pause-setting-fullscreen');
  const fpsCounterEl = byId('fps-counter');

  // Result Scene Actions
  const btnRedeploy = byId('btn-redeploy');
  const btnEndTitle = byId('btn-end-title');

  // ---------------------------------------------------------------------------
  // 1. Coarse-Pointer Device Detection & Bi-Directional Settings State
  // ---------------------------------------------------------------------------
  const coarseMediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)')
      : null;

  function isCoarsePointer() {
    if (coarseMediaQuery) {
      return Boolean(coarseMediaQuery.matches);
    }
    return Boolean(
      typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches
    );
  }

  function isTouchActive() {
    if (settings.controlMode === 'pc') return false;
    if (settings.controlMode === 'touch') return true;
    if (!isCoarsePointer()) return false;
    return runtimeReady && input ? input.isTouchMode() : true;
  }

  const settings = {
    quality: (titleSelQuality && titleSelQuality.value) || 'medium',
    controlMode: (titleSelControls && titleSelControls.value) || 'auto',
    sensitivity: parseFloat((titleRngSensitivity && titleRngSensitivity.value) || '1.0') || 1.0,
    volume: parseInt((titleRngVolume && titleRngVolume.value) || '78', 10),
    music: titleChkMusic ? Boolean(titleChkMusic.checked) : true,
    showFps: titleChkFps ? Boolean(titleChkFps.checked) : false,
    adsSens: parseFloat((titleRngAdsSens && titleRngAdsSens.value) || '0.56') || 0.56,
    fov: parseInt((titleRngFov && titleRngFov.value) || '80', 10) || 80,
    invertY: titleChkInvertY ? Boolean(titleChkInvertY.checked) : false,
    sfxVolume: parseInt((titleRngSfxVol && titleRngSfxVol.value) || '100', 10),
    screenShake: parseInt((titleRngShake && titleRngShake.value) || '100', 10),
  };
  if (!Number.isFinite(settings.volume)) settings.volume = 78;
  if (!Number.isFinite(settings.sfxVolume)) settings.sfxVolume = 100;
  if (!Number.isFinite(settings.screenShake)) settings.screenShake = 100;

  function getViewportUiScale() {
    const w = window.innerWidth || 1920;
    const h = window.innerHeight || 1080;
    if (isTouchActive() || w < 1081 || h < 540) return 1;
    const s = Math.min(w / 1920, h / 1080);
    return Number.isFinite(s) && s > 0 ? s : 1;
  }

  function syncViewportUiScale() {
    const w = window.innerWidth || 1920;
    const h = window.innerHeight || 1080;
    const desktopScaled = !isTouchActive() && w >= 1081 && h >= 540;
    const scale = desktopScaled ? Math.min(w / 1920, h / 1080) : 1;
    if (document.documentElement) {
      document.documentElement.style.setProperty('--ad-ui-scale', scale.toFixed(6));
      document.documentElement.style.setProperty('--ad-ui-inv-w', `${(w / scale).toFixed(3)}px`);
      document.documentElement.style.setProperty('--ad-ui-inv-h', `${(h / scale).toFixed(3)}px`);
    }
    if (document.body) {
      document.body.classList.toggle('ui-scale-desktop', desktopScaled);
    }
  }

  syncViewportUiScale();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncViewportUiScale);
  }

  // ---------------------------------------------------------------------------
  // 1.5. Persistent Gold & Meta Armory + In-Run Tactical Cards & Synergies
  // ---------------------------------------------------------------------------
  const META_STORAGE_KEY = 'aether_drop_meta_v1';
  const TEST_MODE_STORAGE_KEY = 'aether_drop_test_mode_v1';
  let testModeActive = false;
  let preTestMetaSnapshot = null;
  let selectedStartWaveIndex = 0;
  const defaultWeaponStats = {};
  const defaultWeaponSkins = {};
  for (let wi = 0; wi < WEAPONS.length; wi++) {
    defaultWeaponStats[WEAPONS[wi].id] = { kills: 0, headshots: 0 };
    defaultWeaponSkins[WEAPONS[wi].id] = 'standard';
  }

  const metaState = {
    gold: 0,
    levels: { firepower: 0, hull: 0, shield: 0, thruster: 0, reload: 0, crit: 0, siphon: 0, salvage: 0 },
    ownedFrames: ['vanguard'],
    equippedFrame: 'vanguard',
    achievements: [],
    claimedAchievements: {},
    maxUnlockedHeat: 0,
    bestEndlessWave: 0,
    totalKillsAllTime: 0,
    voidGatesDestroyed: 0,
    callsign: 'PILOT',
    equippedTitle: 'rookie_dropper',
    unlockedTitles: ['rookie_dropper'],
    unlockedFrameSkins: ['standard'],
    equippedFrameSkin: 'standard',
    claimedHeatMilestones: {},
    weaponStats: defaultWeaponStats,
    equippedWeaponSkins: defaultWeaponSkins,
    dailyState: {
      dateKey: getTodayDateKey(),
      progress: {},
      claimed: {},
      streakCount: 0,
      lastAttendanceDate: '',
    },
  };
  const SETTINGS_STORAGE_KEY = 'aether_drop_settings_v1';
  let _initializingSettings = true;
  function _readCookieBackup(name) {
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    } catch { return null; }
  }
  function _writeCookieBackup(name, val) {
    try {
      document.cookie = name + '=' + encodeURIComponent(val) + '; max-age=31536000; path=/; SameSite=Lax';
    } catch {}
  }
  function saveSettingsState() {
    if (_initializingSettings) return;
    try {
      const serialized = JSON.stringify(settings);
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
      _writeCookieBackup(SETTINGS_STORAGE_KEY, serialized);
    } catch {}
  }
  try {
    const rawSettings =
      window.localStorage.getItem(SETTINGS_STORAGE_KEY) || _readCookieBackup(SETTINGS_STORAGE_KEY);
    if (rawSettings) {
      const ps = JSON.parse(rawSettings);
      if (typeof ps.quality === 'string' && QUALITY_PRESETS[ps.quality.toLowerCase()]) {
        settings.quality = ps.quality.toLowerCase();
      }
      if (ps.controlMode === 'auto' || ps.controlMode === 'pc' || ps.controlMode === 'touch') {
        settings.controlMode = ps.controlMode;
      }
      if (Number.isFinite(ps.sensitivity)) {
        settings.sensitivity = Math.max(0.01, Math.min(2.49, Math.round(ps.sensitivity * 100) / 100));
      }
      if (Number.isFinite(ps.volume)) {
        settings.volume = Math.max(0, Math.min(100, Math.round(ps.volume)));
      }
      if (typeof ps.music === 'boolean') {
        settings.music = ps.music;
      }
      if (typeof ps.showFps === 'boolean') {
        settings.showFps = ps.showFps;
      }
      if (Number.isFinite(ps.adsSens)) {
        settings.adsSens = Math.max(0.25, Math.min(1.5, Math.round(ps.adsSens * 100) / 100));
      }
      if (Number.isFinite(ps.fov)) {
        settings.fov = Math.max(70, Math.min(110, Math.round(ps.fov)));
      }
      if (typeof ps.invertY === 'boolean') {
        settings.invertY = ps.invertY;
      }
      if (Number.isFinite(ps.sfxVolume)) {
        settings.sfxVolume = Math.max(0, Math.min(100, Math.round(ps.sfxVolume)));
      }
      if (Number.isFinite(ps.screenShake)) {
        settings.screenShake = Math.max(0, Math.min(100, Math.round(ps.screenShake)));
      }
    }
  } catch {}
  let hadLocalMetaAtBoot = false;
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY) || _readCookieBackup(META_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      hadLocalMetaAtBoot = Boolean(parsed && typeof parsed === 'object');
      if (Number.isFinite(parsed.gold)) metaState.gold = Math.max(0, Math.floor(parsed.gold));
      if (parsed.levels) {
        for (const k of Object.keys(metaState.levels)) {
          if (Number.isFinite(parsed.levels[k])) {
            metaState.levels[k] = Math.max(0, Math.min(10, Math.floor(parsed.levels[k])));
          }
        }
      }
      if (Array.isArray(parsed.ownedFrames)) {
        metaState.ownedFrames = Array.from(new Set(['vanguard', ...parsed.ownedFrames]));
      }
      if (typeof parsed.equippedFrame === 'string' && metaState.ownedFrames.includes(parsed.equippedFrame)) {
        metaState.equippedFrame = parsed.equippedFrame;
      }
      if (Array.isArray(parsed.achievements)) {
        metaState.achievements = Array.from(new Set(parsed.achievements));
      }
      if (parsed.claimedAchievements && typeof parsed.claimedAchievements === 'object') {
        metaState.claimedAchievements = Object.assign({}, parsed.claimedAchievements);
      }
      if (Number.isFinite(parsed.maxUnlockedHeat)) {
        metaState.maxUnlockedHeat = Math.max(
          0,
          Math.min(HEAT_CONTRACTS.length - 1, Math.floor(parsed.maxUnlockedHeat))
        );
      }
      if (Number.isFinite(parsed.bestEndlessWave)) {
        metaState.bestEndlessWave = Math.max(0, Math.floor(parsed.bestEndlessWave));
      }
      if (Number.isFinite(parsed.totalKillsAllTime)) {
        metaState.totalKillsAllTime = Math.max(0, Math.floor(parsed.totalKillsAllTime));
      }
      if (Number.isFinite(parsed.voidGatesDestroyed)) {
        metaState.voidGatesDestroyed = Math.max(0, Math.floor(parsed.voidGatesDestroyed));
      }
      if (typeof parsed.callsign === 'string' && parsed.callsign.trim()) {
        metaState.callsign = parsed.callsign.trim().slice(0, 18);
      }
      if (Array.isArray(parsed.unlockedTitles)) {
        metaState.unlockedTitles = Array.from(new Set(['rookie_dropper', ...parsed.unlockedTitles]));
      }
      if (typeof parsed.equippedTitle === 'string' && metaState.unlockedTitles.includes(parsed.equippedTitle)) {
        metaState.equippedTitle = parsed.equippedTitle;
      }
      if (Array.isArray(parsed.unlockedFrameSkins)) {
        metaState.unlockedFrameSkins = Array.from(new Set(['standard', ...parsed.unlockedFrameSkins]));
      }
      if (typeof parsed.equippedFrameSkin === 'string' && metaState.unlockedFrameSkins.includes(parsed.equippedFrameSkin)) {
        metaState.equippedFrameSkin = parsed.equippedFrameSkin;
      }
      if (parsed.claimedHeatMilestones && typeof parsed.claimedHeatMilestones === 'object') {
        metaState.claimedHeatMilestones = Object.assign({}, parsed.claimedHeatMilestones);
      }
      if (parsed.weaponStats && typeof parsed.weaponStats === 'object') {
        for (const wid of Object.keys(metaState.weaponStats)) {
          const st = parsed.weaponStats[wid];
          if (st && typeof st === 'object') {
            metaState.weaponStats[wid] = {
              kills: Math.max(0, Math.floor(Number(st.kills) || 0)),
              headshots: Math.max(0, Math.floor(Number(st.headshots) || 0)),
            };
          }
        }
      }
      if (parsed.equippedWeaponSkins && typeof parsed.equippedWeaponSkins === 'object') {
        for (const wid of Object.keys(metaState.equippedWeaponSkins)) {
          const skId = parsed.equippedWeaponSkins[wid];
          if (typeof skId === 'string' && WEAPON_SKINS.some((s) => s.id === skId)) {
            metaState.equippedWeaponSkins[wid] = skId;
          }
        }
      }
      if (parsed.dailyState && typeof parsed.dailyState === 'object') {
        metaState.dailyState = {
          dateKey: typeof parsed.dailyState.dateKey === 'string' ? parsed.dailyState.dateKey : getTodayDateKey(),
          progress: parsed.dailyState.progress && typeof parsed.dailyState.progress === 'object' ? Object.assign({}, parsed.dailyState.progress) : {},
          claimed: parsed.dailyState.claimed && typeof parsed.dailyState.claimed === 'object' ? Object.assign({}, parsed.dailyState.claimed) : {},
          streakCount: Math.max(0, Math.floor(Number(parsed.dailyState.streakCount) || 0)),
          lastAttendanceDate: typeof parsed.dailyState.lastAttendanceDate === 'string' ? parsed.dailyState.lastAttendanceDate : '',
        };
      }
    }
  } catch {}

  // Legacy migration: if player already cleared HEAT 2+ before HEAT 0..10 existed, ensure at least HEAT 3 unlocked
  if (metaState.achievements.includes('heat_clear') && metaState.maxUnlockedHeat < 3) {
    metaState.maxUnlockedHeat = 3;
  } else if (metaState.achievements.includes('abyss_clear') && metaState.maxUnlockedHeat < 1) {
    metaState.maxUnlockedHeat = 1;
  }

  function getEquippedFrame() {
    return PILOT_FRAMES.find((f) => f.id === metaState.equippedFrame) || PILOT_FRAMES[0];
  }

  let selectedMissionMode = 'campaign'; // 'campaign' | 'endless' | 'daily'
  let selectedHeatLevel = 0; // 0..maxUnlockedHeat
  let previewDailyDayIndex = null; // null => auto today's weekday
  let armoryResetConfirmPending = false;
  let armoryResetConfirmTimer = null;

  let activeAchCategory = 'all';

  function getUnclaimedAchievementGold() {
    let total = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i];
      if (!metaState.achievements.includes(a.id)) continue;
      const claimed = Number(metaState.claimedAchievements[a.id]) || 0;
      if ((a.reward || 0) > claimed) {
        total += (a.reward || 0) - claimed;
      }
    }
    return total;
  }

  function claimAllAchievementRewards() {
    let gained = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i];
      if (!metaState.achievements.includes(a.id)) continue;
      const claimed = Number(metaState.claimedAchievements[a.id]) || 0;
      const diff = (a.reward || 0) - claimed;
      if (diff > 0) {
        gained += diff;
        metaState.claimedAchievements[a.id] = a.reward || 0;
      }
    }
    if (gained > 0) {
      metaState.gold += gained;
      saveMetaState();
      if (titleGoldBadge) titleGoldBadge.textContent = `${metaState.gold} G`;
      if (armoryGoldAmount) armoryGoldAmount.textContent = `${metaState.gold} G`;
      renderMedalsStrip();
      renderArmoryUI();
      playUiSfx('buy');
    }
  }

  function unlockAchievement(id) {
    if (metaState.achievements.includes(id)) return;
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return;
    metaState.achievements.push(id);
    if (ach.reward > 0) {
      metaState.gold += ach.reward;
      metaState.claimedAchievements[ach.id] = ach.reward;
      if (titleGoldBadge) titleGoldBadge.textContent = `${metaState.gold} G`;
      if (armoryGoldAmount) armoryGoldAmount.textContent = `${metaState.gold} G`;
    }
    saveMetaState();
    renderMedalsStrip();
    if (eventBus) {
      eventBus.emit(EVENTS.ANNOUNCEMENT, {
        kicker: ach.reward ? `도전과제 달성 (+${ach.reward} G)` : '도전과제 달성',
        title: ach.name,
        subtitle: ach.desc,
        duration: 3.0,
      });
    }
  }

  function tryUnlockNextHeat(clearedHeatLevel) {
    const safeHeat = Math.max(0, Math.min(HEAT_CONTRACTS.length - 1, Math.floor(clearedHeatLevel || 0)));
    if (safeHeat >= 2) unlockAchievement('heat_clear');
    if (safeHeat >= 5) unlockAchievement('heat_5');
    if (safeHeat >= 10) unlockAchievement('heat_10');
    if (safeHeat >= metaState.maxUnlockedHeat && metaState.maxUnlockedHeat < HEAT_CONTRACTS.length - 1) {
      metaState.maxUnlockedHeat = Math.min(HEAT_CONTRACTS.length - 1, safeHeat + 1);
      saveMetaState();
      const nextCfg = HEAT_CONTRACTS[metaState.maxUnlockedHeat];
      if (eventBus && nextCfg) {
        eventBus.emit(EVENTS.ANNOUNCEMENT, {
          kicker: '위협도 단계 해금',
          title: `${nextCfg.label} 개방!`,
          subtitle: nextCfg.desc,
          duration: 3.6,
        });
      }
      updateMissionConfigUI();
    }
  }

  function renderMedalsStrip() {
    const unlockedCount = metaState.achievements.length;
    const totalCount = ACHIEVEMENTS.length;
    const unclaimedGold = getUnclaimedAchievementGold();
    if (titleAchBadge) {
      titleAchBadge.textContent = unclaimedGold > 0 ? `+${unclaimedGold}G` : `${unlockedCount}/${totalCount}`;
    }
    if (btnAchClaimAll) {
      if (unclaimedGold > 0) {
        btnAchClaimAll.textContent = `미수령 보상 수령 (+${unclaimedGold} G)`;
        btnAchClaimAll.classList.remove('hidden');
      } else {
        btnAchClaimAll.classList.add('hidden');
      }
    }
    if (achProgressText) {
      achProgressText.textContent = `달성 ${unlockedCount} / ${totalCount}`;
    }
    if (achProgressFill) {
      achProgressFill.style.width = `${Math.round((unlockedCount / Math.max(1, totalCount)) * 100)}%`;
    }
    if (achStatsInline) {
      achStatsInline.textContent = `누적 처치 ${metaState.totalKillsAllTime || 0} · 최고 해금 위협 ${metaState.maxUnlockedHeat || 0} · 무한 ${metaState.bestEndlessWave || 0}웨이브`;
    }
    if (!achievementsGrid) return;

    let html = '';
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i];
      if (activeAchCategory !== 'all' && a.cat !== activeAchCategory) continue;
      const unlocked = metaState.achievements.includes(a.id);
      const claimed = Number(metaState.claimedAchievements[a.id]) || 0;
      const pendingDiff = unlocked ? Math.max(0, (a.reward || 0) - claimed) : 0;
      const rewardLabel = !unlocked
        ? `+${a.reward || 0} G`
        : pendingDiff > 0
        ? `달성 · +${pendingDiff} G 수령 가능`
        : `+${a.reward || 0} G 지급 완료`;
      const stampMarkup = unlocked
        ? `<div class="ach-cleared-stamp ${pendingDiff > 0 ? 'claimable' : ''}" aria-hidden="true">
            <svg class="ach-stamp-svg" viewBox="0 0 120 120" width="94" height="94" focusable="false">
              <defs>
                <path id="ach-arc-top-${i}" d="M 22,60 A 38,38 0 1,1 98,60" />
                <path id="ach-arc-bot-${i}" d="M 96,64 A 36,36 0 0,1 24,64" />
              </defs>
              <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="3.2" stroke-dasharray="10 3 4 3" opacity="0.92" />
              <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.72" />
              <circle cx="60" cy="60" r="28" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.55" />
              <text class="ach-stamp-arc-text" fill="currentColor" font-size="9.5" font-weight="900" letter-spacing="2.2">
                <textPath href="#ach-arc-top-${i}" startOffset="50%" text-anchor="middle">AETHER DROP</textPath>
              </text>
              <g transform="translate(60 54)" fill="none" stroke="currentColor">
                <path d="M0,-16 L12,6 L4,2 L0,10 L-4,2 L-12,6 Z" fill="currentColor" opacity="0.92" />
                <path d="M-21,-3 L-11,-3 M11,-3 L21,-3 M-16,4 L-9,4 M9,4 L16,4" stroke-width="2" stroke-linecap="round" opacity="0.82" />
              </g>
              <rect x="20" y="69" width="80" height="19" rx="3" fill="rgba(16, 13, 10, 0.86)" stroke="currentColor" stroke-width="1.8" />
              <text x="60" y="82.5" text-anchor="middle" fill="currentColor" font-size="11.5" font-weight="900" letter-spacing="1.6">작전 달성</text>
            </svg>
          </div>`
        : '';
      html += `
        <article class="ach-card ${unlocked ? 'unlocked' : ''}">
          <div class="ach-card-top">
            <span class="ach-cat-tag">${a.catLabel || '기록'}</span>
            <span class="ach-reward">${rewardLabel}</span>
          </div>
          <h3 class="ach-name">${a.name}</h3>
          <p class="ach-desc">${a.desc}</p>
          ${stampMarkup}
        </article>`;
    }
    achievementsGrid.innerHTML = html;
  }

  // Lazy & live-updatable orthographic 3D side-profile renderer for Arsenal Briefing & Weapon Skins
  const ARSENAL_DEFAULT_PITCH = -Math.PI / 12; // X축 -15도 (하단이 화면을 살짝 바라보는 앙각)
  const ARSENAL_DEFAULT_YAW = Math.PI / 12;    // Y축 +15도 (왼쪽/후방이 살짝 화면을 향하는 각도)

  function addWeaponShowcaseLights(scene) {
    const ambient = new THREE.AmbientLight(0xfffbeb, 0.65);
    const hemi = new THREE.HemisphereLight(0xfff7ed, 0x57534e, 1.65);
    const key = new THREE.DirectionalLight(0xfff5e0, 2.35);
    key.position.set(-2.8, 2.2, 4.4);
    const lowerLeftFill = new THREE.DirectionalLight(0xf1f5f9, 1.85);
    lowerLeftFill.position.set(-3.4, -3.2, 4.2);
    const rim = new THREE.DirectionalLight(0xf59e0b, 1.35);
    rim.position.set(3.2, 2.4, -2.8);
    const under = new THREE.DirectionalLight(0xcbd5e1, 1.25);
    under.position.set(1.8, -3.5, 2.6);
    scene.add(ambient, hemi, key, lowerLeftFill, rim, under);
  }

  function buildWeaponDisplayPivot(factory, cfg, skinId) {
    const rig = factory.createWeaponRig(cfg);
    if (rig.leftHand) rig.leftHand.visible = false;
    if (rig.rightHand) rig.rightHand.visible = false;
    if (rig.reticleMesh) rig.reticleMesh.visible = false;

    const skinCfg = WEAPON_SKINS.find((sk) => sk.id === skinId) || WEAPON_SKINS[0];
    if (typeof factory.applyWeaponSkin === 'function') {
      factory.applyWeaponSkin(rig, cfg, skinCfg);
    }

    // Orient barrel (-Z) toward screen right (+X) and side facing +Z, centered at origin
    rig.root.rotation.set(0, -Math.PI * 0.5, 0);
    rig.root.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(rig.root);
    const rawCenter = new THREE.Vector3();
    rawBox.getCenter(rawCenter);
    rig.root.position.sub(rawCenter);

    const pivot = new THREE.Group();
    pivot.rotation.order = 'YXZ';
    pivot.add(rig.root);
    pivot.rotation.set(ARSENAL_DEFAULT_PITCH, ARSENAL_DEFAULT_YAW, 0);
    pivot.updateMatrixWorld(true);

    const rotBox = new THREE.Box3().setFromObject(pivot);
    const rotSize = new THREE.Vector3();
    const rotSphere = new THREE.Sphere();
    rotBox.getSize(rotSize);
    rotBox.getBoundingSphere(rotSphere);

    return { rig, skinCfg, pivot, size: rotSize, radius: Math.max(0.18, rotSphere.radius) };
  }

  function fitShowcaseCamera(cam, size, aspect, pad = 1.22) {
    const fovRad = THREE.MathUtils.degToRad(cam.fov);
    const tanHalfV = Math.tan(fovRad * 0.5);
    const tanHalfH = tanHalfV * aspect;
    const distY = (size.y * 0.5 * pad) / tanHalfV;
    const distX = (size.x * 0.5 * pad) / tanHalfH;
    const dist = Math.max(distY, distX, 0.55) + size.z * 0.5;
    cam.position.set(0, 0, dist);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    return dist;
  }

  let arsenalPreviewsRendered = false;
  function renderArsenalPreviews(targetWeaponId = null, previewSkinOverrides = null) {
    if (!targetWeaponId && arsenalPreviewsRendered) return;
    if (!targetWeaponId) arsenalPreviewsRendered = true;
    const selector = targetWeaponId
      ? `[data-weapon-preview="${targetWeaponId}"]`
      : '[data-weapon-preview]';
    const boxes = document.querySelectorAll(selector);
    if (!boxes.length || typeof THREE === 'undefined') return;

    let renderer = null;
    let factory = null;
    const builtRigs = [];
    try {
      const W = 480;
      const H = 220;
      const aspect = W / H;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(W, H, false);
      renderer.setPixelRatio(Math.min(2.5, Math.max(1.5, (window.devicePixelRatio || 1) * getViewportUiScale())));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.32;

      const scene = new THREE.Scene();
      addWeaponShowcaseLights(scene);

      const cam = new THREE.PerspectiveCamera(28, aspect, 0.05, 30);
      factory = new WeaponModelFactory();

      boxes.forEach((boxEl) => {
        const wid = boxEl.getAttribute('data-weapon-preview');
        const cfg = WEAPONS.find((w) => w.id === wid) || WEAPONS[0];
        const skinId =
          (previewSkinOverrides && previewSkinOverrides[wid]) ||
          (metaState.equippedWeaponSkins && metaState.equippedWeaponSkins[wid]) ||
          'standard';

        const { rig, skinCfg, pivot, size } = buildWeaponDisplayPivot(factory, cfg, skinId);
        builtRigs.push(rig);

        scene.add(pivot);
        fitShowcaseCamera(cam, size, aspect, 1.18);

        renderer.clear();
        renderer.render(scene, cam);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        scene.remove(pivot);

        boxEl.innerHTML =
          `<img class="weapon-preview-img" src="${dataUrl}" alt="${cfg.name} (${skinCfg.name}) 3D 입체 전시" />` +
          `<span class="weapon-preview-hint">클릭해 3D 회전</span>`;
      });
    } catch (err) {
      boxes.forEach((boxEl) => {
        boxEl.innerHTML = '<span class="weapon-preview-loading">3D 미리보기 불가</span>';
      });
    } finally {
      for (let i = 0; i < builtRigs.length; i++) {
        builtRigs[i].dispose();
      }
      if (factory) factory.dispose();
      if (renderer) renderer.dispose();
    }
  }

  // Interactive 3D Weapon Inspector Modal (click any weapon in Arsenal Briefing)
  const weaponInspectorModal = byId('weapon-inspector-modal');
  const weaponInspectorStage = byId('weapon-inspector-stage');
  const weaponInspectorCanvas = byId('weapon-inspector-canvas');
  const weaponInspectorSlot = byId('weapon-inspector-slot');
  const weaponInspectorName = byId('weapon-inspector-name');
  const weaponInspectorSkins = byId('weapon-inspector-skins');
  const weaponInspectorStats = byId('weapon-inspector-stats');
  const weaponInspectorDesc = byId('weapon-inspector-desc');
  const btnWeaponInspectorReset = byId('btn-weapon-inspector-reset');
  const btnWeaponInspectorClose = byId('btn-weapon-inspector-close');

  const inspectorState = {
    open: false,
    weaponId: null,
    previewSkinId: 'standard',
    renderer: null,
    scene: null,
    cam: null,
    factory: null,
    rig: null,
    pivot: null,
    baseDist: 1.4,
    zoomScale: 1.0,
    targetZoom: 1.0,
    rotX: ARSENAL_DEFAULT_PITCH,
    rotY: ARSENAL_DEFAULT_YAW,
    targetRotX: ARSENAL_DEFAULT_PITCH,
    targetRotY: ARSENAL_DEFAULT_YAW,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    rafId: null,
    resizeHandler: null,
  };

  function disposeInspectorSceneRig() {
    if (inspectorState.scene && inspectorState.pivot) {
      inspectorState.scene.remove(inspectorState.pivot);
    }
    if (inspectorState.rig) {
      inspectorState.rig.dispose();
      inspectorState.rig = null;
    }
    inspectorState.pivot = null;
  }

  function resizeInspectorViewport() {
    if (!inspectorState.open || !inspectorState.renderer || !inspectorState.cam || !weaponInspectorStage) return;
    const w = Math.max(280, weaponInspectorStage.clientWidth || 640);
    const h = Math.max(220, weaponInspectorStage.clientHeight || 360);
    const dpr = Math.min((window.devicePixelRatio || 1) * getViewportUiScale(), 3);
    inspectorState.renderer.setPixelRatio(dpr);
    inspectorState.renderer.setSize(w, h, false);
    inspectorState.cam.aspect = w / h;
    inspectorState.cam.updateProjectionMatrix();
  }

  function mountInspectorWeaponModel(weaponId, skinId) {
    if (!inspectorState.scene || !inspectorState.factory || !inspectorState.cam) return;
    const cfg = WEAPONS.find((w) => w.id === weaponId) || WEAPONS[0];
    disposeInspectorSceneRig();
    const built = buildWeaponDisplayPivot(inspectorState.factory, cfg, skinId);
    inspectorState.rig = built.rig;
    inspectorState.pivot = built.pivot;
    inspectorState.scene.add(built.pivot);
    const w = Math.max(280, (weaponInspectorStage && weaponInspectorStage.clientWidth) || 640);
    const h = Math.max(220, (weaponInspectorStage && weaponInspectorStage.clientHeight) || 360);
    inspectorState.baseDist = fitShowcaseCamera(inspectorState.cam, built.size, w / h, 1.32);
    built.pivot.rotation.set(inspectorState.rotX, inspectorState.rotY, 0);
  }

  function renderInspectorSkinsBar(weaponId) {
    if (!weaponInspectorSkins) return;
    const eqSkinId = (metaState.equippedWeaponSkins && metaState.equippedWeaponSkins[weaponId]) || 'standard';
    let html = '<span class="mastery-counts">3D 스킨 미리보기</span>';
    for (let i = 0; i < WEAPON_SKINS.length; i++) {
      const sk = WEAPON_SKINS[i];
      const unlocked = isWeaponSkinUnlocked(weaponId, sk);
      const selected = inspectorState.previewSkinId === sk.id;
      const equipped = eqSkinId === sk.id;
      html += `
        <button
          class="skin-chip-btn${selected ? ' active' : ''}${!unlocked ? ' locked' : ''}"
          type="button"
          data-inspector-skin="${sk.id}"
        >
          <span class="skin-dot" style="background:${sk.swatchCss}"></span>
          <span>${sk.name}${equipped ? ' (장착)' : !unlocked ? ' (미해금)' : ''}</span>
        </button>`;
    }
    weaponInspectorSkins.innerHTML = html;
    weaponInspectorSkins.querySelectorAll('[data-inspector-skin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skId = btn.getAttribute('data-inspector-skin');
        const skCfg = WEAPON_SKINS.find((s) => s.id === skId);
        if (!skCfg) return;
        inspectorState.previewSkinId = skCfg.id;
        if (isWeaponSkinUnlocked(weaponId, skCfg)) {
          metaState.equippedWeaponSkins[weaponId] = skCfg.id;
          saveMetaState();
          syncCosmeticsToWeaponSystem();
          renderArsenalMasteryUI();
          renderArsenalPreviews(weaponId, metaState.equippedWeaponSkins);
        }
        mountInspectorWeaponModel(weaponId, skCfg.id);
        renderInspectorSkinsBar(weaponId);
      });
    });
  }

  function tickWeaponInspector() {
    if (!inspectorState.open) return;
    inspectorState.rotX += (inspectorState.targetRotX - inspectorState.rotX) * 0.22;
    inspectorState.rotY += (inspectorState.targetRotY - inspectorState.rotY) * 0.22;
    inspectorState.zoomScale += (inspectorState.targetZoom - inspectorState.zoomScale) * 0.22;

    if (inspectorState.pivot) {
      inspectorState.pivot.rotation.set(inspectorState.rotX, inspectorState.rotY, 0);
    }
    if (inspectorState.cam) {
      inspectorState.cam.position.set(0, 0, inspectorState.baseDist * inspectorState.zoomScale);
      inspectorState.cam.lookAt(0, 0, 0);
    }
    if (inspectorState.renderer && inspectorState.scene && inspectorState.cam) {
      inspectorState.renderer.render(inspectorState.scene, inspectorState.cam);
    }
    inspectorState.rafId = window.requestAnimationFrame(tickWeaponInspector);
  }

  function closeWeaponInspector() {
    if (!inspectorState.open) return;
    inspectorState.open = false;
    inspectorState.dragging = false;
    inspectorState.pointerId = null;
    if (weaponInspectorStage) weaponInspectorStage.classList.remove('is-dragging');
    if (inspectorState.rafId !== null) {
      window.cancelAnimationFrame(inspectorState.rafId);
      inspectorState.rafId = null;
    }
    if (inspectorState.resizeHandler) {
      window.removeEventListener('resize', inspectorState.resizeHandler);
      inspectorState.resizeHandler = null;
    }
    disposeInspectorSceneRig();
    if (inspectorState.factory) {
      inspectorState.factory.dispose();
      inspectorState.factory = null;
    }
    if (inspectorState.renderer) {
      inspectorState.renderer.dispose();
      inspectorState.renderer = null;
    }
    inspectorState.scene = null;
    inspectorState.cam = null;
    if (weaponInspectorModal) weaponInspectorModal.classList.add('hidden');
  }

  function openWeaponInspector(weaponId) {
    if (!weaponInspectorModal || !weaponInspectorCanvas || typeof THREE === 'undefined') return;
    const cfg = WEAPONS.find((w) => w.id === weaponId) || WEAPONS[0];
    const cardEl = document.querySelector(`#title-panel-arsenal [data-weapon-preview="${cfg.id}"]`)?.closest('.arsenal-card');

    closeWeaponInspector();

    inspectorState.open = true;
    inspectorState.weaponId = cfg.id;
    inspectorState.previewSkinId =
      (metaState.equippedWeaponSkins && metaState.equippedWeaponSkins[cfg.id]) || 'standard';
    inspectorState.rotX = ARSENAL_DEFAULT_PITCH;
    inspectorState.rotY = ARSENAL_DEFAULT_YAW;
    inspectorState.targetRotX = ARSENAL_DEFAULT_PITCH;
    inspectorState.targetRotY = ARSENAL_DEFAULT_YAW;
    inspectorState.zoomScale = 1.0;
    inspectorState.targetZoom = 1.0;

    const modalCard = weaponInspectorModal.querySelector('.weapon-inspector-card');
    if (modalCard) {
      modalCard.style.setProperty('--inspector-accent', cfg.colorCss || '#f59e0b');
    }
    if (weaponInspectorSlot) {
      const slotTxt = cardEl?.querySelector('.arsenal-slot')?.textContent?.trim() || (cfg.category === 'secondary' ? '보조무기' : '주무기');
      const roleTxt = cardEl?.querySelector('.arsenal-role')?.textContent?.trim() || cfg.role || '';
      weaponInspectorSlot.textContent = `${slotTxt} · ${roleTxt}`;
    }
    if (weaponInspectorName) weaponInspectorName.textContent = cfg.name;
    if (weaponInspectorStats) {
      const cardStats = cardEl?.querySelector('.arsenal-stats');
      weaponInspectorStats.innerHTML = cardStats ? cardStats.innerHTML : `<span>피해 ${cfg.damage}</span><span>탄창 ${cfg.magSize}</span>`;
    }
    if (weaponInspectorDesc) weaponInspectorDesc.textContent = cfg.description || '';

    weaponInspectorModal.classList.remove('hidden');

    try {
      const renderer = new THREE.WebGLRenderer({
        canvas: weaponInspectorCanvas,
        antialias: true,
        alpha: true,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;

      const scene = new THREE.Scene();
      addWeaponShowcaseLights(scene);

      const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 30);
      const factory = new WeaponModelFactory();

      inspectorState.renderer = renderer;
      inspectorState.scene = scene;
      inspectorState.cam = cam;
      inspectorState.factory = factory;

      resizeInspectorViewport();
      mountInspectorWeaponModel(cfg.id, inspectorState.previewSkinId);
      renderInspectorSkinsBar(cfg.id);

      inspectorState.resizeHandler = () => resizeInspectorViewport();
      window.addEventListener('resize', inspectorState.resizeHandler);
      inspectorState.rafId = window.requestAnimationFrame(tickWeaponInspector);
    } catch {
      closeWeaponInspector();
    }
  }

  let lockedHeatFeedbackText = '';
  function updateMissionConfigUI() {
    const maxUnlocked = Math.max(0, Math.min(HEAT_CONTRACTS.length - 1, metaState.maxUnlockedHeat || 0));
    if (selectedHeatLevel > maxUnlocked) selectedHeatLevel = maxUnlocked;
    const heatProf = getCumulativeHeatProfile(selectedHeatLevel);
    const heat = heatProf.cfg;
    const todayDaily = getTodayDailyModifier();
    const activeDailyDay = previewDailyDayIndex === null ? todayDaily.dayOfWeek : previewDailyDayIndex;
    const daily = getDailyModifierForDay(activeDailyDay);
    const isPreviewingOtherDay = daily.dayOfWeek !== todayDaily.dayOfWeek;
    const isDailyMode = selectedMissionMode === 'daily';
    const descEl = byId('mission-mode-desc');
    const modeLabel =
      selectedMissionMode === 'endless'
        ? '무한 강하'
        : isDailyMode
        ? '오늘의 작전'
        : '캠페인';

    for (const m of ['campaign', 'endless', 'daily']) {
      const b = byId(`mode-${m}`);
      if (b) b.classList.toggle('active', selectedMissionMode === m);
    }

    const summaryTxt = isDailyMode ? `${modeLabel} · ${todayDaily.name}` : `${modeLabel} · ${heat.label}`;
    if (descEl) {
      descEl.textContent = summaryTxt;
    }
    if (testPanelOpsSummary) {
      testPanelOpsSummary.textContent = summaryTxt;
    }

    const deployPanel = byId('title-panel-deploy');
    if (deployPanel) {
      deployPanel.classList.toggle('is-daily-selected', isDailyMode);
    }

    const heatPane = byId('deploy-heat-pane');
    const dailyPane = byId('deploy-daily-pane');
    if (heatPane) heatPane.classList.toggle('hidden', isDailyMode);
    if (dailyPane) dailyPane.classList.toggle('hidden', !isDailyMode);

    const modeBadgeEl = byId('deploy-mode-badge');
    const modeDetailEl = byId('deploy-mode-detail');
    if (modeBadgeEl) {
      modeBadgeEl.textContent =
        selectedMissionMode === 'endless'
          ? `무한 강하 · 최고 ${metaState.bestEndlessWave || 0}W`
          : isDailyMode
          ? `${todayDaily.dayName} · ${todayDaily.name}`
          : '캠페인 · 15웨이브';
    }
    if (modeDetailEl) {
      if (selectedMissionMode === 'endless') {
        modeDetailEl.textContent = `무한 강하: 15웨이브마다 순환하며 적 체력(+30%)과 공격력(+18%)이 누적 증폭됩니다. (최고 기록: ${metaState.bestEndlessWave || 0}웨이브 · 15웨이브 완주 시 다음 위협 해금)`;
      } else if (isDailyMode) {
        modeDetailEl.textContent = `오늘의 작전 [${todayDaily.name}]: ${todayDaily.desc} — 요일별 특수 규칙으로 15웨이브를 돌파합니다.`;
      } else {
        modeDetailEl.textContent = '표준 15웨이브 궤도 수복 작전입니다. 최종 보스 TRANSCENDENT-OMEGA를 격파하면 다음 위협 단계가 해금됩니다.';
      }
    }

    const dailyWeekStripEl = byId('deploy-daily-week-strip');
    if (dailyWeekStripEl) {
      const orderDays = [1, 2, 3, 4, 5, 6, 0]; // 월~일
      dailyWeekStripEl.innerHTML = '';
      for (let idx = 0; idx < orderDays.length; idx++) {
        const dObj = getDailyModifierForDay(orderDays[idx]);
        const isTodayTab = dObj.dayOfWeek === todayDaily.dayOfWeek;
        const isSelectedTab = dObj.dayOfWeek === daily.dayOfWeek;
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = `daily-week-btn${isSelectedTab ? ' active' : ''}${isTodayTab ? ' is-today' : ''}`;
        tabBtn.setAttribute('aria-selected', isSelectedTab ? 'true' : 'false');
        tabBtn.innerHTML = `
          <span class="daily-week-day">${dObj.dayShort}${isTodayTab ? ' · 오늘' : ''}</span>
          <strong class="daily-week-name">${dObj.name}</strong>
        `;
        tabBtn.addEventListener('click', () => {
          previewDailyDayIndex = dObj.dayOfWeek;
          updateMissionConfigUI();
        });
        dailyWeekStripEl.appendChild(tabBtn);
      }
    }

    const dailyTagEl = byId('deploy-daily-tag');
    const dailyStateBadgeEl = byId('deploy-daily-state-badge');
    const dailyNameEl = byId('deploy-daily-name');
    const dailyDateEl = byId('deploy-daily-date');
    const dailyConceptEl = byId('deploy-daily-concept');
    const dailyDescEl = byId('deploy-daily-desc');
    const dailyHpEl = byId('deploy-daily-enemy-hp');
    const dailyGoldEl = byId('deploy-daily-gold');
    if (dailyTagEl) dailyTagEl.textContent = `${daily.tag || 'SPECIAL OPS'} · ${daily.dayName} 작전`;
    if (dailyStateBadgeEl) {
      dailyStateBadgeEl.textContent = isPreviewingOtherDay ? `${daily.dayName} 로테이션 미리보기` : '오늘의 실제 출격 작전';
      dailyStateBadgeEl.classList.toggle('preview', isPreviewingOtherDay);
    }
    if (dailyNameEl) dailyNameEl.textContent = daily.name;
    if (dailyDateEl) dailyDateEl.textContent = isPreviewingOtherDay ? `출격 적용: 오늘(${todayDaily.dayShort}) · ${todayDaily.name}` : `오늘 (${daily.dayName}) · ${getTodayDateKey()}`;
    if (dailyConceptEl) dailyConceptEl.textContent = daily.concept || daily.desc;
    if (dailyDescEl) dailyDescEl.textContent = daily.desc;
    if (dailyHpEl) dailyHpEl.textContent = `${Math.round((daily.enemyHpMult || 1.0) * 100)}%`;
    if (dailyGoldEl) dailyGoldEl.textContent = `${Math.round((daily.goldMult || 1.25) * 100)}%`;

    const unlockStatusEl = byId('deploy-heat-unlock-status');
    if (unlockStatusEl) {
      unlockStatusEl.textContent = `해금 단계: ${maxUnlocked} / ${HEAT_CONTRACTS.length - 1}`;
    }

    if (deployHeatGrid) {
      deployHeatGrid.innerHTML = '';
      for (let i = 0; i < HEAT_CONTRACTS.length; i++) {
        const h = HEAT_CONTRACTS[i];
        const isLocked = i > maxUnlocked;
        const isCleared = i < maxUnlocked;
        const isSelected = i === selectedHeatLevel;
        const milestone = HEAT_MILESTONE_REWARDS.find((m) => m.heat === h.level);

        const cell = document.createElement('div');
        cell.className = 'heat-step-cell';

        if (milestone) {
          const isClaimed = Boolean(metaState.claimedHeatMilestones[String(milestone.heat)]);
          const skinObj = FRAME_SKINS.find((sk) => sk.id === milestone.frameSkinId);
          const rewardSlot = document.createElement('div');
          rewardSlot.className = 'heat-reward-slot';

          const pinBtn = document.createElement('button');
          pinBtn.type = 'button';
          pinBtn.className = `heat-reward-pin${isClaimed ? ' claimed' : ''}`;
          pinBtn.setAttribute('aria-label', `위협 ${milestone.heat} 최초 정복 보상 보기`);
          pinBtn.innerHTML = isClaimed
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';

          const tooltip = document.createElement('div');
          const alignClass = h.level >= 9 ? ' align-right' : h.level <= 2 ? ' align-left' : '';
          tooltip.className = `heat-reward-tooltip${alignClass}`;

          const tipHead = document.createElement('div');
          tipHead.className = 'heat-reward-tip-head';
          const tipTier = document.createElement('span');
          tipTier.className = 'heat-reward-tip-tier';
          tipTier.textContent = `HEAT ${milestone.heat} 최초 정복 보상`;
          const tipState = document.createElement('span');
          tipState.className = `heat-reward-tip-state${isClaimed ? ' done' : ''}`;
          tipState.textContent = isClaimed ? '지급 완료' : '미달성';
          tipHead.appendChild(tipTier);
          tipHead.appendChild(tipState);
          tooltip.appendChild(tipHead);

          const goldRow = document.createElement('div');
          goldRow.className = 'heat-reward-tip-row';
          const goldK = document.createElement('span');
          goldK.textContent = '보상 골드';
          const goldV = document.createElement('span');
          goldV.className = 'heat-reward-tip-gold';
          goldV.textContent = `+${Number(milestone.gold || 0).toLocaleString()} G`;
          goldRow.appendChild(goldK);
          goldRow.appendChild(goldV);
          tooltip.appendChild(goldRow);

          const titleRow = document.createElement('div');
          titleRow.className = 'heat-reward-tip-row';
          const titleK = document.createElement('span');
          titleK.textContent = '전용 칭호';
          titleRow.appendChild(titleK);
          titleRow.appendChild(createTitlePlateEl(milestone.titleId, null, 'sm'));
          tooltip.appendChild(titleRow);

          if (skinObj) {
            const skinRow = document.createElement('div');
            skinRow.className = 'heat-reward-tip-row';
            const skinK = document.createElement('span');
            skinK.textContent = '기체 스킨';
            const skinV = document.createElement('span');
            skinV.className = 'heat-reward-tip-skin';
            const sw = document.createElement('span');
            sw.className = 'heat-reward-tip-swatch';
            sw.style.background = skinObj.previewBg;
            const sn = document.createElement('span');
            sn.textContent = skinObj.name;
            skinV.appendChild(sw);
            skinV.appendChild(sn);
            skinRow.appendChild(skinK);
            skinRow.appendChild(skinV);
            tooltip.appendChild(skinRow);
          }

          rewardSlot.appendChild(pinBtn);
          rewardSlot.appendChild(tooltip);
          cell.appendChild(rewardSlot);
        } else {
          const spacer = document.createElement('div');
          spacer.className = 'heat-reward-spacer';
          spacer.setAttribute('aria-hidden', 'true');
          cell.appendChild(spacer);
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `heat-step-btn${isSelected ? ' active' : ''}${i >= 5 ? ' hot' : ''}${isCleared ? ' cleared' : ''}${isLocked ? ' locked' : ''}`;
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        btn.title = isLocked ? `위협 ${i - 1} 클리어 시 해금` : h.desc;
        btn.innerHTML = `
          ${isLocked ? '<span class="heat-step-badge">잠김</span>' : isCleared ? '<span class="heat-step-badge">완료</span>' : ''}
          <span class="heat-step-num">${h.level}</span>
          <span class="heat-step-name">${h.tier || ''}</span>
        `;
        btn.addEventListener('click', () => {
          if (isLocked) {
            lockedHeatFeedbackText = `위협 ${h.level} 단계는 위협 ${h.level - 1} 작전을 클리어해야 해금됩니다.`;
            updateMissionConfigUI();
            return;
          }
          lockedHeatFeedbackText = '';
          selectedHeatLevel = h.level;
          updateMissionConfigUI();
        });
        cell.appendChild(btn);
        deployHeatGrid.appendChild(cell);
      }
    }

    const statTier = byId('deploy-stat-tier');
    const statHp = byId('deploy-stat-hp');
    const statDmg = byId('deploy-stat-dmg');
    const statGold = byId('deploy-stat-gold');
    const debuffsEl = byId('deploy-heat-debuffs');
    const debuffsCountEl = byId('deploy-debuffs-count');
    const hintEl = byId('deploy-heat-hint');
    if (statTier) statTier.textContent = heat.label;
    if (statHp) statHp.textContent = `${Math.round(heat.enemyHpMult * 100)}%`;
    if (statDmg) statDmg.textContent = `${Math.round((heat.enemyDmgMult || 1.0) * 100)}%`;
    if (statGold) statGold.textContent = `${Math.round(heat.goldMult * 100)}%`;

    if (debuffsCountEl) {
      debuffsCountEl.textContent = heatProf.debuffs.length > 0 ? `${heatProf.debuffs.length}단계 누적 활성` : '제약 없음';
      debuffsCountEl.classList.toggle('hot', heatProf.debuffs.length >= 6);
    }
    if (debuffsEl) {
      debuffsEl.innerHTML = '';
      if (heatProf.debuffs.length === 0) {
        const emptyPill = document.createElement('div');
        emptyPill.className = 'deploy-debuff-empty';
        emptyPill.textContent = '표준 전장 프로토콜 — 추가 디버프 및 행동 제약이 적용되지 않습니다.';
        debuffsEl.appendChild(emptyPill);
      } else {
        for (let dIdx = 0; dIdx < heatProf.debuffs.length; dIdx++) {
          const db = heatProf.debuffs[dIdx];
          const chip = document.createElement('div');
          chip.className = `deploy-debuff-chip${db.level >= 9 ? ' severe' : db.level >= 5 ? ' high' : ''}`;
          chip.title = db.desc;
          const lvEl = document.createElement('span');
          lvEl.className = 'deploy-debuff-lv';
          lvEl.textContent = `T${db.level}`;
          const txtEl = document.createElement('span');
          txtEl.className = 'deploy-debuff-txt';
          txtEl.textContent = db.short || db.title;
          chip.appendChild(lvEl);
          chip.appendChild(txtEl);
          debuffsEl.appendChild(chip);
        }
      }
    }

    if (hintEl) {
      if (lockedHeatFeedbackText) {
        hintEl.textContent = lockedHeatFeedbackText;
        hintEl.classList.add('warn');
      } else if (maxUnlocked >= HEAT_CONTRACTS.length - 1) {
        hintEl.textContent = '모든 위협 단계(0~10)가 해금되었습니다. 원하는 난이도로 출격하세요.';
        hintEl.classList.remove('warn');
      } else {
        hintEl.textContent = `위협 ${maxUnlocked} 단계를 클리어하면 위협 ${maxUnlocked + 1} 단계가 해금됩니다.`;
        hintEl.classList.remove('warn');
      }
    }

    const loadoutEl = byId('deploy-loadout-text');
    if (loadoutEl) {
      const f = getEquippedFrame();
      loadoutEl.textContent = `${f.name} · ${f.defaultLoadoutLabel || 'M41-A 펄스 라이플 + W-01 용접 피스톨'}`;
    }
  }

  function saveMetaState() {
    try {
      const serialized = JSON.stringify(metaState);
      window.localStorage.setItem(META_STORAGE_KEY, serialized);
      _writeCookieBackup(META_STORAGE_KEY, serialized);
    } catch {}
  }
  function getEquippedLoadoutIndices() {
    const f = getEquippedFrame();
    const pIdx = Number.isInteger(f && f.defaultPrimaryIndex) ? f.defaultPrimaryIndex : 0;
    const sIdx = Number.isInteger(f && f.defaultSecondaryIndex) ? f.defaultSecondaryIndex : 4;
    return { primaryIndex: pIdx, secondaryIndex: sIdx };
  }

  function engageGameplayShortcutLock(requestFullscreen = false) {
    if (isTouchActive()) return;
    if (input) {
      input.lockGameplayShortcuts(requestFullscreen);
      return;
    }
    const lockKeys = () => {
      try {
        if (navigator.keyboard && typeof navigator.keyboard.lock === 'function') {
          const lkP = navigator.keyboard.lock([
            'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF',
            'KeyC', 'KeyV', 'KeyX', 'KeyP', 'ControlLeft', 'ControlRight',
            'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'Tab', 'Space',
            'Digit1', 'Digit2', 'Digit3', 'Digit4',
          ]);
          if (lkP && typeof lkP.catch === 'function') lkP.catch(() => {});
        }
      } catch {}
    };
    try {
      if (
        requestFullscreen &&
        document.documentElement &&
        !document.fullscreenElement &&
        typeof document.documentElement.requestFullscreen === 'function'
      ) {
        const fsP = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (fsP && typeof fsP.then === 'function') {
          fsP.then(() => lockKeys()).catch(() => {});
        }
      }
      lockKeys();
    } catch {}
  }

  function releaseGameplayShortcutLock(exitFullscreen = false, keepEscapeLocked = false) {
    if (input) {
      input.unlockGameplayShortcuts(exitFullscreen, keepEscapeLocked);
      return;
    }
    try {
      if (
        keepEscapeLocked &&
        !exitFullscreen &&
        document.fullscreenElement &&
        navigator.keyboard &&
        typeof navigator.keyboard.lock === 'function'
      ) {
        const lkEsc = navigator.keyboard.lock(['Escape']);
        if (lkEsc && typeof lkEsc.catch === 'function') lkEsc.catch(() => {});
      } else if (navigator.keyboard && typeof navigator.keyboard.unlock === 'function') {
        navigator.keyboard.unlock();
      }
      if (exitFullscreen && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        const exP = document.exitFullscreen();
        if (exP && typeof exP.catch === 'function') exP.catch(() => {});
      }
    } catch {}
  }

  function syncFullscreenUi() {
    const isFs = Boolean(typeof document !== 'undefined' && document.fullscreenElement);
    const statusText = isFs ? '전체화면' : '창 모드';
    const btnText = isFs ? '창 모드로 전환' : '전체화면 전환';
    if (titleFullscreenStatus) titleFullscreenStatus.textContent = statusText;
    if (pauseFullscreenStatus) pauseFullscreenStatus.textContent = statusText;
    if (btnTitleFullscreen) btnTitleFullscreen.textContent = btnText;
    if (btnPauseFullscreen) btnPauseFullscreen.textContent = btnText;
  }

  function toggleFullscreenMode() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen === 'function') {
        try { document.exitFullscreen().catch(() => {}); } catch {}
      }
    } else if (typeof document.documentElement.requestFullscreen === 'function') {
      try {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
          try { document.documentElement.requestFullscreen().catch(() => {}); } catch {}
        });
      } catch {}
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', () => {
      syncFullscreenUi();
      syncViewportUiScale();
      if (document.fullscreenElement && !isTouchActive()) {
        if (gameState === 'playing') {
          engageGameplayShortcutLock(false);
        } else if (gameState === 'paused' || gameState === 'upgrading') {
          releaseGameplayShortcutLock(false, true);
        }
      }
    });
  }

  window.addEventListener('beforeunload', (e) => {
    saveMetaState();
    saveSettingsState();
    if (gameState === 'playing' || gameState === 'upgrading') {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  window.addEventListener('pagehide', () => {
    saveMetaState();
    saveSettingsState();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveMetaState();
      saveSettingsState();
    }
  });

  let runCards = [];
  let draftChoices = [];

  let _visorEl = null;
  let _ultFlashEl = null;
  let _guardFillEl = null;
  let _guardTextEl = null;
  let _ultRingEl = null;
  let _ultDialEl = null;
  let _ultTextEl = null;
  let _frameBadgeEl = null;
  let _frameStatusEl = null;

  // Dedicated 3D Ultimate VFX Objects (Orbital Laser Pillars, Expanding Nova Spheres, Shockwave Rings, Bastion Fortress Dome)
  const _ult3dEffects = [];
  const _preloadedCardArt = [];
  (function preloadAllCardArt() {
    const srcs = [
      "./assets/card-tungsten_core.webp", "./assets/card-overclock_mag.webp",
      "./assets/card-precision_refund.webp", "./assets/card-thruster_tune.webp",
      "./assets/card-slide_reload.webp", "./assets/card-aerial_gunner.webp",
      "./assets/card-siphon_boost.webp", "./assets/card-beacon_resonance.webp",
      "./assets/card-reactive_armor.webp", "./assets/card-repulsor_slam.webp",
      "./assets/card-mark_contagion.webp", "./assets/card-thermal_nova.webp",
      "./assets/card-slide_overclock.webp", "./assets/card-shield_counter.webp",
      "./assets/card-field_medic.webp", "./assets/card-ult_accelerator.webp",
      "./assets/card-ult_overdrive.webp", "./assets/card-auto_forge.webp",
      "./assets/card-scavenger_protocol.webp", "./assets/card-shield_to_ult.webp",
    ];
    for (let i = 0; i < srcs.length; i++) {
      const img = new Image();
      img.decoding = 'sync';
      img.src = srcs[i];
      if (typeof img.decode === 'function') img.decode().catch(() => {});
      _preloadedCardArt.push(img);
    }
  })();
  let _hitstopTimer = 0;

  // === Dedicated 6-Step Interactive Tutorial Controller (Map 6: TutorialMapBuilder) ===
  const tutorialState = {
    active: false,
    step: 0,
    didDash: false,
    didJumpPad: false,
    didBarrel: false,
    killsInStep: 0,
    guardHoldSec: 0,
    pickedItem: false,
    autoUpgraded: false,
    enteredBeacon: false,
    usedUlt: false,
  };

  function updateTutorialBannerUI() {
    const banner = document.getElementById('tutorial-banner');
    if (!banner) return;
    if (!tutorialState.active || gameState !== 'playing') {
      banner.classList.add('hidden');
      return;
    }
    banner.classList.remove('hidden');
    const badge = document.getElementById('tut-step-badge');
    const title = document.getElementById('tut-step-title');
    const desc = document.getElementById('tut-step-desc');
    const goal = document.getElementById('tut-step-goal');
    const s = tutorialState.step;
    if (badge) badge.textContent = `단계 ${s} / 6`;

    if (s === 1) {
      if (title) title.textContent = '1. 기동 & 맵 오브젝트 (점프 패드 · 폭발 드럼통)';
      if (desc) desc.textContent = 'WASD로 이동하고 [Q]로 대시하세요. 서쪽 바닥의 점프 패드를 밟아 고지대로 도약하고, 중앙의 빨간 연료 드럼통을 사격해 폭파해 보세요.';
      if (goal) goal.textContent = `목표: 대시(${tutorialState.didDash ? '완료' : '0/1'}) · 점프패드(${tutorialState.didJumpPad ? '완료' : '0/1'}) · 드럼통 폭파(${tutorialState.didBarrel ? '완료' : '0/1'})`;
    } else if (s === 2) {
      if (title) title.textContent = '2. 무기 장단점 & 정조준 사격';
      if (desc) desc.textContent = '주무기별 특징이 다릅니다 — M41-A(균형), BR-12(근접강화·원거리 약화), HV-7(저격 2.6배·방패 중 사격불가), K-9(이속+12%·빠른 장전). [1]/[2]로 보조무기도 전환하며 북쪽 표적 2기를 처치하세요.';
      if (goal) goal.textContent = `목표: 북쪽 훈련 표적 처치 (${tutorialState.killsInStep} / 2)`;
    } else if (s === 3) {
      if (title) title.textContent = '3. [E] 전방 방패 & 맵 스폰 아이템';
      if (desc) desc.textContent = '적 처치 시 체력·방어력이 회복되지 않습니다! [E]를 길게 눌러 정면 탄환을 막고(방패 중 정조준 불가, 피격 시 균열 발생), 동쪽 패드에 스폰된 체력 키트·쉴드 셀·탄약 상자를 직접 먹어 회복하세요.';
      if (goal) goal.textContent = `목표: [E] 방패 전개(${tutorialState.guardHoldSec >= 0.8 ? '완료' : Math.round(tutorialState.guardHoldSec * 100) + '%'}) · 바닥 아이템 획득(${tutorialState.pickedItem ? '완료' : '0/1'})`;
    } else if (s === 4) {
      const curPriName = (weaponSystem && WEAPONS[weaponSystem.equippedPrimaryIndex] && WEAPONS[weaponSystem.equippedPrimaryIndex].shortName) || '기본 주무기';
      if (title) title.textContent = '4. 드랍 총기 교체 & 자동 업그레이드';
      if (desc) desc.textContent = '적이 떨어뜨린 다른 총기는 [F]로 교체하고, 지금 들고 있는 것과 "같은 총기"에 다가가면 자동으로 업그레이드(MK.II~)되며 외형과 탄환 이펙트가 진화합니다!';
      if (goal) goal.textContent = `목표: 앞에 떨어진 ${curPriName}에 다가가 자동 업그레이드 체험 (${tutorialState.autoUpgraded ? '완료' : '0/1'})`;
    } else if (s === 5) {
      if (title) title.textContent = '5. 테라-비콘 거점 & [X] 궁극기';
      if (desc) desc.textContent = '2스테이지부터 등장하는 중앙 테라-비콘 원형 구역 안에서 버티면 거점이 점령됩니다. 지금 궁극기 게이지를 100% 채워드렸으니 중앙 거점에 들어가 [X] 궁극기로 북쪽 분대를 섬멸하세요!';
      if (goal) goal.textContent = `목표: 중앙 거점 진입(${tutorialState.enteredBeacon ? '완료' : '0/1'}) · [X] 궁극기 발동(${tutorialState.usedUlt ? '완료' : '0/1'})`;
    } else if (s === 6) {
      if (title) title.textContent = '6. 스테이지 종료 전술 카드 강화';
      if (desc) desc.textContent = '매 스테이지가 끝나면 3장의 전술 카드 중 1장을 골라 기체를 강화합니다. 같은 태그(화력·기동·방어) 카드를 2장 모으면 강력한 시너지가 발동합니다!';
      if (goal) goal.textContent = '목표: 화면의 전술 카드 1장을 선택해 훈련 완료';
    }
  }

  function advanceTutorialStep(nextStep) {
    tutorialState.step = nextStep;
    if (nextStep === 2 && waveDirector && arenaData) {
      tutorialState.killsInStep = 0;
      if (typeof waveDirector.spawnTutorialEnemy === 'function') {
        waveDirector.spawnTutorialEnemy('rusher_drone', new THREE.Vector3(-4.5, 0.2, -13.5));
        waveDirector.spawnTutorialEnemy('tactical_trooper', new THREE.Vector3(4.5, 0.05, -14.5));
      }
    } else if (nextStep === 3 && playerController) {
      tutorialState.guardHoldSec = 0;
      tutorialState.pickedItem = false;
      // Slightly reduce shield so player can pick up the East Shield/Health pad!
      playerController.shield = Math.max(20, playerController.shield - 35);
      playerController.health = Math.max(40, playerController.health - 20);
      if (interactables && typeof interactables.spawnGoldDrop === 'function') {
        interactables.spawnGoldDrop(new THREE.Vector3(9.5, 0.2, 8.0), 30);
      }
    } else if (nextStep === 4 && interactables && playerController) {
      tutorialState.autoUpgraded = false;
      const base = playerController.position;
      const curPriIdx = weaponSystem ? weaponSystem.equippedPrimaryIndex : 0;
      const altPriIdx = (curPriIdx + 1) % 4;
      // Spawn matching equipped primary for auto-upgrade + alternate primary for [F] swap demo
      if (typeof interactables.spawnWeaponDrop === 'function') {
        interactables.spawnWeaponDrop(new THREE.Vector3(Math.max(-18, Math.min(18, base.x)), 0.2, Math.max(-18, base.z - 4.5)), curPriIdx);
        interactables.spawnWeaponDrop(new THREE.Vector3(Math.max(-18, Math.min(18, base.x + 3.2)), 0.2, Math.max(-18, base.z - 4.5)), altPriIdx);
      }
    } else if (nextStep === 5 && playerController && interactables && waveDirector) {
      tutorialState.enteredBeacon = false;
      tutorialState.usedUlt = false;
      playerController.ultCharge = 100;
      if (typeof interactables.setZoneActive === 'function') {
        interactables.setZoneActive(true);
      }
      if (typeof waveDirector.spawnTutorialEnemy === 'function') {
        waveDirector.spawnTutorialEnemy('tactical_trooper', new THREE.Vector3(-5.0, 0.05, -13.0));
        waveDirector.spawnTutorialEnemy('tactical_trooper', new THREE.Vector3(0.0, 0.05, -14.5));
        waveDirector.spawnTutorialEnemy('rusher_drone', new THREE.Vector3(5.0, 0.2, -13.0));
      }
    } else if (nextStep === 6) {
      if (typeof openUpgradeDraft === 'function') {
        openUpgradeDraft(1);
      }
    }
    updateTutorialBannerUI();
  }

  function finishTutorial(completed = false) {
    tutorialState.active = false;
    tutorialState.step = 0;
    const banner = document.getElementById('tutorial-banner');
    if (banner) banner.classList.add('hidden');
    if (completed) {
      metaState.tutorialDone = true;
      saveMetaState();
    }
    returnToTitle();
  }

  function startTutorialRun() {
    if (isTransitioning) return;
    closeWeaponInspector();
    unlockAudioOnGesture();
    if (soundEngine && typeof soundEngine.stopBgmHard === 'function') {
      soundEngine.stopBgmHard();
    }
    engageGameplayShortcutLock(true);

    runFadeTransition(
      () => {
        if (sceneTitle) sceneTitle.classList.add('hidden');
        if (sceneResult) {
          sceneResult.classList.add('hidden');
          sceneResult.classList.remove('victory', 'defeat');
        }
        if (pausePanel) pausePanel.classList.add('hidden');
        if (upgradePanel) upgradePanel.classList.add('hidden');
        if (scenePlaying) scenePlaying.classList.remove('hidden');

        const ok = ensureRuntimeInitialized();
        if (!ok) return;

        if (interactables) {
          interactables.dispose();
          interactables = null;
        }
        arenaData = mapManager.loadMap(6);
        interactables = new Interactables(engine.scene, collisionWorld, eventBus, arenaData);
        waveDirector.setArenaData(arenaData, interactables);
        hudManager.setArenaData(arenaData, collisionWorld);

        resetTelemetry();
        lastAdsFov = null;
        hadPointerLock = false;
        zoneAmmoRefilled = false;
        endingTimer = 0;
        endingIsVictory = false;
        endingFadeStarted = false;

        input.resetAll();
        input.setControlMode(settings.controlMode);
        if (settings.controlMode === 'auto') {
          input.setTouchMode(isCoarsePointer());
        }
        touchOverlay.reset();
        hudManager.reset();
        vfxManager.reset();
        waveDirector.reset();
        waveDirector.endlessMode = false;
        waveDirector.endlessLoop = 0;
        waveDirector.globalEnemyHpMult = 1.0;
        waveDirector.globalEnemyDmgMult = 1.0;
        waveDirector.globalEnemySpeedMult = 1.0;
        waveDirector.globalEliteChance = 0.22;
        waveDirector.globalSpawnIntervalMult = 1.0;
        runCards = [];
        draftChoices = [];
        if (upgradePanel) upgradePanel.classList.add('hidden');

        tutorialState.active = true;
        const { mods: startMods } = computePlayerMods();
        const { primaryIndex, secondaryIndex } = getEquippedLoadoutIndices();
        playerController.applyModifiers(startMods, true);
        playerController.reset(arenaData.playerSpawn.pos, arenaData.playerSpawn.yaw);
        weaponSystem.reset(primaryIndex, secondaryIndex);
        syncCosmeticsToWeaponSystem();
        lastWeaponState = weaponSystem.getCurrentWeaponState();

        engine.viewmodelScene.visible = true;
        engine.resize();
        engine.setFov(playerController.currentFov);
        engine.bakeStaticShadows();
        engine.prewarmShaders();

        hudManager.setVisible(true);
        gameState = 'playing';
        document.body.classList.add('playing-active');
        syncTouchOverlayVisibility();

        tutorialState.active = true;
        tutorialState.didDash = false;
        tutorialState.didJumpPad = false;
        tutorialState.didBarrel = false;
        tutorialState.killsInStep = 0;
        tutorialState.guardHoldSec = 0;
        tutorialState.pickedItem = false;
        tutorialState.autoUpgraded = false;
        tutorialState.enteredBeacon = false;
        tutorialState.usedUlt = false;
        advanceTutorialStep(1);

        eventBus.emit(EVENTS.GAME_STATE, { state: 'playing' });
        if (soundEngine && typeof soundEngine.setSceneMode === 'function') {
          soundEngine.setSceneMode('playing');
        }
        if (soundEngine && typeof soundEngine.setBgmTrack === 'function') {
          soundEngine.setBgmTrack('zone1_normal', true);
        }
        syncHudImmediate();
        engine.render();
        startLoop();
      },
      () => {
        if (gameState === 'playing' && runtimeReady && !isTouchActive()) {
          engageGameplayShortcutLock(false);
          input.requestPointerLock();
        }
      }
    );
  }
  let _bastionDomeGroup = null;

  function triggerUltScreenFlash(colorCss, opacity = 0.52) {
    ensureTacticalFrameHudOverlay();
    if (!_ultFlashEl) return;
    _ultFlashEl.style.background = `radial-gradient(circle, ${colorCss} 0%, transparent 72%)`;
    _ultFlashEl.style.opacity = String(opacity);
    _ultFlashEl.dataset.alpha = String(opacity);
  }

  function spawnUltBeamPillar(pos, colorHex) {
    if (!engine || !engine.scene) return;
    const g = new THREE.Group();
    g.position.set(pos.x, pos.y, pos.z);
    const outerGeo = new THREE.CylinderGeometry(1.25, 1.85, 44, 16, 1, true);
    const outerMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.y = 22;
    g.add(outer);

    const coreGeo = new THREE.CylinderGeometry(0.45, 0.72, 44, 12, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 22;
    g.add(core);

    const scorchGeo = new THREE.CircleGeometry(3.8, 24);
    scorchGeo.rotateX(-Math.PI * 0.5);
    const scorchMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const scorch = new THREE.Mesh(scorchGeo, scorchMat);
    scorch.position.y = 0.08;
    g.add(scorch);

    engine.scene.add(g);
    _ult3dEffects.push({ type: 'pillar', mesh: g, mats: [outerMat, coreMat, scorchMat], geos: [outerGeo, coreGeo, scorchGeo], age: 0, maxAge: 1.25 });
  }

  function spawnUltShockRing(pos, maxRadius, colorHex, maxAge = 0.85, tiltX = 0) {
    if (!engine || !engine.scene) return;
    const geo = new THREE.TorusGeometry(1.0, 0.14, 10, 36);
    geo.rotateX(Math.PI * 0.5 + tiltX);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, Math.max(0.25, pos.y + 0.35), pos.z);
    engine.scene.add(mesh);
    _ult3dEffects.push({ type: 'ring', mesh, mats: [mat], geos: [geo], age: 0, maxAge, maxRadius });
  }

  function spawnUltNovaSphere(pos, maxRadius, colorHex, maxAge = 1.05) {
    if (!engine || !engine.scene) return;
    const geo = new THREE.SphereGeometry(1.0, 20, 14);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 1.0, pos.z);
    engine.scene.add(mesh);
    _ult3dEffects.push({ type: 'sphere', mesh, mats: [mat], geos: [geo], age: 0, maxAge, maxRadius });
  }

  function updateUlt3dEffects(dt) {
    if (_ultFlashEl) {
      const a = parseFloat(_ultFlashEl.dataset.alpha || '0');
      if (a > 0.005) {
        const na = Math.max(0, a - dt * 1.35);
        _ultFlashEl.dataset.alpha = String(na);
        _ultFlashEl.style.opacity = String(na);
      }
    }
    // Bastion 3D Emerald Fortress Dome following player while ultInvulnTimer > 0
    if (playerController && playerController.ultInvulnTimer > 0 && engine && engine.scene) {
      if (!_bastionDomeGroup) {
        _bastionDomeGroup = new THREE.Group();
        const domeGeo = new THREE.SphereGeometry(2.65, 18, 12);
        const domeMat = new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0.22,
          wireframe: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        _bastionDomeGroup.add(new THREE.Mesh(domeGeo, domeMat));
        const eqGeo = new THREE.TorusGeometry(2.7, 0.08, 8, 32);
        eqGeo.rotateX(Math.PI * 0.5);
        const eqMat = new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        _bastionDomeGroup.add(new THREE.Mesh(eqGeo, eqMat));
        engine.scene.add(_bastionDomeGroup);
      }
      _bastionDomeGroup.visible = true;
      _bastionDomeGroup.position.set(playerController.position.x, playerController.position.y + 1.1, playerController.position.z);
      _bastionDomeGroup.rotation.y += dt * 1.8;
    } else if (_bastionDomeGroup) {
      _bastionDomeGroup.visible = false;
    }

    for (let i = _ult3dEffects.length - 1; i >= 0; i--) {
      const fx = _ult3dEffects[i];
      fx.age += dt;
      const t = Math.min(1, fx.age / fx.maxAge);
      if (fx.type === 'pillar') {
        const sc = 1.0 - t * 0.65;
        fx.mesh.scale.set(sc, 1.0, sc);
        fx.mats[0].opacity = 0.72 * (1 - t);
        fx.mats[1].opacity = 0.92 * (1 - t);
        if (fx.mats[2]) fx.mats[2].opacity = 0.65 * (1 - t);
      } else if (fx.type === 'ring') {
        const r = 1.0 + (fx.maxRadius - 1.0) * (1 - Math.pow(1 - t, 2.2));
        fx.mesh.scale.set(r, r, r);
        fx.mats[0].opacity = 0.92 * (1 - t);
      } else if (fx.type === 'sphere') {
        const r = 1.0 + (fx.maxRadius - 1.0) * (1 - Math.pow(1 - t, 2.5));
        fx.mesh.scale.setScalar(r);
        fx.mats[0].opacity = 0.58 * (1 - t);
      }
      if (fx.age >= fx.maxAge) {
        if (fx.mesh.parent) fx.mesh.parent.remove(fx.mesh);
        for (let g = 0; g < fx.geos.length; g++) fx.geos[g].dispose();
        for (let k = 0; k < fx.mats.length; k++) fx.mats[k].dispose();
        _ult3dEffects.splice(i, 1);
      }
    }
  }

  function ensureTacticalFrameHudOverlay() {
    if (!_visorEl) {
      _visorEl = document.createElement('div');
      _visorEl.id = 'frame-visor-overlay';
      _visorEl.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:12;transition:box-shadow 0.35s ease,border-color 0.35s ease;border:2px solid transparent;display:none;';
      document.body.appendChild(_visorEl);
    }
    if (!_ultFlashEl) {
      _ultFlashEl = document.createElement('div');
      _ultFlashEl.id = 'ult-screen-flash';
      _ultFlashEl.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:14;opacity:0;';
      document.body.appendChild(_ultFlashEl);
    }
    if (!_guardFillEl) _guardFillEl = document.getElementById('hud-guard-fill');
    if (!_guardTextEl) _guardTextEl = document.getElementById('hud-guard-val');
    if (!_ultRingEl) _ultRingEl = document.getElementById('hud-ult-ring');
    if (!_ultDialEl) _ultDialEl = document.getElementById('hud-ult-dial');
    if (!_ultTextEl) _ultTextEl = document.getElementById('hud-ult-val');
    if (!_frameBadgeEl) _frameBadgeEl = document.getElementById('hud-frame-badge');
    if (!_frameStatusEl) _frameStatusEl = document.getElementById('hud-frame-status');
  }

  function renderBuildSummaryInto(el) {
    if (!el) return;
    const { mods, tagCounts } = computePlayerMods();
    const statsHtml = `
      <div class="build-stat-grid">
        <div class="build-stat-item">화력 배율<strong>${Math.round(mods.damageMult * 100)}%</strong></div>
        <div class="build-stat-item">이동 속도<strong>${Math.round(mods.moveSpeedMult * 100)}%</strong></div>
        <div class="build-stat-item">방패 최대<strong>${mods.guardMax}</strong></div>
        <div class="build-stat-item">방패 충전<strong>${Math.round(mods.guardRegenMult * 100)}%</strong></div>
        <div class="build-stat-item">궁극기 충전<strong>${Math.round(mods.ultChargeMult * 100)}%</strong></div>
        <div class="build-stat-item">드랍 회복<strong>${Math.round(mods.dropHealMult * 100)}%</strong></div>
      </div>`;
    let synHtml = '<div class="build-syn-row">';
    for (const key of ['assault', 'mobility', 'vanguard', 'tactical']) {
      const s = SYNERGIES[key];
      const cnt = tagCounts[key] || 0;
      const tier = cnt >= 4 ? '4/4 최대' : cnt >= 2 ? '2/4 활성' : `${cnt}/2`;
      synHtml += `<span class="build-syn-pill ${cnt >= 2 ? 'active' : ''}" style="border-left:3px solid ${s.color}">${s.tagLabel} ${tier}</span>`;
    }
    for (let i = 0; i < CROSS_SYNERGIES.length; i++) {
      const csyn = CROSS_SYNERGIES[i];
      const ok = csyn.requires.every((r) => (tagCounts[r] || 0) >= 2);
      if (ok) synHtml += `<span class="build-syn-pill active">${csyn.name}</span>`;
    }
    synHtml += '</div>';

    let cardsHtml = '<div class="build-card-list">';
    if (runCards.length === 0) {
      cardsHtml += '<span style="opacity:0.65;">아직 획득한 전술 카드가 없습니다.</span>';
    } else {
      for (let i = 0; i < runCards.length; i++) {
        const entry = runCards[i];
        const card = typeof entry === 'string' ? TACTICAL_CARDS.find((c) => c.id === entry) : entry;
        if (!card) continue;
        const s = SYNERGIES[card.tag] || SYNERGIES.assault;
        cardsHtml += `<span class="build-card-chip" style="border-left-color:${s.color}" title="${card.desc}">[${s.tagLabel}] ${card.name}</span>`;
      }
    }
    cardsHtml += '</div>';
    el.innerHTML = statsHtml + synHtml + cardsHtml;
  }

  // [TAB] Hold Live Build Inspector
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' && gameState === 'playing') {
      e.preventDefault();
      const ov = document.getElementById('tab-build-overlay');
      const ct = document.getElementById('tab-build-content');
      if (ov && ct) {
        renderBuildSummaryInto(ct);
        ov.classList.remove('hidden');
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Tab') {
      const ov = document.getElementById('tab-build-overlay');
      if (ov) ov.classList.add('hidden');
    }
  });

  function updateTacticalFrameHudOverlay(pSnap, mods) {
    ensureTacticalFrameHudOverlay();
    const visible = gameState === 'playing' && pSnap && pSnap.isAlive;
    if (_visorEl) _visorEl.style.display = visible ? 'block' : 'none';
    if (!visible) return;

    const fid = (mods && mods.frameId) || 'vanguard';
    const vCol = (mods && mods.visorColor) || 'rgba(245, 158, 11, 0.24)';
    const fCol = (mods && mods.frameColor) || '#f59e0b';
    const spread = fid === 'bastion' ? '52px' : fid === 'strider' ? '26px' : '38px';
    const activeGlow =
      pSnap.ultActiveTimer > 0
        ? `inset 0 0 95px ${fCol}`
        : pSnap.isGuarding
        ? `inset 0 0 60px rgba(56, 189, 248, 0.35)`
        : `inset 0 0 ${spread} ${vCol}`;
    if (_visorEl) {
      _visorEl.style.boxShadow = activeGlow;
      _visorEl.style.borderColor =
        fid === 'bastion'
          ? 'rgba(34,197,94,0.42)'
          : fid === 'apex'
          ? 'rgba(239,68,68,0.38)'
          : fid === 'strider'
          ? 'rgba(56,189,248,0.36)'
          : 'rgba(245,158,11,0.22)';
    }

    if (_guardFillEl && _guardTextEl) {
      const gPct = Math.max(0, Math.min(100, Math.round((pSnap.guardEnergy / Math.max(1, pSnap.maxGuardEnergy)) * 100)));
      const isRegening = Boolean(
        pSnap.isOutOfCombat &&
        !pSnap.isGuarding &&
        pSnap.guardBreakTimer <= 0 &&
        pSnap.guardEnergy < pSnap.maxGuardEnergy - 0.5
      );
      _guardFillEl.style.width = gPct + '%';
      _guardFillEl.style.background =
        pSnap.guardBreakTimer > 0
          ? 'linear-gradient(90deg,#dc2626,#ef4444)'
          : fid === 'bastion'
          ? 'linear-gradient(90deg,#16a34a,#4ade80)'
          : 'linear-gradient(90deg,#0284c7,#38bdf8)';
      _guardTextEl.textContent =
        pSnap.guardBreakTimer > 0
          ? '파괴됨'
          : pSnap.isGuarding
          ? `방어 ${gPct}%`
          : isRegening
          ? `재생 ${gPct}%`
          : gPct + '%';
    }

    if (_ultRingEl && _ultTextEl) {
      const uPct = Math.max(0, Math.min(100, Math.round(pSnap.ultCharge || 0)));
      const visualPct = pSnap.ultActiveTimer > 0 ? 100 : uPct;
      const circ = 220;
      _ultRingEl.style.strokeDashoffset = String((circ * (1 - visualPct / 100)).toFixed(1));
      _ultRingEl.style.stroke =
        pSnap.ultActiveTimer > 0 ? '#4ade80' : uPct >= 100 ? '#f43f5e' : fCol;
      _ultTextEl.textContent = pSnap.ultActiveTimer > 0 ? '가동' : uPct >= 100 ? '완충' : uPct + '%';
      if (_ultDialEl) {
        _ultDialEl.classList.toggle('ult-ready', uPct >= 100 && pSnap.ultActiveTimer <= 0);
      }
    }
    if (_frameBadgeEl && _frameStatusEl) {
      _frameBadgeEl.textContent = (mods && mods.frameName) || 'VANGUARD-09';
      const isGuardRegen = Boolean(
        pSnap.isOutOfCombat &&
        !pSnap.isGuarding &&
        pSnap.guardBreakTimer <= 0 &&
        pSnap.guardEnergy < pSnap.maxGuardEnergy - 0.5
      );
      _frameStatusEl.textContent =
        pSnap.ultActiveTimer > 0
          ? '궁극기 가동!'
          : pSnap.isGuarding
          ? '방패 전개 중'
          : pSnap.guardBreakTimer > 0
          ? '방패 복구 대기'
          : isGuardRegen
          ? '방패 재생 중'
          : '전술 대기';
    }
  }

  function computePlayerMods() {
    const lv = metaState.levels;
    const frame = getEquippedFrame();
    const mods = {
      frameId: frame.id,
      frameName: frame.name,
      frameColor: frame.color || '#f59e0b',
      visorColor: frame.visorColor || 'rgba(245, 158, 11, 0.24)',
      baseFov: Math.max(65, Math.min(118, (settings.fov || 80) + ((frame.baseFov || 80) - 80))),
      dashMax: frame.dashMax || 2,
      tacticalReload: Boolean(frame.tacticalReload),
      phaseBlink: Boolean(frame.phaseBlink),
      lowGravity: Boolean(frame.lowGravity),
      dashSlam: Boolean(frame.dashSlam),
      apexOverdrive: Boolean(frame.apexOverdrive),
      chainLightning: Boolean(frame.chainLightning),
      guardMax: frame.guardMax || 100,
      guardCostMult: frame.guardCostMult || 1.0,
      ultName: frame.ultName || '',
      damageMult: (1.0 + (lv.firepower || 0) * 0.04) * (frame.dmgMult || 1.0),
      headshotBonus: (lv.crit || 0) * 0.08,
      reloadSpeedMult: 1.0 + (lv.reload || 0) * 0.05,
      fireRateMult: 1.0 + (lv.reload || 0) * 0.02,
      moveSpeedMult: (1.0 + (lv.thruster || 0) * 0.025) * (frame.speedMult || 1.0),
      dashCooldownMult: Math.max(0.42, (1.0 - (lv.thruster || 0) * 0.045) * (frame.dashCdMult || 1.0)),
      shieldRegenMult: 1.0 + (lv.shield || 0) * 0.08,
      passiveShieldRegenRate: (PLAYER_CONFIG.shieldRegenRate || 0) + (lv.shield || 0) * 1.4,
      killShieldBonus: (lv.siphon || 0) * 3,
      maxHealthBonus: (lv.hull || 0) * 12 + (frame.hpBonus || 0),
      maxShieldBonus: (lv.shield || 0) * 12 + (frame.shieldBonus || 0),
      salvageGoldMult: 1.0 + (lv.salvage || 0) * 0.08,
      killAmmoRefund: 0,
      slideReload: false,
      airDamageBonus: frame.airBonus || 0.0,
      zoneRegenHp: 0,
      zoneDamageBonus: 0.0,
      reactiveArmor: false,
      repulsorSlam: false,
      markContagion: false,
      thermalNova: false,
      slideOverclock: false,
      armorPiercer: false,
      orbitalOverload: false,
      voidBreakerMult: 1.0,
      gravityThruster: false,
      synergyAssault: false,
      synergyMobility: false,
      synergyVanguard: false,
    };

    mods.guardRegenMult = 1.0 + (lv.shield || 0) * 0.08;
    mods.ultChargeMult = 1.0;
    mods.ultDamageBonus = 1.0;
    mods.ultDurationBonus = 0;
    mods.dropHealMult = 1.0;
    mods.shieldCounter = false;
    mods.shieldToUlt = false;
    mods.autoForgeBonus = 0;
    mods.killGuardBonus = 0;
    mods.synergyTactical = false;
    mods.synergyAssault4 = false;
    mods.synergyMobility4 = false;
    mods.synergyVanguard4 = false;
    mods.synergyTactical4 = false;
    mods.crossHyperBarrage = false;
    mods.crossAegisConverter = false;

    const tagCounts = { assault: 0, mobility: 0, vanguard: 0, tactical: 0 };
    for (let i = 0; i < runCards.length; i++) {
      const card = runCards[i];
      if (tagCounts[card.tag] !== undefined) tagCounts[card.tag]++;
      switch (card.id) {
        case 'tungsten_core': mods.damageMult *= 1.18; break;
        case 'overclock_mag': mods.reloadSpeedMult *= 1.3; mods.fireRateMult *= 1.12; break;
        case 'precision_refund': mods.headshotBonus += 0.4; mods.killAmmoRefund += 3; break;
        case 'thruster_tune': mods.moveSpeedMult *= 1.12; mods.dashCooldownMult *= 0.75; break;
        case 'slide_reload': mods.slideReload = true; break;
        case 'aerial_gunner': mods.airDamageBonus += 0.28; break;
        case 'siphon_boost': mods.maxShieldBonus += 25; mods.guardMax += 40; mods.guardRegenMult += 0.30; break;
        case 'beacon_resonance': mods.zoneRegenHp += 7; mods.zoneDamageBonus += 0.2; break;
        case 'reactive_armor': mods.reactiveArmor = true; break;
        case 'repulsor_slam': mods.repulsorSlam = true; break;
        case 'mark_contagion': mods.markContagion = true; break;
        case 'thermal_nova': mods.thermalNova = true; break;
        case 'slide_overclock': mods.slideOverclock = true; break;
        case 'armor_piercer':
          mods.damageMult *= 1.14;
          mods.headshotBonus += 0.35;
          mods.armorPiercer = true;
          break;
        case 'aegis_capacitor':
          mods.maxHealthBonus += 35;
          mods.maxShieldBonus += 35;
          mods.guardCostMult = Math.max(0.25, mods.guardCostMult * 0.78);
          break;
        case 'kinetic_momentum':
          mods.killGuardBonus += 10;
          mods.moveSpeedMult *= 1.12;
          mods.dashCooldownMult *= 0.82;
          mods.killAmmoRefund += 3;
          break;
        case 'orbital_overload':
          mods.fireRateMult *= 1.16;
          mods.orbitalOverload = true;
          break;
        case 'shield_counter':
          mods.shieldCounter = true;
          mods.guardMax += 35;
          break;
        case 'field_medic':
          mods.dropHealMult += 0.55;
          mods.guardRegenMult += 0.35;
          break;
        case 'ult_accelerator':
          mods.ultChargeMult += 0.40;
          break;
        case 'ult_overdrive':
          mods.ultDamageBonus += 0.45;
          mods.ultDurationBonus += 2.0;
          break;
        case 'auto_forge':
          mods.autoForgeBonus += 0.12;
          mods.reloadSpeedMult += 0.18;
          break;
        case 'scavenger_protocol':
          mods.salvageGoldMult += 0.30;
          mods.dropHealMult += 0.25;
          mods.ultChargeMult += 0.15;
          break;
        case 'shield_to_ult':
          mods.shieldToUlt = true;
          break;
        case 'void_breaker':
          mods.voidBreakerMult = (mods.voidBreakerMult || 1.0) * 1.24;
          break;
        case 'gravity_thruster':
          mods.gravityThruster = true;
          mods.dashCooldownMult *= 0.88;
          break;
      }
    }

    mods.synergyAssault = tagCounts.assault >= 2;
    mods.synergyMobility = tagCounts.mobility >= 2;
    mods.synergyVanguard = tagCounts.vanguard >= 2;
    mods.synergyTactical = tagCounts.tactical >= 2;
    if (mods.synergyVanguard) {
      mods.guardMax = Math.round(mods.guardMax * 1.40);
      mods.guardRegenMult += 0.30;
    }
    if (mods.synergyTactical) {
      mods.ultChargeMult += 0.30;
      mods.dropHealMult += 0.25;
    }
    if (tagCounts.assault >= 4) { mods.synergyAssault4 = true; mods.damageMult *= 1.25; }
    if (tagCounts.mobility >= 4) { mods.synergyMobility4 = true; mods.moveSpeedMult *= 1.18; mods.dashCooldownMult *= 0.70; }
    if (tagCounts.vanguard >= 4) { mods.synergyVanguard4 = true; }
    if (tagCounts.tactical >= 4) { mods.synergyTactical4 = true; }
    if (tagCounts.assault >= 2 && tagCounts.mobility >= 2) { mods.crossHyperBarrage = true; }
    if (tagCounts.vanguard >= 2 && tagCounts.tactical >= 2) {
      mods.crossAegisConverter = true;
      mods.guardCostMult = Math.max(0.25, mods.guardCostMult * 0.75);
    }

    // Cumulative Threat Stage Debuffs & Action Constraints OR Weekday Special Ops Rules
    mods.spreadMult = 1.0;
    mods.healEfficiencyMult = 1.0;
    mods.disableDoubleJump = false;
    mods.disableSprint = false;
    mods.disableSlide = false;
    mods.dashCap = null;
    if (!tutorialState.active && selectedMissionMode === 'daily') {
      const dm = getTodayDailyModifier();
      if (dm.speedMult) mods.moveSpeedMult *= dm.speedMult;
      if (dm.dashCdMult) mods.dashCooldownMult *= dm.dashCdMult;
      if (dm.reloadMult) mods.reloadSpeedMult *= dm.reloadMult;
      if (dm.fireRateMult) mods.fireRateMult *= dm.fireRateMult;
      if (dm.headshotBonus) mods.headshotBonus += dm.headshotBonus;
      if (dm.spreadMult) mods.spreadMult *= dm.spreadMult;
      if (dm.dmgMult) mods.damageMult *= dm.dmgMult;
      if (dm.airBonus) mods.airDamageBonus += dm.airBonus;
      if (dm.killShield) mods.killShieldBonus += dm.killShield;
      if (dm.dropHealMult) mods.dropHealMult *= dm.dropHealMult;
      if (dm.hpBonus) mods.maxHealthBonus += dm.hpBonus;
      if (dm.shieldBonus) mods.maxShieldBonus += dm.shieldBonus;
      if (dm.shieldPenalty) mods.maxShieldBonus -= dm.shieldPenalty;
      if (dm.ultChargeMult) mods.ultChargeMult *= dm.ultChargeMult;
      if (dm.guardCostMult) mods.guardCostMult *= dm.guardCostMult;
      if (dm.dashBonus) mods.dashMax = Math.min(3, (mods.dashMax || 2) + dm.dashBonus);
    } else if (!tutorialState.active && selectedMissionMode !== 'daily') {
      const hp = getCumulativeHeatProfile(selectedHeatLevel);
      mods.reloadSpeedMult *= hp.reloadMult;
      mods.dashCooldownMult *= hp.dashCooldownMult;
      mods.guardCostMult *= hp.guardCostMult;
      mods.spreadMult = hp.spreadMult;
      mods.healEfficiencyMult = hp.healEfficiencyMult;
      mods.maxShieldBonus -= hp.shieldPenalty;
      mods.ultChargeMult *= hp.ultChargeMult;
      mods.killShieldBonus = Math.round(mods.killShieldBonus * hp.healEfficiencyMult);
      mods.zoneRegenHp *= hp.healEfficiencyMult;
      if (hp.disableDoubleJump) mods.disableDoubleJump = true;
      if (hp.disableSprint) mods.disableSprint = true;
      if (hp.disableSlide) mods.disableSlide = true;
      if (typeof hp.dashCap === 'number') {
        mods.dashCap = hp.dashCap;
        mods.dashMax = Math.min(mods.dashMax || 2, hp.dashCap);
      }
    }
    return { mods, tagCounts };
  }

  function getActiveSynergiesList() {
    const { mods } = computePlayerMods();
    const list = [];
    if (mods.synergyAssault) list.push(SYNERGIES.assault);
    if (mods.synergyMobility) list.push(SYNERGIES.mobility);
    if (mods.synergyVanguard) list.push(SYNERGIES.vanguard);
    if (mods.synergyTactical) list.push(SYNERGIES.tactical);
    return list;
  }

  function computeSpentArmoryGold() {
    let spent = 0;
    for (let i = 0; i < META_UPGRADES.length; i++) {
      const upg = META_UPGRADES[i];
      const lv = Math.max(0, Math.min(upg.maxLevel, metaState.levels[upg.id] || 0));
      for (let k = 0; k < lv; k++) {
        spent += upg.baseCost + k * upg.costStep;
      }
    }
    return spent;
  }

  function clearArmoryResetConfirm() {
    armoryResetConfirmPending = false;
    if (armoryResetConfirmTimer) {
      window.clearTimeout(armoryResetConfirmTimer);
      armoryResetConfirmTimer = null;
    }
  }

  function updateArmoryResetBtnUI() {
    if (!btnArmoryReset) return;
    const spent = computeSpentArmoryGold();
    btnArmoryReset.disabled = spent <= 0;
    btnArmoryReset.classList.toggle('confirming', armoryResetConfirmPending && spent > 0);
    if (spent <= 0) {
      btnArmoryReset.textContent = '스탯 초기화 (0 G)';
    } else if (armoryResetConfirmPending) {
      btnArmoryReset.textContent = `다시 클릭: +${spent} G 전액 환급`;
    } else {
      btnArmoryReset.textContent = `스탯 초기화 (+${spent} G 환급)`;
    }
  }

  function renderArmoryUI() {
    if (titleGoldBadge) titleGoldBadge.textContent = `${Number(metaState.gold || 0).toLocaleString()} G`;
    if (armoryGoldAmount) armoryGoldAmount.textContent = `${Number(metaState.gold || 0).toLocaleString()} G`;
    updateArmoryResetBtnUI();
    const eqFrame = getEquippedFrame();
    const unitBadge = byId('title-unit-badge');
    if (unitBadge) unitBadge.textContent = eqFrame.name;
    const pauseKicker = byId('pause-unit-kicker');
    if (pauseKicker) pauseKicker.textContent = `${eqFrame.name} 전술 터미널`;

    if (armoryGrid) {
      armoryGrid.innerHTML = '';
      const ARMORY_ICONS = {
        firepower: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
        hull: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z"/></svg>',
        shield: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>',
        thruster: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h8l-1 8 11-12h-8l0-8z"/></svg>',
        reload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
        crit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
        siphon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
        salvage: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.5-1 1.5-2.5 1.5-2.5.6-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5"/></svg>',
      };

      for (let i = 0; i < META_UPGRADES.length; i++) {
        const upg = META_UPGRADES[i];
        const lv = metaState.levels[upg.id] || 0;
        const isMax = lv >= upg.maxLevel;
        const cost = upg.baseCost + lv * upg.costStep;
        const ico = ARMORY_ICONS[upg.id] || ARMORY_ICONS.hull;
        let pipsHtml = '';
        for (let p = 0; p < upg.maxLevel; p++) {
          pipsHtml += `<span class="armory-pip ${p < lv ? 'filled' : ''}"></span>`;
        }
        const curBonusText = typeof upg.formatBonus === 'function' ? upg.formatBonus(lv) : `${lv}단계`;

        const card = document.createElement('div');
        card.className = 'armory-item';
        card.innerHTML = `
          <div class="armory-item-head">
            <div class="armory-item-title-wrap">
              <span class="armory-ico-badge" aria-hidden="true">${ico}</span>
              <span class="armory-item-name">${upg.name}</span>
            </div>
            <span class="armory-item-lv">${lv} / ${upg.maxLevel}단계</span>
          </div>
          <div class="armory-pips" aria-hidden="true">${pipsHtml}</div>
          <div class="armory-cur-bonus">현재 적용: ${curBonusText}</div>
          <p class="armory-item-desc">${upg.desc}</p>
          <button class="mil-btn armory-buy-btn" type="button" ${isMax || metaState.gold < cost ? 'disabled' : ''}>
            ${isMax ? '최대 강화 완료' : `강화 (${cost} G)`}
          </button>
        `;
        const btn = card.querySelector('button');
        if (btn && !isMax) {
          btn.addEventListener('click', () => {
            if (metaState.gold < cost || (metaState.levels[upg.id] || 0) >= upg.maxLevel) return;
            metaState.gold -= cost;
            metaState.levels[upg.id] = (metaState.levels[upg.id] || 0) + 1;
            saveMetaState();
            renderArmoryUI();
          });
        }
        armoryGrid.appendChild(card);
      }
    }

    // Render Pilot Frame Shop Grid (4 Real Robot Concept Art Portraits)
    const framesGrid = byId('frames-shop-grid');
    if (framesGrid) {
      framesGrid.innerHTML = '';
      for (let i = 0; i < PILOT_FRAMES.length; i++) {
        const f = PILOT_FRAMES[i];
        const owned = metaState.ownedFrames.includes(f.id);
        const equipped = metaState.equippedFrame === f.id;
        const canBuy = !owned && metaState.gold >= f.cost;
        const artSrc = (PILOT_FRAME_ART && PILOT_FRAME_ART[f.id]) || '';
        const hpVal = 100 + (f.hpBonus || 0);
        const shVal = 100 + (f.shieldBonus || 0);
        const spdPct = Math.round((f.speedMult || 1.0) * 100);

        const card = document.createElement('article');
        card.className = `frame-showcase-card ${equipped ? 'equipped' : ''}`;
        card.style.setProperty('--frame-accent', f.color);
        card.innerHTML = `
          <div class="frame-portrait-wrap">
            <img class="frame-portrait-img" src="${artSrc}" alt="${f.name} 기체 일러스트" />
            <div class="frame-portrait-scrim"></div>
            <span class="frame-tier-pill">${f.tier}</span>
          </div>
          <div class="frame-card-body">
            <h3 class="frame-card-name" style="color:${f.color}">${f.name}</h3>
            <div class="frame-stat-chips">
              <div class="frame-stat-chip"><span>체력</span>${hpVal}</div>
              <div class="frame-stat-chip"><span>쉴드</span>${shVal}</div>
              <div class="frame-stat-chip"><span>대시</span>${f.dashMax}회</div>
              <div class="frame-stat-chip"><span>속도</span>${spdPct}%</div>
            </div>
            <div class="frame-special-box">
              <strong>기본 무장 · ${f.defaultLoadoutLabel || 'M41-A + W-01'}</strong>
              <strong style="margin-top:4px;display:block;">특수능력 · ${f.specialName}</strong>
              ${f.specialDesc}<br><span style="color:#fde68a;font-size:0.86em;">궁극기: ${f.ultName || ''} — ${f.ultDesc || ''}</span>
            </div>
            <button class="mil-btn armory-buy-btn" type="button" ${!owned && !canBuy ? 'disabled' : ''}>
              ${equipped ? '현재 장착 중' : owned ? '기체 장착' : `구매 (${f.cost} G)`}
            </button>
          </div>
        `;
        const btn = card.querySelector('button');
        if (btn && !equipped) {
          btn.addEventListener('click', () => {
            if (owned) {
              metaState.equippedFrame = f.id;
              saveMetaState();
              renderArmoryUI();
            } else if (metaState.gold >= f.cost) {
              metaState.gold -= f.cost;
              metaState.ownedFrames.push(f.id);
              metaState.equippedFrame = f.id;
              saveMetaState();
              renderArmoryUI();
            }
          });
        }
        framesGrid.appendChild(card);
      }
    }

    renderTitleBadgeUI();
    renderCosmeticsTab();
  }

  // ---------------------------------------------------------------------------
  // 1.7. Titles, 1P Frame Skins, Daily Quests, Attendance Streak, Mastery & Leaderboard
  // ---------------------------------------------------------------------------
  let activeLeaderboardMode = 'campaign';
  let lastRunRecordPayload = null;
  let attendanceAutoShownThisSession = false;

  const TITLE_EMBLEM_SVG = Object.freeze({
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l7-6 7 6"/><path d="M5 19l7-6 7 6"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>',
    scatter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12h6"/><path d="M13 7l6-3"/><path d="M13 12h7"/><path d="M13 17l6 3"/><circle cx="10" cy="12" r="1.8" fill="currentColor"/></svg>',
    rail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M2 12h20"/><path d="M15 6l6 6-6 6"/><path d="M6 8v8"/></svg>',
    smg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L4 14h6l-1 7 9-11h-6l1-7z"/></svg>',
    weld: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c2.5 3.2 6 6.1 6 10.2A6 6 0 1 1 6 12.2C6 9.3 7.6 6.8 9.2 5c.3 2 1.4 3.2 2.8 3.2 0-2.1-.6-4.1 0-6.2z"/></svg>',
    arc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2L5 13h6l-1 9 9-11h-6l1-9z"/></svg>',
    repulsor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M4.6 4.6a10.5 10.5 0 0 0 0 14.8"/><path d="M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/></svg>',
    heat3: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>',
    heat5: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 6.5L22 12l-7 3.5L12 22l-3-6.5L2 12l7-3.5L12 2z"/></svg>',
    heat7: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    heat10: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18l2-10 4.5 4L12 5l2.5 7L19 8l2 10H3z"/><path d="M5 21h14"/></svg>',
    streak3: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l8-5 8 5"/><path d="M4 12l8-5 8 5"/><path d="M4 7l8-4 8 4"/></svg>',
    streak7: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.7 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/></svg>',
    endless: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.2 8.2a4.3 4.3 0 0 1 0 7.6c-2.6 1.5-5.2-1.8-6.2-3.8-1-2-3.6-5.3-6.2-3.8a4.3 4.3 0 0 0 0 7.6c2.6 1.5 5.2-1.8 6.2-3.8 1-2 3.6-5.3 6.2-3.8z"/></svg>',
  });

  function getTitleObjById(titleId) {
    return PLAYER_TITLES.find((t) => t.id === titleId) || PLAYER_TITLES[0];
  }

  function createTitlePlateEl(titleId, overrideLabel = null, size = 'md') {
    const tObj = getTitleObjById(titleId);
    const sizeCls = size === 'sm' ? ' title-plate--sm' : size === 'lg' ? ' title-plate--lg' : '';
    const plate = document.createElement('span');
    plate.className = `title-plate title-plate--${tObj.id}${sizeCls}`;

    const emblem = document.createElement('span');
    emblem.className = 'title-plate-emblem';
    emblem.setAttribute('aria-hidden', 'true');
    emblem.innerHTML = TITLE_EMBLEM_SVG[tObj.icon] || TITLE_EMBLEM_SVG.chevron;

    const text = document.createElement('span');
    text.className = 'title-plate-text';
    text.textContent = overrideLabel ? String(overrideLabel).slice(0, 28) : tObj.label;

    plate.appendChild(emblem);
    plate.appendChild(text);
    return plate;
  }

  function getEquippedTitleObj() {
    return getTitleObjById(metaState.equippedTitle);
  }

  function renderTitleBadgeUI() {
    const titleObj = getEquippedTitleObj();
    if (titlePilotCallsign) {
      titlePilotCallsign.textContent = metaState.callsign || 'PILOT';
    }
    const targets = [
      { el: titleEquippedTitleBadge, size: 'md' },
      { el: byId('lb-equipped-title'), size: 'md' },
      { el: byId('result-rank-title-badge'), size: 'md' },
    ];
    for (let i = 0; i < targets.length; i++) {
      const slot = targets[i].el;
      if (!slot) continue;
      slot.textContent = '';
      slot.appendChild(createTitlePlateEl(titleObj.id, null, targets[i].size));
    }
  }

  function syncCosmeticsToWeaponSystem() {
    if (!runtimeReady || !weaponSystem) return;
    if (typeof weaponSystem.setWeaponSkins === 'function') {
      weaponSystem.setWeaponSkins(metaState.equippedWeaponSkins || {});
    }
    const fid = (playerController && playerController.mods && playerController.mods.frameId) || metaState.equippedFrame || 'vanguard';
    const skinCfg = FRAME_SKINS.find((sk) => sk.id === metaState.equippedFrameSkin) || FRAME_SKINS[0];
    if (typeof weaponSystem.setPilotFrameStyle === 'function') {
      weaponSystem.setPilotFrameStyle(fid, skinCfg);
    }
    telemetry._appliedFrameVisual = `${fid}:${skinCfg.id}`;
  }

  function unlockTitle(titleId, recordRunReward = false) {
    if (!titleId || metaState.unlockedTitles.includes(titleId)) return false;
    const tObj = PLAYER_TITLES.find((t) => t.id === titleId);
    if (!tObj) return false;
    metaState.unlockedTitles.push(titleId);
    saveMetaState();
    renderTitleBadgeUI();
    renderCosmeticsTab();
    if (recordRunReward && Array.isArray(telemetry.runUnlockedRewards)) {
      telemetry.runUnlockedRewards.push(`칭호 [${tObj.label}]`);
    }
    if (eventBus) {
      eventBus.emit(EVENTS.ANNOUNCEMENT, {
        kicker: '새 칭호 해금',
        title: `[${tObj.label}]`,
        subtitle: tObj.desc,
        duration: 3.2,
      });
    }
    return true;
  }

  function unlockFrameSkin(skinId, recordRunReward = false) {
    if (!skinId || metaState.unlockedFrameSkins.includes(skinId)) return false;
    const sk = FRAME_SKINS.find((s) => s.id === skinId);
    if (!sk) return false;
    metaState.unlockedFrameSkins.push(skinId);
    saveMetaState();
    renderCosmeticsTab();
    if (recordRunReward && Array.isArray(telemetry.runUnlockedRewards)) {
      telemetry.runUnlockedRewards.push(`기체 스킨 [${sk.name}]`);
    }
    return true;
  }

  function checkHeatMilestoneRewards(clearedHeatLevel) {
    const h = Math.max(0, Math.floor(Number(clearedHeatLevel) || 0));
    for (let i = 0; i < HEAT_MILESTONE_REWARDS.length; i++) {
      const m = HEAT_MILESTONE_REWARDS[i];
      if (h < m.heat) continue;
      if (metaState.claimedHeatMilestones[String(m.heat)]) continue;
      metaState.claimedHeatMilestones[String(m.heat)] = true;
      metaState.gold += m.gold || 0;
      telemetry.runUnlockedRewards.push(`${m.label} (+${m.gold} G)`);
      unlockTitle(m.titleId, true);
      unlockFrameSkin(m.frameSkinId, true);
      saveMetaState();
      if (titleGoldBadge) titleGoldBadge.textContent = `${metaState.gold} G`;
    }
  }

  function renderCosmeticsTab() {
    const titlesGrid = byId('titles-equip-grid');
    if (titlesGrid) {
      titlesGrid.innerHTML = '';
      for (let i = 0; i < PLAYER_TITLES.length; i++) {
        const t = PLAYER_TITLES[i];
        const unlocked = metaState.unlockedTitles.includes(t.id);
        const equipped = metaState.equippedTitle === t.id;
        const card = document.createElement('div');
        card.className = `title-chip-card${equipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;

        const topWrap = document.createElement('div');
        const previewWrap = document.createElement('div');
        previewWrap.className = 'title-chip-preview';
        previewWrap.appendChild(createTitlePlateEl(t.id, null, 'lg'));

        const descEl = document.createElement('div');
        descEl.className = 'title-chip-desc';
        descEl.textContent = t.desc;

        topWrap.appendChild(previewWrap);
        topWrap.appendChild(descEl);

        const btn = document.createElement('button');
        btn.className = `mil-btn small${equipped ? ' primary' : ''}`;
        btn.type = 'button';
        btn.disabled = !unlocked || equipped;
        btn.textContent = equipped ? '장착 중' : unlocked ? '칭호 장착' : '미해금';
        if (unlocked && !equipped) {
          btn.addEventListener('click', () => {
            metaState.equippedTitle = t.id;
            saveMetaState();
            renderTitleBadgeUI();
            renderCosmeticsTab();
          });
        }

        card.appendChild(topWrap);
        card.appendChild(btn);
        titlesGrid.appendChild(card);
      }
    }

    const skinsGrid = byId('frame-skins-grid');
    if (skinsGrid) {
      skinsGrid.innerHTML = '';
      for (let i = 0; i < FRAME_SKINS.length; i++) {
        const sk = FRAME_SKINS[i];
        const unlocked = metaState.unlockedFrameSkins.includes(sk.id);
        const equipped = metaState.equippedFrameSkin === sk.id;
        const card = document.createElement('div');
        card.className = `frame-skin-card${equipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;
        card.innerHTML = `
          <div class="frame-skin-swatch-row">
            <span class="frame-skin-swatch" style="background:${sk.previewBg}"></span>
            <div>
              <div class="frame-skin-name">${sk.name}</div>
              <div style="font-size:10.5px;color:#fbbf24;font-weight:700;">${sk.tier}</div>
            </div>
          </div>
          <div class="frame-skin-desc">${sk.desc}</div>
          <button class="mil-btn small ${equipped ? 'primary' : ''}" type="button" ${!unlocked || equipped ? 'disabled' : ''}>
            ${equipped ? '적용 중' : unlocked ? '스킨 장착' : sk.unlockDesc}
          </button>
        `;
        const btn = card.querySelector('button');
        if (btn && unlocked && !equipped) {
          btn.addEventListener('click', () => {
            metaState.equippedFrameSkin = sk.id;
            saveMetaState();
            syncCosmeticsToWeaponSystem();
            renderCosmeticsTab();
          });
        }
        skinsGrid.appendChild(card);
      }
    }
  }

  function ensureDailyStateFresh() {
    const today = getTodayDateKey();
    if (!metaState.dailyState || typeof metaState.dailyState !== 'object') {
      metaState.dailyState = { dateKey: today, progress: {}, claimed: {}, streakCount: 0, lastAttendanceDate: '' };
    }
    if (metaState.dailyState.dateKey !== today) {
      metaState.dailyState.dateKey = today;
      metaState.dailyState.progress = {};
      metaState.dailyState.claimed = {};
      saveMetaState();
    }
    return today;
  }

  function parseDateKeyToUtcMs(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!m) return NaN;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function openAttendancePopup() {
    renderDailyPanel();
    if (attendancePopupModal) {
      attendancePopupModal.classList.remove('hidden');
    }
  }

  function closeAttendancePopup() {
    if (attendancePopupModal) {
      attendancePopupModal.classList.add('hidden');
    }
  }

  function maybeAutoOpenAttendancePopup() {
    const today = ensureDailyStateFresh();
    if (attendanceAutoShownThisSession) return;
    if (metaState.dailyState.lastAttendanceDate !== today) {
      attendanceAutoShownThisSession = true;
      openAttendancePopup();
    }
  }

  function updateDailyNavBadge() {
    const today = ensureDailyStateFresh();
    const quests = getDailyQuestsForDate(today);
    let readyCount = 0;
    let claimedCount = 0;
    for (let i = 0; i < quests.length; i++) {
      const q = quests[i];
      const prog = Number(metaState.dailyState.progress[q.id]) || 0;
      const claimed = Boolean(metaState.dailyState.claimed[q.id]);
      if (claimed) claimedCount++;
      else if (prog >= q.target) readyCount++;
    }
    if (diamondQuestCount) {
      diamondQuestCount.textContent = readyCount > 0 ? `수령 ${readyCount}` : `${claimedCount}/${quests.length}`;
    }
    if (missionDiamondWidget) {
      missionDiamondWidget.classList.toggle('has-claimable', readyCount > 0);
    }
  }

  function claimAttendanceReward() {
    const today = ensureDailyStateFresh();
    if (metaState.dailyState.lastAttendanceDate === today) return;
    const prevMs = parseDateKeyToUtcMs(metaState.dailyState.lastAttendanceDate);
    const todayMs = parseDateKeyToUtcMs(today);
    const diffDays = Number.isFinite(prevMs) && Number.isFinite(todayMs)
      ? Math.round((todayMs - prevMs) / 86400000)
      : 99;
    let nextStreak = diffDays === 1 ? (metaState.dailyState.streakCount || 0) + 1 : 1;
    if (nextStreak > 7) nextStreak = 1;

    metaState.dailyState.streakCount = nextStreak;
    metaState.dailyState.lastAttendanceDate = today;
    const rewardCfg = STREAK_REWARDS[Math.max(0, Math.min(6, nextStreak - 1))] || STREAK_REWARDS[0];
    metaState.gold += rewardCfg.gold || 100;
    if (rewardCfg.titleId) unlockTitle(rewardCfg.titleId, false);
    if (nextStreak >= 3) unlockTitle('streak_3', false);
    if (nextStreak >= 7) unlockTitle('streak_7', false);

    saveMetaState();
    playUiSfx('buy');
    renderArmoryUI();
    renderDailyPanel();
    updateDailyNavBadge();
  }

  function claimDailyQuestReward(questId) {
    const today = ensureDailyStateFresh();
    const quests = getDailyQuestsForDate(today);
    const q = quests.find((item) => item.id === questId);
    if (!q) return;
    const prog = Number(metaState.dailyState.progress[q.id]) || 0;
    if (prog < q.target || metaState.dailyState.claimed[q.id]) return;

    metaState.dailyState.claimed[q.id] = true;
    metaState.gold += q.reward || 0;
    saveMetaState();
    playUiSfx('buy');
    renderArmoryUI();
    renderDailyPanel();
    updateDailyNavBadge();
  }

  function incrementDailyStat(statName, delta = 1) {
    if (!statName || delta <= 0 || tutorialState.active) return;
    const today = ensureDailyStateFresh();
    const quests = getDailyQuestsForDate(today);
    let dirty = false;
    for (let i = 0; i < quests.length; i++) {
      const q = quests[i];
      if (q.stat !== statName) continue;
      const cur = Number(metaState.dailyState.progress[q.id]) || 0;
      if (cur < q.target) {
        const next = Math.min(q.target, cur + delta);
        metaState.dailyState.progress[q.id] = next;
        dirty = true;
        if (next >= q.target && !metaState.dailyState.claimed[q.id] && eventBus) {
          eventBus.emit(EVENTS.ANNOUNCEMENT, {
            kicker: '일일 임무 완료',
            title: q.name,
            subtitle: `로비 우측 [전술 임무]에서 +${q.reward} G 수령 가능`,
            duration: 3.0,
          });
        }
      }
    }
    if (dirty) {
      saveMetaState();
      updateDailyNavBadge();
    }
  }

  function renderDailyPanel() {
    const today = ensureDailyStateFresh();
    const checkedToday = metaState.dailyState.lastAttendanceDate === today;
    const streak = metaState.dailyState.streakCount || 0;

    const streakSum = byId('daily-streak-summary');
    if (streakSum) {
      streakSum.textContent = `연속 ${streak}일 출석 완료 · ${checkedToday ? '오늘 출석 체크 완료' : '오늘 출석 보상 수령 가능'}`;
    }
    const checkinBtn = byId('btn-daily-checkin');
    if (checkinBtn) {
      checkinBtn.disabled = checkedToday;
      checkinBtn.textContent = checkedToday ? '오늘 출석 완료' : '오늘 출석 체크 (+보상)';
    }

    const streakGrid = byId('daily-streak-grid');
    if (streakGrid) {
      streakGrid.innerHTML = '';
      for (let i = 0; i < STREAK_REWARDS.length; i++) {
        const r = STREAK_REWARDS[i];
        const claimed = i < streak;
        const isTodayTarget = !checkedToday && i === (streak >= 7 ? 0 : streak);
        const card = document.createElement('div');
        card.className = `streak-day-card${claimed ? ' claimed' : ''}${isTodayTarget ? ' today' : ''}`;

        const dayNum = document.createElement('span');
        dayNum.className = 'streak-day-num';
        dayNum.textContent = `${r.day}일차`;

        const dayGold = document.createElement('span');
        dayGold.className = 'streak-day-reward';
        dayGold.textContent = `+${r.gold} G`;

        card.appendChild(dayNum);
        card.appendChild(dayGold);

        if (r.titleId) {
          card.appendChild(createTitlePlateEl(r.titleId, null, 'sm'));
        }

        const stateEl = document.createElement('span');
        stateEl.className = 'streak-day-state';
        stateEl.textContent = claimed ? '지급됨' : isTodayTarget ? '수령 가능' : '대기';
        card.appendChild(stateEl);

        streakGrid.appendChild(card);
      }
    }

    const questsGrid = byId('daily-quests-grid');
    if (questsGrid) {
      questsGrid.innerHTML = '';
      const quests = getDailyQuestsForDate(today);
      for (let i = 0; i < quests.length; i++) {
        const q = quests[i];
        const prog = Math.min(q.target, Number(metaState.dailyState.progress[q.id]) || 0);
        const pct = Math.round((prog / Math.max(1, q.target)) * 100);
        const claimed = Boolean(metaState.dailyState.claimed[q.id]);
        const ready = prog >= q.target && !claimed;

        const card = document.createElement('div');
        card.className = `daily-quest-card${ready ? ' ready' : ''}${claimed ? ' claimed' : ''}`;
        card.innerHTML = `
          <div>
            <div class="daily-quest-top">
              <span class="daily-quest-name">${q.name}</span>
              <span class="daily-quest-reward">+${q.reward} G</span>
            </div>
            <p class="daily-quest-desc">${q.desc}</p>
          </div>
          <div class="daily-quest-bar-row">
            <div class="daily-quest-track"><div class="daily-quest-fill" style="width:${pct}%"></div></div>
            <span class="daily-quest-pct">${prog} / ${q.target}</span>
          </div>
          <button class="mil-btn small ${ready ? 'primary' : ''}" type="button" ${!ready ? 'disabled' : ''}>
            ${claimed ? '보상 수령 완료' : ready ? `보상 수령 (+${q.reward} G)` : '진행 중'}
          </button>
        `;
        const btn = card.querySelector('button');
        if (btn && ready) {
          btn.addEventListener('click', () => claimDailyQuestReward(q.id));
        }
        questsGrid.appendChild(card);
      }
    }
  }

  function isWeaponSkinUnlocked(weaponId, skinCfg) {
    if (!skinCfg || skinCfg.tier === 0 || (skinCfg.reqKills <= 0 && skinCfg.reqHeadshots <= 0)) {
      return true;
    }
    const st = (metaState.weaponStats && metaState.weaponStats[weaponId]) || { kills: 0, headshots: 0 };
    return st.kills >= (skinCfg.reqKills || 0) && st.headshots >= (skinCfg.reqHeadshots || 0);
  }

  function checkWeaponMasteryUnlocks(weaponId, weaponName) {
    if (!weaponId) return;
    const st = metaState.weaponStats[weaponId] || { kills: 0, headshots: 0 };
    for (let i = 1; i < WEAPON_SKINS.length; i++) {
      const sk = WEAPON_SKINS[i];
      if (st.kills === sk.reqKills && st.headshots >= sk.reqHeadshots ||
          st.headshots === sk.reqHeadshots && st.kills >= sk.reqKills) {
        if (sk.tier === 2 && WEAPON_MASTERY_TITLES[weaponId]) {
          unlockTitle(WEAPON_MASTERY_TITLES[weaponId], true);
        }
        if (eventBus) {
          eventBus.emit(EVENTS.ANNOUNCEMENT, {
            kicker: '무기 마스터리 스킨 해금',
            title: `${weaponName || weaponId} — ${sk.name}`,
            subtitle: '무장 브리핑에서 3D 스킨 및 탄환 이펙트를 장착할 수 있습니다.',
            duration: 3.2,
          });
        }
      }
    }
  }

  function renderArsenalMasteryUI() {
    const slots = document.querySelectorAll('[data-weapon-mastery]');
    slots.forEach((slotEl) => {
      const wid = slotEl.getAttribute('data-weapon-mastery');
      const st = (metaState.weaponStats && metaState.weaponStats[wid]) || { kills: 0, headshots: 0 };
      const eqSkinId = (metaState.equippedWeaponSkins && metaState.equippedWeaponSkins[wid]) || 'standard';

      let nextSkin = null;
      for (let i = 1; i < WEAPON_SKINS.length; i++) {
        if (!isWeaponSkinUnlocked(wid, WEAPON_SKINS[i])) {
          nextSkin = WEAPON_SKINS[i];
          break;
        }
      }

      const nextText = nextSkin
        ? `다음 해금 [${nextSkin.name}]: ${nextSkin.reqKills}킬${nextSkin.reqHeadshots > 0 ? ` · HS ${nextSkin.reqHeadshots}` : ''}`
        : '모든 스킨 해금 완료!';

      let chipsHtml = '';
      for (let i = 0; i < WEAPON_SKINS.length; i++) {
        const sk = WEAPON_SKINS[i];
        const unlocked = isWeaponSkinUnlocked(wid, sk);
        const active = eqSkinId === sk.id;
        const reqTip = unlocked
          ? `${sk.name} 장착`
          : `잠김 (${sk.reqKills}킬${sk.reqHeadshots > 0 ? ` / 헤드샷 ${sk.reqHeadshots}` : ''} 필요)`;
        chipsHtml += `
          <button
            class="skin-chip-btn${active ? ' active' : ''}${!unlocked ? ' locked' : ''}"
            type="button"
            data-skin-equip="${sk.id}"
            title="${reqTip}"
          >
            <span class="skin-dot" style="background:${sk.swatchCss}"></span>
            <span>${sk.name}</span>
          </button>`;
      }

      slotEl.innerHTML = `
        <div class="mastery-head">
          <span class="mastery-counts">누적 ${st.kills}킬 · 헤드샷 ${st.headshots}회</span>
          <span class="mastery-next">${nextText}</span>
        </div>
        <div class="mastery-skin-row">${chipsHtml}</div>
      `;

      slotEl.querySelectorAll('[data-skin-equip]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const skId = btn.getAttribute('data-skin-equip');
          const skCfg = WEAPON_SKINS.find((s) => s.id === skId);
          if (!skCfg) return;
          if (!isWeaponSkinUnlocked(wid, skCfg)) {
            const nextLabel = slotEl.querySelector('.mastery-next');
            if (nextLabel) {
              nextLabel.textContent = `해금 조건: ${skCfg.reqKills}킬 · 헤드샷 ${skCfg.reqHeadshots}회`;
            }
            return;
          }
          metaState.equippedWeaponSkins[wid] = skCfg.id;
          saveMetaState();
          syncCosmeticsToWeaponSystem();
          renderArsenalMasteryUI();
          renderArsenalPreviews(wid, metaState.equippedWeaponSkins);
        });
      });
    });
  }

  function updateLeaderboardIdentityUI() {
    const authBtn = byId('btn-lb-auth');
    const authStatus = byId('lb-auth-status');
    const titleSettingAuthBtn = byId('btn-title-setting-auth');
    const titleSettingAuthStatus = byId('title-setting-auth-status');
    const pauseSettingAuthBtn = byId('btn-pause-setting-auth');
    const pauseSettingAuthStatus = byId('pause-setting-auth-status');
    const lbInput = byId('lb-callsign-input');
    const resInput = byId('result-callsign-input');
    const user = FirebaseService && typeof FirebaseService.getCurrentUser === 'function'
      ? FirebaseService.getCurrentUser()
      : null;

    if (user) {
      const dName = user.displayName || user.email || 'Google Pilot';
      if (authBtn) authBtn.textContent = '로그아웃';
      if (authStatus) {
        authStatus.textContent = `인증 완료 (${dName}) · 글로벌 기록 업로드 가능`;
      }
      for (const btn of [titleSettingAuthBtn, pauseSettingAuthBtn]) {
        if (!btn) continue;
        btn.textContent = '로그아웃';
        btn.classList.add('danger');
        btn.classList.remove('primary');
      }
      for (const st of [titleSettingAuthStatus, pauseSettingAuthStatus]) {
        if (!st) continue;
        st.textContent = `연동됨 · ${dName}`;
        st.classList.add('is-signed-in');
      }
      if ((!metaState.callsign || metaState.callsign === 'PILOT') && user.displayName) {
        metaState.callsign = FirebaseService.sanitizeCallsign(user.displayName.split(' ')[0], 'PILOT');
        saveMetaState();
      }
    } else {
      if (authBtn) authBtn.textContent = 'Google 로그인';
      if (authStatus) {
        authStatus.textContent = '열람은 무료 공개입니다. 기록 등록 시 Google 인증이 필요합니다.';
      }
      for (const btn of [titleSettingAuthBtn, pauseSettingAuthBtn]) {
        if (!btn) continue;
        btn.textContent = 'Google 로그인';
        btn.classList.remove('danger');
        btn.classList.add('primary');
      }
      for (const st of [titleSettingAuthStatus, pauseSettingAuthStatus]) {
        if (!st) continue;
        st.textContent = '미연동 (랭킹 등록 시 필요)';
        st.classList.remove('is-signed-in');
      }
    }

    if (lbInput && document.activeElement !== lbInput) {
      lbInput.value = metaState.callsign || 'PILOT';
    }
    if (resInput && document.activeElement !== resInput) {
      resInput.value = metaState.callsign || 'PILOT';
    }
    renderTitleBadgeUI();
    renderCloudBackupUI();
  }

  const cloudSaveState = {
    loading: false,
    saving: false,
    hasBackup: false,
    updatedAtMs: null,
    statusText: 'Google 로그인 필요',
    statusKind: '',
    lastAuthUid: null,
  };

  function hasMeaningfulProgress(m) {
    if (!m || typeof m !== 'object') return false;
    if ((Number(m.gold) || 0) > 0) return true;
    if ((Number(m.maxUnlockedHeat) || 0) > 0) return true;
    if ((Number(m.bestEndlessWave) || 0) > 0) return true;
    if ((Number(m.totalKillsAllTime) || 0) > 0) return true;
    if (Array.isArray(m.ownedFrames) && m.ownedFrames.length > 1) return true;
    if (Array.isArray(m.achievements) && m.achievements.length > 0) return true;
    if (Array.isArray(m.unlockedTitles) && m.unlockedTitles.length > 1) return true;
    if (Array.isArray(m.unlockedFrameSkins) && m.unlockedFrameSkins.length > 1) return true;
    if (m.dailyState && (Number(m.dailyState.streakCount) || 0) > 0) return true;
    if (m.levels && Object.values(m.levels).some((lv) => (Number(lv) || 0) > 0)) return true;
    return false;
  }

  function formatCloudTimestamp(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '방금';
    try {
      const d = new Date(ms);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}`;
    } catch {
      return '완료';
    }
  }

  function renderCloudBackupUI() {
    const user = FirebaseService && typeof FirebaseService.getCurrentUser === 'function'
      ? FirebaseService.getCurrentUser()
      : null;
    const busy = cloudSaveState.loading || cloudSaveState.saving;
    const saveBtns = [byId('btn-title-setting-cloud-save'), byId('btn-pause-setting-cloud-save')];
    const loadBtns = [byId('btn-title-setting-cloud-load'), byId('btn-pause-setting-cloud-load')];
    const statusEls = [byId('title-setting-cloud-status'), byId('pause-setting-cloud-status')];

    for (const btn of saveBtns) {
      if (!btn) continue;
      btn.disabled = !user || busy;
      btn.textContent = cloudSaveState.saving ? '저장 중...' : '저장하기';
    }
    for (const btn of loadBtns) {
      if (!btn) continue;
      btn.disabled = !user || busy;
      btn.textContent = cloudSaveState.loading ? '불러오는 중...' : '불러오기';
    }
    for (const st of statusEls) {
      if (!st) continue;
      st.textContent = user ? (cloudSaveState.statusText || '연동됨 · 저장하기 시 백업') : 'Google 로그인 필요';
      st.classList.toggle('is-synced', Boolean(user) && cloudSaveState.statusKind === 'synced');
      st.classList.toggle('is-error', Boolean(user) && cloudSaveState.statusKind === 'error');
    }
  }

  function applyMetaSnapshotToRuntime(snapshotMeta) {
    if (!snapshotMeta || typeof snapshotMeta !== 'object') return;
    const clean = FirebaseService.sanitizeCloudMeta(snapshotMeta);

    metaState.gold = clean.gold;
    for (const k of Object.keys(metaState.levels)) {
      metaState.levels[k] = clean.levels[k] || 0;
    }
    metaState.ownedFrames = clean.ownedFrames.slice();
    metaState.equippedFrame = clean.equippedFrame;
    metaState.achievements = clean.achievements.slice();
    metaState.claimedAchievements = Object.assign({}, clean.claimedAchievements);
    metaState.maxUnlockedHeat = clean.maxUnlockedHeat;
    metaState.bestEndlessWave = clean.bestEndlessWave;
    metaState.totalKillsAllTime = clean.totalKillsAllTime;
    metaState.voidGatesDestroyed = clean.voidGatesDestroyed;
    metaState.callsign = clean.callsign;
    metaState.equippedTitle = clean.equippedTitle;
    metaState.unlockedTitles = clean.unlockedTitles.slice();
    metaState.unlockedFrameSkins = clean.unlockedFrameSkins.slice();
    metaState.equippedFrameSkin = clean.equippedFrameSkin;
    metaState.claimedHeatMilestones = Object.assign({}, clean.claimedHeatMilestones);
    for (const wid of Object.keys(metaState.weaponStats)) {
      metaState.weaponStats[wid] = clean.weaponStats[wid]
        ? { kills: clean.weaponStats[wid].kills, headshots: clean.weaponStats[wid].headshots }
        : { kills: 0, headshots: 0 };
    }
    for (const wid of Object.keys(metaState.equippedWeaponSkins)) {
      metaState.equippedWeaponSkins[wid] = clean.equippedWeaponSkins[wid] || 'standard';
    }
    metaState.dailyState = {
      dateKey: clean.dailyState.dateKey,
      progress: Object.assign({}, clean.dailyState.progress),
      claimed: Object.assign({}, clean.dailyState.claimed),
      streakCount: clean.dailyState.streakCount,
      lastAttendanceDate: clean.dailyState.lastAttendanceDate,
    };

    saveMetaState();
    arsenalPreviewsRendered = false;
    renderArmoryUI();
    renderCosmeticsTab();
    renderArsenalMasteryUI();
    if (activeTitleSubpanel === 'arsenal') {
      renderArsenalPreviews(null, metaState.equippedWeaponSkins);
    }
    updateMissionConfigUI();
    renderMedalsStrip();
    renderTitleBadgeUI();
    renderDailyPanel();
    updateDailyNavBadge();

    if (runtimeReady && playerController) {
      const { mods } = computePlayerMods();
      playerController.applyModifiers(mods, false);
      syncCosmeticsToWeaponSystem();
    }
  }

  async function syncCloudStateOnAuth(user) {
    if (!user || !user.uid) {
      cloudSaveState.lastAuthUid = null;
      cloudSaveState.loading = false;
      cloudSaveState.saving = false;
      cloudSaveState.hasBackup = false;
      cloudSaveState.updatedAtMs = null;
      cloudSaveState.statusText = 'Google 로그인 필요';
      cloudSaveState.statusKind = '';
      renderCloudBackupUI();
      return;
    }

    const uid = user.uid;
    if (cloudSaveState.lastAuthUid === uid && (cloudSaveState.loading || cloudSaveState.hasBackup)) {
      renderCloudBackupUI();
      return;
    }

    cloudSaveState.lastAuthUid = uid;
    cloudSaveState.loading = true;
    cloudSaveState.statusText = '클라우드 백업 확인 중...';
    cloudSaveState.statusKind = '';
    renderCloudBackupUI();

    try {
      const res = await FirebaseService.fetchCloudMetaState(true);
      const cur = FirebaseService.getCurrentUser();
      if (!cur || cur.uid !== uid) return;

      cloudSaveState.loading = false;
      if (res && res.meta) {
        cloudSaveState.hasBackup = true;
        cloudSaveState.updatedAtMs = res.updatedAtMs;
        const tsLabel = formatCloudTimestamp(res.updatedAtMs);
        if (!hadLocalMetaAtBoot && !hasMeaningfulProgress(metaState)) {
          applyMetaSnapshotToRuntime(res.meta);
          hadLocalMetaAtBoot = true;
          cloudSaveState.statusText = `자동 복구 완료 (${tsLabel})`;
          cloudSaveState.statusKind = 'synced';
          if (gameState === 'title') {
            showTitleUnlockToast(`연동 계정에서 진행 내역을 복구했습니다 (${tsLabel})`);
          }
        } else {
          cloudSaveState.statusText = `백업 있음 (${tsLabel}) · 불러오기로 복구 가능`;
          cloudSaveState.statusKind = 'synced';
        }
      } else {
        cloudSaveState.hasBackup = false;
        cloudSaveState.updatedAtMs = null;
        cloudSaveState.statusText = '저장된 클라우드 백업 없음 (저장하기를 눌러 백업)';
        cloudSaveState.statusKind = '';
      }
    } catch (err) {
      const cur = FirebaseService.getCurrentUser();
      if (!cur || cur.uid !== uid) return;
      cloudSaveState.loading = false;
      cloudSaveState.statusText = err && err.message ? err.message : '클라우드 확인 실패';
      cloudSaveState.statusKind = 'error';
    }
    renderCloudBackupUI();
  }

  async function handleManualCloudSave() {
    const user = FirebaseService && typeof FirebaseService.getCurrentUser === 'function'
      ? FirebaseService.getCurrentUser()
      : null;
    if (!user) {
      cloudSaveState.statusText = '먼저 Google 계정에 로그인해 주세요.';
      cloudSaveState.statusKind = 'error';
      renderCloudBackupUI();
      return;
    }
    if (cloudSaveState.saving || cloudSaveState.loading) return;

    cloudSaveState.saving = true;
    cloudSaveState.statusText = '클라우드에 저장하는 중...';
    cloudSaveState.statusKind = '';
    renderCloudBackupUI();

    try {
      const res = await FirebaseService.saveCloudMetaState(metaState);
      cloudSaveState.saving = false;
      cloudSaveState.hasBackup = true;
      cloudSaveState.updatedAtMs = (res && res.updatedAtMs) || Date.now();
      const tsLabel = formatCloudTimestamp(cloudSaveState.updatedAtMs);
      cloudSaveState.statusText = `저장 완료 (${tsLabel})`;
      cloudSaveState.statusKind = 'synced';
      playUiSfx('buy');
      if (gameState === 'title') {
        showTitleUnlockToast(`클라우드 백업 저장 완료 (${tsLabel})`);
      }
    } catch (err) {
      cloudSaveState.saving = false;
      cloudSaveState.statusText = err && err.message ? err.message : '클라우드 저장 실패';
      cloudSaveState.statusKind = 'error';
    }
    renderCloudBackupUI();
  }

  async function handleManualCloudLoad() {
    const user = FirebaseService && typeof FirebaseService.getCurrentUser === 'function'
      ? FirebaseService.getCurrentUser()
      : null;
    if (!user) {
      cloudSaveState.statusText = '먼저 Google 계정에 로그인해 주세요.';
      cloudSaveState.statusKind = 'error';
      renderCloudBackupUI();
      return;
    }
    if (cloudSaveState.saving || cloudSaveState.loading) return;

    cloudSaveState.loading = true;
    cloudSaveState.statusText = '클라우드에서 불러오는 중...';
    cloudSaveState.statusKind = '';
    renderCloudBackupUI();

    try {
      const res = await FirebaseService.fetchCloudMetaState(true);
      cloudSaveState.loading = false;
      if (!res || !res.meta) {
        cloudSaveState.hasBackup = false;
        cloudSaveState.updatedAtMs = null;
        cloudSaveState.statusText = '저장된 클라우드 백업이 없습니다.';
        cloudSaveState.statusKind = 'error';
      } else {
        applyMetaSnapshotToRuntime(res.meta);
        hadLocalMetaAtBoot = true;
        cloudSaveState.hasBackup = true;
        cloudSaveState.updatedAtMs = res.updatedAtMs;
        const tsLabel = formatCloudTimestamp(res.updatedAtMs);
        cloudSaveState.statusText = `복구 완료 (${tsLabel})`;
        cloudSaveState.statusKind = 'synced';
        playUiSfx('buy');
        if (gameState === 'title') {
          showTitleUnlockToast(`클라우드 백업에서 진행 내역을 복구했습니다 (${tsLabel})`);
        }
      }
    } catch (err) {
      cloudSaveState.loading = false;
      cloudSaveState.statusText = err && err.message ? err.message : '클라우드 불러오기 실패';
      cloudSaveState.statusKind = 'error';
    }
    renderCloudBackupUI();
  }

  async function renderLeaderboardPanel(forceRefresh = false) {
    updateLeaderboardIdentityUI();
    document.querySelectorAll('[data-lb-mode]').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-lb-mode') === activeLeaderboardMode);
    });

    const listEl = byId('leaderboard-list');
    if (!listEl) return;
    const setEmptyMessage = (msg) => {
      listEl.textContent = '';
      const emptyEl = document.createElement('div');
      emptyEl.className = 'lb-empty';
      emptyEl.textContent = msg;
      listEl.appendChild(emptyEl);
    };
    setEmptyMessage('글로벌 작전 기록을 불러오는 중입니다...');

    try {
      const dateKey = activeLeaderboardMode === 'daily' ? getTodayDateKey() : null;
      const entries = await FirebaseService.fetchLeaderboard(activeLeaderboardMode, dateKey, 25, forceRefresh);
      if (!entries || entries.length === 0) {
        setEmptyMessage('아직 등록된 기록이 없습니다. 작전을 완료하고 첫 번째 이름을 남겨보세요!');
        return;
      }

      const curUser = FirebaseService.getCurrentUser();
      const myUid = curUser ? curUser.uid : '';
      const frag = document.createDocumentFragment();

      const headerRow = document.createElement('div');
      headerRow.className = 'lb-row lb-header';
      const headerCols = [
        { text: '순위', cls: '' },
        { text: '칭호 · 호출부호', cls: '' },
        { text: '점수', cls: '' },
        { text: '도달 웨이브', cls: '' },
        { text: '위협', cls: '' },
        { text: '킬 / HS', cls: 'lb-col-hide-sm' },
        { text: '기체 · 주무장', cls: 'lb-col-hide-sm' },
      ];
      for (let h = 0; h < headerCols.length; h++) {
        const sp = document.createElement('span');
        if (headerCols[h].cls) sp.className = headerCols[h].cls;
        sp.textContent = headerCols[h].text;
        headerRow.appendChild(sp);
      }
      frag.appendChild(headerRow);

      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const isMine = Boolean(myUid && e.uid === myUid);
        const frameObj = PILOT_FRAMES.find((f) => f.id === e.frameId);
        const wepObj = WEAPONS.find((w) => w.id === e.primaryWeaponId);
        const safeCallsign = FirebaseService.sanitizeCallsign(e.callsign, 'PILOT');
        const safeTitleId = PLAYER_TITLES.some((t) => t.id === e.titleId) ? e.titleId : 'rookie_dropper';
        const titleObj = getTitleObjById(safeTitleId);

        const row = document.createElement('div');
        row.className = `lb-row${isMine ? ' mine' : ''}${i < 3 ? ' top3' : ''}`;

        const rankEl = document.createElement('span');
        rankEl.className = 'lb-rank-num';
        rankEl.textContent = `#${i + 1}`;

        const pilotCell = document.createElement('div');
        pilotCell.className = 'lb-pilot-cell';
        pilotCell.appendChild(createTitlePlateEl(titleObj.id, titleObj.label, 'sm'));

        const nameEl = document.createElement('span');
        nameEl.className = 'lb-row-name';
        nameEl.textContent = safeCallsign;
        pilotCell.appendChild(nameEl);

        const scoreEl = document.createElement('span');
        scoreEl.className = 'lb-score-cell';
        scoreEl.textContent = Number(e.score || 0).toLocaleString();

        const waveEl = document.createElement('span');
        waveEl.textContent = `${Number(e.wave || 1)} 웨이브`;

        const heatEl = document.createElement('span');
        heatEl.textContent = `HEAT ${Number(e.heat || 0)}`;

        const killEl = document.createElement('span');
        killEl.className = 'lb-col-hide-sm';
        killEl.textContent = `${Number(e.kills || 0)} / ${Number(e.headshots || 0)}`;

        const loadoutEl = document.createElement('span');
        loadoutEl.className = 'lb-col-hide-sm';
        loadoutEl.textContent = `${(frameObj && frameObj.name) || 'VANGUARD-09'} · ${(wepObj && wepObj.shortName) || 'M41-A'}`;

        row.appendChild(rankEl);
        row.appendChild(pilotCell);
        row.appendChild(scoreEl);
        row.appendChild(waveEl);
        row.appendChild(heatEl);
        row.appendChild(killEl);
        row.appendChild(loadoutEl);
        frag.appendChild(row);
      }

      listEl.textContent = '';
      listEl.appendChild(frag);
    } catch (err) {
      setEmptyMessage(`랭킹 불러오기 실패: ${err && err.message ? err.message : '네트워크 오류'}`);
    }
  }

  // Wire Mission Mode buttons & Armory Reset / Achievement Claim buttons once
  for (const m of ['campaign', 'endless', 'daily']) {
    const btn = byId(`mode-${m}`);
    if (btn) {
      btn.addEventListener('click', () => {
        selectedMissionMode = m;
        lockedHeatFeedbackText = '';
        updateMissionConfigUI();
      });
    }
  }
  if (btnArmoryReset) {
    btnArmoryReset.addEventListener('click', () => {
      const spent = computeSpentArmoryGold();
      if (spent <= 0) return;
      if (!armoryResetConfirmPending) {
        armoryResetConfirmPending = true;
        updateArmoryResetBtnUI();
        if (armoryResetConfirmTimer) window.clearTimeout(armoryResetConfirmTimer);
        armoryResetConfirmTimer = window.setTimeout(() => {
          clearArmoryResetConfirm();
          updateArmoryResetBtnUI();
        }, 3500);
        return;
      }
      clearArmoryResetConfirm();
      for (const k of Object.keys(metaState.levels)) {
        metaState.levels[k] = 0;
      }
      metaState.gold += spent;
      saveMetaState();
      if (runtimeReady && playerController) {
        const { mods } = computePlayerMods();
        playerController.applyModifiers(mods, false);
      }
      playUiSfx('buy');
      renderArmoryUI();
    });
  }
  if (btnAchClaimAll) {
    btnAchClaimAll.addEventListener('click', () => {
      claimAllAchievementRewards();
    });
  }
  updateMissionConfigUI();
  renderMedalsStrip();
  renderTitleBadgeUI();
  renderDailyPanel();
  updateDailyNavBadge();
  maybeAutoOpenAttendancePopup();

  if (FirebaseService && typeof FirebaseService.onAuthChange === 'function') {
    FirebaseService.onAuthChange((user) => {
      updateLeaderboardIdentityUI();
      syncCloudStateOnAuth(user);
    });
  } else {
    renderCloudBackupUI();
  }

  // Wire Armory 3-tab switcher (Stats / Frames / Titles & Frame Skins)
  const tabStatsBtn = byId('tab-armory-stats');
  const tabFramesBtn = byId('tab-armory-frames');
  const tabCosmeticsBtn = byId('tab-armory-cosmetics');
  const viewStatsEl = byId('armory-view-stats');
  const viewFramesEl = byId('armory-view-frames');
  const viewCosmeticsEl = byId('armory-view-cosmetics');
  function setArmoryTab(tabName) {
    if (tabStatsBtn) tabStatsBtn.classList.toggle('active', tabName === 'stats');
    if (tabFramesBtn) tabFramesBtn.classList.toggle('active', tabName === 'frames');
    if (tabCosmeticsBtn) tabCosmeticsBtn.classList.toggle('active', tabName === 'cosmetics');
    if (viewStatsEl) viewStatsEl.classList.toggle('hidden', tabName !== 'stats');
    if (viewFramesEl) viewFramesEl.classList.toggle('hidden', tabName !== 'frames');
    if (viewCosmeticsEl) viewCosmeticsEl.classList.toggle('hidden', tabName !== 'cosmetics');
    if (tabName === 'frames' || tabName === 'cosmetics') {
      renderArmoryUI();
    }
  }
  if (tabStatsBtn) tabStatsBtn.addEventListener('click', () => setArmoryTab('stats'));
  if (tabFramesBtn) tabFramesBtn.addEventListener('click', () => setArmoryTab('frames'));
  if (tabCosmeticsBtn) tabCosmeticsBtn.addEventListener('click', () => setArmoryTab('cosmetics'));

  function openUpgradeDraft(waveNum) {
    if (!upgradePanel || !upgradeCardsGrid || gameState !== 'playing') return;
    gameState = 'upgrading';
    hadPointerLock = false;
    document.body.classList.remove('playing-active');
    if (input) {
      releaseGameplayShortcutLock(false, true);
      input.exitPointerLock();
      input.resetAll();
    }
    if (touchOverlay) touchOverlay.setVisible(false);
    if (waveDirector) waveDirector.setDraftPaused(true);

    // Pick 3 distinct random cards (prefer unpicked cards first)
    const ownedIds = new Set(runCards.map((c) => c.id));
    let pool = TACTICAL_CARDS.filter((c) => !ownedIds.has(c.id));
    if (pool.length < 3) pool = TACTICAL_CARDS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    draftChoices = pool.slice(0, 3);

    const { tagCounts } = computePlayerMods();
    if (upgradeKicker) upgradeKicker.textContent = `웨이브 ${String(waveNum).padStart(2, '0')} 완료 · 전술 강화 선택`;
    upgradeCardsGrid.innerHTML = '';

    for (let i = 0; i < draftChoices.length; i++) {
      const card = draftChoices[i];
      const syn = SYNERGIES[card.tag];
      const nextCount = (tagCounts[card.tag] || 0) + 1;
      const willTrigger = nextCount === syn.threshold;
      const alreadyActive = (tagCounts[card.tag] || 0) >= syn.threshold;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = card.rare ? 'tactical-card rare-card' : 'tactical-card';
      btn.style.setProperty('--card-tag-color', card.rare ? '#fbbf24' : syn.color);
      const TAG_ICONS = {
        assault: '<svg class="tactical-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>',
        mobility: '<svg class="tactical-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h8l-1 8 11-12h-8l0-8z"/></svg>',
        vanguard: '<svg class="tactical-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z"/></svg>',
        tactical: '<svg class="tactical-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      };
      const tagIco = TAG_ICONS[card.tag] || TAG_ICONS.assault;
      const CARD_ART_MAP = {
        tungsten_core: "./assets/card-tungsten_core.webp",
        overclock_mag: "./assets/card-overclock_mag.webp",
        precision_refund: "./assets/card-precision_refund.webp",
        thruster_tune: "./assets/card-thruster_tune.webp",
        slide_reload: "./assets/card-slide_reload.webp",
        aerial_gunner: "./assets/card-aerial_gunner.webp",
        siphon_boost: "./assets/card-siphon_boost.webp",
        beacon_resonance: "./assets/card-beacon_resonance.webp",
        reactive_armor: "./assets/card-reactive_armor.webp",
        repulsor_slam: "./assets/card-repulsor_slam.webp",
        mark_contagion: "./assets/card-mark_contagion.webp",
        thermal_nova: "./assets/card-thermal_nova.webp",
        slide_overclock: "./assets/card-slide_overclock.webp",
        armor_piercer: "./assets/card-tungsten_core.webp",
        aegis_capacitor: "./assets/card-reactive_armor.webp",
        kinetic_momentum: "./assets/card-thruster_tune.webp",
        orbital_overload: "./assets/card-mark_contagion.webp",
        shield_counter: "./assets/card-shield_counter.webp",
        field_medic: "./assets/card-field_medic.webp",
        ult_accelerator: "./assets/card-ult_accelerator.webp",
        ult_overdrive: "./assets/card-ult_overdrive.webp",
        auto_forge: "./assets/card-auto_forge.webp",
        scavenger_protocol: "./assets/card-scavenger_protocol.webp",
        shield_to_ult: "./assets/card-shield_to_ult.webp",
        void_breaker: "./assets/card-tungsten_core.webp",
        gravity_thruster: "./assets/card-thruster_tune.webp",
      };
      const cardArtSrc = CARD_ART_MAP[card.id] || CARD_ART_MAP.tungsten_core;
      const cardArt = `<img class="tactical-card-img" loading="eager" decoding="sync" src="${cardArtSrc}" alt="${card.name} 일러스트" />`;
      btn.innerHTML = `
        <div class="tactical-card-top">
          <span class="tactical-tag-wrap">${tagIco}<span class="tactical-tag">${syn.tagLabel} (${nextCount}/${syn.threshold})</span></span>
          <span class="tactical-key">[${i + 1}]</span>
        </div>
        <div class="tactical-card-art" aria-hidden="true">${cardArt}</div>
        <div class="tactical-card-title">${card.rare ? '<span class="rare-pill">희귀</span> ' : ''}${card.name}</div>
        <div class="tactical-card-desc">${card.desc}</div>
        <div class="tactical-synergy-hint ${willTrigger || nextCount === 4 ? 'ready' : ''}">
          ${nextCount === 4 ? `<span class="syn-badge">최대 4/4</span>[${syn.name}] 최종 강화 해금!` : willTrigger ? `<span class="syn-badge">시너지 2/4</span>[${syn.name}] 활성!` : alreadyActive ? `시너지 활성 (${nextCount}/4) · 4장 달성 시 최종 강화` : `2장/4장 시너지 [${syn.name}]: ${syn.desc}`}
        </div>
      `;
      const pickIdx = i;
      btn.addEventListener('click', () => selectUpgradeCard(pickIdx));
      upgradeCardsGrid.appendChild(btn);
    }

    upgradePanel.classList.remove('hidden');
  }

  function selectUpgradeCard(idx) {
    if (gameState !== 'upgrading' || !draftChoices[idx]) return;
    const chosen = draftChoices[idx];
    runCards.push(chosen);
    draftChoices = [];

    const { mods } = computePlayerMods();
    if (playerController) {
      playerController.applyModifiers(mods, false);
    }
    if (upgradePanel) upgradePanel.classList.add('hidden');
    if (eventBus) {
      eventBus.emit(EVENTS.UPGRADE_SELECTED, { card: chosen });
      const synActive =
        (chosen.tag === 'assault' && mods.synergyAssault) ||
        (chosen.tag === 'mobility' && mods.synergyMobility) ||
        (chosen.tag === 'vanguard' && mods.synergyVanguard);
      if (synActive) eventBus.emit('SFX_SYNERGY', { tag: chosen.tag });
    }
    if (hudManager) {
      hudManager.showOnboardingTip(`전술 강화 적용: ${chosen.name}`, 3.0);
    }

    gameState = 'playing';
    document.body.classList.add('playing-active');
    if (waveDirector) waveDirector.setDraftPaused(false);
    syncTouchOverlayVisibility();
    if (input) {
      input.resetAll();
      if (!isTouchActive()) {
        engageGameplayShortcutLock(true);
        input.requestPointerLock();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Scene State Machine & Lazy Runtime Handles (0% WebGL on TITLE / RESULT)
  // ---------------------------------------------------------------------------
  /** @type {'title' | 'playing' | 'paused' | 'ending' | 'result'} */
  let gameState = 'title';
  let activeTitleSubpanel = 'main';
  let isTransitioning = false;
  let rafId = null;

  // Lazy-initialized 3D & Combat Subsystems (null until first DEPLOY click!)
  let runtimeReady = false;
  let eventBus = null;
  let soundEngine = null;
  let engine = null;
  let collisionWorld = null;
  let input = null;
  let playerController = null;
  let mapManager = null;
  let arenaData = null;
  let interactables = null;
  let vfxManager = null;
  let weaponSystem = null;
  let waveDirector = null;
  let hudManager = null;
  let touchOverlay = null;

  let hadPointerLock = false;
  let pauseDebounce = 0;
  let lastAdsFov = null;
  let zoneAmmoRefilled = false;
  let lastWeaponState = null;

  // 0.5s Slow-Mo Ending Linger State
  let endingTimer = 0;
  let endingIsVictory = false;
  let endingFadeStarted = false;

  // Match Telemetry
  const STYLE_TIERS = [
    { grade: 'D', min: 0, color: '#a8a29e', goldMult: 1.0, shieldMult: 1.0 },
    { grade: 'C', min: 20, color: '#38bdf8', goldMult: 1.05, shieldMult: 1.05 },
    { grade: 'B', min: 40, color: '#22c55e', goldMult: 1.10, shieldMult: 1.12 },
    { grade: 'A', min: 60, color: '#f59e0b', goldMult: 1.15, shieldMult: 1.20 },
    { grade: 'S', min: 78, color: '#fb923c', goldMult: 1.30, shieldMult: 1.35 },
    { grade: 'SSS', min: 92, color: '#ef4444', goldMult: 1.50, shieldMult: 1.50 },
  ];

  const telemetry = {
    shotsFired: 0,
    shotsHit: 0,
    shotSeq: 0,
    lastHitShotSeq: -1,
    maxCombo: 1,
    elapsedSec: 0,
    styleMeter: 0,
    styleTierIdx: 0,
    maxStyleTierIdx: 0,
    lastStyleCallout: '스타일',
    lastSwapTime: -99,
    _lastReactiveBlast: -99,
    wasGroundedPrev: true,
    airTimeAccum: 0,
    airKills: 0,
    slideKills: 0,
    swapKills: 0,
    meleeKills: 0,
    aegisEliteKills: 0,
    bossKills: 0,
    runGoldEarned: 0,
    weaponKills: {},
    runUnlockedRewards: [],
  };

  function getStyleTier(meter) {
    let idx = 0;
    for (let i = STYLE_TIERS.length - 1; i >= 0; i--) {
      if (meter >= STYLE_TIERS[i].min) {
        idx = i;
        break;
      }
    }
    return idx;
  }

  let _lastStylePct = -1;
  let _lastStyleGrade = '';
  let _lastStyleCallout = '';
  function updateStyleHudUI() {
    const pct = Math.round(Math.max(0, Math.min(100, telemetry.styleMeter)));
    const tier = STYLE_TIERS[telemetry.styleTierIdx] || STYLE_TIERS[0];
    if (pct === _lastStylePct && tier.grade === _lastStyleGrade && telemetry.lastStyleCallout === _lastStyleCallout) {
      return;
    }
    const cardEl = byId('style-rank-card');
    const gradeEl = byId('style-grade');
    const barEl = byId('style-bar-fill');
    const callEl = byId('style-callout');
    if (tier.grade !== _lastStyleGrade) {
      _lastStyleGrade = tier.grade;
      if (cardEl) cardEl.style.setProperty('--style-color', tier.color);
      if (gradeEl) gradeEl.textContent = tier.grade;
    }
    if (pct !== _lastStylePct) {
      _lastStylePct = pct;
      if (barEl) barEl.style.width = `${pct}%`;
    }
    if (telemetry.lastStyleCallout !== _lastStyleCallout) {
      _lastStyleCallout = telemetry.lastStyleCallout;
      if (callEl) callEl.textContent = telemetry.lastStyleCallout;
    }
  }

  function addStylePoints(pts, label) {
    const prevTier = telemetry.styleTierIdx;
    telemetry.styleMeter = Math.min(100, telemetry.styleMeter + pts);
    telemetry.styleTierIdx = getStyleTier(telemetry.styleMeter);
    if (telemetry.styleTierIdx > prevTier && eventBus) {
      eventBus.emit('SFX_RANK_UP', { tier: telemetry.styleTierIdx });
    }
    if (telemetry.styleTierIdx > telemetry.maxStyleTierIdx) {
      telemetry.maxStyleTierIdx = telemetry.styleTierIdx;
    }
    if (telemetry.styleTierIdx >= 3) unlockAchievement('style_a');
    if (telemetry.styleTierIdx >= 4) unlockAchievement('style_s');
    if (telemetry.styleTierIdx >= 5) unlockAchievement('style_sss');
    if (label) telemetry.lastStyleCallout = label;
    updateStyleHudUI();
  }

  function resetTelemetry() {
    telemetry.shotsFired = 0;
    telemetry.shotsHit = 0;
    telemetry.shotSeq = 0;
    telemetry.lastHitShotSeq = -1;
    telemetry.maxCombo = 1;
    telemetry.elapsedSec = 0;
    telemetry.styleMeter = 0;
    telemetry.styleTierIdx = 0;
    telemetry.maxStyleTierIdx = 0;
    telemetry.lastStyleCallout = '스타일';
    telemetry.lastSwapTime = -99;
    telemetry._lastReactiveBlast = -99;
    telemetry.wasGroundedPrev = true;
    telemetry.airTimeAccum = 0;
    telemetry.airKills = 0;
    telemetry.slideKills = 0;
    telemetry.swapKills = 0;
    telemetry.meleeKills = 0;
    telemetry.aegisEliteKills = 0;
    telemetry.bossKills = 0;
    telemetry.runGoldEarned = 0;
    telemetry.weaponKills = {};
    telemetry.runUnlockedRewards = [];
    updateStyleHudUI();
  }

  // Zero-GC Frame Buffers
  const mergedTargets = [];
  const playerUpdateOpts = {
    adsFov: null,
    aimAssistTargets: null,
    allowAds: true,
  };
  const hudSnapshot = {
    player: null,
    weapon: null,
    crosshairSpread: 0.018,
    wave: null,
    boss: null,
    zone: null,
    enemies: null,
    pickups: null,
    voidGates: null,
    lowGravityZones: null,
    transferGate: null,
    fps: 60,
  };

  let lastTime = 0;
  let elapsedTime = 0;

  // Orbital Drop Pod Cockpit Intro State (Option B)
  let dropPodRig = null;
  let dropPodColliderIds = [];
  const dropPodIntro = {
    active: false,
    elapsed: 0,
    phase: 'idle',
    impacted: false,
    unsealed: false,
    spawnPos: null,
    yaw: 0,
    landDip: 0,
    landDipVel: 0,
    sectorMeta: null,
    opsMeta: '',
  };

  function clearLandedDropPod() {
    if (collisionWorld && dropPodColliderIds.length > 0) {
      for (let i = 0; i < dropPodColliderIds.length; i++) {
        collisionWorld.removeBox(dropPodColliderIds[i]);
      }
    }
    dropPodColliderIds.length = 0;
    if (dropPodRig && dropPodRig.group) {
      dropPodRig.group.visible = false;
      if (dropPodRig.reentryGroup) dropPodRig.reentryGroup.visible = false;
    }
  }

  function parkLandedDropPodAt(podPos, yaw, openHatches = true) {
    const rig = ensureDropPodRig();
    if (!rig || !podPos) return;
    clearLandedDropPod();

    rig.group.position.copy(podPos);
    rig.group.rotation.y = yaw || 0;
    rig.group.visible = true;
    if (rig.reentryGroup) rig.reentryGroup.visible = false;
    if (rig.lockClamp) rig.lockClamp.visible = false;
    if (rig.strobeMat) {
      rig.strobeMat.color.setHex(0x22c55e);
      rig.strobeMat.emissive.setHex(0x22c55e);
      rig.strobeMat.emissiveIntensity = 2.0;
    }
    if (rig.cabinLight) {
      rig.cabinLight.color.setHex(0xfbbf24);
      rig.cabinLight.intensity = 2.4;
    }
    const baseDoorZ = rig.glbDoorZ || -0.88;
    const baseDoorX = rig.glbDoorX || 0.36;
    if (openHatches) {
      rig.leftDoor.position.set(-baseDoorX - 0.72, 0, baseDoorZ - 0.24);
      rig.leftDoor.rotation.y = 0.85;
      rig.rightDoor.position.set(baseDoorX + 0.72, 0, baseDoorZ - 0.24);
      rig.rightDoor.rotation.y = -0.85;
    } else {
      rig.leftDoor.position.set(-baseDoorX, 0, baseDoorZ);
      rig.leftDoor.rotation.y = 0;
      rig.rightDoor.position.set(baseDoorX, 0, baseDoorZ);
      rig.rightDoor.rotation.y = 0;
    }
    if (collisionWorld) {
      const podBox = collisionWorld.addBox(
        podPos.x - 1.15,
        podPos.y,
        podPos.z - 1.15,
        podPos.x + 1.15,
        podPos.y + 2.8,
        podPos.z + 1.15,
        'cover'
      );
      if (podBox) dropPodColliderIds.push(podBox.id);
    }
  }

  function ensureDropPodRig() {
    if (dropPodRig || !engine || !engine.scene) return dropPodRig;

    const group = new THREE.Group();
    group.name = 'orbital_drop_pod_cockpit';
    group.visible = false;

    const fallbackGroup = new THREE.Group();
    fallbackGroup.name = 'drop_pod_fallback_shell';
    group.add(fallbackGroup);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1d1a18,
      metalness: 0.82,
      roughness: 0.42,
    });
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0x3b332e,
      metalness: 0.72,
      roughness: 0.48,
    });
    const amberMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 2.0,
      metalness: 0.3,
      roughness: 0.2,
    });
    const strobeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: new THREE.Color(0xef4444),
      emissiveIntensity: 3.4,
      metalness: 0.2,
      roughness: 0.2,
    });
    const reentryMat = new THREE.MeshBasicMaterial({
      color: 0xff6b1a,
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Minimal fallback shell while sculpted Blender GLB loads/resolves
    const floorPlate = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.14, 8), hullMat);
    floorPlate.position.set(0, 0.05, 0);
    fallbackGroup.add(floorPlate);
    const roofPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.22, 8), hullMat);
    roofPlate.position.set(0, 2.24, 0);
    fallbackGroup.add(roofPlate);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.72, 2.15, 0.18), hullMat);
    backWall.position.set(0, 1.15, 0.88);
    fallbackGroup.add(backWall);

    const leftDoor = new THREE.Group();
    leftDoor.position.set(-0.36, 0, -0.88);
    const lPanel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 2.0, 0.14), hullMat);
    lPanel.position.set(0, 1.15, 0);
    leftDoor.add(lPanel);
    fallbackGroup.add(leftDoor);

    const rightDoor = new THREE.Group();
    rightDoor.position.set(0.36, 0, -0.88);
    const rPanel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 2.0, 0.14), hullMat);
    rPanel.position.set(0, 1.15, 0);
    rightDoor.add(rPanel);
    fallbackGroup.add(rightDoor);

    const lockClamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.14), ribMat);
    lockClamp.position.set(0, 1.38, -0.78);
    fallbackGroup.add(lockClamp);

    // Atmospheric Re-entry Flame/Plasma Streaks rushing past front slit during descent
    const reentryGroup = new THREE.Group();
    const streakGeo = new THREE.CylinderGeometry(0.025, 0.06, 2.4, 6);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 1.38 + (i % 3) * 0.28;
      const streak = new THREE.Mesh(streakGeo, reentryMat);
      streak.position.set(Math.cos(a) * r, 0.9 + (i % 4) * 0.45, Math.sin(a) * r - 0.35);
      reentryGroup.add(streak);
    }
    group.add(reentryGroup);

    const cabinLight = new THREE.PointLight(0xef4444, 4.5, 5.2, 1.4);
    cabinLight.position.set(0, 1.78, -0.15);
    group.add(cabinLight);

    engine.scene.add(group);
    dropPodRig = {
      group,
      fallbackGroup,
      glbMounted: false,
      leftDoor,
      rightDoor,
      lockClamp,
      reentryGroup,
      strobeMat,
      amberMat,
      cabinLight,
      glbDoorX: 0.36,
      glbDoorZ: -0.88,
    };

    // Upgrade seamlessly to AAA sculpted Blender Orbital Drop Pod GLB
    MapPropFactory.getShared().mountProp(group, 'orbital_drop_pod', {
      cloneMaterials: true,
      castShadow: true,
      receiveShadow: true,
      onMounted: (inst) => {
        if (!dropPodRig || !inst || !inst.root) return;
        const gRoot = inst.root;
        const glbLeft = gRoot.getObjectByName('LeftDoor');
        const glbRight = gRoot.getObjectByName('RightDoor');
        const glbClamp = gRoot.getObjectByName('LockClamp');
        fallbackGroup.visible = false;
        dropPodRig.glbMounted = true;
        if (glbLeft) {
          dropPodRig.leftDoor = glbLeft;
          dropPodRig.glbDoorX = Math.abs(glbLeft.position.x) || 0.36;
          dropPodRig.glbDoorZ = glbLeft.position.z || -0.88;
        }
        if (glbRight) dropPodRig.rightDoor = glbRight;
        if (glbClamp) dropPodRig.lockClamp = glbClamp;
        gRoot.traverse((node) => {
          if (node.isMesh && node.material && /AmberBeacon/i.test(node.material.name || '')) {
            dropPodRig.strobeMat = node.material;
          }
        });
      },
    });

    return dropPodRig;
  }

  function buildDropOpsMetaText() {
    const isDailyMode = selectedMissionMode === 'daily';
    const isEndless = selectedMissionMode === 'endless';
    const modeName = isDailyMode ? '오늘의 작전' : isEndless ? '무한 강하' : '캠페인 작전';
    const heatTxt = isDailyMode
      ? (getTodayDailyModifier()?.name || '일일 특수 규칙')
      : `위협 ${selectedHeatLevel}단계`;
    return `${modeName} · ${heatTxt}`;
  }

  function beginDropPodIntro(spawnPos, yaw, mapIndex = 0) {
    const rig = ensureDropPodRig();
    if (!rig || !spawnPos) return false;
    clearLandedDropPod();

    const mapMeta = MAPS[mapIndex] || MAPS[0] || { code: '제09구역', name: '제09구역 · 폐허 메트로폴리스', subtitle: '' };
    dropPodIntro.active = true;
    dropPodIntro.elapsed = 0;
    dropPodIntro.phase = 'descent';
    dropPodIntro.impacted = false;
    dropPodIntro.unsealed = false;
    dropPodIntro.spawnPos = spawnPos.clone();
    dropPodIntro.yaw = yaw || 0;
    dropPodIntro.landDip = 0;
    dropPodIntro.landDipVel = 0;
    dropPodIntro.sectorMeta = mapMeta;
    dropPodIntro.opsMeta = buildDropOpsMetaText();

    const doorX = rig.glbDoorX || 0.36;
    const doorZ = rig.glbDoorZ || -0.88;
    rig.group.position.set(spawnPos.x, spawnPos.y + 22.0, spawnPos.z);
    rig.group.rotation.y = dropPodIntro.yaw;
    rig.group.visible = true;
    rig.leftDoor.position.set(-doorX, 0, doorZ);
    rig.leftDoor.rotation.y = 0;
    rig.rightDoor.position.set(doorX, 0, doorZ);
    rig.rightDoor.rotation.y = 0;
    if (rig.lockClamp) {
      rig.lockClamp.position.set(0, 1.38, -0.78);
      rig.lockClamp.visible = true;
    }
    rig.reentryGroup.visible = true;
    rig.strobeMat.color.setHex(0xef4444);
    rig.strobeMat.emissive.setHex(0xef4444);
    rig.cabinLight.color.setHex(0xef4444);
    rig.cabinLight.intensity = 4.5;

    engine.viewmodelScene.visible = false;
    const hudRootEl = document.getElementById('hud-root');
    if (hudRootEl) hudRootEl.classList.add('drop-intro-active');

    hudManager.updateDropIntroUI({
      active: true,
      phase: 'descent',
      stageLabel: '대기권 강하 · 충격 대비',
      altitudeM: 2400,
      tempC: 1120,
      countdown: '3',
      sectorCode: mapMeta.code,
      sectorName: mapMeta.name,
      opsMeta: dropPodIntro.opsMeta,
    });
    eventBus.emit(EVENTS.DROP_POD_PHASE, { phase: 'descent' });
    return true;
  }

  function finishDropPodIntro(skipped = false) {
    if (!dropPodIntro.active) return;
    dropPodIntro.active = false;
    dropPodIntro.phase = 'idle';

    const hudRootEl = document.getElementById('hud-root');
    if (hudRootEl) hudRootEl.classList.remove('drop-intro-active');
    hudManager.hideDropIntroUI();

    const sp = dropPodIntro.spawnPos;
    const yaw = dropPodIntro.yaw || 0;
    if (sp && playerController) {
      const fwdX = -Math.sin(yaw);
      const fwdZ = -Math.cos(yaw);
      const exitX = sp.x + fwdX * 2.55;
      const exitZ = sp.z + fwdZ * 2.55;
      const exitGround = collisionWorld
        ? collisionWorld.getGroundHeightAt(exitX, exitZ, sp.y + 1.5)
        : sp.y;
      if (Number.isFinite(exitGround) && exitGround >= sp.y - 0.6) {
        playerController.reset({ x: exitX, y: exitGround, z: exitZ }, yaw);
        parkLandedDropPodAt(sp, yaw, true);
      } else {
        playerController.reset(sp, yaw);
        clearLandedDropPod();
      }
    } else {
      clearLandedDropPod();
    }

    engine.viewmodelScene.visible = true;
    engine.setFov(playerController ? playerController.currentFov : 80);
    if (weaponSystem && typeof weaponSystem.triggerDeployDraw === 'function') {
      weaponSystem.triggerDeployDraw();
    }
    if (skipped && vfxManager && sp && !dropPodIntro.impacted) {
      vfxManager.spawnDropPodLanding(sp);
      eventBus.emit(EVENTS.DROP_POD_PHASE, { phase: 'impact' });
    }
    // Show Sector Arrival BEFORE WaveDirector emits WAVE_STARTED so banners queue cleanly without ever overlapping!
    hudManager.showSectorArrivalCard(
      dropPodIntro.sectorMeta || MAPS[0],
      dropPodIntro.opsMeta,
      1.85
    );
    if (!waveDirector._active) {
      waveDirector.start(selectedStartWaveIndex);
    }
    syncHudImmediate();
  }

  function updateDropPodIntro(dt) {
    if (!dropPodIntro.active || !dropPodRig || !dropPodIntro.spawnPos) return;
    dropPodIntro.elapsed += dt;
    const t = dropPodIntro.elapsed;
    const rig = dropPodRig;
    const sp = dropPodIntro.spawnPos;
    const yaw = dropPodIntro.yaw;

    // Allow instant Space or Click skip after brief 0.25s settle
    if (t >= 0.25 && (input.consumePressed('jump') || input.consumePressed('fire'))) {
      finishDropPodIntro(true);
      return;
    }

    const IMPACT_T = 1.38;
    const UNSEAL_T = 1.66;
    const END_T = 2.58;

    let camLocalZ = 0.34;
    let camPitchOffset = 0.04;
    let shakeMag = 0.0;
    let podY = sp.y;

    if (t < IMPACT_T) {
      const p = t / IMPACT_T;
      const easeIn = Math.pow(p, 2.15);
      podY = sp.y + (1 - easeIn) * 22.0;
      shakeMag = 0.014 + p * 0.018;
      camLocalZ = 0.34;
      camPitchOffset = 0.05 - p * 0.06;

      // Animate rushing reentry plasma & strobing crimson alert
      rig.reentryGroup.visible = true;
      rig.reentryGroup.children.forEach((st, idx) => {
        st.position.y = ((st.position.y + dt * 28.0) % 2.4) + 0.2;
        if (idx % 2 === 0) st.rotation.y += dt * 4;
      });
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 14.0));
      rig.strobeMat.emissiveIntensity = 1.4 + pulse * 3.8;
      rig.cabinLight.intensity = 2.2 + pulse * 4.5;

      engine.setFov(86 - p * 4);
      const cd = p < 0.34 ? '3' : p < 0.68 ? '2' : '1';
      hudManager.updateDropIntroUI({
        active: true,
        phase: 'descent',
        stageLabel: '대기권 돌입 · 충격 대비',
        altitudeM: Math.round((1 - easeIn) * 2400),
        tempC: Math.round(980 + p * 860),
        countdown: cd,
      });
    } else {
      podY = sp.y;
      rig.reentryGroup.visible = false;

      if (!dropPodIntro.impacted) {
        dropPodIntro.impacted = true;
        dropPodIntro.phase = 'impact';
        dropPodIntro.landDip = 0;
        dropPodIntro.landDipVel = -5.4;
        if (vfxManager) vfxManager.spawnDropPodLanding(sp);
        if (playerController && typeof playerController.addScreenShake === 'function') {
          playerController.addScreenShake(0.85);
        }
        eventBus.emit(EVENTS.DROP_POD_PHASE, { phase: 'impact' });

        rig.strobeMat.color.setHex(0x22c55e);
        rig.strobeMat.emissive.setHex(0x22c55e);
        rig.strobeMat.emissiveIntensity = 2.6;
        rig.cabinLight.color.setHex(0xfbbf24);
        rig.cabinLight.intensity = 3.8;
      }

      // Spring bounce from crash impact
      const acc = -150 * dropPodIntro.landDip - 20 * dropPodIntro.landDipVel;
      dropPodIntro.landDipVel += acc * dt;
      dropPodIntro.landDip += dropPodIntro.landDipVel * dt;

      if (t < UNSEAL_T) {
        shakeMag = Math.max(0, 0.03 * (1 - (t - IMPACT_T) / (UNSEAL_T - IMPACT_T)));
        engine.setFov(82);
        hudManager.updateDropIntroUI({
          active: true,
          phase: 'impact',
          stageLabel: '착지 충격 흡수 완료',
          altitudeM: 0,
          tempC: 640,
          countdown: '착지',
        });
      } else {
        if (!dropPodIntro.unsealed) {
          dropPodIntro.unsealed = true;
          dropPodIntro.phase = 'unseal';
          rig.lockClamp.visible = false;
          engine.viewmodelScene.visible = true;
          if (weaponSystem && typeof weaponSystem.triggerDeployDraw === 'function') {
            weaponSystem.triggerDeployDraw();
          }
          eventBus.emit(EVENTS.DROP_POD_PHASE, { phase: 'unseal' });
        }

        const up = Math.min(1, (t - UNSEAL_T) / (END_T - UNSEAL_T));
        const openEase = 1 - Math.pow(1 - up, 3);
        const doorX = rig.glbDoorX || 0.36;
        const doorZ = rig.glbDoorZ || -0.88;
        rig.leftDoor.position.set(-doorX - openEase * 0.72, 0, doorZ - openEase * 0.24);
        rig.leftDoor.rotation.y = openEase * 0.85;
        rig.rightDoor.position.set(doorX + openEase * 0.72, 0, doorZ - openEase * 0.24);
        rig.rightDoor.rotation.y = -openEase * 0.85;

        // Smooth camera step forward out of the open drop pod hatch onto combat apron
        camLocalZ = 0.34 - openEase * 2.89;
        camPitchOffset = -0.02 * (1 - openEase);
        engine.setFov(82 - openEase * 2);

        hudManager.updateDropIntroUI({
          active: true,
          phase: 'unseal',
          stageLabel: '장갑 해치 개방 · 출격',
          altitudeM: 0,
          tempC: Math.round(640 - openEase * 480),
          countdown: 'GO',
        });
      }
    }

    rig.group.position.set(sp.x, podY, sp.z);
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const jx = (Math.sin(t * 53) + Math.cos(t * 71)) * shakeMag;
    const jy = Math.sin(t * 64) * shakeMag;
    const worldX = sp.x + jx * cosY + camLocalZ * sinY;
    const worldZ = sp.z - jx * sinY + camLocalZ * cosY;
    const worldY = podY + 1.56 + dropPodIntro.landDip + jy;

    engine.camera.position.set(worldX, worldY, worldZ);
    engine.camera.rotation.order = 'YXZ';
    engine.camera.rotation.y = yaw + Math.cos(t * 47) * shakeMag * 0.5;
    engine.camera.rotation.x = camPitchOffset + Math.sin(t * 59) * shakeMag * 0.6;
    engine.camera.rotation.z = Math.sin(t * 43) * shakeMag * 0.9;
    engine.camera.updateMatrixWorld();

    if (t >= END_T) {
      finishDropPodIntro(false);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Scene Fade Transition Guard (300ms Blackout, Double-Click Safe)
  // ---------------------------------------------------------------------------
  function runFadeTransition(onBlackout, onComplete = null) {
    if (isTransitioning) return false;
    isTransitioning = true;

    if (sceneFade) {
      sceneFade.classList.add('active');
    }

    window.setTimeout(() => {
      try {
        if (typeof onBlackout === 'function') {
          onBlackout();
        }
      } finally {
        window.requestAnimationFrame(() => {
          if (sceneFade) {
            sceneFade.classList.remove('active');
          }
          window.setTimeout(() => {
            isTransitioning = false;
            if (typeof onComplete === 'function') {
              onComplete();
            }
          }, FADE_DURATION_MS);
        });
      }
    }, FADE_DURATION_MS);

    return true;
  }

  // ---------------------------------------------------------------------------
  // 4. Audio Gesture Unlock & Lazy GPU Runtime Initialization
  // ---------------------------------------------------------------------------
  function unlockAudioOnGesture() {
    if (!eventBus) {
      eventBus = new EventBus();
    }
    if (!soundEngine) {
      soundEngine = new SoundEngine(eventBus, engine ? engine.camera : null);
      soundEngine.setMasterVolume(settings.volume / 100);
      if (typeof soundEngine.setSfxVolume === 'function') {
        soundEngine.setSfxVolume(settings.sfxVolume / 100);
      }
      soundEngine.setMusicEnabled(settings.music);
      if (typeof soundEngine.setSceneMode === 'function') {
        soundEngine.setSceneMode(gameState === 'playing' || gameState === 'paused' || gameState === 'result' ? gameState : 'title');
      }
    }
    soundEngine.unlock();
  }

  const _handleFirstAudioGesture = () => {
    if (!soundEngine || !soundEngine.ctx || soundEngine.ctx.state !== 'running') {
      unlockAudioOnGesture();
    }
  };
  window.addEventListener('pointerdown', _handleFirstAudioGesture, { passive: true });
  window.addEventListener('keydown', _handleFirstAudioGesture, { passive: true });
  window.addEventListener('touchstart', _handleFirstAudioGesture, { passive: true });

  function showWebGLFallback(reason) {
    stopLoop();
    gameState = 'title';
    document.body.classList.remove('playing-active', 'touch-active', 'force-touch');
    if (sceneTitle) sceneTitle.classList.add('hidden');
    if (scenePlaying) scenePlaying.classList.add('hidden');
    if (sceneResult) sceneResult.classList.add('hidden');
    if (fallbackEl) fallbackEl.classList.remove('hidden');
    if (fallbackMsg && reason) {
      fallbackMsg.textContent = `WebGL 3D 렌더러를 초기화할 수 없습니다 (${reason}). 브라우저 하드웨어 가속을 활성화한 뒤 새로고침하세요.`;
    }
  }

  /**
   * Construct Engine, MapManager, WaveDirector & all 3D subsystems lazily on first DEPLOY
   * inside the 300ms #scene-fade blackout so Title screen boots with 0% GPU cost.
   */
  function ensureRuntimeInitialized() {
    if (runtimeReady) return true;
    if (!canvas) {
      showWebGLFallback('캔버스 요소 없음');
      return false;
    }

    try {
      engine = new Engine(canvas, settings.quality);
    } catch (err) {
      showWebGLFallback(err && err.message ? err.message : '그래픽 컨텍스트 생성 실패');
      return false;
    }

    if (!eventBus) {
      eventBus = new EventBus();
    }

    collisionWorld = new CollisionWorld();
    input = new InputManager(canvas);
    input.setSensitivity(settings.sensitivity);
    if (typeof input.setInvertY === 'function') {
      input.setInvertY(settings.invertY);
    }
    input.setControlMode(settings.controlMode);
    if (settings.controlMode === 'auto') {
      input.setTouchMode(isCoarsePointer());
    }

    playerController = new PlayerController(engine.camera, input, collisionWorld, eventBus);
    if (typeof playerController.setAdsSensitivityScale === 'function') {
      playerController.setAdsSensitivityScale(settings.adsSens);
    }
    if (typeof playerController.setScreenShakeScale === 'function') {
      playerController.setScreenShakeScale(settings.screenShake / 100);
    }
    mapManager = new MapManager(engine.scene, collisionWorld, engine);
    MapPropFactory.getShared().preloadProps().catch(() => {});
    arenaData = mapManager.loadMap(0);

    interactables = new Interactables(engine.scene, collisionWorld, eventBus, arenaData);
    vfxManager = new VfxManager(
      engine.scene,
      engine.viewmodelScene,
      engine.camera,
      engine.getQualityConfig()
    );

    weaponSystem = new WeaponSystem(
      engine.viewmodelScene,
      engine.scene,
      engine.camera,
      playerController,
      input,
      collisionWorld,
      vfxManager,
      eventBus
    );

    waveDirector = new WaveDirector(
      engine.scene,
      collisionWorld,
      eventBus,
      arenaData,
      vfxManager
    );

    if (!soundEngine) {
      soundEngine = new SoundEngine(eventBus, engine.camera);
    } else {
      soundEngine.camera = engine.camera;
    }
    soundEngine.setMasterVolume(settings.volume / 100);
    if (typeof soundEngine.setSfxVolume === 'function') {
      soundEngine.setSfxVolume(settings.sfxVolume / 100);
    }
    soundEngine.setMusicEnabled(settings.music);

    hudManager = new HudManager(eventBus, engine.camera);
    touchOverlay = new TouchOverlay(input, weaponSystem, () => {
      if (gameState === 'playing') {
        pauseGame();
      }
    });

    // Cross-subsystem hooks
    waveDirector.setSoundEngine(soundEngine);
    waveDirector.setInteractables(interactables);
    hudManager.setArenaData(arenaData, collisionWorld);
    hudManager.setWeaponSwitchHandler((slotIndex) => {
      if (gameState === 'playing' && !isTransitioning) {
        weaponSystem.switchLoadoutSlot(slotIndex);
      }
    });

    // Zero-stutter prewarm inside blackout: 23 pooled Enemy rigs + shadows + shader compilation
    waveDirector.prewarm();
    engine.bakeStaticShadows();
    engine.prewarmShaders();

    // EventBus combat & campaign wiring
    bindRuntimeEvents();

    // PC canvas / playing-scene click re-locks pointer & unlocks Web Audio cleanly
    const handlePlayPointerDown = (e) => {
      if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('button')) {
        return;
      }
      unlockAudioOnGesture();
      if (gameState === 'playing' && !isTransitioning && !isTouchActive() && !input.isPointerLocked()) {
        input.requestPointerLock();
      }
    };
    if (scenePlaying) {
      scenePlaying.addEventListener('pointerdown', handlePlayPointerDown);
    } else {
      canvas.addEventListener('pointerdown', handlePlayPointerDown);
    }

    runtimeReady = true;
    return true;
  }

  function bindRuntimeEvents() {
    eventBus.on(EVENTS.WEAPON_SWITCHED, () => {
      telemetry.lastSwapTime = telemetry.elapsedSec;
    });

    // VANGUARD-09 Special: Tactical Reload grants 2.5s rapid fire & stability
    eventBus.on(EVENTS.WEAPON_RELOADED, () => {
      if (playerController && playerController.mods && playerController.mods.thermalNova && waveDirector) {
        const pPos = playerController.position;
        const look = playerController.getLookDirection();
        const activeE = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
        for (let ei = 0; ei < activeE.length; ei++) {
          const e = activeE[ei];
          if (!e || !e.isAlive) continue;
          if (e.position.distanceTo(pPos) <= 9.0) {
            e.applyDamage(75, e.center || e.position, false, look, { isExplosion: true, knockback: 10 });
          }
        }
        if (vfxManager) vfxManager.spawnExplosion(pPos, 4.8, 0xf97316);
      }
      if (playerController && playerController.mods && playerController.mods.tacticalReload) {
        playerController.reloadBuffTimer = 2.5;
        if (hudManager && typeof hudManager.showAnnouncement === 'function') {
          hudManager.showAnnouncement('전술 리로드 집중', '2.5초 연사 속도 +25% · 반동 안정화', 'info');
        }
      }
    });

    // Tutorial event listeners
    eventBus.on(EVENTS.PLAYER_JUMPPAD, () => {
      if (tutorialState.active && tutorialState.step === 1) {
        tutorialState.didJumpPad = true;
        updateTutorialBannerUI();
      }
    });
    eventBus.on(EVENTS.BARREL_EXPLODED, () => {
      if (tutorialState.active && tutorialState.step === 1) {
        tutorialState.didBarrel = true;
        updateTutorialBannerUI();
      }
    });
    eventBus.on(EVENTS.PICKUP_COLLECTED, () => {
      if (tutorialState.active && tutorialState.step === 3) {
        tutorialState.pickedItem = true;
        updateTutorialBannerUI();
      }
    });
    eventBus.on(EVENTS.UPGRADE_SELECTED, () => {
      if (tutorialState.active && tutorialState.step === 6) {
        finishTutorial(true);
      }
    });

    // STRIDER-04 Special: Phase-Blink VFX on dash
    eventBus.on(EVENTS.PLAYER_DASH, () => {
      if (tutorialState.active && tutorialState.step === 1) {
        tutorialState.didDash = true;
        updateTutorialBannerUI();
      }
      if (playerController && playerController.mods && playerController.mods.phaseBlink && vfxManager) {
        vfxManager.spawnExplosion(playerController.position, 2.2, 0x00f0ff);
      }
    });

    // APEX-ZERO Special: Headshot Chain-Lightning Arc (7m radius, 50 dmg) + Ultimate Charge on hit
    eventBus.on(EVENTS.DAMAGE_DEALT, (p) => {
      if (!playerController || !p || !p.isEnemy) return;
      playerController.addUltCharge(p.isHeadshot ? 0.9 : 0.35);
      // Tactile Gunfeel: Micro-FOV punch & micro-hitstop on headshots / heavy hits
      if (p.isHeadshot || p.killed) {
        playerController.currentFov = Math.max(52, playerController.currentFov - (p.killed ? 2.4 : 1.3));
        playerController.addScreenShake(p.killed ? 0.14 : 0.07);
      }
      if (p.killed && (p.isHeadshot || p.weaponId === 'railgun' || p.weaponId === 'scattergun' || p.weaponId === 'repulsor')) {
        _hitstopTimer = Math.max(_hitstopTimer, p.weaponId === 'railgun' ? 0.036 : 0.024);
      }
      if (p.isHeadshot && playerController.mods && playerController.mods.chainLightning && waveDirector && p.point) {
        const activeEnemies = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
        let arcs = 0;
        for (let ei = 0; ei < activeEnemies.length && arcs < 3; ei++) {
          const e = activeEnemies[ei];
          if (!e || !e.isAlive || e.id === p.targetId) continue;
          const ePos = e.center || e.position;
          if (ePos.distanceTo(p.point) <= 7.0) {
            const dir = ePos.clone().sub(p.point).normalize();
            e.applyDamage(50, ePos, false, dir, { isExplosion: true, knockback: 4 });
            if (vfxManager && typeof vfxManager.spawnTracer === 'function') {
              vfxManager.spawnTracer(p.point, ePos, 0xff2a44, 0.045, true);
            }
            arcs++;
          }
        }
      }
    });

    // Front Energy Shield [E] Blocked VFX & Break Callout
    eventBus.on(EVENTS.GUARD_BLOCKED, (p) => {
      if (vfxManager && playerController) {
        const eye = playerController.getEyePosition();
        const dir = playerController.getLookDirection();
        const sparkPos = eye.clone().addScaledVector(dir, 1.1);
        const col = playerController.mods && playerController.mods.frameId === 'bastion' ? 0x22c55e : 0x38bdf8;
        vfxManager.spawnExplosion(sparkPos, p && p.guardBroken ? 2.4 : 1.0, col);
      }
      if (playerController && playerController.mods) {
        const gm = playerController.mods;
        if (gm.shieldToUlt && p && p.amount > 0) {
          playerController.addUltCharge(p.amount * 0.60);
        }
        if (gm.crossAegisConverter) {
          playerController.addUltCharge(4.0);
        }
        if (gm.shieldCounter && waveDirector) {
          const pPos = playerController.position;
          const look = playerController.getLookDirection();
          const activeE = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
          for (let ei = 0; ei < activeE.length; ei++) {
            const e = activeE[ei];
            if (!e || !e.isAlive) continue;
            if (e.position.distanceTo(pPos) <= 9.0) {
              e.applyDamage(45, e.center || e.position, false, look, { isExplosion: true, knockback: 12 });
            }
          }
          spawnUltShockRing(pPos, 9.0, 0x38bdf8, 0.45);
        }
        if (p && p.guardBroken && gm.synergyVanguard4 && waveDirector) {
          const pPos = playerController.position;
          const activeE = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
          for (let ei = 0; ei < activeE.length; ei++) {
            const e = activeE[ei];
            if (!e || !e.isAlive) continue;
            if (e.position.distanceTo(pPos) <= 10.0) {
              const dir = e.position.clone().sub(pPos).normalize();
              e.applyDamage(110, e.center || e.position, false, dir, { isExplosion: true, knockback: 18 });
            }
          }
          spawnUltShockRing(pPos, 10.5, 0x38bdf8, 0.65);
        }
      }
      if (p && p.guardBroken && hudManager && typeof hudManager.showAnnouncement === 'function') {
        hudManager.showAnnouncement('에너지 방패 파괴!', '2초 후 재충전 시작', 'danger');
      }
      if (gameState === 'playing' && !tutorialState.active) {
        incrementDailyStat('guardBlocks', 1);
      }
    });

    eventBus.on(EVENTS.ENEMY_KILLED, (p) => {
      if (!playerController) return;
      if (tutorialState.active && tutorialState.step === 2) {
        tutorialState.killsInStep++;
        updateTutorialBannerUI();
        if (tutorialState.killsInStep >= 2) {
          advanceTutorialStep(3);
        }
      }
      const tier = STYLE_TIERS[telemetry.styleTierIdx] || STYLE_TIERS[0];
      playerController.onEnemyKill(Boolean(p && p.isHeadshot));
      // Item 8: No HP or Shield recovery on kill
      if (p && p.combo > telemetry.maxCombo) {
        telemetry.maxCombo = p.combo;
      }
      if (playerController.mods && playerController.mods.killGuardBonus > 0 && playerController.guardBreakTimer <= 0) {
        playerController.guardEnergy = Math.min(playerController.maxGuardEnergy, playerController.guardEnergy + playerController.mods.killGuardBonus);
      }
      // APEX-ZERO Special: Kill instantly restores 1 dash + 2.5s Overdrive (infinite ammo + 30% RPM)
      if (playerController.mods && playerController.mods.apexOverdrive) {
        const maxD = playerController.mods.dashMax || 3;
        playerController.dashCharges = Math.min(maxD, (playerController.dashCharges || 0) + 1);
        playerController.dashOverdriveTimer = Math.max(playerController.dashOverdriveTimer || 0, 3.0);
      }

      // Track style points & combat highlight categories
      let pts = 12;
      let tag = '적 격파';
      const isAir = !playerController.isGrounded;
      const isSlide = Boolean(playerController.isSliding);
      const isQuickSwap = telemetry.elapsedSec - telemetry.lastSwapTime <= 2.5;
      const isHs = Boolean(p && p.isHeadshot);
      const isMelee = Boolean(p && p.isMelee);

      metaState.totalKillsAllTime = (metaState.totalKillsAllTime || 0) + 1;
      if (metaState.totalKillsAllTime >= 1) unlockAchievement('first_blood');
      if (metaState.totalKillsAllTime >= 50) unlockAchievement('kills_50');
      if (metaState.totalKillsAllTime >= 200) unlockAchievement('kills_200');
      if (telemetry.maxCombo >= 5) unlockAchievement('combo_5');
      if (waveDirector && waveDirector.headshots >= 15) unlockAchievement('hs_15');
      if (p && p.isBoss) {
        telemetry.bossKills++;
        _hitstopTimer = Math.max(_hitstopTimer, 0.065);
        playerController.addScreenShake(0.45);
      }
      if (p && p.archetypeId === 'cyber_mech_boss') unlockAchievement('first_clear');
      if (p && p.archetypeId === 'aegis_overlord_boss') unlockAchievement('citadel_clear');
      if (p && p.archetypeId === 'transcendent_omega_boss') unlockAchievement('abyss_clear');
      if (
        p &&
        (p.archetypeId === 'interceptor_drone' ||
          p.archetypeId === 'shock_breacher' ||
          p.archetypeId === 'rail_warden' ||
          p.archetypeId === 'mortar_artillery' ||
          p.archetypeId === 'vanguard_assassin')
      ) {
        telemetry.aegisEliteKills++;
        if (telemetry.aegisEliteKills >= 10) unlockAchievement('elite_slayer');
      }

      if (isMelee) { pts += 18; tag = '근접 처치!'; telemetry.meleeKills++; if (telemetry.meleeKills >= 5) unlockAchievement('melee_ace'); }
      else if (isAir) { pts += 18; tag = '공중 처치!'; telemetry.airKills++; if (telemetry.airKills >= 5) unlockAchievement('air_ace'); }
      else if (isSlide) { pts += 16; tag = '슬라이드 처치!'; telemetry.slideKills++; if (telemetry.slideKills >= 5) unlockAchievement('slide_ace'); }
      else if (isQuickSwap) { pts += 14; tag = '무기 전환 처치!'; telemetry.swapKills++; if (telemetry.swapKills >= 5) unlockAchievement('swap_ace'); }
      else if (isHs) { pts += 12; tag = '정밀 헤드샷!'; }
      if (isHs && tag !== '정밀 헤드샷!') pts += 8;
      addStylePoints(pts, tag);

      // Track weapon kill count + cumulative weapon mastery & daily quests
      const activeW = weaponSystem && weaponSystem.getActiveWeapon ? weaponSystem.getActiveWeapon() : null;
      if (activeW && activeW.shortName) {
        telemetry.weaponKills[activeW.shortName] = (telemetry.weaponKills[activeW.shortName] || 0) + 1;
      }
      if (!tutorialState.active) {
        if (activeW && activeW.id && metaState.weaponStats[activeW.id]) {
          metaState.weaponStats[activeW.id].kills += 1;
          if (isHs) metaState.weaponStats[activeW.id].headshots += 1;
          checkWeaponMasteryUnlocks(activeW.id, activeW.name);
        }
        incrementDailyStat('kills', 1);
        if (isHs) incrementDailyStat('headshots', 1);
        if (isMelee) incrementDailyStat('meleeKills', 1);
        if (isAir || isSlide) incrementDailyStat('mobilityKills', 1);
        if (p && p.isBoss) incrementDailyStat('bossKills', 1);
      }

      // Elite Variant Death Effects & Golden Supply Drone Jackpot
      const killedUnit = p && p.enemy;
      if (killedUnit && killedUnit.eliteAffix) {
        if (killedUnit.eliteAffix === 'supply_drone') {
          if (interactables) {
            interactables.spawnGoldDrop(killedUnit.position, 45);
            const dropPool = [0, 1, 2, 3, 4, 5, 6];
            interactables.spawnWeaponDrop(killedUnit.position, dropPool[Math.floor(Math.random() * dropPool.length)]);
          }
          addStylePoints(28, '보급 드론 격추!');
          unlockAchievement('drone_hunter');
        } else if (killedUnit.eliteAffix === 'overcharged' && waveDirector) {
          // Overcharged elite explodes on death, damaging nearby enemies too!
          if (vfxManager) vfxManager.spawnExplosion(killedUnit.position, 6.2, 0xef4444);
          const nearList = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
          for (let ei = 0; ei < nearList.length; ei++) {
            const e = nearList[ei];
            if (!e || !e.isAlive || e === killedUnit) continue;
            if (e.position.distanceTo(killedUnit.position) <= 6.5) {
              e.applyDamage(45, e.center || e.position, false, null, { isExplosion: true });
            }
          }
          if (playerController && playerController.position.distanceTo(killedUnit.position) <= 5.5) {
            const dmgMult = waveDirector && typeof waveDirector.getEffectiveEnemyDmgMult === 'function' ? waveDirector.getEffectiveEnemyDmgMult() : 1.0;
            playerController.applyDamage(Math.max(1, Math.round(18 * dmgMult)), killedUnit.position);
          }
        } else if (killedUnit.eliteAffix === 'splitter' && interactables) {
          interactables.spawnGoldDrop(killedUnit.position, 15);
          if (vfxManager) vfxManager.spawnExplosion(killedUnit.position, 3.2, 0xf59e0b);
        }
      }

      // Rare Card: Orbital Overload (Headshot kill triggers 7.5m arc shockwave dealing 65 damage)
      const mods = playerController.mods;
      const deadEnemy = p && p.enemy;
      if (isHs && mods && mods.orbitalOverload && deadEnemy && waveDirector) {
        const originPos = deadEnemy.center || deadEnemy.position;
        if (vfxManager) vfxManager.spawnExplosion(originPos, 5.2, 0x38bdf8);
        const nearList = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
        for (let ei = 0; ei < nearList.length; ei++) {
          const e = nearList[ei];
          if (!e || !e.isAlive || e === deadEnemy) continue;
          if (e.position.distanceTo(deadEnemy.position) <= 7.5) {
            e.applyDamage(65, e.center || e.position, false, null, { isExplosion: true, piercing: true });
          }
        }
        addStylePoints(14, '궤도 과부하!');
      }

      // Rare Card: Mark Contagion (jump T-4 mark to 2 nearest enemies within 10m + 25 dmg)
      if (mods && mods.markContagion && deadEnemy && (deadEnemy.markedTimer > 0 || isHs) && waveDirector) {
        const activeEnemies = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
        const nearby = [];
        for (let ei = 0; ei < activeEnemies.length; ei++) {
          const e = activeEnemies[ei];
          if (!e || !e.isAlive || e === deadEnemy) continue;
          const dist = e.position.distanceTo(deadEnemy.position);
          if (dist <= 10.0) nearby.push({ e, dist });
        }
        nearby.sort((a, b) => a.dist - b.dist);
        for (let ni = 0; ni < Math.min(2, nearby.length); ni++) {
          nearby[ni].e.markedTimer = 4.0;
          nearby[ni].e.applyDamage(25, nearby[ni].e.center || nearby[ni].e.position, false, null, { isExplosion: false });
        }
      }
    });

    eventBus.on(EVENTS.BARREL_EXPLODED, (p) => {
      if (p && (p.gimmickType === 'emp_pylon' || p.gimmickType === 'shield_relay')) {
        unlockAchievement('emp_tactician');
        addStylePoints(18, p.gimmickType === 'emp_pylon' ? 'EMP 과부하!' : '중계기 파괴!');
      }
      if (vfxManager && p && p.position) {
        const vfxHex = p.gimmickType === 'emp_pylon' ? 0xf59e0b : p.gimmickType === 'shield_relay' ? 0x38bdf8 : 0xff6a00;
        vfxManager.spawnExplosion(p.position, p.radius, vfxHex);
      }
    });

    eventBus.on(EVENTS.VOID_GATE_SHATTERED, (p) => {
      metaState.voidGatesDestroyed = (metaState.voidGatesDestroyed || 0) + 1;
      if (metaState.voidGatesDestroyed >= 3) unlockAchievement('abyss_gatebreaker');
      saveMetaState();
      addStylePoints(24, '차원 게이트 파괴!');
      if (vfxManager && p && p.position) {
        vfxManager.spawnExplosion(p.position, 4.5, 0xa855f7);
      }
    });

    eventBus.on(EVENTS.BOSS_TURRET_SHATTERED, (p) => {
      const allBroken = Boolean(p && p.allBroken);
      addStylePoints(allBroken ? 32 : 16, allBroken ? '방어막 링크 붕괴!' : '부유 포탑 파괴!');
    });

    eventBus.on(EVENTS.ENEMY_OVERLOAD, () => {
      addStylePoints(14, '과부하 연쇄 폭발!');
    });

    eventBus.on(EVENTS.WEAPON_FIRED, () => {
      if (gameState !== 'playing') return;
      telemetry.shotsFired++;
      telemetry.shotSeq++;
    });

    eventBus.on(EVENTS.DAMAGE_DEALT, (p) => {
      if (gameState !== 'playing' || !p) return;
      if (!p.isMelee && p.isEnemy && telemetry.lastHitShotSeq !== telemetry.shotSeq) {
        telemetry.lastHitShotSeq = telemetry.shotSeq;
        telemetry.shotsHit++;
      }
      // Card: Armor Piercer (+22% bonus piercing damage against shielded / boss foes)
      if (
        p.isEnemy &&
        p.amount > 0 &&
        !p.killed &&
        playerController &&
        playerController.mods &&
        playerController.mods.armorPiercer &&
        waveDirector
      ) {
        const list = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (e && e.id === p.targetId && e.isAlive) {
            if (e.archetype && (e.archetype.hasShield || e.archetype.isBoss)) {
              const bonus = Math.max(2, Math.round(p.amount * 0.22));
              e.applyDamage(bonus, p.point || e.center, false, null, { piercing: true });
            }
            break;
          }
        }
      }
    });

    eventBus.on(EVENTS.PLAYER_DAMAGED, (p) => {
      if (gameState === 'playing' && p && (p.healthDamage > 0 || p.shieldDamage > 0)) {
        telemetry.styleMeter = Math.max(0, telemetry.styleMeter - 20);
        telemetry.styleTierIdx = getStyleTier(telemetry.styleMeter);
        updateStyleHudUI();
        if (
          playerController &&
          playerController.mods &&
          playerController.mods.reactiveArmor &&
          waveDirector &&
          telemetry.elapsedSec - (telemetry._lastReactiveBlast || -99) >= 0.45
        ) {
          telemetry._lastReactiveBlast = telemetry.elapsedSec;
          const pPos = playerController.position;
          const activeE = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
          for (let ei = 0; ei < activeE.length; ei++) {
            const e = activeE[ei];
            if (!e || !e.isAlive) continue;
            if (e.position.distanceTo(pPos) <= 6.0) {
              const dir = e.position.clone().sub(pPos).normalize();
              e.applyDamage(40, e.center || e.position, false, dir, { isExplosion: true, knockback: 14 });
            }
          }
          spawnUltShockRing(pPos, 6.2, 0x38bdf8, 0.35);
        }
      }
      if (gameState === 'playing' && p && p.isFatal) {
        beginEndingSequence(false);
      }
    });

    eventBus.on(EVENTS.GOLD_COLLECTED, (p) => {
      if (!p || !p.amount) return;
      const styleTier = STYLE_TIERS[telemetry.styleTierIdx] || STYLE_TIERS[0];
      const heatGoldMult = tutorialState.active
        ? 1.0
        : selectedMissionMode === 'daily'
        ? (getTodayDailyModifier().goldMult || 1.25)
        : (HEAT_CONTRACTS[selectedHeatLevel] || HEAT_CONTRACTS[0]).goldMult;
      const salvageMult =
        (playerController && playerController.mods && playerController.mods.salvageGoldMult) ||
        (1.0 + ((metaState.levels && metaState.levels.salvage) || 0) * 0.08);
      const gained = Math.max(1, Math.round(p.amount * styleTier.goldMult * heatGoldMult * salvageMult));
      metaState.gold += gained;
      telemetry.runGoldEarned += gained;
      saveMetaState();
      if (titleGoldBadge) titleGoldBadge.textContent = `${metaState.gold} G`;
    });

    eventBus.on(EVENTS.WAVE_CLEARED, (p) => {
      if (gameState === 'playing' && !tutorialState.active) {
        incrementDailyStat('waves', 1);
      }
      if (gameState === 'playing' && p && p.endlessLoopCleared) {
        tryUnlockNextHeat(selectedHeatLevel);
      }
      if (gameState === 'playing' && p && !p.isFinalWave) {
        window.setTimeout(() => {
          if (gameState === 'playing') openUpgradeDraft(p.wave || 1);
        }, 550);
      }
    });

    eventBus.on(EVENTS.WAVE_STARTED, () => {
      zoneAmmoRefilled = false;
    });

    eventBus.on(EVENTS.ZONE_PROGRESS, (p) => {
      if (gameState !== 'playing' || !p) return;
      if (p.captured && !zoneAmmoRefilled) {
        zoneAmmoRefilled = true;
        weaponSystem.addAmmo(1.0);
      } else if (!p.active || p.progress < 0.05) {
        zoneAmmoRefilled = false;
      }
    });

    eventBus.on(EVENTS.MAP_TRANSITION, (p) => {
      if (gameState !== 'playing' || !p) return;
      handleMapTransition(p.nextMapIndex);
    });

    eventBus.on(EVENTS.GAME_STATE, (p) => {
      const next = typeof p === 'string' ? p : p && p.state;
      if (next === 'victory' && gameState === 'playing') {
        beginEndingSequence(true);
      } else if (next === 'gameover' && gameState === 'playing') {
        beginEndingSequence(false);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Title Sub-Panels, Badges & Bi-Directional Settings Sync
  // ---------------------------------------------------------------------------
  function showTitleSubpanel(panelName) {
    activeTitleSubpanel = panelName;
    if (panelName !== 'arsenal') closeWeaponInspector();
    if (panelName !== 'armory') clearArmoryResetConfirm();
    if (sceneTitle) sceneTitle.classList.toggle('subpanel-open', panelName !== 'main');
    if (panelName === 'deploy') {
      lockedHeatFeedbackText = '';
      updateMissionConfigUI();
    }
    if (panelName === 'armory') renderArmoryUI();
    if (panelName === 'arsenal') {
      renderArsenalMasteryUI();
      renderArsenalPreviews();
    }
    if (panelName === 'main') {
      renderDailyPanel();
      updateDailyNavBadge();
    }
    if (panelName !== 'main' && missionDiamondWidget) {
      missionDiamondWidget.classList.remove('is-open');
      if (btnMissionDiamondTrigger) btnMissionDiamondTrigger.setAttribute('aria-expanded', 'false');
    }
    if (panelName === 'leaderboard') renderLeaderboardPanel(false);
    if (panelName === 'achievements') renderMedalsStrip();
    if (titleMenuMain) titleMenuMain.classList.toggle('hidden', panelName !== 'main');
    if (panelDeploy) panelDeploy.classList.toggle('hidden', panelName !== 'deploy');
    if (panelArmory) panelArmory.classList.toggle('hidden', panelName !== 'armory');
    if (panelArsenal) panelArsenal.classList.toggle('hidden', panelName !== 'arsenal');
    if (panelLeaderboard) panelLeaderboard.classList.toggle('hidden', panelName !== 'leaderboard');
    if (panelControls) panelControls.classList.toggle('hidden', panelName !== 'controls');
    if (panelSettings) panelSettings.classList.toggle('hidden', panelName !== 'settings');
    if (panelAchievements) panelAchievements.classList.toggle('hidden', panelName !== 'achievements');
  }

  function updateDeviceBadge() {
    const coarse = isCoarsePointer();
    if (titleDeviceBadge) {
      if (settings.controlMode === 'pc') {
        titleDeviceBadge.textContent = '입력: PC (마우스+키보드)';
      } else if (settings.controlMode === 'touch') {
        titleDeviceBadge.textContent = '입력: 터치 (수동)';
      } else {
        titleDeviceBadge.textContent = coarse
          ? '입력: 자동 (터치)'
          : '입력: 자동 (PC)';
      }
    }
    if (runtimeReady && input && settings.controlMode === 'auto') {
      input.setTouchMode(coarse);
    }
    syncTouchOverlayVisibility();
  }

  function applyControlMode(mode) {
    const key = mode === 'pc' || mode === 'touch' ? mode : 'auto';
    settings.controlMode = key;

    if (titleSelControls && titleSelControls.value !== key) titleSelControls.value = key;
    if (pauseSelControls && pauseSelControls.value !== key) pauseSelControls.value = key;

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('force-touch', key === 'touch');
    }

    if (runtimeReady && input) {
      input.setControlMode(key);
      if (key === 'auto') {
        input.setTouchMode(isCoarsePointer());
      } else if (key === 'touch') {
        input.exitPointerLock();
      }
    }

    updateDeviceBadge();
    syncViewportUiScale();
    saveSettingsState();
  }

  function applyQuality(preset) {
    const key = String(preset || 'medium').toLowerCase();
    if (!QUALITY_PRESETS[key]) return;
    settings.quality = key;

    if (titleSelQuality && titleSelQuality.value !== key) titleSelQuality.value = key;
    if (pauseSelQuality && pauseSelQuality.value !== key) pauseSelQuality.value = key;
    if (titleQualityBadge) {
      titleQualityBadge.textContent = `품질: ${QUALITY_PRESETS[key].label || key}`;
    }

    if (runtimeReady && engine) {
      engine.setQuality(key);
      const qCfg = engine.getQualityConfig();
      if (mapManager) mapManager.setQuality(qCfg);
      if (vfxManager) vfxManager.setQuality(qCfg);
      engine.bakeStaticShadows();
    }
    saveSettingsState();
  }

  function applySensitivity(val) {
    const raw = Number(val);
    const s = Math.max(0.01, Math.min(2.49, Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 1.0));
    settings.sensitivity = s;
    const strVal = s.toFixed(2);
    const label = `${strVal}x`;

    if (titleRngSensitivity && titleRngSensitivity.value !== strVal) titleRngSensitivity.value = strVal;
    if (pauseRngSensitivity && pauseRngSensitivity.value !== strVal) pauseRngSensitivity.value = strVal;
    if (titleValSensitivity && document.activeElement !== titleValSensitivity) {
      titleValSensitivity.value = label;
    }
    if (pauseValSensitivity && document.activeElement !== pauseValSensitivity) {
      pauseValSensitivity.value = label;
    }

    if (runtimeReady && input) {
      input.setSensitivity(s);
    }
    saveSettingsState();
  }

  function applyVolume(val) {
    const v = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    settings.volume = v;
    const strVal = String(v);
    const label = `${v}%`;

    if (titleRngVolume && titleRngVolume.value !== strVal) titleRngVolume.value = strVal;
    if (pauseRngVolume && pauseRngVolume.value !== strVal) pauseRngVolume.value = strVal;
    if (titleValVolume) titleValVolume.textContent = label;
    if (pauseValVolume) pauseValVolume.textContent = label;

    if (soundEngine) {
      soundEngine.setMasterVolume(v / 100);
    }
    saveSettingsState();
  }

  function applyMusic(enabled) {
    const on = Boolean(enabled);
    settings.music = on;

    if (titleChkMusic && titleChkMusic.checked !== on) titleChkMusic.checked = on;
    if (pauseChkMusic && pauseChkMusic.checked !== on) pauseChkMusic.checked = on;

    if (on && !soundEngine && !_initializingSettings) {
      unlockAudioOnGesture();
    }
    if (soundEngine) {
      soundEngine.setMusicEnabled(on);
    }
    saveSettingsState();
  }

  function applyShowFps(enabled) {
    const on = Boolean(enabled);
    settings.showFps = on;

    if (titleChkFps && titleChkFps.checked !== on) titleChkFps.checked = on;
    if (pauseChkFps && pauseChkFps.checked !== on) pauseChkFps.checked = on;
    if (fpsCounterEl) fpsCounterEl.classList.toggle('hidden', !on);
    saveSettingsState();
  }

  function applyAdsSens(val) {
    const raw = Number(val);
    const s = Math.max(0.25, Math.min(1.5, Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0.56));
    settings.adsSens = s;
    const strVal = s.toFixed(2);
    const label = `${strVal}x`;

    if (titleRngAdsSens && titleRngAdsSens.value !== strVal) titleRngAdsSens.value = strVal;
    if (pauseRngAdsSens && pauseRngAdsSens.value !== strVal) pauseRngAdsSens.value = strVal;
    if (titleValAdsSens) titleValAdsSens.textContent = label;
    if (pauseValAdsSens) pauseValAdsSens.textContent = label;

    if (runtimeReady && playerController && typeof playerController.setAdsSensitivityScale === 'function') {
      playerController.setAdsSensitivityScale(s);
    }
    saveSettingsState();
  }

  function applyFov(val) {
    const raw = Number(val);
    const f = Math.max(70, Math.min(110, Math.round(Number.isFinite(raw) ? raw : 80)));
    settings.fov = f;
    const strVal = String(f);
    const label = `${f}°`;

    if (titleRngFov && titleRngFov.value !== strVal) titleRngFov.value = strVal;
    if (pauseRngFov && pauseRngFov.value !== strVal) pauseRngFov.value = strVal;
    if (titleValFov) titleValFov.textContent = label;
    if (pauseValFov) pauseValFov.textContent = label;

    if (runtimeReady && playerController) {
      const { mods } = computePlayerMods();
      playerController.applyModifiers(mods, false);
    }
    saveSettingsState();
  }

  function applyInvertY(enabled) {
    const on = Boolean(enabled);
    settings.invertY = on;

    if (titleChkInvertY && titleChkInvertY.checked !== on) titleChkInvertY.checked = on;
    if (pauseChkInvertY && pauseChkInvertY.checked !== on) pauseChkInvertY.checked = on;

    if (runtimeReady && input && typeof input.setInvertY === 'function') {
      input.setInvertY(on);
    }
    saveSettingsState();
  }

  function applySfxVolume(val) {
    const raw = Number(val);
    const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(raw) ? raw : 100)));
    settings.sfxVolume = v;
    const strVal = String(v);
    const label = `${v}%`;

    if (titleRngSfxVol && titleRngSfxVol.value !== strVal) titleRngSfxVol.value = strVal;
    if (pauseRngSfxVol && pauseRngSfxVol.value !== strVal) pauseRngSfxVol.value = strVal;
    if (titleValSfxVol) titleValSfxVol.textContent = label;
    if (pauseValSfxVol) pauseValSfxVol.textContent = label;

    if (soundEngine && typeof soundEngine.setSfxVolume === 'function') {
      soundEngine.setSfxVolume(v / 100);
    }
    saveSettingsState();
  }

  function applyScreenShake(val) {
    const raw = Number(val);
    const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(raw) ? raw : 100)));
    settings.screenShake = v;
    const strVal = String(v);
    const label = `${v}%`;

    if (titleRngShake && titleRngShake.value !== strVal) titleRngShake.value = strVal;
    if (pauseRngShake && pauseRngShake.value !== strVal) pauseRngShake.value = strVal;
    if (titleValShake) titleValShake.textContent = label;
    if (pauseValShake) pauseValShake.textContent = label;

    if (runtimeReady && playerController && typeof playerController.setScreenShakeScale === 'function') {
      playerController.setScreenShakeScale(v / 100);
    }
    saveSettingsState();
  }

  function syncTouchOverlayVisibility() {
    if (!touchOverlay) return;
    const show = gameState === 'playing' && isTouchActive();
    touchOverlay.setVisible(show, settings.controlMode === 'touch');
  }

  function syncHudImmediate() {
    if (!runtimeReady || !hudManager || !playerController || !weaponSystem || !waveDirector || !interactables) {
      return;
    }
    hudSnapshot.player = playerController.getStateSnapshot();
    hudSnapshot.weapon = weaponSystem.getCurrentWeaponState();
    hudSnapshot.crosshairSpread = 0.018;
    hudSnapshot.wave = waveDirector.getHudState();
    hudSnapshot.boss = waveDirector.getBossState();
    hudSnapshot.zone = interactables.getZoneState();
    hudSnapshot.enemies = waveDirector.getTargets();
    hudSnapshot.pickups = interactables.getPickups();
    hudSnapshot.voidGates = interactables.getActiveVoidGates ? interactables.getActiveVoidGates() : null;
    hudSnapshot.lowGravityZones = interactables.getActiveLowGravityZones ? interactables.getActiveLowGravityZones() : null;
    hudSnapshot.fps = engine ? engine.fps : 60;
    hudManager.update(0.016, hudSnapshot);
    if (touchOverlay) touchOverlay.syncState(hudSnapshot);
  }

  // ---------------------------------------------------------------------------
  // 6. Independent Scene State Machine & 3-Map Campaign Transitions
  // ---------------------------------------------------------------------------
  function startLoop() {
    if (rafId !== null) return;
    lastTime = performance.now();
    rafId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function startNewGame(startWaveIndex = 0, options = null) {
    if (isTransitioning) return;
    const maxWaveIdx = Math.max(0, WAVES.length - 1);
    const targetWaveIndex = Math.max(0, Math.min(maxWaveIdx, Math.floor(Number(startWaveIndex) || 0)));
    selectedStartWaveIndex = targetWaveIndex;
    const targetWaveCfg = WAVES[targetWaveIndex] || WAVES[0];
    const targetMapIndex =
      targetWaveCfg && typeof targetWaveCfg.mapIndex === 'number' ? targetWaveCfg.mapIndex : 0;
    const skipDropIntro = Boolean(options && options.skipDropIntro);

    closeWeaponInspector();
    unlockAudioOnGesture();
    if (soundEngine && typeof soundEngine.stopBgmHard === 'function') {
      soundEngine.stopBgmHard();
    }
    engageGameplayShortcutLock(true);

    runFadeTransition(
      () => {
        // Hide Title / Result / Pause & reveal Playing scene underneath opaque fade curtain
        if (sceneTitle) sceneTitle.classList.add('hidden');
        if (sceneResult) {
          sceneResult.classList.add('hidden');
          sceneResult.classList.remove('victory', 'defeat');
        }
        if (pausePanel) pausePanel.classList.add('hidden');
        if (upgradePanel) upgradePanel.classList.add('hidden');
        if (scenePlaying) scenePlaying.classList.remove('hidden');

        // Lazy WebGL init on first deploy (or reuse warmed runtime)
        const ok = ensureRuntimeInitialized();
        if (!ok) return;

        tutorialState.active = false;
        const _tb = document.getElementById('tutorial-banner');
        if (_tb) _tb.classList.add('hidden');
        // Load exact target sector map for selected stage (Wave 1 -> Map 0, Wave N -> WAVES[N-1].mapIndex)
        if (mapManager.getCurrentMapIndex() !== targetMapIndex) {
          if (interactables) {
            interactables.dispose();
            interactables = null;
          }
          arenaData = mapManager.loadMap(targetMapIndex);
          interactables = new Interactables(engine.scene, collisionWorld, eventBus, arenaData);
        } else {
          interactables.reset();
        }
        waveDirector.setArenaData(arenaData, interactables);
        hudManager.setArenaData(arenaData, collisionWorld);

        resetTelemetry();
        lastAdsFov = null;
        hadPointerLock = false;
        zoneAmmoRefilled = false;
        endingTimer = 0;
        endingIsVictory = false;
        endingFadeStarted = false;

        input.resetAll();
        input.setControlMode(settings.controlMode);
        if (settings.controlMode === 'auto') {
          input.setTouchMode(isCoarsePointer());
        }
        touchOverlay.reset();
        hudManager.reset();
        vfxManager.reset();
        waveDirector.reset();
        runCards = [];
        draftChoices = [];
        if (upgradePanel) upgradePanel.classList.add('hidden');
        const { mods: startMods } = computePlayerMods();
        const { primaryIndex, secondaryIndex } = getEquippedLoadoutIndices();
        playerController.applyModifiers(startMods, true);
        playerController.reset(arenaData.playerSpawn.pos, arenaData.playerSpawn.yaw);
        weaponSystem.reset(primaryIndex, secondaryIndex);
        syncCosmeticsToWeaponSystem();
        lastWeaponState = weaponSystem.getCurrentWeaponState();

        engine.viewmodelScene.visible = true;
        engine.resize();
        engine.setFov(playerController.currentFov);
        engine.bakeStaticShadows();
        engine.prewarmShaders();

        hudManager.setVisible(true);
        gameState = 'playing';
        document.body.classList.add('playing-active');
        syncTouchOverlayVisibility();

        eventBus.emit(EVENTS.GAME_STATE, { state: 'playing' });
        if (soundEngine && typeof soundEngine.setSceneMode === 'function') {
          soundEngine.setSceneMode('playing');
        }
        if (soundEngine && typeof soundEngine.setBgmTrack === 'function') {
          const initialTrack =
            typeof soundEngine.resolveTrackForWave === 'function'
              ? soundEngine.resolveTrackForWave(targetWaveIndex + 1, Boolean(targetWaveCfg && targetWaveCfg.isBossWave))
              : 'zone1_normal';
          soundEngine.setBgmTrack(initialTrack, true);
        }
        const maxUnlocked = Math.max(0, Math.min(HEAT_CONTRACTS.length - 1, metaState.maxUnlockedHeat || 0));
        if (selectedHeatLevel > maxUnlocked) selectedHeatLevel = maxUnlocked;
        const isDailyMode = selectedMissionMode === 'daily';
        const dailyMod = isDailyMode ? getTodayDailyModifier() : null;
        const heatProf = isDailyMode ? getCumulativeHeatProfile(0) : getCumulativeHeatProfile(selectedHeatLevel);
        const heatCfg = heatProf.cfg;
        waveDirector.endlessMode = selectedMissionMode === 'endless';
        waveDirector.endlessLoop = 0;
        waveDirector.globalEnemyHpMult = Math.min(2.50, heatCfg.enemyHpMult * (dailyMod && dailyMod.enemyHpMult ? dailyMod.enemyHpMult : 1.0));
        waveDirector.globalEnemyDmgMult = (heatCfg.enemyDmgMult || 1.0) * (dailyMod && dailyMod.enemyDmgMult ? dailyMod.enemyDmgMult : 1.0);
        waveDirector.globalEnemySpeedMult = (heatProf.enemySpeedMult || 1.0) * (dailyMod && dailyMod.enemySpeedMult ? dailyMod.enemySpeedMult : 1.0);
        waveDirector.globalEliteChance = isDailyMode && dailyMod && typeof dailyMod.eliteChance === 'number'
          ? dailyMod.eliteChance
          : (heatProf.eliteChance || 0.22);
        waveDirector.globalSpawnIntervalMult = (heatProf.spawnIntervalMult || 1.0) * (dailyMod && dailyMod.spawnIntervalMult ? dailyMod.spawnIntervalMult : 1.0);
        if (interactables) {
          interactables.enemyDamageMult = waveDirector.getEffectiveEnemyDmgMult();
        }
        const useDropIntro =
          !tutorialState.active &&
          !skipDropIntro &&
          beginDropPodIntro(arenaData.playerSpawn.pos, arenaData.playerSpawn.yaw, targetMapIndex);
        if (!useDropIntro) {
          clearLandedDropPod();
          if (!tutorialState.active) {
            const sectorMeta = MAPS[targetMapIndex] || MAPS[0];
            if (sectorMeta) {
              hudManager.showSectorArrivalCard(sectorMeta, buildDropOpsMetaText(), 1.85);
            }
          }
          waveDirector.start(targetWaveIndex);
        }
        syncHudImmediate();

        // Render one pre-warmed frame during blackout to bake shadows & upload textures
        engine.render();
        startLoop();
      },
      () => {
        if (gameState === 'playing' && runtimeReady && !isTouchActive()) {
          engageGameplayShortcutLock(false);
          input.requestPointerLock();
        }
      }
    );
  }

  function handleMapTransition(nextMapIndex) {
    if (!runtimeReady || gameState !== 'playing') return;
    if (soundEngine && typeof soundEngine.stopBgmHard === 'function') {
      soundEngine.stopBgmHard();
    }

    runFadeTransition(() => {
      if (gameState !== 'playing') return;

      input.resetAll();
      touchOverlay.reset();
      hudManager.clearCombatOverlays();
      zoneAmmoRefilled = false;

      if (interactables) {
        interactables.dispose();
        interactables = null;
      }

      clearLandedDropPod();
      arenaData = mapManager.loadMap(nextMapIndex);
      interactables = new Interactables(engine.scene, collisionWorld, eventBus, arenaData);
      vfxManager.reset();

      // Reset position/velocity to new sector spawn while preserving health, score, combo & ammo,
      // and granting a full Orbital Drop shield top-off
      const savedHealth = playerController.health;
      const savedShield = playerController.shield;
      playerController.reset(arenaData.playerSpawn.pos, arenaData.playerSpawn.yaw);
      playerController.health = Math.max(1, Math.min(playerController.maxHealth, savedHealth));
      playerController.shield = Math.max(0, Math.min(playerController.maxShield, savedShield));
      playerController.heal(0, playerController.maxShield);

      hudManager.setArenaData(arenaData, collisionWorld);
      engine.setFov(playerController.currentFov);
      engine.bakeStaticShadows();
      engine.prewarmShaders();

      const nextMeta = MAPS[nextMapIndex] || null;
      if (nextMeta) {
        hudManager.showSectorArrivalCard(nextMeta, buildDropOpsMetaText(), 1.9);
      }
      waveDirector.completeMapTransition(arenaData, interactables);
      if (vfxManager) {
        vfxManager.spawnTeleport(playerController.position, 0x38bdf8);
      }
      syncHudImmediate();
      engine.render();
    });
  }

  function pauseGame() {
    if (!runtimeReady || gameState !== 'playing' || isTransitioning) return;
    gameState = 'paused';
    pauseDebounce = 0.2;
    hadPointerLock = false;

    document.body.classList.remove('playing-active');
    releaseGameplayShortcutLock(false, true);
    input.exitPointerLock();
    input.resetAll();
    touchOverlay.setVisible(false);

    if (pausePanel) pausePanel.classList.remove('hidden');
    if (soundEngine && typeof soundEngine.setSceneMode === 'function') {
      soundEngine.setSceneMode('paused');
    }
    eventBus.emit(EVENTS.GAME_STATE, { state: 'paused' });
  }

  function resumeFromPause() {
    if (!runtimeReady || gameState !== 'paused' || isTransitioning) return;
    unlockAudioOnGesture();

    if (pausePanel) pausePanel.classList.add('hidden');
    gameState = 'playing';
    pauseDebounce = 0.15;
    input.resetAll();
    document.body.classList.add('playing-active');
    syncTouchOverlayVisibility();
    if (soundEngine && typeof soundEngine.setSceneMode === 'function') {
      soundEngine.setSceneMode('playing');
    }
    eventBus.emit(EVENTS.GAME_STATE, { state: 'playing' });

    if (!isTouchActive()) {
      engageGameplayShortcutLock(true);
      input.requestPointerLock();
    }
  }

  /**
   * 0.5s Death/Victory Slow-Motion Linger (0.25x sim speed, input disabled)
   * followed by 300ms fade curtain -> stopLoop() -> hide #scene-playing -> #scene-result.
   */
  function beginEndingSequence(isVictory) {
    if (gameState !== 'playing') return;
    gameState = 'ending';
    endingIsVictory = Boolean(isVictory);
    endingTimer = ENDING_LINGER_SEC;
    endingFadeStarted = false;
    hadPointerLock = false;
    lastAdsFov = null;

    document.body.classList.remove('playing-active');
    if (pausePanel) pausePanel.classList.add('hidden');

    if (input) {
      releaseGameplayShortcutLock(false, true);
      input.exitPointerLock();
      input.resetAll();
    }
    if (touchOverlay) {
      touchOverlay.setVisible(false);
    }

    if (!endingIsVictory && eventBus && waveDirector) {
      const waveHud = waveDirector.getHudState();
      eventBus.emit(EVENTS.GAME_STATE, {
        state: 'gameover',
        score: waveHud.score,
        kills: waveHud.kills,
        headshots: waveHud.headshots,
        wave: waveHud.wave,
      });
    }
  }

  function enterResultScene(isVictory) {
    stopLoop();
    gameState = 'result';
    hadPointerLock = false;
    document.body.classList.remove('playing-active');

    if (input) {
      releaseGameplayShortcutLock(false, false);
      input.exitPointerLock();
      input.resetAll();
    }
    if (touchOverlay) touchOverlay.setVisible(false);
    if (hudManager) {
      hudManager.setVisible(false);
      hudManager.clearCombatOverlays();
    }
    if (soundEngine) {
      soundEngine.setCombatIntensity(0);
      if (typeof soundEngine.stopBgmHard === 'function') {
        soundEngine.stopBgmHard();
      }
      if (typeof soundEngine.setSceneMode === 'function') {
        soundEngine.setSceneMode('result');
      }
    }
    if (pausePanel) pausePanel.classList.add('hidden');
    if (scenePlaying) scenePlaying.classList.add('hidden');
    if (sceneTitle) sceneTitle.classList.add('hidden');

    const waveHud = waveDirector ? waveDirector.getHudState() : {};
    const heatProf = getCumulativeHeatProfile(selectedHeatLevel);
    const dailyMod = getTodayDailyModifier();
    const isDailyMode = selectedMissionMode === 'daily';
    const isEndlessMode = selectedMissionMode === 'endless';
    // Compute personalized Combat Persona Title & Build Summary
    const maxStyle = (STYLE_TIERS[telemetry.maxStyleTierIdx] || STYLE_TIERS[0]).grade;
    let topWep = 'M41-A';
    let topWepKills = -1;
    for (const [k, v] of Object.entries(telemetry.weaponKills)) {
      if (v > topWepKills) { topWepKills = v; topWep = k; }
    }
    const runKills = waveHud.kills || 0;
    const runHs = waveHud.headshots || 0;
    const hsRate = runKills > 0 ? runHs / runKills : 0;
    let personaTitle = '[강철의 선봉장]';
    if (telemetry.maxStyleTierIdx >= 5) personaTitle = '[SSS 전장의 화신]';
    else if (telemetry.airKills >= 5) personaTitle = '[하늘의 학살자]';
    else if (telemetry.slideKills >= 5) personaTitle = '[슬라이드 폭주족]';
    else if (telemetry.meleeKills >= 4) personaTitle = '[고열 블레이드 검귀]';
    else if (hsRate >= 0.45 && runHs >= 5) personaTitle = '[냉혈 정밀 저격수]';
    else if (telemetry.swapKills >= 4) personaTitle = '[전술 무장 달인]';

    const titleEl = byId('debrief-persona-title');
    const sumEl = byId('debrief-build-summary');
    const stylePillEl = byId('debrief-style-pill');
    const threatBadgeEl = byId('debrief-threat-badge');
    const specialKillsEl = byId('debrief-special-kills');
    const buildTagsEl = byId('debrief-build-tags');
    const threatEffectsEl = byId('debrief-threat-effects');
    const weaponsListEl = byId('debrief-weapons-list');

    if (titleEl) titleEl.textContent = personaTitle;
    if (sumEl) {
      sumEl.textContent = `스타일 ${maxStyle} · 주력 무장 ${topWep} · 카드 ${runCards.length}장`;
    }
    if (stylePillEl) {
      stylePillEl.textContent = `STYLE ${maxStyle}`;
    }
    if (threatBadgeEl) {
      threatBadgeEl.textContent = tutorialState.active
        ? '전술 훈련장'
        : isDailyMode
        ? `${dailyMod.dayName} 작전 · ${dailyMod.name}`
        : `${isEndlessMode ? '무한 강하' : '캠페인'} · ${heatProf.cfg.label}`;
      threatBadgeEl.classList.toggle('daily', !tutorialState.active && isDailyMode);
    }
    if (specialKillsEl) {
      const specs = [
        { label: '공중', count: telemetry.airKills || 0 },
        { label: '슬라이드', count: telemetry.slideKills || 0 },
        { label: '근접', count: telemetry.meleeKills || 0 },
        { label: '무기전환', count: telemetry.swapKills || 0 },
      ];
      specialKillsEl.innerHTML = specs
        .map((sp) => `<span class="debrief-spec-item${sp.count > 0 ? ' active' : ''}">${sp.label} <strong>${sp.count}</strong></span>`)
        .join('<span class="debrief-sep">/</span>');
    }
    if (buildTagsEl) {
      const { tagCounts } = computePlayerMods();
      const pills = [];
      for (const key of ['assault', 'mobility', 'vanguard', 'tactical']) {
        const syn = SYNERGIES[key];
        const cnt = tagCounts[key] || 0;
        if (cnt >= 2 && syn) {
          pills.push(`<span class="debrief-tag-line syn" style="--tag-accent:${syn.color}">${syn.name} ${cnt >= 4 ? '(4)' : '(2)'}</span>`);
        }
      }
      for (let i = 0; i < CROSS_SYNERGIES.length; i++) {
        const csyn = CROSS_SYNERGIES[i];
        if (csyn.requires.every((r) => (tagCounts[r] || 0) >= 2)) {
          pills.push(`<span class="debrief-tag-line cross">${csyn.name}</span>`);
        }
      }
      const uniqueCards = [];
      const cardCounts = {};
      for (let i = 0; i < runCards.length; i++) {
        const cid = runCards[i];
        if (!cardCounts[cid]) uniqueCards.push(cid);
        cardCounts[cid] = (cardCounts[cid] || 0) + 1;
      }
      const maxShown = 6;
      for (let i = 0; i < Math.min(maxShown, uniqueCards.length); i++) {
        const cardObj = TACTICAL_CARDS.find((c) => c.id === uniqueCards[i]);
        const cLabel = cardObj ? cardObj.name : uniqueCards[i];
        const cntSuffix = cardCounts[uniqueCards[i]] > 1 ? ` ×${cardCounts[uniqueCards[i]]}` : '';
        pills.push(`<span class="debrief-tag-line">${cLabel}${cntSuffix}</span>`);
      }
      if (uniqueCards.length > maxShown) {
        pills.push(`<span class="debrief-tag-line">+${uniqueCards.length - maxShown}종</span>`);
      }
      buildTagsEl.innerHTML = pills.length > 0
        ? pills.join('')
        : '<span class="debrief-empty-note">전술 강화 카드를 장착하지 않고 단독 돌파했습니다.</span>';
    }
    if (threatEffectsEl) {
      if (tutorialState.active) {
        threatEffectsEl.innerHTML = '<span class="debrief-rule-item clean">표준 전술 훈련 프로토콜</span>';
      } else if (isDailyMode) {
        threatEffectsEl.innerHTML = `<span class="debrief-rule-item daily">[${dailyMod.dayName}] ${dailyMod.name} — ${dailyMod.desc}</span>`;
      } else if (heatProf.debuffs.length === 0) {
        threatEffectsEl.innerHTML = '<span class="debrief-rule-item clean">위협 0 · 표준 프로토콜 (제약 없음)</span>';
      } else {
        threatEffectsEl.innerHTML = heatProf.debuffs
          .map((d) => `<span class="debrief-rule-item${d.level >= 9 ? ' severe' : ''}">T${d.level} ${d.short}</span>`)
          .join('');
      }
    }

    // Update Endless Best Wave & Check End-of-Run Achievements
    const totalReachedWave = Math.max(1, waveHud.wave || 1);
    if (selectedMissionMode === 'endless' && totalReachedWave > metaState.bestEndlessWave) {
      metaState.bestEndlessWave = totalReachedWave;
      saveMetaState();
    }
    if (selectedMissionMode === 'endless' && totalReachedWave >= 8) unlockAchievement('endless_8');
    if (selectedMissionMode === 'endless' && totalReachedWave >= 12) {
      unlockAchievement('endless_12');
      unlockTitle('endless_survivor', true);
    }
    if (selectedMissionMode === 'endless' && totalReachedWave >= 15) unlockAchievement('endless_15');
    if (isVictory && !tutorialState.active) {
      unlockAchievement('first_clear');
      unlockAchievement('citadel_clear');
      unlockAchievement('abyss_clear');
      tryUnlockNextHeat(selectedHeatLevel);
      checkHeatMilestoneRewards(selectedHeatLevel);
    }
    saveMetaState();
    renderMedalsStrip();
    updateMissionConfigUI();
    updateDailyNavBadge();

    const resFrame = getEquippedFrame();
    const resImg = byId('result-pilot-img');
    const resName = byId('result-pilot-name');
    const resTier = byId('result-pilot-tier');
    const stageMark = byId('debrief-stage-watermark');
    if (sceneResult) {
      sceneResult.style.setProperty('--pilot-accent', resFrame.color || '#f59e0b');
    }
    if (stageMark) {
      stageMark.textContent = resFrame.name;
    }
    if (resImg) {
      const outcomeKey = isVictory ? 'victory' : 'defeat';
      const outcomeSrc =
        PILOT_FRAME_OUTCOME_ART &&
        PILOT_FRAME_OUTCOME_ART[resFrame.id] &&
        PILOT_FRAME_OUTCOME_ART[resFrame.id][outcomeKey];
      resImg.src = outcomeSrc || (PILOT_FRAME_ART && PILOT_FRAME_ART[resFrame.id]) || '';
    }
    if (resName) {
      resName.textContent = resFrame.name;
      resName.style.color = resFrame.color || '#f5f5f4';
    }
    if (resTier) resTier.textContent = resFrame.tier || '전술 기체';

    const loNow = weaponSystem && weaponSystem.getLoadoutInfo ? weaponSystem.getLoadoutInfo() : null;
    if (weaponsListEl) {
      const rows = [];
      if (loNow && loNow.primaryWeapon) {
        const w1 = loNow.primaryWeapon;
        const k1 = telemetry.weaponKills[w1.shortName] || 0;
        const oc1 = loNow.primaryOverclock || 0;
        rows.push(`<div class="debrief-weapon-row"><div class="debrief-weapon-main"><span class="debrief-w-slot">주무기</span><strong>${w1.name}</strong>${oc1 > 0 ? `<em class="debrief-w-oc">OC +${oc1}</em>` : ''}</div><span class="debrief-w-kills">${k1} 킬</span></div>`);
      }
      if (loNow && loNow.secondaryWeapon) {
        const w2 = loNow.secondaryWeapon;
        const k2 = telemetry.weaponKills[w2.shortName] || 0;
        const oc2 = loNow.secondaryOverclock || 0;
        rows.push(`<div class="debrief-weapon-row"><div class="debrief-weapon-main"><span class="debrief-w-slot">보조</span><strong>${w2.name}</strong>${oc2 > 0 ? `<em class="debrief-w-oc">OC +${oc2}</em>` : ''}</div><span class="debrief-w-kills">${k2} 킬</span></div>`);
      }
      weaponsListEl.innerHTML = rows.join('');
    }

    const rewardsToast = byId('result-rewards-toast');
    if (rewardsToast) {
      if (telemetry.runUnlockedRewards && telemetry.runUnlockedRewards.length > 0) {
        rewardsToast.textContent = `이번 작전 해금 보상: ${telemetry.runUnlockedRewards.join(' · ')}`;
        rewardsToast.classList.remove('hidden');
      } else {
        rewardsToast.classList.add('hidden');
      }
    }

    const eqPrimaryW = loNow && loNow.primaryWeapon ? loNow.primaryWeapon.id : 'pulse_rifle';
    lastRunRecordPayload = {
      mode: selectedMissionMode,
      dateKey: selectedMissionMode === 'daily' ? getTodayDateKey() : 'all',
      score: Math.round(waveHud.score || 0),
      wave: totalReachedWave,
      heat: selectedHeatLevel,
      kills: waveHud.kills || 0,
      headshots: waveHud.headshots || 0,
      elapsedSec: telemetry.elapsedSec || 0,
      frameId: resFrame.id,
      primaryWeaponId: eqPrimaryW,
    };

    renderTitleBadgeUI();
    const resCallsignInput = byId('result-callsign-input');
    if (resCallsignInput) resCallsignInput.value = metaState.callsign || 'PILOT';
    const submitBtn = byId('btn-submit-leaderboard');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '글로벌 랭킹 등록';
    }
    const lbStatusEl = byId('result-leaderboard-status');
    if (lbStatusEl) {
      lbStatusEl.textContent = tutorialState.active
        ? '전술 훈련장 기록은 글로벌 랭킹에 등록되지 않습니다.'
        : '호출부호와 장착 칭호를 포함해 글로벌 랭킹에 기록을 등록합니다.';
    }
    if (submitBtn) submitBtn.disabled = Boolean(tutorialState.active);
    if (btnRedeploy) {
      btnRedeploy.textContent = tutorialState.active ? '훈련 재투입' : '다시 출격';
    }

    if (hudManager) {
      hudManager.showEndScreen(isVictory, {
        score: waveHud.score || 0,
        goldEarned: telemetry.runGoldEarned || 0,
        kills: waveHud.kills || 0,
        bossKills: telemetry.bossKills || 0,
        headshots: waveHud.headshots || 0,
        shotsFired: telemetry.shotsFired,
        shotsHit: telemetry.shotsHit,
        maxCombo: Math.max(telemetry.maxCombo, waveHud.combo || 1),
        wave: Math.max(1, waveHud.wave || 1),
        totalWaves: waveHud.totalWaves || WAVES.length,
        elapsedSec: telemetry.elapsedSec,
        mode: selectedMissionMode,
        heatLevel: selectedHeatLevel,
        isTutorial: Boolean(tutorialState.active),
      });
    } else if (sceneResult) {
      sceneResult.classList.remove('hidden');
    }
  }

  function returnToTitle() {
    if (isTransitioning || gameState === 'title') return;
    if (soundEngine && typeof soundEngine.stopBgmHard === 'function') {
      soundEngine.stopBgmHard();
    }

    runFadeTransition(() => {
      stopLoop();
      gameState = 'title';
      hadPointerLock = false;
      lastAdsFov = null;
      zoneAmmoRefilled = false;
      endingTimer = 0;
      endingFadeStarted = false;
      document.body.classList.remove('playing-active');

      if (runtimeReady) {
        dropPodIntro.active = false;
        dropPodIntro.phase = 'idle';
        clearLandedDropPod();
        const hudRootEl = document.getElementById('hud-root');
        if (hudRootEl) hudRootEl.classList.remove('drop-intro-active');
        releaseGameplayShortcutLock(false, false);
        input.exitPointerLock();
        input.resetAll();
        touchOverlay.setVisible(false);
        hudManager.setVisible(false);
        hudManager.hideEndScreen();
        hudManager.reset();
        waveDirector.reset();
        if (interactables) interactables.reset();
        vfxManager.reset();
        const { primaryIndex, secondaryIndex } = getEquippedLoadoutIndices();
        weaponSystem.reset(primaryIndex, secondaryIndex);
        if (soundEngine) soundEngine.setCombatIntensity(0);
        eventBus.emit(EVENTS.GAME_STATE, { state: 'title' });
      }
      tutorialState.active = false;
      tutorialState.step = 0;
      const tutBanner = document.getElementById('tutorial-banner');
      if (tutBanner) tutBanner.classList.add('hidden');
      if (soundEngine) {
        if (typeof soundEngine.setSceneMode === 'function') {
          soundEngine.setSceneMode('title');
        }
        if (typeof soundEngine.setBgmTrack === 'function') {
          soundEngine.setBgmTrack('main_theme', true);
        }
      }

      if (pausePanel) pausePanel.classList.add('hidden');
      if (upgradePanel) upgradePanel.classList.add('hidden');
      renderArmoryUI();
      renderDailyPanel();
      updateDailyNavBadge();
      if (scenePlaying) scenePlaying.classList.add('hidden');
      if (sceneResult) {
        sceneResult.classList.add('hidden');
        sceneResult.classList.remove('victory', 'defeat');
      }
      if (sceneTitle) sceneTitle.classList.remove('hidden');
      showTitleSubpanel('main');
      updateDeviceBadge();
    });
  }

  // ---------------------------------------------------------------------------
  // 6.5. Post-Apocalyptic Cold-Steel Metallic UI Switch Audio (Zero WebGL)
  // ---------------------------------------------------------------------------
  let uiAudioCtx = null;
  let uiNoiseBuffer = null;
  function _getUiAudioContext() {
    if (soundEngine && soundEngine.ctx && soundEngine.ctx.state !== 'closed') {
      if (soundEngine.ctx.state === 'suspended') {
        try { soundEngine.ctx.resume(); } catch {}
      }
      return soundEngine.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!uiAudioCtx) uiAudioCtx = new AC();
    if (uiAudioCtx.state === 'suspended') {
      try { uiAudioCtx.resume(); } catch {}
    }
    return uiAudioCtx;
  }

  function _getUiNoiseBuffer(ctx) {
    if (uiNoiseBuffer && uiNoiseBuffer.sampleRate === ctx.sampleRate) return uiNoiseBuffer;
    const len = Math.max(512, Math.floor(ctx.sampleRate * 0.16));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = Math.random() * 2 - 1;
    }
    uiNoiseBuffer = buf;
    return buf;
  }

  function playUiSfx(kind = 'click') {
    try {
      const vol = Math.max(0, Math.min(1, (settings.volume || 78) / 100));
      if (vol <= 0.01) return;
      const ctx = _getUiAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const out = ctx.createGain();
      out.gain.setValueAtTime(vol, now);
      out.connect(ctx.destination);

      const triggerNoise = (startT, dur, peak, hpFreq, bpFreq, qVal) => {
        const src = ctx.createBufferSource();
        src.buffer = _getUiNoiseBuffer(ctx);
        const f = ctx.createBiquadFilter();
        f.type = bpFreq ? 'bandpass' : 'highpass';
        f.frequency.setValueAtTime(bpFreq || hpFreq || 3400, startT);
        f.Q.setValueAtTime(qVal || 2.8, startT);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, startT);
        g.gain.linearRampToValueAtTime(peak, startT + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
        src.connect(f);
        f.connect(g);
        g.connect(out);
        src.start(startT);
        src.stop(startT + dur + 0.01);
      };

      const triggerMetalRing = (startT, freqs, dur, peak, type = 'triangle') => {
        for (let i = 0; i < freqs.length; i++) {
          const osc = ctx.createOscillator();
          osc.type = i === 0 ? type : 'sine';
          osc.frequency.setValueAtTime(freqs[i], startT);
          osc.frequency.exponentialRampToValueAtTime(freqs[i] * 0.985, startT + dur);
          const g = ctx.createGain();
          const pGain = peak / (1 + i * 0.55);
          g.gain.setValueAtTime(0.0001, startT);
          g.gain.linearRampToValueAtTime(pGain, startT + 0.0025);
          g.gain.exponentialRampToValueAtTime(0.0001, startT + dur * (1 - i * 0.14));
          osc.connect(g);
          g.connect(out);
          osc.start(startT);
          osc.stop(startT + dur + 0.015);
        }
      };

      const triggerBoltThud = (startT, startHz, endHz, dur, peak) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(startHz, startT);
        osc.frequency.exponentialRampToValueAtTime(endHz, startT + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, startT);
        g.gain.linearRampToValueAtTime(peak, startT + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
        osc.connect(g);
        g.connect(out);
        osc.start(startT);
        osc.stop(startT + dur + 0.01);
      };

      if (kind === 'deploy') {
        // Heavy armored steel hatch slam + cold steel resonance
        triggerBoltThud(now, 155, 42, 0.13, 0.24);
        triggerNoise(now, 0.065, 0.17, 0, 2200, 2.2);
        triggerMetalRing(now, [420, 1085, 1960, 3140], 0.19, 0.095, 'sawtooth');
        triggerMetalRing(now + 0.045, [760, 1680, 2740], 0.15, 0.075, 'triangle');
      } else if (kind === 'buy') {
        // Heavy gunmetal anvil lock-in + forged steel confirmation ring
        triggerBoltThud(now, 210, 68, 0.065, 0.18);
        triggerNoise(now, 0.032, 0.14, 0, 3400, 3.0);
        triggerMetalRing(now, [620, 1480, 2410], 0.11, 0.085, 'triangle');
        triggerNoise(now + 0.052, 0.04, 0.12, 0, 4200, 3.5);
        triggerMetalRing(now + 0.052, [880, 1890, 3260, 4480], 0.21, 0.095, 'triangle');
      } else if (kind === 'back') {
        // Retracting cold steel bolt latch
        triggerBoltThud(now, 175, 58, 0.052, 0.14);
        triggerNoise(now, 0.028, 0.12, 0, 2600, 2.6);
        triggerMetalRing(now, [960, 1690, 2620], 0.095, 0.072, 'triangle');
      } else if (kind === 'tab') {
        // Precision steel detent click
        triggerNoise(now, 0.018, 0.11, 0, 4600, 3.6);
        triggerMetalRing(now, [1540, 2630, 4080], 0.058, 0.068, 'triangle');
      } else {
        // Crisp industrial gunmetal switch clack (default Main Title click)
        triggerBoltThud(now, 215, 76, 0.038, 0.14);
        triggerNoise(now, 0.024, 0.14, 0, 3600, 3.2);
        triggerMetalRing(now, [1280, 2190, 3580], 0.085, 0.082, 'triangle');
      }
    } catch {}
  }

  document.addEventListener('click', (e) => {
    if (gameState === 'playing') return;
    const target = e.target;
    if (!target || !target.closest) return;
    const btn = target.closest('button, [role="tab"], [role="radio"]');
    if (btn) {
      if (btn.disabled) return;
      const id = btn.id || '';
      if (
        btn.classList.contains('armory-buy-btn') ||
        btn.classList.contains('ach-claim-btn') ||
        btn.classList.contains('daily-claim-btn') ||
        id === 'btn-daily-checkin'
      ) {
        playUiSfx('buy');
      } else if (
        btn.classList.contains('deploy-btn') ||
        btn.classList.contains('deploy-launch-btn') ||
        (btn.classList.contains('primary') && !btn.classList.contains('small'))
      ) {
        playUiSfx('deploy');
      } else if (
        id.endsWith('-back') ||
        id === 'btn-attendance-close' ||
        id === 'btn-attendance-later' ||
        id === 'btn-weapon-inspector-close' ||
        btn.classList.contains('danger')
      ) {
        playUiSfx('back');
      } else if (
        btn.classList.contains('armory-tab') ||
        btn.classList.contains('deploy-mode-tab') ||
        btn.classList.contains('deploy-heat-btn') ||
        btn.classList.contains('lb-mode-tab') ||
        btn.classList.contains('ach-filter-btn') ||
        btn.classList.contains('cosmetic-card') ||
        btn.classList.contains('skin-chip') ||
        btn.classList.contains('skin-chip-btn')
      ) {
        playUiSfx('tab');
      } else {
        playUiSfx('click');
      }
      return;
    }
    const chk = target.closest('input[type="checkbox"]');
    if (chk && !chk.disabled) {
      playUiSfx('tab');
    }
  });

  document.addEventListener('change', (e) => {
    if (gameState === 'playing') return;
    const target = e.target;
    if (target && target.tagName === 'SELECT') {
      playUiSfx('tab');
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (gameState === 'playing') return;
    const target = e.target;
    if (target && target.tagName === 'INPUT' && target.type === 'range') {
      playUiSfx('tab');
    }
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // 7. DOM Event Bindings (Title, Pause, Result & Live Settings Sync)
  // ---------------------------------------------------------------------------
  if (btnDeploy) btnDeploy.addEventListener('click', () => showTitleSubpanel('deploy'));
  if (btnDeployBack) btnDeployBack.addEventListener('click', () => showTitleSubpanel('main'));
  if (btnDeployLaunch) btnDeployLaunch.addEventListener('click', () => startNewGame(0, { skipDropIntro: false }));
  if (btnTitleArmory) btnTitleArmory.addEventListener('click', () => showTitleSubpanel('armory'));
  if (btnArmoryBack) btnArmoryBack.addEventListener('click', () => showTitleSubpanel('main'));
  if (btnTitleArsenal) btnTitleArsenal.addEventListener('click', () => showTitleSubpanel('arsenal'));
  if (btnTitleLeaderboard) btnTitleLeaderboard.addEventListener('click', () => showTitleSubpanel('leaderboard'));
  if (btnTitleControls) btnTitleControls.addEventListener('click', () => showTitleSubpanel('controls'));
  if (btnTitleSettings) btnTitleSettings.addEventListener('click', () => showTitleSubpanel('settings'));
  if (btnTitleAchievements) btnTitleAchievements.addEventListener('click', () => showTitleSubpanel('achievements'));

  if (btnArsenalBack) btnArsenalBack.addEventListener('click', () => showTitleSubpanel('main'));
  if (btnLeaderboardBack) btnLeaderboardBack.addEventListener('click', () => showTitleSubpanel('main'));
  if (btnControlsBack) btnControlsBack.addEventListener('click', () => showTitleSubpanel('main'));
  if (btnSettingsBack) btnSettingsBack.addEventListener('click', () => showTitleSubpanel('main'));
  if (btnAchievementsBack) btnAchievementsBack.addEventListener('click', () => showTitleSubpanel('main'));

  if (btnMissionDiamondTrigger && missionDiamondWidget) {
    btnMissionDiamondTrigger.addEventListener('click', () => {
      const next = !missionDiamondWidget.classList.contains('is-open');
      missionDiamondWidget.classList.toggle('is-open', next);
      btnMissionDiamondTrigger.setAttribute('aria-expanded', next ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!missionDiamondWidget.classList.contains('is-open')) return;
      if (e.target && missionDiamondWidget.contains(e.target)) return;
      missionDiamondWidget.classList.remove('is-open');
      btnMissionDiamondTrigger.setAttribute('aria-expanded', 'false');
    });
  }

  if (btnOpenAttendancePopup) {
    btnOpenAttendancePopup.addEventListener('click', () => openAttendancePopup());
  }
  if (btnAttendanceClose) {
    btnAttendanceClose.addEventListener('click', () => closeAttendancePopup());
  }
  if (btnAttendanceLater) {
    btnAttendanceLater.addEventListener('click', () => closeAttendancePopup());
  }
  if (attendancePopupModal) {
    attendancePopupModal.addEventListener('click', (e) => {
      if (e.target === attendancePopupModal) closeAttendancePopup();
    });
  }

  // Interactive 3D Weapon Inspector Bindings (Arsenal Briefing)
  document.querySelectorAll('#title-panel-arsenal .arsenal-card').forEach((cardEl) => {
    const previewBox = cardEl.querySelector('[data-weapon-preview]');
    const wid = previewBox ? previewBox.getAttribute('data-weapon-preview') : null;
    if (!wid) return;
    if (previewBox) {
      previewBox.setAttribute('role', 'button');
      previewBox.setAttribute('tabindex', '0');
      previewBox.setAttribute('aria-label', `${wid} 3D 회전 상세 보기`);
      previewBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playUiSfx('click');
          openWeaponInspector(wid);
        }
      });
    }
    cardEl.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.arsenal-mastery-slot')) return;
      playUiSfx('click');
      openWeaponInspector(wid);
    });
  });

  if (btnWeaponInspectorClose) {
    btnWeaponInspectorClose.addEventListener('click', () => closeWeaponInspector());
  }
  if (btnWeaponInspectorReset) {
    btnWeaponInspectorReset.addEventListener('click', () => {
      inspectorState.targetRotX = ARSENAL_DEFAULT_PITCH;
      inspectorState.targetRotY = ARSENAL_DEFAULT_YAW;
      inspectorState.targetZoom = 1.0;
    });
  }
  if (weaponInspectorModal) {
    weaponInspectorModal.addEventListener('click', (e) => {
      if (e.target === weaponInspectorModal) {
        playUiSfx('back');
        closeWeaponInspector();
      }
    });
  }
  if (weaponInspectorStage) {
    weaponInspectorStage.addEventListener('pointerdown', (e) => {
      if (!inspectorState.open) return;
      inspectorState.dragging = true;
      inspectorState.pointerId = e.pointerId;
      inspectorState.lastX = e.clientX;
      inspectorState.lastY = e.clientY;
      weaponInspectorStage.classList.add('is-dragging');
      try { weaponInspectorStage.setPointerCapture(e.pointerId); } catch {}
    });
    weaponInspectorStage.addEventListener('pointermove', (e) => {
      if (!inspectorState.open || !inspectorState.dragging || e.pointerId !== inspectorState.pointerId) return;
      const uiScale = getViewportUiScale() || 1;
      const dx = (e.clientX - inspectorState.lastX) / uiScale;
      const dy = (e.clientY - inspectorState.lastY) / uiScale;
      inspectorState.lastX = e.clientX;
      inspectorState.lastY = e.clientY;
      inspectorState.targetRotY += dx * 0.011;
      inspectorState.targetRotX = Math.max(-1.45, Math.min(1.45, inspectorState.targetRotX + dy * 0.011));
    });
    const endInspectorDrag = (e) => {
      if (!inspectorState.dragging || e.pointerId !== inspectorState.pointerId) return;
      inspectorState.dragging = false;
      inspectorState.pointerId = null;
      weaponInspectorStage.classList.remove('is-dragging');
      try { weaponInspectorStage.releasePointerCapture(e.pointerId); } catch {}
    };
    weaponInspectorStage.addEventListener('pointerup', endInspectorDrag);
    weaponInspectorStage.addEventListener('pointercancel', endInspectorDrag);
    weaponInspectorStage.addEventListener('wheel', (e) => {
      if (!inspectorState.open) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * 0.1;
      inspectorState.targetZoom = Math.max(0.55, Math.min(1.85, inspectorState.targetZoom + delta));
    }, { passive: false });
  }

  const btnDailyCheckin = byId('btn-daily-checkin');
  if (btnDailyCheckin) {
    btnDailyCheckin.addEventListener('click', () => claimAttendanceReward());
  }

  document.querySelectorAll('[data-lb-mode]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeLeaderboardMode = tab.getAttribute('data-lb-mode') || 'campaign';
      renderLeaderboardPanel(false);
    });
  });

  const btnLbRefresh = byId('btn-lb-refresh');
  if (btnLbRefresh) {
    btnLbRefresh.addEventListener('click', () => renderLeaderboardPanel(true));
  }

  async function handleGoogleAuthToggle(statusEl = null) {
    try {
      const cur = FirebaseService.getCurrentUser();
      if (cur) {
        await FirebaseService.signOutUser();
        updateLeaderboardIdentityUI();
        if (activeTitleSubpanel === 'leaderboard') renderLeaderboardPanel(false);
        if (statusEl) statusEl.textContent = '로그아웃 완료';
      } else {
        await FirebaseService.signInWithGoogle();
        updateLeaderboardIdentityUI();
        if (activeTitleSubpanel === 'leaderboard') renderLeaderboardPanel(false);
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = err && err.message ? err.message : '인증 오류';
    }
  }

  const btnLbAuth = byId('btn-lb-auth');
  if (btnLbAuth) {
    btnLbAuth.addEventListener('click', () => handleGoogleAuthToggle(byId('lb-auth-status')));
  }
  const btnTitleSettingAuth = byId('btn-title-setting-auth');
  if (btnTitleSettingAuth) {
    btnTitleSettingAuth.addEventListener('click', () =>
      handleGoogleAuthToggle(byId('title-setting-auth-status'))
    );
  }
  const btnPauseSettingAuth = byId('btn-pause-setting-auth');
  if (btnPauseSettingAuth) {
    btnPauseSettingAuth.addEventListener('click', () =>
      handleGoogleAuthToggle(byId('pause-setting-auth-status'))
    );
  }
  const btnTitleCloudSave = byId('btn-title-setting-cloud-save');
  if (btnTitleCloudSave) {
    btnTitleCloudSave.addEventListener('click', () => handleManualCloudSave());
  }
  const btnTitleCloudLoad = byId('btn-title-setting-cloud-load');
  if (btnTitleCloudLoad) {
    btnTitleCloudLoad.addEventListener('click', () => handleManualCloudLoad());
  }
  const btnPauseCloudSave = byId('btn-pause-setting-cloud-save');
  if (btnPauseCloudSave) {
    btnPauseCloudSave.addEventListener('click', () => handleManualCloudSave());
  }
  const btnPauseCloudLoad = byId('btn-pause-setting-cloud-load');
  if (btnPauseCloudLoad) {
    btnPauseCloudLoad.addEventListener('click', () => handleManualCloudLoad());
  }

  const btnLbSaveCallsign = byId('btn-lb-save-callsign');
  const lbCallsignInput = byId('lb-callsign-input');
  if (btnLbSaveCallsign && lbCallsignInput) {
    const commitCallsign = () => {
      metaState.callsign = FirebaseService.sanitizeCallsign(lbCallsignInput.value, 'PILOT');
      lbCallsignInput.value = metaState.callsign;
      saveMetaState();
      updateLeaderboardIdentityUI();
    };
    btnLbSaveCallsign.addEventListener('click', commitCallsign);
    lbCallsignInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitCallsign();
      }
    });
  }

  const btnSubmitLeaderboard = byId('btn-submit-leaderboard');
  const resultCallsignInput = byId('result-callsign-input');
  if (btnSubmitLeaderboard) {
    btnSubmitLeaderboard.addEventListener('click', async () => {
      if (!lastRunRecordPayload || tutorialState.active) return;
      const statusEl = byId('result-leaderboard-status');
      const typed = resultCallsignInput ? resultCallsignInput.value : metaState.callsign;
      metaState.callsign = FirebaseService.sanitizeCallsign(typed, 'PILOT');
      saveMetaState();
      renderTitleBadgeUI();
      if (resultCallsignInput) resultCallsignInput.value = metaState.callsign;

      const titleObj = getEquippedTitleObj();
      btnSubmitLeaderboard.disabled = true;
      btnSubmitLeaderboard.textContent = '등록 중...';
      if (statusEl) statusEl.textContent = '글로벌 데이터베이스에 기록을 전송하는 중입니다...';

      try {
        const res = await FirebaseService.submitLeaderboardRecord({
          ...lastRunRecordPayload,
          callsign: metaState.callsign,
          titleId: titleObj.id,
          titleLabel: titleObj.label,
        });
        if (res && res.keptHigherPrev) {
          if (statusEl) {
            statusEl.textContent = `호출부호·칭호 갱신 완료 (기존 최고 점수 ${Number(res.entry.score || 0).toLocaleString()}점 유지)`;
          }
        } else {
          if (statusEl) {
            statusEl.textContent = `글로벌 랭킹 최고 기록 등록 완료! ([${titleObj.label}] ${metaState.callsign})`;
          }
        }
        btnSubmitLeaderboard.textContent = '등록 완료';
      } catch (err) {
        btnSubmitLeaderboard.disabled = false;
        btnSubmitLeaderboard.textContent = '글로벌 랭킹 등록';
        if (statusEl) {
          statusEl.textContent = err && err.message ? err.message : '등록 실패 — 다시 시도해 주세요.';
        }
      }
    });
  }

  const btnResultOpenLb = byId('btn-result-open-lb');
  if (btnResultOpenLb) {
    btnResultOpenLb.addEventListener('click', () => {
      activeLeaderboardMode = (lastRunRecordPayload && lastRunRecordPayload.mode) || 'campaign';
      returnToTitle();
      window.setTimeout(() => {
        showTitleSubpanel('leaderboard');
      }, FADE_DURATION_MS + 40);
    });
  }

  document.querySelectorAll('[data-ach-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeAchCategory = btn.getAttribute('data-ach-cat') || 'all';
      document.querySelectorAll('[data-ach-cat]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      renderMedalsStrip();
    });
  });

  if (btnHudPause) {
    btnHudPause.addEventListener('click', (e) => {
      e.stopPropagation();
      if (gameState === 'playing') pauseGame();
    });
  }
  function redeployCurrentRun() {
    if (tutorialState.active) {
      startTutorialRun();
    } else {
      const skipDrop =
        testModeActive && Boolean(chkTestSkipDroppod && chkTestSkipDroppod.checked);
      startNewGame(selectedStartWaveIndex, { skipDropIntro: skipDrop });
    }
  }

  if (btnResume) btnResume.addEventListener('click', () => resumeFromPause());
  if (btnRestartPause) btnRestartPause.addEventListener('click', () => redeployCurrentRun());
  if (btnQuitTitle) btnQuitTitle.addEventListener('click', () => returnToTitle());
  if (btnRedeploy) btnRedeploy.addEventListener('click', () => redeployCurrentRun());
  if (btnEndTitle) btnEndTitle.addEventListener('click', () => returnToTitle());

  // ESC closes open Title sub-panels and prevents unintended fullscreen exit; 1/2/3 picks cards
  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';
    if (e.code === 'Escape' && document.fullscreenElement) {
      if (gameState === 'playing' || gameState === 'paused' || gameState === 'upgrading' || gameState === 'title') {
        e.preventDefault();
      }
    }
    if (isTyping && e.code !== 'Escape') return;
    if (gameState === 'title' && e.code === 'Escape') {
      if (weaponInspectorModal && !weaponInspectorModal.classList.contains('hidden')) {
        playUiSfx('back');
        closeWeaponInspector();
      } else if (attendancePopupModal && !attendancePopupModal.classList.contains('hidden')) {
        playUiSfx('back');
        closeAttendancePopup();
      } else if (activeTitleSubpanel !== 'main') {
        playUiSfx('back');
        showTitleSubpanel('main');
      }
    } else if (gameState === 'upgrading') {
      if (e.code === 'Digit1') selectUpgradeCard(0);
      else if (e.code === 'Digit2') selectUpgradeCard(1);
      else if (e.code === 'Digit3') selectUpgradeCard(2);
    }
  });

  // Auto-pause cleanly when PC player presses ESC to exit PointerLock
  document.addEventListener('pointerlockchange', () => {
    if (!runtimeReady || !input) return;
    const locked = input.isPointerLocked();
    if (locked) {
      hadPointerLock = true;
    } else if (hadPointerLock && gameState === 'playing' && !isTouchActive() && !isTransitioning) {
      hadPointerLock = false;
      pauseGame();
    }
  });

  // React to dynamic pointer capability changes (e.g., tablet keyboard/mouse dock)
  if (coarseMediaQuery && typeof coarseMediaQuery.addEventListener === 'function') {
    coarseMediaQuery.addEventListener('change', updateDeviceBadge);
  }

  // Bi-directional live settings controls (Title <-> Pause)
  if (titleSelQuality) titleSelQuality.addEventListener('change', () => applyQuality(titleSelQuality.value));
  if (pauseSelQuality) pauseSelQuality.addEventListener('change', () => applyQuality(pauseSelQuality.value));
  if (titleSelControls) titleSelControls.addEventListener('change', () => applyControlMode(titleSelControls.value));
  if (pauseSelControls) pauseSelControls.addEventListener('change', () => applyControlMode(pauseSelControls.value));

  if (titleRngSensitivity) {
    titleRngSensitivity.addEventListener('input', () => applySensitivity(titleRngSensitivity.value));
  }
  if (pauseRngSensitivity) {
    pauseRngSensitivity.addEventListener('input', () => applySensitivity(pauseRngSensitivity.value));
  }

  function bindSensitivityNumberInput(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('focus', () => {
      inputEl.value = settings.sensitivity.toFixed(2);
      if (typeof inputEl.select === 'function') {
        window.setTimeout(() => inputEl.select(), 0);
      }
    });
    inputEl.addEventListener('input', () => {
      const cleaned = inputEl.value.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      if (Number.isFinite(num) && num >= 0.01 && num <= 2.49) {
        applySensitivity(num);
      }
    });
    const commitInput = () => {
      const cleaned = inputEl.value.replace(/[^0-9.]/g, '');
      const num = parseFloat(cleaned);
      applySensitivity(Number.isFinite(num) ? num : settings.sensitivity);
      inputEl.value = `${settings.sensitivity.toFixed(2)}x`;
    };
    inputEl.addEventListener('blur', commitInput);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitInput();
        inputEl.blur();
      } else if (e.key === 'Escape') {
        inputEl.value = `${settings.sensitivity.toFixed(2)}x`;
        inputEl.blur();
      }
    });
  }
  bindSensitivityNumberInput(titleValSensitivity);
  bindSensitivityNumberInput(pauseValSensitivity);

  if (titleRngVolume) {
    titleRngVolume.addEventListener('input', () => applyVolume(titleRngVolume.value));
  }
  if (pauseRngVolume) {
    pauseRngVolume.addEventListener('input', () => applyVolume(pauseRngVolume.value));
  }

  if (titleChkMusic) titleChkMusic.addEventListener('change', () => applyMusic(titleChkMusic.checked));
  if (pauseChkMusic) pauseChkMusic.addEventListener('change', () => applyMusic(pauseChkMusic.checked));
  if (titleChkFps) titleChkFps.addEventListener('change', () => applyShowFps(titleChkFps.checked));
  if (pauseChkFps) pauseChkFps.addEventListener('change', () => applyShowFps(pauseChkFps.checked));
  if (titleRngAdsSens) titleRngAdsSens.addEventListener('input', () => applyAdsSens(titleRngAdsSens.value));
  if (pauseRngAdsSens) pauseRngAdsSens.addEventListener('input', () => applyAdsSens(pauseRngAdsSens.value));
  if (titleRngFov) titleRngFov.addEventListener('input', () => applyFov(titleRngFov.value));
  if (pauseRngFov) pauseRngFov.addEventListener('input', () => applyFov(pauseRngFov.value));
  if (titleChkInvertY) titleChkInvertY.addEventListener('change', () => applyInvertY(titleChkInvertY.checked));
  if (pauseChkInvertY) pauseChkInvertY.addEventListener('change', () => applyInvertY(pauseChkInvertY.checked));
  if (titleRngSfxVol) titleRngSfxVol.addEventListener('input', () => applySfxVolume(titleRngSfxVol.value));
  if (pauseRngSfxVol) pauseRngSfxVol.addEventListener('input', () => applySfxVolume(pauseRngSfxVol.value));
  if (titleRngShake) titleRngShake.addEventListener('input', () => applyScreenShake(titleRngShake.value));
  if (pauseRngShake) pauseRngShake.addEventListener('input', () => applyScreenShake(pauseRngShake.value));
  if (btnTitleFullscreen) btnTitleFullscreen.addEventListener('click', () => toggleFullscreenMode());
  if (btnPauseFullscreen) btnPauseFullscreen.addEventListener('click', () => toggleFullscreenMode());

  // ---------------------------------------------------------------------------
  // 7.9. Strict Title Screen Test Mode Toggle (9 x 10 discrete taps within 10s, no hold, no extra input)
  // ---------------------------------------------------------------------------
  let nineTapTimestamps = [];
  let nineKeyHeld = false;
  let nineCommitTimer = null;
  let nineBlockedUntilIdle = false;
  let nineIdleResetTimer = null;
  let unlockToastTimer = null;

  function showTitleUnlockToast(message) {
    if (!titleUnlockToast) return;
    titleUnlockToast.textContent = message;
    titleUnlockToast.classList.remove('hidden');
    if (unlockToastTimer !== null) {
      window.clearTimeout(unlockToastTimer);
    }
    unlockToastTimer = window.setTimeout(() => {
      unlockToastTimer = null;
      titleUnlockToast.classList.add('hidden');
    }, 4500);
  }

  function resetNineTestUnlock(blockUntilIdle = false) {
    if (nineCommitTimer !== null) {
      window.clearTimeout(nineCommitTimer);
      nineCommitTimer = null;
    }
    nineTapTimestamps = [];
    if (blockUntilIdle) {
      nineBlockedUntilIdle = true;
      if (nineIdleResetTimer !== null) {
        window.clearTimeout(nineIdleResetTimer);
      }
      nineIdleResetTimer = window.setTimeout(() => {
        nineIdleResetTimer = null;
        if (!nineKeyHeld) nineBlockedUntilIdle = false;
      }, 650);
    }
  }

  function isNineDigitKey(e) {
    return e.key === '9' || e.code === 'Digit9' || e.code === 'Numpad9';
  }

  function cloneJsonSafe(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return null;
    }
  }

  function refreshAllTitleMetaUIs() {
    renderArmoryUI();
    renderCosmeticsTab();
    renderArsenalMasteryUI();
    renderArsenalPreviews();
    updateMissionConfigUI();
    renderMedalsStrip();
    renderTitleBadgeUI();
    renderDailyPanel();
    updateDailyNavBadge();
  }

  function saveTestModeStorage() {
    try {
      if (testModeActive) {
        window.localStorage.setItem(
          TEST_MODE_STORAGE_KEY,
          JSON.stringify({ active: true, snapshot: preTestMetaSnapshot })
        );
      } else {
        window.localStorage.removeItem(TEST_MODE_STORAGE_KEY);
      }
    } catch {}
  }

  function loadSavedTestMode() {
    try {
      const raw = window.localStorage.getItem(TEST_MODE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.active) {
        testModeActive = true;
        if (parsed.snapshot && typeof parsed.snapshot === 'object') {
          preTestMetaSnapshot = parsed.snapshot;
        }
      }
    } catch {}
  }

  function renderTestStageButtons() {
    if (!testStageGroups) return;
    testStageGroups.innerHTML = '';

    const actGroups = [
      { act: 1, title: 'ACT 1 · 폐허 지구 ~ 분화구 요새', range: '1~5 스테이지', minWave: 1, maxWave: 5 },
      { act: 2, title: 'ACT 2 · 궤도 전함 이지스-IX', range: '6~10 스테이지', minWave: 6, maxWave: 10 },
      { act: 3, title: 'ACT 3 · 심연 특이점 오메가', range: '11~15 스테이지', minWave: 11, maxWave: 15 },
    ];

    for (let g = 0; g < actGroups.length; g++) {
      const grp = actGroups[g];
      const section = document.createElement('div');
      section.className = 'test-act-group';

      const labelRow = document.createElement('div');
      labelRow.className = `test-act-label act-${grp.act}`;
      const leftSpan = document.createElement('span');
      leftSpan.textContent = grp.title;
      const rightSpan = document.createElement('span');
      rightSpan.textContent = grp.range;
      labelRow.appendChild(leftSpan);
      labelRow.appendChild(rightSpan);
      section.appendChild(labelRow);

      const grid = document.createElement('div');
      grid.className = 'test-stage-grid';

      for (let wi = 0; wi < WAVES.length; wi++) {
        const w = WAVES[wi];
        if (!w || w.wave < grp.minWave || w.wave > grp.maxWave) continue;
        const mapMeta = MAPS[w.mapIndex] || null;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `test-stage-btn act-${grp.act}${w.isBossWave ? ' is-boss' : ''}`;
        btn.setAttribute('data-test-wave', String(wi));
        btn.title = `${w.wave}스테이지 · ${w.name} (${mapMeta ? mapMeta.name : ''})`;

        const topRow = document.createElement('div');
        topRow.className = 'test-stage-top';

        const numEl = document.createElement('span');
        numEl.className = 'test-stage-num';
        numEl.textContent = `${w.wave}W`;
        topRow.appendChild(numEl);

        if (w.isBossWave) {
          const bossEl = document.createElement('span');
          bossEl.className = 'test-stage-boss-tag';
          bossEl.textContent = 'BOSS';
          topRow.appendChild(bossEl);
        }

        const nameEl = document.createElement('span');
        nameEl.className = 'test-stage-name';
        nameEl.textContent = w.name.includes(' · ') ? w.name.replace(' · ', '\n') : w.name;

        const secEl = document.createElement('span');
        secEl.className = 'test-stage-sector';
        secEl.textContent = mapMeta ? mapMeta.code : `MAP ${w.mapIndex}`;

        btn.appendChild(topRow);
        btn.appendChild(nameEl);
        btn.appendChild(secEl);

        btn.addEventListener('click', () => {
          const skipDrop = Boolean(chkTestSkipDroppod && chkTestSkipDroppod.checked);
          startNewGame(wi, { skipDropIntro: skipDrop });
        });

        grid.appendChild(btn);
      }

      section.appendChild(grid);
      testStageGroups.appendChild(section);
    }
  }

  function syncTestModeUI() {
    if (sceneTitle) {
      sceneTitle.classList.toggle('test-mode-active', testModeActive);
    }
    if (titleTestBadge) {
      titleTestBadge.classList.toggle('hidden', !testModeActive);
    }
    if (titleTestModePanel) {
      titleTestModePanel.classList.toggle('hidden', !testModeActive);
    }
  }

  function unlockAllTestItems() {
    for (let i = 0; i < PILOT_FRAMES.length; i++) {
      const fid = PILOT_FRAMES[i].id;
      if (!metaState.ownedFrames.includes(fid)) metaState.ownedFrames.push(fid);
    }
    for (let i = 0; i < PLAYER_TITLES.length; i++) {
      const tid = PLAYER_TITLES[i].id;
      if (!metaState.unlockedTitles.includes(tid)) metaState.unlockedTitles.push(tid);
    }
    for (let i = 0; i < FRAME_SKINS.length; i++) {
      const sid = FRAME_SKINS[i].id;
      if (!metaState.unlockedFrameSkins.includes(sid)) metaState.unlockedFrameSkins.push(sid);
    }
    for (let i = 0; i < WEAPONS.length; i++) {
      const wid = WEAPONS[i].id;
      if (!metaState.weaponStats[wid]) metaState.weaponStats[wid] = { kills: 0, headshots: 0 };
      metaState.weaponStats[wid].kills = Math.max(metaState.weaponStats[wid].kills || 0, 250);
      metaState.weaponStats[wid].headshots = Math.max(metaState.weaponStats[wid].headshots || 0, 75);
    }
    metaState.maxUnlockedHeat = Math.max(metaState.maxUnlockedHeat || 0, HEAT_CONTRACTS.length - 1);
    for (let i = 0; i < HEAT_MILESTONE_REWARDS.length; i++) {
      metaState.claimedHeatMilestones[String(HEAT_MILESTONE_REWARDS[i].heat)] = true;
    }
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i];
      if (!metaState.achievements.includes(a.id)) metaState.achievements.push(a.id);
      metaState.claimedAchievements[a.id] = a.reward || 0;
    }
    metaState.gold = Math.max(Number(metaState.gold) || 0, 99999);
    saveMetaState();
  }

  function restorePreTestSnapshot() {
    if (!preTestMetaSnapshot || !preTestMetaSnapshot.meta) return;
    const snap = preTestMetaSnapshot.meta;
    const keys = Object.keys(metaState);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (Object.prototype.hasOwnProperty.call(snap, k)) {
        metaState[k] = cloneJsonSafe(snap[k]);
      }
    }
    if (Number.isFinite(preTestMetaSnapshot.selectedHeatLevel)) {
      const maxUnlocked = Math.max(0, Math.min(HEAT_CONTRACTS.length - 1, metaState.maxUnlockedHeat || 0));
      selectedHeatLevel = Math.max(0, Math.min(maxUnlocked, Math.floor(preTestMetaSnapshot.selectedHeatLevel)));
    }
    preTestMetaSnapshot = null;
    saveMetaState();
  }

  function toggleTestMode() {
    if (!testModeActive) {
      preTestMetaSnapshot = {
        meta: cloneJsonSafe(metaState),
        selectedHeatLevel,
      };
      testModeActive = true;
      unlockAllTestItems();
      saveTestModeStorage();
      syncTestModeUI();
      refreshAllTitleMetaUIs();
      playUiSfx('buy');
      showTitleUnlockToast(
        '테스트 모드 ON — 1~15 스테이지 바로 출격 · 전 장비·위협 해금 (9×10회 재입력 시 종료)'
      );
    } else {
      testModeActive = false;
      selectedStartWaveIndex = 0;
      restorePreTestSnapshot();
      saveTestModeStorage();
      syncTestModeUI();
      refreshAllTitleMetaUIs();
      playUiSfx('tab');
      showTitleUnlockToast('테스트 모드 OFF — 일반 모드로 전환되었습니다 (9×10회 입력 시 재활성화)');
    }
  }

  window.addEventListener('keydown', (e) => {
    if (gameState !== 'title') {
      resetNineTestUnlock(false);
      nineKeyHeld = false;
      nineBlockedUntilIdle = false;
      return;
    }
    const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      resetNineTestUnlock(false);
      return;
    }
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
      return;
    }

    if (isNineDigitKey(e)) {
      // Holding 9 (key repeat or still pressed before keyup) invalidates immediately
      if (e.repeat || nineKeyHeld) {
        resetNineTestUnlock(true);
        return;
      }
      nineKeyHeld = true;
      if (nineBlockedUntilIdle) return;

      // Extra 11th+ press after reaching 10 immediately cancels unlock!
      if (nineCommitTimer !== null) {
        resetNineTestUnlock(true);
        return;
      }

      const now = performance.now();
      if (nineTapTimestamps.length > 0 && now - nineTapTimestamps[0] > 10000) {
        nineTapTimestamps = [now];
      } else {
        nineTapTimestamps.push(now);
      }

      if (nineTapTimestamps.length === 10) {
        const spanMs = now - nineTapTimestamps[0];
        if (spanMs <= 10000) {
          // Wait quietly to guarantee user stops typing after the 10th tap
          nineCommitTimer = window.setTimeout(() => {
            nineCommitTimer = null;
            nineTapTimestamps = [];
            if (gameState === 'title') {
              toggleTestMode();
            }
          }, 1150);
        } else {
          resetNineTestUnlock(true);
        }
      }
    } else {
      // Any other key cancels pending 10-tap sequence and resets cleanly
      resetNineTestUnlock(false);
      nineBlockedUntilIdle = false;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (isNineDigitKey(e)) {
      nineKeyHeld = false;
      if (nineBlockedUntilIdle) {
        if (nineIdleResetTimer !== null) window.clearTimeout(nineIdleResetTimer);
        nineIdleResetTimer = window.setTimeout(() => {
          nineIdleResetTimer = null;
          if (!nineKeyHeld) nineBlockedUntilIdle = false;
        }, 650);
      }
    }
  });

  // Initialize Title state & badges (ZERO WebGL, ZERO rAF!)
  loadSavedTestMode();
  if (testModeActive) {
    unlockAllTestItems();
  }
  renderTestStageButtons();
  syncTestModeUI();
  applyQuality(settings.quality);
  applySensitivity(settings.sensitivity);
  applyVolume(settings.volume);
  applyMusic(settings.music);
  applyShowFps(settings.showFps);
  applyAdsSens(settings.adsSens);
  applyFov(settings.fov);
  applyInvertY(settings.invertY);
  applySfxVolume(settings.sfxVolume);
  applyScreenShake(settings.screenShake);
  syncFullscreenUi();
  applyControlMode(settings.controlMode);
  _initializingSettings = false;
  renderArmoryUI();
  showTitleSubpanel('main');
  // Prepare Title/Game unified post-apocalyptic BGM immediately (starts instantly if autoplay permitted, or on first click/key)
  if (settings.music) {
    unlockAudioOnGesture();
  }

  // ---------------------------------------------------------------------------
  // 8. Main 60FPS Combat Loop (Active ONLY in 'playing' | 'paused' | 'ending')
  // ---------------------------------------------------------------------------
  function frame(now) {
    if (rafId === null || gameState === 'title' || gameState === 'result') {
      rafId = null;
      return;
    }
    rafId = window.requestAnimationFrame(frame);

    const rawDt = Math.max(0.0001, (now - lastTime) * 0.001);
    lastTime = now;
    const dt = rawDt > 0.05 ? 0.05 : rawDt;

    if (pauseDebounce > 0) {
      pauseDebounce = Math.max(0, pauseDebounce - dt);
    }

    if (gameState === 'playing') {
      // Freeze combat simulation during 300ms mid-campaign map transition fade
      if (isTransitioning) {
        elapsedTime += dt;
        mapManager.update(dt, elapsedTime);
        vfxManager.update(dt);
      updateUlt3dEffects(dt);
        soundEngine.update(dt);
        input.endFrame();
        engine.recordFrame(rawDt);
        engine.render();
        return;
      }

      elapsedTime += dt;

      // Dedicated Orbital Drop Pod Cockpit Insertion Intro Sequence (Option B)
      if (dropPodIntro.active) {
        mapManager.update(dt, elapsedTime);
        updateDropPodIntro(dt);
        if (dropPodIntro.active) {
          if (weaponSystem && engine.viewmodelScene.visible) {
            weaponSystem.update(dt, mergedTargets);
          }
          vfxManager.update(dt);
          soundEngine.setCombatIntensity(0.25);
          soundEngine.update(dt);
          input.endFrame();
          engine.recordFrame(rawDt);
          engine.render();
          return;
        }
      }

      telemetry.elapsedSec += dt;

      // Style meter gentle decay over time
      if (telemetry.styleMeter > 0) {
        const decayRate = 3.2 + telemetry.styleTierIdx * 1.1;
        telemetry.styleMeter = Math.max(0, telemetry.styleMeter - decayRate * dt);
        const newIdx = getStyleTier(telemetry.styleMeter);
        if (newIdx !== telemetry.styleTierIdx) {
          telemetry.styleTierIdx = newIdx;
          if (newIdx === 0) telemetry.lastStyleCallout = '스타일';
        }
        updateStyleHudUI();
      }

      // BASTION-12 Special: Seismic Dash Slam shockwave (bug-fixed: uses playerController.isDashing!)
      if (playerController && playerController.mods && playerController.mods.dashSlam) {
        const isDashingNow = Boolean(playerController.isDashing);
        if (isDashingNow && !telemetry.wasDashingPrev && waveDirector) {
          const pPos = playerController.position;
          const activeEnemies = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
          for (let ei = 0; ei < activeEnemies.length; ei++) {
            const e = activeEnemies[ei];
            if (!e || !e.isAlive) continue;
            if (e.position.distanceTo(pPos) <= 7.5) {
              const dir = e.position.clone().sub(pPos).normalize();
              e.applyDamage(65, e.center || e.position, false, dir, { isExplosion: true, knockback: 18 });
            }
          }
          if (vfxManager) vfxManager.spawnExplosion(pPos, 5.2, 0x22c55e);
        }
        telemetry.wasDashingPrev = isDashingNow;
      }

      // Rare Card: Repulsor Slam (landing shockwave after airborne >= 0.28s)
      if (playerController) {
        const groundedNow = Boolean(playerController.isGrounded);
        if (!groundedNow) {
          telemetry.airTimeAccum += dt;
        } else {
          if (!telemetry.wasGroundedPrev && telemetry.airTimeAccum >= 0.28 && playerController.mods && playerController.mods.repulsorSlam) {
            const pPos = playerController.position;
            const activeEnemies = waveDirector && waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
            let slamHits = 0;
            for (let ei = 0; ei < activeEnemies.length; ei++) {
              const e = activeEnemies[ei];
              if (!e || !e.isAlive) continue;
              const d = e.position.distanceTo(pPos);
              if (d <= 7.5) {
                const dir = e.position.clone().sub(pPos).normalize();
                e.applyDamage(60, e.center || e.position, false, dir, { isExplosion: true, knockback: 14 });
                slamHits++;
              }
            }
            if (vfxManager) vfxManager.spawnExplosion(pPos, 4.8, 0x22c55e);
            if (slamHits > 0) addStylePoints(14, '충격 강하!');
          }
          telemetry.airTimeAccum = 0;
        }
        telemetry.wasGroundedPrev = groundedNow;
      }
      syncTouchOverlayVisibility();

      // Build zero-GC merged target list (living enemies + alive explosive fuel drums)
      const livingEnemies = waveDirector.getTargets();
      const activeBarrels = interactables.getDestructibleTargets();
      mergedTargets.length = 0;
      for (let i = 0; i < livingEnemies.length; i++) {
        mergedTargets.push(livingEnemies[i]);
      }
      for (let i = 0; i < activeBarrels.length; i++) {
        mergedTargets.push(activeBarrels[i]);
      }

      // 1. Player 3C locomotion, camera & touch aim-assist
      playerUpdateOpts.adsFov = lastAdsFov;
      playerUpdateOpts.aimAssistTargets = livingEnemies;
      playerUpdateOpts.allowAds = !(
        lastWeaponState &&
        (lastWeaponState.isReloading || lastWeaponState.isSwapping || lastWeaponState.isMeleeing)
      );
      playerController.update(dt, playerUpdateOpts);
      engine.setFov(playerController.currentFov);
      engine.camera.updateMatrixWorld();

      // 1.4. Sync 1st-person Robot Hands, Equipped Frame Skin & Guard Shield Style
      if (weaponSystem && playerController && playerController.mods) {
        const curFid = playerController.mods.frameId || 'vanguard';
        const curSkinId = metaState.equippedFrameSkin || 'standard';
        const visualKey = `${curFid}:${curSkinId}`;
        if (telemetry._appliedFrameVisual !== visualKey) {
          telemetry._appliedFrameVisual = visualKey;
          const skinCfg = FRAME_SKINS.find((sk) => sk.id === curSkinId) || FRAME_SKINS[0];
          if (typeof weaponSystem.setPilotFrameStyle === 'function') {
            weaponSystem.setPilotFrameStyle(curFid, skinCfg);
          }
        }
      }

      // 1.45. Mid-Run Sector Transfer Gate Activation Check (only when map changes!)
      let consumedInteractForGate = false;
      if (interactables && waveDirector && waveDirector.isAwaitingTransferGate()) {
        const tg = interactables.getTransferGateState();
        if (tg && tg.active && (tg.shouldAutoEnter || (tg.canInteract && input.consumePressed('interact')))) {
          consumedInteractForGate = true;
          if (vfxManager && playerController) {
            vfxManager.spawnTransferWarp(playerController.position);
          }
          waveDirector.enterTransferGate();
        }
      }

      // 1.5. Floor Weapon Auto-Upgrade on proximity (same weapon) OR Swap on [F]
      if (!consumedInteractForGate && interactables && weaponSystem && playerController) {
        const autoNear = interactables.getNearbyWeaponDrop(playerController.position);
        if (autoNear) {
          const loNow = weaponSystem.getLoadoutInfo();
          const dropW = __require("src/config/weapons.js").WEAPONS[autoNear.weaponIndex];
          const isSecDrop = dropW && dropW.category === 'secondary';
          const curSlotIdx = isSecDrop ? loNow.secondaryIndex : loNow.primaryIndex;
          if (curSlotIdx === autoNear.weaponIndex) {
            const upgraded = interactables.trySwapNearbyWeapon(playerController.position, weaponSystem);
            if (upgraded) {
              const ocLv = weaponSystem.weaponOverclock[autoNear.weaponIndex] || 1;
              if (vfxManager) {
                const upCol = ocLv >= 3 ? 0xffd700 : ocLv === 2 ? 0xc084fc : 0x38bdf8;
                vfxManager.spawnExplosion(playerController.position, 2.8, upCol);
              }
              if (tutorialState.active && tutorialState.step === 4) { tutorialState.autoUpgraded = true; advanceTutorialStep(5); }
              if (hudManager && typeof hudManager.showAnnouncement === 'function' && dropW) {
                hudManager.showAnnouncement(
                  `${dropW.shortName} 자동 업그레이드!`,
                  `${ocLv + 1}단계 강화 완료 · 외형 및 탄환 이펙트 진화`,
                  'info'
                );
              }
            }
          }
        }
        if (input.consumePressed('interact')) {
          interactables.trySwapNearbyWeapon(playerController.position, weaponSystem);
        }
      }

      // 1.6. Frame Ultimate Activation on [X]
      if (input.consumePressed('ultimate') && playerController && playerController.ultCharge >= 100) {
        const fid = (playerController.mods && playerController.mods.frameId) || 'vanguard';
        eventBus.emit(EVENTS.ULTIMATE_USED, { frameId: fid });
        const uDmgM = (playerController.mods && playerController.mods.ultDamageBonus) || 1.0;
        const uDurAdd = (playerController.mods && playerController.mods.ultDurationBonus) || 0;
        playerController.ultCharge = 0;
        if (playerController.mods && playerController.mods.synergyTactical4) {
          playerController.guardEnergy = playerController.maxGuardEnergy;
          playerController.guardBreakTimer = 0;
          playerController.ultDamageMult = Math.max(playerController.ultDamageMult || 1.0, 1.35);
          playerController.ultActiveTimer = Math.max(playerController.ultActiveTimer || 0, 4.0);
        }
        if (tutorialState.active && tutorialState.step === 5) { tutorialState.usedUlt = true; updateTutorialBannerUI(); }
        const pPos = playerController.position;
        const activeEnemies = waveDirector && waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];

        if (fid === 'vanguard') {
          // VANGUARD-09: ORBITAL BARRAGE (5 sky-to-ground orbital laser strikes, 180 AoE dmg each)
          playerController.ultActiveTimer = 2.0;
          const targets = activeEnemies
            .filter((e) => e && e.isAlive)
            .sort((a, b) => a.position.distanceToSquared(pPos) - b.position.distanceToSquared(pPos))
            .slice(0, 5);
          for (let ti = 0; ti < Math.max(1, targets.length); ti++) {
            const tPos = targets[ti] ? targets[ti].position.clone() : pPos.clone().addScaledVector(playerController.getLookDirection(), 14);
            const skyOrigin = tPos.clone();
            skyOrigin.y += 38;
            if (vfxManager) {
              if (typeof vfxManager.spawnTracer === 'function') vfxManager.spawnTracer(skyOrigin, tPos, 0xf59e0b, 0.28, true);
              vfxManager.spawnExplosion(tPos, 5.5, 0xf59e0b);
            }
            spawnUltBeamPillar(tPos, 0xf59e0b);
            spawnUltShockRing(tPos, 8.5, 0xfbbf24, 0.95);
            for (let ei = 0; ei < activeEnemies.length; ei++) {
              const e = activeEnemies[ei];
              if (!e || !e.isAlive) continue;
              if (e.position.distanceTo(tPos) <= 7.5) {
                const dir = e.position.clone().sub(tPos).normalize();
                e.applyDamage(Math.round(180 * uDmgM), e.center || e.position, false, dir, { isExplosion: true, knockback: 18 });
              }
            }
          }
          triggerUltScreenFlash('rgba(245,158,11,0.75)', 0.55);
          playerController.addScreenShake(0.45);
          if (hudManager && typeof hudManager.showAnnouncement === 'function') {
            hudManager.showAnnouncement('궁극기: 궤도 포격!', '5연쇄 궤도 타격 투하', 'info');
          }
        } else if (fid === 'strider') {
          // STRIDER-04: PHASE OVERCLOCK (6s 60% enemy time-dilation + hyper speed + infinite ammo)
          playerController.timeSlowTimer = 6.0 + uDurAdd;
          playerController.ultActiveTimer = Math.max(playerController.ultActiveTimer, 6.0 + uDurAdd);
          playerController.dashOverdriveTimer = 6.0 + uDurAdd;
          if (vfxManager) vfxManager.spawnExplosion(pPos, 5.0, 0x00f0ff);
          spawnUltNovaSphere(pPos, 24.0, 0x00f0ff, 1.1);
          spawnUltShockRing(pPos, 26.0, 0x38bdf8, 1.0);
          spawnUltShockRing(pPos, 18.0, 0x7dd3fc, 0.7, 0.25);
          triggerUltScreenFlash('rgba(0,240,255,0.72)', 0.55);
          if (hudManager && typeof hudManager.showAnnouncement === 'function') {
            hudManager.showAnnouncement('궁극기: 타임 다이레이션!', '6초간 적 시간 60% 감속 · 초고속 무한 사격', 'info');
          }
        } else if (fid === 'bastion') {
          // BASTION-12: AEGIS FORTRESS (7s invulnerability + 12m periodic electric shockwaves + 100% guard refill)
          playerController.ultInvulnTimer = 7.0 + uDurAdd;
          playerController.ultActiveTimer = Math.max(playerController.ultActiveTimer, 7.0 + uDurAdd);
          playerController.guardEnergy = playerController.maxGuardEnergy;
          playerController.guardBreakTimer = 0;
          telemetry._bastionPulseTimer = 0.05;
          if (vfxManager) vfxManager.spawnExplosion(pPos, 6.0, 0x22c55e);
          spawnUltNovaSphere(pPos, 12.0, 0x22c55e, 0.9);
          spawnUltShockRing(pPos, 13.0, 0x4ade80, 0.85);
          triggerUltScreenFlash('rgba(34,197,94,0.68)', 0.50);
          if (hudManager && typeof hudManager.showAnnouncement === 'function') {
            hudManager.showAnnouncement('궁극기: 이지스 포트리스!', '7초간 완전 무적 돔 전개 · 주변 12m 전기 충격', 'info');
          }
        } else if (fid === 'apex') {
          // APEX-ZERO: APOCALYPSE NOVA (28m 260 dmg + stagger nova + 5s 1.6x damage overdrive)
          playerController.ultActiveTimer = Math.max(playerController.ultActiveTimer, 5.0 + uDurAdd);
          playerController.ultDamageMult = Math.max(playerController.ultDamageMult, 1.6 * uDmgM);
          playerController.dashOverdriveTimer = 5.0 + uDurAdd;
          if (vfxManager) vfxManager.spawnExplosion(pPos, 9.5, 0xef4444);
          spawnUltNovaSphere(pPos, 28.0, 0xef4444, 1.2);
          spawnUltShockRing(pPos, 28.0, 0xf59e0b, 1.05, 0.0);
          spawnUltShockRing(pPos, 26.0, 0xf43f5e, 1.05, 0.45);
          spawnUltShockRing(pPos, 26.0, 0xfbbf24, 1.05, -0.45);
          triggerUltScreenFlash('rgba(239,68,68,0.85)', 0.65);
          for (let ei = 0; ei < activeEnemies.length; ei++) {
            const e = activeEnemies[ei];
            if (!e || !e.isAlive) continue;
            if (e.position.distanceTo(pPos) <= 28.0) {
              const dir = e.position.clone().sub(pPos).normalize();
              e.applyDamage(Math.round(260 * uDmgM), e.center || e.position, false, dir, { isExplosion: true, knockback: 22 });
            }
          }
          playerController.addScreenShake(0.55);
          if (hudManager && typeof hudManager.showAnnouncement === 'function') {
            hudManager.showAnnouncement('궁극기: 아포칼립스 노바!', '전장 초신성 폭발 · 5초간 화력 1.6배 폭주', 'danger');
          }
        }
      }

      // BASTION-12 Ultimate periodic 12m shockwave pulse while Aegis Fortress is active
      if (playerController && playerController.ultInvulnTimer > 0 && waveDirector) {
        telemetry._bastionPulseTimer = (telemetry._bastionPulseTimer || 0) - dt;
        if (telemetry._bastionPulseTimer <= 0) {
          telemetry._bastionPulseTimer = 0.85;
          const pPos = playerController.position;
          const activeEnemies = waveDirector.getActiveEnemies ? waveDirector.getActiveEnemies() : [];
          for (let ei = 0; ei < activeEnemies.length; ei++) {
            const e = activeEnemies[ei];
            if (!e || !e.isAlive) continue;
            if (e.position.distanceTo(pPos) <= 12.0) {
              const dir = e.position.clone().sub(pPos).normalize();
              e.applyDamage(Math.round(45 * ((playerController.mods && playerController.mods.ultDamageBonus) || 1.0)), e.center || e.position, false, dir, { isExplosion: true, knockback: 10 });
            }
          }
          if (vfxManager) vfxManager.spawnExplosion(pPos, 4.5, 0x22c55e);
          spawnUltShockRing(pPos, 12.5, 0x4ade80, 0.65);
        }
      }

      // 2. Weapon inputs, ballistics, thermal pry-blade melee & 1P viewmodel animation
      const weaponRes = weaponSystem.update(dt, mergedTargets);
      lastAdsFov = weaponRes.adsFov;
      lastWeaponState = weaponSystem.getCurrentWeaponState();

      // 3. Active Sector Environment, Interactables, WaveDirector AI & VFX
      mapManager.update(dt, elapsedTime);
      interactables.update(dt, elapsedTime, playerController, livingEnemies, weaponSystem);
      let worldScale = 1.0;
      if (_hitstopTimer > 0) {
        _hitstopTimer = Math.max(0, _hitstopTimer - dt);
        worldScale = 0.08;
      }
      const enemyDt = (playerController && playerController.timeSlowTimer > 0 ? dt * 0.40 : dt) * worldScale;
      waveDirector.update(
        enemyDt,
        elapsedTime,
        playerController,
        interactables.getZoneState(),
        interactables
      );
      vfxManager.update(dt);
      updateUlt3dEffects(dt);

      // 4. Spatial 3D Audio & Adaptive Combat Pulse
      const waveHud = waveDirector.getHudState();
      soundEngine.setCombatIntensity(waveHud.combatIntensity);
      soundEngine.update(dt);

      // 5. Zero-GC HUD & Touch Overlay State Sync
      hudSnapshot.player = playerController.getStateSnapshot();
      hudSnapshot.weapon = lastWeaponState;
      hudSnapshot.crosshairSpread = weaponRes.crosshairSpread;
      hudSnapshot.wave = waveHud;
      hudSnapshot.boss = waveDirector.getBossState();
      hudSnapshot.zone = interactables.getZoneState();
      hudSnapshot.enemies = livingEnemies;
      hudSnapshot.pickups = interactables.getPickups();
      hudSnapshot.voidGates = interactables.getActiveVoidGates ? interactables.getActiveVoidGates() : null;
      hudSnapshot.lowGravityZones = interactables.getActiveLowGravityZones ? interactables.getActiveLowGravityZones() : null;
      hudSnapshot.transferGate =
        interactables.getTransferGateState && waveDirector.isAwaitingTransferGate()
          ? interactables.getTransferGateState()
          : null;
      hudSnapshot.fps = engine.fps;
      hudSnapshot.gold = metaState.gold;
      hudSnapshot.loadout = weaponSystem.getLoadoutInfo();
      hudSnapshot.activeSynergies = getActiveSynergiesList();
      const nearDrop = interactables.getNearbyWeaponDrop(playerController.position);
      if (nearDrop) {
        const dropW = __require("src/config/weapons.js").WEAPONS[nearDrop.weaponIndex];
        const lo = hudSnapshot.loadout;
        const isSec = dropW && dropW.category === 'secondary';
        const curIdx = isSec ? lo.secondaryIndex : lo.primaryIndex;
        const curW = isSec ? lo.secondaryWeapon : lo.primaryWeapon;
        hudSnapshot.nearbyWeapon = dropW
          ? { weapon: dropW, isSame: curIdx === nearDrop.weaponIndex, currentName: curW ? curW.shortName : '' }
          : null;
      } else {
        hudSnapshot.nearbyWeapon = null;
      }

      hudManager.update(dt, hudSnapshot);
      updateTacticalFrameHudOverlay(hudSnapshot.player, playerController && playerController.mods);
      if (tutorialState.active) {
        if (tutorialState.step === 1 && tutorialState.didDash && tutorialState.didJumpPad && tutorialState.didBarrel) {
          advanceTutorialStep(2);
        } else if (tutorialState.step === 3) {
          if (playerController.isGuarding) {
            tutorialState.guardHoldSec += dt;
            updateTutorialBannerUI();
          }
          if (tutorialState.guardHoldSec >= 0.8 && tutorialState.pickedItem) {
            advanceTutorialStep(4);
          }
        } else if (tutorialState.step === 5) {
          if (Math.hypot(playerController.position.x, playerController.position.z) <= 5.5) {
            tutorialState.enteredBeacon = true;
            updateTutorialBannerUI();
          }
          if (tutorialState.enteredBeacon && tutorialState.usedUlt) {
            advanceTutorialStep(6);
          }
        }
      }
      touchOverlay.syncState(hudSnapshot);

      // Safety death transition check
      if (!playerController.isAlive && gameState === 'playing') {
        beginEndingSequence(false);
      }

      // Pause key check (P / ESC)
      if (pauseDebounce <= 0 && input.consumePressed('pause') && gameState === 'playing') {
        pauseGame();
      }

      input.endFrame();
    } else if (gameState === 'paused') {
      if (pauseDebounce <= 0 && input.consumePressed('pause')) {
        resumeFromPause();
      }
      input.endFrame();
    } else if (gameState === 'ending') {
      // 0.5s slow-motion death/victory linger (0.25x residual animation/VFX, input disabled)
      endingTimer -= dt;
      const simDt = dt * ENDING_SLOWMO_SCALE;
      elapsedTime += simDt;

      if (!endingIsVictory) {
        playerController.update(simDt, playerUpdateOpts);
      }
      mapManager.update(simDt, elapsedTime);
      interactables.update(simDt, elapsedTime, null, null, null);
      vfxManager.update(simDt);
      soundEngine.setCombatIntensity(0);
      soundEngine.update(dt);
      input.endFrame();

      if (endingTimer <= 0 && !endingFadeStarted) {
        endingFadeStarted = true;
        runFadeTransition(() => enterResultScene(endingIsVictory));
      }
    }

    engine.recordFrame(rawDt);
    engine.render();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
});
