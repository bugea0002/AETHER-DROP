// Module: src/ai/WaveDirector.js
__define("src/ai/WaveDirector.js", (__exports, __require) => {
const { EVENTS, SCORE_CONFIG, PLAYER_CONFIG, ARENA_CONFIG, MAPS } = __require("src/config/constants.js");
const { ENEMY_ARCHETYPES, WAVES } = __require("src/config/waves.js");
const { EnemyModelFactory } = __require("src/ai/EnemyModelFactory.js");
const { Enemy } = __require("src/ai/EnemyAI.js");

const MAX_PROJECTILES = 64;
const MAX_MORTAR_RINGS = 16;
const MAX_ORBITAL_SWEEPS = 2;
const MAX_HOMING_MISSILES = 8;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const ZERO_SPAWN_POS = new THREE.Vector3(0, 0, 0);

const POOL_CAPACITIES = Object.freeze({
  rusher_drone: 7,
  tactical_trooper: 7,
  heavy_enforcer: 4,
  sniper_stalker: 4,
  cyber_mech_boss: 1,
  interceptor_drone: 6,
  shock_breacher: 5,
  rail_warden: 4,
  mortar_artillery: 4,
  vanguard_assassin: 5,
  aegis_overlord_boss: 1,
  volatile_rusher: 8,
  void_warper: 6,
  void_swarmer: 8,
  abyss_sentinel: 5,
  transcendent_omega_boss: 1,
});

const PROJECTILE_COLORS = Object.freeze({
  rusher_drone: 0xff7722,
  tactical_trooper: 0xff4422,
  heavy_enforcer: 0xff2200,
  sniper_stalker: 0xe63946,
  cyber_mech_boss: 0xff2200,
  interceptor_drone: 0x38bdf8,
  shock_breacher: 0x22d3ee,
  rail_warden: 0x00f0ff,
  mortar_artillery: 0xff7b00,
  vanguard_assassin: 0xf43f5e,
  aegis_overlord_boss: 0x0ea5e9,
  volatile_rusher: 0xff2a6d,
  void_warper: 0xc084fc,
  void_swarmer: 0xd8b4fe,
  abyss_sentinel: 0x38bdf8,
  transcendent_omega_boss: 0xa855f7,
  boss_turret: 0x38bdf8,
});

const FALLBACK_SPAWNS = [
  { x: -24, y: 0, z: -24, elevated: false },
  { x: 24, y: 0, z: -24, elevated: false },
  { x: -24, y: 0, z: 24, elevated: false },
  { x: 24, y: 0, z: 24, elevated: false },
  { x: 0, y: 0, z: -26, elevated: false },
  { x: 0, y: 0, z: 26, elevated: false },
  { x: -26, y: 0, z: 0, elevated: false },
  { x: 26, y: 0, z: 0, elevated: false },
  { x: -18, y: 4.0, z: -18, elevated: true },
  { x: 18, y: 4.0, z: -18, elevated: true },
  { x: -18, y: 4.0, z: 18, elevated: true },
  { x: 18, y: 4.0, z: 18, elevated: true },
];

/**
 * Compute squared distance from a 3D line segment P0->P1 to a vertical capsule segment
 * centered at (cx, yBottom..yTop, cz). Zero allocations.
 */
function segmentToVerticalCapsuleDistSq(p0x, p0y, p0z, p1x, p1y, p1z, cx, yBot, yTop, cz) {
  const dx = p1x - p0x;
  const dy = p1y - p0y;
  const dz = p1z - p0z;

  // Closest point along projectile XZ segment to capsule axis (cx, cz)
  const xzLenSq = dx * dx + dz * dz;
  let t = 0;
  if (xzLenSq > 1e-8) {
    t = ((cx - p0x) * dx + (cz - p0z) * dz) / xzLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }

  const qx = p0x + dx * t;
  const qy = p0y + dy * t;
  const qz = p0z + dz * t;

  let clampedY = qy;
  if (clampedY < yBot) clampedY = yBot;
  else if (clampedY > yTop) clampedY = yTop;

  const ex = qx - cx;
  const ey = qy - clampedY;
  const ez = qz - cz;
  return ex * ex + ey * ey + ez * ez;
}

/**
 * AETHER DROP: RECLAIM EARTH — Escalating 5-Wave + Terra-Beacon Control Zone + 3-Phase Boss Director
 * Manages out-of-sight tactical spawning, pre-allocated pooled enemy rigs & projectiles with wall &
 * player capsule collision, 3-map campaign transitions, combo multipliers, score/kill telemetry,
 * and adaptive combat intensity scoring.
 */
class WaveDirector {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../physics/CollisionWorld.js').CollisionWorld} collisionWorld
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {any} arenaData
   * @param {any} [vfxManager=null]
   */
  constructor(scene, collisionWorld, eventBus, arenaData, vfxManager = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.eventBus = eventBus;
    this.arenaData = arenaData || null;
    this.vfxManager = vfxManager || null;
    this._soundEngine = null;
    this._interactables = null;

    this.modelFactory = new EnemyModelFactory();
    this._spawnPoints = this._normalizeSpawnPoints(arenaData);

    // Active enemies, pre-allocated rig pool & zero-GC target list
    this._enemyGroup = new THREE.Group();
    this._enemyGroup.name = 'enemy_pool_group';
    this.scene.add(this._enemyGroup);

    /** @type {Record<string, Array<Enemy>>} */
    this._enemyPool = {
      rusher_drone: [],
      tactical_trooper: [],
      heavy_enforcer: [],
      sniper_stalker: [],
      cyber_mech_boss: [],
      interceptor_drone: [],
      shock_breacher: [],
      rail_warden: [],
      mortar_artillery: [],
      vanguard_assassin: [],
      aegis_overlord_boss: [],
      volatile_rusher: [],
      void_warper: [],
      void_swarmer: [],
      abyss_sentinel: [],
      transcendent_omega_boss: [],
    };
    this._prewarmed = false;

    /** @type {Array<Enemy>} */
    this._enemies = [];
    /** @type {Array<Enemy>} */
    this._livingTargets = [];
    this._nextEnemyId = 1;

    // Wave progression, 6-map campaign transition & spawning state
    this._active = false;
    this._tutorialMode = false;
    this._currentWaveIndex = -1;
    this._currentWaveTotalEnemies = 0;
    this._currentMapIndex = WAVES[0]?.mapIndex ?? 0;
    this._awaitingMapTransition = false;
    this._awaitingTransferGate = false;
    this._pendingTransitionPayload = null;
    this._spawnQueue = [];
    this._spawnTimer = 0;
    this._inIntermission = false;
    this._intermissionTimer = 0;
    this._draftPaused = false;
    this._killsSinceWeaponDrop = 0;
    this._bossMissileTimer = 4.5;
    this._bossSpecialCycle = 0;
    this._victory = false;
    this._bossEntity = null;
    this.globalEnemyHpMult = 1.0;
    this.globalEnemyDmgMult = 1.0;
    this.globalEnemySpeedMult = 1.0;
    this.globalEliteChance = 0.22;
    this.globalSpawnIntervalMult = 1.0;
    this.endlessMode = false;
    this.endlessLoop = 0;

    // Hybrid Control Zone pacing state
    this._waveZoneBonusAwarded = false;
    this._reinforcementsSpawned = 0;
    this._reinforcementTimer = 0;
    this._fallbackZoneProgress = 0;
    this._emptyZoneClearTimer = 0;

    // Score, combo & combat stats
    this.score = 0;
    this.combo = 1;
    this._comboTimer = 0;
    this.totalKills = 0;
    this.headshots = 0;
    this._combatIntensity = 0;

    // Pre-allocated pooled enemy projectiles, mortar warning rings & orbital sweep hazards (zero-GC!)
    this._projGroup = new THREE.Group();
    this._projGroup.name = 'enemy_projectiles';
    this.scene.add(this._projGroup);
    this._projectiles = this._createProjectilePool();
    this._mortarRings = this._createMortarRingPool();
    this._orbitalSweeps = this._createOrbitalSweepStatePool();
    this._homingMissiles = this._createHomingMissilePool();
    this._singularityPull = {
      active: false,
      age: 0,
      telegraphDuration: 1.1,
      pullDuration: 1.4,
      pullRadius: 30.0,
      pullAccel: 13.5,
      maxPullSpeed: 6.6,
      origin: new THREE.Vector3(),
      boss: null,
    };
    this._droneSalvoEscortCooldown = 0;

    // Bound callbacks (avoid per-frame closures)
    this._lastPlayerController = null;
    this._boundSpawnProjectile = this._spawnProjectile.bind(this);
    this._boundOnEnemyDeath = this._handleEnemyDeath.bind(this);
    this._boundOnBossPhase = this._handleBossPhase.bind(this);
    this._boundOnEnemyOverload = this._handleEnemyOverload.bind(this);
    this._boundOnVoidGateSummon = this._handleVoidGateSummon.bind(this);
    this._boundOnEnemyTeleport = this._handleEnemyTeleport.bind(this);
    this._boundOnWingCoreShattered = this._handleWingCoreShattered.bind(this);
    this._boundOnOrbitalSweep = this._handleOrbitalSweepEvent.bind(this);
    this._boundOnDroneSalvo = this._handleDroneSalvoEscort.bind(this);
    this._boundOnSingularityPull = this._handleSingularityPullEvent.bind(this);
    this._boundOnHomingMissiles = this._handleHomingMissilesEvent.bind(this);
    this._boundOnHazardField = this._handleHazardFieldEvent.bind(this);

    this._unsubBossPhase = this.eventBus
      ? this.eventBus.on(EVENTS.BOSS_PHASE, this._boundOnBossPhase)
      : () => {};
    this._unsubTeleport = this.eventBus
      ? this.eventBus.on(EVENTS.ENEMY_TELEPORT, this._boundOnEnemyTeleport)
      : () => {};
    this._unsubWingCore = this.eventBus
      ? this.eventBus.on(EVENTS.BOSS_WING_CORE_SHATTERED, this._boundOnWingCoreShattered)
      : () => {};
    this._unsubOrbitalSweep = this.eventBus
      ? this.eventBus.on(EVENTS.BOSS_ORBITAL_SWEEP, this._boundOnOrbitalSweep)
      : () => {};
    this._unsubDroneSalvo = this.eventBus
      ? this.eventBus.on(EVENTS.BOSS_DRONE_SALVO, this._boundOnDroneSalvo)
      : () => {};
    this._unsubSingularityPull = this.eventBus
      ? this.eventBus.on(EVENTS.BOSS_SINGULARITY_PULL, this._boundOnSingularityPull)
      : () => {};
    this._unsubHomingMissiles = this.eventBus
      ? this.eventBus.on(EVENTS.BOSS_HOMING_MISSILES, this._boundOnHomingMissiles)
      : () => {};
    this._unsubHazardField = this.eventBus
      ? this.eventBus.on(EVENTS.BOSS_HAZARD_FIELD, this._boundOnHazardField)
      : () => {};

    // Pre-allocated scratch structures & zero-GC snapshots
    this._playerEye = new THREE.Vector3();
    this._playerLook = new THREE.Vector3();
    this._spawnCandidate = new THREE.Vector3();
    this._spawnEye = new THREE.Vector3();
    this._prevProjPos = new THREE.Vector3();
    this._projSegDir = new THREE.Vector3();
    this._sweepBeamPos = new THREE.Vector3();
    this._escortSpawnPos = new THREE.Vector3();
    this._hmSteerTarget = new THREE.Vector3();
    this._hmDesiredDir = new THREE.Vector3();
    this._rayHit = {
      hit: false,
      distance: 0,
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      tag: '',
    };

    this._bossStateSnapshot = {
      active: false,
      name: '',
      hp: 0,
      maxHp: 1,
      hpRatio: 0,
      phase: 1,
      phaseName: '',
      shieldActive: false,
      turretsAlive: 0,
      turretsTotal: 0,
      turretShieldActive: false,
      coreExposed: false,
      isWingCoreBoss: false,
      wingCoreTotal: 0,
      wingCoreAlive: 0,
      wingCoreLAlive: false,
      wingCoreRAlive: false,
      position: new THREE.Vector3(),
    };

    this._hudSnapshot = {
      wave: 0,
      totalWaves: WAVES.length,
      waveName: '',
      subtitle: '',
      objective: '',
      objectiveType: 'eliminate',
      controlZoneActive: false,
      isBossWave: false,
      enemiesRemaining: 0,
      enemiesAlive: 0,
      enemiesQueued: 0,
      score: 0,
      combo: 1,
      comboProgress: 0,
      kills: 0,
      headshots: 0,
      inIntermission: false,
      intermissionRemaining: 0,
      awaitingMapTransition: false,
      awaitingTransferGate: false,
      transferNextMapIndex: -1,
      mapIndex: this._currentMapIndex,
      victory: false,
      combatIntensity: 0,
      zoneProgress: 0,
    };
  }

  /**
   * Optional hook to route 3D spatialized enemy gunfire into SoundEngine.
   * @param {import('../audio/SoundEngine.js').SoundEngine} soundEngine
   */
  setSoundEngine(soundEngine) {
    this._soundEngine = soundEngine || null;
  }

  /**
   * Optional hook to synchronize Terra-Beacon control zone state with ArenaInteractables.
   * @param {any} interactables
   */
  setInteractables(interactables) {
    this._interactables = interactables || null;
    if (this._interactables) {
      this._interactables.enemyDamageMult = this.getEffectiveEnemyDmgMult();
    }
  }

  getEffectiveEnemyHpMult() {
    return (this.globalEnemyHpMult || 1.0) * (1.0 + (this.endlessLoop || 0) * 0.30);
  }

  getEffectiveEnemyDmgMult() {
    return (this.globalEnemyDmgMult || 1.0) * (1.0 + (this.endlessLoop || 0) * 0.18);
  }

  /**
   * Update active arena data, normalized spawn points, map index, and optional interactables
   * (e.g., resetting a 3-map campaign back to SEC-09 before starting Wave 1).
   *
   * @param {any} arenaData
   * @param {any} [interactables=null]
   */
  setArenaData(arenaData, interactables = null) {
    this.arenaData = arenaData || null;
    this._spawnPoints = this._normalizeSpawnPoints(this.arenaData);
    this._currentMapIndex = this.arenaData?.mapIndex ?? 0;
    if (interactables !== null && interactables !== undefined) {
      this._interactables = interactables;
    }
  }

  /**
   * Normalize enemy spawn point formats from ArenaBuilder.
   * @private
   */
  _normalizeSpawnPoints(arenaData) {
    const raw =
      arenaData && Array.isArray(arenaData.enemySpawns) && arenaData.enemySpawns.length > 0
        ? arenaData.enemySpawns
        : FALLBACK_SPAWNS;

    const points = [];
    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      if (!p) continue;
      const pos = p.pos || p.position || p;
      const x = Number(pos.x) || 0;
      const y = Number(pos.y) || 0;
      const z = Number(pos.z) || 0;
      const elevated = Boolean(p.elevated || p.isElevated || p.type === 'sniper' || y >= 2.0);
      points.push({ x, y, z, elevated });
    }
    return points.length > 0 ? points : FALLBACK_SPAWNS;
  }

  /**
   * Pre-allocate 64 pooled glowing plasma bolt meshes.
   * @private
   */
  _createProjectilePool() {
    this._projOuterGeo = new THREE.CylinderGeometry(1, 0.72, 1, 7, 1, false);
    this._projOuterGeo.rotateX(Math.PI * 0.5);
    this._projCoreGeo = new THREE.CylinderGeometry(0.42, 0.35, 1.06, 6, 1, false);
    this._projCoreGeo.rotateX(Math.PI * 0.5);

    this._projCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffe8cc,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const pool = [];
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xff4422,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(this._projOuterGeo, outerMat);
      const core = new THREE.Mesh(this._projCoreGeo, this._projCoreMat);
      mesh.add(core);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 7;
      this._projGroup.add(mesh);

      pool.push({
        active: false,
        mesh,
        material: outerMat,
        position: new THREE.Vector3(),
        origin: new THREE.Vector3(),
        dir: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        targetPos: new THREE.Vector3(),
        isMortar: false,
        gravity: 22.0,
        flightTime: 1.4,
        splashRadius: 3.35,
        warningRing: null,
        speed: 30,
        damage: 10,
        radius: 0.1,
        life: 0,
        maxLife: 3.5,
        archetypeId: '',
      });
    }
    return pool;
  }

  /**
   * Pre-allocate pooled glowing orange ground impact warning circles for Mortar Artillery shells.
   * @private
   */
  _createMortarRingPool() {
    this._mortarOuterGeo = new THREE.RingGeometry(0.84, 1.0, 28);
    this._mortarOuterGeo.rotateX(-Math.PI * 0.5);
    this._mortarFillGeo = new THREE.CircleGeometry(0.95, 24);
    this._mortarFillGeo.rotateX(-Math.PI * 0.5);

    const rings = [];
    for (let i = 0; i < MAX_MORTAR_RINGS; i++) {
      const group = new THREE.Group();
      group.visible = false;

      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xff7b00,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });

      const outer = new THREE.Mesh(this._mortarOuterGeo, outerMat);
      const fill = new THREE.Mesh(this._mortarFillGeo, fillMat);
      fill.position.y = 0.01;
      group.add(outer, fill);
      group.renderOrder = 6;
      this._projGroup.add(group);

      rings.push({
        active: false,
        group,
        fill,
        outerMat,
        fillMat,
      });
    }
    return rings;
  }

  /**
   * Pre-allocate pooled Orbital Laser Sweep collision/damage trackers synced with VfxManager.
   * @private
   */
  _createOrbitalSweepStatePool() {
    const list = [];
    for (let i = 0; i < MAX_ORBITAL_SWEEPS; i++) {
      list.push({
        active: false,
        age: 0,
        telegraphDuration: 1.15,
        sweepDuration: 1.35,
        beamRadius: 2.15,
        damage: 28,
        hitCooldown: 0,
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
      });
    }
    return list;
  }

  /** @private */
  _createHomingMissilePool() {
    this._missileBodyGeo = new THREE.ConeGeometry(0.18, 0.92, 10);
    this._missileBodyGeo.rotateX(Math.PI * 0.5);
    this._missileGlowGeo = new THREE.SphereGeometry(0.24, 10, 8);
    this._missileRingGeo = new THREE.RingGeometry(0.32, 0.44, 16);
    this._missileBodyMat = new THREE.MeshStandardMaterial({
      color: 0x3f434a,
      metalness: 0.8,
      roughness: 0.3,
      emissive: 0x991b1b,
      emissiveIntensity: 0.6,
    });
    this._missileGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff5a1f,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const pool = [];
    for (let i = 0; i < MAX_HOMING_MISSILES; i++) {
      const group = new THREE.Group();
      const bodyMesh = new THREE.Mesh(this._missileBodyGeo, this._missileBodyMat);
      const glowMesh = new THREE.Mesh(this._missileGlowGeo, this._missileGlowMat);
      glowMesh.position.z = -0.36;
      const ringMesh = new THREE.Mesh(this._missileRingGeo, this._missileGlowMat);
      ringMesh.position.z = 0.05;
      group.add(bodyMesh, glowMesh, ringMesh);
      group.visible = false;
      this._projGroup.add(group);

      const pos = new THREE.Vector3();
      const hitSphere = {
        center: pos,
        radius: 0.72,
        isHead: false,
        isShield: false,
        entity: null,
      };
      const hitList = [hitSphere];
      const self = this;
      const hm = {
        active: false,
        age: 0,
        armDelay: 0.38,
        maxLife: 6.8,
        speed: 17.5,
        turnRate: 2.75,
        damage: 28,
        hp: 38,
        maxHp: 38,
        position: pos,
        dir: new THREE.Vector3(0, 0, 1),
        mesh: group,
        ringMesh,
        targetAdapter: null,
      };
      const adapter = {
        id: -1000 - i,
        isAlive: false,
        isEnemy: false,
        isHomingMissile: true,
        archetype: { id: 'homing_missile', name: '유도 미사일', isBoss: false, score: 40 },
        position: pos,
        center: pos,
        hp: 38,
        maxHp: 38,
        getHitSpheres() {
          return hitList;
        },
        applyDamage(amount) {
          if (!hm.active || !adapter.isAlive) {
            return { dealt: 0, killed: false, blockedByShield: false };
          }
          const dealt = Math.max(1, Math.round(amount));
          hm.hp = Math.max(0, hm.hp - dealt);
          adapter.hp = hm.hp;
          if (hm.hp <= 0) {
            self._interceptHomingMissile(hm, true);
            return { dealt, killed: true, blockedByShield: false };
          }
          return { dealt, killed: false, blockedByShield: false };
        },
      };
      hitSphere.entity = adapter;
      hm.targetAdapter = adapter;
      pool.push(hm);
    }
    return pool;
  }

  /** @private */
  _clearActiveHazardsAndProjectiles() {
    for (let i = 0; i < this._projectiles.length; i++) {
      const proj = this._projectiles[i];
      proj.active = false;
      proj.isMortar = false;
      proj.warningRing = null;
      if (proj.mesh) proj.mesh.visible = false;
    }
    if (this._mortarRings) {
      for (let i = 0; i < this._mortarRings.length; i++) {
        this._mortarRings[i].active = false;
        this._mortarRings[i].group.visible = false;
      }
    }
    if (this._orbitalSweeps) {
      for (let i = 0; i < this._orbitalSweeps.length; i++) {
        this._orbitalSweeps[i].active = false;
      }
    }
    if (this._homingMissiles) {
      for (let i = 0; i < this._homingMissiles.length; i++) {
        const hm = this._homingMissiles[i];
        hm.active = false;
        hm.mesh.visible = false;
        if (hm.targetAdapter) hm.targetAdapter.isAlive = false;
      }
    }
    if (this._singularityPull) {
      this._singularityPull.active = false;
      this._singularityPull.boss = null;
    }
  }

  /**
   * Pre-allocate dormant Enemy rigs (7 rusher_drone, 7 tactical_trooper, 4 heavy_enforcer,
   * 4 sniper_stalker, 1 cyber_mech_boss = 23 rigs) inside _enemyGroup for zero-stutter waves.
   * Idempotent: calling multiple times never duplicates pooled rigs.
   */
  prewarm() {
    for (const archetypeId of Object.keys(POOL_CAPACITIES)) {
      const archetype = ENEMY_ARCHETYPES[archetypeId];
      if (!archetype) continue;
      const targetCount = POOL_CAPACITIES[archetypeId];
      const bucket =
        this._enemyPool[archetypeId] || (this._enemyPool[archetypeId] = []);

      while (bucket.length < targetCount) {
        const enemy = new Enemy(
          0,
          archetype,
          ZERO_SPAWN_POS,
          this._enemyGroup,
          this.collisionWorld,
          this.modelFactory,
          this.eventBus,
          null,
          { dormant: true, pooled: true }
        );
        enemy.setDeathCallback(this._boundOnEnemyDeath);
        bucket.push(enemy);
      }
    }
    this._prewarmed = true;
  }

  /**
   * Begin a fresh run starting at the requested zero-based wave index (defaults to Wave 1).
   *
   * @param {number} [startWaveIndex=0]
   */
  start(startWaveIndex = 0) {
    this.reset();
    if (!this._prewarmed) {
      this.prewarm();
    }
    const maxIdx = Math.max(0, WAVES.length - 1);
    const safeIdx = Math.max(0, Math.min(maxIdx, Math.floor(Number(startWaveIndex) || 0)));
    this._active = true;
    this._startWave(safeIdx);
  }

  /**
   * Reset all active enemies (returning pooled rigs to dormant state), pooled projectiles,
   * wave counters, map transition flags, and combat telemetry.
   */
  reset() {
    for (let i = 0; i < this._enemies.length; i++) {
      this._enemies[i].deactivate();
    }
    for (const key of Object.keys(this._enemyPool)) {
      const bucket = this._enemyPool[key];
      for (let i = 0; i < bucket.length; i++) {
        bucket[i].deactivate();
      }
    }
    this._enemies.length = 0;
    this._livingTargets.length = 0;
    this._bossEntity = null;

    this._clearActiveHazardsAndProjectiles();
    this._droneSalvoEscortCooldown = 0;

    this._active = false;
    this._tutorialMode = false;
    this._currentWaveIndex = -1;
    this._currentWaveTotalEnemies = 0;
    this._currentMapIndex = WAVES[0]?.mapIndex ?? 0;
    this._awaitingMapTransition = false;
    this._awaitingTransferGate = false;
    this._pendingTransitionPayload = null;
    this._spawnQueue.length = 0;
    this._spawnTimer = 0;
    this._inIntermission = false;
    this._intermissionTimer = 0;
    this._draftPaused = false;
    this._killsSinceWeaponDrop = 0;
    this._bossMissileTimer = 4.5;
    this._bossSpecialCycle = 0;
    this._victory = false;

    this._waveZoneBonusAwarded = false;
    this._reinforcementsSpawned = 0;
    this._reinforcementTimer = 0;
    this._fallbackZoneProgress = 0;
    this._emptyZoneClearTimer = 0;

    this.score = 0;
    this.combo = 1;
    this._comboTimer = 0;
    this.totalKills = 0;
    this.headshots = 0;
    this._combatIntensity = 0;

    if (this._interactables) {
      if (typeof this._interactables.resetZone === 'function') {
        this._interactables.resetZone();
      }
      if (typeof this._interactables.setZoneActive === 'function') {
        this._interactables.setZoneActive(false);
      }
      if (typeof this._interactables.setCaptureSpeedMultiplier === 'function') {
        this._interactables.setCaptureSpeedMultiplier(1.0);
      }
      if (typeof this._interactables.clearBossTurrets === 'function') {
        this._interactables.clearBossTurrets();
      }
      if (typeof this._interactables.setVoidGatesEnabled === 'function') {
        this._interactables.setVoidGatesEnabled(0);
      }
      if (typeof this._interactables.setBossLowGravityOverride === 'function') {
        this._interactables.setBossLowGravityOverride(false);
      }
      if (typeof this._interactables.setTransferGateActive === 'function') {
        this._interactables.setTransferGateActive(false);
      }
    }
  }

  isAwaitingTransferGate() {
    return Boolean(this._awaitingTransferGate && this._pendingTransitionPayload);
  }

  enterTransferGate() {
    if (!this._awaitingTransferGate || !this._pendingTransitionPayload) return false;
    const payload = this._pendingTransitionPayload;
    this._awaitingTransferGate = false;
    this._awaitingMapTransition = true;
    if (this._interactables && typeof this._interactables.setTransferGateActive === 'function') {
      this._interactables.setTransferGateActive(false);
    }
    if (this.eventBus) {
      this.eventBus.emit(EVENTS.TRANSFER_GATE_ENTERED, payload);
      this.eventBus.emit(EVENTS.MAP_TRANSITION, payload);
    }
    return true;
  }

  /**
   * Finalize a 3-map campaign sector transition once the new arena & interactables are ready,
   * then immediately begin the queued next wave.
   *
   * @param {any} newArenaData
   * @param {any} [newInteractables=null]
   */
  completeMapTransition(newArenaData, newInteractables = null) {
    if (newArenaData) {
      this.arenaData = newArenaData;
      this._spawnPoints = this._normalizeSpawnPoints(newArenaData);
    }
    if (newInteractables) {
      this._interactables = newInteractables;
      this._interactables.enemyDamageMult = this.getEffectiveEnemyDmgMult();
    }

    for (let i = 0; i < this._enemies.length; i++) {
      this._enemies[i].deactivate();
    }
    this._enemies.length = 0;
    this._livingTargets.length = 0;
    this._bossEntity = null;

    this._clearActiveHazardsAndProjectiles();
    this._droneSalvoEscortCooldown = 0;

    const nextWaveIndex = this._currentWaveIndex + 1;
    const fallbackMapIdx =
      nextWaveIndex >= 0 && nextWaveIndex < WAVES.length
        ? this._getEffectiveMapIndex(WAVES[nextWaveIndex])
        : this._currentMapIndex;

    this._currentMapIndex =
      newArenaData && typeof newArenaData.mapIndex === 'number'
        ? newArenaData.mapIndex
        : fallbackMapIdx;

    this._awaitingMapTransition = false;
    this._awaitingTransferGate = false;
    this._pendingTransitionPayload = null;

    if (nextWaveIndex >= 0 && nextWaveIndex < WAVES.length) {
      this._startWave(nextWaveIndex);
    }
  }

  /**
   * Resolve map index for a wave (10-wave campaign natively traverses all 6 sectors 0..5).
   * @private
   */
  _getEffectiveMapIndex(wave) {
    return wave && typeof wave.mapIndex === 'number' ? wave.mapIndex : this._currentMapIndex;
  }

  /**
   * Initialize and announce a specific wave index (0..WAVES.length-1).
   * @private
   */
  _startWave(index) {
    if (index < 0 || index >= WAVES.length) return;
    const wave = WAVES[index];
    this._currentWaveIndex = index;
    this._currentMapIndex = this._getEffectiveMapIndex(wave);
    this._awaitingMapTransition = false;
    this._inIntermission = false;
    this._intermissionTimer = 0;

    this._waveZoneBonusAwarded = false;
    this._supplyDroneSpawnedThisWave = false;
    this._reinforcementsSpawned = 0;
    this._reinforcementTimer = 0;
    this._fallbackZoneProgress = 0;
    this._emptyZoneClearTimer = 0;

    // Reset and configure Terra-Beacon control zone & Stage 6-10 tactical gimmicks cleanly for this wave
    if (this._interactables) {
      if (typeof this._interactables.resetZone === 'function') {
        this._interactables.resetZone();
      }
      if (typeof this._interactables.setZoneActive === 'function') {
        this._interactables.setZoneActive(Boolean(wave.controlZoneActive));
      }
      if (typeof this._interactables.setCaptureSpeedMultiplier === 'function') {
        this._interactables.setCaptureSpeedMultiplier(1.0);
      }
      if (typeof this._interactables.setWaveGimmicks === 'function') {
        this._interactables.setWaveGimmicks(wave.gimmick || null);
      }
      if (typeof this._interactables.clearBossTurrets === 'function') {
        this._interactables.clearBossTurrets();
      }
      if (typeof this._interactables.setBossLowGravityOverride === 'function') {
        this._interactables.setBossLowGravityOverride(false);
      }
      if (typeof this._interactables.setVoidGatesEnabled === 'function') {
        this._interactables.setVoidGatesEnabled((wave.gimmick && wave.gimmick.voidGates) || 0);
      }
      if (typeof this._interactables.setVoidGateSummonCallback === 'function') {
        this._interactables.setVoidGateSummonCallback(this._boundOnVoidGateSummon);
      }
      if (typeof this._interactables.setTurretProjectileCallback === 'function') {
        this._interactables.setTurretProjectileCallback(this._boundSpawnProjectile);
      }
      this._interactables.enemyDamageMult = this.getEffectiveEnemyDmgMult();
    }

    // Build wave spawn queue (boss spawns first on Boss Waves; regular units interleaved for variety)
    this._spawnQueue.length = 0;
    const regularPool = [];
    for (let i = 0; i < wave.enemies.length; i++) {
      const entry = wave.enemies[i];
      for (let c = 0; c < entry.count; c++) {
        if (
          entry.type === 'cyber_mech_boss' ||
          entry.type === 'aegis_overlord_boss' ||
          entry.type === 'transcendent_omega_boss'
        ) {
          this._spawnQueue.push(entry.type);
        } else {
          regularPool.push(entry.type);
        }
      }
    }

    // Light Fisher-Yates shuffle so waves present mixed-arms pressure immediately
    for (let i = regularPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = regularPool[i];
      regularPool[i] = regularPool[j];
      regularPool[j] = tmp;
    }
    for (let i = 0; i < regularPool.length; i++) {
      this._spawnQueue.push(regularPool[i]);
    }
    this._currentWaveTotalEnemies = this._spawnQueue.length;

    // Spawn initial contact immediately on next update tick
    this._spawnTimer = 0.25;

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.WAVE_STARTED, {
        wave: wave.wave,
        totalWaves: WAVES.length,
        name: wave.name,
        subtitle: wave.subtitle,
        objective: wave.objective,
        objectiveType: wave.objectiveType,
        controlZoneActive: wave.controlZoneActive,
        isBossWave: wave.isBossWave,
        totalEnemies: this._spawnQueue.length,
      });
    }
  }

  /**
   * Enqueue Boss Phase 2 / Phase 3 escorts immediately upon phase shift.
   * @private
   */
  setDraftPaused(paused) {
    this._draftPaused = Boolean(paused);
  }

  _handleBossPhase(payload) {
    if (!this._active || !payload || !Array.isArray(payload.escorts)) return;
    // Step 2: Boss Phase Transition triggers Ground Shockwave Ring (jump to evade!)
    if (this._bossEntity && this._interactables && typeof this._interactables.spawnBossShockwave === 'function') {
      this._interactables.spawnBossShockwave(this._bossEntity.position);
    }
    if (this._interactables && this._bossEntity && payload.turretCount > 0 && typeof this._interactables.spawnBossTurrets === 'function') {
      this._interactables.spawnBossTurrets(payload.turretCount, this._bossEntity);
    }
    if (this._interactables && payload.spawnVoidGate && typeof this._interactables.spawnBossVoidGate === 'function') {
      this._interactables.spawnBossVoidGate();
    }
    if (this._interactables && payload.centralLowGravity && typeof this._interactables.setBossLowGravityOverride === 'function') {
      this._interactables.setBossLowGravityOverride(true);
    }
    // Solo boss phase-transition sustain drops on walkable deck when no escorts are spawned
    if (
      payload.escorts.length === 0 &&
      payload.phase >= 2 &&
      this._bossEntity &&
      this._interactables &&
      typeof this._interactables.spawnItemDrop === 'function'
    ) {
      const bx = this._bossEntity.position.x;
      const bz = this._bossEntity.position.z;
      const tryDrop = (dx, dz, kind) => {
        const tx = Math.max(-24, Math.min(24, bx + dx));
        const tz = Math.max(-24, Math.min(24, bz + dz));
        const gy = this.collisionWorld ? this.collisionWorld.getGroundHeightAt(tx, tz, 8, -9999) : 0;
        if (gy > -5) {
          this._dropTmpPos ? this._dropTmpPos.set(tx, gy, tz) : (this._dropTmpPos = new THREE.Vector3(tx, gy, tz));
        } else {
          this._dropTmpPos ? this._dropTmpPos.set(0, 0, 0) : (this._dropTmpPos = new THREE.Vector3(0, 0, 0));
        }
        this._interactables.spawnItemDrop(this._dropTmpPos, kind, 35);
      };
      tryDrop(-3.2, 2.5, 'health');
      tryDrop(3.2, 2.5, 'shield');
    }
    for (let i = 0; i < payload.escorts.length; i++) {
      const entry = payload.escorts[i];
      for (let c = 0; c < entry.count; c++) {
        this._spawnQueue.unshift(entry.type);
      }
    }
    // Deploy first escort promptly
    this._spawnTimer = Math.min(this._spawnTimer, 0.45);
  }

  /** @private */
  _handleEnemyTeleport(payload) {
    if (!payload || !this.vfxManager) return;
    const col = payload.color || 0xa855f7;
    if (payload.fromPos) {
      if (typeof this.vfxManager.spawnTeleport === 'function') {
        this.vfxManager.spawnTeleport(payload.fromPos, col);
      }
      if (typeof this.vfxManager.spawnBlinkAfterimage === 'function') {
        this.vfxManager.spawnBlinkAfterimage(
          payload.fromPos,
          payload.yaw || 0,
          payload.height || 1.9,
          col,
          Boolean(payload.isBoss)
        );
      }
    }
    if (payload.toPos && typeof this.vfxManager.spawnTeleport === 'function') {
      this.vfxManager.spawnTeleport(payload.toPos, col);
    }
  }

  /** @private */
  _handleSingularityPullEvent(payload) {
    if (!payload || !this._singularityPull) return;
    const sp = this._singularityPull;
    sp.active = true;
    sp.age = 0;
    sp.telegraphDuration = Number.isFinite(payload.telegraphDuration) ? payload.telegraphDuration : 1.1;
    sp.pullDuration = Number.isFinite(payload.pullDuration) ? payload.pullDuration : 1.4;
    sp.pullRadius = Number.isFinite(payload.pullRadius) ? payload.pullRadius : 30.0;
    sp.pullAccel = Number.isFinite(payload.pullAccel) ? payload.pullAccel : 13.5;
    sp.maxPullSpeed = Number.isFinite(payload.maxPullSpeed) ? payload.maxPullSpeed : 6.6;
    sp.boss = payload.boss || null;
    if (payload.origin) {
      sp.origin.copy(payload.origin);
    } else if (sp.boss && sp.boss.position) {
      sp.origin.copy(sp.boss.position);
    }
    if (this.vfxManager && typeof this.vfxManager.spawnSingularityPull === 'function') {
      this.vfxManager.spawnSingularityPull(
        sp.origin,
        sp.telegraphDuration,
        sp.pullDuration,
        sp.pullRadius
      );
    }
  }

  /** @private */
  _handleWingCoreShattered(payload) {
    if (!payload) return;
    if (payload.position && this.vfxManager && typeof this.vfxManager.spawnExplosion === 'function') {
      this.vfxManager.spawnExplosion(payload.position, 3.2, 0x38bdf8);
    }
  }

  /** @private */
  _handleOrbitalSweepEvent(payload) {
    if (!payload || !payload.startPos || !payload.endPos) return;
    let slot = null;
    for (let i = 0; i < MAX_ORBITAL_SWEEPS; i++) {
      if (!this._orbitalSweeps[i].active) {
        slot = this._orbitalSweeps[i];
        break;
      }
    }
    if (!slot) slot = this._orbitalSweeps[0];

    slot.active = true;
    slot.age = 0;
    slot.telegraphDuration = Number.isFinite(payload.telegraphDuration) ? payload.telegraphDuration : 1.15;
    slot.sweepDuration = Number.isFinite(payload.sweepDuration) ? payload.sweepDuration : 1.35;
    slot.beamRadius = Number.isFinite(payload.beamRadius) ? payload.beamRadius : 2.15;
    slot.damage = Math.max(1, Math.round((payload.damage || 28) * this.getEffectiveEnemyDmgMult()));
    slot.hitCooldown = 0;
    slot.startPos.copy(payload.startPos);
    slot.endPos.copy(payload.endPos);

    if (this.vfxManager && typeof this.vfxManager.spawnOrbitalLaserSweep === 'function') {
      this.vfxManager.spawnOrbitalLaserSweep(
        slot.startPos,
        slot.endPos,
        slot.telegraphDuration,
        slot.sweepDuration,
        slot.beamRadius
      );
    }
    if (this.eventBus) {
      this.eventBus.emit('SFX_BOSS_TELEGRAPH', { type: 'missile' });
    }
  }

  /** @private */
  _handleHomingMissilesEvent(payload) {
    if (!payload || !this._homingMissiles) return;
    const damage = Math.max(
      1,
      Math.round((Number.isFinite(payload.damage) ? payload.damage : 28) * this.getEffectiveEnemyDmgMult())
    );
    const speed = Number.isFinite(payload.speed) ? payload.speed : 17.5;
    const phase = Number(payload.phase) || 1;
    const bossPos = payload.boss && payload.boss.position ? payload.boss.position : null;
    const originL = payload.originL || bossPos;
    const originR = payload.originR || bossPos;
    if (originL) this._spawnSingleHomingMissile(originL, 1, damage, speed, phase);
    if (originR) this._spawnSingleHomingMissile(originR, -1, damage, speed, phase);
  }

  /** @private */
  _spawnSingleHomingMissile(origin, sideSign, damage, speed, phase) {
    let slot = null;
    let oldest = this._homingMissiles[0];
    for (let i = 0; i < MAX_HOMING_MISSILES; i++) {
      const m = this._homingMissiles[i];
      if (!m.active) {
        slot = m;
        break;
      }
      if (m.age > oldest.age) oldest = m;
    }
    if (!slot) slot = oldest;

    slot.active = true;
    slot.age = 0;
    slot.armDelay = 0.36;
    slot.maxLife = 6.8;
    slot.speed = speed;
    slot.turnRate = 2.35 + phase * 0.25;
    slot.damage = damage;
    slot.hp = 38;
    slot.maxHp = 38;
    slot.position.copy(origin);

    const bossYaw = this._bossEntity ? this._bossEntity._yaw : 0;
    const rx = Math.cos(bossYaw) * sideSign;
    const rz = -Math.sin(bossYaw) * sideSign;
    slot.dir.set(Math.sin(bossYaw) * 0.4 + rx * 0.45, 0.82, Math.cos(bossYaw) * 0.4 + rz * 0.45).normalize();

    slot.mesh.position.copy(slot.position);
    slot.mesh.quaternion.setFromUnitVectors(Z_AXIS, slot.dir);
    slot.mesh.visible = true;
    slot.targetAdapter.hp = 38;
    slot.targetAdapter.isAlive = true;
  }

  /** @private */
  _interceptHomingMissile(hm, byPlayer) {
    if (!hm || !hm.active) return;
    hm.active = false;
    hm.mesh.visible = false;
    if (hm.targetAdapter) hm.targetAdapter.isAlive = false;

    if (this.vfxManager && typeof this.vfxManager.spawnExplosion === 'function') {
      this.vfxManager.spawnExplosion(hm.position, byPlayer ? 2.6 : 2.1, byPlayer ? 0xf59e0b : 0xff5a1f);
    }
    if (this._soundEngine && typeof this._soundEngine._playBarrelExplosion === 'function') {
      this._soundEngine._playBarrelExplosion({ position: hm.position });
    }
    if (byPlayer) {
      this.score += 40;
      if (this.eventBus) {
        this.eventBus.emit('hud:missile_intercepted', { score: 40, position: hm.position });
      }
    }
  }

  /** @private */
  _handleHazardFieldEvent(payload) {
    const activeInteractables = this._interactables;
    if (!payload || !activeInteractables || typeof activeInteractables.spawnHazardField !== 'function') return;
    const c = payload.center || (this._lastPlayerController && this._lastPlayerController.position);
    if (!c) return;
    const phase = Number(payload.phase) || 1;
    const count = phase >= 3 ? 5 : phase === 2 ? 4 : 3;
    const radius = Number.isFinite(payload.radius) ? payload.radius : 3.2;
    const duration = Number.isFinite(payload.duration) ? payload.duration : 9.0;
    const damage = Number.isFinite(payload.damage) ? payload.damage : 14;
    const ringDist = phase >= 3 ? 4.8 : 5.2;
    const baseAng = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const ang = baseAng + (i / count) * Math.PI * 2;
      const dist = i === 0 ? 1.4 : ringDist;
      const tx = Math.max(-27, Math.min(27, c.x + Math.cos(ang) * dist));
      const tz = Math.max(-27, Math.min(27, c.z + Math.sin(ang) * dist));
      this._spawnCandidate.set(tx, c.y || 0, tz);
      activeInteractables.spawnHazardField(this._spawnCandidate, {
        radius,
        duration,
        damage,
        armTime: phase >= 3 ? 0.72 : 0.85,
      });
    }
  }

  /** @private */
  _hasWaveEscorts(wave) {
    return Boolean(
      wave &&
        Array.isArray(wave.enemies) &&
        wave.enemies.some(
          (entry) =>
            entry &&
            entry.type !== 'aegis_overlord_boss' &&
            entry.type !== 'cyber_mech_boss' &&
            entry.type !== 'transcendent_omega_boss'
        )
    );
  }

  /** @private */
  _handleDroneSalvoEscort(payload) {
    if (!this._active || !this._bossEntity || !this._bossEntity.isAlive || this._droneSalvoEscortCooldown > 0) {
      return;
    }
    const wave =
      this._currentWaveIndex >= 0 && this._currentWaveIndex < WAVES.length
        ? WAVES[this._currentWaveIndex]
        : null;
    if (!this._hasWaveEscorts(wave)) return;
    if (this._livingTargets.length >= (wave ? wave.maxConcurrent : 8)) return;

    let droneCount = 0;
    for (let i = 0; i < this._livingTargets.length; i++) {
      const e = this._livingTargets[i];
      if (e && e.isAlive && e.archetype && e.archetype.id === 'interceptor_drone') {
        droneCount++;
      }
    }
    if (droneCount >= 2) return;

    this._droneSalvoEscortCooldown = 14.0;
    const bossPos = this._bossEntity.position;
    const side = Math.random() < 0.5 ? 1 : -1;
    const sx = Math.max(-24, Math.min(24, bossPos.x + side * 4.2));
    const sz = Math.max(-24, Math.min(24, bossPos.z + (Math.random() - 0.5) * 3.0));
    const sy = this.collisionWorld.getGroundHeightAt(sx, sz, bossPos.y + 3.0);
    this._escortSpawnPos.set(sx, Number.isFinite(sy) ? sy : 0, sz);

    const spawned = this._spawnEnemyAtPos('interceptor_drone', this._escortSpawnPos, wave);
    if (spawned) {
      const scaleMult = this.getEffectiveEnemyHpMult();
      if (scaleMult > 1.01 && typeof spawned.setMaxHp === 'function') {
        spawned.setMaxHp(Math.round(spawned.maxHp * scaleMult));
      }
      this._livingTargets.push(spawned);
    }
  }

  /** @private */
  _handleEnemyOverload(enemy) {
    if (!enemy || !this._interactables || typeof this._interactables.triggerOverloadBlast !== 'function') return;
    const arch = enemy.archetype || {};
    const scaledPlayerDmg = Math.max(1, Math.round((arch.overloadPlayerDamage || 48) * this.getEffectiveEnemyDmgMult()));
    this._interactables.triggerOverloadBlast(
      enemy.center || enemy.position,
      arch.overloadRadius || 8.0,
      arch.overloadEnemyDamage || 85,
      scaledPlayerDmg,
      this._lastPlayerController,
      this._livingTargets,
      enemy
    );
  }

  /** @private */
  _handleVoidGateSummon(spawnPos) {
    if (!this._active || this._inIntermission || this._awaitingMapTransition || this._draftPaused) return;
    const wave =
      this._currentWaveIndex >= 0 && this._currentWaveIndex < WAVES.length
        ? WAVES[this._currentWaveIndex]
        : null;
    const cap = (wave ? wave.maxConcurrent : 8) + 4;
    if (this._livingTargets.length >= cap) return;

    const archetypeId = Math.random() < 0.7 ? 'void_swarmer' : 'volatile_rusher';
    const spawned = this._spawnEnemyAtPos(archetypeId, spawnPos, wave);
    if (spawned) {
      const scaleMult = this.getEffectiveEnemyHpMult();
      if (scaleMult > 1.01) {
        if (typeof spawned.setMaxHp === 'function') {
          spawned.setMaxHp(Math.round(spawned.maxHp * scaleMult));
        } else {
          spawned.maxHp = Math.round(spawned.maxHp * scaleMult);
          spawned.hp = spawned.maxHp;
        }
      }
      this._livingTargets.push(spawned);
    }
  }

  /**
   * Synchronous enemy death handler: updates combo, calculates score, emits EVENTS.ENEMY_KILLED,
   * and fires optional death explosion VFX.
   * @private
   */
  _handleEnemyDeath(enemy, isHeadshot, hitPoint) {
    if (this._comboTimer > 0) {
      this.combo = Math.min(SCORE_CONFIG.maxComboMultiplier, this.combo + 1);
    } else {
      this.combo = 1;
    }
    this._comboTimer = SCORE_CONFIG.comboTimeout;

    const isEnvKill = Boolean(enemy.lastHitWasEnv);
    const baseScore =
      enemy.archetype.score +
      (isHeadshot ? SCORE_CONFIG.headshotBonus : 0) +
      (isEnvKill ? 150 : 0);
    const pointsAwarded = Math.round(baseScore * this.combo);
    this.score += pointsAwarded;
    this.totalKills++;
    if (isHeadshot) {
      this.headshots++;
    }

    const wasBoss = enemy === this._bossEntity || Boolean(enemy.archetype && enemy.archetype.isBoss);
    if (enemy === this._bossEntity) {
      this._bossEntity = null;
    }
    if (wasBoss) {
      if (this._interactables) {
        if (typeof this._interactables.clearBossTurrets === 'function') {
          this._interactables.clearBossTurrets();
        }
        if (typeof this._interactables.setBossLowGravityOverride === 'function') {
          this._interactables.setBossLowGravityOverride(false);
        }
      }
      // Clear any remaining queued escorts so no minions spawn after boss defeat
      this._spawnQueue.length = 0;
      // Immediately terminate all remaining living minions with chain-explosion VFX
      for (let i = 0; i < this._enemies.length; i++) {
        const minion = this._enemies[i];
        if (!minion || minion === enemy || !minion.isAlive) continue;
        minion.hp = 0;
        minion._killProcessed = true;
        minion.die();
        this.totalKills++;
        if (this.vfxManager) {
          const mPos = minion.center;
          if (typeof this.vfxManager.spawnEnemyDeath === 'function') {
            this.vfxManager.spawnEnemyDeath(mPos, minion.archetype.color, false);
          } else if (typeof this.vfxManager.spawnExplosion === 'function') {
            this.vfxManager.spawnExplosion(mPos, 1.0, minion.archetype.color);
          }
        }
        if (this.eventBus) {
          this.eventBus.emit(EVENTS.ENEMY_KILLED, {
            id: minion.id,
            enemy: minion,
            archetype: minion.archetype,
            archetypeId: minion.archetype.id,
            name: minion.archetype.name,
            isBoss: false,
            isHeadshot: false,
            isMelee: false,
            position: minion.position.clone(),
            headPosition: minion.headPosition.clone(),
            hitPoint: minion.center.clone(),
            score: minion.archetype.score,
            totalScore: this.score,
            combo: this.combo,
            kills: this.totalKills,
            headshots: this.headshots,
          });
        }
      }
      // Clear lingering enemy projectiles, homing missiles & floor hazards for a clean boss finish
      this._clearActiveHazardsAndProjectiles();
      if (this._interactables && typeof this._interactables.clearHazardFields === 'function') {
        this._interactables.clearHazardFields();
      }
    }

    // Step 2: Gold Drop + Low-Chance Weapon Drop (with pity for locked BR-12 / HV-7)
    if (this._interactables) {
      const aid = enemy.archetype.id;
      const isElite =
        aid === 'heavy_enforcer' ||
        aid === 'sniper_stalker' ||
        aid === 'rail_warden' ||
        aid === 'mortar_artillery' ||
        aid === 'vanguard_assassin' ||
        aid === 'shock_breacher' ||
        aid === 'abyss_sentinel' ||
        aid === 'void_warper';

      if (typeof this._interactables.spawnGoldDrop === 'function') {
        const goldAmt = enemy.archetype.isBoss
          ? (aid === 'transcendent_omega_boss' ? 400 : aid === 'aegis_overlord_boss' ? 260 : 150)
          : aid === 'rail_warden' || aid === 'abyss_sentinel'
          ? 36
          : aid === 'mortar_artillery'
          ? 32
          : aid === 'heavy_enforcer'
          ? 30
          : aid === 'vanguard_assassin' || aid === 'void_warper'
          ? 26
          : aid === 'sniper_stalker'
          ? 24
          : aid === 'shock_breacher'
          ? 22
          : aid === 'interceptor_drone' || aid === 'volatile_rusher'
          ? 18
          : 14;
        const dropPos = isEnvKill && enemy._lastSafeDropPos ? enemy._lastSafeDropPos : enemy.position;
        this._interactables.spawnGoldDrop(dropPos, goldAmt);
        if (enemy.archetype.isBoss) {
          const bonusDrop = aid === 'transcendent_omega_boss' ? 120 : aid === 'aegis_overlord_boss' ? 90 : 60;
          this._interactables.spawnGoldDrop(dropPos, bonusDrop);
          this._interactables.spawnGoldDrop(dropPos, bonusDrop);
        }
      }
      if (typeof this._interactables.spawnItemDrop === 'function') {
        const dropPos = isEnvKill && enemy._lastSafeDropPos ? enemy._lastSafeDropPos : enemy.position;
        if (enemy.archetype.isBoss) {
          this._interactables.spawnItemDrop(dropPos, 'health', 35);
          this._interactables.spawnItemDrop(dropPos, 'shield', 35);
        } else {
          const dropChance = isElite ? 0.45 : 0.26;
          if (Math.random() < dropChance) {
            const dropType = Math.random() < 0.62 ? 'health' : 'shield';
            this._interactables.spawnItemDrop(dropPos, dropType, 25);
          }
        }
      }
      if (typeof this._interactables.spawnWeaponDrop === 'function' && !enemy.archetype.isBoss) {
        const dropPos = isEnvKill && enemy._lastSafeDropPos ? enemy._lastSafeDropPos : enemy.position;
        this._killsSinceWeaponDrop++;
        const baseChance = isElite ? 0.24 : 0.14;
        const pity = this._killsSinceWeaponDrop >= 7 ? 0.45 : 0;
        if (Math.random() < baseChance + pity) {
          this._killsSinceWeaponDrop = 0;
          // 60% Primary (BR-12, HV-7, K-9, M41-A), 40% Special Secondary (T-4, K-0, W-01)
          const pool = Math.random() < 0.6 ? [1, 2, 3, 0] : [5, 6, 4];
          const dropWeaponIdx = pool[Math.floor(Math.random() * pool.length)];
          this._interactables.spawnWeaponDrop(dropPos, dropWeaponIdx);
        }
      }
    }

    // Optional death burst VFX on VFXManager
    if (this.vfxManager) {
      const burstPos = enemy.center;
      if (typeof this.vfxManager.spawnEnemyDeath === 'function') {
        this.vfxManager.spawnEnemyDeath(burstPos, enemy.archetype.color, enemy.archetype.isBoss);
      } else if (typeof this.vfxManager.spawnExplosion === 'function') {
        this.vfxManager.spawnExplosion(burstPos, enemy.archetype.isBoss ? 2.4 : 1.0, enemy.archetype.color);
      }
    }

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.ENEMY_KILLED, {
        id: enemy.id,
        enemy,
        archetype: enemy.archetype,
        archetypeId: enemy.archetype.id,
        name: enemy.archetype.name,
        isBoss: enemy.archetype.isBoss,
        isHeadshot: Boolean(isHeadshot),
        isEnvKill,
        isMelee: Boolean(enemy.lastHitWasMelee),
        position: enemy.position.clone(),
        headPosition: enemy.headPosition.clone(),
        hitPoint: hitPoint ? hitPoint.clone() : enemy.center.clone(),
        score: pointsAwarded,
        totalScore: this.score,
        combo: this.combo,
        kills: this.totalKills,
        headshots: this.headshots,
      });
    }
  }

  /**
   * Main per-frame update for spawning, enemy AI simulation, projectiles,
   * hybrid control-point wave pacing, and victory condition.
   *
   * @param {number} dt
   * @param {number} elapsedTime
   * @param {import('../player/PlayerController.js').PlayerController} playerController
   * @param {any} [zoneState=null]
   * @param {any} [interactables=null]
   */
  update(dt, elapsedTime, playerController, zoneState = null, interactables = null) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const clampedDt = dt > 0.05 ? 0.05 : dt;

    if (interactables && !this._interactables) {
      this._interactables = interactables;
    }
    const activeInteractables = interactables || this._interactables;

    // Always update active projectiles, homing missiles, orbital sweeps & singularity pulls even during intermissions
    this._updateProjectiles(clampedDt, playerController);
    this._updateHomingMissiles(clampedDt, playerController);
    this._updateOrbitalSweeps(clampedDt, playerController);
    this._updateSingularityPull(clampedDt, playerController);
    if (this._droneSalvoEscortCooldown > 0) {
      this._droneSalvoEscortCooldown = Math.max(0, this._droneSalvoEscortCooldown - clampedDt);
    }

    // Combo decay timer
    if (this._comboTimer > 0) {
      this._comboTimer = Math.max(0, this._comboTimer - clampedDt);
      if (this._comboTimer <= 0) {
        this.combo = 1;
      }
    }

    if (!this._active || !playerController) {
      return;
    }
    this._lastPlayerController = playerController;

    const playerPos = playerController.position;
    playerController.getEyePosition(this._playerEye);

    // 1. Update all active & dissolving enemies; prune disposed entries
    let livingCount = 0;
    this._livingTargets.length = 0;

    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const enemy = this._enemies[i];
      enemy.update(
        clampedDt,
        elapsedTime,
        playerPos,
        this._playerEye,
        this._boundSpawnProjectile
      );

      // Catch-all safety if an enemy died without hitting the synchronous hook
      if (!enemy.isAlive && !enemy._killProcessed) {
        enemy._killProcessed = true;
        this._handleEnemyDeath(enemy, enemy.lastHitWasHeadshot, enemy.lastHitPoint);
      }

      if (enemy.isRemoved) {
        this._enemies.splice(i, 1);
      } else if (enemy.isAlive) {
        livingCount++;
        this._livingTargets.push(enemy);
      }
    }

    // 2. Pause wave timer/spawns while awaiting Transfer Gate entry or 300ms sector transition
    if (this._awaitingTransferGate || this._awaitingMapTransition) {
      this._combatIntensity += (0 - this._combatIntensity) * (1 - Math.exp(-3 * clampedDt));
      return;
    }

    // 3. Intermission countdown between waves (paused while player chooses Tactical Card)
    if (this._inIntermission) {
      if (this._draftPaused) return;
      this._intermissionTimer -= clampedDt;
      this._combatIntensity += (0.18 - this._combatIntensity) * (1 - Math.exp(-3 * clampedDt));
      if (this._intermissionTimer <= 0) {
        const nextWaveIndex = this._currentWaveIndex + 1;
        if (nextWaveIndex < WAVES.length) {
          const nextWave = WAVES[nextWaveIndex];
          const nextMapIndex = this._getEffectiveMapIndex(nextWave);
          if (nextMapIndex !== this._currentMapIndex) {
            this._inIntermission = false;
            this._intermissionTimer = 0;
            this._awaitingTransferGate = true;
            const nextMapMeta = MAPS[nextMapIndex] || null;
            this._pendingTransitionPayload = {
              nextWaveIndex,
              nextMapIndex,
              fromMapIndex: this._currentMapIndex,
              nextMapMeta,
            };
            if (this._interactables && typeof this._interactables.setTransferGateActive === 'function') {
              this._interactables.setTransferGateActive(true, nextMapMeta);
            }
            if (this.eventBus) {
              this.eventBus.emit(EVENTS.TRANSFER_GATE_OPEN, this._pendingTransitionPayload);
            }
            return;
          }
          this._startWave(nextWaveIndex);
        }
      }
      return;
    }

    if (this._victory || this._currentWaveIndex < 0 || this._currentWaveIndex >= WAVES.length) {
      return;
    }

    const wave = WAVES[this._currentWaveIndex];

    // 3. Spawn queued hostiles respecting maxConcurrent & spawnInterval
    if (this._spawnQueue.length > 0 && livingCount < wave.maxConcurrent) {
      this._spawnTimer -= clampedDt;
      if (this._spawnTimer <= 0) {
        const nextType = this._spawnQueue.shift();
        const spawned = this._spawnEnemy(nextType, playerController, wave);
        if (spawned) {
          const scaleMult = this.getEffectiveEnemyHpMult();
          if (scaleMult > 1.01) {
            if (typeof spawned.setMaxHp === 'function') {
              spawned.setMaxHp(Math.round(spawned.maxHp * scaleMult));
            } else {
              spawned.maxHp = Math.round(spawned.maxHp * scaleMult);
              spawned.hp = spawned.maxHp;
            }
          }
          // Wave 2+: chance to promote non-boss enemy into an Elite Variant (scales with Threat tiers)
          const eliteChance = Number.isFinite(this.globalEliteChance) ? this.globalEliteChance : 0.22;
          if (!spawned.isBoss && this._currentWaveIndex >= 1 && Math.random() < eliteChance) {
            const affixes = [
              { id: 'overcharged', label: '[과충전]', hpMult: 1.35, color: 0xef4444 },
              { id: 'shield_link', label: '[실드링크]', hpMult: 1.30, color: 0x38bdf8 },
              { id: 'splitter', label: '[분열체]', hpMult: 1.25, color: 0xf59e0b },
            ];
            const aff = affixes[Math.floor(Math.random() * affixes.length)];
            spawned.eliteAffix = aff.id;
            spawned.displayName = `${aff.label} ${spawned.archetype.name || spawned.typeId}`;
            spawned.maxHp = Math.round(spawned.maxHp * aff.hpMult);
            spawned.hp = spawned.maxHp;
            if (typeof spawned.setScaleMultiplier === 'function') {
              spawned.setScaleMultiplier(1.16);
            } else if (spawned.root) {
              spawned.root.scale.multiplyScalar(1.16);
            }
          }
          livingCount++;
          this._livingTargets.push(spawned);
        }

        // Wave 2+: Mid-wave Golden Supply Drone surprise event (once per wave; skip on solo boss fights)
        if (
          this._currentWaveIndex >= 1 &&
          (!wave.isBossWave || this._hasWaveEscorts(wave)) &&
          !this._supplyDroneSpawnedThisWave &&
          this._spawnQueue.length <= Math.max(2, Math.floor((this._currentWaveTotalEnemies || 8) * 0.5))
        ) {
          this._supplyDroneSpawnedThisWave = true;
          const drone = this._spawnEnemy('rusher_drone', playerController, wave);
          if (drone) {
            drone.isSupplyDrone = true;
            drone.eliteAffix = 'supply_drone';
            drone.displayName = '황금 보급 드론';
            drone.maxHp = Math.round(drone.maxHp * 1.6);
            drone.hp = drone.maxHp;
            if (typeof drone.setScaleMultiplier === 'function') {
              drone.setScaleMultiplier(1.32);
            } else if (drone.root) {
              drone.root.scale.multiplyScalar(1.32);
            }
            livingCount++;
            this._livingTargets.push(drone);
            if (this.eventBus) {
              this.eventBus.emit(EVENTS.ANNOUNCEMENT, {
                kicker: '돌발 전술 이벤트',
                title: '황금 보급 드론 출현!',
                subtitle: '격추 시 대량 골드(+45 G) 및 무기 보급 즉시 드랍',
                duration: 3.2,
              });
            }
          }
        }
        // Fast initial wave population while field is sparse
        const cadenceScale = livingCount < Math.min(3, wave.maxConcurrent) ? 0.52 : 1.0;
        this._spawnTimer = wave.spawnInterval * cadenceScale * (this.globalSpawnIntervalMult || 1.0);
      }
    }

    // 4. Evaluate Wave Completion (Elimination, Hybrid Control Zone, or Wave 5 Boss)
    const allQueuedSpawned = this._spawnQueue.length === 0;
    let waveCleared = false;

    if (wave.controlZoneActive) {
      const zoneInfo = this._evaluateControlZone(
        clampedDt,
        playerPos,
        zoneState,
        activeInteractables,
        allQueuedSpawned && livingCount === 0
      );

      if (zoneInfo.captured) {
        if (!this._waveZoneBonusAwarded) {
          this._waveZoneBonusAwarded = true;
          this.score += SCORE_CONFIG.zoneCaptureBonus;
          // Full shield top-off on Terra-Beacon capture
          if (playerController && typeof playerController.heal === 'function') {
            playerController.heal(0, playerController.maxShield || 100);
          }
        }
        if (
          activeInteractables &&
          typeof activeInteractables.setCaptureSpeedMultiplier === 'function'
        ) {
          activeInteractables.setCaptureSpeedMultiplier(1.0);
        }
        // Terra-Beacon upload hits 100%: EMP-clear remaining stragglers & win wave!
        this._spawnQueue.length = 0;
        for (let i = 0; i < this._enemies.length; i++) {
          const e = this._enemies[i];
          if (e.isAlive) {
            e.applyDamage(9999, e.center, false, null, { isExplosion: true });
          }
        }
        waveCleared = true;
      } else if (allQueuedSpawned && livingCount === 0) {
        // Player cleared all wave enemies before zone hit 100%:
        // Accelerate capture 2.5x via interactables API AND spawn 4-unit reinforcement squads (max 2)
        if (
          activeInteractables &&
          typeof activeInteractables.setCaptureSpeedMultiplier === 'function'
        ) {
          activeInteractables.setCaptureSpeedMultiplier(2.5);
        }
        if (this._reinforcementsSpawned < 2 && zoneInfo.progress < 0.88) {
          this._reinforcementTimer += clampedDt;
          if (this._reinforcementTimer >= 3.8) {
            this._reinforcementTimer = 0;
            this._reinforcementsSpawned++;
            const waveNum = wave.wave || 1;
            const squad =
              waveNum >= 11
                ? ['volatile_rusher', 'void_warper', 'volatile_rusher', 'void_swarmer']
                : waveNum >= 6
                ? ['interceptor_drone', 'shock_breacher', 'rail_warden', 'vanguard_assassin']
                : ['rusher_drone', 'tactical_trooper', 'rusher_drone', 'tactical_trooper'];
            this._spawnQueue.push(...squad);
            this._spawnTimer = 0.25;
          }
        } else {
          // Both reinforcement pairs defeated (or zone nearly done): auto-finalize upload cleanly!
          this._emptyZoneClearTimer += clampedDt;
          if (this._emptyZoneClearTimer >= 2.2) {
            waveCleared = true;
          }
        }
      } else {
        this._reinforcementTimer = 0;
        this._emptyZoneClearTimer = 0;
        if (
          activeInteractables &&
          typeof activeInteractables.setCaptureSpeedMultiplier === 'function'
        ) {
          activeInteractables.setCaptureSpeedMultiplier(1.0);
        }
      }
    } else {
      // Standard elimination (Wave 1) or Boss + Adds (Wave 5)
      if (allQueuedSpawned && livingCount === 0) {
        waveCleared = true;
      }
    }

    // 4.5. Boss-Exclusive Arena Hazard Patterns (Siege Shockwaves / Ion Hazard Traps / Void Implosion)
    if (
      this._bossEntity &&
      this._bossEntity.isAlive &&
      activeInteractables &&
      typeof activeInteractables.spawnBossMissile === 'function'
    ) {
      this._bossMissileTimer -= clampedDt;
      if (this._bossMissileTimer <= 0) {
        const bossId = this._bossEntity.archetype.id;
        const phase = this._bossEntity.currentPhase || 1;
        const cycle = this._bossSpecialCycle++ % 2;
        this._bossMissileTimer =
          bossId === 'transcendent_omega_boss'
            ? phase >= 3
              ? 3.2
              : phase === 2
              ? 4.0
              : 4.8
            : bossId === 'aegis_overlord_boss'
            ? phase >= 3
              ? 3.6
              : phase === 2
              ? 4.4
              : 5.2
            : phase >= 3
            ? 4.0
            : phase === 2
            ? 4.8
            : 5.6;

        if (bossId === 'aegis_overlord_boss') {
          if (cycle === 0 && typeof activeInteractables.spawnHazardField === 'function') {
            this._handleHazardFieldEvent({
              center: playerPos,
              phase,
              radius: phase >= 3 ? 3.5 : 3.15,
              duration: phase >= 3 ? 10.0 : 8.5,
              damage: Math.round(14 * (phase >= 3 ? 1.2 : 1.0)),
            });
          } else {
            const bDx = playerPos.x - this._bossEntity.position.x;
            const bDz = playerPos.z - this._bossEntity.position.z;
            const bLen = Math.hypot(bDx, bDz) || 1;
            const perpX = -bDz / bLen;
            const perpZ = bDx / bLen;
            const dirSign = (this._bossSpecialCycle & 1) === 0 ? 1 : -1;
            const halfSpan = phase >= 3 ? 9.5 : 8.0;
            const sx = Math.max(-25, Math.min(25, playerPos.x - perpX * halfSpan * dirSign));
            const sz = Math.max(-25, Math.min(25, playerPos.z - perpZ * halfSpan * dirSign));
            const ex = Math.max(-25, Math.min(25, playerPos.x + perpX * halfSpan * dirSign));
            const ez = Math.max(-25, Math.min(25, playerPos.z + perpZ * halfSpan * dirSign));
            const sy = this.collisionWorld.getGroundHeightAt(sx, sz, playerPos.y + 1.5);
            const ey = this.collisionWorld.getGroundHeightAt(ex, ez, playerPos.y + 1.5);
            this._handleOrbitalSweepEvent({
              startPos: this._spawnCandidate.set(sx, Number.isFinite(sy) ? sy : 0, sz),
              endPos: this._spawnEye.set(ex, Number.isFinite(ey) ? ey : 0, ez),
              telegraphDuration: phase >= 3 ? 0.95 : 1.15,
              sweepDuration: 1.25,
              beamRadius: phase >= 3 ? 2.35 : 2.1,
              damage: 28,
            });
            if (phase >= 2 && typeof activeInteractables.spawnHazardField === 'function') {
              activeInteractables.spawnHazardField(
                { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                { radius: 3.1, duration: 8.5, damage: 14 }
              );
            }
          }
        } else if (bossId === 'transcendent_omega_boss') {
          if (cycle === 0) {
            const offsets =
              phase >= 2
                ? [[0, 0], [4.0, 4.0], [-4.0, 4.0], [4.0, -4.0], [-4.0, -4.0]]
                : [[0, 0], [4.4, 0], [-4.4, 0], [0, 4.4]];
            for (let m = 0; m < offsets.length; m++) {
              const tx = Math.max(-28, Math.min(28, playerPos.x + offsets[m][0]));
              const tz = Math.max(-28, Math.min(28, playerPos.z + offsets[m][1]));
              activeInteractables.spawnBossMissile({ x: tx, y: playerPos.y, z: tz, fuse: 1.05, damage: 30 });
            }
          } else {
            if (typeof activeInteractables.spawnBossShockwave === 'function') {
              activeInteractables.spawnBossShockwave(this._bossEntity.position);
            }
            const ringN = phase >= 3 ? 5 : 4;
            for (let m = 0; m < ringN; m++) {
              const ang = (m / ringN) * Math.PI * 2 + 0.35;
              const tx = Math.max(-28, Math.min(28, playerPos.x + Math.cos(ang) * 3.8));
              const tz = Math.max(-28, Math.min(28, playerPos.z + Math.sin(ang) * 3.8));
              activeInteractables.spawnBossMissile({ x: tx, y: playerPos.y, z: tz, fuse: 1.1 });
            }
          }
        } else {
          // Stage 5 COLOSSUS-IV: Seismic Ground Shockwave Ring OR Focused Mortar Carpet Line
          if (cycle === 0) {
            if (typeof activeInteractables.spawnBossShockwave === 'function') {
              activeInteractables.spawnBossShockwave(this._bossEntity.position);
            }
            for (let m = 0; m < 2; m++) {
              const ang = m * Math.PI + Math.random() * 0.8;
              const tx = Math.max(-28, Math.min(28, playerPos.x + Math.cos(ang) * 4.2));
              const tz = Math.max(-28, Math.min(28, playerPos.z + Math.sin(ang) * 4.2));
              activeInteractables.spawnBossMissile({ x: tx, y: playerPos.y, z: tz });
            }
          } else {
            const dirX = playerPos.x - this._bossEntity.position.x;
            const dirZ = playerPos.z - this._bossEntity.position.z;
            const dLen = Math.hypot(dirX, dirZ) || 1;
            const nx = dirX / dLen;
            const nz = dirZ / dLen;
            const count = phase >= 3 ? 5 : 4;
            for (let m = 0; m < count; m++) {
              const offset = (m - 1.5) * 3.4;
              const tx = Math.max(-28, Math.min(28, playerPos.x + nx * offset));
              const tz = Math.max(-28, Math.min(28, playerPos.z + nz * offset));
              activeInteractables.spawnBossMissile({ x: tx, y: playerPos.y, z: tz });
            }
          }
        }
      }
    }

    // 4.8. [실드링크] Elite Aura & Stage 8-10 Aegis Shield Relays sustain living allies
    const activeRelays =
      activeInteractables && typeof activeInteractables.getActiveShieldRelayCount === 'function'
        ? activeInteractables.getActiveShieldRelayCount()
        : 0;
    if (activeRelays > 0) {
      const relayHeal = 5 * activeRelays * clampedDt;
      for (let i = 0; i < this._livingTargets.length; i++) {
        const enemy = this._livingTargets[i];
        if (!enemy || !enemy.isAlive || enemy.isHomingMissile || enemy.hp >= enemy.maxHp) continue;
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + relayHeal);
      }
    }
    for (let i = 0; i < this._livingTargets.length; i++) {
      const linker = this._livingTargets[i];
      if (!linker || !linker.isAlive || linker.eliteAffix !== 'shield_link') continue;
      for (let j = 0; j < this._livingTargets.length; j++) {
        const ally = this._livingTargets[j];
        if (!ally || !ally.isAlive || ally.isHomingMissile || ally === linker || ally.hp >= ally.maxHp) continue;
        if (ally.position.distanceToSquared(linker.position) <= 100) {
          ally.hp = Math.min(ally.maxHp, ally.hp + 6 * clampedDt);
        }
      }
    }

    // 4.9. Expose active interceptable boss homing missiles to player weapons AFTER livingCount tally
    if (this._homingMissiles) {
      for (let m = 0; m < MAX_HOMING_MISSILES; m++) {
        const hm = this._homingMissiles[m];
        if (hm.active && hm.targetAdapter && hm.targetAdapter.isAlive) {
          this._livingTargets.push(hm.targetAdapter);
        }
      }
    }

    // 5. Update adaptive combat intensity for SoundEngine (0..1)
    let targetIntensity = Math.min(0.75, 0.22 + livingCount * 0.11);
    if (this._bossEntity && this._bossEntity.isAlive) {
      targetIntensity = 0.72 + (this._bossEntity.currentPhase - 1) * 0.14;
    }
    this._combatIntensity += (targetIntensity - this._combatIntensity) * (1 - Math.exp(-2.8 * clampedDt));

    // 6. Complete wave -> award bonus -> intermission or final Victory!
    if (waveCleared && !this._tutorialMode) {
      this._completeCurrentWave(wave);
    }
  }

  /**
   * Read external Control Zone state cleanly (or maintain a fallback around arena center).
   * @private
   */
  _evaluateControlZone(dt, playerPos, zoneState, interactables, enemiesCleared) {
    let progress = 0;
    let captured = false;

    // Support zoneState object passed directly or retrieved from interactables
    const zState =
      zoneState ||
      (interactables && typeof interactables.getZoneState === 'function'
        ? interactables.getZoneState()
        : null);

    if (zState && typeof zState === 'object') {
      const raw = Number(zState.progress) || 0;
      progress = raw > 1 ? Math.min(1, raw / 100) : Math.max(0, Math.min(1, raw));
      captured = Boolean(zState.captured || zState.isCaptured || progress >= 0.999);

      const playerInZone = Boolean(zState.playerInside || zState.playerInZone || zState.inZone);
      // Help accelerate progress if enemies are cleared and player is inside zone
      if (enemiesCleared && !captured && playerInZone) {
        if (typeof zState.addProgress === 'function') {
          zState.addProgress((1.5 * dt) / ARENA_CONFIG.controlZoneCaptureTime);
        }
      }
      this._fallbackZoneProgress = progress;
    } else {
      // Self-contained fallback Control Zone at arena center (0, 0, 0)
      const distSq = playerPos.x * playerPos.x + playerPos.z * playerPos.z;
      const r = ARENA_CONFIG.controlZoneRadius;
      const inZone = distSq <= r * r;
      if (inZone) {
        const speedMult = enemiesCleared ? 2.5 : 1.0;
        this._fallbackZoneProgress = Math.min(
          1,
          this._fallbackZoneProgress + (dt * speedMult) / ARENA_CONFIG.controlZoneCaptureTime
        );
      }
      progress = this._fallbackZoneProgress;
      captured = progress >= 0.999;
    }

    return { progress, captured };
  }

  /**
   * Finalize cleared wave, emit WAVE_CLEARED, and start intermission or Victory state.
   * @private
   */
  _completeCurrentWave(wave) {
    const waveBonus = wave.scoreBonus || SCORE_CONFIG.waveClearBaseBonus * wave.wave;
    this.score += waveBonus;

    this._clearActiveHazardsAndProjectiles();
    if (this._interactables) {
      if (typeof this._interactables.clearHazardFields === 'function') {
        this._interactables.clearHazardFields();
      }
      if (typeof this._interactables.setCaptureSpeedMultiplier === 'function') {
        this._interactables.setCaptureSpeedMultiplier(1.0);
      }
      if (typeof this._interactables.setZoneActive === 'function') {
        this._interactables.setZoneActive(false);
      }
    }

    const isEndlessLoopEnd = Boolean(this.endlessMode) && this._currentWaveIndex >= WAVES.length - 1;
    const isFinalWave = !this.endlessMode && this._currentWaveIndex >= WAVES.length - 1;

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.WAVE_CLEARED, {
        wave: wave.wave,
        totalWaves: WAVES.length,
        name: wave.name,
        scoreBonus: waveBonus,
        totalScore: this.score,
        isFinalWave,
        endlessLoopCleared: isEndlessLoopEnd,
        nextIntermission: isFinalWave ? 0 : wave.intermissionTime,
      });
    }

    if (isEndlessLoopEnd) {
      this.endlessLoop = (this.endlessLoop || 0) + 1;
      this._currentWaveIndex = -1;
      if (this._interactables) {
        this._interactables.enemyDamageMult = this.getEffectiveEnemyDmgMult();
      }
      if (this.eventBus) {
        this.eventBus.emit(EVENTS.ANNOUNCEMENT, {
          kicker: `무한 강하 · ${this.endlessLoop}회차`,
          title: `위협 상승 (적 체력 +${this.endlessLoop * 30}% · 공격력 +${this.endlessLoop * 18}%)`,
          subtitle: '다음 궤도 강하 구역으로 순환 진입합니다',
          duration: 3.4,
        });
      }
    }

    if (isFinalWave) {
      this._victory = true;
      this._active = false;
    this._tutorialMode = false;
      this._combatIntensity = 0;

      if (this.eventBus) {
        this.eventBus.emit(EVENTS.GAME_STATE, {
          state: 'victory',
          score: this.score,
          kills: this.totalKills,
          headshots: this.headshots,
          wave: wave.wave,
        });
      }
    } else {
      this._inIntermission = true;
      this._intermissionTimer = wave.intermissionTime || 3.5;
    }
  }

  /**
   * Select an optimal out-of-sight, range-appropriate spawn point and activate a pooled Enemy.
   * @private
   */
  spawnTutorialEnemy(archetypeId, spawnPos) {
    this._tutorialMode = true;
    this._active = true;
    const archetype = ENEMY_ARCHETYPES[archetypeId];
    if (!archetype) return null;
    const enemyId = this._nextEnemyId++;
    const bucket = this._enemyPool[archetypeId] || (this._enemyPool[archetypeId] = []);
    let enemy = null;
    for (let i = 0; i < bucket.length; i++) {
      const candidate = bucket[i];
      if (!candidate.isAlive && candidate.isRemoved && !this._enemies.includes(candidate)) {
        enemy = candidate;
        break;
      }
    }
    if (enemy) {
      enemy.activate(enemyId, spawnPos, null);
    } else {
      enemy = new Enemy(
        enemyId,
        archetype,
        spawnPos,
        this._enemyGroup,
        this.collisionWorld,
        this.modelFactory,
        this.eventBus,
        null,
        { dormant: false, pooled: true }
      );
      enemy.setDeathCallback(this._boundOnEnemyDeath);
      bucket.push(enemy);
    }
    this._enemies.push(enemy);
    if (enemy.isAlive) {
      this._livingTargets.push(enemy);
    }
    return enemy;
  }

  _spawnEnemy(archetypeId, playerController, wave) {
    const archetype = ENEMY_ARCHETYPES[archetypeId];
    if (!archetype) return null;
    const spawnPos = this._pickSpawnPoint(archetype, playerController);
    return this._spawnEnemyAtPos(archetypeId, spawnPos, wave);
  }

  _spawnEnemyAtPos(archetypeId, spawnPos, wave) {
    const archetype = ENEMY_ARCHETYPES[archetypeId];
    if (!archetype) return null;

    const bossPhases = archetype.isBoss && wave ? wave.bossPhases || null : null;
    const enemyId = this._nextEnemyId++;

    const bucket =
      this._enemyPool[archetypeId] || (this._enemyPool[archetypeId] = []);
    let enemy = null;
    for (let i = 0; i < bucket.length; i++) {
      const candidate = bucket[i];
      if (!candidate.isAlive && candidate.isRemoved && !this._enemies.includes(candidate)) {
        enemy = candidate;
        break;
      }
    }

    if (enemy) {
      enemy.activate(enemyId, spawnPos, bossPhases);
    } else {
      enemy = new Enemy(
        enemyId,
        archetype,
        spawnPos,
        this._enemyGroup,
        this.collisionWorld,
        this.modelFactory,
        this.eventBus,
        bossPhases,
        { dormant: false, pooled: true }
      );
      enemy.setDeathCallback(this._boundOnEnemyDeath);
      bucket.push(enemy);
    }

    if (typeof enemy.setOverloadCallback === 'function') {
      enemy.setOverloadCallback(this._boundOnEnemyOverload);
    }
    enemy.threatSpeedMult = this.globalEnemySpeedMult || 1.0;

    this._enemies.push(enemy);
    if (archetype.isBoss) {
      this._bossEntity = enemy;
      if (
        archetype.id === 'transcendent_omega_boss' &&
        this._interactables &&
        typeof this._interactables.spawnBossTurrets === 'function'
      ) {
        const phase1Turrets = (wave && wave.bossPhases && wave.bossPhases[0] && wave.bossPhases[0].turretCount) || 2;
        this._interactables.spawnBossTurrets(phase1Turrets, enemy);
      }
    }

    if (this.vfxManager && typeof this.vfxManager.spawnTeleport === 'function') {
      this.vfxManager.spawnTeleport(enemy.position, archetype.color);
    }

    return enemy;
  }

  /**
   * Tactical spawn point selector: avoids <10m radius, prefers out-of-LOS / rear flank,
   * prefers elevated catwalk spawns for Sniper Stalker, and wide open space for Boss.
   * @private
   */
  _pickSpawnPoint(archetype, playerController) {
    const playerPos = playerController.position;
    playerController.getLookDirection(this._playerLook);

    let bestScore = -Infinity;
    let bestPoint = this._spawnPoints[0];

    for (let i = 0; i < this._spawnPoints.length; i++) {
      const sp = this._spawnPoints[i];
      const dx = sp.x - playerPos.x;
      const dz = sp.z - playerPos.z;
      const dist = Math.hypot(dx, dz);

      let score = Math.random() * 14; // Subtle unpredictability

      // Strongly avoid spawning right in the player's face (<10m)
      if (dist < 10.0) {
        score -= 120 + (10.0 - dist) * 15;
      } else if (dist < 14.0) {
        score -= 22;
      } else if (dist <= 34.0) {
        score += 24;
      } else {
        score += 10;
      }

      // Archetype elevation preferences
      if (archetype.id === 'sniper_stalker' || archetype.id === 'mortar_artillery') {
        score += sp.elevated ? 72 : -18;
        if (dist >= 18 && dist <= 40) score += 22;
      } else if (archetype.isBoss) {
        score += sp.elevated ? -150 : 40;
        if (dist >= 18) score += 25;
        if (
          !this.collisionWorld.hasClearance(
            sp.x,
            sp.y + 0.05,
            sp.z,
            archetype.radius,
            archetype.height
          )
        ) {
          score -= 140;
        }
      } else if (
        archetype.id === 'heavy_enforcer' ||
        archetype.id === 'rail_warden' ||
        archetype.id === 'shock_breacher' ||
        archetype.id === 'abyss_sentinel'
      ) {
        score += sp.elevated ? -90 : 22;
      } else if (!archetype.isFlying) {
        score += sp.elevated ? -12 : 12;
      }

      // Prefer out-of-view-cone and out-of-LOS spawns so hostiles never pop in front of camera
      if (dist > 0.1) {
        const dot = (dx * this._playerLook.x + dz * this._playerLook.z) / dist;
        if (dot < 0.25) {
          score += 32; // Outside player's primary front view cone
        } else if (dot > 0.72) {
          score -= 26;
        }
      }

      this._spawnEye.set(sp.x, sp.y + archetype.headHeight, sp.z);
      const visible = this.collisionWorld.isLineOfSightClear(this._playerEye, this._spawnEye);
      if (!visible) {
        score += 42;
      }

      // Avoid stacking directly on another living enemy
      for (let e = 0; e < this._enemies.length; e++) {
        const other = this._enemies[e];
        if (!other.isAlive) continue;
        const edx = sp.x - other.position.x;
        const edz = sp.z - other.position.z;
        const eDistSq = edx * edx + edz * edz;
        if (eDistSq < 6.25) {
          score -= 85;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPoint = sp;
      }
    }

    this._spawnCandidate.set(bestPoint.x, bestPoint.y, bestPoint.z);
    return this._spawnCandidate;
  }

  /**
   * Activate a pooled glowing enemy projectile or parabolic mortar shell (zero allocations).
   * @private
   */
  _spawnProjectile(origin, dir, speed, damage, color, radius, archetypeId, isSniperBeam, extraOpts = null) {
    let slot = null;
    for (let i = 0; i < this._projectiles.length; i++) {
      if (!this._projectiles[i].active) {
        slot = this._projectiles[i];
        break;
      }
    }
    if (!slot) {
      // Recycle oldest projectile gracefully if pool is saturated
      slot = this._projectiles[0];
      if (slot.warningRing) {
        slot.warningRing.active = false;
        slot.warningRing.group.visible = false;
        slot.warningRing = null;
      }
    }

    const isMortar = Boolean(extraOpts && extraOpts.isMortar && extraOpts.targetPos);
    slot.active = true;
    slot.origin.copy(origin);
    slot.position.copy(origin);
    slot.dir.copy(dir).normalize();
    slot.speed = speed;
    slot.damage = Math.max(1, Math.round(damage * this.getEffectiveEnemyDmgMult()));
    slot.radius = radius;
    slot.life = 0;
    slot.archetypeId = archetypeId;
    slot.isMortar = isMortar;
    slot.warningRing = null;

    if (isMortar) {
      const tPos = extraOpts.targetPos;
      const g = Number.isFinite(extraOpts.gravity) ? extraOpts.gravity : 22.0;
      const T = Math.max(0.55, Number.isFinite(extraOpts.flightTime) ? extraOpts.flightTime : 1.35);
      const splashR = Number.isFinite(extraOpts.splashRadius) ? extraOpts.splashRadius : 3.35;

      slot.gravity = g;
      slot.flightTime = T;
      slot.maxLife = T + 0.45;
      slot.splashRadius = splashR;
      slot.targetPos.copy(tPos);

      slot.vel.set(
        (tPos.x - origin.x) / T,
        (tPos.y - origin.y + 0.5 * g * T * T) / T,
        (tPos.z - origin.z) / T
      );

      if (this._mortarRings) {
        let ringSlot = null;
        for (let r = 0; r < this._mortarRings.length; r++) {
          if (!this._mortarRings[r].active) {
            ringSlot = this._mortarRings[r];
            break;
          }
        }
        if (ringSlot) {
          ringSlot.active = true;
          ringSlot.group.position.set(tPos.x, tPos.y + 0.03, tPos.z);
          ringSlot.group.scale.setScalar(splashR);
          ringSlot.fill.scale.setScalar(0.08);
          ringSlot.outerMat.opacity = 0.85;
          ringSlot.fillMat.opacity = 0.34;
          ringSlot.group.visible = true;
          slot.warningRing = ringSlot;
        }
      }

      const mortarColor = (extraOpts && extraOpts.boltColor) || PROJECTILE_COLORS[archetypeId] || 0xff7b00;
      slot.material.color.setHex(mortarColor);
      slot.mesh.position.copy(origin);
      this._projSegDir.copy(slot.vel);
      if (this._projSegDir.lengthSq() > 1e-4) this._projSegDir.normalize();
      else this._projSegDir.copy(slot.dir);
      slot.mesh.quaternion.setFromUnitVectors(Z_AXIS, this._projSegDir);
      slot.mesh.scale.set(radius * 1.45, radius * 1.45, 0.72);
      slot.mesh.visible = true;
    } else {
      slot.maxLife = isSniperBeam ? 1.4 : 3.2;

      // Distinct glowing silhouette per archetype
      const length = isSniperBeam
        ? 2.65
        : archetypeId === 'aegis_overlord_boss' || archetypeId === 'transcendent_omega_boss'
        ? 1.48
        : archetypeId === 'cyber_mech_boss' || archetypeId === 'rail_warden' || archetypeId === 'abyss_sentinel'
        ? 1.35
        : archetypeId === 'vanguard_assassin'
        ? 1.12
        : archetypeId === 'mortar_artillery' || archetypeId === 'void_warper'
        ? 0.98
        : archetypeId === 'heavy_enforcer' || archetypeId === 'shock_breacher'
        ? 0.70
        : 0.90;
      const visualRadius = isSniperBeam ? 0.065 : radius * 0.85;
      const isBossColor =
        archetypeId === 'aegis_overlord_boss' ||
        archetypeId === 'cyber_mech_boss' ||
        archetypeId === 'transcendent_omega_boss';
      const boltColor =
        (extraOpts && extraOpts.boltColor) ||
        (isBossColor && color ? color : PROJECTILE_COLORS[archetypeId]) ||
        0xff4422;

      slot.material.color.setHex(boltColor);
      slot.mesh.position.copy(origin);
      slot.mesh.quaternion.setFromUnitVectors(Z_AXIS, slot.dir);
      if (archetypeId === 'vanguard_assassin') {
        slot.mesh.scale.set(visualRadius * 2.35, visualRadius * 0.45, length);
      } else {
        slot.mesh.scale.set(visualRadius, visualRadius, length);
      }
      slot.mesh.visible = true;
    }

    // 3D spatialized enemy gunfire audio
    if (this._soundEngine && typeof this._soundEngine.playEnemyShot === 'function') {
      this._soundEngine.playEnemyShot(origin, archetypeId);
    }
  }

  /**
   * Detonate a parabolic Mortar Artillery shell, clear its floor warning ring, and apply AoE splash.
   * Zero heap allocations.
   * @private
   */
  _detonateMortarProjectile(proj, ix, iy, iz, playerController) {
    this._prevProjPos.set(ix, iy, iz);

    if (proj.warningRing) {
      proj.warningRing.active = false;
      proj.warningRing.group.visible = false;
      proj.warningRing = null;
    }
    proj.active = false;
    proj.isMortar = false;
    proj.mesh.visible = false;

    if (this.vfxManager) {
      if (typeof this.vfxManager.spawnExplosion === 'function') {
        this.vfxManager.spawnExplosion(this._prevProjPos, proj.splashRadius * 0.88, 0xff7b00);
      }
    }
    if (this._soundEngine && typeof this._soundEngine._playBarrelExplosion === 'function') {
      this._soundEngine._playBarrelExplosion({ position: this._prevProjPos });
    }

    if (playerController && playerController.isAlive) {
      const pPos = playerController.position;
      const dx = pPos.x - ix;
      const dz = pPos.z - iz;
      const horizDist = Math.hypot(dx, dz);
      const dy = Math.abs(pPos.y - iy);
      const splashR = proj.splashRadius || 3.35;
      if (horizDist <= splashR && dy < 2.9) {
        const innerR = splashR * 0.45;
        const falloff =
          horizDist <= innerR
            ? 1.0
            : Math.max(0.55, 1.0 - ((horizDist - innerR) / Math.max(0.1, splashR - innerR)) * 0.45);
        playerController.applyDamage(Math.max(1, Math.round(proj.damage * falloff)), this._prevProjPos);
      }
    }
  }

  /**
   * Advance pooled enemy projectiles, parabolic mortar shells, and test swept collisions.
   * Strictly zero heap allocations.
   * @private
   */
  _updateProjectiles(dt, playerController) {
    const playerAlive = Boolean(playerController && playerController.isAlive);
    const pPos = playerAlive ? playerController.position : null;
    const pRadius = PLAYER_CONFIG.radius;
    const pHeight = playerAlive ? playerController.currentHeight : PLAYER_CONFIG.standHeight;

    for (let i = 0; i < this._projectiles.length; i++) {
      const proj = this._projectiles[i];
      if (!proj.active) continue;

      proj.life += dt;

      if (proj.isMortar) {
        this._prevProjPos.copy(proj.position);
        proj.vel.y -= proj.gravity * dt;

        const nextX = this._prevProjPos.x + proj.vel.x * dt;
        const nextY = this._prevProjPos.y + proj.vel.y * dt;
        const nextZ = this._prevProjPos.z + proj.vel.z * dt;

        this._projSegDir.set(nextX - this._prevProjPos.x, nextY - this._prevProjPos.y, nextZ - this._prevProjPos.z);
        const segLen = this._projSegDir.length();
        if (segLen > 1e-5) {
          this._projSegDir.multiplyScalar(1 / segLen);
          proj.mesh.quaternion.setFromUnitVectors(Z_AXIS, this._projSegDir);
        }

        if (proj.warningRing) {
          const p = Math.min(1, proj.life / Math.max(0.1, proj.flightTime));
          proj.warningRing.fill.scale.setScalar(Math.max(0.08, p));
          proj.warningRing.outerMat.opacity = 0.65 + 0.35 * Math.abs(Math.sin(proj.life * 18));
        }

        const wallHit =
          segLen > 1e-5 && proj.life > 0.08
            ? this.collisionWorld.raycastWorld(this._prevProjPos, this._projSegDir, segLen, this._rayHit)
            : null;

        if (wallHit) {
          this._detonateMortarProjectile(
            proj,
            wallHit.point.x,
            wallHit.point.y,
            wallHit.point.z,
            playerController
          );
          continue;
        }

        if (playerAlive && pPos) {
          const hitR = pRadius + proj.radius * 0.9;
          const yBot = pPos.y + Math.min(pRadius, pHeight * 0.45);
          const yTop = pPos.y + Math.max(pRadius, pHeight - pRadius * 0.4);
          const distSq = segmentToVerticalCapsuleDistSq(
            this._prevProjPos.x,
            this._prevProjPos.y,
            this._prevProjPos.z,
            nextX,
            nextY,
            nextZ,
            pPos.x,
            yBot,
            yTop,
            pPos.z
          );
          if (distSq <= hitR * hitR) {
            this._detonateMortarProjectile(proj, nextX, nextY, nextZ, playerController);
            continue;
          }
        }

        if (proj.life >= proj.flightTime || nextY <= proj.targetPos.y) {
          this._detonateMortarProjectile(
            proj,
            proj.targetPos.x,
            proj.targetPos.y,
            proj.targetPos.z,
            playerController
          );
          continue;
        }

        proj.position.set(nextX, nextY, nextZ);
        proj.mesh.position.copy(proj.position);
        continue;
      }

      if (proj.life >= proj.maxLife) {
        proj.active = false;
        proj.mesh.visible = false;
        continue;
      }

      const stepDist = proj.speed * dt;
      this._prevProjPos.copy(proj.position);

      // 1. Check solid world geometry collision first
      const wallHit = this.collisionWorld.raycastWorld(
        this._prevProjPos,
        proj.dir,
        stepDist,
        this._rayHit
      );
      const maxMove = wallHit ? wallHit.distance : stepDist;

      const nextX = this._prevProjPos.x + proj.dir.x * maxMove;
      const nextY = this._prevProjPos.y + proj.dir.y * maxMove;
      const nextZ = this._prevProjPos.z + proj.dir.z * maxMove;

      // 2. Check swept segment against player vertical capsule
      if (playerAlive && pPos) {
        const hitR = pRadius + proj.radius * 0.85;
        const yBot = pPos.y + Math.min(pRadius, pHeight * 0.45);
        const yTop = pPos.y + Math.max(pRadius, pHeight - pRadius * 0.4);
        const distSq = segmentToVerticalCapsuleDistSq(
          this._prevProjPos.x,
          this._prevProjPos.y,
          this._prevProjPos.z,
          nextX,
          nextY,
          nextZ,
          pPos.x,
          yBot,
          yTop,
          pPos.z
        );

        if (distSq <= hitR * hitR) {
          playerController.applyDamage(proj.damage, proj.origin);
          proj.active = false;
          proj.mesh.visible = false;
          continue;
        }
      }

      // 3. Apply wall impact or advance bolt mesh
      if (wallHit) {
        if (this.vfxManager && typeof this.vfxManager.spawnImpact === 'function') {
          this.vfxManager.spawnImpact(wallHit.point, wallHit.normal, proj.material.color.getHex());
        }
        proj.active = false;
        proj.mesh.visible = false;
        continue;
      }

      proj.position.set(nextX, nextY, nextZ);
      proj.mesh.position.copy(proj.position);
    }
  }

  /**
   * Advance AEGIS-IX Orbital Laser Sweeps and deal active beam sweep damage to player.
   * Zero heap allocations.
   * @private
   */
  _updateOrbitalSweeps(dt, playerController) {
    if (!this._orbitalSweeps) return;
    const playerAlive = Boolean(playerController && playerController.isAlive);
    const pPos = playerAlive ? playerController.position : null;

    for (let i = 0; i < MAX_ORBITAL_SWEEPS; i++) {
      const sw = this._orbitalSweeps[i];
      if (!sw.active) continue;

      sw.age += dt;
      if (sw.hitCooldown > 0) {
        sw.hitCooldown = Math.max(0, sw.hitCooldown - dt);
      }
      const totalDur = sw.telegraphDuration + sw.sweepDuration;
      if (sw.age >= totalDur) {
        sw.active = false;
        continue;
      }

      if (playerAlive && pPos && sw.age >= sw.telegraphDuration && sw.hitCooldown <= 0) {
        const sp = Math.min(1, (sw.age - sw.telegraphDuration) / sw.sweepDuration);
        this._sweepBeamPos.lerpVectors(sw.startPos, sw.endPos, sp);
        const dx = pPos.x - this._sweepBeamPos.x;
        const dz = pPos.z - this._sweepBeamPos.z;
        const dy = Math.abs(pPos.y - this._sweepBeamPos.y);
        if (dx * dx + dz * dz <= sw.beamRadius * sw.beamRadius && dy < 7.0) {
          sw.hitCooldown = 0.45;
          playerController.applyDamage(sw.damage, this._sweepBeamPos);
        }
      }
    }
  }

  /**
   * Advance TRANSCENDENT-OMEGA Singularity Gravitational Pull hazard.
   * After a clear telegraph window (~1.1s), smoothly tugs player velocity inward inside pullRadius
   * while respecting Dash escape immunity and a safe melee floor clearance.
   * @private
   */
  _updateSingularityPull(dt, playerController) {
    const sp = this._singularityPull;
    if (!sp || !sp.active) return;

    sp.age += dt;
    const totalDur = sp.telegraphDuration + sp.pullDuration;
    if (sp.age >= totalDur) {
      sp.active = false;
      sp.boss = null;
      return;
    }

    if (sp.age < sp.telegraphDuration) return;
    if (!playerController || !playerController.isAlive || playerController.isDashing) return;
    if (typeof playerController.applyGravitationalPull !== 'function') return;

    const pPos = playerController.position;
    const dx = sp.origin.x - pPos.x;
    const dz = sp.origin.z - pPos.z;
    const horizSq = dx * dx + dz * dz;
    const maxSq = sp.pullRadius * sp.pullRadius;
    if (horizSq > 10.24 && horizSq <= maxSq) {
      playerController.applyGravitationalPull(dx, dz, sp.pullAccel, sp.maxPullSpeed, dt);
    }
  }

  /**
   * Advance interceptable shoulder-launched boss homing missiles (Zero-GC).
   * Climbs briefly after pod launch, steers toward player eye, and detonates cleanly
   * on impact OR mid-air weapon interception.
   * @private
   */
  _updateHomingMissiles(dt, playerController) {
    if (!this._homingMissiles) return;
    const playerAlive = Boolean(playerController && playerController.isAlive);
    const pPos = playerAlive ? playerController.position : null;
    if (playerAlive) {
      playerController.getEyePosition(this._hmSteerTarget);
      this._hmSteerTarget.y -= 0.25;
    }

    for (let i = 0; i < MAX_HOMING_MISSILES; i++) {
      const hm = this._homingMissiles[i];
      if (!hm.active) continue;

      hm.age += dt;
      if (hm.age >= hm.maxLife) {
        this._interceptHomingMissile(hm, false);
        continue;
      }

      if (playerAlive && hm.age >= hm.armDelay) {
        this._hmDesiredDir.subVectors(this._hmSteerTarget, hm.position);
        const dist = this._hmDesiredDir.length();
        if (dist > 0.05) {
          this._hmDesiredDir.multiplyScalar(1 / dist);
          const blend = 1 - Math.exp(-hm.turnRate * dt);
          hm.dir.lerp(this._hmDesiredDir, blend).normalize();
        }
      } else {
        hm.dir.y = Math.max(-0.2, hm.dir.y - dt * 0.55);
        hm.dir.normalize();
      }

      const speedScale = hm.age < hm.armDelay ? 0.68 : 1.0;
      const stepDist = hm.speed * speedScale * dt;
      const wallHit = this.collisionWorld.raycastWorld(hm.position, hm.dir, stepDist + 0.25, this._rayHit);
      if (wallHit && wallHit.distance <= stepDist + 0.15) {
        hm.position.copy(wallHit.point);
        this._interceptHomingMissile(hm, false);
        continue;
      }

      hm.position.addScaledVector(hm.dir, stepDist);
      hm.mesh.position.copy(hm.position);
      hm.mesh.quaternion.setFromUnitVectors(Z_AXIS, hm.dir);
      if (hm.ringMesh) {
        hm.ringMesh.rotation.z += dt * 7.5;
      }

      if (playerAlive && pPos) {
        const dx = pPos.x - hm.position.x;
        const dz = pPos.z - hm.position.z;
        const dy = hm.position.y - (pPos.y + 0.9);
        const hitR = PLAYER_CONFIG.radius + 0.52;
        if (dx * dx + dz * dz + dy * dy <= hitR * hitR) {
          playerController.applyDamage(hm.damage, hm.position);
          this._interceptHomingMissile(hm, false);
        }
      }
    }
  }

  /**
   * Return pre-allocated list of currently living Enemy targets (zero allocation).
   * @returns {Array<Enemy>}
   */
  getTargets() {
    return this._livingTargets;
  }

  /**
   * Return all active enemies (including those completing death dissolve animations).
   * @returns {Array<Enemy>}
   */
  getEnemies() {
    return this._enemies;
  }

  /**
   * Return live Boss HUD state snapshot, or null when no Boss is active.
   */
  getBossState() {
    const boss = this._bossEntity;
    if (!boss || !boss.isAlive) {
      return null;
    }
    const s = this._bossStateSnapshot;
    s.active = true;
    s.name = boss.archetype.name;
    s.hp = Math.ceil(boss.hp);
    s.maxHp = boss.maxHp;
    s.hpRatio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    s.phase = boss.currentPhase;
    s.phaseName = boss._phaseName || `${boss.currentPhase}페이즈`;
    s.shieldActive = boss._phaseShieldTimer > 0 || Boolean(boss._turretShieldActive);
    s.turretShieldActive = Boolean(boss._turretShieldActive);
    s.coreExposed = (boss._coreExposedTimer || 0) > 0;
    const tStats =
      this._interactables && typeof this._interactables.getBossTurretStats === 'function'
        ? this._interactables.getBossTurretStats()
        : null;
    s.turretsAlive = tStats ? tStats.alive : 0;
    s.turretsTotal = tStats ? tStats.total : 0;
    const isWingBoss = boss.archetype && boss.archetype.id === 'aegis_overlord_boss';
    s.isWingCoreBoss = isWingBoss;
    s.wingCoreTotal = isWingBoss ? 2 : 0;
    s.wingCoreLAlive = isWingBoss && (boss._wingCoreHpL || 0) > 0;
    s.wingCoreRAlive = isWingBoss && (boss._wingCoreHpR || 0) > 0;
    s.wingCoreAlive = (s.wingCoreLAlive ? 1 : 0) + (s.wingCoreRAlive ? 1 : 0);
    s.position.copy(boss.position);
    return s;
  }

  /**
   * Return zero-allocation HUD/director state snapshot.
   */
  getActiveEnemies() {
    return this._livingTargets || [];
  }

  getHudState() {
    const s = this._hudSnapshot;
    const wave =
      this._currentWaveIndex >= 0 && this._currentWaveIndex < WAVES.length
        ? WAVES[this._currentWaveIndex]
        : null;

    s.wave = this.endlessMode
      ? (this.endlessLoop || 0) * WAVES.length + (wave ? wave.wave : 0)
      : (wave ? wave.wave : 0);
    s.totalWaves = this.endlessMode ? 0 : WAVES.length;
    s.waveName = wave ? wave.name : '';
    s.subtitle = wave ? wave.subtitle : '';
    s.objective = wave ? wave.objective : '';
    s.objectiveType = wave ? wave.objectiveType : 'eliminate';
    s.controlZoneActive = wave ? wave.controlZoneActive : false;
    s.isBossWave = wave ? wave.isBossWave : false;
    s.enemiesAlive = this._livingTargets.length;
    s.enemiesQueued = this._spawnQueue.length;
    s.enemiesRemaining = s.enemiesAlive + s.enemiesQueued;
    s.score = this.score;
    s.combo = this.combo;
    s.comboProgress =
      this._comboTimer > 0 ? Math.max(0, Math.min(1, this._comboTimer / SCORE_CONFIG.comboTimeout)) : 0;
    s.kills = this.totalKills;
    s.headshots = this.headshots;
    s.inIntermission = this._inIntermission;
    s.intermissionRemaining = Math.max(0, this._intermissionTimer);
    s.awaitingMapTransition = this._awaitingMapTransition;
    s.awaitingTransferGate = this._awaitingTransferGate;
    s.transferNextMapIndex = this._pendingTransitionPayload ? this._pendingTransitionPayload.nextMapIndex : -1;
    s.mapIndex = this._currentMapIndex;
    s.victory = this._victory;
    s.combatIntensity = this._combatIntensity;
    s.zoneProgress = this._fallbackZoneProgress;
    return s;
  }

  /**
   * Clean up all listeners, pooled enemies, pooled projectiles, and shared model caches.
   */
  dispose() {
    if (this._unsubBossPhase) {
      this._unsubBossPhase();
      this._unsubBossPhase = null;
    }
    if (this._unsubTeleport) {
      this._unsubTeleport();
      this._unsubTeleport = null;
    }
    if (this._unsubWingCore) {
      this._unsubWingCore();
      this._unsubWingCore = null;
    }
    if (this._unsubOrbitalSweep) {
      this._unsubOrbitalSweep();
      this._unsubOrbitalSweep = null;
    }
    if (this._unsubDroneSalvo) {
      this._unsubDroneSalvo();
      this._unsubDroneSalvo = null;
    }
    if (this._unsubSingularityPull) {
      this._unsubSingularityPull();
      this._unsubSingularityPull = null;
    }
    if (this._unsubHomingMissiles) {
      this._unsubHomingMissiles();
      this._unsubHomingMissiles = null;
    }
    if (this._unsubHazardField) {
      this._unsubHazardField();
      this._unsubHazardField = null;
    }

    this.reset();

    for (const key of Object.keys(this._enemyPool)) {
      const bucket = this._enemyPool[key];
      for (let i = 0; i < bucket.length; i++) {
        bucket[i].dispose();
      }
      bucket.length = 0;
    }
    this._prewarmed = false;

    if (this._enemyGroup && this._enemyGroup.parent) {
      this._enemyGroup.parent.remove(this._enemyGroup);
    }

    if (this._projGroup && this._projGroup.parent) {
      this._projGroup.parent.remove(this._projGroup);
    }
    for (let i = 0; i < this._projectiles.length; i++) {
      this._projectiles[i].material.dispose();
    }
    if (this._mortarRings) {
      for (let i = 0; i < this._mortarRings.length; i++) {
        this._mortarRings[i].outerMat.dispose();
        this._mortarRings[i].fillMat.dispose();
      }
    }
    if (this._mortarOuterGeo) this._mortarOuterGeo.dispose();
    if (this._mortarFillGeo) this._mortarFillGeo.dispose();
    if (this._projOuterGeo) this._projOuterGeo.dispose();
    if (this._projCoreGeo) this._projCoreGeo.dispose();
    if (this._projCoreMat) this._projCoreMat.dispose();
    if (this._missileBodyGeo) this._missileBodyGeo.dispose();
    if (this._missileGlowGeo) this._missileGlowGeo.dispose();
    if (this._missileRingGeo) this._missileRingGeo.dispose();
    if (this._missileBodyMat) this._missileBodyMat.dispose();
    if (this._missileGlowMat) this._missileGlowMat.dispose();
    if (this.modelFactory) this.modelFactory.dispose();
  }
}
  __exports.WaveDirector = WaveDirector;
});
