// Module: src/ai/EnemyAI.js
__define("src/ai/EnemyAI.js", (__exports, __require) => {
const { EVENTS } = __require("src/config/constants.js");

const GRAVITY = 26.0;
const TWO_PI = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const FLASH_COLOR = new THREE.Color(0xffffff);
const SHIELD_FLASH_COLOR = new THREE.Color(0xffd080);
const PHASE2_RING_COLOR = new THREE.Color(0xff7b00);
const PHASE3_RING_COLOR = new THREE.Color(0xff1e00);

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
 * flanking, hover flight navigation, procedural rig articulation, sniper lock-on
 * crimson laser telegraph, directional blast shields, and multi-phase boss overdrive.
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

    // Flying drone starts aloft above floor
    if (!isDormant && archetype.isFlying) {
      const floorY = collisionWorld.getGroundHeightAt(this.position.x, this.position.z, 20);
      this.position.y = Math.max(this.position.y, floorY + 2.3);
    }

    // Build sculpted 3D rig & mount into scene/enemyGroup
    this.rig = modelFactory.createEnemyRig(archetype);
    this.root = this.rig.root;
    this.rig.root.position.copy(this.position);
    this.rig.root.visible = !isDormant;
    this.scene.add(this.rig.root);

    // Orientation & procedural animation accumulators
    this._yaw = 0;
    this._walkCycle = Math.random() * TWO_PI;
    this._hoverSeed = Math.random() * TWO_PI;
    this._rotorSpeed = archetype.isFlying ? 28.0 : 4.5;
    this._recoilAnim = 0;
    this._spawnTimer = 0.52;
    this._deathTimer = 0;
    this._deathDuration = archetype.isBoss ? 1.15 : 0.45;
    this._deathTiltAxis = new THREE.Vector3(1, 0, 0);

    // Visual hit-flash & shield feedback timers
    this._hitFlashTimer = 0;
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

    // Boss phase dynamic combat multipliers
    this._phaseSpeedMult = 1.0;
    this._phaseFireMult = 1.0;
    this._phaseBurstCount = archetype.isBoss ? 3 : 1;
    this._phaseName =
      this.bossPhases && this.bossPhases.length > 0 ? this.bossPhases[0].name : '';

    // Sniper locked target point (locks smoothly then freezes final 0.2s for dash counterplay)
    this._lockedAimPoint = new THREE.Vector3();
    this._sniperLockFrozen = false;
    this.isSniperLocking = false;

    // Pre-allocated hit spheres (zero-GC getHitSpheres) — +15% player-favored hitbox expansion
    const HITBOX_SCALE = 1.15;
    const headR = archetype.headRadius * 1.18 * HITBOX_SCALE;
    const bodyR = archetype.radius * 0.94 * HITBOX_SCALE;
    const lowerR = archetype.radius * 0.85 * HITBOX_SCALE;
    const shieldR = archetype.isBoss ? 1.68 : 0.68;

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

    this._hitSpheres3 = [this._sphereHead, this._sphereTorso, this._sphereLower];
    this._hitSpheres4 = [
      this._sphereHead,
      this._sphereTorso,
      this._sphereLower,
      this._sphereShield,
    ];

    // Pre-allocated scratch vectors & raycast structs (strictly zero-GC update)
    this._eyePos = new THREE.Vector3();
    this._toPlayer = new THREE.Vector3();
    this._moveDir = new THREE.Vector3();
    this._sideDir = new THREE.Vector3();
    this._probeDir = new THREE.Vector3();
    this._muzzleWorld = new THREE.Vector3();
    this._shotDir = new THREE.Vector3();
    this._laserStartLocal = new THREE.Vector3();
    this._laserEndLocal = new THREE.Vector3();
    this._laserDirLocal = new THREE.Vector3();
    this._laserEndWorld = new THREE.Vector3();
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
    this._spawnTimer = 0.52;
    this._deathTimer = 0;

    this._hitFlashTimer = 0;
    this._shieldFlashTimer = 0;
    this._phaseShieldTimer = 0;
    this.markedTimer = 0;
    this.eliteAffix = null;
    this.isSupplyDrone = false;
    this.lastHitWasMelee = false;
    this.displayName = this.archetype ? this.archetype.name : '';
    if (this.group) this.group.scale.set(1, 1, 1);

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
    this._phaseBurstCount = this.archetype.isBoss ? 3 : 1;
    this._phaseName =
      this.bossPhases && this.bossPhases.length > 0 ? this.bossPhases[0].name : '';

    this._lockedAimPoint.set(0, 0, 0);
    this._sniperLockFrozen = false;
    this.isSniperLocking = false;

    const rig = this.rig;
    if (rig) {
      rig.root.position.copy(this.position);
      rig.root.rotation.set(0, 0, 0);
      rig.root.scale.set(1, 1, 1);
      rig.root.visible = true;

      rig.bodyGroup.rotation.set(0, 0, 0);
      rig.bodyGroup.position.set(0, this.archetype.isFlying ? 0.55 : 0, 0);

      if (rig.headGroup) {
        rig.headGroup.scale.set(1, 1, 1);
        rig.headGroup.rotation.set(0, 0, 0);
      }
      if (rig.leftLeg) rig.leftLeg.rotation.set(0, 0, 0);
      if (rig.rightLeg) rig.rightLeg.rotation.set(0, 0, 0);
      if (rig.leftArm) rig.leftArm.rotation.set(0, 0, 0);
      if (rig.rightArm) {
        rig.rightArm.rotation.set(0, 0, 0);
        if (this.archetype.isFlying) {
          rig.rightArm.position.z = 0.12;
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
    this._hideLaser();
    if (this.rig) {
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
      this._sphereTorso.center.set(px, py + 0.54, pz);
      this._sphereLower.center.set(px, py + 0.36, pz);
    } else {
      this._sphereTorso.center.set(px, py + h * 0.62, pz);
      this._sphereLower.center.set(px, py + h * 0.28, pz);
    }

    if (this.archetype.hasShield) {
      if (this.archetype.isBoss) {
        if (this._phaseShieldTimer > 0 && this.rig.shieldMesh) {
          this._sphereShield.center.set(px, py + 2.02, pz);
          return this._hitSpheres4;
        }
        return this._hitSpheres3;
      }

      // Heavy Enforcer curved frontal riot shield positioned directly on shieldMesh
      if (this.rig.shieldMesh) {
        this.rig.shieldMesh.getWorldPosition(this._sphereShield.center);
        this._sphereShield.center.y -= 0.06;
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
      const dealt = Math.max(1, Math.round(amount * 0.25));
      this.hp = Math.max(1, this.hp - dealt);
      this._shieldFlashTimer = 0.28;
      this._updateHealthBar();

      if (knockbackDir) {
        this.velocity.x += knockbackDir.x * 1.4;
        this.velocity.z += knockbackDir.z * 1.4;
      }

      return { dealt, killed: false, blockedByShield: true };
    }

    // Full damage resolution (+25% if marked by T-4 Arc Rivet)
    const markMult = this.markedTimer > 0 ? 1.25 : 1.0;
    const dealt = Math.max(1, amount * markMult);
    this.hp = Math.max(0, this.hp - dealt);
    this.lastHitWasHeadshot = Boolean(isHeadshot);
    this.lastHitWasMelee = Boolean(options && options.isMelee);
    this._hitFlashTimer = isHeadshot ? 0.14 : 0.10;
    this._updateHealthBar();

    // Knockback impulse (heavier units resist pushback)
    if (knockbackDir) {
      const kbScale = this.archetype.isBoss
        ? 0.06
        : this.archetype.id === 'heavy_enforcer'
        ? 0.32
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
      this._staggerCooldown <= 0 &&
      (isHeadshot || dealt >= 38 || (options && options.isExplosion))
    ) {
      this.state = 'stagger';
      this._staggerTimer = this.archetype.id === 'heavy_enforcer' ? 0.15 : 0.22;
      this._staggerCooldown = 1.45;
      this._hideLaser();
    }

    // Boss Multi-Phase Transition Check
    if (this.archetype.isBoss && this.bossPhases && this.hp > 0) {
      this._checkBossPhaseTransition();
    }

    // Death Check
    if (this.hp <= 0) {
      this._enterDeathState(Boolean(isHeadshot), knockbackDir);
      return { dealt, killed: true, blockedByShield: false };
    }

    return { dealt, killed: false, blockedByShield: false };
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
          this._phaseShieldTimer = 3.8;
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
            callout: p.callout,
            escorts: p.escorts || [],
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
    this._hideLaser();

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
    if (this._recoilAnim > 0) {
      this._recoilAnim = Math.max(0, this._recoilAnim - clampedDt * 6.5);
    }
    if (this._phaseShieldTimer > 0) {
      this._phaseShieldTimer = Math.max(0, this._phaseShieldTimer - clampedDt);
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
      this.rig.root.scale.set(0.35 + 0.65 * ease, 0.2 + 0.8 * ease, 0.35 + 0.65 * ease);
      this._yaw = targetYaw;
      this.rig.root.rotation.y = this._yaw;

      if (this._spawnTimer <= 0) {
        this.rig.root.scale.set(1, 1, 1);
        this.state = 'advance';
      }
      this._syncCachedPositions();
      this._updateRigAnimation(clampedDt, elapsedTime, 0, playerPos);
      return;
    }

    // Smooth yaw turn toward player (faster for drone & sniper, weighty for heavy/boss)
    const turnRate = this.archetype.isFlying
      ? 9.0
      : this.archetype.isBoss
      ? 3.8 * this._phaseSpeedMult
      : this.archetype.id === 'heavy_enforcer'
      ? 4.6
      : 7.4;
    const yawDiff = wrapAngle(targetYaw - this._yaw);
    this._yaw += yawDiff * (1 - Math.exp(-turnRate * clampedDt));

    const moveSpeed = this.archetype.speed * this._phaseSpeedMult;
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

        // Transition into tactical strafe once within attack range with clear LOS
        if (this._hasLOS && totalDist <= this.archetype.attackRange * 0.94) {
          this.state = 'strafe';
        }
        break;
      }

      case 'strafe': {
        this._hideLaser();

        // Lost LOS or player escaped attack range -> flank/advance!
        if (!this._hasLOS || totalDist > this.archetype.attackRange * 1.06) {
          this.state = 'advance';
          break;
        }

        // Periodic strafe direction reversal
        this._strafeSwitchTimer -= clampedDt;
        if (this._strafeSwitchTimer <= 0) {
          this._strafeDir = -this._strafeDir;
          this._strafeSwitchTimer = 1.6 + Math.random() * 1.9;
          // Troopers & snipers occasionally pause briefly to brace/aim
          if (
            (this.archetype.id === 'tactical_trooper' || this.archetype.id === 'sniper_stalker') &&
            Math.random() < 0.32
          ) {
            this._coverPauseTimer = 0.45 + Math.random() * 0.4;
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
            this.archetype.id === 'heavy_enforcer'
              ? 0.42
              : this.archetype.id === 'sniper_stalker'
              ? 0.55
              : 0.82;

          let vx = fwdX * radialWeight + sideX * strafeWeight;
          let vz = fwdZ * radialWeight + sideZ * strafeWeight;
          const mag = Math.hypot(vx, vz);
          if (mag > 0.01) {
            const strafeSpd = moveSpeed * (this.archetype.id === 'sniper_stalker' ? 0.65 : 0.78);
            vx = (vx / mag) * strafeSpd;
            vz = (vz / mag) * strafeSpd;

            // Keep elevated snipers from blindly strafing off catwalk ledges
            if (this.archetype.id === 'sniper_stalker' && this.position.y > 1.2) {
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
          this._telegraphTimer =
            this.archetype.telegraphTime / (this.archetype.isBoss ? Math.sqrt(this._phaseFireMult) : 1.0);
          this._sniperLockFrozen = false;
          this._lockedAimPoint.copy(playerEyePos);
          this._lockedAimPoint.y -= 0.16;
        }
        break;
      }

      case 'telegraph': {
        this._telegraphTimer -= clampedDt;
        const totalTelegraph =
          this.archetype.telegraphTime / (this.archetype.isBoss ? Math.sqrt(this._phaseFireMult) : 1.0);
        const progress = Math.max(0, Math.min(1, 1 - this._telegraphTimer / Math.max(0.05, totalTelegraph)));

        // Drones keep lightly drifting; ground units brace during telegraph
        if (this.archetype.isFlying && horizDist > 0.01) {
          const sideX = -(dz / horizDist) * this._strafeDir;
          const sideZ = (dx / horizDist) * this._strafeDir;
          desiredVx = sideX * moveSpeed * 0.45;
          desiredVz = sideZ * moveSpeed * 0.45;
        } else if (this.archetype.id === 'heavy_enforcer' && horizDist > 6) {
          desiredVx = (dx / horizDist) * moveSpeed * 0.35;
          desiredVz = (dz / horizDist) * moveSpeed * 0.35;
        }

        // Deadeye Recon visible crimson lock-on laser telegraph!
        if (this.archetype.id === 'sniper_stalker') {
          if (progress < 0.78) {
            // Smoothly tracks player chest during first 78% of lock-on
            this._lockedAimPoint.x += (playerEyePos.x - this._lockedAimPoint.x) * (1 - Math.exp(-10 * clampedDt));
            this._lockedAimPoint.y += (playerEyePos.y - 0.18 - this._lockedAimPoint.y) * (1 - Math.exp(-10 * clampedDt));
            this._lockedAimPoint.z += (playerEyePos.z - this._lockedAimPoint.z) * (1 - Math.exp(-10 * clampedDt));
          } else {
            // Freeze lock for final ~0.20s so dash/slide counterplay feels fair & crisp!
            this._sniperLockFrozen = true;
          }
          this.isSniperLocking = true;
          this._updateSniperLaser(progress, elapsedTime);
        }

        // Abort telegraph if player completely breaks LOS before final lock
        if (!this._hasLOS && progress < 0.75) {
          this._hideLaser();
          this.state = 'advance';
          break;
        }

        if (this._telegraphTimer <= 0) {
          this.state = 'attack';
          this._burstRemaining = this._getBurstCount();
          this._burstShotTimer = 0;
        }
        break;
      }

      case 'attack': {
        // Drones continue drifting while firing bursts
        if (this.archetype.isFlying && horizDist > 0.01) {
          desiredVx = -(dz / horizDist) * this._strafeDir * moveSpeed * 0.55;
          desiredVz = (dx / horizDist) * this._strafeDir * moveSpeed * 0.55;
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
   * Smooth 3D hovering movement with altitude control & wall collision for Rusher Drone.
   * @private
   */
  _integrateFlyingMovement(desiredVx, desiredVz, dt, elapsedTime, playerEyePos) {
    const floorY = this.collisionWorld.getGroundHeightAt(
      this.position.x,
      this.position.z,
      this.position.y + 1.2
    );
    const hoverWave = Math.sin(elapsedTime * 3.4 + this._hoverSeed) * 0.28;
    const targetY = Math.max(
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

  /** @private */
  _getBurstCount() {
    switch (this.archetype.id) {
      case 'rusher_drone':
        return 2;
      case 'tactical_trooper':
        return 3;
      case 'cyber_mech_boss':
        return this._phaseBurstCount;
      default:
        return 1;
    }
  }

  /** @private */
  _getBurstInterval() {
    switch (this.archetype.id) {
      case 'rusher_drone':
        return 0.13;
      case 'tactical_trooper':
        return 0.14;
      case 'cyber_mech_boss':
        return Math.max(0.10, 0.19 / this._phaseFireMult);
      default:
        return 0.15;
    }
  }

  /**
   * Compute exact world muzzle origin & projectile trajectory and emit via WaveDirector pool.
   * @private
   */
  _fireShot(playerEyePos, spawnProjectileFn) {
    if (typeof spawnProjectileFn !== 'function') return;

    // Boss alternates between right and left 6-barrel rotary cannons
    let muzzleObj = this.rig.weaponMuzzle;
    if (this.archetype.isBoss && this.rig.leftWeaponMuzzle) {
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

    // Aim point (sniper shoots along its locked telegraph beam; others aim cleanly at player torso/eye)
    if (this.archetype.id === 'sniper_stalker') {
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

    // Subtle tactical spread (sniper is razor accurate; boss rotary barrage fans slightly)
    const spread =
      this.archetype.id === 'sniper_stalker'
        ? 0.004
        : this.archetype.isBoss
        ? 0.042
        : this.archetype.id === 'rusher_drone'
        ? 0.048
        : 0.032;

    if (spread > 0) {
      this._shotDir.x += (Math.random() - 0.5) * spread * 2;
      this._shotDir.y += (Math.random() - 0.5) * spread * 1.3;
      this._shotDir.z += (Math.random() - 0.5) * spread * 2;
      this._shotDir.normalize();
    }

    const projRadius =
      this.archetype.id === 'heavy_enforcer'
        ? 0.18
        : this.archetype.isBoss
        ? 0.16
        : this.archetype.id === 'sniper_stalker'
        ? 0.08
        : 0.09;

    const isSniperBeam = this.archetype.id === 'sniper_stalker';
    this._recoilAnim = 1.0;

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
      laser.material.color.setHex(this._sniperLockFrozen ? 0xff1111 : 0xe62020);
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
   * Procedural articulation for all 5 archetypes (stride legs, recoil arms, banking drone,
   * spinning rotors, rotary plasma barrels, boss orbital shield rings, diegetic health bar).
   * @private
   */
  _updateRigAnimation(dt, elapsedTime, horizSpeed, playerPos) {
    const rig = this.rig;

    // 1. Flying Rusher Drone banking & rapid ducted rotor spin
    if (this.archetype.isFlying) {
      const sinY = Math.sin(this._yaw);
      const cosY = Math.cos(this._yaw);
      const localFwdVel = this.velocity.x * sinY + this.velocity.z * cosY;
      const localRightVel = this.velocity.x * cosY - this.velocity.z * sinY;

      const targetPitch = Math.max(-0.34, Math.min(0.38, localFwdVel * 0.042));
      const targetRoll = Math.max(-0.42, Math.min(0.42, -localRightVel * 0.052));
      const bankBlend = 1 - Math.exp(-8 * dt);
      rig.bodyGroup.rotation.x += (targetPitch - rig.bodyGroup.rotation.x) * bankBlend;
      rig.bodyGroup.rotation.z += (targetRoll - rig.bodyGroup.rotation.z) * bankBlend;
      rig.bodyGroup.position.y = 0.55 + Math.sin(elapsedTime * 5.2 + this._hoverSeed) * 0.06;

      // Spin twin shrouded ducted rotors rapidly
      const rotorSpin = (this.state === 'telegraph' || this.state === 'attack' ? 38 : 26) * dt;
      for (let i = 0; i < rig.rotors.length; i++) {
        rig.rotors[i].rotation.y += i % 2 === 0 ? rotorSpin : -rotorSpin;
      }

      // Chin repeater recoil kick
      rig.rightArm.position.z = 0.12 - this._recoilAnim * 0.09;
    } else {
      // 2. Bipedal Ground Units (Trooper, Heavy Enforcer, Sniper Stalker, Cyber-Mech Boss)
      const speedNorm = Math.min(1.3, horizSpeed / Math.max(1, this.archetype.speed));
      const strideFreq = this.archetype.isBoss
        ? 4.6 * this._phaseSpeedMult
        : this.archetype.id === 'heavy_enforcer'
        ? 5.8
        : 8.6;

      if (speedNorm > 0.08) {
        this._walkCycle += dt * strideFreq * Math.max(0.45, speedNorm);
      }

      const swingAmp =
        (this.archetype.isBoss ? 0.36 : this.archetype.id === 'heavy_enforcer' ? 0.40 : 0.56) *
        speedNorm;
      const stride = Math.sin(this._walkCycle) * swingAmp;
      const bob = Math.abs(Math.cos(this._walkCycle)) * (this.archetype.isBoss ? 0.10 : 0.045) * speedNorm;

      if (rig.leftLeg) rig.leftLeg.rotation.x = stride;
      if (rig.rightLeg) rig.rightLeg.rotation.x = -stride;

      // Subtle torso walk bounce + stagger lean-back
      const staggerLean = this.state === 'stagger' ? -0.22 : 0;
      const telegraphLean = this.state === 'telegraph' ? 0.08 : 0;
      rig.bodyGroup.position.y = bob;
      rig.bodyGroup.rotation.x +=
        (staggerLean + telegraphLean - rig.bodyGroup.rotation.x) * (1 - Math.exp(-12 * dt));

      // Weapon arm recoil & aiming brace
      if (rig.rightArm) {
        const recoilPitch = this._recoilAnim * (this.archetype.isBoss ? 0.14 : 0.22);
        rig.rightArm.rotation.x = -recoilPitch + Math.sin(elapsedTime * 2.4 + this._hoverSeed) * 0.025;
      }
      if (rig.leftArm) {
        if (this.archetype.id === 'heavy_enforcer') {
          // Hold energy riot shield steady & raise slightly when telegraphing/hit
          const brace = this.state === 'telegraph' || this._shieldFlashTimer > 0 ? -0.14 : 0;
          rig.leftArm.rotation.x += (brace - rig.leftArm.rotation.x) * (1 - Math.exp(-10 * dt));
        } else if (this.archetype.isBoss) {
          rig.leftArm.rotation.x = -this._recoilAnim * 0.14;
        } else {
          rig.leftArm.rotation.x = -this._recoilAnim * 0.15;
        }
      }

      // 3. Boss Rotary Plasma Cannons + 3 Holographic Orbital Shield Rings!
      if (this.archetype.isBoss) {
        const targetRotarySpeed =
          this.state === 'telegraph' || this.state === 'attack'
            ? 18.0 * this._phaseFireMult
            : 2.6 * this._phaseSpeedMult;
        this._rotorSpeed += (targetRotarySpeed - this._rotorSpeed) * (1 - Math.exp(-6 * dt));
        for (let i = 0; i < rig.rotors.length; i++) {
          rig.rotors[i].rotation.z += this._rotorSpeed * dt * (i % 2 === 0 ? 1 : -1);
        }

        const ringBoost =
          (this.currentPhase === 3 ? 3.2 : this.currentPhase === 2 ? 2.0 : 1.0) *
          (this._phaseShieldTimer > 0 ? 2.1 : 1.0);
        for (let i = 0; i < rig.coreRings.length; i++) {
          const ring = rig.coreRings[i];
          const dir = i % 2 === 0 ? 1 : -1;
          ring.rotation.y += dir * (0.9 + i * 0.38) * ringBoost * dt;
          ring.rotation.z += -dir * (0.45 + i * 0.22) * ringBoost * dt;
        }

        // Boss cranial reactor breathing pulse
        if (rig.headGroup) {
          const pulse = 1.0 + Math.sin(elapsedTime * (4.5 * this.currentPhase)) * 0.045;
          rig.headGroup.scale.set(pulse, pulse, pulse);
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
    // Emissive damage flash
    if (this._hitFlashTimer > 0) {
      this._hitFlashTimer = Math.max(0, this._hitFlashTimer - dt);
      const t = this._hitFlashTimer / 0.12;
      const mats = this.rig.flashMaterials;
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i];
        if (t > 0.01) {
          m.emissive.lerpColors(m.userData.baseEmissive, FLASH_COLOR, Math.min(1, t));
          m.emissiveIntensity = m.userData.baseEmissiveIntensity + t * 2.8;
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
        const active = this._phaseShieldTimer > 0;
        shield.visible = active;
        if (active) {
          const fade = Math.min(1, this._phaseShieldTimer / 0.6);
          const pulse = 0.42 + Math.sin(elapsedTime * 14) * 0.12;
          sMat.opacity = (pulse + flashT * 0.42) * fade;
          sMat.emissive.lerpColors(sMat.userData.baseEmissive, SHIELD_FLASH_COLOR, flashT);
          sMat.emissiveIntensity = 2.2 + flashT * 3.5;
          shield.rotation.y += dt * 1.4;
        }
      } else {
        // Heavy Enforcer welded thermal-amber blast shield
        const idlePulse = 0.72 + Math.sin(elapsedTime * 5.0 + this._hoverSeed) * 0.06;
        sMat.opacity = Math.min(1, idlePulse + flashT * 0.25);
        sMat.emissive.lerpColors(sMat.userData.baseEmissive, SHIELD_FLASH_COLOR, flashT);
        sMat.emissiveIntensity = 1.45 + flashT * 3.8;
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

    // Dramatic collapse backward + sink + scale dissolve
    this.rig.bodyGroup.rotation.x = -easeIn * (this.archetype.isBoss ? 1.15 : 1.42);
    this.rig.bodyGroup.rotation.z = easeIn * 0.38 * this._strafeDir;
    this.rig.root.position.y = this.position.y - easeIn * (this.archetype.isFlying ? 0.55 : 0.25);

    const dissolveScale = t > 0.45 ? Math.max(0.01, 1 - (t - 0.45) / 0.55) : 1.0;
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
