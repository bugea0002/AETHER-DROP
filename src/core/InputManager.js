// Module: src/core/InputManager.js
__define("src/core/InputManager.js", (__exports, __require) => {
const BASE_MOUSE_RAD_PER_PX = 0.0022;
const TOUCH_LOOK_MULTIPLIER = 2.4;
const MAX_LOCKED_SPIKE_PX = 240;
const MAX_SAFE_EVENT_PX = 150;
const MAX_FALLBACK_JUMP_PX = 180;
const MAX_FRAME_LOOK_RAD = 0.42;
const EDGE_TURN_MARGIN_NORM = 0.045;
const EDGE_TURN_SPEED_RAD_PER_SEC = 2.65;
const PRESSED_TTL_MS = 150;

const KEY_TO_ACTION = {
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  ControlLeft: 'slide',
  KeyC: 'slide',
  Space: 'jump',
  KeyQ: 'dash',
  KeyE: 'guard',
  KeyX: 'ultimate',
  AltLeft: 'dash',
  KeyR: 'reload',
  KeyV: 'melee',
  KeyF: 'interact',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  Digit4: 'slot4',
  KeyP: 'pause',
  Escape: 'pause',
};

const ACTION_ALIASES = {
  crouch: 'slide',
  shoot: 'fire',
  aim: 'ads',
  weapon1: 'slot1',
  weapon2: 'slot2',
  weapon3: 'slot3',
  weapon4: 'slot4',
};

const PREVENT_DEFAULT_CODES = new Set([
  'Space',
  'AltLeft',
  'AltRight',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Escape',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
]);

const KEYBOARD_LOCK_CODES = [
  'Escape',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'KeyR',
  'KeyF',
  'KeyC',
  'KeyV',
  'KeyX',
  'KeyP',
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'Tab',
  'Space',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
];

/**
 * Hybrid PC (PointerLock + Keyboard/Mouse) and Mobile/Tablet Touch InputManager.
 * Uses timestamped press edges (150ms TTL) to eliminate stale phantom inputs,
 * Chromium pointer-warp spike rejection + edge-zone turning fallback, and zero-GC getters.
 */
class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._radPerPx = BASE_MOUSE_RAD_PER_PX;
    this._sensitivityMultiplier = 1.0;
    this._invertY = false;

    // Explicit 'auto' | 'pc' | 'touch' control mode + coarse-pointer default detection
    this._controlMode = 'auto';
    const coarse =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : typeof window !== 'undefined' &&
          ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0));
    this._touchMode = Boolean(coarse);

    // Held states separated by source so releasing one never clobbers another
    this._codesDown = new Set();
    this._mouseActionsDown = new Set();
    this._touchActionsDown = new Set();

    // Timestamped edge-triggered presses: Map<canonicalAction, timestampMs>
    /** @type {Map<string, number>} */
    this._pressedActions = new Map();

    // Ignore first mousemove events right after pointerlock / focus transitions (Chromium warp spikes)
    this._ignoreMouseMoveCount = 0;
    this._prevLockedMx = 0;
    this._prevLockedMy = 0;
    this._prevLockedTime = 0;

    // Touch virtual joystick vector (x: right/left, y: forward/backward)
    this._touchMoveX = 0;
    this._touchMoveY = 0;

    // Look accumulators (in radians) & mouse wheel step accumulator
    this._lookDeltaX = 0;
    this._lookDeltaY = 0;
    this._wheelDelta = 0;
    this._lastFallbackMouseX = null;
    this._lastFallbackMouseY = null;
    this._cursorInsideViewport = false;
    this._cursorNormX = 0.5;
    this._cursorNormY = 0.5;
    this._lastMouseMoveTime = 0;
    this._lastLookConsumeTime = typeof performance !== 'undefined' ? performance.now() : 0;
    this._lastWheelTime = 0;

    // Scratch return objects (zero allocation in update loops)
    this._moveOut = { x: 0, y: 0 };
    this._lookOut = { x: 0, y: 0 };

    // Bound event handlers for clean disposal
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onContextMenu = this._handleContextMenu.bind(this);
    this._onPointerLockChange = this._handlePointerLockChange.bind(this);
    this._onPointerLockError = this._handlePointerLockError.bind(this);
    this._onMouseLeave = this._handleMouseLeave.bind(this);
    this._onMouseEnter = this._handleMouseEnter.bind(this);
    this._onWindowFocus = this._handleWindowFocus.bind(this);
    this._onWindowBlur = this._handleWindowBlur.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);

    this._bindEvents();
  }

  /**
   * Normalize action aliases to canonical action names.
   * @private
   */
  _normalizeAction(action) {
    return ACTION_ALIASES[action] || action;
  }

  /** @private */
  _bindEvents() {
    window.addEventListener('keydown', this._onKeyDown, { capture: true, passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('pointerdown', this._onMouseDown);
    window.addEventListener('pointerup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('focus', this._onWindowFocus);
    window.addEventListener('blur', this._onWindowBlur);
    document.addEventListener('mouseleave', this._onMouseLeave);
    document.addEventListener('mouseenter', this._onMouseEnter);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('pointerlockerror', this._onPointerLockError);

    if (this._canvas) {
      this._canvas.addEventListener('contextmenu', this._onContextMenu);
      this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
    }
  }

  /** @private */
  _handleKeyDown(e) {
    const code = e.code;

    // Switch seamlessly to PC mode on physical keyboard interaction (when in AUTO)
    if (this._controlMode === 'auto' && this._touchMode && !e.isComposing) {
      this._touchMode = false;
    }

    if (
      (this.isPointerLocked() || this._isPlayingFallbackActive() || (code === 'Escape' && typeof document !== 'undefined' && document.fullscreenElement)) &&
      (PREVENT_DEFAULT_CODES.has(code) || e.ctrlKey || e.metaKey || e.altKey)
    ) {
      e.preventDefault();
    }

    const wasDown = this._codesDown.has(code);
    this._codesDown.add(code);

    if (!wasDown && !e.repeat) {
      const action = KEY_TO_ACTION[code];
      if (action) {
        this._pressedActions.set(action, performance.now());
      }
    }
  }

  /** @private */
  _handleKeyUp(e) {
    this._codesDown.delete(e.code);
  }

  /** @private */
  _isPlayingFallbackActive() {
    return Boolean(
      typeof document !== 'undefined' &&
      document.body &&
      document.body.classList.contains('playing-active') &&
      this._controlMode !== 'touch'
    );
  }

  /** @private */
  _handleMouseMove(e) {
    const locked = this.isPointerLocked();
    if (!locked && !this._isPlayingFallbackActive()) {
      this._lastFallbackMouseX = null;
      this._lastFallbackMouseY = null;
      this._cursorInsideViewport = false;
      return;
    }

    if (this._controlMode === 'auto') this._touchMode = false;

    const now = performance.now();
    let mx = 0;
    let my = 0;

    if (locked) {
      this._lastFallbackMouseX = null;
      this._lastFallbackMouseY = null;
      this._cursorInsideViewport = true;

      if (this._ignoreMouseMoveCount > 0) {
        this._ignoreMouseMoveCount--;
        this._prevLockedMx = 0;
        this._prevLockedMy = 0;
        return;
      }

      mx = Number(e.movementX) || 0;
      my = Number(e.movementY) || 0;

      // Reject Chromium pointer-warp teleport spikes when hidden cursor touches screen/iframe edges
      if (Math.abs(mx) > MAX_LOCKED_SPIKE_PX || Math.abs(my) > MAX_LOCKED_SPIKE_PX) {
        this._prevLockedMx = 0;
        this._prevLockedMy = 0;
        return;
      }

      // Reject instantaneous warp-back bounce pairs within 45ms
      if (now - this._prevLockedTime < 45) {
        if (
          (Math.abs(mx) > 95 && Math.abs(this._prevLockedMx) > 95 && Math.sign(mx) !== Math.sign(this._prevLockedMx)) ||
          (Math.abs(my) > 95 && Math.abs(this._prevLockedMy) > 95 && Math.sign(my) !== Math.sign(this._prevLockedMy))
        ) {
          this._prevLockedMx = 0;
          this._prevLockedMy = 0;
          return;
        }
      }

      this._prevLockedMx = mx;
      this._prevLockedMy = my;
      this._prevLockedTime = now;
    } else {
      // Smooth non-pointer-lock fallback + track edge-zone coords for continuous 360° turn at HTML/Chrome walls
      const cx = Number(e.clientX);
      const cy = Number(e.clientY);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;

      const vw = Math.max(1, window.innerWidth || 1280);
      const vh = Math.max(1, window.innerHeight || 720);
      this._cursorNormX = Math.max(0, Math.min(1, cx / vw));
      this._cursorNormY = Math.max(0, Math.min(1, cy / vh));
      this._cursorInsideViewport = true;
      this._lastMouseMoveTime = now;

      if (this._ignoreMouseMoveCount > 0) {
        this._ignoreMouseMoveCount--;
        this._lastFallbackMouseX = cx;
        this._lastFallbackMouseY = cy;
        return;
      }

      if (this._lastFallbackMouseX !== null && this._lastFallbackMouseY !== null) {
        const dx = cx - this._lastFallbackMouseX;
        const dy = cy - this._lastFallbackMouseY;
        // Re-anchor cleanly instead of jumping across the screen if cursor entered at a distant border
        if (Math.hypot(dx, dy) > MAX_FALLBACK_JUMP_PX) {
          this._lastFallbackMouseX = cx;
          this._lastFallbackMouseY = cy;
          return;
        }
        mx = dx;
        my = dy;
      }
      this._lastFallbackMouseX = cx;
      this._lastFallbackMouseY = cy;
    }

    if (Math.abs(mx) > MAX_SAFE_EVENT_PX) mx = Math.sign(mx) * MAX_SAFE_EVENT_PX;
    if (Math.abs(my) > MAX_SAFE_EVENT_PX) my = Math.sign(my) * MAX_SAFE_EVENT_PX;

    const ySign = this._invertY ? -1 : 1;
    this._lookDeltaX += mx * this._radPerPx;
    this._lookDeltaY += my * ySign * this._radPerPx;
  }

  /** @private */
  _handleMouseDown(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const locked = this.isPointerLocked();
    if (!locked) {
      if (!this._isPlayingFallbackActive()) return;
      // Ignore clicks on HUD buttons (pause, weapon slots, etc.)
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('button')) {
        return;
      }
    }

    if (this._controlMode === 'auto') this._touchMode = false;

    if (e.button === 0) {
      if (!this._mouseActionsDown.has('fire')) {
        this._pressedActions.set('fire', performance.now());
      }
      this._mouseActionsDown.add('fire');
    } else if (e.button === 2) {
      if (!this._mouseActionsDown.has('ads')) {
        this._pressedActions.set('ads', performance.now());
      }
      this._mouseActionsDown.add('ads');
    }
  }

  /** @private */
  _handleMouseUp(e) {
    if (e.button === 0) {
      this._mouseActionsDown.delete('fire');
    } else if (e.button === 2) {
      this._mouseActionsDown.delete('ads');
    }
  }

  /** @private */
  _handleWheel(e) {
    if (!this.isPointerLocked() && !this._isPlayingFallbackActive()) return;
    if (Math.abs(e.deltaY) < 1) return;

    const now = performance.now();
    // Light debounce to prevent trackpad momentum from skipping multiple weapons in 1 tick
    if (now - this._lastWheelTime < 70) return;
    this._lastWheelTime = now;

    this._wheelDelta += e.deltaY > 0 ? 1 : -1;
  }

  /** @private */
  _handleContextMenu(e) {
    e.preventDefault();
  }

  /** @private */
  _handlePointerLockChange() {
    this._ignoreMouseMoveCount = 4;
    this._prevLockedMx = 0;
    this._prevLockedMy = 0;
    this._prevLockedTime = 0;
    this._lastFallbackMouseX = null;
    this._lastFallbackMouseY = null;
    this._lookDeltaX = 0;
    this._lookDeltaY = 0;

    if (this.isPointerLocked()) {
      if (this._controlMode === 'auto') this._touchMode = false;
    } else {
      // Clear held mouse fire/keys when pointer lock releases so fire/movement never sticks
      this._mouseActionsDown.clear();
      this._codesDown.clear();
    }
  }

  /** @private */
  _handlePointerLockError() {
    this._ignoreMouseMoveCount = 2;
    this._lastFallbackMouseX = null;
    this._lastFallbackMouseY = null;
  }

  /** @private */
  _handleMouseLeave(e) {
    // Do NOT clear WASD/keyboard state when cursor touches the browser/iframe edge;
    // clear only fallback anchor so re-entering never creates a cross-screen delta spike.
    this._lastFallbackMouseX = null;
    this._lastFallbackMouseY = null;
    const vw = typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight || 720 : 720;
    const cx = e && Number.isFinite(e.clientX) ? e.clientX : -1;
    const cy = e && Number.isFinite(e.clientY) ? e.clientY : -1;
    const exitedAtWall = cx <= 6 || cx >= vw - 6 || cy <= 6 || cy >= vh - 6;
    if (!exitedAtWall || !this._isPlayingFallbackActive()) {
      this._cursorInsideViewport = false;
    } else {
      // Keep edge pin momentarily if cursor slammed into an HTML wall during fast fallback look
      this._cursorNormX = Math.max(0, Math.min(1, cx / Math.max(1, vw)));
      this._cursorNormY = Math.max(0, Math.min(1, cy / Math.max(1, vh)));
      this._lastMouseMoveTime = performance.now();
    }
  }

  /** @private */
  _handleMouseEnter(e) {
    if (e && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
      this._lastFallbackMouseX = e.clientX;
      this._lastFallbackMouseY = e.clientY;
      this._cursorInsideViewport = true;
    }
  }

  /** @private */
  _handleWindowFocus() {
    this._ignoreMouseMoveCount = 3;
    this._prevLockedMx = 0;
    this._prevLockedMy = 0;
    this._lastFallbackMouseX = null;
    this._lastFallbackMouseY = null;
    this._lookDeltaX = 0;
    this._lookDeltaY = 0;
  }

  /** @private */
  _handleWindowBlur() {
    this.resetAll();
  }

  /** @private */
  _handleTouchStart() {
    if (this._controlMode === 'auto') this._touchMode = true;
  }

  // ---------------------------------------------------------------------------
  // Pointer Lock API
  // ---------------------------------------------------------------------------

  /**
   * Request pointer lock on the game canvas (prefers unadjustedMovement to avoid
   * Chromium OS pointer-acceleration & edge-warp jumps, with clean standard fallback).
   */
  requestPointerLock() {
    if (!this._canvas || typeof this._canvas.requestPointerLock !== 'function') {
      return;
    }
    try {
      const maybePromise = this._canvas.requestPointerLock({ unadjustedMovement: true });
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          try {
            const p2 = this._canvas.requestPointerLock();
            if (p2 && typeof p2.catch === 'function') p2.catch(() => {});
          } catch {}
        });
      }
    } catch {
      try {
        const p2 = this._canvas.requestPointerLock();
        if (p2 && typeof p2.catch === 'function') p2.catch(() => {});
      } catch {}
    }
  }

  /**
   * Exit pointer lock if currently locked.
   */
  exitPointerLock() {
    if (document.pointerLockElement && typeof document.exitPointerLock === 'function') {
      try {
        document.exitPointerLock();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * @returns {boolean}
   */
  isPointerLocked() {
    return Boolean(this._canvas && document.pointerLockElement === this._canvas);
  }

  /**
   * Request Fullscreen (optional) and W3C Keyboard Lock so Chrome/OS shortcuts
   * like Ctrl+W, Ctrl+T, Ctrl+R, Alt+Tab are intercepted cleanly during combat.
   * @param {boolean} [requestFullscreen=false]
   */
  lockGameplayShortcuts(requestFullscreen = false) {
    const lockKeys = () => {
      try {
        if (
          typeof navigator !== 'undefined' &&
          navigator.keyboard &&
          typeof navigator.keyboard.lock === 'function'
        ) {
          const lockPromise = navigator.keyboard.lock(KEYBOARD_LOCK_CODES);
          if (lockPromise && typeof lockPromise.catch === 'function') {
            lockPromise.catch(() => {});
          }
        }
      } catch {}
    };

    try {
      if (
        requestFullscreen &&
        typeof document !== 'undefined' &&
        document.documentElement &&
        !document.fullscreenElement &&
        typeof document.documentElement.requestFullscreen === 'function'
      ) {
        const fsPromise = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (fsPromise && typeof fsPromise.then === 'function') {
          fsPromise.then(() => lockKeys()).catch(() => {
            try {
              const p2 = document.documentElement.requestFullscreen();
              if (p2 && typeof p2.then === 'function') {
                p2.then(() => lockKeys()).catch(() => {});
              }
            } catch {}
          });
        }
      }
    } catch {}

    lockKeys();
  }

  /**
   * Release W3C Keyboard Lock (or keep Escape locked while in fullscreen) and optionally exit fullscreen.
   * @param {boolean} [exitFullscreen=false]
   * @param {boolean} [keepEscapeLocked=false]
   */
  unlockGameplayShortcuts(exitFullscreen = false, keepEscapeLocked = false) {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.keyboard &&
        typeof navigator.keyboard.lock === 'function' &&
        keepEscapeLocked &&
        !exitFullscreen &&
        typeof document !== 'undefined' &&
        document.fullscreenElement
      ) {
        const lockEsc = navigator.keyboard.lock(['Escape']);
        if (lockEsc && typeof lockEsc.catch === 'function') lockEsc.catch(() => {});
      } else if (
        typeof navigator !== 'undefined' &&
        navigator.keyboard &&
        typeof navigator.keyboard.unlock === 'function'
      ) {
        navigator.keyboard.unlock();
      }
    } catch {}

    try {
      if (
        exitFullscreen &&
        typeof document !== 'undefined' &&
        document.fullscreenElement &&
        typeof document.exitFullscreen === 'function'
      ) {
        const p = document.exitFullscreen();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Sensitivity & Touch Overlay API
  // ---------------------------------------------------------------------------

  /**
   * Configure look sensitivity.
   * Accepts either a UI multiplier (e.g. 0.2..3.0, default 1.0) or raw rad/px (< 0.05).
   * @param {number} s
   */
  setSensitivity(s) {
    if (!Number.isFinite(s) || s <= 0) return;
    if (s < 0.05) {
      this._radPerPx = s;
      this._sensitivityMultiplier = s / BASE_MOUSE_RAD_PER_PX;
    } else {
      this._sensitivityMultiplier = Math.max(0.1, Math.min(5.0, s));
      this._radPerPx = BASE_MOUSE_RAD_PER_PX * this._sensitivityMultiplier;
    }
  }

  /**
   * Toggle vertical look Y-axis inversion.
   * @param {boolean} inverted
   */
  setInvertY(inverted) {
    this._invertY = Boolean(inverted);
  }

  /**
   * Set virtual thumbstick movement vector (x: -1..1 right/left, y: -1..1 forward/back).
   * @param {number} x
   * @param {number} y
   */
  setTouchMove(x, y) {
    this._touchMoveX = Math.max(-1, Math.min(1, x || 0));
    this._touchMoveY = Math.max(-1, Math.min(1, y || 0));
    if (this._controlMode === 'auto' && (Math.abs(this._touchMoveX) > 0.01 || Math.abs(this._touchMoveY) > 0.01)) {
      this._touchMode = true;
    }
  }

  /**
   * Accumulate touch look drag delta in screen pixels.
   * @param {number} dx
   * @param {number} dy
   */
  addTouchLook(dx, dy) {
    if (this._controlMode === 'auto') this._touchMode = true;
    const scale = this._radPerPx * TOUCH_LOOK_MULTIPLIER;
    const ySign = this._invertY ? -1 : 1;
    this._lookDeltaX += (dx || 0) * scale;
    this._lookDeltaY += (dy || 0) * ySign * scale;
  }

  /**
   * Set held state for a touch action button ('fire', 'ads', 'sprint', 'slide', etc.).
   * @param {string} action
   * @param {boolean} isDown
   */
  setTouchAction(action, isDown) {
    const canon = this._normalizeAction(action);
    if (isDown) {
      if (this._controlMode === 'auto') this._touchMode = true;
      if (!this._touchActionsDown.has(canon)) {
        this._pressedActions.set(canon, performance.now());
      }
      this._touchActionsDown.add(canon);
    } else {
      this._touchActionsDown.delete(canon);
    }
  }

  /**
   * Fire a one-shot touch action button ('jump', 'dash', 'reload', 'melee', 'slot1'..'slot4', 'pause').
   * @param {string} action
   */
  triggerTouchAction(action) {
    const canon = this._normalizeAction(action);
    if (this._controlMode === 'auto') this._touchMode = true;
    this._pressedActions.set(canon, performance.now());
  }

  /**
   * Lock input handling to 'pc', 'touch', or dynamic 'auto' detection.
   * @param {'auto' | 'pc' | 'touch'} mode
   */
  setControlMode(mode) {
    const normalized = mode === 'pc' || mode === 'touch' ? mode : 'auto';
    this._controlMode = normalized;
    if (normalized === 'pc') {
      this._touchMode = false;
    } else if (normalized === 'touch') {
      this._touchMode = true;
    }
  }

  /**
   * @returns {'auto' | 'pc' | 'touch'}
   */
  getControlMode() {
    return this._controlMode;
  }

  /**
   * Explicitly toggle touch mode.
   * @param {boolean} enabled
   */
  setTouchMode(enabled) {
    this._touchMode = Boolean(enabled);
  }

  /**
   * @returns {boolean}
   */
  isTouchMode() {
    if (this._controlMode === 'pc') return false;
    if (this._controlMode === 'touch') return true;
    return this._touchMode;
  }

  // ---------------------------------------------------------------------------
  // Per-frame Polling API (zero allocation)
  // ---------------------------------------------------------------------------

  /**
   * Get normalized movement vector { x: right(+)/left(-), y: forward(+)/back(-) }.
   * Reuses an internal scratch object.
   * @returns {{ x: number, y: number }}
   */
  getMoveVector() {
    let x = 0;
    let y = 0;

    if (this._codesDown.has('KeyD') || this._codesDown.has('ArrowRight')) x += 1;
    if (this._codesDown.has('KeyA') || this._codesDown.has('ArrowLeft')) x -= 1;
    if (this._codesDown.has('KeyW') || this._codesDown.has('ArrowUp')) y += 1;
    if (this._codesDown.has('KeyS') || this._codesDown.has('ArrowDown')) y -= 1;

    x += this._touchMoveX;
    y += this._touchMoveY;

    const lenSq = x * x + y * y;
    if (lenSq > 1) {
      const invLen = 1 / Math.sqrt(lenSq);
      x *= invLen;
      y *= invLen;
    }

    this._moveOut.x = x;
    this._moveOut.y = y;
    return this._moveOut;
  }

  /**
   * Consume accumulated look delta (in radians) since last frame.
   * Reuses an internal scratch object.
   * @param {number} [dt]
   * @returns {{ x: number, y: number }}
   */
  consumeLookDelta(dt) {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const stepDt =
      Number.isFinite(dt) && dt > 0
        ? Math.min(dt, 0.05)
        : Math.max(0.001, Math.min(0.05, (now - (this._lastLookConsumeTime || now)) * 0.001));
    this._lastLookConsumeTime = now;

    let lx = this._lookDeltaX;
    let ly = this._lookDeltaY;
    this._lookDeltaX = 0;
    this._lookDeltaY = 0;

    // Continuous smooth turning when fallback cursor reaches an HTML/Chrome wall
    if (
      !this.isPointerLocked() &&
      this._isPlayingFallbackActive() &&
      this._cursorInsideViewport &&
      !this.isTouchMode()
    ) {
      const m = EDGE_TURN_MARGIN_NORM;
      const turnSpeed = EDGE_TURN_SPEED_RAD_PER_SEC * Math.max(0.4, Math.min(2.2, this._sensitivityMultiplier));
      if (this._cursorNormX < m) {
        const t = (m - this._cursorNormX) / m;
        lx -= turnSpeed * (0.35 + 0.65 * t) * stepDt;
      } else if (this._cursorNormX > 1 - m) {
        const t = (this._cursorNormX - (1 - m)) / m;
        lx += turnSpeed * (0.35 + 0.65 * t) * stepDt;
      }
      if (this._cursorNormY < m) {
        const t = (m - this._cursorNormY) / m;
        ly -= turnSpeed * 0.65 * (0.35 + 0.65 * t) * stepDt * (this._invertY ? -1 : 1);
      } else if (this._cursorNormY > 1 - m) {
        const t = (this._cursorNormY - (1 - m)) / m;
        ly += turnSpeed * 0.65 * (0.35 + 0.65 * t) * stepDt * (this._invertY ? -1 : 1);
      }
    }

    if (Math.abs(lx) > MAX_FRAME_LOOK_RAD) lx = Math.sign(lx) * MAX_FRAME_LOOK_RAD;
    if (Math.abs(ly) > MAX_FRAME_LOOK_RAD) ly = Math.sign(ly) * MAX_FRAME_LOOK_RAD;

    this._lookOut.x = lx;
    this._lookOut.y = ly;
    return this._lookOut;
  }

  /**
   * Check whether a continuous action is currently held down.
   * @param {string} action
   * @returns {boolean}
   */
  isDown(action) {
    const canon = this._normalizeAction(action);
    if (this._mouseActionsDown.has(canon) || this._touchActionsDown.has(canon)) {
      return true;
    }
    switch (canon) {
      case 'sprint':
        return this._codesDown.has('ShiftLeft') || this._codesDown.has('ShiftRight');
      case 'slide':
        return this._codesDown.has('ControlLeft') || this._codesDown.has('KeyC');
      case 'jump':
        return this._codesDown.has('Space');
      case 'dash':
        return this._codesDown.has('KeyQ') || this._codesDown.has('AltLeft');
      case 'guard':
        return this._codesDown.has('KeyE');
      case 'ultimate':
        return this._codesDown.has('KeyX');
      case 'reload':
        return this._codesDown.has('KeyR');
      case 'melee':
        return this._codesDown.has('KeyV');
      case 'interact':
        return this._codesDown.has('KeyF');
      case 'slot1':
        return this._codesDown.has('Digit1');
      case 'slot2':
        return this._codesDown.has('Digit2');
      case 'slot3':
        return this._codesDown.has('Digit3');
      case 'slot4':
        return this._codesDown.has('Digit4');
      case 'pause':
        return this._codesDown.has('KeyP') || this._codesDown.has('Escape');
      default:
        return false;
    }
  }

  /**
   * Consume a one-shot action press edge if recorded within the last 150ms.
   * Prevents stale unconsumed inputs from triggering phantom shots or abilities later.
   * @param {string} action
   * @returns {boolean}
   */
  consumePressed(action) {
    const canon = this._normalizeAction(action);
    const ts = this._pressedActions.get(canon);
    if (ts !== undefined) {
      this._pressedActions.delete(canon);
      return performance.now() - ts <= PRESSED_TTL_MS;
    }
    return false;
  }

  /**
   * Optional end-of-frame cleanup hook that purges expired press timestamps.
   */
  endFrame() {
    if (this._pressedActions.size === 0) return;
    const now = performance.now();
    for (const [action, ts] of this._pressedActions) {
      if (now - ts > PRESSED_TTL_MS) {
        this._pressedActions.delete(action);
      }
    }
  }

  /**
   * Consume accumulated mouse wheel steps (+1 scroll down, -1 scroll up).
   * @returns {number}
   */
  consumeWheelDelta() {
    const delta = this._wheelDelta;
    this._wheelDelta = 0;
    return delta;
  }

  /**
   * Reset all held keys, pressed buffers, touch sticks, and deltas.
   */
  resetAll() {
    this._codesDown.clear();
    this._mouseActionsDown.clear();
    this._touchActionsDown.clear();
    this._pressedActions.clear();
    this._ignoreMouseMoveCount = 0;
    this._prevLockedMx = 0;
    this._prevLockedMy = 0;
    this._prevLockedTime = 0;
    this._touchMoveX = 0;
    this._touchMoveY = 0;
    this._lookDeltaX = 0;
    this._lookDeltaY = 0;
    this._wheelDelta = 0;
    this._lastFallbackMouseX = null;
    this._lastFallbackMouseY = null;
    this._cursorInsideViewport = false;
    this._cursorNormX = 0.5;
    this._cursorNormY = 0.5;
  }

  /**
   * Clean up all DOM event listeners.
   */
  dispose() {
    this.unlockGameplayShortcuts(false);
    this.resetAll();
    window.removeEventListener('keydown', this._onKeyDown, { capture: true });
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('pointerdown', this._onMouseDown);
    window.removeEventListener('pointerup', this._onMouseUp);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('focus', this._onWindowFocus);
    window.removeEventListener('blur', this._onWindowBlur);
    document.removeEventListener('mouseleave', this._onMouseLeave);
    document.removeEventListener('mouseenter', this._onMouseEnter);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('pointerlockerror', this._onPointerLockError);

    if (this._canvas) {
      this._canvas.removeEventListener('contextmenu', this._onContextMenu);
      this._canvas.removeEventListener('touchstart', this._onTouchStart);
    }
  }
}
  __exports.InputManager = InputManager;
});
