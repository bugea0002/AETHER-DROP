// Module: src/ai/EnemyAI.js
__define("src/ai/EnemyAI.js", (__exports, __require) => {
const { EVENTS } = __require("src/config/constants.js");

const GRAVITY = 26.0;
const TWO_PI = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function stepDampedSpring(pos, vel, stiffness, damping, dt, out) {
  const halfDt = dt * 0.5;
  let x = pos;
  let v = vel;
  for (let i = 0; i < 2; i++) {
    const acc = -stiffness * x - damping * v;
    v += acc * halfDt;
    x += v * halfDt;
  }
  if (Math.abs(x) < 1e-4 && Math.abs(v) < 1e-3) {
    x = 0;
    v = 0;
  }
  out.x = x;
  out.v = v;
}
const FLASH_COLOR = new THREE.Color(0xffffff);
const SHIELD_FLASH_COLOR = new THREE.Color(0xffd080);
const CYAN_SHIELD_FLASH_COLOR = new THREE.Color(0xa5f3fc);
const PHASE2_RING_COLOR = new THREE.Color(0xff7b00);
const PHASE3_RING_COLOR = new THREE.Color(0xff1e00);
const TELEPORT_GLOW_COLOR = new THREE.Color(0xc084fc);
const OVERLOAD_GLOW_COLOR = new THREE.Color(0xff2a6d);
const RAIL_CHARGE_COLOR = new THREE.Color(0x00f0ff);
const SHOCK_SURGE_COLOR = new THREE.Color(0x22d3ee);
const WING_BURNOUT_COLOR = new THREE.Color(0x161b24);
const WING_BURNOUT_EMISSIVE = new THREE.Color(0x05080f);

function wrapAngle(a) {
  let angle = a;
  while (angle > Math.PI) angle -= TWO_PI;
  while (angle < -Math.PI) angle += TWO_PI;
  return angle;
}

/**
 * AETHER DROP: RECLAIM EARTH — Tactical Combat AI Enemy Entity
 * Implements a zero-allocation tactical FSM (spawn -> advance -> strafe -> telegraph
 * -> attack -> stagger -> dead) with CollisionWorld LOS checks, 3-whisker cover
 * flanking, hover flight navigation, procedural rig articulation, crimson/amber lock-on
 * laser telegraphing, directional blast shields, agile flanker dashes, shotgun/mortar
 * salvos, and multi-phase dreadnought boss overdrive.
 */
class Enemy {
  /**
   * @param {number} id
   * @param {any} archetype - Entry from ENEMY_ARCHETYPES
   * @param {THREE.Vector3|{x:number,y:number,z:number}|null} spawnPos
   * @param {THREE.Scene|THREE.Group} scene
   * @param {import('../physics/CollisionWorld.js').CollisionWorld} collisionWorld
   * @param {import('./EnemyModelFactory.js').EnemyModelFactory} modelFactory
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {Array<any>|null} [bossPhases=null]
   * @param {{ dormant?: boolean, pooled?: boolean }|null} [options=null]
   */
  constructor(
    id,
    archetype,
    spawnPos,
    scene,
    collisionWorld,
    modelFactory,
    eventBus,
    bossPhases = null,
    options = null
  ) {
    this.id = id;
    this.archetype = archetype;
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.eventBus = eventBus;
    this.bossPhases = Array.isArray(bossPhases) ? bossPhases : null;
    this._pooled = Boolean(options && (options.pooled || options.dormant));
    this._disposed = false;

    const isDormant = Boolean(options && options.dormant === true);
    const sx = spawnPos && Number.isFinite(spawnPos.x) ? spawnPos.x : 0;
    const sy = spawnPos && Number.isFinite(spawnPos.y) ? spawnPos.y : 0;
    const sz = spawnPos && Number.isFinite(spawnPos.z) ? spawnPos.z : 0;

    // Exact Target Contract fields
    this.isAlive = !isDormant;
    this.isEnemy = true;
    this.isRemoved = isDormant;
    this.position = new THREE.Vector3(sx, sy, sz);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.hp = archetype.hp;
    this.maxHp = archetype.hp;
    this.currentPhase = 1;
    this.state = isDormant ? 'dormant' : 'spawn';

    // Aim-assist & quick-query cached world points (zero-GC)
    this.center = new THREE.Vector3();
    this.headPosition = new THREE.Vector3();
    this.aimPoint = this.center;

    // Kill / damage metadata for WaveDirector
    this.lastHitWasHeadshot = false;
    this.lastHitPoint = new THREE.Vector3();
    this._killProcessed = false;
    this._onDeathCallback = null;
    this._onOverloadCallback = null;

    // Act 3 Mechanic State: Overload Frenzy, Dimensional Teleport, Boss Turret Shield Link
    this._overloadActive = false;
    this._overloadFuse = archetype.overloadFuse || 0.85;
    this._overloadTimer = 0;
    this._overloadFired = false;

    this._blinkCooldown = archetype.canTeleport ? 2.4 + Math.random() * 2.2 : 0;
    this._blinkTelegraphTimer = 0;
    this._blinkTargetPos = new THREE.Vector3();
    this._blinkFromPos = new THREE.Vector3();

    this._turretShieldActive = Boolean(archetype.turretShieldEnabled);
    this._coreExposedTimer = 0;
    this._singularityPullTimer = 0;
    this._empCooldown = archetype.id === 'transcendent_omega_boss' ? 11.5 : 0;

    // Act 2 Mechanic State: Shock Breacher Thruster Surge, Assassin Blink-Dash, Overlord Wing Cores
    this._shockDashTimer = 0;
    this._shockDashCooldown = archetype.id === 'shock_breacher' ? 1.4 + Math.random() * 1.2 : 0;
    this._assassinBlinkCooldown = archetype.id === 'vanguard_assassin' ? 1.4 + Math.random() * 1.2 : 0;
    this._customTintActive = false;

    this._wingCoreMaxHpL = 0;
    this._wingCoreMaxHpR = 0;
    this._wingCoreHpL = 0;
    this._wingCoreHpR = 0;
    this._wingCoreDestroyedL = false;
    this._wingCoreDestroyedR = false;
    this._initWingCoreState(this.maxHp);

    // Flying drone starts aloft above floor
    if (!isDormant && archetype.isFlying) {
      const floorY = collisionWorld.getGroundHeightAt(this.position.x, this.position.z, 20);
      this.position.y = Math.max(this.position.y, floorY + 2.3);
    }

    // Build sculpted 3D rig & mount into scene/enemyGroup
    this.scaleMult = 1.0;
    this.rig = modelFactory.createEnemyRig(archetype);
    this.root = this.rig.root;
    this.rig.root.position.copy(this.position);
    this.rig.root.visible = !isDormant;
    this.scene.add(this.rig.root);

    // Orientation & procedural animation accumulators (Zero-GC spring kinematics)
    this._yaw = 0;
    this._walkCycle = Math.random() * TWO_PI;
    this._hoverSeed = Math.random() * TWO_PI;
    this._rotorSpeed = archetype.isFlying ? 28.0 : 4.5;
    this._recoilAnim = 0;
    this._recoilRight = 0;
    this._recoilRightVel = 0;
    this._recoilLeft = 0;
    this._recoilLeftVel = 0;
    this._recoilShake = 0;
    this._bodyRecoilX = 0;
    this._bodyRecoilVel = 0;
    this._aimPitch = 0;
    this._hitSideBias = 0;
    this._crouchBlend = 0;
    this._springOut = { x: 0, v: 0 };
    this._localHitVec = new THREE.Vector3();
    this._spawnTimer = 0.52;
    this._deathTimer = 0;
    this._deathDuration =
      archetype.id === 'aegis_overlord_boss' ? 1.35 : archetype.isBoss ? 1.15 : 0.45;
    this._deathTiltAxis = new THREE.Vector3(1, 0, 0);

    // Visual hit-flash & shield feedback timers
    this._hitFlashTimer = 0;
    this._hitFlinch = 0;
    this._shieldFlashTimer = 0;
    this._phaseShieldTimer = 0;
    this.markedTimer = 0;

    // Tactical AI FSM timers & steering memory
    this._strafeDir = Math.random() < 0.5 ? 1 : -1;
    this._strafeSwitchTimer = 1.6 + Math.random() * 1.6;
    this._coverPauseTimer = 0;
    this._blockedTimer = 0;
    this._attackCooldown = 0.55 + Math.random() * 0.6;
    this._telegraphTimer = 0;
    this._staggerTimer = 0;
    this._staggerCooldown = 0;
    this._burstRemaining = 0;
    this._burstShotTimer = 0;
    this._altMuzzleToggle = false;
    this._losCheckTimer = Math.random() * 0.1;
    this._hasLOS = false;

    // Boss phase & Threat stage dynamic combat multipliers
    this._phaseSpeedMult = 1.0;
    this._phaseFireMult = 1.0;
    this.threatSpeedMult = 1.0;
    this._phaseBurstCount = archetype.isBoss
      ? archetype.id === 'aegis_overlord_boss'
        ? 4
        : 3
      : 1;
    this._phaseName =
      this.bossPhases && this.bossPhases.length > 0 ? this.bossPhases[0].name : '';
    this._bossPatternCycle = 0;
    this._bossActivePattern =
      archetype.id === 'aegis_overlord_boss'
        ? 'orbital_fan'
        : archetype.id === 'transcendent_omega_boss'
        ? 'void_lance_fan'
        : 'rotary_barrage';
    this._bossBurstShotIdx = 0;

    // Sniper / Mortar locked target point (locks smoothly then freezes final 0.2s for dash counterplay)
    this._lockedAimPoint = new THREE.Vector3();
    this._sniperLockFrozen = false;
    this.isSniperLocking = false;

    // Pre-allocated hit spheres (zero-GC getHitSpheres) — +15% player-favored hitbox expansion
    const HITBOX_SCALE = 1.15;
    const headR = archetype.headRadius * 1.18 * HITBOX_SCALE;
    const bodyR =
      archetype.id === 'aegis_overlord_boss'
        ? 1.25
        : archetype.id === 'transcendent_omega_boss'
        ? 1.35
        : archetype.radius * 0.94 * HITBOX_SCALE;
    const lowerR =
      archetype.id === 'aegis_overlord_boss'
        ? 1.05
        : archetype.radius * 0.85 * HITBOX_SCALE;
    const shieldR = archetype.isBoss
      ? archetype.id === 'aegis_overlord_boss' || archetype.id === 'transcendent_omega_boss'
        ? 1.85
        : 1.68
      : archetype.id === 'rail_warden'
      ? 0.74
      : 0.68;

    this._sphereHead = {
      center: new THREE.Vector3(),
      radius: headR,
      isHead: true,
      isShield: false,
      entity: this,
    };
    this._sphereTorso = {
      center: new THREE.Vector3(),
      radius: bodyR,
      isHead: false,
      isShield: false,
      entity: this,
    };
    this._sphereLower = {
      center: new THREE.Vector3(),
      radius: lowerR,
      isHead: false,
      isShield: false,
      entity: this,
    };
    this._sphereShield = {
      center: new THREE.Vector3(),
      radius: shieldR,
      isHead: false,
      isShield: true,
      entity: this,
    };
    this._sphereWingL = {
      center: new THREE.Vector3(),
      radius: 0.85,
      isHead: false,
      isShield: false,
      weakpoint: 'wingCoreL',
      hitMult: 1.45,
      entity: this,
    };
    this._sphereWingR = {
      center: new THREE.Vector3(),
      radius: 0.85,
      isHead: false,
      isShield: false,
      weakpoint: 'wingCoreR',
      hitMult: 1.45,
      entity: this,
    };

    this._hitSpheres3 = [this._sphereHead, this._sphereTorso, this._sphereLower];
    this._hitSpheres4 = [
      this._sphereHead,
      this._sphereTorso,
      this._sphereLower,
      this._sphereShield,
    ];
    this._bossHitSpheres = [];

    // Pre-allocated scratch vectors & raycast structs (strictly zero-GC update)
    this._eyePos = new THREE.Vector3();
    this._toPlayer = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._sideDir = new THREE.Vector3();
    this._probeDir = new THREE.Vector3();
    this._muzzleWorld = new THREE.Vector3();
    this._shotDir = new THREE.Vector3();
    this._fanDir = new THREE.Vector3();
    this._laserStartLocal = new THREE.Vector3();
    this._laserEndLocal = new THREE.Vector3();
    this._laserDirLocal = new THREE.Vector3();
    this._laserEndWorld = new THREE.Vector3();
    this._mortarTarget = new THREE.Vector3();
    this._projExtraOpts = {
      isMortar: false,
      targetPos: this._mortarTarget,
      gravity: 22.0,
      splashRadius: 3.4,
      flightTime: 1.4,
      boltColor: 0,
    };
    this._wingCoreWorldPos = new THREE.Vector3();
    this._wingShotDir = new THREE.Vector3();
    this._sweepStartPos = new THREE.Vector3();
    this._sweepEndPos = new THREE.Vector3();
    this._orbitalSweepPayload = {
      startPos: this._sweepStartPos,
      endPos: this._sweepEndPos,
      telegraphDuration: 1.15,
      sweepDuration: 1.35,
      beamRadius: 2.15,
      damage: 28,
      boss: this,
    };
    this._wingShatterPayload = {
      boss: this,
      side: 'L',
      sideLabel: '좌',
      remaining: 1,
      position: this._wingCoreWorldPos,
      shieldBroken: false,
    };
    this._droneSalvoPayload = {
      boss: this,
      position: this.position,
      phase: 1,
    };
    this._teleportPayload = {
      enemy: this,
      fromPos: this._blinkFromPos,
      toPos: this.position,
      color: archetype.accentColor || 0xa855f7,
      yaw: 0,
      height: archetype.height,
      isBoss: Boolean(archetype.isBoss),
    };
    this._singularityPullPayload = {
      boss: this,
      origin: this.position,
      telegraphDuration: 1.1,
      pullDuration: 1.4,
      pullRadius: 30.0,
      pullAccel: 13.5,
      maxPullSpeed: 6.6,
    };
    this._podPosL = new THREE.Vector3();
    this._podPosR = new THREE.Vector3();
    this._homingMissilePayload = {
      boss: this,
      originL: this._podPosL,
      originR: this._podPosR,
      targetPos: new THREE.Vector3(),
      phase: 1,
      damage: 28,
      speed: 17.5,
    };
    this._hazardOrigin = new THREE.Vector3();
    this._hazardFieldPayload = {
      boss: this,
      center: this._hazardOrigin,
      bossPos: this.position,
      phase: 1,
      radius: 3.2,
      duration: 9.0,
      damage: 14,
    };
    this._empPulsePayload = {
      boss: this,
      origin: this.position,
      duration: 5.0,
      phase: 1,
    };
    this._rayHit = {
      hit: false,
      distance: 0,
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      tag: '',
    };

    if (!isDormant) {
      this.rig.root.updateMatrixWorld(true);
      this._syncCachedPositions();
    }
  }

  /**
   * Persist and apply a uniform visual scale multiplier across spawn/dissolve animations.
   * @param {number} [mult=1.0]
   */
  setScaleMultiplier(mult = 1.0) {
    this.scaleMult = Number.isFinite(mult) && mult > 0 ? mult : 1.0;
    if (this.rig && this.rig.root) {
      this.rig.root.scale.setScalar(this.scaleMult);
    }
  }

  /**
   * Update scaled maxHp and sync destructible boss wing-core HP pools cleanly.
   * @param {number} newMaxHp
   */
  setMaxHp(newMaxHp) {
    if (!Number.isFinite(newMaxHp) || newMaxHp <= 0) return;
    this.maxHp = Math.round(newMaxHp);
    this.hp = this.maxHp;
    this._initWingCoreState(this.maxHp);
  }

  /** @private */
  _initWingCoreState(bossMaxHp) {
    if (this.archetype && this.archetype.id === 'aegis_overlord_boss') {
      const coreMax = Math.min(1800, Math.max(450, Math.round(bossMaxHp * 0.18)));
      this._wingCoreMaxHpL = coreMax;
      this._wingCoreMaxHpR = coreMax;
      this._wingCoreHpL = coreMax;
      this._wingCoreHpR = coreMax;
      this._wingCoreDestroyedL = false;
      this._wingCoreDestroyedR = false;
    } else {
      this._wingCoreMaxHpL = 0;
      this._wingCoreMaxHpR = 0;
      this._wingCoreHpL = 0;
      this._wingCoreHpR = 0;
      this._wingCoreDestroyedL = false;
      this._wingCoreDestroyedR = false;
    }
  }

  /** @private */
  _restoreWingCoreVisuals() {
    if (!this.rig) return;
    const cores = [this.rig.wingCoreL, this.rig.wingCoreR];
    for (let i = 0; i < cores.length; i++) {
      const wc = cores[i];
      if (!wc) continue;
      wc.visible = true;
      const mat = wc.userData && wc.userData.coreMaterial;
      if (mat) {
        if (mat.userData.baseColor) mat.color.copy(mat.userData.baseColor);
        if (mat.userData.baseEmissive) mat.emissive.copy(mat.userData.baseEmissive);
        if (mat.userData.baseEmissiveIntensity !== undefined) {
          mat.emissiveIntensity = mat.userData.baseEmissiveIntensity;
        }
      }
      const haloMat = wc.userData && wc.userData.haloMaterial;
      if (haloMat) {
        if (haloMat.userData.baseColor) haloMat.color.copy(haloMat.userData.baseColor);
        if (haloMat.userData.baseEmissive) haloMat.emissive.copy(haloMat.userData.baseEmissive);
        if (haloMat.userData.baseEmissiveIntensity !== undefined) {
          haloMat.emissiveIntensity = haloMat.userData.baseEmissiveIntensity;
        }
      }
      if (wc.userData && wc.userData.haloMesh) {
        wc.userData.haloMesh.visible = true;
      }
    }
  }

  /**
   * Activate and reset this pooled Enemy instance at spawnPos with zero rig allocations.
   * @param {number} id
   * @param {THREE.Vector3|{x:number,y:number,z:number}} spawnPos
   * @param {Array<any>|null} [bossPhases=null]
   */
  activate(id, spawnPos, bossPhases = null) {
    if (this._disposed) return;

    this.id = id;
    this.bossPhases = Array.isArray(bossPhases) ? bossPhases : null;

    this.isAlive = true;
    this.isRemoved = false;
    this.hp = this.archetype.hp;
    this.maxHp = this.archetype.hp;
    this.currentPhase = 1;
    this.state = 'spawn';

    const sx = spawnPos && Number.isFinite(spawnPos.x) ? spawnPos.x : 0;
    const sy = spawnPos && Number.isFinite(spawnPos.y) ? spawnPos.y : 0;
    const sz = spawnPos && Number.isFinite(spawnPos.z) ? spawnPos.z : 0;
    this.position.set(sx, sy, sz);
    this.velocity.set(0, 0, 0);

    if (this.archetype.isFlying) {
      const floorY = this.collisionWorld.getGroundHeightAt(this.position.x, this.position.z, 20);
      this.position.y = Math.max(this.position.y, floorY + 2.3);
    }

    this.lastHitWasHeadshot = false;
    this.lastHitPoint.set(0, 0, 0);
    this._killProcessed = false;

    this._yaw = 0;
    this._walkCycle = Math.random() * TWO_PI;
    this._hoverSeed = Math.random() * TWO_PI;
    this._rotorSpeed = this.archetype.isFlying ? 28.0 : 4.5;
    this._recoilAnim = 0;
    this._recoilRight = 0;
    this._recoilRightVel = 0;
    this._recoilLeft = 0;
    this._recoilLeftVel = 0;
    this._recoilShake = 0;
    this._bodyRecoilX = 0;
    this._bodyRecoilVel = 0;
    this._aimPitch = 0;
    this._hitSideBias = 0;
    this._crouchBlend = 0;
    this._spawnTimer = 0.52;
    this._deathTimer = 0;

    this._hitFlashTimer = 0;
    this._hitFlinch = 0;
    this._shieldFlashTimer = 0;
    this._phaseShieldTimer = 0;
    this.markedTimer = 0;
    this.eliteAffix = null;
    this.isSupplyDrone = false;
    this.lastHitWasMelee = false;
    this.displayName = this.archetype ? this.archetype.name : '';
    this.scaleMult = 1.0;
    if (this.rig && this.rig.root) this.rig.root.scale.set(1, 1, 1);

    this._overloadActive = false;
    this._overloadFuse = this.archetype.overloadFuse || 0.85;
    this._overloadTimer = 0;
    this._overloadFired = false;
    this._blinkCooldown = this.archetype.canTeleport ? 2.2 + Math.random() * 2.0 : 0;
    this._blinkTelegraphTimer = 0;
    this._turretShieldActive = Boolean(this.archetype.turretShieldEnabled);
    this._coreExposedTimer = 0;
    this._singularityPullTimer = 0;
    this._empCooldown = this.archetype.id === 'transcendent_omega_boss' ? 10.0 : 0;

    this._shockDashTimer = 0;
    this._shockDashCooldown = this.archetype.id === 'shock_breacher' ? 1.4 + Math.random() * 1.2 : 0;
    this._assassinBlinkCooldown = this.archetype.id === 'vanguard_assassin' ? 1.4 + Math.random() * 1.2 : 0;
    this._customTintActive = false;
    this._initWingCoreState(this.maxHp);

    this._strafeDir = Math.random() < 0.5 ? 1 : -1;
    this._strafeSwitchTimer = 1.6 + Math.random() * 1.6;
    this._coverPauseTimer = 0;
    this._blockedTimer = 0;
    this._attackCooldown = 0.55 + Math.random() * 0.6;
    this._telegraphTimer = 0;
    this._staggerTimer = 0;
    this._staggerCooldown = 0;
    this._burstRemaining = 0;
    this._burstShotTimer = 0;
    this._altMuzzleToggle = false;
    this._losCheckTimer = Math.random() * 0.1;
    this._hasLOS = false;

    this._phaseSpeedMult = 1.0;
    this._phaseFireMult = 1.0;
    this.threatSpeedMult = 1.0;
    this._phaseBurstCount = this.archetype.isBoss
      ? this.archetype.id === 'aegis_overlord_boss'
        ? 4
        : 3
      : 1;
    this._phaseName =
      this.bossPhases && this.bossPhases.length > 0 ? this.bossPhases[0].name : '';
    this._bossPatternCycle = 0;
    this._bossActivePattern =
      this.archetype.id === 'aegis_overlord_boss'
        ? 'orbital_fan'
        : this.archetype.id === 'transcendent_omega_boss'
        ? 'void_lance_fan'
        : 'rotary_barrage';
    this._bossBurstShotIdx = 0;

    this._lockedAimPoint.set(0, 0, 0);
    this._sniperLockFrozen = false;
    this.isSniperLocking = false;

    const rig = this.rig;
    if (rig) {
      if (typeof rig.resetPose === 'function') {
        rig.resetPose();
      }
      rig.root.position.copy(this.position);
      rig.root.rotation.set(0, 0, 0);
      rig.root.scale.set(1, 1, 1);
      rig.root.visible = true;

      const flyBaseY =
        this.archetype.id === 'interceptor_drone'
          ? 0.62
          : this.archetype.id === 'void_swarmer'
          ? 0.56
          : 0.55;
      rig.bodyGroup.rotation.set(0, 0, 0);
      rig.bodyGroup.position.set(0, this.archetype.isFlying ? flyBaseY : 0, 0);
      if (rig.overloadRing) {
        rig.overloadRing.visible = false;
        rig.overloadRing.scale.set(1, 1, 1);
      }

      if (rig.headGroup && !rig.headGroup.userData.basePosition) {
        rig.headGroup.scale.set(1, 1, 1);
        rig.headGroup.rotation.set(0, 0, 0);
      }
      if (rig.leftLeg && !rig.leftLeg.userData.baseRotation) rig.leftLeg.rotation.set(0, 0, 0);
      if (rig.rightLeg && !rig.rightLeg.userData.baseRotation) rig.rightLeg.rotation.set(0, 0, 0);
      if (rig.leftArm && !rig.leftArm.userData.baseRotation) {
        rig.leftArm.rotation.set(0, 0, 0);
        if (this.archetype.id === 'interceptor_drone') {
          rig.leftArm.position.z = 0.14;
        }
      }
      if (rig.rightArm && !rig.rightArm.userData.baseRotation) {
        rig.rightArm.rotation.set(0, 0, 0);
        if (this.archetype.isFlying) {
          rig.rightArm.position.z = this.archetype.id === 'interceptor_drone' ? 0.14 : 0.12;
        }
      }

      const mats = rig.flashMaterials;
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i];
        if (m.userData.baseEmissive) {
          m.emissive.copy(m.userData.baseEmissive);
        }
        if (m.userData.baseEmissiveIntensity !== undefined) {
          m.emissiveIntensity = m.userData.baseEmissiveIntensity;
        }
      }

      if (rig.shieldMesh) {
        rig.shieldMesh.visible = !this.archetype.isBoss;
        rig.shieldMesh.rotation.y = 0;
        const sMat = rig.shieldMesh.material;
        if (sMat) {
          if (sMat.userData.baseColor) sMat.color.copy(sMat.userData.baseColor);
          if (sMat.userData.baseEmissive) sMat.emissive.copy(sMat.userData.baseEmissive);
          if (sMat.userData.baseEmissiveIntensity !== undefined) {
            sMat.emissiveIntensity = sMat.userData.baseEmissiveIntensity;
          }
          if (sMat.userData.baseOpacity !== undefined) {
            sMat.opacity = this.archetype.isBoss ? 0.0 : sMat.userData.baseOpacity;
          }
        }
      }

      if (rig.coreRings) {
        for (let r = 0; r < rig.coreRings.length; r++) {
          const ring = rig.coreRings[r];
          if (ring.userData.baseRotation) {
            ring.rotation.copy(ring.userData.baseRotation);
          }
          const rMat = ring.userData.ringMaterial;
          if (rMat) {
            if (rMat.userData.baseColor) rMat.color.copy(rMat.userData.baseColor);
            if (rMat.userData.baseEmissive) rMat.emissive.copy(rMat.userData.baseEmissive);
            if (rMat.userData.baseEmissiveIntensity !== undefined) {
              rMat.emissiveIntensity = rMat.userData.baseEmissiveIntensity;
            }
          }
        }
      }

      this._hideLaser();
      this._restoreWingCoreVisuals();

      if (rig.healthBarBg) {
        rig.healthBarBg.visible = false;
      }
      if (rig.healthBarFill) {
        rig.healthBarFill.scale.x = 1;
      }

      rig.root.updateMatrixWorld(true);
    }

    this._syncCachedPositions();
  }

  /**
   * Return this enemy rig cleanly to its dormant pool state without disposing GPU assets.
   */
  deactivate() {
    this.isAlive = false;
    this.isRemoved = true;
    this.state = 'dormant';
    this._overloadActive = false;
    this._blinkTelegraphTimer = 0;
    this._turretShieldActive = false;
    this._coreExposedTimer = 0;
    this._shockDashTimer = 0;
    this._customTintActive = false;
    this._wingCoreHpL = 0;
    this._wingCoreHpR = 0;
    this._wingCoreDestroyedL = false;
    this._wingCoreDestroyedR = false;
    this._recoilAnim = 0;
    this._recoilRight = 0;
    this._recoilRightVel = 0;
    this._recoilLeft = 0;
    this._recoilLeftVel = 0;
    this._recoilShake = 0;
    this._bodyRecoilX = 0;
    this._bodyRecoilVel = 0;
    this._aimPitch = 0;
    this._hitSideBias = 0;
    this._crouchBlend = 0;
    this._hideLaser();
    if (this.rig) {
      if (typeof this.rig.resetPose === 'function') {
        this.rig.resetPose();
      }
      if (this.rig.overloadRing) {
        this.rig.overloadRing.visible = false;
      }
      if (this.rig.healthBarBg) {
        this.rig.healthBarBg.visible = false;
      }
      if (this.rig.root) {
        this.rig.root.visible = false;
      }
    }
  }

  /**
   * Optional synchronous death listener used by WaveDirector for zero-latency kill processing.
   * @param {(enemy: Enemy, isHeadshot: boolean, hitPoint: THREE.Vector3) => void} cb
   */
  setDeathCallback(cb) {
    this._onDeathCallback = cb;
  }

  /**
   * Optional listener fired when a volatile_rusher completes its overload detonation fuse.
   * @param {(enemy: Enemy) => void} cb
   */
  setOverloadCallback(cb) {
    this._onOverloadCallback = cb;
  }

  /**
   * Trigger Overload Frenzy on volatile_rusher (from HP drop, proximity, or chain blast).
   * @param {number} [fuseOverride]
   */
  triggerOverload(fuseOverride) {
    if (!this.isAlive || !this.archetype.overloadFrenzy || this._overloadActive) return;
    this._overloadActive = true;
    const fuse = Number.isFinite(fuseOverride) && fuseOverride > 0
      ? fuseOverride
      : this.archetype.overloadFuse || 0.85;
    this._overloadFuse = fuse;
    this._overloadTimer = fuse;
    this._overloadFired = false;
    if (this.state !== 'spawn') {
      this.state = 'advance';
    }
    if (this.eventBus) {
      this.eventBus.emit(EVENTS.ENEMY_OVERLOAD, {
        enemy: this,
        position: this.position,
        phase: 'telegraph',
        radius: this.archetype.overloadRadius || 8.0,
      });
    }
  }

  /**
   * Enable or disable Boss Turret Shield Link (65% damage reduction while active).
   * @param {boolean} active
   */
  setTurretShieldActive(active) {
    this._turretShieldActive = Boolean(active);
    if (active) {
      this._coreExposedTimer = 0;
      this._shieldFlashTimer = 0.4;
    }
  }

  /**
   * Shatter Boss Turret Shield Link when all phase turrets are destroyed.
   */
  breakTurretShield() {
    if (!this.isAlive) return;
    this._turretShieldActive = false;
    this._phaseShieldTimer = 0;
    this._coreExposedTimer = 4.5;
    this.state = 'stagger';
    this._staggerTimer = 1.4;
    this._burstRemaining = 0;
    this._hitFlashTimer = 0.25;
  }

  /**
   * Immediate kill helper (used for wave cleanup / summoned minion purge).
   */
  die() {
    if (!this.isAlive) return;
    this.hp = 0;
    this._enterDeathState(false, null);
  }

  /**
   * Write world-space center of enemy into outVec.
   * @param {THREE.Vector3} [outVec]
   * @returns {THREE.Vector3}
   */
  getCenterPosition(outVec = new THREE.Vector3()) {
    return outVec.set(
      this.position.x,
      this.position.y + this.archetype.height * 0.52,
      this.position.z
    );
  }

  /**
   * Write world-space head / cranial core weakpoint position into outVec.
   * @param {THREE.Vector3} [outVec]
   * @returns {THREE.Vector3}
   */
  getHeadPosition(outVec = new THREE.Vector3()) {
    return outVec.copy(this.headPosition);
  }

  /**
   * Update and return pre-allocated hit spheres array (zero allocations).
   * @returns {Array<{center: THREE.Vector3, radius: number, isHead: boolean, isShield: boolean, entity: Enemy}>}
   */
  getHitSpheres() {
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;
    const h = this.archetype.height;

    this._sphereHead.center.copy(this.headPosition);

    if (this.archetype.isFlying) {
      const torsoOff =
        this.archetype.id === 'interceptor_drone'
          ? 0.60
          : this.archetype.id === 'void_swarmer'
          ? 0.54
          : 0.54;
      const lowerOff = this.archetype.id === 'interceptor_drone' ? 0.38 : 0.36;
      this._sphereTorso.center.set(px, py + torsoOff, pz);
      this._sphereLower.center.set(px, py + lowerOff, pz);
    } else if (this.archetype.id === 'aegis_overlord_boss') {
      this._sphereTorso.center.set(px, py + 2.75, pz);
      this._sphereLower.center.set(px, py + 2.05, pz);
    } else if (this.archetype.id === 'transcendent_omega_boss') {
      this._sphereTorso.center.set(px, py + 3.05, pz);
      this._sphereLower.center.set(px, py + 1.85, pz);
    } else {
      this._sphereTorso.center.set(px, py + h * 0.62, pz);
      this._sphereLower.center.set(px, py + h * 0.28, pz);
    }

    if (this.archetype.id === 'aegis_overlord_boss') {
      const list = this._bossHitSpheres;
      list.length = 0;
      list.push(this._sphereHead, this._sphereTorso, this._sphereLower);

      if ((this._phaseShieldTimer > 0 || this._turretShieldActive) && this.rig.shieldMesh) {
        this._sphereShield.center.set(px, py + 2.65, pz);
        list.push(this._sphereShield);
      }

      if (this._wingCoreHpL > 0) {
        if (this.rig.wingCoreL) {
          this.rig.wingCoreL.getWorldPosition(this._sphereWingL.center);
        } else {
          const sinY = Math.sin(this._yaw);
          const cosY = Math.cos(this._yaw);
          this._sphereWingL.center.set(
            px + cosY * 1.62 - sinY * 0.14,
            py + 3.92,
            pz - sinY * 1.62 - cosY * 0.14
          );
        }
        list.push(this._sphereWingL);
      }

      if (this._wingCoreHpR > 0) {
        if (this.rig.wingCoreR) {
          this.rig.wingCoreR.getWorldPosition(this._sphereWingR.center);
        } else {
          const sinY = Math.sin(this._yaw);
          const cosY = Math.cos(this._yaw);
          this._sphereWingR.center.set(
            px - cosY * 1.62 - sinY * 0.14,
            py + 3.92,
            pz + sinY * 1.62 - cosY * 0.14
          );
        }
        list.push(this._sphereWingR);
      }

      return list;
    }

    if (this.archetype.hasShield) {
      if (this.archetype.isBoss) {
        if ((this._phaseShieldTimer > 0 || this._turretShieldActive) && this.rig.shieldMesh) {
          const bossShieldY =
            this.archetype.id === 'transcendent_omega_boss' ? 3.05 : 2.02;
          this._sphereShield.center.set(px, py + bossShieldY, pz);
          return this._hitSpheres4;
        }
        return this._hitSpheres3;
      }

      // Heavy Enforcer / Rail Warden / Abyss Sentinel frontal blast shield positioned directly on shieldMesh
      if (this.rig.shieldMesh) {
        this.rig.shieldMesh.getWorldPosition(this._sphereShield.center);
        this._sphereShield.center.y -=
          this.archetype.id === 'rail_warden' || this.archetype.id === 'abyss_sentinel' ? 0.02 : 0.06;
        return this._hitSpheres4;
      }
    }

    return this._hitSpheres3;
  }

  /**
   * Apply incoming weapon/explosion/melee damage with shield reduction, hit-flash,
   * stagger, boss phase transitions, and smooth death dissolution.
   *
   * @param {number} amount
   * @param {THREE.Vector3|null} [hitPoint=null]
   * @param {boolean} [isHeadshot=false]
   * @param {THREE.Vector3|null} [knockbackDir=null]
   * @param {{ hitShield?: boolean, piercing?: boolean, isExplosion?: boolean, isMelee?: boolean }} [options={}]
   * @returns {{ dealt: number, killed: boolean, blockedByShield: boolean }}
   */
  applyDamage(amount, hitPoint = null, isHeadshot = false, knockbackDir = null, options = {}) {
    if (!this.isAlive || !Number.isFinite(amount) || amount <= 0) {
      return { dealt: 0, killed: false, blockedByShield: false };
    }

    if (hitPoint) {
      this.lastHitPoint.copy(hitPoint);
    } else {
      this.getCenterPosition(this.lastHitPoint);
    }

    // Directional Riot Shield / Boss Phase-Surge Shield Block
    const shieldBlocks =
      Boolean(options && options.hitShield) &&
      this.archetype.hasShield &&
      !(options && options.piercing) &&
      (!this.archetype.isBoss || this._phaseShieldTimer > 0);

    if (shieldBlocks) {
      const linkScale = this._turretShieldActive && this.archetype.isBoss ? 0.35 : 1.0;
      const dealt = Math.max(1, Math.round(amount * 0.25 * linkScale));
      this.hp = Math.max(1, this.hp - dealt);
      this._shieldFlashTimer = 0.28;
      this._updateHealthBar();

      if (knockbackDir) {
        this.velocity.x += knockbackDir.x * 1.4;
        this.velocity.z += knockbackDir.z * 1.4;
      }

      return { dealt, killed: false, blockedByShield: true };
    }

    // Full damage resolution (+25% if marked, 0.35x if Boss Turret Shield Link active, 1.25x if core exposed)
    const markMult = this.markedTimer > 0 ? 1.25 : 1.0;
    const turretLinkMult =
      this._turretShieldActive && this.archetype.isBoss && !(options && options.fromTurretBreak)
        ? 0.35
        : this._coreExposedTimer > 0 && this.archetype.isBoss
        ? 1.25
        : 1.0;
    if (this._turretShieldActive && this.archetype.isBoss) {
      this._shieldFlashTimer = Math.max(this._shieldFlashTimer, 0.18);
    }
    const dealt = Math.max(1, amount * markMult * turretLinkMult);
    this.hp = Math.max(0, this.hp - dealt);
    this.lastHitWasHeadshot = Boolean(isHeadshot);
    this.lastHitWasMelee = Boolean(options && options.isMelee);
    this._hitFlashTimer = isHeadshot ? 0.15 : 0.11;
    this._hitFlinch = Math.min(1.0, (this._hitFlinch || 0) + (isHeadshot ? 1.0 : 0.58));
    if (hitPoint) {
      const hdx = hitPoint.x - this.position.x;
      const hdz = hitPoint.z - this.position.z;
      const cosY = Math.cos(this._yaw);
      const sinY = Math.sin(this._yaw);
      const localRight = hdx * cosY - hdz * sinY;
      const hMag = Math.max(0.25, Math.hypot(hdx, hdz));
      this._hitSideBias = Math.max(-1, Math.min(1, (localRight / hMag) * (isHeadshot ? 1.25 : 0.95)));
    } else if (knockbackDir) {
      const cosY = Math.cos(this._yaw);
      const sinY = Math.sin(this._yaw);
      const localRight = knockbackDir.x * cosY - knockbackDir.z * sinY;
      this._hitSideBias = Math.max(-1, Math.min(1, -localRight * 0.95));
    }
    this._updateHealthBar();

    // Volatile Rusher enters Overload Frenzy when damaged below threshold (unless killed outright)
    if (
      this.hp > 0 &&
      this.archetype.overloadFrenzy &&
      !this._overloadActive &&
      this.hp / this.maxHp <= (this.archetype.overloadHpRatio || 0.5)
    ) {
      this.triggerOverload();
    }

    // Knockback impulse (heavier units resist pushback)
    if (knockbackDir) {
      const kbScale = this.archetype.isBoss
        ? 0.06
        : this.archetype.id === 'heavy_enforcer'
        ? 0.32
        : this.archetype.id === 'rail_warden' || this.archetype.id === 'abyss_sentinel'
        ? 0.34
        : this.archetype.id === 'mortar_artillery'
        ? 0.38
        : this.archetype.id === 'shock_breacher'
        ? 0.50
        : this.archetype.id === 'vanguard_assassin' || this.archetype.id === 'void_warper'
        ? 0.82
        : this.archetype.isFlying
        ? 1.15
        : 0.72;
      const force = Math.min(9.5, 2.2 + dealt * 0.045) * kbScale;
      this.velocity.x += knockbackDir.x * force;
      this.velocity.z += knockbackDir.z * force;
      if (this.archetype.isFlying) {
        this.velocity.y += knockbackDir.y * force * 0.45;
      }
    }

    // Stagger on headshots, heavy blasts, or shotgun impacts (with internal anti-stunlock CD)
    if (
      this.hp > 0 &&
      !this.archetype.isBoss &&
      !this._overloadActive &&
      this._staggerCooldown <= 0 &&
      (isHeadshot || dealt >= 38 || (options && options.isExplosion))
    ) {
      this.state = 'stagger';
      this._staggerTimer =
        this.archetype.id === 'heavy_enforcer'
          ? 0.15
          : this.archetype.id === 'rail_warden' || this.archetype.id === 'abyss_sentinel'
          ? 0.16
          : this.archetype.id === 'shock_breacher'
          ? 0.17
          : this.archetype.id === 'mortar_artillery'
          ? 0.18
          : 0.22;
      this._staggerCooldown = 1.45;
      this._hideLaser();
    }

    // Boss Multi-Phase Transition Check
    if (this.archetype.isBoss && this.bossPhases && this.hp > 0) {
      this._checkBossPhaseTransition();
    }

    // AEGIS-IX Destructible Left/Right Wing Core Weakpoints
    if (this.hp > 0 && this.archetype.id === 'aegis_overlord_boss' && options && options.weakpoint) {
      if (options.weakpoint === 'wingCoreL' && this._wingCoreHpL > 0) {
        this._wingCoreHpL = Math.max(0, this._wingCoreHpL - dealt);
        if (this._wingCoreHpL <= 0 && !this._wingCoreDestroyedL) {
          this._destroyWingCore('L');
        }
      } else if (options.weakpoint === 'wingCoreR' && this._wingCoreHpR > 0) {
        this._wingCoreHpR = Math.max(0, this._wingCoreHpR - dealt);
        if (this._wingCoreHpR <= 0 && !this._wingCoreDestroyedR) {
          this._destroyWingCore('R');
        }
      }
    }

    // Death Check
    if (this.hp <= 0) {
      this._enterDeathState(Boolean(isHeadshot), knockbackDir);
      return { dealt, killed: true, blockedByShield: false };
    }

    return { dealt, killed: false, blockedByShield: false };
  }

  /**
   * Shatter one of AEGIS-IX's destructible Wing Core Weakpoints, collapsing its phase shield,
   * staggering the boss, darkening the destroyed core, and emitting HUD/VFX callouts.
   * @private
   */
  _destroyWingCore(side) {
    const isLeft = side === 'L';
    if (isLeft) {
      this._wingCoreHpL = 0;
      this._wingCoreDestroyedL = true;
    } else {
      this._wingCoreHpR = 0;
      this._wingCoreDestroyedR = true;
    }

    const coreObj = this.rig ? (isLeft ? this.rig.wingCoreL : this.rig.wingCoreR) : null;
    if (coreObj) {
      coreObj.getWorldPosition(this._wingCoreWorldPos);
      const coreMat = coreObj.userData && coreObj.userData.coreMaterial;
      if (coreMat) {
        coreMat.color.copy(WING_BURNOUT_COLOR);
        coreMat.emissive.copy(WING_BURNOUT_EMISSIVE);
        coreMat.emissiveIntensity = 0.06;
      }
      const haloMat = coreObj.userData && coreObj.userData.haloMaterial;
      if (haloMat) {
        haloMat.color.copy(WING_BURNOUT_COLOR);
        haloMat.emissive.copy(WING_BURNOUT_EMISSIVE);
        haloMat.emissiveIntensity = 0.04;
      }
      if (coreObj.userData && coreObj.userData.haloMesh) {
        coreObj.userData.haloMesh.visible = false;
      }
    } else {
      this._wingCoreWorldPos.set(
        this.position.x + (isLeft ? 1.62 : -1.62),
        this.position.y + 3.92,
        this.position.z
      );
    }

    const hadShield = this._phaseShieldTimer > 0;
    this._phaseShieldTimer = 0;
    this._shieldFlashTimer = 0.55;
    this._coreExposedTimer = Math.max(this._coreExposedTimer, 4.2);
    this.state = 'stagger';
    this._staggerTimer = 1.35;
    this._burstRemaining = 0;
    this._hitFlashTimer = 0.28;

    const remaining = (this._wingCoreHpL > 0 ? 1 : 0) + (this._wingCoreHpR > 0 ? 1 : 0);
    if (this.eventBus) {
      this._wingShatterPayload.side = side;
      this._wingShatterPayload.sideLabel = isLeft ? '좌' : '우';
      this._wingShatterPayload.remaining = remaining;
      this._wingShatterPayload.shieldBroken = hadShield || remaining === 0;
      this.eventBus.emit(EVENTS.BOSS_WING_CORE_SHATTERED, this._wingShatterPayload);
    }
  }

  /**
   * Check and trigger Boss Phase 2 / Phase 3 transitions when crossing HP thresholds.
   * @private
   */
  _checkBossPhaseTransition() {
    const hpRatio = this.hp / this.maxHp;
    for (let i = 0; i < this.bossPhases.length; i++) {
      const p = this.bossPhases[i];
      if (p.phase > this.currentPhase && hpRatio <= p.hpThreshold) {
        this.currentPhase = p.phase;
        this._phaseName = p.name || `PHASE ${p.phase}`;
        this._phaseSpeedMult = p.speedMultiplier || 1.0;
        this._phaseFireMult = p.fireRateMultiplier || 1.0;
        this._phaseBurstCount = p.burstCount || 5;

        // Dramatic phase surge stagger & orbital shield pulse
        this.state = 'stagger';
        this._staggerTimer = 0.72;
        this._burstRemaining = 0;
        if (p.shieldPulse) {
          const hasIntactWingCore =
            this.archetype.id === 'aegis_overlord_boss' &&
            (this._wingCoreHpL > 0 || this._wingCoreHpR > 0);
          this._phaseShieldTimer = hasIntactWingCore ? 10.0 : 3.8;
          this._shieldFlashTimer = 0.5;
        }

        // Shift orbital ring colors for Phase 2 (amber overdrive) & Phase 3 (blazing crimson)
        const rings = this.rig.coreRings;
        const targetColor = p.phase >= 3 ? PHASE3_RING_COLOR : PHASE2_RING_COLOR;
        for (let r = 0; r < rings.length; r++) {
          const mat = rings[r].userData.ringMaterial;
          if (mat) {
            mat.color.copy(targetColor);
            mat.emissive.copy(targetColor);
            mat.emissiveIntensity = p.phase >= 3 ? 3.4 : 2.8;
          }
        }

        if (this.eventBus) {
          this.eventBus.emit(EVENTS.BOSS_PHASE, {
            phase: p.phase,
            name: p.name,
            bossName: this.archetype ? this.archetype.name : 'BOSS',
            callout: p.callout,
            escorts: p.escorts || [],
            turretCount: p.turretCount || 0,
            spawnVoidGate: Boolean(p.voidGateSpawn || p.spawnVoidGate),
            centralLowGravity: Boolean(p.centralLowG || p.centralLowGravity),
            bossId: this.id,
            hpRatio,
          });
        }
      }
    }
  }

  /**
   * Transition cleanly into collapse/dissolve death animation.
   * @private
   */
  _enterDeathState(isHeadshot, knockbackDir) {
    this.isAlive = false;
    this.state = 'dead';
    this._deathTimer = 0;
    this._overloadActive = false;
    this._blinkTelegraphTimer = 0;
    this._hideLaser();

    if (this.rig.overloadRing) {
      this.rig.overloadRing.visible = false;
    }
    if (this.rig.healthBarBg) {
      this.rig.healthBarBg.visible = false;
    }
    if (this.rig.shieldMesh) {
      this.rig.shieldMesh.visible = false;
    }

    // Choose collapse direction away from shot impact
    if (knockbackDir && (knockbackDir.x !== 0 || knockbackDir.z !== 0)) {
      this._deathTiltAxis.set(-knockbackDir.z, 0, knockbackDir.x).normalize();
    } else {
      this._deathTiltAxis.set(1, 0, 0);
    }

    // Notify WaveDirector immediately so kill-confirm audio/HUD/combo have zero frame lag
    if (this._onDeathCallback && !this._killProcessed) {
      this._killProcessed = true;
      this._onDeathCallback(this, isHeadshot, this.lastHitPoint);
    }
  }

  /**
   * Main per-frame AI FSM, physics, LOS & procedural rig animation update.
   * Strictly zero heap allocations in the hot loop.
   *
   * @param {number} dt
   * @param {number} elapsedTime
   * @param {THREE.Vector3} playerPos
   * @param {THREE.Vector3} playerEyePos
   * @param {(origin: THREE.Vector3, dir: THREE.Vector3, speed: number, damage: number, color: number, radius: number, archetypeId: string, isSniperBeam: boolean) => void} spawnProjectileFn
   */
  update(dt, elapsedTime, playerPos, playerEyePos, spawnProjectileFn) {
    if (this.isRemoved || !Number.isFinite(dt) || dt <= 0) return;
    const clampedDt = dt > 0.05 ? 0.05 : dt;

    // Update death dissolve animation if dead
    if (!this.isAlive) {
      this._updateDeathAnimation(clampedDt);
      return;
    }

    // Tick auxiliary feedback timers
    if (this._staggerCooldown > 0) {
      this._staggerCooldown = Math.max(0, this._staggerCooldown - clampedDt);
    }
    if (this._attackCooldown > 0) {
      this._attackCooldown = Math.max(0, this._attackCooldown - clampedDt);
    }
    if (this._shockDashTimer > 0) {
      this._shockDashTimer = Math.max(0, this._shockDashTimer - clampedDt);
    }
    if (this._shockDashCooldown > 0) {
      this._shockDashCooldown = Math.max(0, this._shockDashCooldown - clampedDt);
    }
    if (this._assassinBlinkCooldown > 0) {
      this._assassinBlinkCooldown = Math.max(0, this._assassinBlinkCooldown - clampedDt);
    }
    if (this._recoilAnim > 0) {
      this._recoilAnim = Math.max(0, this._recoilAnim - clampedDt * 6.5);
    }
    if (this._phaseShieldTimer > 0) {
      this._phaseShieldTimer = Math.max(0, this._phaseShieldTimer - clampedDt);
    }
    if (this._coreExposedTimer > 0) {
      this._coreExposedTimer = Math.max(0, this._coreExposedTimer - clampedDt);
    }
    if (this._singularityPullTimer > 0) {
      this._singularityPullTimer = Math.max(0, this._singularityPullTimer - clampedDt);
    }
    if (this.markedTimer > 0) {
      this.markedTimer = Math.max(0, this.markedTimer - clampedDt);
    }

    this._updateHitAndShieldFlashes(clampedDt, elapsedTime);

    // Distance & direction to player
    const dx = playerPos.x - this.position.x;
    const dy = playerPos.y - this.position.y;
    const dz = playerPos.z - this.position.z;
    const horizDist = Math.hypot(dx, dz);
    const totalDist = Math.hypot(dx, dy, dz);
    const targetYaw = horizDist > 0.01 ? Math.atan2(dx, dz) : this._yaw;

    // Periodic LOS check (throttled to ~14Hz for crisp performance across 8 concurrent enemies)
    this._losCheckTimer -= clampedDt;
    if (this._losCheckTimer <= 0) {
      this._losCheckTimer = 0.07;
      this._eyePos.set(
        this.position.x,
        this.position.y + this.archetype.headHeight,
        this.position.z
      );
      this._hasLOS = this.collisionWorld.isLineOfSightClear(this._eyePos, playerEyePos);
    }

    // Spawn materialization state
    if (this.state === 'spawn') {
      this._spawnTimer -= clampedDt;
      const progress = Math.max(0, Math.min(1, 1 - this._spawnTimer / 0.52));
      const ease = 1 - (1 - progress) * (1 - progress);
      const sm = this.scaleMult || 1.0;
      this.rig.root.scale.set(
        (0.35 + 0.65 * ease) * sm,
        (0.2 + 0.8 * ease) * sm,
        (0.35 + 0.65 * ease) * sm
      );
      this._yaw = targetYaw;
      this.rig.root.rotation.y = this._yaw;

      if (this._spawnTimer <= 0) {
        this.rig.root.scale.set(sm, sm, sm);
        this.state = 'advance';
      }
      this._syncCachedPositions();
      this._updateRigAnimation(clampedDt, elapsedTime, 0, playerPos);
      return;
    }

    // Act 3: Volatile Rusher Overload Frenzy proximity trigger & fuse detonation
    if (this.archetype.overloadFrenzy) {
      if (!this._overloadActive && totalDist <= (this.archetype.overloadTriggerDist || 5.5)) {
        this.triggerOverload();
      }
      if (this._overloadActive) {
        this._overloadTimer -= clampedDt;
        const fuse = Math.max(0.1, this._overloadFuse || 0.85);
        const progress = Math.max(0, Math.min(1, 1 - this._overloadTimer / fuse));
        if (this.rig.overloadRing) {
          const maxR = this.archetype.overloadRadius || 8.0;
          const rScale = 1.2 + progress * (maxR - 1.2);
          this.rig.overloadRing.visible = true;
          this.rig.overloadRing.scale.set(rScale, 1, rScale);
          if (this.rig.overloadRing.material) {
            this.rig.overloadRing.material.opacity = 0.45 + 0.45 * Math.abs(Math.sin(elapsedTime * 22));
          }
        }
        if (this._overloadTimer <= 0 && !this._overloadFired) {
          this._overloadFired = true;
          if (typeof this._onOverloadCallback === 'function') {
            this._onOverloadCallback(this);
          }
          this._enterDeathState(false, null);
          return;
        }
      }
    }

    // Act 3: Dimensional Teleport (void_warper always; transcendent_omega_boss Phase 2+)
    const canBlinkNow =
      this.archetype.canTeleport &&
      (!this.archetype.isBoss || this.currentPhase >= 2) &&
      this.state !== 'stagger';
    if (canBlinkNow) {
      if (this._blinkTelegraphTimer > 0) {
        this._blinkTelegraphTimer -= clampedDt;
        this._hitFlashTimer = Math.max(this._hitFlashTimer, 0.06);
        if (this._blinkTelegraphTimer <= 0) {
          this._blinkFromPos.copy(this.position);
          this.position.copy(this._blinkTargetPos);
          this.velocity.set(0, 0, 0);
          this.rig.root.position.copy(this.position);
          const postDx = playerPos.x - this.position.x;
          const postDz = playerPos.z - this.position.z;
          if (postDx * postDx + postDz * postDz > 0.01) {
            this._yaw = Math.atan2(postDx, postDz);
          }
          if (this.archetype.id === 'void_warper' || this.archetype.id === 'transcendent_omega_boss') {
            this._attackCooldown = Math.min(this._attackCooldown, 0.35);
          }
          this._hitFlashTimer = 0.14;
          if (this.eventBus) {
            this._teleportPayload.color = this.archetype.accentColor || 0xa855f7;
            this._teleportPayload.yaw = this._yaw;
            this._teleportPayload.height = this.archetype.height;
            this._teleportPayload.isBoss = Boolean(this.archetype.isBoss);
            this.eventBus.emit(EVENTS.ENEMY_TELEPORT, this._teleportPayload);
          }
          this._blinkCooldown = this.archetype.isBoss
            ? this.currentPhase >= 3
              ? 3.5
              : this.currentPhase === 2
              ? 4.5
              : 6.0
            : this.archetype.blinkCooldown || 5.5;
        }
      } else {
        this._blinkCooldown -= clampedDt;
        if (this._blinkCooldown <= 0 && totalDist >= 6.0 && totalDist <= 38.0) {
          if (this._trySelectBlinkTarget(playerPos)) {
            this._blinkTelegraphTimer = this.archetype.blinkTelegraph || 0.32;
          } else {
            this._blinkCooldown = 1.6;
          }
        }
      }
    }
    if (this._empCooldown > 0) {
      this._empCooldown = Math.max(0, this._empCooldown - clampedDt);
    }

    // Smooth yaw turn toward player (faster for drone, assassin & sniper, weighty for heavy/mortar/boss)
    const turnRate = this.archetype.isFlying
      ? this.archetype.id === 'interceptor_drone' || this.archetype.id === 'void_swarmer'
        ? 9.8
        : 9.0
      : this.archetype.isBoss
      ? 3.8 * this._phaseSpeedMult
      : this.archetype.id === 'heavy_enforcer' ||
        this.archetype.id === 'rail_warden' ||
        this.archetype.id === 'abyss_sentinel'
      ? 4.6
      : this.archetype.id === 'mortar_artillery'
      ? 4.2
      : this.archetype.id === 'vanguard_assassin' || this.archetype.id === 'void_warper'
      ? 9.2
      : this.archetype.id === 'shock_breacher' || this.archetype.id === 'volatile_rusher'
      ? 8.2
      : 7.4;
    const yawDiff = wrapAngle(targetYaw - this._yaw);
    this._yaw += yawDiff * (1 - Math.exp(-turnRate * clampedDt));

    const overloadMult = this._overloadActive ? 1.48 : 1.0;
    const moveSpeed = this.archetype.speed * this._phaseSpeedMult * overloadMult * (this.threatSpeedMult || 1.0);
    let desiredVx = 0;
    let desiredVz = 0;

    // FSM Logic
    switch (this.state) {
      case 'stagger': {
        this._staggerTimer -= clampedDt;
        const damp = Math.exp(-9 * clampedDt);
        desiredVx = this.velocity.x * damp;
        desiredVz = this.velocity.z * damp;
        if (this._staggerTimer <= 0) {
          this.state = this._hasLOS && horizDist <= this.archetype.attackRange ? 'strafe' : 'advance';
        }
        break;
      }

      case 'advance': {
        this._hideLaser();
        this._computeFlankVelocity(
          dx,
          dz,
          horizDist,
          moveSpeed,
          clampedDt,
          this._moveDir
        );
        desiredVx = this._moveDir.x;
        desiredVz = this._moveDir.z;

        // Shock Breacher forward thruster surge burst when closing in
        if (this.archetype.id === 'shock_breacher' && horizDist > 6.5) {
          if (this._shockDashCooldown <= 0 && horizDist <= 22.0) {
            this._shockDashTimer = 0.54;
            this._shockDashCooldown = 3.1 + Math.random() * 1.1;
          }
          if (this._shockDashTimer > 0) {
            const invH = 1 / horizDist;
            desiredVx = dx * invH * moveSpeed * 2.15;
            desiredVz = dz * invH * moveSpeed * 2.15;
          }
        }

        // Transition into tactical strafe once within attack range with clear LOS (Overload rushers keep charging!)
        if (!this._overloadActive && this._hasLOS && totalDist <= this.archetype.attackRange * 0.94) {
          this.state = 'strafe';
        }
        break;
      }

      case 'strafe': {
        this._hideLaser();

        // Lost LOS or player escaped attack range -> flank/advance!
        if (this._overloadActive || !this._hasLOS || totalDist > this.archetype.attackRange * 1.06) {
          this.state = 'advance';
          break;
        }

        // Periodic strafe direction reversal + agile assassin blink-dash & interceptor aerial sweep
        this._strafeSwitchTimer -= clampedDt;
        if (this._strafeSwitchTimer <= 0) {
          this._strafeDir = -this._strafeDir;
          const isAgile =
            this.archetype.id === 'vanguard_assassin' ||
            this.archetype.id === 'interceptor_drone' ||
            this.archetype.id === 'void_swarmer' ||
            this.archetype.id === 'void_warper';
          this._strafeSwitchTimer = isAgile ? 0.95 + Math.random() * 1.2 : 1.6 + Math.random() * 1.9;

          if (this.archetype.id === 'vanguard_assassin' && horizDist > 0.01) {
            if (this._assassinBlinkCooldown <= 0 && this._tryLateralBlinkDash(playerPos)) {
              this._assassinBlinkCooldown = 2.0 + Math.random() * 1.0;
            } else {
              const invH = 1 / horizDist;
              const dashSideX = -(dz * invH) * this._strafeDir;
              const dashSideZ = (dx * invH) * this._strafeDir;
              this.velocity.x += dashSideX * 11.5;
              this.velocity.z += dashSideZ * 11.5;
            }
          } else if (this.archetype.id === 'interceptor_drone' && horizDist > 0.01) {
            const invH = 1 / horizDist;
            const dashSideX = -(dz * invH) * this._strafeDir;
            const dashSideZ = (dx * invH) * this._strafeDir;
            this.velocity.x += dashSideX * 5.8;
            this.velocity.z += dashSideZ * 5.8;
          } else if (
            (this.archetype.id === 'tactical_trooper' || this.archetype.id === 'sniper_stalker') &&
            Math.random() < 0.32
          ) {
            this._coverPauseTimer = 0.45 + Math.random() * 0.4;
          }
        }

        // Shock Breacher closing thruster surge inside mid-range strafe
        if (this.archetype.id === 'shock_breacher' && horizDist > 8.0) {
          if (this._shockDashCooldown <= 0 && horizDist <= 18.0) {
            this._shockDashTimer = 0.50;
            this._shockDashCooldown = 3.2 + Math.random() * 1.0;
          }
          if (this._shockDashTimer > 0) {
            const invH = 1 / horizDist;
            desiredVx = dx * invH * moveSpeed * 2.15;
            desiredVz = dz * invH * moveSpeed * 2.15;
            break;
          }
        }

        if (this._coverPauseTimer > 0) {
          this._coverPauseTimer -= clampedDt;
        } else {
          const invDist = horizDist > 0.01 ? 1 / horizDist : 0;
          const fwdX = dx * invDist;
          const fwdZ = dz * invDist;
          // Perpendicular tangent
          const sideX = -fwdZ * this._strafeDir;
          const sideZ = fwdX * this._strafeDir;

          // Maintain preferred engagement distance
          let radialWeight = 0;
          const pref = this.archetype.preferredRange;
          if (horizDist > pref * 1.22) radialWeight = 0.68;
          else if (horizDist < pref * 0.68) radialWeight = -0.58;

          const strafeWeight =
            this.archetype.id === 'heavy_enforcer' ||
            this.archetype.id === 'rail_warden' ||
            this.archetype.id === 'abyss_sentinel'
              ? 0.44
              : this.archetype.id === 'sniper_stalker' || this.archetype.id === 'mortar_artillery'
              ? 0.50
              : this.archetype.id === 'void_swarmer'
              ? 1.05
              : this.archetype.id === 'vanguard_assassin' || this.archetype.id === 'interceptor_drone'
              ? 0.96
              : this.archetype.id === 'shock_breacher' || this.archetype.id === 'void_warper'
              ? 0.90
              : 0.82;

          let vx = fwdX * radialWeight + sideX * strafeWeight;
          let vz = fwdZ * radialWeight + sideZ * strafeWeight;
          const mag = Math.hypot(vx, vz);
          if (mag > 0.01) {
            const strafeMult =
              this.archetype.id === 'sniper_stalker' || this.archetype.id === 'mortar_artillery'
                ? 0.65
                : this.archetype.id === 'void_swarmer'
                ? 1.0
                : this.archetype.id === 'vanguard_assassin' || this.archetype.id === 'interceptor_drone'
                ? 0.94
                : this.archetype.id === 'void_warper'
                ? 0.88
                : this.archetype.id === 'abyss_sentinel'
                ? 0.72
                : 0.78;
            const strafeSpd = moveSpeed * strafeMult;
            vx = (vx / mag) * strafeSpd;
            vz = (vz / mag) * strafeSpd;

            // Keep elevated snipers, mortars & assassins from blindly strafing off catwalk ledges
            if (
              (this.archetype.id === 'sniper_stalker' ||
                this.archetype.id === 'mortar_artillery' ||
                this.archetype.id === 'vanguard_assassin') &&
              this.position.y > 1.2
            ) {
              const probeX = this.position.x + (vx / strafeSpd) * 1.2;
              const probeZ = this.position.z + (vz / strafeSpd) * 1.2;
              const aheadFloor = this.collisionWorld.getGroundHeightAt(
                probeX,
                probeZ,
                this.position.y + 0.6
              );
              if (this.position.y - aheadFloor > 1.4) {
                this._strafeDir = -this._strafeDir;
                vx = 0;
                vz = 0;
              }
            }
          }
          desiredVx = vx;
          desiredVz = vz;
        }

        // Ready to fire -> enter telegraphed windup!
        if (this._attackCooldown <= 0 && Math.abs(yawDiff) < 0.72) {
          this.state = 'telegraph';
          if (this.archetype.isBoss) {
            this._selectNextBossPattern();
          }
          this._telegraphTimer =
            this.archetype.isBoss && this._bossActivePattern === 'emp_blackout'
              ? 1.25
              : this.archetype.telegraphTime / (this.archetype.isBoss ? Math.sqrt(this._phaseFireMult) : 1.0);
          if (this._bossActivePattern === 'emp_blackout' && this.eventBus) {
            this.eventBus.emit('SFX_BOSS_TELEGRAPH', { type: 'emp_charge' });
          }
          this._sniperLockFrozen = false;
          this._lockedAimPoint.copy(playerEyePos);
          this._lockedAimPoint.y -= this.archetype.id === 'mortar_artillery' ? 1.45 : 0.16;
        }
        break;
      }

      case 'telegraph': {
        this._telegraphTimer -= clampedDt;
        const totalTelegraph =
          this.archetype.isBoss && this._bossActivePattern === 'emp_blackout'
            ? 1.25
            : this.archetype.telegraphTime / (this.archetype.isBoss ? Math.sqrt(this._phaseFireMult) : 1.0);
        const progress = Math.max(0, Math.min(1, 1 - this._telegraphTimer / Math.max(0.05, totalTelegraph)));

        // Drones keep lightly drifting; shielded heavies & shock breachers press forward during windup
        if (this.archetype.isFlying && horizDist > 0.01) {
          const sideX = -(dz / horizDist) * this._strafeDir;
          const sideZ = (dx / horizDist) * this._strafeDir;
          const flyDrift =
            this.archetype.id === 'void_swarmer'
              ? 0.92
              : this.archetype.id === 'interceptor_drone'
              ? 0.72
              : 0.45;
          desiredVx = sideX * moveSpeed * flyDrift;
          desiredVz = sideZ * moveSpeed * flyDrift;
        } else if (
          (this.archetype.id === 'heavy_enforcer' ||
            this.archetype.id === 'rail_warden' ||
            this.archetype.id === 'abyss_sentinel') &&
          horizDist > 6
        ) {
          desiredVx = (dx / horizDist) * moveSpeed * 0.35;
          desiredVz = (dz / horizDist) * moveSpeed * 0.35;
        } else if (this.archetype.id === 'shock_breacher' && horizDist > 5.0) {
          desiredVx = (dx / horizDist) * moveSpeed * 0.62;
          desiredVz = (dz / horizDist) * moveSpeed * 0.62;
        }

        // Deadeye Recon crimson lock-on laser telegraph (Act 1 sniper ONLY!)
        if (this.archetype.id === 'sniper_stalker') {
          if (progress < 0.78) {
            this._lockedAimPoint.x += (playerEyePos.x - this._lockedAimPoint.x) * (1 - Math.exp(-10 * clampedDt));
            this._lockedAimPoint.y += (playerEyePos.y - 0.18 - this._lockedAimPoint.y) * (1 - Math.exp(-10 * clampedDt));
            this._lockedAimPoint.z += (playerEyePos.z - this._lockedAimPoint.z) * (1 - Math.exp(-10 * clampedDt));
          } else {
            this._sniperLockFrozen = true;
          }
          this.isSniperLocking = true;
          this._updateSniperLaser(progress, elapsedTime);
        } else if (this.archetype.id === 'rail_warden') {
          // Rail Warden: crisp cyan aiming telegraph beam + charge flash (no sniper alert popup)
          if (progress < 0.72) {
            this._lockedAimPoint.x += (playerEyePos.x - this._lockedAimPoint.x) * (1 - Math.exp(-11 * clampedDt));
            this._lockedAimPoint.y += (playerEyePos.y - 0.20 - this._lockedAimPoint.y) * (1 - Math.exp(-11 * clampedDt));
            this._lockedAimPoint.z += (playerEyePos.z - this._lockedAimPoint.z) * (1 - Math.exp(-11 * clampedDt));
          } else {
            this._sniperLockFrozen = true;
          }
          this._updateSniperLaser(progress, elapsedTime);
        } else if (this.archetype.id === 'mortar_artillery') {
          // Mortar Artillery: locks onto player's floor area before launching parabolic plasma shells
          if (progress < 0.75) {
            this._lockedAimPoint.x += (playerPos.x - this._lockedAimPoint.x) * (1 - Math.exp(-9 * clampedDt));
            this._lockedAimPoint.y += (playerPos.y - this._lockedAimPoint.y) * (1 - Math.exp(-9 * clampedDt));
            this._lockedAimPoint.z += (playerPos.z - this._lockedAimPoint.z) * (1 - Math.exp(-9 * clampedDt));
          } else {
            this._sniperLockFrozen = true;
          }
        }

        // Abort telegraph if player completely breaks LOS before final lock
        if (!this._hasLOS && progress < 0.75 && this._bossActivePattern !== 'emp_blackout') {
          this._hideLaser();
          this.state = 'advance';
          break;
        }

        if (this._telegraphTimer <= 0) {
          this.state = 'attack';
          this._bossBurstShotIdx = 0;
          this._burstRemaining = this._getBurstCount();
          this._burstShotTimer = 0;
        }
        break;
      }

      case 'attack': {
        // Drones continue drifting while firing bursts
        if (this.archetype.isFlying && horizDist > 0.01) {
          const atkDrift = this.archetype.id === 'interceptor_drone' ? 0.85 : 0.55;
          desiredVx = -(dz / horizDist) * this._strafeDir * moveSpeed * atkDrift;
          desiredVz = (dx / horizDist) * this._strafeDir * moveSpeed * atkDrift;
        }

        this._burstShotTimer -= clampedDt;
        if (this._burstShotTimer <= 0 && this._burstRemaining > 0) {
          this._fireShot(playerEyePos, spawnProjectileFn);
          this._burstRemaining--;
          this._burstShotTimer = this._getBurstInterval();
        }

        if (this._burstRemaining <= 0) {
          this._hideLaser();
          const baseCooldown = 1 / Math.max(0.2, this.archetype.fireRate * this._phaseFireMult);
          this._attackCooldown = baseCooldown * (0.85 + Math.random() * 0.3);
          this.state = this._hasLOS ? 'strafe' : 'advance';
        }
        break;
      }

      default:
        this.state = 'advance';
        break;
    }

    // Physics Integration (Hovering 3D flight vs Ground Capsule)
    if (this.archetype.isFlying) {
      this._integrateFlyingMovement(desiredVx, desiredVz, clampedDt, elapsedTime, playerEyePos);
    } else {
      this._integrateGroundMovement(desiredVx, desiredVz, clampedDt);
    }

    // Sync transforms, world-space hitpoints, and procedural animation
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this._yaw;

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this._updateRigAnimation(clampedDt, elapsedTime, horizSpeed, playerPos);
    this.rig.root.updateMatrixWorld(false);
    this._syncCachedPositions();
  }

  /**
   * 3-whisker cover avoidance & perpendicular wall-flank steering (zero allocations).
   * @private
   */
  _computeFlankVelocity(dx, dz, horizDist, moveSpeed, dt, outVec) {
    if (horizDist < 0.05) {
      outVec.set(0, 0, 0);
      return;
    }
    const inv = 1 / horizDist;
    const dirX = dx * inv;
    const dirZ = dz * inv;

    // Cast forward feeler from torso height to detect cover walls & pillars
    this._eyePos.set(
      this.position.x,
      this.position.y + Math.min(1.1, this.archetype.height * 0.55),
      this.position.z
    );
    this._probeDir.set(dirX, 0, dirZ);

    const probeDist = this.archetype.radius + 2.4;
    const frontHit = this.collisionWorld.raycastWorld(
      this._eyePos,
      this._probeDir,
      probeDist,
      this._rayHit
    );

    if (!frontHit) {
      this._blockedTimer = Math.max(0, this._blockedTimer - dt * 2);
      // Slight angled flank bias so groups fan out rather than conga-lining
      const sideX = -dirZ * this._strafeDir * 0.28;
      const sideZ = dirX * this._strafeDir * 0.28;
      const vx = dirX + sideX;
      const vz = dirZ + sideZ;
      const m = Math.hypot(vx, vz) || 1;
      outVec.set((vx / m) * moveSpeed, 0, (vz / m) * moveSpeed);
      return;
    }

    // Obstacle ahead: probe left (+55 deg) and right (-55 deg) to pick the open flank route
    this._blockedTimer += dt;
    if (this._blockedTimer > 0.9) {
      this._strafeDir = -this._strafeDir;
      this._blockedTimer = 0;
    }

    const cosA = 0.5735; // cos(55 deg)
    const sinA = 0.8191; // sin(55 deg)

    const leftX = dirX * cosA - dirZ * sinA;
    const leftZ = dirX * sinA + dirZ * cosA;
    this._probeDir.set(leftX, 0, leftZ);
    const leftHit = this.collisionWorld.raycastWorld(
      this._eyePos,
      this._probeDir,
      probeDist + 1.2,
      this._rayHit
    );
    const leftClear = leftHit ? leftHit.distance : probeDist + 1.2;

    const rightX = dirX * cosA + dirZ * sinA;
    const rightZ = -dirX * sinA + dirZ * cosA;
    this._probeDir.set(rightX, 0, rightZ);
    const rightHit = this.collisionWorld.raycastWorld(
      this._eyePos,
      this._probeDir,
      probeDist + 1.2,
      this._rayHit
    );
    const rightClear = rightHit ? rightHit.distance : probeDist + 1.2;

    if (leftClear > rightClear + 0.35) {
      this._strafeDir = 1;
      outVec.set(leftX * moveSpeed, 0, leftZ * moveSpeed);
    } else if (rightClear > leftClear + 0.35) {
      this._strafeDir = -1;
      outVec.set(rightX * moveSpeed, 0, rightZ * moveSpeed);
    } else {
      // Slide cleanly along chosen strafe flank
      const flankX = this._strafeDir > 0 ? leftX : rightX;
      const flankZ = this._strafeDir > 0 ? leftZ : rightZ;
      outVec.set(flankX * moveSpeed, 0, flankZ * moveSpeed);
    }
  }

  /**
   * Ground capsule movement using CollisionWorld (triggerJumpPads = false!).
   * @private
   */
  _integrateGroundMovement(desiredVx, desiredVz, dt) {
    const accelBlend = 1 - Math.exp(-9.5 * dt);
    this.velocity.x += (desiredVx - this.velocity.x) * accelBlend;
    this.velocity.z += (desiredVz - this.velocity.z) * accelBlend;
    this.velocity.y -= GRAVITY * dt;

    const res = this.collisionWorld.resolveCapsuleMove(
      this.position,
      this.velocity,
      this.archetype.radius,
      this.archetype.height,
      dt,
      0.55,
      false
    );

    if (res.hitWall && this.state === 'strafe') {
      this._strafeDir = -this._strafeDir;
      this._strafeSwitchTimer = 1.4;
    }
  }

  /**
   * Smooth 3D hovering movement with altitude control & wall collision for Flying Drones.
   * Interceptor Drones cruise higher with wider aerial weave; Rusher Drones pursue closer.
   * @private
   */
  _integrateFlyingMovement(desiredVx, desiredVz, dt, elapsedTime, playerEyePos) {
    const floorY = this.collisionWorld.getGroundHeightAt(
      this.position.x,
      this.position.z,
      this.position.y + 1.2
    );
    const isInterceptor = this.archetype.id === 'interceptor_drone';
    const isSwarmer = this.archetype.id === 'void_swarmer';
    const hoverWave = isSwarmer
      ? Math.sin(elapsedTime * 6.4 + this._hoverSeed) * 0.56 +
        Math.cos(elapsedTime * 3.1 + this._hoverSeed) * 0.20
      : isInterceptor
      ? Math.sin(elapsedTime * 4.4 + this._hoverSeed) * 0.45
      : Math.sin(elapsedTime * 3.4 + this._hoverSeed) * 0.28;
    const targetY = isSwarmer
      ? Math.max(
          floorY + 2.35,
          Math.min(floorY + 5.2, playerEyePos.y + 1.05 + hoverWave)
        )
      : isInterceptor
      ? Math.max(
          floorY + 2.85,
          Math.min(floorY + 5.8, playerEyePos.y + 1.55 + hoverWave)
        )
      : Math.max(
          floorY + 1.85,
          Math.min(floorY + 4.8, playerEyePos.y + 0.55 + hoverWave)
        );

    const blend = 1 - Math.exp(-6.5 * dt);
    this.velocity.x += (desiredVx - this.velocity.x) * blend;
    this.velocity.z += (desiredVz - this.velocity.z) * blend;
    this.velocity.y += ((targetY - this.position.y) * 4.5 - this.velocity.y) * blend;

    const res = this.collisionWorld.resolveCapsuleMove(
      this.position,
      this.velocity,
      this.archetype.radius,
      this.archetype.height,
      dt,
      0.0,
      false
    );

    if (res.hitWall) {
      this._strafeDir = -this._strafeDir;
      this._strafeSwitchTimer = 1.1;
    }
  }

  /**
   * Perform a rapid lateral blink-dash perpendicular to the player for Vanguard Assassin.
   * Zero heap allocations.
   * @private
   */
  _tryLateralBlinkDash(playerPos) {
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const hDist = Math.hypot(dx, dz);
    if (hDist < 0.5) return false;

    const invH = 1 / hDist;
    const sideX = -(dz * invH) * this._strafeDir;
    const sideZ = (dx * invH) * this._strafeDir;

    const dashDist = 4.4 + Math.random() * 1.4;
    this._eyePos.set(this.position.x, this.position.y + 0.9, this.position.z);
    this._probeDir.set(sideX, 0, sideZ);
    const wallHit = this.collisionWorld.raycastWorld(
      this._eyePos,
      this._probeDir,
      dashDist + this.archetype.radius + 0.4,
      this._rayHit
    );
    const actualDist = wallHit
      ? Math.max(0, wallHit.distance - this.archetype.radius - 0.35)
      : dashDist;
    if (actualDist < 2.2) return false;

    const tx = this.position.x + sideX * actualDist;
    const tz = this.position.z + sideZ * actualDist;
    const ty = this.collisionWorld.getGroundHeightAt(tx, tz, this.position.y + 2.0);
    if (!Number.isFinite(ty) || Math.abs(ty - this.position.y) > 1.6) return false;
    if (!this.collisionWorld.hasClearance(tx, ty + 0.05, tz, this.archetype.radius, this.archetype.height)) {
      return false;
    }

    this._blinkFromPos.copy(this.position);
    this.position.set(tx, ty, tz);
    this.velocity.set(sideX * 7.0, 0, sideZ * 7.0);
    this.rig.root.position.copy(this.position);
    this._hitFlashTimer = 0.12;
    if (this.eventBus) {
      this._teleportPayload.color = 0xf43f5e;
      this._teleportPayload.yaw = this._yaw;
      this._teleportPayload.height = this.archetype.height;
      this._teleportPayload.isBoss = false;
      this.eventBus.emit(EVENTS.ENEMY_TELEPORT, this._teleportPayload);
    }
    return true;
  }

  /**
   * Sample navigable flank/rear destination around player for dimensional teleportation.
   * @private
   */
  _trySelectBlinkTarget(playerPos) {
    const minDist = this.archetype.isBoss ? 12.0 : 8.0;
    const maxDist = this.archetype.isBoss ? 18.0 : 12.5;
    const baseAngle = Math.atan2(this.position.z - playerPos.z, this.position.x - playerPos.x);
    const offsets = [Math.PI * 0.72, -Math.PI * 0.72, Math.PI, Math.PI * 0.45, -Math.PI * 0.45];
    for (let i = 0; i < offsets.length; i++) {
      const ang = baseAngle + offsets[i] + (Math.random() - 0.5) * 0.35;
      const dist = minDist + Math.random() * (maxDist - minDist);
      const tx = playerPos.x + Math.cos(ang) * dist;
      const tz = playerPos.z + Math.sin(ang) * dist;
      const ty = this.collisionWorld.getGroundHeightAt(tx, tz, Math.max(8, playerPos.y + 4));
      if (!Number.isFinite(ty)) continue;
      if (this.collisionWorld.hasClearance(tx, ty + 0.05, tz, this.archetype.radius, this.archetype.height)) {
        this._blinkTargetPos.set(tx, ty, tz);
        return true;
      }
    }
    return false;
  }

  /** @private */
  _getBurstCount() {
    switch (this.archetype.id) {
      case 'rusher_drone':
      case 'void_swarmer':
        return 2;
      case 'interceptor_drone':
        return 1; // Fires 3-bolt angled plasma spread fan per aerial sweep
      case 'abyss_sentinel':
        return 3;
      case 'tactical_trooper':
        return 3;
      case 'volatile_rusher':
        return 1;
      case 'void_warper':
        return 2;
      case 'shock_breacher':
        return 1; // Fires 4-pellet pneumatic EMP buckshot fan per trigger pull
      case 'rail_warden':
        return 2; // Charged dual piercing plasma rail burst
      case 'mortar_artillery':
        return 3; // 3-shell parabolic plasma mortar salvo
      case 'vanguard_assassin':
        return 1; // 4-blade wide crescent fan volley
      case 'cyber_mech_boss':
        if (this._bossActivePattern === 'homing_missiles') return 1;
        if (this._bossActivePattern === 'molten_fan') return this.currentPhase >= 3 ? 3 : 2;
        if (this._bossActivePattern === 'twin_slam_salvo') return this.currentPhase >= 2 ? 3 : 2;
        if (this._bossActivePattern === 'spiral_barrage') return this.currentPhase >= 3 ? 9 : 6;
        return this._phaseBurstCount;
      case 'aegis_overlord_boss':
        if (this._bossActivePattern === 'orbital_fan') return this.currentPhase >= 3 ? 3 : 2;
        if (this._bossActivePattern === 'hazard_barrage') return 2;
        if (this._bossActivePattern === 'orbital_laser_sweep') return 2;
        if (this._bossActivePattern === 'drone_salvo') return this.currentPhase >= 2 ? 3 : 2;
        if (this._bossActivePattern === 'sniper_lance') return this.currentPhase >= 2 ? 3 : 2;
        return 2;
      case 'transcendent_omega_boss':
        if (this._bossActivePattern === 'emp_blackout') return 1;
        if (this._bossActivePattern === 'void_lance_fan') return this.currentPhase >= 3 ? 3 : 2;
        if (this._bossActivePattern === 'abyss_ring_nova') return this.currentPhase >= 3 ? 2 : 1;
        if (this._bossActivePattern === 'singularity_cross') return this.currentPhase >= 2 ? 4 : 3;
        if (this._bossActivePattern === 'singularity_pull') return 2;
        if (this._bossActivePattern === 'twin_void_salvo') return 3;
        return this._phaseBurstCount > 1 ? this._phaseBurstCount : 5;
      default:
        return 1;
    }
  }

  /** @private */
  _getBurstInterval() {
    switch (this.archetype.id) {
      case 'rusher_drone':
      case 'void_swarmer':
        return 0.13;
      case 'interceptor_drone':
        return 0.11;
      case 'abyss_sentinel':
        return 0.20;
      case 'tactical_trooper':
      case 'void_warper':
        return 0.14;
      case 'rail_warden':
        return 0.14;
      case 'mortar_artillery':
        return 0.22;
      case 'vanguard_assassin':
        return 0.10;
      case 'cyber_mech_boss':
        if (this._bossActivePattern === 'homing_missiles') return 0.25;
        if (this._bossActivePattern === 'molten_fan') return 0.32;
        if (this._bossActivePattern === 'twin_slam_salvo') return 0.28;
        if (this._bossActivePattern === 'spiral_barrage') return 0.11;
        return Math.max(0.10, 0.19 / this._phaseFireMult);
      case 'aegis_overlord_boss':
        if (this._bossActivePattern === 'orbital_fan') return 0.26;
        if (this._bossActivePattern === 'hazard_barrage') return 0.36;
        if (this._bossActivePattern === 'orbital_laser_sweep') return 0.46;
        if (this._bossActivePattern === 'drone_salvo') return 0.24;
        if (this._bossActivePattern === 'sniper_lance') return 0.26;
        return Math.max(0.14, 0.22 / this._phaseFireMult);
      case 'transcendent_omega_boss':
        if (this._bossActivePattern === 'emp_blackout') return 0.25;
        if (this._bossActivePattern === 'void_lance_fan') return 0.26;
        if (this._bossActivePattern === 'abyss_ring_nova') return 0.38;
        if (this._bossActivePattern === 'singularity_cross') return 0.22;
        if (this._bossActivePattern === 'singularity_pull') return 0.95;
        if (this._bossActivePattern === 'twin_void_salvo') return 0.24;
        return Math.max(0.09, 0.15 / this._phaseFireMult);
      default:
        return 0.15;
    }
  }

  /**
   * Compute exact world muzzle origin & projectile trajectory and emit via WaveDirector pool.
   * @private
   */
  _selectNextBossPattern() {
    if (this.archetype.id === 'cyber_mech_boss') {
      const patterns =
        this.currentPhase >= 2
          ? ['rotary_barrage', 'homing_missiles', 'twin_slam_salvo', 'spiral_barrage', 'molten_fan']
          : ['rotary_barrage', 'homing_missiles', 'twin_slam_salvo'];
      this._bossActivePattern = patterns[this._bossPatternCycle % patterns.length];
      this._bossPatternCycle++;
    } else if (this.archetype.id === 'aegis_overlord_boss') {
      const patterns =
        this.currentPhase >= 2
          ? ['orbital_fan', 'hazard_barrage', 'orbital_laser_sweep', 'drone_salvo', 'sniper_lance']
          : ['orbital_fan', 'hazard_barrage', 'sniper_lance', 'orbital_laser_sweep', 'drone_salvo'];
      this._bossActivePattern = patterns[this._bossPatternCycle % patterns.length];
      this._bossPatternCycle++;
    } else if (this.archetype.id === 'transcendent_omega_boss') {
      if (this._empCooldown <= 0) {
        this._bossActivePattern = 'emp_blackout';
        this._empCooldown = this.currentPhase >= 3 ? 11.0 : this.currentPhase === 2 ? 13.0 : 15.5;
        return;
      }
      const patterns =
        this.currentPhase >= 3
          ? ['void_lance_fan', 'singularity_pull', 'abyss_ring_nova', 'singularity_cross', 'twin_void_salvo']
          : this.currentPhase === 2
          ? ['void_lance_fan', 'singularity_pull', 'twin_void_salvo', 'abyss_ring_nova', 'singularity_cross']
          : ['void_lance_fan', 'twin_void_salvo', 'singularity_pull', 'abyss_ring_nova'];
      this._bossActivePattern = patterns[this._bossPatternCycle % patterns.length];
      this._bossPatternCycle++;
    }
  }

  _fireShot(playerEyePos, spawnProjectileFn) {
    if (typeof spawnProjectileFn !== 'function') return;

    // Dual-weapon enemies & bosses alternate cleanly between right and left muzzles
    let muzzleObj = this.rig.weaponMuzzle;
    const hasDualMuzzle =
      (this.archetype.isBoss ||
        this.archetype.id === 'interceptor_drone' ||
        this.archetype.id === 'vanguard_assassin' ||
        this.archetype.id === 'void_warper') &&
      this.rig.leftWeaponMuzzle;
    if (hasDualMuzzle) {
      this._altMuzzleToggle = !this._altMuzzleToggle;
      if (this._altMuzzleToggle) {
        muzzleObj = this.rig.leftWeaponMuzzle;
      }
    }

    if (muzzleObj) {
      muzzleObj.getWorldPosition(this._muzzleWorld);
    } else {
      this._muzzleWorld.set(
        this.position.x,
        this.position.y + this.archetype.headHeight * 0.85,
        this.position.z
      );
    }

    // Aim point (sniper/rail shoot along locked telegraph beam; others aim cleanly at player torso/eye)
    if (this.archetype.id === 'sniper_stalker' || this.archetype.id === 'rail_warden') {
      this._shotDir.subVectors(this._lockedAimPoint, this._muzzleWorld);
    } else {
      this._shotDir.set(
        playerEyePos.x - this._muzzleWorld.x,
        playerEyePos.y - 0.22 - this._muzzleWorld.y,
        playerEyePos.z - this._muzzleWorld.z
      );
    }

    const len = this._shotDir.length();
    if (len < 0.01) {
      this._shotDir.set(Math.sin(this._yaw), 0, Math.cos(this._yaw));
    } else {
      this._shotDir.multiplyScalar(1 / len);
    }

    const projRadius =
      this.archetype.id === 'heavy_enforcer'
        ? 0.18
        : this.archetype.id === 'mortar_artillery'
        ? 0.22
        : this.archetype.id === 'aegis_overlord_boss'
        ? 0.17
        : this.archetype.isBoss
        ? 0.16
        : this.archetype.id === 'rail_warden'
        ? 0.11
        : this.archetype.id === 'shock_breacher' || this.archetype.id === 'sniper_stalker'
        ? 0.08
        : 0.09;

    const isSniperBeam =
      this.archetype.id === 'sniper_stalker' || this.archetype.id === 'rail_warden';
    this._recoilAnim = 1.0;

    // Trigger independent L/R damped-spring weapon recoil & chassis kick
    const isDualVolley =
      this.archetype.isBoss &&
      (this._bossActivePattern === 'twin_slam_salvo' ||
        this._bossActivePattern === 'sniper_lance' ||
        this._bossActivePattern === 'twin_void_salvo' ||
        (this._bossActivePattern === 'singularity_pull' && this._bossBurstShotIdx > 0));
    const kickRight = () => {
      this._recoilRight = 1.0;
      this._recoilRightVel = 3.4;
    };
    const kickLeft = () => {
      this._recoilLeft = 1.0;
      this._recoilLeftVel = 3.4;
    };
    if (isDualVolley) {
      kickRight();
      kickLeft();
    } else if (hasDualMuzzle) {
      if (this._altMuzzleToggle) kickLeft();
      else kickRight();
    } else if (this.rig.barrelSlides && this.rig.barrelSlides.length >= 2) {
      this._altMuzzleToggle = !this._altMuzzleToggle;
      if (this._altMuzzleToggle) kickLeft();
      else kickRight();
    } else {
      kickRight();
    }
    this._recoilShake = Math.min(1.4, this._recoilShake + 0.92);
    this._bodyRecoilX = Math.min(1.0, this._bodyRecoilX + (this.archetype.isBoss ? 0.55 : 0.85));
    this._bodyRecoilVel = 2.2;

    // Interceptor Drone: 3-bolt angled plasma spread fan with banking tilt
    if (this.archetype.id === 'interceptor_drone') {
      const fanAngles = [-0.15, 0, 0.15];
      const tiltStep = 0.03 * this._strafeDir;
      for (let i = 0; i < fanAngles.length; i++) {
        const a = fanAngles[i];
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        this._fanDir
          .set(
            this._shotDir.x * cosA - this._shotDir.z * sinA,
            this._shotDir.y + (i - 1) * tiltStep,
            this._shotDir.x * sinA + this._shotDir.z * cosA
          )
          .normalize();
        spawnProjectileFn(
          this._muzzleWorld,
          this._fanDir,
          this.archetype.projectileSpeed,
          this.archetype.damage,
          0x38bdf8,
          projRadius,
          this.archetype.id,
          false
        );
      }
      return;
    }

    // Shock Breacher: 4-pellet pneumatic EMP buckshot fan (zero-GC)
    if (this.archetype.id === 'shock_breacher') {
      const fanAngles = [-0.12, -0.04, 0.04, 0.12];
      for (let i = 0; i < fanAngles.length; i++) {
        const a = fanAngles[i];
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        this._fanDir
          .set(
            this._shotDir.x * cosA - this._shotDir.z * sinA,
            this._shotDir.y + (Math.random() - 0.5) * 0.036,
            this._shotDir.x * sinA + this._shotDir.z * cosA
          )
          .normalize();
        spawnProjectileFn(
          this._muzzleWorld,
          this._fanDir,
          this.archetype.projectileSpeed,
          this.archetype.damage,
          0x22d3ee,
          projRadius,
          this.archetype.id,
          false
        );
      }
      return;
    }

    // Mortar Artillery: True parabolic arcing plasma mortar shells with floor warning rings
    if (this.archetype.id === 'mortar_artillery') {
      const shotIdx = 3 - this._burstRemaining;
      const scatterAngle = shotIdx === 0 ? 0 : (shotIdx === 1 ? 1.15 : -1.15) + this._yaw;
      const scatterDist = shotIdx === 0 ? 0 : 2.55;
      const tx = Math.max(-27, Math.min(27, this._lockedAimPoint.x + Math.cos(scatterAngle) * scatterDist));
      const tz = Math.max(-27, Math.min(27, this._lockedAimPoint.z + Math.sin(scatterAngle) * scatterDist));
      const floorY = this.collisionWorld.getGroundHeightAt(
        tx,
        tz,
        Math.max(playerEyePos.y + 1.5, this.position.y + 3.0)
      );
      this._mortarTarget.set(tx, (Number.isFinite(floorY) ? floorY : 0) + 0.06, tz);

      const hDist = Math.hypot(tx - this._muzzleWorld.x, tz - this._muzzleWorld.z);
      const flightTime = Math.max(1.05, Math.min(1.75, hDist / 18.0));

      this._projExtraOpts.isMortar = true;
      this._projExtraOpts.gravity = 22.0;
      this._projExtraOpts.splashRadius = 3.35;
      this._projExtraOpts.flightTime = flightTime;
      this._projExtraOpts.boltColor = 0xff7b00;

      spawnProjectileFn(
        this._muzzleWorld,
        this._shotDir,
        this.archetype.projectileSpeed,
        this.archetype.damage,
        0xff7b00,
        projRadius,
        this.archetype.id,
        false,
        this._projExtraOpts
      );
      this._projExtraOpts.isMortar = false;
      return;
    }

    // Vanguard Assassin: 4-blade wide crescent fan volley
    if (this.archetype.id === 'vanguard_assassin') {
      const crescentYaw = [-0.27, -0.09, 0.09, 0.27];
      const crescentPitch = [0.014, -0.010, -0.010, 0.014];
      for (let i = 0; i < crescentYaw.length; i++) {
        const a = crescentYaw[i];
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        this._fanDir
          .set(
            this._shotDir.x * cosA - this._shotDir.z * sinA,
            this._shotDir.y + crescentPitch[i],
            this._shotDir.x * sinA + this._shotDir.z * cosA
          )
          .normalize();
        spawnProjectileFn(
          this._muzzleWorld,
          this._fanDir,
          this.archetype.projectileSpeed * 1.05,
          this.archetype.damage,
          0xf43f5e,
          0.11,
          this.archetype.id,
          false
        );
      }
      return;
    }

    // Act 3 Void Swarmer: fast split twin plasma bolts with vertical dive weave
    if (this.archetype.id === 'void_swarmer') {
      const splitYaw = [-0.085, 0.085];
      for (let i = 0; i < splitYaw.length; i++) {
        const a = splitYaw[i];
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        this._fanDir
          .set(
            this._shotDir.x * cosA - this._shotDir.z * sinA,
            this._shotDir.y + (i === 0 ? 0.015 : -0.015),
            this._shotDir.x * sinA + this._shotDir.z * cosA
          )
          .normalize();
        spawnProjectileFn(
          this._muzzleWorld,
          this._fanDir,
          this.archetype.projectileSpeed * 1.04,
          this.archetype.damage,
          i === 0 ? 0x38bdf8 : 0xc084fc,
          0.085,
          this.archetype.id,
          false
        );
      }
      return;
    }

    // Act 3 Void Warper: tight dual-carbine warp bolts following flank teleports
    if (this.archetype.id === 'void_warper') {
      const warpYaw = [-0.04, 0.04];
      for (let i = 0; i < warpYaw.length; i++) {
        const a = warpYaw[i];
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        this._fanDir
          .set(
            this._shotDir.x * cosA - this._shotDir.z * sinA,
            this._shotDir.y,
            this._shotDir.x * sinA + this._shotDir.z * cosA
          )
          .normalize();
        spawnProjectileFn(
          this._muzzleWorld,
          this._fanDir,
          this.archetype.projectileSpeed * 1.12,
          this.archetype.damage,
          i === 0 ? 0xa855f7 : 0x38bdf8,
          0.095,
          this.archetype.id,
          false
        );
      }
      return;
    }

    // Act 3 Abyss Sentinel: sweeping horizontal 3-wave crescent fan
    if (this.archetype.id === 'abyss_sentinel') {
      const waveIdx = Math.max(0, Math.min(2, 3 - this._burstRemaining));
      const sweepCenter = (waveIdx - 1) * 0.14 * this._strafeDir;
      const fanOffsets = [-0.11, 0, 0.11];
      for (let i = 0; i < fanOffsets.length; i++) {
        const a = sweepCenter + fanOffsets[i];
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        this._fanDir
          .set(
            this._shotDir.x * cosA - this._shotDir.z * sinA,
            this._shotDir.y + (waveIdx === 1 ? 0.01 : -0.008),
            this._shotDir.x * sinA + this._shotDir.z * cosA
          )
          .normalize();
        spawnProjectileFn(
          this._muzzleWorld,
          this._fanDir,
          this.archetype.projectileSpeed,
          this.archetype.damage,
          i === 1 ? 0xc084fc : 0xa855f7,
          0.14,
          this.archetype.id,
          false
        );
      }
      return;
    }

    // Act 3 Volatile Rusher: pressurized unstable bio-plasma spit during overload rush
    if (this.archetype.id === 'volatile_rusher') {
      spawnProjectileFn(
        this._muzzleWorld,
        this._shotDir,
        this.archetype.projectileSpeed * 1.06,
        this.archetype.damage,
        0xff2a6d,
        0.12,
        this.archetype.id,
        false
      );
      return;
    }

    // Stage 5 Boss (COLOSSUS-IV // ASH TITAN) diversified attack patterns
    if (this.archetype.id === 'cyber_mech_boss') {
      const shotIdx = this._bossBurstShotIdx++;
      if (this._bossActivePattern === 'homing_missiles') {
        const pods = this.rig.missilePods;
        const cosY = Math.cos(this._yaw);
        const sinY = Math.sin(this._yaw);
        if (pods && pods.length >= 2) {
          pods[0].getWorldPosition(this._podPosL);
          pods[1].getWorldPosition(this._podPosR);
          this._podPosL.y += 0.42;
          this._podPosR.y += 0.42;
        } else {
          this._podPosL.set(this.position.x + cosY * 1.15, this.position.y + 3.85, this.position.z - sinY * 1.15);
          this._podPosR.set(this.position.x - cosY * 1.15, this.position.y + 3.85, this.position.z + sinY * 1.15);
        }
        this._homingMissilePayload.targetPos.copy(playerEyePos);
        this._homingMissilePayload.phase = this.currentPhase;
        this._homingMissilePayload.damage = Math.round(this.archetype.damage * 0.92);
        this._homingMissilePayload.speed = this.currentPhase >= 3 ? 19.5 : this.currentPhase === 2 ? 17.8 : 16.2;
        if (this.eventBus) {
          this.eventBus.emit(EVENTS.BOSS_HOMING_MISSILES, this._homingMissilePayload);
        }
        return;
      }
      if (this._bossActivePattern === 'molten_fan') {
        const fanAngles =
          this.currentPhase >= 3
            ? [-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24]
            : [-0.18, -0.09, 0, 0.09, 0.18];
        for (let i = 0; i < fanAngles.length; i++) {
          const a = fanAngles[i];
          const cosA = Math.cos(a);
          const sinA = Math.sin(a);
          this._fanDir
            .set(
              this._shotDir.x * cosA - this._shotDir.z * sinA,
              this._shotDir.y + (shotIdx % 2 === 0 ? 0.015 : -0.015),
              this._shotDir.x * sinA + this._shotDir.z * cosA
            )
            .normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 0.92,
            this.archetype.damage * 0.85,
            0xff4d1a,
            0.18,
            this.archetype.id,
            false
          );
        }
        return;
      }
      if (this._bossActivePattern === 'twin_slam_salvo' && this.rig.weaponMuzzle && this.rig.leftWeaponMuzzle) {
        const muzzles = [this.rig.weaponMuzzle, this.rig.leftWeaponMuzzle];
        for (let m = 0; m < muzzles.length; m++) {
          muzzles[m].getWorldPosition(this._muzzleWorld);
          this._fanDir
            .set(
              playerEyePos.x - this._muzzleWorld.x,
              playerEyePos.y - 0.18 - this._muzzleWorld.y,
              playerEyePos.z - this._muzzleWorld.z
            )
            .normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 1.12,
            this.archetype.damage * 0.95,
            0xff6b1a,
            0.22,
            this.archetype.id,
            false
          );
        }
        return;
      }
      if (this._bossActivePattern === 'spiral_barrage') {
        const sweepAngle = Math.sin(shotIdx * 0.95) * (this.currentPhase >= 3 ? 0.22 : 0.16);
        const cosA = Math.cos(sweepAngle);
        const sinA = Math.sin(sweepAngle);
        this._fanDir
          .set(
            this._shotDir.x * cosA - this._shotDir.z * sinA,
            this._shotDir.y + Math.cos(shotIdx * 1.2) * 0.03,
            this._shotDir.x * sinA + this._shotDir.z * cosA
          )
          .normalize();
        spawnProjectileFn(
          this._muzzleWorld,
          this._fanDir,
          this.archetype.projectileSpeed * 1.05,
          this.archetype.damage * 0.8,
          0xff2e00,
          0.16,
          this.archetype.id,
          false
        );
        return;
      }
    }

    // Stage 10 Boss (AEGIS-IX // ORBITAL OVERLORD) exclusive Orbital Fleet patterns
    if (this.archetype.id === 'aegis_overlord_boss') {
      const shotIdx = this._bossBurstShotIdx++;
      if (this._bossActivePattern === 'orbital_fan') {
        const spreadAngles =
          this.currentPhase >= 3
            ? [-0.27, -0.18, -0.09, 0, 0.09, 0.18, 0.27]
            : [-0.22, -0.11, 0, 0.11, 0.22];
        for (let i = 0; i < spreadAngles.length; i++) {
          const a = spreadAngles[i] + (shotIdx % 2 === 0 ? 0 : 0.045);
          const cosA = Math.cos(a);
          const sinA = Math.sin(a);
          this._fanDir
            .set(
              this._shotDir.x * cosA - this._shotDir.z * sinA,
              this._shotDir.y + (Math.random() - 0.5) * 0.018,
              this._shotDir.x * sinA + this._shotDir.z * cosA
            )
            .normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 0.98,
            this.archetype.damage * 0.84,
            (i + shotIdx) % 2 === 0 ? 0x00e5ff : 0xf59e0b,
            0.17,
            this.archetype.id,
            false
          );
        }
        return;
      }

      if (this._bossActivePattern === 'hazard_barrage') {
        if (shotIdx === 0 && this.eventBus) {
          this._hazardOrigin.copy(playerEyePos);
          this._hazardOrigin.y = playerEyePos.y - 1.5;
          this._hazardFieldPayload.boss = this;
          this._hazardFieldPayload.phase = this.currentPhase;
          this._hazardFieldPayload.radius = this.currentPhase >= 3 ? 3.55 : 3.2;
          this._hazardFieldPayload.duration = this.currentPhase >= 3 ? 10.5 : 9.0;
          this._hazardFieldPayload.damage = Math.round(this.archetype.damage * 0.52);
          this.eventBus.emit(EVENTS.BOSS_HAZARD_FIELD, this._hazardFieldPayload);
          this.eventBus.emit('SFX_BOSS_TELEGRAPH', { type: 'hazard' });
        }
        const spread = this.currentPhase >= 3 ? [-0.22, -0.07, 0.07, 0.22] : [-0.16, 0, 0.16];
        for (let i = 0; i < spread.length; i++) {
          const a = spread[i];
          const cosA = Math.cos(a);
          const sinA = Math.sin(a);
          this._fanDir
            .set(
              this._shotDir.x * cosA - this._shotDir.z * sinA,
              this._shotDir.y,
              this._shotDir.x * sinA + this._shotDir.z * cosA
            )
            .normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 0.96,
            this.archetype.damage * 0.78,
            i % 2 === 0 ? 0xf59e0b : 0x38bdf8,
            0.16,
            this.archetype.id,
            false
          );
        }
        return;
      }

      if (this._bossActivePattern === 'orbital_laser_sweep') {
        if (shotIdx === 0 && this.eventBus) {
          // Sweep lane(s) across arena floor crossing player's current position (Phase 2+: dual scissor sweeps!)
          const dx = playerEyePos.x - this.position.x;
          const dz = playerEyePos.z - this.position.z;
          const dLen = Math.hypot(dx, dz) || 1;
          const perpX = -dz / dLen;
          const perpZ = dx / dLen;
          const sweepDir = this._strafeDir || 1;
          const halfSpan = this.currentPhase >= 3 ? 10.0 : 8.2;

          const sx = Math.max(-25, Math.min(25, playerEyePos.x - perpX * halfSpan * sweepDir));
          const sz = Math.max(-25, Math.min(25, playerEyePos.z - perpZ * halfSpan * sweepDir));
          const ex = Math.max(-25, Math.min(25, playerEyePos.x + perpX * halfSpan * sweepDir));
          const ez = Math.max(-25, Math.min(25, playerEyePos.z + perpZ * halfSpan * sweepDir));
          const sy = this.collisionWorld.getGroundHeightAt(sx, sz, playerEyePos.y + 1.5);
          const ey = this.collisionWorld.getGroundHeightAt(ex, ez, playerEyePos.y + 1.5);

          this._sweepStartPos.set(sx, Number.isFinite(sy) ? sy : 0, sz);
          this._sweepEndPos.set(ex, Number.isFinite(ey) ? ey : 0, ez);
          this._orbitalSweepPayload.telegraphDuration = this.currentPhase >= 3 ? 0.95 : 1.15;
          this._orbitalSweepPayload.sweepDuration = this.currentPhase >= 3 ? 1.25 : 1.35;
          this._orbitalSweepPayload.beamRadius = this.currentPhase >= 3 ? 2.4 : 2.1;
          this._orbitalSweepPayload.damage = Math.round(this.archetype.damage * 1.15);
          this.eventBus.emit(EVENTS.BOSS_ORBITAL_SWEEP, this._orbitalSweepPayload);

          if (this.currentPhase >= 2) {
            const fwdX = dx / dLen;
            const fwdZ = dz / dLen;
            const sx2 = Math.max(-25, Math.min(25, playerEyePos.x - fwdX * halfSpan * sweepDir));
            const sz2 = Math.max(-25, Math.min(25, playerEyePos.z - fwdZ * halfSpan * sweepDir));
            const ex2 = Math.max(-25, Math.min(25, playerEyePos.x + fwdX * halfSpan * sweepDir));
            const ez2 = Math.max(-25, Math.min(25, playerEyePos.z + fwdZ * halfSpan * sweepDir));
            const sy2 = this.collisionWorld.getGroundHeightAt(sx2, sz2, playerEyePos.y + 1.5);
            const ey2 = this.collisionWorld.getGroundHeightAt(ex2, ez2, playerEyePos.y + 1.5);
            this._sweepStartPos.set(sx2, Number.isFinite(sy2) ? sy2 : 0, sz2);
            this._sweepEndPos.set(ex2, Number.isFinite(ey2) ? ey2 : 0, ez2);
            this.eventBus.emit(EVENTS.BOSS_ORBITAL_SWEEP, this._orbitalSweepPayload);
          }
        } else {
          // Flanking cyan suppression fan while orbital beam sweeps
          const flankAngles = [-0.14, 0.14];
          for (let i = 0; i < flankAngles.length; i++) {
            const a = flankAngles[i];
            const cosA = Math.cos(a);
            const sinA = Math.sin(a);
            this._fanDir
              .set(
                this._shotDir.x * cosA - this._shotDir.z * sinA,
                this._shotDir.y,
                this._shotDir.x * sinA + this._shotDir.z * cosA
              )
              .normalize();
            spawnProjectileFn(
              this._muzzleWorld,
              this._fanDir,
              this.archetype.projectileSpeed * 1.02,
              this.archetype.damage * 0.78,
              0x38bdf8,
              0.16,
              this.archetype.id,
              false
            );
          }
        }
        return;
      }

      if (this._bossActivePattern === 'drone_salvo') {
        // Coordinated arm-cannon + intact wingtip core salvo (destroying wing cores weakens salvo!)
        const muzzles = [this.rig.weaponMuzzle, this.rig.leftWeaponMuzzle];
        for (let m = 0; m < muzzles.length; m++) {
          if (!muzzles[m]) continue;
          muzzles[m].getWorldPosition(this._wingCoreWorldPos);
          this._wingShotDir
            .set(
              playerEyePos.x - this._wingCoreWorldPos.x,
              playerEyePos.y - 0.18 - this._wingCoreWorldPos.y,
              playerEyePos.z - this._wingCoreWorldPos.z
            )
            .normalize();
          spawnProjectileFn(
            this._wingCoreWorldPos,
            this._wingShotDir,
            this.archetype.projectileSpeed * 1.04,
            this.archetype.damage * 0.80,
            m === 0 ? 0x38bdf8 : 0xf59e0b,
            0.16,
            this.archetype.id,
            false
          );
        }

        if (this._wingCoreHpL > 0 && this.rig.wingCoreL) {
          this.rig.wingCoreL.getWorldPosition(this._wingCoreWorldPos);
          this._wingShotDir
            .set(
              playerEyePos.x - this._wingCoreWorldPos.x,
              playerEyePos.y - 0.15 - this._wingCoreWorldPos.y,
              playerEyePos.z - this._wingCoreWorldPos.z
            )
            .normalize();
          spawnProjectileFn(
            this._wingCoreWorldPos,
            this._wingShotDir,
            this.archetype.projectileSpeed * 1.12,
            this.archetype.damage * 0.72,
            0x00e5ff,
            0.14,
            this.archetype.id,
            false
          );
        }
        if (this._wingCoreHpR > 0 && this.rig.wingCoreR) {
          this.rig.wingCoreR.getWorldPosition(this._wingCoreWorldPos);
          this._wingShotDir
            .set(
              playerEyePos.x - this._wingCoreWorldPos.x,
              playerEyePos.y - 0.15 - this._wingCoreWorldPos.y,
              playerEyePos.z - this._wingCoreWorldPos.z
            )
            .normalize();
          spawnProjectileFn(
            this._wingCoreWorldPos,
            this._wingShotDir,
            this.archetype.projectileSpeed * 1.12,
            this.archetype.damage * 0.72,
            0x00e5ff,
            0.14,
            this.archetype.id,
            false
          );
        }

        if (shotIdx === 0 && this.currentPhase >= 2 && this.eventBus) {
          this._droneSalvoPayload.phase = this.currentPhase;
          this.eventBus.emit(EVENTS.BOSS_DRONE_SALVO, this._droneSalvoPayload);
        }
        return;
      }

      if (this._bossActivePattern === 'sniper_lance') {
        // Twin converging amber + cyan piercing rail lances from left & right siege cannons
        const muzzles = [this.rig.weaponMuzzle, this.rig.leftWeaponMuzzle];
        let fired = 0;
        for (let m = 0; m < muzzles.length; m++) {
          if (!muzzles[m]) continue;
          muzzles[m].getWorldPosition(this._wingCoreWorldPos);
          this._wingShotDir
            .set(
              playerEyePos.x - this._wingCoreWorldPos.x,
              playerEyePos.y - 0.14 - this._wingCoreWorldPos.y,
              playerEyePos.z - this._wingCoreWorldPos.z
            )
            .normalize();
          spawnProjectileFn(
            this._wingCoreWorldPos,
            this._wingShotDir,
            68,
            this.archetype.damage * 0.92,
            m === 0 ? 0xf59e0b : 0x38bdf8,
            0.11,
            this.archetype.id,
            true
          );
          fired++;
        }
        if (fired === 0) {
          spawnProjectileFn(
            this._muzzleWorld,
            this._shotDir,
            68,
            this.archetype.damage * 1.1,
            0xf59e0b,
            0.11,
            this.archetype.id,
            true
          );
        }
        return;
      }
    }

    // Stage 15 Boss (TRANSCENDENT-OMEGA) diversified singularity patterns
    if (this.archetype.id === 'transcendent_omega_boss') {
      const shotIdx = this._bossBurstShotIdx++;
      if (this._bossActivePattern === 'void_lance_fan') {
        const spreadAngles =
          this.currentPhase >= 3
            ? [-0.28, -0.18, -0.09, 0, 0.09, 0.18, 0.28]
            : [-0.2, -0.1, 0, 0.1, 0.2];
        for (let i = 0; i < spreadAngles.length; i++) {
          const a = spreadAngles[i];
          const cosA = Math.cos(a);
          const sinA = Math.sin(a);
          this._fanDir
            .set(
              this._shotDir.x * cosA - this._shotDir.z * sinA,
              this._shotDir.y + (Math.random() - 0.5) * 0.02,
              this._shotDir.x * sinA + this._shotDir.z * cosA
            )
            .normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 1.04,
            this.archetype.damage * 0.88,
            0xc084fc,
            0.18,
            this.archetype.id,
            false
          );
        }
        return;
      }
      if (this._bossActivePattern === 'emp_blackout') {
        if (this.eventBus) {
          this._empPulsePayload.boss = this;
          this._empPulsePayload.duration = this.currentPhase >= 3 ? 6.5 : this.currentPhase === 2 ? 5.5 : 4.5;
          this._empPulsePayload.phase = this.currentPhase;
          this.eventBus.emit(EVENTS.BOSS_EMP_PULSE, this._empPulsePayload);
        }
        const empBolts = 10;
        for (let i = 0; i < empBolts; i++) {
          const ang = this._yaw + (i / empBolts) * Math.PI * 2;
          this._fanDir.set(Math.sin(ang), -0.05, Math.cos(ang)).normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 0.65,
            this.archetype.damage * 0.7,
            i % 2 === 0 ? 0x38bdf8 : 0xa855f7,
            0.2,
            this.archetype.id,
            false
          );
        }
        return;
      }
      if (this._bossActivePattern === 'abyss_ring_nova') {
        const count = this.currentPhase >= 3 ? 20 : this.currentPhase === 2 ? 16 : 12;
        const baseYaw = this._yaw + shotIdx * (Math.PI / count);
        for (let i = 0; i < count; i++) {
          const ang = baseYaw + (i / count) * Math.PI * 2;
          const elev = this.currentPhase >= 3 && i % 2 === 1 ? -0.14 : -0.05;
          this._fanDir.set(Math.sin(ang), elev, Math.cos(ang)).normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * (this.currentPhase >= 2 ? 0.86 : 0.78),
            this.archetype.damage * 0.9,
            i % 2 === 0 ? 0xa855f7 : 0x38bdf8,
            0.2,
            this.archetype.id,
            false
          );
        }
        return;
      }
      if (this._bossActivePattern === 'singularity_cross') {
        const offsets = [
          [-0.09, 0.06],
          [0.09, 0.06],
          [-0.09, -0.05],
          [0.09, -0.05],
          [0, 0],
        ];
        for (let i = 0; i < offsets.length; i++) {
          const [yawOff, pitchOff] = offsets[i];
          const cosA = Math.cos(yawOff);
          const sinA = Math.sin(yawOff);
          this._fanDir
            .set(
              this._shotDir.x * cosA - this._shotDir.z * sinA,
              this._shotDir.y + pitchOff,
              this._shotDir.x * sinA + this._shotDir.z * cosA
            )
            .normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 1.12,
            this.archetype.damage * 0.85,
            i === 4 ? 0xf43f5e : 0x38bdf8,
            0.17,
            this.archetype.id,
            false
          );
        }
        return;
      }
      if (
        this._bossActivePattern === 'twin_void_salvo' &&
        this.rig.weaponMuzzle &&
        this.rig.leftWeaponMuzzle
      ) {
        const muzzles = [this.rig.weaponMuzzle, this.rig.leftWeaponMuzzle];
        for (let m = 0; m < muzzles.length; m++) {
          muzzles[m].getWorldPosition(this._muzzleWorld);
          this._fanDir
            .set(
              playerEyePos.x - this._muzzleWorld.x,
              playerEyePos.y - 0.16 - this._muzzleWorld.y,
              playerEyePos.z - this._muzzleWorld.z
            )
            .normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 1.16,
            this.archetype.damage * 0.96,
            0xe879f9,
            0.21,
            this.archetype.id,
            false
          );
        }
        return;
      }
      if (this._bossActivePattern === 'singularity_pull') {
        if (shotIdx === 0) {
          this._singularityPullTimer = 2.5;
          if (this.eventBus) {
            this._singularityPullPayload.boss = this;
            this._singularityPullPayload.origin.copy(this.position);
            this._singularityPullPayload.telegraphDuration = 1.0;
            this._singularityPullPayload.pullDuration = 1.45;
            this._singularityPullPayload.pullRadius = 32.0;
            this._singularityPullPayload.pullAccel = this.currentPhase >= 3 ? 18.5 : 16.0;
            this._singularityPullPayload.maxPullSpeed = this.currentPhase >= 3 ? 8.6 : 7.5;
            this.eventBus.emit(EVENTS.BOSS_SINGULARITY_PULL, this._singularityPullPayload);
          }
          // Fire an outward 8-orb singularity warning crown around OMEGA
          const count = 8;
          for (let i = 0; i < count; i++) {
            const ang = this._yaw + (i / count) * Math.PI * 2;
            this._fanDir.set(Math.sin(ang), -0.06, Math.cos(ang)).normalize();
            spawnProjectileFn(
              this._muzzleWorld,
              this._fanDir,
              this.archetype.projectileSpeed * 0.72,
              this.archetype.damage * 0.75,
              i % 2 === 0 ? 0xa855f7 : 0x38bdf8,
              0.18,
              this.archetype.id,
              false
            );
          }
          return;
        }
        const muzzles = [this.rig.weaponMuzzle, this.rig.leftWeaponMuzzle];
        for (let m = 0; m < muzzles.length; m++) {
          if (!muzzles[m]) continue;
          muzzles[m].getWorldPosition(this._muzzleWorld);
          this._fanDir
            .set(
              playerEyePos.x - this._muzzleWorld.x,
              playerEyePos.y - 0.16 - this._muzzleWorld.y,
              playerEyePos.z - this._muzzleWorld.z
            )
            .normalize();
          spawnProjectileFn(
            this._muzzleWorld,
            this._fanDir,
            this.archetype.projectileSpeed * 1.08,
            this.archetype.damage * 0.88,
            m === 0 ? 0xa855f7 : 0x38bdf8,
            0.19,
            this.archetype.id,
            false
          );
        }
        return;
      }
    }

    // Subtle tactical spread (sniper/rail are razor accurate; drones/mortars fan slightly)
    const spread =
      this.archetype.id === 'sniper_stalker'
        ? 0.004
        : this.archetype.id === 'rail_warden'
        ? 0.012
        : this.archetype.id === 'vanguard_assassin'
        ? 0.024
        : this.archetype.id === 'mortar_artillery'
        ? 0.052
        : this.archetype.isBoss
        ? this.archetype.id === 'aegis_overlord_boss'
          ? 0.028
          : 0.042
        : this.archetype.isFlying
        ? 0.044
        : 0.032;

    if (spread > 0) {
      this._shotDir.x += (Math.random() - 0.5) * spread * 2;
      this._shotDir.y += (Math.random() - 0.5) * spread * 1.3;
      this._shotDir.z += (Math.random() - 0.5) * spread * 2;
      this._shotDir.normalize();
    }

    spawnProjectileFn(
      this._muzzleWorld,
      this._shotDir,
      this.archetype.projectileSpeed,
      this.archetype.damage,
      this.archetype.color,
      projRadius,
      this.archetype.id,
      isSniperBeam
    );
  }

  /**
   * Update Sniper Stalker's glowing telegraph laser beam from muzzle to target (clipped by walls).
   * @private
   */
  _updateSniperLaser(progress, elapsedTime) {
    const laser = this.rig.laserLine;
    if (!laser) return;

    this.rig.weaponMuzzle.getWorldPosition(this._muzzleWorld);
    this._shotDir.subVectors(this._lockedAimPoint, this._muzzleWorld);
    let dist = this._shotDir.length();
    if (dist < 0.1) {
      laser.visible = false;
      return;
    }
    this._shotDir.multiplyScalar(1 / dist);

    // Clip telegraph beam cleanly against arena walls & pillars
    const wallHit = this.collisionWorld.raycastWorld(
      this._muzzleWorld,
      this._shotDir,
      Math.min(60, dist + 6),
      this._rayHit
    );
    if (wallHit && wallHit.distance < dist) {
      dist = wallHit.distance;
    }

    this._laserEndWorld.set(
      this._muzzleWorld.x + this._shotDir.x * dist,
      this._muzzleWorld.y + this._shotDir.y * dist,
      this._muzzleWorld.z + this._shotDir.z * dist
    );

    // Convert world endpoints into root's local space (zero allocations)
    this.rig.root.worldToLocal(this._laserStartLocal.copy(this._muzzleWorld));
    this.rig.root.worldToLocal(this._laserEndLocal.copy(this._laserEndWorld));
    this._laserDirLocal.subVectors(this._laserEndLocal, this._laserStartLocal);
    const localLen = this._laserDirLocal.length();
    if (localLen < 0.05) {
      laser.visible = false;
      return;
    }
    this._laserDirLocal.multiplyScalar(1 / localLen);

    laser.visible = true;
    laser.position.copy(this._laserStartLocal);
    laser.quaternion.setFromUnitVectors(Z_AXIS, this._laserDirLocal);

    // Rapid strobe & thicken during final 0.2s locked warning window
    const strobe = this._sniperLockFrozen
      ? 1.55 + Math.sin(elapsedTime * 58) * 0.55
      : 0.7 + progress * 0.65;
    laser.scale.set(strobe, strobe, localLen);

    if (laser.material) {
      laser.material.opacity = this._sniperLockFrozen ? 0.96 : 0.52 + progress * 0.40;
      if (this.archetype.id === 'rail_warden') {
        laser.material.color.setHex(this._sniperLockFrozen ? 0xe0ffff : 0x00f0ff);
      } else {
        laser.material.color.setHex(this._sniperLockFrozen ? 0xff1111 : 0xe62020);
      }
    }
  }

  /** @private */
  _hideLaser() {
    this.isSniperLocking = false;
    if (this.rig.laserLine) {
      this.rig.laserLine.visible = false;
    }
  }

  /**
   * Apply damped-spring blowback along the slide's sculpted barrel axis (Zero-GC).
   * @private
   */
  _applySlideRecoil(slide, stroke, recoilAmt, tremorAmt) {
    if (!slide) return;
    const bp = slide.userData.basePosition;
    const br = slide.userData.baseRotation;
    if (!bp) return;
    const rotX = br ? br.x : 0;
    const backDist = recoilAmt * stroke + tremorAmt;
    slide.position.x = bp.x;
    slide.position.y = bp.y + Math.sin(rotX) * backDist;
    slide.position.z = bp.z - Math.cos(rotX) * backDist;
  }

  /**
   * Unified Zero-GC Procedural IK/FK & Damped-Spring Motion across all 16 units:
   *  - 3-stage leg gait (Thigh swing -> Shin knee flex -> Foot ankle plant) + Pelvis shift
   *  - Damped-spring L/R weapon & multi-barrel blowback + high-freq charge tremor
   *  - Real-time vertical aim pitch tracking & Sniper 3-stage crouch-brace signature
   *  - Boss patterns (CoreShutter, MissileCitadels, WingShieldFins, OrbitRings, WingCores)
   *  - Drone velocity banking, stabilizer fins & high-RPM rotor shafts
   * @private
   */
  _updateRigAnimation(dt, elapsedTime, horizSpeed, playerPos) {
    const rig = this.rig;
    const id = this.archetype.id;
    const isBoss = Boolean(this.archetype.isBoss);
    const out = this._springOut;

    // 0. Advance damped-spring recoil oscillators & accumulators
    const kArm = isBoss ? 120.0 : 165.0;
    const dArm = isBoss ? 14.5 : 16.5;
    stepDampedSpring(this._recoilRight, this._recoilRightVel, kArm, dArm, dt, out);
    this._recoilRight = out.x;
    this._recoilRightVel = out.v;

    stepDampedSpring(this._recoilLeft, this._recoilLeftVel, kArm, dArm, dt, out);
    this._recoilLeft = out.x;
    this._recoilLeftVel = out.v;

    stepDampedSpring(this._bodyRecoilX, this._bodyRecoilVel, isBoss ? 105.0 : 140.0, 14.0, dt, out);
    this._bodyRecoilX = out.x;
    this._bodyRecoilVel = out.v;

    if (this._recoilShake > 0) {
      this._recoilShake = Math.max(0, this._recoilShake - dt * 5.2);
    }

    // Real-time vertical aim pitch toward player elevation (negative rot.x aims muzzle upward +Y)
    const dxP = playerPos.x - this.position.x;
    const dzP = playerPos.z - this.position.z;
    const hDistP = Math.max(1.2, Math.hypot(dxP, dzP));
    const aimTargetY =
      (id === 'sniper_stalker' || id === 'rail_warden') && this._lockedAimPoint.lengthSq() > 0.01
        ? this._lockedAimPoint.y
        : playerPos.y + 1.45;
    const aimOriginY = this.position.y + this.archetype.height * (isBoss ? 0.66 : 0.72);
    const rawAimPitch = Math.max(-0.52, Math.min(0.45, Math.atan2(aimTargetY - aimOriginY, hDistP)));
    this._aimPitch += (rawAimPitch - this._aimPitch) * (1 - Math.exp(-9.0 * dt));

    // Weapon charge / firing tremor along barrel axis
    const isCharging =
      this.state === 'telegraph' &&
      (id === 'sniper_stalker' || id === 'rail_warden' || id === 'abyss_sentinel' || isBoss);
    const tremor =
      (this._recoilShake * 0.008 + (isCharging ? 0.005 : 0)) *
      Math.sin(elapsedTime * 54.0 + this._hoverSeed);
    const baseBodyPosY = rig.bodyGroup.userData.basePosition ? rig.bodyGroup.userData.basePosition.y : 0;

    // 1. Flying Drones (Rusher Drone, Interceptor Drone, Void Swarmer)
    if (this.archetype.isFlying) {
      const sinY = Math.sin(this._yaw);
      const cosY = Math.cos(this._yaw);
      const localFwdVel = this.velocity.x * sinY + this.velocity.z * cosY;
      const localRightVel = this.velocity.x * cosY - this.velocity.z * sinY;

      const recoilPitchKick = -this._bodyRecoilX * 0.14;
      const flinchPitch = -this._hitFlinch * 0.24;
      const flinchRoll = this._hitSideBias * this._hitFlinch * 0.22;
      const targetPitch = Math.max(-0.42, Math.min(0.42, localFwdVel * 0.044)) + recoilPitchKick + flinchPitch;
      const targetRoll = Math.max(-0.46, Math.min(0.46, -localRightVel * 0.056)) + flinchRoll;
      const bankBlend = 1 - Math.exp(-9 * dt);
      rig.bodyGroup.rotation.x += (targetPitch - rig.bodyGroup.rotation.x) * bankBlend;
      rig.bodyGroup.rotation.z += (targetRoll - rig.bodyGroup.rotation.z) * bankBlend;

      const hoverBaseY =
        id === 'interceptor_drone' ? 0.62 : id === 'void_swarmer' ? 0.58 : 0.55;
      rig.bodyGroup.position.y = hoverBaseY + Math.sin(elapsedTime * 5.2 + this._hoverSeed) * 0.065;
      rig.bodyGroup.position.z =
        (rig.bodyGroup.userData.basePosition ? rig.bodyGroup.userData.basePosition.z : 0) -
        this._bodyRecoilX * 0.05;

      // Spin ducted fan rotor wheels strictly around local Y shaft
      const targetRotor = this.state === 'telegraph' || this.state === 'attack' ? 38.0 : 26.0;
      this._rotorSpeed += (targetRotor - this._rotorSpeed) * (1 - Math.exp(-7 * dt));
      const rotorDelta = this._rotorSpeed * dt;
      for (let i = 0; i < rig.rotors.length; i++) {
        rig.rotors[i].rotateY(i % 2 === 0 ? rotorDelta : -rotorDelta);
      }

      // Dynamic tail stabilizer fin aerodynamic deflection
      const stabPitch = Math.max(-0.28, Math.min(0.28, -localFwdVel * 0.028 - this._bodyRecoilX * 0.18));
      const stabRoll = Math.max(-0.32, Math.min(0.32, -localRightVel * 0.036));
      for (let i = 0; i < rig.stabilizers.length; i++) {
        const st = rig.stabilizers[i];
        const br = st.userData.baseRotation;
        const bx = br ? br.x : 0;
        const bz = br ? br.z : 0;
        st.rotation.x = bx + stabPitch;
        st.rotation.z = bz + (i % 2 === 0 ? stabRoll : -stabRoll);
      }

      // Independent wingtip blaster pod / mandible slide recoil + aim elevation
      if (rig.rightArm) {
        const bp = rig.rightArm.userData.basePosition;
        const br = rig.rightArm.userData.baseRotation;
        const kickR = Math.max(0, this._recoilRight);
        rig.rightArm.rotation.x = (br ? br.x : 0) - this._aimPitch * 0.55 - kickR * 0.14;
        if (bp) rig.rightArm.position.z = bp.z - kickR * 0.065;
        else rig.rightArm.position.z = 0.12 - kickR * 0.08;
      }
      if (rig.leftArm) {
        const bp = rig.leftArm.userData.basePosition;
        const br = rig.leftArm.userData.baseRotation;
        const kickL = id === 'rusher_drone' ? 0 : Math.max(0, this._recoilLeft);
        rig.leftArm.rotation.x = (br ? br.x : 0) - this._aimPitch * 0.55 - kickL * 0.14;
        if (bp) rig.leftArm.position.z = bp.z - kickL * 0.065;
        else if (id === 'interceptor_drone') rig.leftArm.position.z = 0.14 - kickL * 0.08;
      }
      this._applySlideRecoil(rig.weaponSlide, 0.11, Math.max(0, this._recoilRight), tremor);
      this._applySlideRecoil(rig.leftWeaponSlide, 0.11, Math.max(0, this._recoilLeft), tremor);
      if (rig.headGroup) {
        const br = rig.headGroup.userData.baseRotation;
        rig.headGroup.rotation.x = (br ? br.x : 0) - this._aimPitch * 0.4 - this._hitFlinch * 0.25;
      }
    } else if (id === 'aegis_overlord_boss' || id === 'transcendent_omega_boss') {
      // 2A. Non-Humanoid Aerial Bosses: AEGIS-IX Gunship (hover + bank) & TRANSCENDENT-OMEGA Archon (levitate + triaxial rings)
      const isGunship = id === 'aegis_overlord_boss';
      const sinY = Math.sin(this._yaw);
      const cosY = Math.cos(this._yaw);
      const localFwdVel = this.velocity.x * sinY + this.velocity.z * cosY;
      const localRightVel = this.velocity.x * cosY - this.velocity.z * sinY;

      const empLift =
        !isGunship && this._bossActivePattern === 'emp_blackout' && this.state === 'telegraph' ? 0.38 : 0.0;
      const bobAmp = isGunship ? 0.16 : 0.22;
      const bobFreq = isGunship ? 2.1 : 1.75;
      rig.bodyGroup.position.y = baseBodyPosY + Math.sin(elapsedTime * bobFreq + this._hoverSeed) * bobAmp + empLift;

      const staggerLean = this.state === 'stagger' ? -0.18 : 0.0;
      const recoilBodyPitch = -this._bodyRecoilX * (isGunship ? 0.10 : 0.06);
      const flinchPitch = -this._hitFlinch * (isGunship ? 0.12 : 0.08);
      const targetPitch =
        Math.max(-0.28, Math.min(0.28, localFwdVel * (isGunship ? 0.036 : 0.018))) +
        staggerLean +
        recoilBodyPitch +
        flinchPitch;
      const targetRoll =
        Math.max(-0.32, Math.min(0.32, -localRightVel * (isGunship ? 0.065 : 0.024))) +
        (isGunship ? 0 : Math.sin(elapsedTime * 1.15 + this._hoverSeed) * 0.04) +
        this._hitSideBias * this._hitFlinch * 0.08;
      const bankBlend = 1 - Math.exp(-8.5 * dt);
      rig.bodyGroup.rotation.x += (targetPitch - rig.bodyGroup.rotation.x) * bankBlend;
      rig.bodyGroup.rotation.z += (targetRoll - rig.bodyGroup.rotation.z) * bankBlend;

      if (rig.headGroup) {
        const hr = rig.headGroup.userData.baseRotation;
        const bp = rig.headGroup.userData.basePosition;
        rig.headGroup.rotation.x = (hr ? hr.x : 0) - this._aimPitch * 0.55 - this._hitFlinch * 0.14;
        rig.headGroup.rotation.z = (hr ? hr.z : 0) + this._hitSideBias * this._hitFlinch * 0.12;
        if (!isGunship && bp) {
          rig.headGroup.position.y = bp.y + Math.sin(elapsedTime * 2.6 + this._hoverSeed) * 0.10;
        }
        const bs = rig.headGroup.userData.baseScale;
        const pulse = 1.0 + Math.sin(elapsedTime * (4.5 * this.currentPhase)) * 0.05;
        rig.headGroup.scale.set((bs ? bs.x : 1) * pulse, (bs ? bs.y : 1) * pulse, (bs ? bs.z : 1) * pulse);
      }

      const kickR = this._recoilRight;
      const kickL = this._recoilLeft;
      if (rig.rightArm) {
        const br = rig.rightArm.userData.baseRotation;
        const bp = rig.rightArm.userData.basePosition;
        rig.rightArm.rotation.x = (br ? br.x : 0) - this._aimPitch - kickR * 0.16;
        if (!isGunship && bp) {
          rig.rightArm.position.y = bp.y + Math.sin(elapsedTime * 2.8 + this._hoverSeed) * 0.09;
        }
      }
      if (rig.leftArm) {
        const br = rig.leftArm.userData.baseRotation;
        const bp = rig.leftArm.userData.basePosition;
        rig.leftArm.rotation.x = (br ? br.x : 0) - this._aimPitch - kickL * 0.16;
        if (!isGunship && bp) {
          rig.leftArm.position.y = bp.y + Math.cos(elapsedTime * 2.8 + this._hoverSeed) * 0.09;
        }
      }
      this._applySlideRecoil(rig.weaponSlide, 0.22, kickR, tremor);
      this._applySlideRecoil(rig.leftWeaponSlide, 0.22, kickL, tremor);

      if (rig.shieldFrame) {
        const sr = rig.shieldFrame.userData.baseRotation;
        const sp = rig.shieldFrame.userData.basePosition;
        const flashFactor = Math.min(1, this._shieldFlashTimer / 0.25);
        const targetBraceZ = (sr ? sr.z : 0) + (this.state === 'telegraph' ? 0.08 : 0) + flashFactor * 0.14;
        rig.shieldFrame.rotation.z += (targetBraceZ - rig.shieldFrame.rotation.z) * (1 - Math.exp(-14 * dt));
        if (sp) rig.shieldFrame.position.z = sp.z - flashFactor * 0.06;
      }

      // Spin AEGIS aft halo or TRANSCENDENT-OMEGA 3 triaxial singularity gyro rings
      const isPullSurge = this._singularityPullTimer > 0;
      const isEmpSurge = !isGunship && this._bossActivePattern === 'emp_blackout' && this.state === 'telegraph';
      const ringBoost =
        (this.currentPhase === 3 ? 3.2 : this.currentPhase === 2 ? 2.1 : 1.0) *
        (this._phaseShieldTimer > 0 ? 1.8 : 1.0) *
        (isPullSurge || isEmpSurge ? 3.0 : 1.0);
      for (let i = 0; i < rig.coreRings.length; i++) {
        const ring = rig.coreRings[i];
        const dir = i % 2 === 0 ? 1 : -1;
        ring.rotation.x += dir * (0.55 + i * 0.32) * ringBoost * dt;
        ring.rotation.y += dir * (0.95 + i * 0.44) * ringBoost * dt;
        ring.rotation.z += -dir * (0.65 + i * 0.28) * ringBoost * dt;
      }

      // Float TRANSCENDENT-OMEGA side Stabilizer monoliths in harmonic vertical wave
      if (!isGunship && rig.stabilizers && rig.stabilizers.length > 0) {
        for (let i = 0; i < rig.stabilizers.length; i++) {
          const st = rig.stabilizers[i];
          const bp = st.userData.basePosition;
          if (bp) {
            st.position.y = bp.y + Math.sin(elapsedTime * 2.4 + i * 2.1) * 0.18;
          }
        }
      }
    } else {
      // 2B. Grounded Bipedal & Digitigrade Mechs + Siege Titans
      const isDigitigrade =
        id === 'sniper_stalker' ||
        id === 'vanguard_assassin' ||
        id === 'volatile_rusher' ||
        id === 'void_warper';
      const isShieldWalker =
        id === 'heavy_enforcer' || id === 'rail_warden' || id === 'abyss_sentinel';

      // Sniper Stalker 3-stage signature crouch-brace blend
      const targetCrouch =
        id === 'sniper_stalker'
          ? this.state === 'attack' || (this.state === 'telegraph' && this._sniperLockFrozen)
            ? 1.0
            : this.state === 'telegraph'
            ? 0.62
            : 0.0
          : 0.0;
      this._crouchBlend += (targetCrouch - this._crouchBlend) * (1 - Math.exp(-8.5 * dt));
      const crouch = this._crouchBlend;

      const rawSpeedNorm = Math.min(1.35, horizSpeed / Math.max(1, this.archetype.speed));
      const speedNorm = rawSpeedNorm * (1.0 - crouch * 0.85);
      const strideFreq = isBoss
        ? (id === 'aegis_overlord_boss' ? 4.4 : 4.6) * this._phaseSpeedMult
        : isShieldWalker
        ? 5.8
        : id === 'mortar_artillery'
        ? 4.8
        : id === 'vanguard_assassin' || id === 'void_warper'
        ? 10.2
        : id === 'shock_breacher' || id === 'volatile_rusher'
        ? 9.4
        : 8.6;

      if (rawSpeedNorm > 0.08 && crouch < 0.85) {
        this._walkCycle += dt * strideFreq * Math.max(0.45, rawSpeedNorm);
      }

      const swingAmp =
        (isBoss
          ? 0.34
          : isShieldWalker || id === 'mortar_artillery'
          ? 0.38
          : id === 'vanguard_assassin' || id === 'volatile_rusher'
          ? 0.60
          : 0.54) * speedNorm;
      const idleBreath = Math.sin(elapsedTime * 2.2 + this._hoverSeed);

      // 3-Joint Leg Kinematics: Thigh swing -> Shin backward knee bend -> Foot flat ankle plant
      const applyLegChain = (thigh, shin, foot, phase, sideSign) => {
        if (!thigh) return;
        const baseThighX = thigh.userData.baseRotation ? thigh.userData.baseRotation.x : 0;
        const baseThighZ = thigh.userData.baseRotation ? thigh.userData.baseRotation.z : 0;
        const forwardSwing = Math.sin(phase);
        const swingLift = Math.max(0, Math.cos(phase));
        const stancePlant = Math.max(0, -Math.cos(phase));

        const crouchThigh =
          crouch * (sideSign > 0 ? -0.40 : -0.34);
        const thighDelta = -forwardSwing * swingAmp + crouchThigh - crouch * 0.04;
        thigh.rotation.x = baseThighX + thighDelta;
        thigh.rotation.z = baseThighZ + sideSign * crouch * 0.06;

        let kneeDelta = 0;
        if (shin) {
          const baseShinX = shin.userData.baseRotation ? shin.userData.baseRotation.x : 0;
          const athleticStance = isDigitigrade ? 0.18 : 0.14;
          const activeKneeBend = swingLift * (isBoss ? 0.36 : 0.56) * speedNorm;
          const impactFlex = stancePlant * 0.10 * speedNorm;
          const crouchKnee = crouch * (sideSign > 0 ? 0.58 : 0.52);
          kneeDelta = athleticStance + activeKneeBend + impactFlex + crouchKnee;
          shin.rotation.x = baseShinX + kneeDelta;
        }
        if (foot) {
          const baseFootX = foot.userData.baseRotation ? foot.userData.baseRotation.x : 0;
          const levelComp = -(thighDelta + kneeDelta) * (0.55 + 0.45 * stancePlant);
          const toePush = swingLift * 0.14 * speedNorm;
          foot.rotation.x = baseFootX + levelComp + toePush;
        }
      };

      applyLegChain(rig.leftThigh || rig.leftLeg, rig.leftShin, rig.leftFoot, this._walkCycle, +1);
      applyLegChain(
        rig.rightThigh || rig.rightLeg,
        rig.rightShin,
        rig.rightFoot,
        this._walkCycle + Math.PI,
        -1
      );

      // Pelvis twist & stance weight roll
      if (rig.pelvis) {
        const pr = rig.pelvis.userData.baseRotation;
        rig.pelvis.rotation.y = (pr ? pr.y : 0) + Math.sin(this._walkCycle) * 0.08 * speedNorm;
        rig.pelvis.rotation.z = (pr ? pr.z : 0) + Math.cos(this._walkCycle) * 0.055 * speedNorm;
      }

      // Torso bob, crouch drop, stagger/surge lean, recoil kick & directional hit flinch
      const bob =
        Math.abs(Math.cos(this._walkCycle)) * (isBoss ? 0.095 : 0.045) * speedNorm +
        idleBreath * (isBoss ? 0.015 : 0.008);
      const crouchDrop = crouch * 0.285;
      rig.bodyGroup.position.y = baseBodyPosY + bob - crouchDrop;
      rig.bodyGroup.position.z =
        (rig.bodyGroup.userData.basePosition ? rig.bodyGroup.userData.basePosition.z : 0) -
        this._bodyRecoilX * (isBoss ? 0.10 : 0.04);

      const staggerLean = this.state === 'stagger' ? -0.24 : 0;
      const surgeLean = this._shockDashTimer > 0 ? 0.30 : 0;
      const telegraphLean = this.state === 'telegraph' ? (id === 'sniper_stalker' ? 0.14 : 0.08) : 0;
      const crouchForwardLean = crouch * 0.18;
      const recoilBodyPitch = -this._bodyRecoilX * (isBoss ? 0.075 : 0.12);
      const flinchPitch = -this._hitFlinch * (isBoss ? 0.07 : 0.22);
      const targetBodyRotX =
        staggerLean + surgeLean + telegraphLean + crouchForwardLean + recoilBodyPitch + flinchPitch;
      rig.bodyGroup.rotation.x += (targetBodyRotX - rig.bodyGroup.rotation.x) * (1 - Math.exp(-13 * dt));
      rig.bodyGroup.rotation.z +=
        (this._hitSideBias * this._hitFlinch * (isBoss ? 0.06 : 0.18) - rig.bodyGroup.rotation.z) *
        (1 - Math.exp(-14 * dt));

      // Cranial Head elevation & hit flinch tracking
      if (rig.headGroup) {
        const hr = rig.headGroup.userData.baseRotation;
        rig.headGroup.rotation.x =
          (hr ? hr.x : 0) -
          this._aimPitch * 0.62 -
          crouch * 0.14 -
          this._hitFlinch * (isBoss ? 0.14 : 0.34);
        rig.headGroup.rotation.z =
          (hr ? hr.z : 0) + this._hitSideBias * this._hitFlinch * (isBoss ? 0.12 : 0.26);
        if (isBoss) {
          const bs = rig.headGroup.userData.baseScale;
          const pulse = 1.0 + Math.sin(elapsedTime * (4.5 * this.currentPhase)) * 0.045;
          rig.headGroup.scale.set(
            (bs ? bs.x : 1) * pulse,
            (bs ? bs.y : 1) * pulse,
            (bs ? bs.z : 1) * pulse
          );
        }
      }

      // Weapon arms: elevation aim + damped-spring recoil + specialty stances
      const kickR = this._recoilRight;
      const kickL = this._recoilLeft;
      if (rig.rightArm) {
        const br = rig.rightArm.userData.baseRotation;
        const baseX = br ? br.x : 0;
        if (id === 'mortar_artillery') {
          const elev = (this.state === 'telegraph' ? -0.64 : -0.26) - this._aimPitch * 0.25;
          rig.rightArm.rotation.x = baseX + elev - kickR * 0.26;
        } else if (isShieldWalker) {
          const dualKick = Math.abs(kickR) > Math.abs(kickL) ? kickR : kickL;
          rig.rightArm.rotation.x =
            baseX - this._aimPitch - dualKick * 0.22 + Math.sin(elapsedTime * 2.4 + this._hoverSeed) * 0.022;
        } else {
          rig.rightArm.rotation.x =
            baseX -
            this._aimPitch -
            kickR * (isBoss ? 0.16 : 0.24) +
            Math.sin(elapsedTime * 2.4 + this._hoverSeed) * 0.024;
        }
      }
      if (rig.leftArm) {
        const br = rig.leftArm.userData.baseRotation;
        const baseX = br ? br.x : 0;
        const baseY = br ? br.y : 0;
        if (isShieldWalker) {
          const braceX = this.state === 'telegraph' || this._shieldFlashTimer > 0 ? -0.18 : 0.02;
          const braceY = this._shieldFlashTimer > 0 ? -0.18 : 0;
          rig.leftArm.rotation.x += (baseX + braceX - rig.leftArm.rotation.x) * (1 - Math.exp(-11 * dt));
          rig.leftArm.rotation.y += (baseY + braceY - rig.leftArm.rotation.y) * (1 - Math.exp(-11 * dt));
        } else if (id === 'vanguard_assassin') {
          rig.leftArm.rotation.x = baseX - 0.30 - this._aimPitch * 0.7 - kickL * 0.42;
        } else if (isBoss || id === 'void_warper') {
          rig.leftArm.rotation.x =
            baseX -
            this._aimPitch -
            kickL * (isBoss ? 0.16 : 0.24) -
            Math.sin(elapsedTime * 2.4 + this._hoverSeed) * 0.02;
        } else {
          rig.leftArm.rotation.x = baseX + Math.sin(this._walkCycle) * 0.26 * speedNorm - kickR * 0.14;
        }
      }

      // Dynamic ShieldFrame bracing on hit/telegraph (enforcer, warden, sentinel, aegis)
      if (rig.shieldFrame) {
        const sr = rig.shieldFrame.userData.baseRotation;
        const sp = rig.shieldFrame.userData.basePosition;
        const flashFactor = Math.min(1, this._shieldFlashTimer / 0.25);
        const targetBraceZ = (sr ? sr.z : 0) + (this.state === 'telegraph' ? 0.08 : 0) + flashFactor * 0.14;
        rig.shieldFrame.rotation.z += (targetBraceZ - rig.shieldFrame.rotation.z) * (1 - Math.exp(-14 * dt));
        if (sp) {
          rig.shieldFrame.position.z = sp.z - flashFactor * 0.06;
        }
      }

      // Independent WeaponSlide & Multi-Barrel Blowback (L/R isolated!)
      const slideStroke = isBoss ? 0.24 : id === 'sniper_stalker' ? 0.12 : 0.14;
      this._applySlideRecoil(rig.weaponSlide, slideStroke, kickR, tremor);
      this._applySlideRecoil(rig.leftWeaponSlide, isBoss ? 0.24 : 0.14, kickL, tremor);

      if (rig.barrelSlides && rig.barrelSlides.length > 0) {
        const useSplit = isShieldWalker && rig.barrelSlides.length >= 2;
        for (let i = 0; i < rig.barrelSlides.length; i++) {
          const slide = rig.barrelSlides[i];
          const sName = slide.name || '';
          const bRecoil = useSplit
            ? /_L\b|Left/i.test(sName) || (i === 0 && !/_R\b/i.test(sName))
              ? kickL
              : kickR
            : kickR;
          this._applySlideRecoil(slide, id === 'sniper_stalker' ? 0.18 : 0.15, bRecoil, tremor);
        }
      }

      // HeatVents flaring on sniper lock / overload / assassin strike
      if (rig.heatVents && rig.heatVents.length > 0) {
        const flareTarget =
          this._overloadActive || this.state === 'telegraph' || this.state === 'attack'
            ? 1.0
            : Math.min(1, this._recoilShake);
        for (let i = 0; i < rig.heatVents.length; i++) {
          const hv = rig.heatVents[i];
          const br = hv.userData.baseRotation;
          const sideSign = /_L\b|_1\b/i.test(hv.name || '') || i % 2 === 0 ? 1 : -1;
          const openYaw = (br ? br.y : 0) + sideSign * flareTarget * 0.36;
          const openPitch = (br ? br.x : 0) + flareTarget * 0.20;
          hv.rotation.y += (openYaw - hv.rotation.y) * (1 - Math.exp(-12 * dt));
          hv.rotation.x += (openPitch - hv.rotation.x) * (1 - Math.exp(-12 * dt));
        }
      }

      // Singularity / Containment rings spinning (volatile_rusher, void_warper + bosses)
      const isPullSurge = this._singularityPullTimer > 0;
      const ringBoost =
        (isBoss ? (this.currentPhase === 3 ? 3.2 : this.currentPhase === 2 ? 2.0 : 1.0) : 1.25) *
        (this._phaseShieldTimer > 0 ? 2.1 : 1.0) *
        (isPullSurge ? 2.8 : 1.0) *
        (this._overloadActive || this._blinkTelegraphTimer > 0 ? 2.4 : 1.0);
      for (let i = 0; i < rig.coreRings.length; i++) {
        const ring = rig.coreRings[i];
        const dir = i % 2 === 0 ? 1 : -1;
        ring.rotation.y += dir * (0.9 + i * 0.38) * ringBoost * dt;
        ring.rotation.z += -dir * (0.45 + i * 0.22) * ringBoost * dt;
      }
    }

    // 3. Shared Boss Specialty Gimmicks (Rotary Barrels, CoreShutter, MissilePods, WingShieldFins, WingCores)
    if (isBoss) {
      const isPullSurgeBoss = this._singularityPullTimer > 0;
      const targetRotarySpeed =
        id === 'aegis_overlord_boss'
          ? (this.state === 'telegraph' || this.state === 'attack' ? 32.0 : 20.0) * this._phaseSpeedMult
          : this.state === 'telegraph' || this.state === 'attack'
          ? 20.0 * this._phaseFireMult
          : 2.8 * this._phaseSpeedMult;
      this._rotorSpeed += (targetRotarySpeed - this._rotorSpeed) * (1 - Math.exp(-6.5 * dt));
      const rotDelta = this._rotorSpeed * dt;
      for (let i = 0; i < rig.rotors.length; i++) {
        const rot = rig.rotors[i];
        const br = rot.userData.baseRotation;
        const spinSign = i % 2 === 0 ? 1 : -1;
        // Rotors modeled tilted by pi/2 spin around local Y; un-rotated rotors spin around local Z
        if (br && Math.abs(br.x) > 0.7) {
          rot.rotateY(spinSign * rotDelta);
        } else {
          rot.rotation.z += spinSign * rotDelta;
        }
      }

      // CoreShutter iris pulse & counter-spin (COLOSSUS-IV & TRANSCENDENT-OMEGA)
      if (rig.coreShutter) {
        const activeCore =
          this._coreExposedTimer > 0 ||
          this.state === 'telegraph' ||
          this.state === 'attack' ||
          isPullSurgeBoss;
        const openScale = activeCore ? 1.18 + Math.sin(elapsedTime * 12) * 0.07 : 0.94;
        const bs = rig.coreShutter.userData.baseScale;
        rig.coreShutter.scale.set(
          (bs ? bs.x : 1) * openScale,
          (bs ? bs.y : 1) * openScale,
          bs ? bs.z : 1
        );
        rig.coreShutter.rotation.z += (activeCore ? 2.6 : 0.5) * dt;
      }

      // Shoulder MissileCitadel hatches / Floating Monolith Pylons
      if (rig.missilePods && rig.missilePods.length > 0) {
        const isSalvo =
          id === 'cyber_mech_boss'
            ? this._bossActivePattern === 'homing_missiles' ||
              this._bossActivePattern === 'molten_fan' ||
              this._bossActivePattern === 'spiral_barrage'
            : this._bossActivePattern === 'void_lance_fan' ||
              this._bossActivePattern === 'emp_blackout' ||
              isPullSurgeBoss;
        const hatchOpen = (this.state === 'telegraph' || this.state === 'attack') && isSalvo ? 0.38 : 0;
        for (let i = 0; i < rig.missilePods.length; i++) {
          const pod = rig.missilePods[i];
          const br = pod.userData.baseRotation;
          const bp = pod.userData.basePosition;
          const baseRotX = br ? br.x : 0;
          pod.rotation.x += (baseRotX - hatchOpen - pod.rotation.x) * (1 - Math.exp(-10 * dt));
          if (id === 'transcendent_omega_boss' && bp) {
            pod.position.y = bp.y + Math.sin(elapsedTime * 3.0 + i * Math.PI) * 0.16;
          }
        }
      }

      // AEGIS-IX dorsal WingShieldFins flare + OMEGA monolith float + WingCores rotation
      if (rig.wingShieldFins && rig.wingShieldFins.length > 0) {
        const flare =
          this._phaseShieldTimer > 0 ||
          this._bossActivePattern === 'orbital_laser_sweep' ||
          this._bossActivePattern === 'hazard_barrage' ||
          this._bossActivePattern === 'emp_blackout' ||
          this.state === 'telegraph'
            ? 1.0
            : 0.0;
        for (let i = 0; i < rig.wingShieldFins.length; i++) {
          const fin = rig.wingShieldFins[i];
          const br = fin.userData.baseRotation;
          const bp = fin.userData.basePosition;
          const sideSign = /_L\b|_1\b/i.test(fin.name || '') || i % 2 === 0 ? 1 : -1;
          const targetRotY = (br ? br.y : 0) + sideSign * flare * 0.26;
          const targetRotZ = (br ? br.z : 0) + sideSign * flare * 0.14;
          fin.rotation.y += (targetRotY - fin.rotation.y) * (1 - Math.exp(-8 * dt));
          fin.rotation.z += (targetRotZ - fin.rotation.z) * (1 - Math.exp(-8 * dt));
          if (id === 'transcendent_omega_boss' && bp) {
            fin.position.y = bp.y + Math.cos(elapsedTime * 2.6 + i * Math.PI) * 0.18;
          }
        }
      }

      if (id === 'aegis_overlord_boss') {
        const coreL = rig.wingCoreL;
        if (coreL && this._wingCoreHpL > 0 && coreL.userData && coreL.userData.haloMesh) {
          coreL.userData.haloMesh.rotation.z += dt * 3.2 * this._phaseSpeedMult;
          const pL = 1.0 + Math.sin(elapsedTime * 6.5) * 0.08;
          coreL.scale.setScalar(pL);
        } else if (coreL && this._wingCoreDestroyedL) {
          coreL.scale.setScalar(0.82);
        }
        const coreR = rig.wingCoreR;
        if (coreR && this._wingCoreHpR > 0 && coreR.userData && coreR.userData.haloMesh) {
          coreR.userData.haloMesh.rotation.z -= dt * 3.2 * this._phaseSpeedMult;
          const pR = 1.0 + Math.cos(elapsedTime * 6.5) * 0.08;
          coreR.scale.setScalar(pR);
        } else if (coreR && this._wingCoreDestroyedR) {
          coreR.scale.setScalar(0.82);
        }
      }
    }

    // 4. Diegetic world-space health bar faces player horizontally
    if (rig.healthBarBg && rig.healthBarBg.visible) {
      const toPlayerYaw = Math.atan2(
        playerPos.x - this.position.x,
        playerPos.z - this.position.z
      );
      rig.healthBarBg.rotation.y = toPlayerYaw - this._yaw;
    }
  }

  /**
   * Manage emissive hit-flash, thermal-amber blast shield flash, and Boss phase shield barrier.
   * @private
   */
  _updateHitAndShieldFlashes(dt, elapsedTime) {
    // Decay directional hit-flinch (applied smoothly inside _updateRigAnimation)
    if (this._hitFlinch > 0) {
      this._hitFlinch = Math.max(0, this._hitFlinch - dt * 8.5);
    }
    if (this._hitSideBias !== 0) {
      this._hitSideBias *= Math.exp(-7.0 * dt);
      if (Math.abs(this._hitSideBias) < 1e-3) this._hitSideBias = 0;
    }

    if (this._hitFlashTimer > 0) {
      this._hitFlashTimer = Math.max(0, this._hitFlashTimer - dt);
      const t = Math.min(1, this._hitFlashTimer / 0.12);
      const mats = this.rig.flashMaterials;
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i];
        if (t > 0.01) {
          m.emissive.lerpColors(m.userData.baseEmissive, FLASH_COLOR, t);
          m.emissiveIntensity = m.userData.baseEmissiveIntensity + t * 4.4;
        } else {
          m.emissive.copy(m.userData.baseEmissive);
          m.emissiveIntensity = m.userData.baseEmissiveIntensity;
        }
      }
    }

    // Energy Shield ripple & Boss Phase Barrier glow
    const shield = this.rig.shieldMesh;
    if (shield && shield.material) {
      const sMat = shield.material;
      if (this._shieldFlashTimer > 0) {
        this._shieldFlashTimer = Math.max(0, this._shieldFlashTimer - dt);
      }
      const flashT = Math.min(1, this._shieldFlashTimer / 0.28);

      if (this.archetype.isBoss) {
        const active = this._phaseShieldTimer > 0 || this._turretShieldActive;
        shield.visible = active;
        if (active) {
          const fade = this._phaseShieldTimer > 0 ? Math.min(1, this._phaseShieldTimer / 0.6) : 1.0;
          const pulse = (this._turretShieldActive ? 0.34 : 0.42) + Math.sin(elapsedTime * 14) * 0.1;
          sMat.opacity = (pulse + flashT * 0.42) * fade;
          const bossFlashCol =
            this.archetype.id === 'aegis_overlord_boss' ? CYAN_SHIELD_FLASH_COLOR : SHIELD_FLASH_COLOR;
          sMat.emissive.lerpColors(sMat.userData.baseEmissive, bossFlashCol, flashT);
          sMat.emissiveIntensity = (this._turretShieldActive ? 1.85 : 2.2) + flashT * 3.5;
          shield.rotation.y += dt * 1.4;
        }
      } else {
        // Heavy Enforcer / Rail Warden / Abyss Sentinel welded blast shield
        const idlePulse = 0.72 + Math.sin(elapsedTime * 5.0 + this._hoverSeed) * 0.06;
        sMat.opacity = Math.min(1, idlePulse + flashT * 0.25);
        const unitFlashCol =
          this.archetype.id === 'rail_warden' || this.archetype.id === 'abyss_sentinel'
            ? CYAN_SHIELD_FLASH_COLOR
            : SHIELD_FLASH_COLOR;
        sMat.emissive.lerpColors(sMat.userData.baseEmissive, unitFlashCol, flashT);
        sMat.emissiveIntensity = 1.45 + flashT * 3.8;
      }
    }

    // Dynamic state emissive tints (Overload Frenzy, Teleport, Shock Thruster Surge, Rail Warden Cyan Charge)
    const mats = this.rig ? this.rig.flashMaterials : null;
    if (mats && this._hitFlashTimer <= 0) {
      if (this._overloadActive) {
        this._customTintActive = true;
        const pulse = 0.55 + 0.45 * Math.abs(Math.sin(elapsedTime * 20));
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (m.userData.baseEmissive) {
            m.emissive.lerpColors(m.userData.baseEmissive, OVERLOAD_GLOW_COLOR, pulse * 0.85);
            m.emissiveIntensity = (m.userData.baseEmissiveIntensity || 1.0) + pulse * 3.2;
          }
        }
      } else if (this._blinkTelegraphTimer > 0) {
        this._customTintActive = true;
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (m.userData.baseEmissive) {
            m.emissive.lerpColors(m.userData.baseEmissive, TELEPORT_GLOW_COLOR, 0.85);
            m.emissiveIntensity = (m.userData.baseEmissiveIntensity || 1.0) + 3.0;
          }
        }
      } else if (this.archetype.id === 'shock_breacher' && this._shockDashTimer > 0) {
        this._customTintActive = true;
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(elapsedTime * 26));
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (m.userData.baseEmissive) {
            m.emissive.lerpColors(m.userData.baseEmissive, SHOCK_SURGE_COLOR, 0.72 * pulse);
            m.emissiveIntensity = (m.userData.baseEmissiveIntensity || 1.0) + 2.4 * pulse;
          }
        }
      } else if (this.archetype.id === 'rail_warden' && this.state === 'telegraph') {
        this._customTintActive = true;
        const chargeT = Math.max(0, Math.min(1, 1 - this._telegraphTimer / Math.max(0.05, this.archetype.telegraphTime)));
        const spike = chargeT > 0.72 ? 1.0 : 0.35 + chargeT * 0.65;
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (m.userData.baseEmissive) {
            m.emissive.lerpColors(m.userData.baseEmissive, RAIL_CHARGE_COLOR, 0.82 * spike);
            m.emissiveIntensity = (m.userData.baseEmissiveIntensity || 1.0) + (chargeT > 0.72 ? 4.2 : 2.2 * chargeT);
          }
        }
      } else if (this._customTintActive) {
        this._customTintActive = false;
        for (let i = 0; i < mats.length; i++) {
          const m = mats[i];
          if (m.userData.baseEmissive) {
            m.emissive.copy(m.userData.baseEmissive);
            m.emissiveIntensity = m.userData.baseEmissiveIntensity || 0;
          }
        }
      }
    }
  }

  /** @private */
  _updateHealthBar() {
    if (this.archetype.isBoss || !this.rig.healthBarBg || !this.rig.healthBarFill) return;
    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    this.rig.healthBarBg.visible = ratio < 0.999 && this.isAlive;
    this.rig.healthBarFill.scale.x = Math.max(0.001, ratio);
  }

  /**
   * Collapse, flare emissive burnout, and dissolve cleanly before removing from scene.
   * @private
   */
  _updateDeathAnimation(dt) {
    this._deathTimer += dt;
    const t = Math.min(1, this._deathTimer / this._deathDuration);
    const easeIn = t * t;

    // Dramatic collapse backward + knee-buckling slump + scale dissolve
    this.rig.bodyGroup.rotation.x = -easeIn * (this.archetype.isBoss ? 1.15 : 1.42);
    this.rig.bodyGroup.rotation.z = easeIn * 0.38 * this._strafeDir;
    this.rig.root.position.y = this.position.y - easeIn * (this.archetype.isFlying ? 0.55 : 0.32);

    if (!this.archetype.isFlying) {
      const kBuckle = Math.min(1.0, t * 2.2);
      const lShin = this.rig.leftShin;
      const rShin = this.rig.rightShin;
      const lThigh = this.rig.leftThigh || this.rig.leftLeg;
      const rThigh = this.rig.rightThigh || this.rig.rightLeg;
      if (lThigh) lThigh.rotation.x = (lThigh.userData.baseRotation ? lThigh.userData.baseRotation.x : 0) - 0.35 * kBuckle;
      if (rThigh) rThigh.rotation.x = (rThigh.userData.baseRotation ? rThigh.userData.baseRotation.x : 0) - 0.24 * kBuckle;
      if (lShin) lShin.rotation.x = (lShin.userData.baseRotation ? lShin.userData.baseRotation.x : 0) + 1.05 * kBuckle;
      if (rShin) rShin.rotation.x = (rShin.userData.baseRotation ? rShin.userData.baseRotation.x : 0) + 0.85 * kBuckle;
    }

    const dissolveScale =
      (t > 0.45 ? Math.max(0.01, 1 - (t - 0.45) / 0.55) : 1.0) * (this.scaleMult || 1.0);
    this.rig.root.scale.set(dissolveScale, dissolveScale, dissolveScale);

    // Hot emissive overload fading to dark ash
    const burnout = t < 0.35 ? 3.5 * (1 - t / 0.35) : 0;
    const mats = this.rig.flashMaterials;
    for (let i = 0; i < mats.length; i++) {
      mats[i].emissiveIntensity = burnout;
    }

    if (this._deathTimer >= this._deathDuration) {
      if (this._pooled) {
        this.deactivate();
      } else {
        this.dispose();
      }
    }
  }

  /**
   * Sync pre-allocated center & headPosition vectors from world transforms.
   * @private
   */
  _syncCachedPositions() {
    this.center.set(
      this.position.x,
      this.position.y + this.archetype.height * 0.52,
      this.position.z
    );
    if (this.rig.headAnchor) {
      this.rig.headAnchor.getWorldPosition(this.headPosition);
    } else {
      this.headPosition.set(
        this.position.x,
        this.position.y + this.archetype.headHeight,
        this.position.z
      );
    }
  }

  /**
   * Remove enemy rig from scene and dispose per-instance materials/geometries.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.isRemoved = true;
    this.isAlive = false;
    if (this.rig) {
      if (this.rig.root && this.rig.root.parent) {
        this.rig.root.parent.remove(this.rig.root);
      }
      if (typeof this.rig.dispose === 'function') {
        this.rig.dispose();
      }
    }
  }
}
  __exports.Enemy = Enemy;
});
