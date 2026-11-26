// Module: src/firebase/FirebaseService.js
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

const OperationType = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
});

const VALID_FRAME_IDS = new Set(['vanguard', 'strider', 'bastion', 'apex']);
const VALID_WEAPON_IDS = new Set([
  'pulse_rifle',
  'scattergun',
  'railgun',
  'plasma_smg',
  'weld_pistol',
  'arc_rivet',
  'repulsor',
]);
const VALID_TITLE_IDS = new Set([
  'rookie_dropper',
  'master_pulse',
  'master_scatter',
  'master_rail',
  'master_smg',
  'master_weld',
  'master_arc',
  'master_repulsor',
  'heat_3_conq',
  'heat_5_conq',
  'heat_7_conq',
  'heat_10_conq',
  'streak_3',
  'streak_7',
  'endless_survivor',
]);

let _app = null;
let _db = null;
let _auth = null;
let _config = null;
let _ready = false;
let _initPromise = null;
let _currentUser = null;
const _authListeners = new Set();
const _boardCache = new Map(); // boardKey -> { fetchedAt, entries }
const CACHE_TTL_MS = 25000;

function sanitizeCallsign(raw, fallback = 'PILOT') {
  const s = String(raw || '')
    .replace(/[\r\n\t<>]/g, '')
    .trim()
    .slice(0, 18);
  return s.length >= 1 ? s : fallback;
}

function sanitizeTitleLabel(raw, fallback = '신병 강하병') {
  const s = String(raw || '')
    .replace(/[\r\n\t<>]/g, '')
    .trim()
    .slice(0, 28);
  return s.length >= 1 ? s : fallback;
}

function getLocalDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveBoardKey(mode, dateKey) {
  const safeMode = mode === 'endless' || mode === 'daily' ? mode : 'campaign';
  if (safeMode === 'daily') {
    const dk =
      typeof dateKey === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateKey)
        ? dateKey
        : getLocalDateKey();
    return { mode: 'daily', dateKey: dk, boardKey: `daily_${dk}` };
  }
  return { mode: safeMode, dateKey: 'all', boardKey: safeMode };
}

function buildErrorInfo(error, operationType, path) {
  const user = _auth ? _auth.currentUser : null;
  const errMsg = error instanceof Error ? error.message : String(error);
  return {
    error: errMsg,
    operationType,
    path,
    authInfo: {
      userId: user ? user.uid : undefined,
      emailVerified: user ? user.emailVerified : undefined,
      isAnonymous: user ? user.isAnonymous : undefined,
      tenantId: user ? user.tenantId : undefined,
      providerInfo: user && Array.isArray(user.providerData)
        ? user.providerData.map((p) => ({
            providerId: p.providerId,
            displayName: p.displayName,
          }))
        : [],
    },
  };
}

function handleFirestoreError(error, operationType, path) {
  const info = buildErrorInfo(error, operationType, path);
  console.error('Firestore Error:', JSON.stringify(info));
  const msg = info.error || '';
  if (msg.includes('Quota exceeded')) {
    const upgradeUrl =
      _config && _config.projectId && _config.firestoreDatabaseId
        ? `https://console.firebase.google.com/project/${_config.projectId}/firestore/databases/${_config.firestoreDatabaseId}/data?openUpgradeDialog=true`
        : 'https://firebase.google.com/pricing#cloud-firestore';
    const e = new Error(
      `일일 무료 데이터베이스 할당량에 도달했습니다. 내일 초기화되며 상세 정보는 콘솔(${upgradeUrl})에서 확인할 수 있습니다.`
    );
    e.code = 'quota-exceeded';
    e.details = info;
    throw e;
  }
  const err = new Error(msg || 'Firestore operation failed');
  err.details = info;
  throw err;
}

async function testConnection() {
  if (!_db) return false;
  try {
    await getDocFromServer(doc(_db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client is offline).');
    }
    return false;
  }
}

async function initFirebase() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      const resp = await fetch('./firebase-applet-config.json', { cache: 'no-store' });
      if (!resp.ok) throw new Error('firebase-applet-config.json load failed');
      _config = await resp.json();
      _app = initializeApp(_config);
      _db = getFirestore(_app, _config.firestoreDatabaseId);
      _auth = getAuth(_app);
      _ready = true;

      onAuthStateChanged(_auth, (user) => {
        _currentUser = user || null;
        _authListeners.forEach((cb) => {
          try {
            cb(_currentUser);
          } catch {}
        });
      });

      testConnection();
      return true;
    } catch (err) {
      console.warn('[AETHER DROP] Firebase initialization unavailable:', err);
      _ready = false;
      return false;
    }
  })();
  return _initPromise;
}

function onAuthChange(cb) {
  if (typeof cb !== 'function') return () => {};
  _authListeners.add(cb);
  try {
    cb(_currentUser);
  } catch {}
  return () => _authListeners.delete(cb);
}

function getCurrentUser() {
  return _currentUser;
}

function isFirebaseReady() {
  return _ready && Boolean(_db) && Boolean(_auth);
}

async function signInWithGoogle() {
  await initFirebase();
  if (!_auth) {
    throw new Error('Firebase 인증이 초기화되지 않았습니다.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await signInWithPopup(_auth, provider);
    _currentUser = cred.user;
    return cred.user;
  } catch (err) {
    const code = err && err.code ? String(err.code) : '';
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      throw new Error('브라우저에서 로그인 팝업이 차단되었습니다. 팝업을 허용하거나 새 탭에서 열어 주세요.');
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Google 로그인이 취소되었습니다.');
    }
    throw err;
  }
}

async function signOutUser() {
  if (!_auth) return;
  await signOut(_auth);
  _currentUser = null;
}

async function fetchLeaderboard(mode = 'campaign', dateKey = null, limitN = 25, forceRefresh = false) {
  await initFirebase();
  if (!_db) {
    throw new Error('글로벌 랭킹 데이터베이스에 연결할 수 없습니다.');
  }
  const { boardKey } = resolveBoardKey(mode, dateKey);
  const now = Date.now();
  const cached = _boardCache.get(boardKey);
  if (!forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entries;
  }

  const colPath = `leaderboards/${boardKey}/entries`;
  try {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(limitN) || 25)));
    const q = query(
      collection(_db, 'leaderboards', boardKey, 'entries'),
      where('score', '>=', 0),
      orderBy('score', 'desc'),
      limit(safeLimit)
    );
    const snap = await getDocs(q);
    const entries = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data && typeof data.callsign === 'string') {
        entries.push({ id: d.id, ...data });
      }
    });
    entries.sort((a, b) => (b.score || 0) - (a.score || 0));
    _boardCache.set(boardKey, { fetchedAt: now, entries });
    return entries;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
    return [];
  }
}

async function submitLeaderboardRecord(payload) {
  await initFirebase();
  if (!_db || !_auth) {
    throw new Error('데이터베이스 연결이 준비되지 않았습니다.');
  }
  let user = _auth.currentUser;
  if (!user) {
    user = await signInWithGoogle();
  }
  if (!user || !user.uid) {
    throw new Error('Google 로그인이 필요합니다.');
  }

  const { mode, dateKey, boardKey } = resolveBoardKey(payload.mode, payload.dateKey);
  const entryPath = `leaderboards/${boardKey}/entries/${user.uid}`;
  const docRef = doc(_db, 'leaderboards', boardKey, 'entries', user.uid);

  const cleanScore = Math.max(0, Math.min(2000000000, Math.floor(Number(payload.score) || 0)));
  const cleanWave = Math.max(1, Math.min(9999, Math.floor(Number(payload.wave) || 1)));
  const cleanHeat = Math.max(0, Math.min(10, Math.floor(Number(payload.heat) || 0)));
  const cleanKills = Math.max(0, Math.min(1000000, Math.floor(Number(payload.kills) || 0)));
  const cleanHeadshots = Math.max(0, Math.min(cleanKills, Math.floor(Number(payload.headshots) || 0)));
  const cleanElapsed = Math.max(0, Math.min(86400, Math.round((Number(payload.elapsedSec) || 0) * 10) / 10));
  const cleanCallsign = sanitizeCallsign(
    payload.callsign || (user.displayName ? user.displayName.split(' ')[0] : 'PILOT'),
    'PILOT'
  );
  const rawTitleId = String(payload.titleId || 'rookie_dropper');
  const cleanTitleId = VALID_TITLE_IDS.has(rawTitleId) ? rawTitleId : 'rookie_dropper';
  const cleanTitleLabel = sanitizeTitleLabel(payload.titleLabel || '신병 강하병', '신병 강하병');
  const rawFrameId = String(payload.frameId || 'vanguard');
  const cleanFrameId = VALID_FRAME_IDS.has(rawFrameId) ? rawFrameId : 'vanguard';
  const rawWeaponId = String(payload.primaryWeaponId || 'pulse_rifle');
  const cleanWeaponId = VALID_WEAPON_IDS.has(rawWeaponId) ? rawWeaponId : 'pulse_rifle';

  try {
    const existingSnap = await getDoc(docRef);
    const prevData = existingSnap.exists() ? existingSnap.data() : null;
    const prevScore = prevData ? Math.max(0, Math.floor(Number(prevData.score) || 0)) : -1;
    const prevWave = prevData ? Math.max(1, Math.floor(Number(prevData.wave) || 1)) : 0;

    const keepBestScore = cleanScore >= prevScore;
    const finalKills = keepBestScore
      ? cleanKills
      : Math.max(cleanKills, Math.floor(Number(prevData?.kills) || 0));
    const finalHeadshots = Math.min(
      finalKills,
      keepBestScore
        ? cleanHeadshots
        : Math.max(cleanHeadshots, Math.floor(Number(prevData?.headshots) || 0))
    );
    const prevFrame = prevData && VALID_FRAME_IDS.has(String(prevData.frameId)) ? String(prevData.frameId) : cleanFrameId;
    const prevWeapon =
      prevData && VALID_WEAPON_IDS.has(String(prevData.primaryWeaponId))
        ? String(prevData.primaryWeaponId)
        : cleanWeaponId;

    const record = {
      uid: user.uid,
      callsign: cleanCallsign,
      titleId: cleanTitleId,
      titleLabel: cleanTitleLabel,
      mode,
      dateKey,
      score: keepBestScore ? cleanScore : prevScore,
      wave: keepBestScore ? cleanWave : Math.max(cleanWave, prevWave),
      heat: keepBestScore ? cleanHeat : Math.max(cleanHeat, Math.floor(Number(prevData?.heat) || 0)),
      kills: finalKills,
      headshots: finalHeadshots,
      elapsedSec: keepBestScore
        ? cleanElapsed
        : Math.max(0, Math.min(86400, Number(prevData?.elapsedSec) || cleanElapsed)),
      frameId: keepBestScore ? cleanFrameId : prevFrame,
      primaryWeaponId: keepBestScore ? cleanWeaponId : prevWeapon,
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, record);
    _boardCache.delete(boardKey);
    return {
      updatedBest: !existingSnap.exists() || cleanScore > prevScore,
      keptHigherPrev: existingSnap.exists() && cleanScore < prevScore,
      boardKey,
      entry: record,
    };
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      entryPath
    );
    return null;
  }
}

const api = {
  OperationType,
  initFirebase,
  isFirebaseReady,
  onAuthChange,
  getCurrentUser,
  signInWithGoogle,
  signOutUser,
  fetchLeaderboard,
  submitLeaderboardRecord,
  getLocalDateKey,
  sanitizeCallsign,
};

if (typeof globalThis.__define === 'function') {
  globalThis.__define('src/firebase/FirebaseService.js', (__exports) => {
    Object.assign(__exports, api);
  });
}

// Kick off background initialization immediately
initFirebase();

export default api;
