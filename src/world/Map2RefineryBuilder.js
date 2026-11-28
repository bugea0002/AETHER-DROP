// Module: src/world/Map2RefineryBuilder.js
__define("src/world/Map2RefineryBuilder.js", (__exports, __require) => {
const { ARENA_CONFIG } = __require("src/config/constants.js");
const { TextureGenerator } = __require("src/world/TextureGenerator.js");

/**
 * Deterministic fast PRNG (Mulberry32) for consistent industrial skyline placement.
 * @param {number} seed
 * @returns {() => number}
 */
function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scale UVs of an ExtrudeGeometry (emitted in world meters) so seamless
 * industrial PBR textures map at crisp real-world scale.
 * @param {THREE.BufferGeometry} geo
 * @param {number} [scaleU=0.22]
 * @param {number} [scaleV=0.22]
 */
function scaleGeometryUVs(geo, scaleU = 0.22, scaleV = 0.22) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * scaleU, uv.getY(i) * scaleV);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Compute world-metric BoxGeometry UVs from each vertex's position and normal
 * so arbitrary rectangular hulls, skybridges, steps, and fascias maintain
 * uniform 1:1 texel density without anisotropic stretching.
 * @param {THREE.BufferGeometry} geo
 * @param {number} w
 * @param {number} h
 * @param {number} d
 * @param {number} [tileU=1]
 * @param {number} [tileV=1]
 */
function scaleBoxUVs(geo, w, h, d, tileU = 1, tileV = 1) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (!pos || !norm || !uv) return geo;

  const invU = tileU > 1e-6 ? 1 / tileU : 1;
  const invV = tileV > 1e-6 ? 1 / tileV : 1;

  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    if (nx > 0.5) {
      uv.setXY(i, (z + d * 0.5) * invU, (y + h * 0.5) * invV);
    } else if (ny > 0.5) {
      uv.setXY(i, (x + w * 0.5) * invU, (z + d * 0.5) * invV);
    } else {
      uv.setXY(i, (x + w * 0.5) * invU, (y + h * 0.5) * invV);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Map 2 Builder — "SECTOR-14 // SUNKEN REFINERY" (Waves 3 & 4).
 * Constructs a smog-choked, post-apocalyptic sunken rust refinery & central elevated
 * smelter crucible (64m x 64m, inner bounds ±31.5m, wall height 11m) using sculpted
 * ExtrudeGeometry, LatheGeometry, TubeGeometry, InstancedMesh batching, and shared
 * procedural Canvas PBR textures with 1:1 CollisionWorld AABB registration.
 *
 * Strictly zero neon styling, zero MeshPhysicalMaterial, and <= 2 PointLights.
 */
class Map2RefineryBuilder {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../physics/CollisionWorld.js').CollisionWorld} collisionWorld
   * @param {any} [qualityConfig={}]
   * @param {TextureGenerator|null} [sharedTexGen=null]
   */
  constructor(scene, collisionWorld, qualityConfig = {}, sharedTexGen = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.qualityConfig = qualityConfig || {};

    this._sharedTexGen = sharedTexGen || null;
    this._ownsTexGen = !sharedTexGen;
    this._texGen = sharedTexGen || new TextureGenerator(4);

    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_SECTOR14';

    /** @type {THREE.BufferGeometry[]} */
    this._geometries = [];
    /** @type {THREE.Material[]} */
    this._materials = [];
    /** @type {THREE.Light[]} */
    this._lights = [];
    /** @type {THREE.PointLight[]} */
    this._accentLights = [];
    /** @type {THREE.DirectionalLight|null} */
    this._dirLight = null;
    /** @type {THREE.HemisphereLight|null} */
    this._hemiLight = null;

    // Animated hero refs (mutated zero-GC inside update())
    this._turbineRotor = null;
    this._furnaceGlowMat = null;
    this._furnaceLight = null;
    this._pipeGlowLight = null;
    this._beaconMat = null;
    this._signboardMats = [];

    this._built = false;
  }

  /** @private */
  _trackGeo(geo) {
    this._geometries.push(geo);
    return geo;
  }

  /** @private */
  _trackMat(mat) {
    this._materials.push(mat);
    return mat;
  }

  /**
   * Build the complete SECTOR-14 // SUNKEN REFINERY arena and return structured arenaData.
   */
  build() {
    if (this._built) {
      this.dispose();
    }
    if (!this._texGen) {
      this._ownsTexGen = !this._sharedTexGen;
      this._texGen = this._sharedTexGen || new TextureGenerator(4);
    }

    this._built = true;
    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_SECTOR14';
    this.scene.add(this.root);

    const half = ARENA_CONFIG.halfSize || 32; // 32
    const innerBound = half - 0.5; // 31.5
    const wallH = ARENA_CONFIG.wallHeight || 11; // 11

    // Register inner bounds with minY = -10 so falls into Molten Slag Pit drop smoothly to -3.8m
    this.collisionWorld.setArenaBounds(-innerBound, innerBound, -innerBound, innerBound, -10, 28);

    // 1. Industrial Post-Apocalyptic PBR Materials
    const mats = this._createMaterials();

    // 2. Open Center Molten Slag Pit & 4 Outer Concrete Basin Walkways + Perimeter Walls
    this._buildBasinFloorAndChannels(mats, innerBound);
    this._buildPerimeterWalls(mats, innerBound, wallH);
    this._buildWallSignboards(mats, innerBound);

    // 3. Central Smelter Island & 4 Narrow Cross-Bridges Over the Boiling Slag Pit (y=0.2m)
    this._buildCentralSmelterHub(mats);

    // 4. Crossing High Skybridges (y=4.2m), Ramps, Silos & Perimeter Industrial Cover
    this._buildSkybridgesAndRamps(mats);
    this._buildDistillationSilosAndPipelines(mats);
    this._buildIndustrialCover(mats);

    // 5. Distant Refinery Smokestacks, Cooling Towers & Smog Dome
    this._buildSkylineAndSkyDome(mats);

    // 6. Smoggy Amber Atmospheric Lighting
    this._buildLighting();
    this.setQuality(this.qualityConfig);

    // 8 rectangular Pit Zones forming the 4 boiling Slag Quadrants outside bridges (±2.6) & center hub (±5.5)
    const pitReturn = { x: 0, y: 0.25, z: 20.5 };
    const pitZones = [
      { minX: -16.0, maxX: -5.5, minZ: -16.0, maxZ: -2.6, triggerY: -1.1, damage: 35, returnPos: pitReturn },
      { minX: -5.5, maxX: -2.6, minZ: -16.0, maxZ: -5.5, triggerY: -1.1, damage: 35, returnPos: pitReturn },
      { minX: 5.5, maxX: 16.0, minZ: -16.0, maxZ: -2.6, triggerY: -1.1, damage: 35, returnPos: pitReturn },
      { minX: 2.6, maxX: 5.5, minZ: -16.0, maxZ: -5.5, triggerY: -1.1, damage: 35, returnPos: pitReturn },
      { minX: -16.0, maxX: -5.5, minZ: 2.6, maxZ: 16.0, triggerY: -1.1, damage: 35, returnPos: pitReturn },
      { minX: -5.5, maxX: -2.6, minZ: 5.5, maxZ: 16.0, triggerY: -1.1, damage: 35, returnPos: pitReturn },
      { minX: 5.5, maxX: 16.0, minZ: 2.6, maxZ: 16.0, triggerY: -1.1, damage: 35, returnPos: pitReturn },
      { minX: 2.6, maxX: 5.5, minZ: 5.5, maxZ: 16.0, triggerY: -1.1, damage: 35, returnPos: pitReturn },
    ];

    const arenaData = {
      mapId: 'sunken_refinery',
      mapIndex: 1,
      mapCode: '제14구역',
      mapName: '제14구역 · 가라앉은 정유소',
      mapSubtitle: '용광로 용융 구덩이 & 교량 밸브 구역',
      atmosphere: {
        bgColor: 0x3b352e,
        fogColor: 0x4d473f,
        fogDensity: 0.0135,
      },
      playerSpawn: {
        pos: new THREE.Vector3(0, 0.05, 25.5),
        yaw: 0,
      },
      enemySpawns: [
        { pos: new THREE.Vector3(0.0, 0.25, -19.5), isElevated: false },
        { pos: new THREE.Vector3(-14.0, 0.05, -26.5), isElevated: false },
        { pos: new THREE.Vector3(14.0, 0.05, -26.5), isElevated: false },
        { pos: new THREE.Vector3(-26.5, 0.05, 0.0), isElevated: false },
        { pos: new THREE.Vector3(26.5, 0.05, 0.0), isElevated: false },
        { pos: new THREE.Vector3(-21.5, 0.05, -18.5), isElevated: false },
        { pos: new THREE.Vector3(21.5, 0.05, -18.5), isElevated: false },
        { pos: new THREE.Vector3(0.0, 0.25, -12.0), isElevated: false },
        { pos: new THREE.Vector3(-18.0, 4.25, 0.0), isElevated: true },
        { pos: new THREE.Vector3(18.0, 4.25, 0.0), isElevated: true },
        { pos: new THREE.Vector3(0.0, 4.25, -18.0), isElevated: true },
        { pos: new THREE.Vector3(0.0, 4.25, 18.0), isElevated: true },
      ],
      pickupSpawns: [
        { pos: new THREE.Vector3(-18.0, 4.2, -18.0), type: 'shield' },
        { pos: new THREE.Vector3(18.0, 4.2, -18.0), type: 'health' },
        { pos: new THREE.Vector3(-18.0, 4.2, 18.0), type: 'ammo' },
        { pos: new THREE.Vector3(18.0, 4.2, 18.0), type: 'shield' },
        { pos: new THREE.Vector3(-14.0, 0.0, 26.5), type: 'health' },
        { pos: new THREE.Vector3(14.0, 0.0, 26.5), type: 'ammo' },
      ],
      barrelSpawns: [
        new THREE.Vector3(0.0, 0.2, -6.8),
        new THREE.Vector3(-6.8, 0.2, 0.0),
        new THREE.Vector3(6.8, 0.2, 0.0),
        new THREE.Vector3(-20.0, 0.0, -4.5),
        new THREE.Vector3(20.0, 0.0, -4.5),
        new THREE.Vector3(0.0, 0.0, -24.0),
      ],
      jumpPadSpawns: [
        { pos: new THREE.Vector3(-7.5, 0.0, -28.5), launchVy: 17.0, launchDirX: 0, launchDirZ: 1 },
        { pos: new THREE.Vector3(7.5, 0.0, 28.5), launchVy: 17.0, launchDirX: 0, launchDirZ: -1 },
        { pos: new THREE.Vector3(-28.5, 0.0, 7.5), launchVy: 17.0, launchDirX: 1, launchDirZ: 0 },
        { pos: new THREE.Vector3(28.5, 0.0, -7.5), launchVy: 17.0, launchDirX: -1, launchDirZ: 0 },
      ],
      pitZones,
      steamValves: [
        { x: -4.2, y: 0.2, z: -4.2, yaw: 0.78, interval: 10.0, offset: 1.5, radius: 7.4, force: 22 },
        { x: 4.2, y: 0.2, z: -4.2, yaw: -0.78, interval: 10.0, offset: 4.0, radius: 7.4, force: 22 },
        { x: -4.2, y: 0.2, z: 4.2, yaw: 2.35, interval: 10.0, offset: 6.5, radius: 7.4, force: 22 },
        { x: 4.2, y: 0.2, z: 4.2, yaw: -2.35, interval: 10.0, offset: 9.0, radius: 7.4, force: 22 },
      ],
      destructibleBarricades: [
        { x: -4.8, y: 0, z: 18.2, yaw: 0 },
        { x: 4.8, y: 0, z: 18.2, yaw: 0 },
        { x: -4.8, y: 0, z: -18.2, yaw: 0 },
        { x: 4.8, y: 0, z: -18.2, yaw: 0 },
      ],
      controlZoneCenter: new THREE.Vector3(0, 0.2, -10.5),
      controlZoneRadius: ARENA_CONFIG.controlZoneRadius,
      arenaBounds: {
        minX: -innerBound,
        maxX: innerBound,
        minZ: -innerBound,
        maxZ: innerBound,
      },
    };

    return arenaData;
  }

  /**
   * Create industrial rusted-steel, corroded iron, concrete, and furnace-amber PBR materials.
   * Zero MeshPhysicalMaterial and zero neon colors.
   * @private
   */
  _createMaterials() {
    const floorTex =
      typeof this._texGen.getRefineryFloorTextures === 'function'
        ? this._texGen.getRefineryFloorTextures(16, 16)
        : this._texGen.getFloorTextures(16, 16);
    const wallTex = this._texGen.getWallTextures(10, 2);
    const coverWallTex = this._texGen.getWallTextures(1, 1);
    const catwalkTex = this._texGen.getCatwalkTextures(1, 1);
    const daisGrateTex = this._texGen.getCatwalkTextures(4, 4);
    const rustTex = this._texGen.getRustMetalTextures(1, 1);
    const rustPipeTex = this._texGen.getRustMetalTextures(6, 1);
    const hazardTex = this._texGen.getHazardTextures(1, 1);
    const skylineTex = this._texGen.getRuinedSkylineTextures();

    const floorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: floorTex.map,
        roughnessMap: floorTex.roughnessMap,
        bumpMap: floorTex.bumpMap,
        bumpScale: 0.045,
        color: 0xd9d0c4,
        metalness: 0.24,
        roughness: 0.88,
      })
    );

    const wallMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: wallTex.map,
        roughnessMap: wallTex.roughnessMap,
        bumpMap: wallTex.bumpMap,
        bumpScale: 0.06,
        color: 0xd8cfc4,
        metalness: 0.28,
        roughness: 0.86,
      })
    );

    const coverConcreteMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: coverWallTex.map,
        roughnessMap: coverWallTex.roughnessMap,
        bumpMap: coverWallTex.bumpMap,
        bumpScale: 0.05,
        color: 0xd4cbc0,
        metalness: 0.35,
        roughness: 0.82,
      })
    );

    const rustSteelMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: rustTex.map,
        roughnessMap: rustTex.roughnessMap,
        bumpMap: rustTex.bumpMap,
        bumpScale: 0.055,
        color: 0xc9b4a0,
        metalness: 0.68,
        roughness: 0.72,
      })
    );

    const rustPipeMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: rustPipeTex.map,
        roughnessMap: rustPipeTex.roughnessMap,
        bumpMap: rustPipeTex.bumpMap,
        bumpScale: 0.048,
        color: 0xcab29c,
        metalness: 0.72,
        roughness: 0.64,
      })
    );

    const darkIronMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2c2623,
        roughnessMap: rustTex.roughnessMap,
        bumpMap: rustTex.bumpMap,
        bumpScale: 0.036,
        metalness: 0.76,
        roughness: 0.56,
      })
    );

    const copperValveMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x875c38,
        roughnessMap: rustTex.roughnessMap,
        metalness: 0.8,
        roughness: 0.44,
      })
    );

    const catwalkMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: catwalkTex.map,
        roughnessMap: catwalkTex.roughnessMap,
        bumpMap: catwalkTex.bumpMap,
        bumpScale: 0.04,
        color: 0xd8cfc6,
        metalness: 0.72,
        roughness: 0.62,
      })
    );

    const daisGrateMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: daisGrateTex.map,
        roughnessMap: daisGrateTex.roughnessMap,
        bumpMap: daisGrateTex.bumpMap,
        bumpScale: 0.038,
        color: 0xd2c7bc,
        metalness: 0.72,
        roughness: 0.62,
      })
    );

    const stepMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: catwalkTex.map,
        roughnessMap: catwalkTex.roughnessMap,
        bumpMap: catwalkTex.bumpMap,
        bumpScale: 0.038,
        color: 0xd8cfc6,
        metalness: 0.72,
        roughness: 0.64,
      })
    );

    const hazardMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: hazardTex.map,
        roughnessMap: hazardTex.roughnessMap,
        bumpMap: hazardTex.bumpMap,
        bumpScale: 0.038,
        metalness: 0.34,
        roughness: 0.76,
      })
    );

    const furnaceGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffa64d,
        emissive: new THREE.Color(0xff5a12),
        emissiveIntensity: 2.0,
        roughness: 0.3,
        metalness: 0.1,
      })
    );

    const amberLampMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffca7a,
        emissive: new THREE.Color(0xd97a1c),
        emissiveIntensity: 1.45,
        roughness: 0.28,
        metalness: 0.12,
      })
    );

    const skylineMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: skylineTex.map,
        roughnessMap: skylineTex.roughnessMap,
        color: 0xb0a396,
        roughness: 0.9,
        metalness: 0.22,
      })
    );

    const smokestackMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2b2420,
        roughness: 0.88,
        metalness: 0.36,
      })
    );

    const beaconMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xff5a1f,
      })
    );

    this._furnaceGlowMat = furnaceGlowMat;
    this._beaconMat = beaconMat;

    return {
      floorMat,
      wallMat,
      coverConcreteMat,
      rustSteelMat,
      rustPipeMat,
      darkIronMat,
      copperValveMat,
      catwalkMat,
      daisGrateMat,
      stepMat,
      hazardMat,
      furnaceGlowMat,
      amberLampMat,
      skylineMat,
      smokestackMat,
      beaconMat,
    };
  }

  /**
   * Build the 64m x 64m sunken concrete drainage basin floor and flush industrial trench grates.
   * @private
   */
  _buildBasinFloorAndChannels(mats, innerBound) {
    // 4 Walkable Perimeter Floor Strips around the Open Center Molten Slag Pit ([-16..16])
    const floorStrips = [
      { minX: -34, maxX: 34, minZ: -34, maxZ: -16 },
      { minX: -34, maxX: 34, minZ: 16, maxZ: 34 },
      { minX: -34, maxX: -16, minZ: -16, maxZ: 16 },
      { minX: 16, maxX: 34, minZ: -16, maxZ: 16 },
    ];
    for (let i = 0; i < floorStrips.length; i++) {
      const f = floorStrips[i];
      const w = f.maxX - f.minX;
      const d = f.maxZ - f.minZ;
      const cx = (f.minX + f.maxX) * 0.5;
      const cz = (f.minZ + f.maxZ) * 0.5;
      const mGeo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(w, 0.5, d), w, 0.5, d, 4.0, 4.0));
      const mesh = new THREE.Mesh(mGeo, mats.floorMat);
      mesh.position.set(cx, -0.25, cz);
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.collisionWorld.addBox(f.minX, -1.0, f.minZ, f.maxX, 0.0, f.maxZ, 'floor');
    }

    // Sunken Molten Slag Pit Lining + Glowing Magma Pool at y = -3.8m
    const pitWallGeo = this._trackGeo(new THREE.BoxGeometry(32.2, 4.2, 0.6));
    const pitWallZGeo = this._trackGeo(new THREE.BoxGeometry(0.6, 4.2, 32.2));
    for (const sz of [-16.2, 16.2]) {
      const pw = new THREE.Mesh(pitWallGeo, mats.darkIronMat);
      pw.position.set(0, -1.95, sz);
      this.root.add(pw);
    }
    for (const sx of [-16.2, 16.2]) {
      const pw = new THREE.Mesh(pitWallZGeo, mats.darkIronMat);
      pw.position.set(sx, -1.95, 0);
      this.root.add(pw);
    }
    const slagGeo = this._trackGeo(new THREE.PlaneGeometry(32.5, 32.5));
    slagGeo.rotateX(-Math.PI * 0.5);
    const slagMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xea580c,
        emissive: new THREE.Color(0xff4500),
        emissiveIntensity: 1.55,
        roughness: 0.42,
        metalness: 0.1,
      })
    );
    const slagMesh = new THREE.Mesh(slagGeo, slagMat);
    slagMesh.position.y = -3.8;
    this.root.add(slagMesh);
    this._furnaceGlowMat = slagMat;
    this.collisionWorld.addBox(-16.5, -4.8, -16.5, 16.5, -3.8, 16.5, 'pit_floor');
  }

  /**
   * Build 11m tall cracked concrete & corroded steel perimeter walls, beveled I-beam buttresses,
   * upper cornice beam, and warm sodium-amber bulkhead lamps (InstancedMesh).
   * @private
   */
  _buildPerimeterWalls(mats, innerBound, wallH) {
    const wallThick = 1.5;
    const wallSpan = innerBound * 2 + wallThick * 2;

    const wallGeoX = this._trackGeo(new THREE.BoxGeometry(wallSpan, wallH, wallThick));
    const wallGeoZ = this._trackGeo(new THREE.BoxGeometry(wallThick, wallH, wallSpan));

    const northWall = new THREE.Mesh(wallGeoX, mats.wallMat);
    northWall.position.set(0, wallH * 0.5, -(innerBound + wallThick * 0.5));
    northWall.receiveShadow = true;
    this.root.add(northWall);
    this.collisionWorld.addBox(
      -innerBound - wallThick, 0, -innerBound - wallThick,
      innerBound + wallThick, wallH + 4, -innerBound,
      'wall'
    );

    const southWall = new THREE.Mesh(wallGeoX, mats.wallMat);
    southWall.position.set(0, wallH * 0.5, innerBound + wallThick * 0.5);
    southWall.receiveShadow = true;
    this.root.add(southWall);
    this.collisionWorld.addBox(
      -innerBound - wallThick, 0, innerBound,
      innerBound + wallThick, wallH + 4, innerBound + wallThick,
      'wall'
    );

    const westWall = new THREE.Mesh(wallGeoZ, mats.wallMat);
    westWall.position.set(-(innerBound + wallThick * 0.5), wallH * 0.5, 0);
    westWall.receiveShadow = true;
    this.root.add(westWall);
    this.collisionWorld.addBox(
      -innerBound - wallThick, 0, -innerBound,
      -innerBound, wallH + 4, innerBound,
      'wall'
    );

    const eastWall = new THREE.Mesh(wallGeoZ, mats.wallMat);
    eastWall.position.set(innerBound + wallThick * 0.5, wallH * 0.5, 0);
    eastWall.receiveShadow = true;
    this.root.add(eastWall);
    this.collisionWorld.addBox(
      innerBound, 0, -innerBound,
      innerBound + wallThick, wallH + 4, innerBound,
      'wall'
    );

    // Sculpted beveled corrugated-steel upper parapet cornice framing the perimeter rim
    const corniceShape = new THREE.Shape();
    corniceShape.moveTo(0, 0);
    corniceShape.lineTo(1.0, 0);
    corniceShape.lineTo(1.25, 0.42);
    corniceShape.lineTo(1.25, 1.05);
    corniceShape.lineTo(0, 1.05);
    corniceShape.closePath();

    const corniceGeo = this._trackGeo(
      scaleGeometryUVs(
        new THREE.ExtrudeGeometry(corniceShape, {
          depth: innerBound * 2,
          bevelEnabled: true,
          bevelThickness: 0.06,
          bevelSize: 0.06,
          bevelSegments: 1,
        }),
        0.4,
        0.4
      )
    );
    corniceGeo.translate(0, 0, -innerBound);

    const corniceTransforms = [
      { pos: [-innerBound, wallH - 0.55, 0], rotY: 0 },
      { pos: [innerBound, wallH - 0.55, 0], rotY: Math.PI },
      { pos: [0, wallH - 0.55, -innerBound], rotY: -Math.PI * 0.5 },
      { pos: [0, wallH - 0.55, innerBound], rotY: Math.PI * 0.5 },
    ];
    for (let i = 0; i < corniceTransforms.length; i++) {
      const t = corniceTransforms[i];
      const m = new THREE.Mesh(corniceGeo, mats.rustSteelMat);
      m.position.set(t.pos[0], t.pos[1], t.pos[2]);
      m.rotation.y = t.rotY;
      this.root.add(m);
    }

    // 32 Sculpted Industrial I-Beam Wall Buttresses (ExtrudeGeometry + InstancedMesh -> 1 draw call!)
    const ribShape = new THREE.Shape();
    ribShape.moveTo(0, 0);
    ribShape.lineTo(0.55, 0);
    ribShape.lineTo(0.55, 1.6);
    ribShape.lineTo(0.38, 2.3);
    ribShape.lineTo(0.38, wallH - 1.3);
    ribShape.lineTo(0.62, wallH - 0.35);
    ribShape.lineTo(0.62, wallH + 0.35);
    ribShape.lineTo(0, wallH + 0.35);
    ribShape.closePath();

    const ribGeo = this._trackGeo(
      scaleGeometryUVs(
        new THREE.ExtrudeGeometry(ribShape, {
          depth: 0.68,
          bevelEnabled: true,
          bevelThickness: 0.06,
          bevelSize: 0.06,
          bevelSegments: 1,
        }),
        0.25,
        0.25
      )
    );
    ribGeo.translate(0, 0, -0.34);

    const ribOffsets = [-24.0, -17.5, -11.0, -4.5, 4.5, 11.0, 17.5, 24.0];
    const totalRibs = ribOffsets.length * 4;
    const ribInst = new THREE.InstancedMesh(ribGeo, mats.darkIronMat, totalRibs);
    ribInst.castShadow = true;
    ribInst.receiveShadow = true;

    // Industrial sodium-amber bulkhead warning lamps mounted high on wall ribs
    const lampGeo = this._trackGeo(new THREE.BoxGeometry(0.14, 0.56, 0.32));
    const lampInst = new THREE.InstancedMesh(lampGeo, mats.amberLampMat, totalRibs);

    const dummy = new THREE.Object3D();
    let idx = 0;

    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < ribOffsets.length; i++) {
        const off = ribOffsets[i];
        let x = 0;
        let z = 0;
        let rotY = 0;
        let lx = 0;
        let lz = 0;

        if (side === 0) {
          x = -innerBound;
          z = off;
          rotY = 0;
          lx = -innerBound + 0.41;
          lz = off;
        } else if (side === 1) {
          x = innerBound;
          z = off;
          rotY = Math.PI;
          lx = innerBound - 0.41;
          lz = off;
        } else if (side === 2) {
          x = off;
          z = -innerBound;
          rotY = -Math.PI * 0.5;
          lx = off;
          lz = -innerBound + 0.41;
        } else {
          x = off;
          z = innerBound;
          rotY = Math.PI * 0.5;
          lx = off;
          lz = innerBound - 0.41;
        }

        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        ribInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(lx, 4.8, lz);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        lampInst.setMatrixAt(idx, dummy.matrix);

        idx++;
      }
    }

    ribInst.instanceMatrix.needsUpdate = true;
    lampInst.instanceMatrix.needsUpdate = true;
    this.root.add(ribInst, lampInst);
  }

  /**
   * Build 4 weathered industrial refinery steel signboards mounted along the upper perimeter walls.
   * @private
   */
  _buildWallSignboards(mats, innerBound) {
    const configs = [
      {
        title: 'SECTOR-14',
        subtitle: 'SMELTER CRUCIBLE // 1180C',
        accent: '#d9822b',
        pos: [0, 7.8, -(innerBound - 0.45)],
        rotY: 0,
      },
      {
        title: 'REFINERY BASIN',
        subtitle: 'SLAG DRAINAGE // LEVEL-0',
        accent: '#c86428',
        pos: [0, 7.8, innerBound - 0.45],
        rotY: Math.PI,
      },
      {
        title: 'DISTILLATION W',
        subtitle: 'CRUDE MANIFOLD // PSI-HIGH',
        accent: '#d99038',
        pos: [-(innerBound - 0.45), 7.8, 0],
        rotY: Math.PI * 0.5,
      },
      {
        title: 'STEAM GANTRY E',
        subtitle: 'EXHAUST TURBINE // ACTIVE',
        accent: '#e07a24',
        pos: [innerBound - 0.45, 7.8, 0],
        rotY: -Math.PI * 0.5,
      },
    ];

    const signW = 5.4;
    const signH = 4.0;

    // Beveled riveted steel signboard frame bezel (ExtrudeGeometry)
    const frameShape = new THREE.Shape();
    const hw = signW * 0.5 + 0.34;
    const hh = signH * 0.5 + 0.34;
    const ch = 0.36;
    frameShape.moveTo(-hw + ch, -hh);
    frameShape.lineTo(hw - ch, -hh);
    frameShape.lineTo(hw, -hh + ch);
    frameShape.lineTo(hw, hh - ch);
    frameShape.lineTo(hw - ch, hh);
    frameShape.lineTo(-hw + ch, hh);
    frameShape.lineTo(-hw, hh - ch);
    frameShape.lineTo(-hw, -hh + ch);
    frameShape.closePath();

    const hole = new THREE.Path();
    const ihw = signW * 0.5 - 0.04;
    const ihh = signH * 0.5 - 0.04;
    hole.moveTo(-ihw, -ihh);
    hole.lineTo(ihw, -ihh);
    hole.lineTo(ihw, ihh);
    hole.lineTo(-ihw, ihh);
    hole.closePath();
    frameShape.holes.push(hole);

    const frameGeo = this._trackGeo(
      scaleGeometryUVs(
        new THREE.ExtrudeGeometry(frameShape, {
          depth: 0.28,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.05,
          bevelSegments: 1,
        }),
        0.5,
        0.5
      )
    );
    const panelGeo = this._trackGeo(new THREE.PlaneGeometry(signW, signH));
    const hoodGeo = this._trackGeo(new THREE.BoxGeometry(signW + 0.5, 0.22, 0.65));

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const tex = this._texGen.getSignboardTexture(cfg.title, cfg.subtitle, cfg.accent);
      const signMat = this._trackMat(
        new THREE.MeshStandardMaterial({
          map: tex,
          emissive: new THREE.Color(0x553318),
          emissiveMap: tex,
          emissiveIntensity: 0.65,
          roughness: 0.62,
          metalness: 0.28,
        })
      );
      this._signboardMats.push(signMat);

      const group = new THREE.Group();
      group.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      group.rotation.y = cfg.rotY;

      const frameMesh = new THREE.Mesh(frameGeo, mats.rustSteelMat);
      frameMesh.position.z = -0.14;
      group.add(frameMesh);

      const hoodMesh = new THREE.Mesh(hoodGeo, mats.darkIronMat);
      hoodMesh.position.set(0, hh + 0.14, 0.15);
      group.add(hoodMesh);

      const panelMesh = new THREE.Mesh(panelGeo, signMat);
      panelMesh.position.z = 0.05;
      group.add(panelMesh);

      this.root.add(group);
    }
  }

  /**
   * Build Central Elevated Smelter / Control Platform (16m x 16m octagonal deck at y = 1.6m),
   * 4 wide 5-step steel stairways (0.32m rise <= 0.35m), and overhead smelter collector hood
   * with rotating turbine exhaust blades at y = 8.1..11.4m.
   * @private
   */
  _buildCentralSmelterHub(mats) {
    const deckY = 0.20; // Clean low bridge lip <= stepHeight so sprinting onto bridges is seamless!
    const bridgeSpans = [
      // Central Foundry Island Deck (11m x 11m over deep pier)
      { minX: -5.5, maxX: 5.5, minZ: -5.5, maxZ: 5.5, pier: true },
      // 4 Crossing Steel Bridges (5.2m wide) connecting N/S/W/E perimeter walkways across the boiling slag!
      { minX: -2.6, maxX: 2.6, minZ: -16.4, maxZ: -5.5, pier: false },
      { minX: -2.6, maxX: 2.6, minZ: 5.5, maxZ: 16.4, pier: false },
      { minX: -16.4, maxX: -5.5, minZ: -2.6, maxZ: 2.6, pier: false },
      { minX: 5.5, maxX: 16.4, minZ: -2.6, maxZ: 2.6, pier: false },
    ];

    for (let i = 0; i < bridgeSpans.length; i++) {
      const b = bridgeSpans[i];
      const w = b.maxX - b.minX;
      const d = b.maxZ - b.minZ;
      const cx = (b.minX + b.maxX) * 0.5;
      const cz = (b.minZ + b.maxZ) * 0.5;
      const slabH = b.pier ? 4.0 : 0.45;
      const slabGeo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(w, slabH, d), w, slabH, d, 2.2, 2.2));
      const mesh = new THREE.Mesh(slabGeo, mats.daisGrateMat);
      mesh.position.set(cx, deckY - slabH * 0.5, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);

      const curbGeo = this._trackGeo(new THREE.BoxGeometry(w + 0.08, 0.14, d + 0.08));
      const curb = new THREE.Mesh(curbGeo, mats.hazardMat);
      curb.position.set(cx, deckY - 0.1, cz);
      this.root.add(curb);

      this.collisionWorld.addBox(b.minX, deckY - slabH, b.minZ, b.maxX, deckY, b.maxZ, 'platform');
    }

    // Overhead Smelter Exhaust Hood Suspended High (y=10.2m) so bridges have wide-open combat flow
    const hoodGeo = this._trackGeo(new THREE.CylinderGeometry(2.6, 4.4, 2.4, 8));
    const hood = new THREE.Mesh(hoodGeo, mats.darkIronMat);
    hood.position.set(0, 10.6, 0);
    this.root.add(hood);
    const rotorGeo = this._trackGeo(new THREE.BoxGeometry(6.8, 0.18, 0.52));
    this._turbineRotor = new THREE.Group();
    this._turbineRotor.position.set(0, 9.2, 0);
    const rA = new THREE.Mesh(rotorGeo, mats.rustSteelMat);
    const rB = new THREE.Mesh(rotorGeo, mats.rustSteelMat);
    rB.rotation.y = Math.PI * 0.5;
    this._turbineRotor.add(rA, rB);
    this.root.add(this._turbineRotor);
  }

  /**
   * Build the 4 Crossing High Pipeline Skybridges (y = 4.2m) forming an interconnected
   * perimeter loop (West/East/North/South), 12 steel H-beam stanchions, half-cover parapet
   * rails, and 4 smooth stepped industrial access ramps (14 steps x 0.30m <= 0.35m).
   * @private
   */
  _buildSkybridgesAndRamps(mats) {
    const deckY = 4.2;
    const deckThick = 0.36;
    const deckW = 4.0;

    // 4 Intersecting Skybridge Segments (non-overlapping Z-fighting-free geometry & AABBs)
    const bridgeSpecs = [
      // West & East span full z ∈ [-20, 20] (length 40m)
      { x: -18.0, z: 0, w: deckW, d: 40.0, isZ: true },
      { x: 18.0, z: 0, w: deckW, d: 40.0, isZ: true },
      // North & South span between West & East inner edges x ∈ [-16, 16] (length 32m)
      { x: 0, z: -18.0, w: 32.0, d: deckW, isZ: false },
      { x: 0, z: 18.0, w: 32.0, d: deckW, isZ: false },
    ];

    for (let i = 0; i < bridgeSpecs.length; i++) {
      const b = bridgeSpecs[i];
      const hullH = deckThick - 0.06;
      const hullGeo = this._trackGeo(
        scaleBoxUVs(new THREE.BoxGeometry(b.w, hullH, b.d), b.w, hullH, b.d, 3.0, 3.0)
      );
      const hullMesh = new THREE.Mesh(hullGeo, mats.rustSteelMat);
      hullMesh.position.set(b.x, deckY - deckThick * 0.5 - 0.03, b.z);
      hullMesh.castShadow = true;
      hullMesh.receiveShadow = true;
      this.root.add(hullMesh);

      const grateW = b.isZ ? b.w - 0.14 : b.d - 0.14;
      const grateD = b.isZ ? b.d - 0.14 : b.w - 0.14;
      const grateGeo = this._trackGeo(
        scaleBoxUVs(new THREE.BoxGeometry(grateW, 0.06, grateD), grateW, 0.06, grateD, 2.0, 2.0)
      );
      const grateMesh = new THREE.Mesh(grateGeo, mats.catwalkMat);
      grateMesh.position.set(b.x, deckY - 0.03, b.z);
      if (!b.isZ) {
        grateMesh.rotation.y = Math.PI * 0.5;
      }
      grateMesh.receiveShadow = true;
      this.root.add(grateMesh);

      // Hazard side fascia border strip along lower lip
      const fasciaW = b.w + 0.06;
      const fasciaD = b.d + 0.06;
      const fasciaGeo = this._trackGeo(
        scaleBoxUVs(new THREE.BoxGeometry(fasciaW, 0.12, fasciaD), fasciaW, 0.12, fasciaD, 1.2, 0.4)
      );
      const fasciaMesh = new THREE.Mesh(fasciaGeo, mats.hazardMat);
      fasciaMesh.position.set(b.x, deckY - deckThick + 0.08, b.z);
      this.root.add(fasciaMesh);

      // 1:1 Catwalk Deck AABB
      this.collisionWorld.addBox(
        b.x - b.w * 0.5,
        deckY - deckThick,
        b.z - b.d * 0.5,
        b.x + b.w * 0.5,
        deckY,
        b.z + b.d * 0.5,
        'catwalk'
      );
    }

    // Sculpted Ballistic Steel Half-Cover Parapet Rails on Skybridges (height = 1.08m -> y = 4.2..5.28m)
    // Leaves all 4 ramp entries AND all 4 jump-pad landing apertures wide open!
    const railShape = new THREE.Shape();
    railShape.moveTo(-0.17, 0);
    railShape.lineTo(0.17, 0);
    railShape.lineTo(0.17, 0.88);
    railShape.lineTo(0.08, 1.08);
    railShape.lineTo(-0.10, 1.08);
    railShape.lineTo(-0.17, 0.88);
    railShape.closePath();

    const makeRailGeo = (len) => {
      const geo = this._trackGeo(
        scaleGeometryUVs(
          new THREE.ExtrudeGeometry(railShape, {
            depth: len,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.03,
            bevelSegments: 1,
          }),
          0.7,
          0.7
        )
      );
      geo.translate(0, 0, -len * 0.5);
      return geo;
    };

    const rail50Geo = makeRailGeo(5.0);
    const rail80Geo = makeRailGeo(8.0);

    const railSpecs = [
      // Inner edge rails (two 5.0m wings per side at ±10.5 -> leaving wide 16m center sightline/drop & jump-pad clear zone)
      { x: -16.2, z: -10.5, rotY: 0, len: 5.0, geo: rail50Geo },
      { x: -16.2, z: 10.5, rotY: 0, len: 5.0, geo: rail50Geo },
      { x: 16.2, z: -10.5, rotY: 0, len: 5.0, geo: rail50Geo },
      { x: 16.2, z: 10.5, rotY: 0, len: 5.0, geo: rail50Geo },
      { x: -10.5, z: -16.2, rotY: Math.PI * 0.5, len: 5.0, geo: rail50Geo },
      { x: 10.5, z: -16.2, rotY: Math.PI * 0.5, len: 5.0, geo: rail50Geo },
      { x: -10.5, z: 16.2, rotY: Math.PI * 0.5, len: 5.0, geo: rail50Geo },
      { x: 10.5, z: 16.2, rotY: Math.PI * 0.5, len: 5.0, geo: rail50Geo },
      // Outer edge safety rails placed ONLY opposite the jump-pad landing zones
      { x: -19.8, z: -8.5, rotY: 0, len: 8.0, geo: rail80Geo },
      { x: 19.8, z: 8.5, rotY: 0, len: 8.0, geo: rail80Geo },
      { x: 8.5, z: -19.8, rotY: Math.PI * 0.5, len: 8.0, geo: rail80Geo },
      { x: -8.5, z: 19.8, rotY: Math.PI * 0.5, len: 8.0, geo: rail80Geo },
    ];

    for (let i = 0; i < railSpecs.length; i++) {
      const r = railSpecs[i];
      const railMesh = new THREE.Mesh(r.geo, mats.rustSteelMat);
      railMesh.position.set(r.x, deckY, r.z);
      railMesh.rotation.y = r.rotY;
      railMesh.castShadow = true;
      railMesh.receiveShadow = true;
      this.root.add(railMesh);

      const isXSpan = Math.abs(Math.sin(r.rotY)) > 0.5;
      const hx = isXSpan ? r.len * 0.5 : 0.19;
      const hz = isXSpan ? 0.19 : r.len * 0.5;
      this.collisionWorld.addBox(r.x - hx, deckY, r.z - hz, r.x + hx, deckY + 1.1, r.z + hz, 'cover');
    }

    // 12 Steel Support Stanchions + 24 High-Clearance Knee Braces (InstancedMesh)
    const stanchionCoords = [
      [-16.3, -16.3], [16.3, -16.3], [-16.3, 16.3], [16.3, 16.3],
      [-19.7, -12.8], [-19.7, 12.8], [19.7, -12.8], [19.7, 12.8],
      [-12.8, -19.7], [12.8, -19.7], [-12.8, 19.7], [12.8, 19.7],
    ];
    const colH = deckY - deckThick; // 3.84m
    const colGeo = this._trackGeo(
      scaleBoxUVs(new THREE.BoxGeometry(0.52, colH, 0.52), 0.52, colH, 0.52, 1.2, 1.2)
    );
    const colInst = new THREE.InstancedMesh(colGeo, mats.darkIronMat, stanchionCoords.length);
    colInst.castShadow = true;
    colInst.receiveShadow = true;

    const collarBaseGeo = this._trackGeo(
      scaleBoxUVs(new THREE.BoxGeometry(0.68, 0.42, 0.68), 0.68, 0.42, 0.68, 1.2, 0.42)
    );
    const collarInst = new THREE.InstancedMesh(collarBaseGeo, mats.hazardMat, stanchionCoords.length);

    const braceGeo = this._trackGeo(new THREE.BoxGeometry(1.4, 0.18, 0.18));
    const braceInst = new THREE.InstancedMesh(braceGeo, mats.darkIronMat, stanchionCoords.length * 2);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < stanchionCoords.length; i++) {
      const [sx, sz] = stanchionCoords[i];
      dummy.position.set(sx, colH * 0.5, sz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      colInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(sx, 0.21, sz);
      dummy.updateMatrix();
      collarInst.setMatrixAt(i, dummy.matrix);

      // 1:1 stanchion collider
      this.collisionWorld.addBox(sx - 0.28, 0, sz - 0.28, sx + 0.28, colH, sz + 0.28, 'pillar');

      // High-clearance diagonal knee braces tucked strictly at y = 3.2..3.84m (no head-clip!)
      const signX = sx < 0 ? 1 : -1;
      const signZ = sz < 0 ? 1 : -1;
      dummy.position.set(sx + signX * 0.45, colH - 0.42, sz);
      dummy.rotation.set(0, 0, signX * 0.72);
      dummy.updateMatrix();
      braceInst.setMatrixAt(i * 2, dummy.matrix);

      dummy.position.set(sx, colH - 0.42, sz + signZ * 0.45);
      dummy.rotation.set(-signZ * 0.72, Math.PI * 0.5, 0);
      dummy.updateMatrix();
      braceInst.setMatrixAt(i * 2 + 1, dummy.matrix);
    }

    colInst.instanceMatrix.needsUpdate = true;
    collarInst.instanceMatrix.needsUpdate = true;
    braceInst.instanceMatrix.needsUpdate = true;
    this.root.add(colInst, collarInst, braceInst);

    // 4 Smooth Stepped Industrial Access Ramps (14 steps x 0.30m rise <= 0.35m!)
    const stepCount = 14;
    const stepRise = deckY / stepCount; // 0.30m exact
    const stepDepth = 0.65;
    const rampWidth = 3.6;
    const runLen = stepCount * stepDepth; // 9.10m

    const rampStepGeo = this._trackGeo(
      scaleBoxUVs(
        new THREE.BoxGeometry(rampWidth, 0.32, stepDepth),
        rampWidth,
        0.32,
        stepDepth,
        1.8,
        0.65
      )
    );
    const rampNoseGeo = this._trackGeo(
      scaleBoxUVs(
        new THREE.BoxGeometry(rampWidth - 0.16, 0.06, 0.08),
        rampWidth - 0.16,
        0.06,
        0.08,
        1.2,
        0.4
      )
    );
    const totalRampSteps = stepCount * 4;

    const rampStepInst = new THREE.InstancedMesh(rampStepGeo, mats.stepMat, totalRampSteps);
    rampStepInst.castShadow = true;
    rampStepInst.receiveShadow = true;
    const rampNoseInst = new THREE.InstancedMesh(rampNoseGeo, mats.hazardMat, totalRampSteps);

    const stringerShape = new THREE.Shape();
    stringerShape.moveTo(0, 0);
    stringerShape.lineTo(runLen, deckY - 0.36);
    stringerShape.lineTo(runLen, deckY + 0.12);
    stringerShape.lineTo(0, 0.38);
    stringerShape.closePath();

    const stringerGeo = this._trackGeo(
      scaleGeometryUVs(
        new THREE.ExtrudeGeometry(stringerShape, {
          depth: 0.22,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.03,
          bevelSegments: 1,
        }),
        0.25,
        0.25
      )
    );
    stringerGeo.translate(0, 0, -0.11);

    const plinthShape = new THREE.Shape();
    plinthShape.moveTo(0, 0);
    plinthShape.lineTo(stepDepth * 7, 0);
    plinthShape.lineTo(stepDepth * 7, stepRise * 7 - 0.05);
    plinthShape.lineTo(0, 0.08);
    plinthShape.closePath();

    const plinthGeo = this._trackGeo(
      scaleGeometryUVs(
        new THREE.ExtrudeGeometry(plinthShape, {
          depth: rampWidth - 0.1,
          bevelEnabled: false,
        }),
        0.9,
        0.3
      )
    );
    plinthGeo.translate(0, 0, -(rampWidth - 0.1) * 0.5);

    const rampConfigs = [
      { cx: -18.0, zStart: -29.1, dirZ: 1 },  // NW: climbs +Z to z = -20.0
      { cx: 18.0, zStart: -29.1, dirZ: 1 },   // NE: climbs +Z to z = -20.0
      { cx: -18.0, zStart: 29.1, dirZ: -1 },  // SW: climbs -Z to z = 20.0
      { cx: 18.0, zStart: 29.1, dirZ: -1 },   // SE: climbs -Z to z = 20.0
    ];

    let rIdx = 0;
    for (let r = 0; r < rampConfigs.length; r++) {
      const rc = rampConfigs[r];
      const rotY = rc.dirZ < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;

      for (const sideOff of [-(rampWidth * 0.5 + 0.04), rampWidth * 0.5 + 0.04]) {
        const strMesh = new THREE.Mesh(stringerGeo, mats.darkIronMat);
        strMesh.position.set(rc.cx + sideOff, 0, rc.zStart);
        strMesh.rotation.y = rotY;
        strMesh.castShadow = true;
        strMesh.receiveShadow = true;
        this.root.add(strMesh);
      }

      const plinthMesh = new THREE.Mesh(plinthGeo, mats.hazardMat);
      plinthMesh.position.set(rc.cx, 0, rc.zStart);
      plinthMesh.rotation.y = rotY;
      plinthMesh.receiveShadow = true;
      this.root.add(plinthMesh);

      for (let i = 0; i < stepCount; i++) {
        const topY = (i + 1) * stepRise;
        const zCenter = rc.zStart + rc.dirZ * (i + 0.5) * stepDepth;
        const zMin = zCenter - stepDepth * 0.5;
        const zMax = zCenter + stepDepth * 0.5;

        dummy.position.set(rc.cx, topY - 0.16, zCenter);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        rampStepInst.setMatrixAt(rIdx, dummy.matrix);

        const frontZ = zCenter - rc.dirZ * (stepDepth * 0.5 - 0.04);
        dummy.position.set(rc.cx, topY - 0.03, frontZ);
        dummy.updateMatrix();
        rampNoseInst.setMatrixAt(rIdx, dummy.matrix);
        rIdx++;

        // Solid base on lower 7 steps (<=2.1m), cantilevered full headroom (>=2.02m) on upper 7 steps
        const colMinY = i < 7 ? 0.0 : topY - 0.38;
        this.collisionWorld.addBox(
          rc.cx - rampWidth * 0.5,
          colMinY,
          zMin,
          rc.cx + rampWidth * 0.5,
          topY,
          zMax,
          'ramp'
        );
      }
    }

    rampStepInst.instanceMatrix.needsUpdate = true;
    rampNoseInst.instanceMatrix.needsUpdate = true;
    this.root.add(rampStepInst, rampNoseInst);
  }

  /**
   * Build 4 Massive LatheGeometry Corroded Distillation Silos at (±24.6, 0, ±24.6)
   * and sweeping overhead TubeGeometry thick industrial oil & steam pipelines.
   * @private
   */
  _buildDistillationSilosAndPipelines(mats) {
    // 1. Massive LatheGeometry Corroded Distillation Silo Profile (radius ~2.35m, plinth 2.50m, height 10.8m)
    const siloPoints = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(2.50, 0.0),
      new THREE.Vector2(2.50, 0.72),
      new THREE.Vector2(2.38, 0.90),
      new THREE.Vector2(2.35, 1.05),
      new THREE.Vector2(2.35, 3.85),
      new THREE.Vector2(2.44, 3.95),
      new THREE.Vector2(2.44, 4.18),
      new THREE.Vector2(2.35, 4.28),
      new THREE.Vector2(2.35, 7.65),
      new THREE.Vector2(2.44, 7.75),
      new THREE.Vector2(2.44, 7.98),
      new THREE.Vector2(2.28, 8.20),
      new THREE.Vector2(1.75, 9.10),
      new THREE.Vector2(1.10, 9.65),
      new THREE.Vector2(0.72, 9.85),
      new THREE.Vector2(0.72, 10.75),
      new THREE.Vector2(0.84, 10.80),
      new THREE.Vector2(0.01, 10.82),
    ];
    const siloGeo = this._trackGeo(scaleGeometryUVs(new THREE.LatheGeometry(siloPoints, 20), 3, 2));
    const siloHazardGeo = this._trackGeo(
      scaleGeometryUVs(new THREE.CylinderGeometry(2.38, 2.38, 0.56, 20, 1, true), 10, 1)
    );
    const siloRiserGeo = this._trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 8.4, 8));
    const siloValveGeo = this._trackGeo(new THREE.TorusGeometry(0.32, 0.06, 6, 12));
    const siloStrutGeo = this._trackGeo(new THREE.BoxGeometry(0.45, 0.45, 6.2));

    const siloPositions = [
      [-24.6, -24.6],
      [24.6, -24.6],
      [-24.6, 24.6],
      [24.6, 24.6],
    ];

    // Pre-allocate InstancedMesh for pipe joint ring flanges along all sweeping pipes
    const flangeGeo = this._trackGeo(new THREE.TorusGeometry(0.48, 0.09, 6, 14));
    const flangeTransforms = [];

    for (let i = 0; i < siloPositions.length; i++) {
      const [sx, sz] = siloPositions[i];
      const signX = sx < 0 ? -1 : 1;
      const signZ = sz < 0 ? -1 : 1;

      const sGroup = new THREE.Group();
      sGroup.position.set(sx, 0, sz);

      const siloBody = new THREE.Mesh(siloGeo, mats.rustSteelMat);
      siloBody.castShadow = true;
      siloBody.receiveShadow = true;
      sGroup.add(siloBody);

      const hazardBand = new THREE.Mesh(siloHazardGeo, mats.hazardMat);
      hazardBand.position.y = 1.65;
      sGroup.add(hazardBand);

      // Vertical external pipe riser & brass pressure valve wheel facing inner arena
      const riserX = -signX * 1.75;
      const riserZ = -signZ * 1.75;
      const riser = new THREE.Mesh(siloRiserGeo, mats.darkIronMat);
      riser.position.set(riserX, 4.4, riserZ);
      sGroup.add(riser);

      const valve = new THREE.Mesh(siloValveGeo, mats.copperValveMat);
      valve.position.set(riserX - signX * 0.25, 1.9, riserZ - signZ * 0.25);
      valve.rotation.y = Math.atan2(-signX, -signZ);
      sGroup.add(valve);

      // Diagonal heavy cantilever support truss bracing silo to skybridge intersection corner (y = 3.9m)
      const strut = new THREE.Mesh(siloStrutGeo, mats.darkIronMat);
      strut.position.set(-signX * 2.7, 3.85, -signZ * 2.7);
      strut.rotation.y = Math.atan2(-signX, -signZ);
      sGroup.add(strut);

      this.root.add(sGroup);

      // 1:1 Silo collision registration
      this.collisionWorld.addBox(sx - 2.5, 0, sz - 2.5, sx + 2.5, 10.8, sz + 2.5, 'pillar');

      // Sweeping thick overhead TubeGeometry oil/steam pipeline from Silo top shoulder into Central Smelter Hood
      const mainPipeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx - signX * 1.2, 8.6, sz - signZ * 1.2),
        new THREE.Vector3(sx * 0.72, 10.2, sz * 0.72),
        new THREE.Vector3(sx * 0.34, 10.5, sz * 0.34),
        new THREE.Vector3(signX * 2.1, 9.6, signZ * 2.1),
      ]);
      const mainPipeGeo = this._trackGeo(new THREE.TubeGeometry(mainPipeCurve, 22, 0.42, 10, false));
      const mainPipeMesh = new THREE.Mesh(mainPipeGeo, mats.rustPipeMat);
      mainPipeMesh.castShadow = true;
      this.root.add(mainPipeMesh);

      // Record flange joint positions along the main pipe (t = 0.22, 0.50, 0.78)
      for (const t of [0.22, 0.5, 0.78]) {
        const pt = mainPipeCurve.getPointAt(t);
        const tan = mainPipeCurve.getTangentAt(t);
        flangeTransforms.push({ pt, tan, scale: 1.0 });
      }
    }

    // Perimeter High-Overhead Steam Manifold Loop connecting adjacent Silos cleanly at y = 8.8..9.2m
    // (Well above jump-pad max height + player height = 7.31m!)
    const perimeterPipeLinks = [
      [[-24.6, 8.8, -22.2], [-20.5, 9.1, -9.0], [-20.5, 9.1, 9.0], [-24.6, 8.8, 22.2]],
      [[24.6, 8.8, -22.2], [20.5, 9.1, -9.0], [20.5, 9.1, 9.0], [24.6, 8.8, 22.2]],
      [[-22.2, 8.8, -24.6], [-9.0, 9.1, -20.5], [9.0, 9.1, -20.5], [22.2, 8.8, -24.6]],
      [[-22.2, 8.8, 24.6], [-9.0, 9.1, 20.5], [9.0, 9.1, 20.5], [22.2, 8.8, 24.6]],
    ];

    for (let i = 0; i < perimeterPipeLinks.length; i++) {
      const pts = perimeterPipeLinks[i].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = this._trackGeo(new THREE.TubeGeometry(curve, 24, 0.28, 8, false));
      const mesh = new THREE.Mesh(geo, mats.darkIronMat);
      this.root.add(mesh);

      for (const t of [0.28, 0.5, 0.72]) {
        const pt = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        flangeTransforms.push({ pt, tan, scale: 0.74 });
      }
    }

    // Batch all bolted pipe flange collars into 1 InstancedMesh draw call
    const flangeInst = new THREE.InstancedMesh(flangeGeo, mats.darkIronMat, flangeTransforms.length);
    const dummy = new THREE.Object3D();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion();

    for (let i = 0; i < flangeTransforms.length; i++) {
      const f = flangeTransforms[i];
      quat.setFromUnitVectors(zAxis, f.tan);
      dummy.position.copy(f.pt);
      dummy.quaternion.copy(quat);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      flangeInst.setMatrixAt(i, dummy.matrix);
    }
    flangeInst.instanceMatrix.needsUpdate = true;
    this.root.add(flangeInst);
  }

  /**
   * Build axis-aligned industrial tactical cover across the sunken basin (y = 0):
   * - 4 Sculpted ExtrudeGeometry Rusted Boiler Bunkers (3.2m x 1.6m x 2.6m)
   * - 4 Cylindrical Tank Barricades (3.2m x 1.1m x 1.28m)
   * - 4 Caution-Striped Blast Door Bulkheads (3.2m x 0.96m x 3.1m)
   * - 4 Low Outer Approach Barriers (3.0m x 0.86m x 1.25m)
   * Every piece registers 1:1 with CollisionWorld.
   * @private
   */
  _buildIndustrialCover(mats) {
    // 1. 4 Sculpted Rusted Boiler Bunkers at (±12.2, 0, ±11.5)
    const bunkerW = 3.2;
    const bunkerD = 1.6;
    const bunkerH = 2.6;

    const bunkerShape = new THREE.Shape();
    bunkerShape.moveTo(-bunkerD * 0.5, 0);
    bunkerShape.lineTo(bunkerD * 0.5, 0);
    bunkerShape.lineTo(bunkerD * 0.5, 0.45);
    bunkerShape.lineTo(bunkerD * 0.42, 0.65);
    bunkerShape.lineTo(bunkerD * 0.42, 2.15);
    bunkerShape.lineTo(bunkerD * 0.25, bunkerH);
    bunkerShape.lineTo(-bunkerD * 0.25, bunkerH);
    bunkerShape.lineTo(-bunkerD * 0.42, 2.15);
    bunkerShape.lineTo(-bunkerD * 0.42, 0.65);
    bunkerShape.lineTo(-bunkerD * 0.5, 0.45);
    bunkerShape.closePath();

    const bunkerGeo = this._trackGeo(
      scaleGeometryUVs(
        new THREE.ExtrudeGeometry(bunkerShape, {
          depth: bunkerW - 0.14,
          bevelEnabled: true,
          bevelThickness: 0.06,
          bevelSize: 0.06,
          bevelSegments: 2,
        }),
        0.56,
        0.56
      )
    );
    bunkerGeo.translate(0, 0, -(bunkerW - 0.14) * 0.5);
    bunkerGeo.rotateY(Math.PI * 0.5);

    const bunkerBaseGeo = this._trackGeo(
      scaleBoxUVs(
        new THREE.BoxGeometry(bunkerW + 0.04, 0.34, bunkerD + 0.04),
        bunkerW + 0.04,
        0.34,
        bunkerD + 0.04,
        1.2,
        0.4
      )
    );
    const bunkerStackGeo = this._trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 0.85, 10));
    const bunkerSlitGeo = this._trackGeo(new THREE.BoxGeometry(1.4, 0.18, bunkerD - 0.06));
    const bunkerValveGeo = this._trackGeo(new THREE.TorusGeometry(0.24, 0.045, 6, 12));

    const bunkerPositions = [
      [-21.8, -8.5],
      [21.8, -8.5],
      [-21.8, 8.5],
      [21.8, 8.5],
    ];

    for (let i = 0; i < bunkerPositions.length; i++) {
      const [bx, bz] = bunkerPositions[i];
      const group = new THREE.Group();
      group.position.set(bx, 0, bz);

      const hull = new THREE.Mesh(bunkerGeo, mats.rustSteelMat);
      hull.castShadow = true;
      hull.receiveShadow = true;
      group.add(hull);

      const base = new THREE.Mesh(bunkerBaseGeo, mats.hazardMat);
      base.position.y = 0.17;
      base.receiveShadow = true;
      group.add(base);

      for (const sx of [-0.75, 0.75]) {
        const stack = new THREE.Mesh(bunkerStackGeo, mats.darkIronMat);
        stack.position.set(sx, bunkerH + 0.25, 0);
        stack.castShadow = true;
        group.add(stack);
      }

      const slit = new THREE.Mesh(bunkerSlitGeo, mats.furnaceGlowMat);
      slit.position.set(0, 1.45, 0);
      group.add(slit);

      const valve = new THREE.Mesh(bunkerValveGeo, mats.copperValveMat);
      valve.position.set(0, 1.0, (bz < 0 ? 1 : -1) * (bunkerD * 0.42 + 0.06));
      group.add(valve);

      this.root.add(group);

      this.collisionWorld.addBox(
        bx - bunkerW * 0.5,
        0,
        bz - bunkerD * 0.5,
        bx + bunkerW * 0.5,
        bunkerH + 0.5,
        bz + bunkerD * 0.5,
        'cover'
      );
    }

    // 2. 4 Horizontal Cylindrical Tank Barricades (waist-high 1.28m peek cover at cardinal flanks)
    const tankW = 3.2;
    const tankD = 1.1;
    const tankH = 1.28;

    const tankDrumGeo = this._trackGeo(new THREE.CylinderGeometry(0.48, 0.48, tankW - 0.16, 14));
    tankDrumGeo.rotateZ(Math.PI * 0.5);
    const tankStrapGeo = this._trackGeo(new THREE.CylinderGeometry(0.51, 0.51, 0.14, 14));
    tankStrapGeo.rotateZ(Math.PI * 0.5);
    const tankCradleGeo = this._trackGeo(
      scaleBoxUVs(new THREE.BoxGeometry(tankW, 0.46, tankD), tankW, 0.46, tankD, 1.2, 0.46)
    );

    const tankSpecs = [
      { x: 0, z: -20.5, rotY: 0 },
      { x: 0, z: 20.5, rotY: 0 },
      { x: -20.5, z: 0, rotY: Math.PI * 0.5 },
      { x: 20.5, z: 0, rotY: Math.PI * 0.5 },
    ];

    for (let i = 0; i < tankSpecs.length; i++) {
      const t = tankSpecs[i];
      const group = new THREE.Group();
      group.position.set(t.x, 0, t.z);
      group.rotation.y = t.rotY;

      const cradle = new THREE.Mesh(tankCradleGeo, mats.hazardMat);
      cradle.position.y = 0.23;
      cradle.castShadow = true;
      cradle.receiveShadow = true;
      group.add(cradle);

      const drum = new THREE.Mesh(tankDrumGeo, mats.rustPipeMat);
      drum.position.y = 0.78;
      drum.castShadow = true;
      drum.receiveShadow = true;
      group.add(drum);

      for (const sx of [-1.05, 0, 1.05]) {
        const strap = new THREE.Mesh(tankStrapGeo, mats.darkIronMat);
        strap.position.set(sx, 0.78, 0);
        group.add(strap);
      }

      this.root.add(group);

      const isZ = Math.abs(Math.sin(t.rotY)) > 0.5;
      const hx = isZ ? tankD * 0.5 : tankW * 0.5;
      const hz = isZ ? tankW * 0.5 : tankD * 0.5;
      this.collisionWorld.addBox(t.x - hx, 0, t.z - hz, t.x + hx, tankH, t.z + hz, 'cover');
    }

    // 3. 4 Caution-Striped Blast Door Bulkheads (3.2m x 0.96m x 3.1m) in outer flank lanes
    const blastW = 3.2;
    const blastD = 0.96;
    const blastH = 3.1;

    const blastShape = new THREE.Shape();
    blastShape.moveTo(-blastD * 0.5, 0);
    blastShape.lineTo(blastD * 0.5, 0);
    blastShape.lineTo(blastD * 0.5, 0.5);
    blastShape.lineTo(blastD * 0.4, 0.75);
    blastShape.lineTo(blastD * 0.4, blastH - 0.4);
    blastShape.lineTo(blastD * 0.2, blastH);
    blastShape.lineTo(-blastD * 0.2, blastH);
    blastShape.lineTo(-blastD * 0.4, blastH - 0.4);
    blastShape.lineTo(-blastD * 0.4, 0.75);
    blastShape.lineTo(-blastD * 0.5, 0.5);
    blastShape.closePath();

    const blastGeo = this._trackGeo(
      scaleGeometryUVs(
        new THREE.ExtrudeGeometry(blastShape, {
          depth: blastW - 0.14,
          bevelEnabled: true,
          bevelThickness: 0.06,
          bevelSize: 0.05,
          bevelSegments: 1,
        }),
        0.28,
        0.28
      )
    );
    blastGeo.translate(0, 0, -(blastW - 0.14) * 0.5);
    blastGeo.rotateY(Math.PI * 0.5);

    const blastHazardGeo = this._trackGeo(
      scaleBoxUVs(
        new THREE.BoxGeometry(blastW + 0.04, 0.72, blastD - 0.04),
        blastW + 0.04,
        0.72,
        blastD - 0.04,
        1.2,
        0.72
      )
    );
    const blastStanchionGeo = this._trackGeo(
      scaleBoxUVs(
        new THREE.BoxGeometry(0.24, blastH - 0.3, blastD + 0.04),
        0.24,
        blastH - 0.3,
        blastD + 0.04,
        1.2,
        1.2
      )
    );
    const blastLampGeo = this._trackGeo(new THREE.BoxGeometry(0.65, 0.14, 0.22));

    const blastCoords = [
      [-24.8, -13.5],
      [24.8, -13.5],
      [-24.8, 13.5],
      [24.8, 13.5],
    ];

    for (let i = 0; i < blastCoords.length; i++) {
      const [dx, dz] = blastCoords[i];
      const group = new THREE.Group();
      group.position.set(dx, 0, dz);

      const body = new THREE.Mesh(blastGeo, mats.coverConcreteMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const hazardPanel = new THREE.Mesh(blastHazardGeo, mats.hazardMat);
      hazardPanel.position.y = 0.36;
      hazardPanel.receiveShadow = true;
      group.add(hazardPanel);

      for (const sx of [-blastW * 0.42, blastW * 0.42]) {
        const stanchion = new THREE.Mesh(blastStanchionGeo, mats.darkIronMat);
        stanchion.position.set(sx, (blastH - 0.3) * 0.5, 0);
        group.add(stanchion);
      }

      const lamp = new THREE.Mesh(blastLampGeo, mats.amberLampMat);
      lamp.position.y = blastH + 0.08;
      group.add(lamp);

      this.root.add(group);

      this.collisionWorld.addBox(
        dx - blastW * 0.5,
        0,
        dz - blastD * 0.5,
        dx + blastW * 0.5,
        blastH,
        dz + blastD * 0.5,
        'cover'
      );
    }

    // 4. 4 Low Approach Hazard Barriers (3.0m x 0.86m x 1.25m) at (±11.0, 0, ±24.2)
    const lowW = 3.0;
    const lowD = 0.86;
    const lowH = 1.25;

    const lowShape = new THREE.Shape();
    lowShape.moveTo(-lowD * 0.5, 0);
    lowShape.lineTo(lowD * 0.5, 0);
    lowShape.lineTo(lowD * 0.5, 0.32);
    lowShape.lineTo(lowD * 0.3, 1.08);
    lowShape.lineTo(lowD * 0.16, lowH);
    lowShape.lineTo(-lowD * 0.16, lowH);
    lowShape.lineTo(-lowD * 0.3, 1.08);
    lowShape.lineTo(-lowD * 0.5, 0.32);
    lowShape.closePath();

    const lowGeo = this._trackGeo(
      scaleGeometryUVs(
        new THREE.ExtrudeGeometry(lowShape, {
          depth: lowW - 0.12,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.04,
          bevelSegments: 1,
        }),
        0.68,
        0.68
      )
    );
    lowGeo.translate(0, 0, -(lowW - 0.12) * 0.5);
    lowGeo.rotateY(Math.PI * 0.5);

    const lowHazardGeo = this._trackGeo(
      scaleBoxUVs(
        new THREE.BoxGeometry(lowW + 0.04, 0.28, lowD + 0.04),
        lowW + 0.04,
        0.28,
        lowD + 0.04,
        1.2,
        0.4
      )
    );

    const lowCoords = [
      [-11.0, -24.2],
      [11.0, -24.2],
      [-11.0, 24.2],
      [11.0, 24.2],
    ];

    for (let i = 0; i < lowCoords.length; i++) {
      const [lx, lz] = lowCoords[i];
      const group = new THREE.Group();
      group.position.set(lx, 0, lz);

      const hull = new THREE.Mesh(lowGeo, mats.rustSteelMat);
      hull.castShadow = true;
      hull.receiveShadow = true;
      group.add(hull);

      const base = new THREE.Mesh(lowHazardGeo, mats.hazardMat);
      base.position.y = 0.14;
      base.receiveShadow = true;
      group.add(base);

      this.root.add(group);

      this.collisionWorld.addBox(
        lx - lowW * 0.5,
        0,
        lz - lowD * 0.5,
        lx + lowW * 0.5,
        lowH,
        lz + lowD * 0.5,
        'cover'
      );
    }
  }

  /**
   * Build distant smog-shrouded refinery skyline: ruined structures, tall smokestacks
   * with blinking aviation warning beacons, LatheGeometry cooling towers, and 'refinery' sky dome.
   * @private
   */
  _buildSkylineAndSkyDome(mats) {
    // 1. Refinery Smog Sky Dome (unaffected by fog)
    const skyTex = this._texGen.getSkyDomeTexture('refinery');
    const skyGeo = this._trackGeo(new THREE.SphereGeometry(195, 24, 16));
    const skyMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: skyTex,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      })
    );
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.root.add(skyDome);

    const rng = createRng(14014);
    const dummy = new THREE.Object3D();

    // 2. 28 Ruined Industrial Refinery Warehouses & Structural Blocks (InstancedMesh)
    const ruinCount = 28;
    const ruinGeo = this._trackGeo(new THREE.BoxGeometry(1, 1, 1));
    const ruinInst = new THREE.InstancedMesh(ruinGeo, mats.skylineMat, ruinCount);

    for (let i = 0; i < ruinCount; i++) {
      const ang = (i / ruinCount) * Math.PI * 2 + (rng() - 0.5) * 0.16;
      const ring = 56 + rng() * 44;
      const tx = Math.cos(ang) * ring;
      const tz = Math.sin(ang) * ring;
      const tw = 10 + rng() * 14;
      const td = 9 + rng() * 13;
      const th = 20 + rng() * 38;

      dummy.position.set(tx, th * 0.5 - 5, tz);
      dummy.rotation.set(0, rng() * Math.PI * 0.5, 0);
      dummy.scale.set(tw, th, td);
      dummy.updateMatrix();
      ruinInst.setMatrixAt(i, dummy.matrix);
    }
    ruinInst.instanceMatrix.needsUpdate = true;

    // 3. 16 Towering Tapered Industrial Smokestacks + Blinking Aviation Beacons (2 InstancedMeshes)
    const stackCount = 16;
    const stackGeo = this._trackGeo(new THREE.CylinderGeometry(1.15, 2.3, 1, 12));
    const stackInst = new THREE.InstancedMesh(stackGeo, mats.smokestackMat, stackCount);

    const beaconGeo = this._trackGeo(new THREE.SphereGeometry(0.62, 8, 6));
    const beaconInst = new THREE.InstancedMesh(beaconGeo, mats.beaconMat, stackCount);

    for (let i = 0; i < stackCount; i++) {
      const ang = (i / stackCount) * Math.PI * 2 + 0.11 + (rng() - 0.5) * 0.12;
      const ring = 52 + rng() * 48;
      const sx = Math.cos(ang) * ring;
      const sz = Math.sin(ang) * ring;
      const sh = 38 + rng() * 34;

      dummy.position.set(sx, sh * 0.5 - 4, sz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, sh, 1);
      dummy.updateMatrix();
      stackInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(sx, sh - 3.4, sz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beaconInst.setMatrixAt(i, dummy.matrix);
    }
    stackInst.instanceMatrix.needsUpdate = true;
    beaconInst.instanceMatrix.needsUpdate = true;

    // 4. 6 Hyperbolic LatheGeometry Cooling Towers (InstancedMesh)
    const towerPoints = [
      new THREE.Vector2(9.2, 0.0),
      new THREE.Vector2(7.6, 12.0),
      new THREE.Vector2(6.0, 24.0),
      new THREE.Vector2(5.4, 32.0),
      new THREE.Vector2(5.9, 39.0),
      new THREE.Vector2(6.5, 42.0),
    ];
    const coolingGeo = this._trackGeo(new THREE.LatheGeometry(towerPoints, 16));
    const coolingCount = 6;
    const coolingInst = new THREE.InstancedMesh(coolingGeo, mats.skylineMat, coolingCount);

    for (let i = 0; i < coolingCount; i++) {
      const ang = (i / coolingCount) * Math.PI * 2 + 0.35;
      const ring = 78 + rng() * 26;
      const cx = Math.cos(ang) * ring;
      const cz = Math.sin(ang) * ring;
      const scale = 0.85 + rng() * 0.35;

      dummy.position.set(cx, -5.0, cz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      coolingInst.setMatrixAt(i, dummy.matrix);
    }
    coolingInst.instanceMatrix.needsUpdate = true;

    this.root.add(ruinInst, stackInst, beaconInst, coolingInst);
  }

  /**
   * Configure smog-filtered warm amber sunlight, overcast ash hemisphere fill,
   * and at most 2 PointLights (central smelter furnace + secondary refinery manifold).
   * @private
   */
  _buildLighting() {
    this.scene.background = new THREE.Color(0x3b352e);
    const fogDensity =
      typeof this.qualityConfig.fogDensity === 'number' ? this.qualityConfig.fogDensity : 0.0135;
    this.scene.fog = new THREE.FogExp2(0x4d473f, fogDensity);

    // Overcast ash-gray sky fill + warm scorched earth bounce
    this._hemiLight = new THREE.HemisphereLight(0x7c7f7a, 0x362b22, 0.9);
    this._hemiLight.position.set(0, 32, 0);
    this.root.add(this._hemiLight);
    this._lights.push(this._hemiLight);

    // Warm smog-filtered sunlight key light
    this._dirLight = new THREE.DirectionalLight(0xd9a05b, 2.0);
    this._dirLight.position.set(26, 40, 22);
    this._dirLight.shadow.camera.left = -36;
    this._dirLight.shadow.camera.right = 36;
    this._dirLight.shadow.camera.top = 36;
    this._dirLight.shadow.camera.bottom = -36;
    this._dirLight.shadow.camera.near = 8;
    this._dirLight.shadow.camera.far = 115;
    this._dirLight.shadow.bias = -0.0005;
    this._dirLight.shadow.normalBias = 0.03;
    this.root.add(this._dirLight);
    this._lights.push(this._dirLight);

    // Strictly <= 2 PointLights:
    // 0: Central smelter furnace warm orange glow beneath collector hood
    const furnaceLight = new THREE.PointLight(0xff6e1f, 44, 34, 1.45);
    furnaceLight.position.set(0, 6.2, 0);
    furnaceLight.castShadow = false;
    this.root.add(furnaceLight);
    this._accentLights.push(furnaceLight);
    this._lights.push(furnaceLight);
    this._furnaceLight = furnaceLight;

    // 1: Secondary refinery pipeline & north boiler amber glow
    const pipeLight = new THREE.PointLight(0xe88b2a, 28, 28, 1.5);
    pipeLight.position.set(0, 5.2, -16.0);
    pipeLight.castShadow = false;
    this.root.add(pipeLight);
    this._accentLights.push(pipeLight);
    this._lights.push(pipeLight);
    this._pipeGlowLight = pipeLight;
  }

  /**
   * Smooth zero-GC animation: overhead smelter exhaust turbine rotation,
   * blinking distant smokestack beacons, and subtle furnace ember pulse.
   *
   * @param {number} dt
   * @param {number} elapsedTime
   */
  update(dt, elapsedTime) {
    if (!this._built) return;
    const t = Number.isFinite(elapsedTime) ? elapsedTime : 0;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;

    // Rotate overhead smelter exhaust turbine fan blades
    if (this._turbineRotor) {
      this._turbineRotor.rotation.y += safeDt * 1.9;
    }

    // Subtle molten furnace ember pulse
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    if (this._furnaceGlowMat) {
      this._furnaceGlowMat.emissiveIntensity = 1.75 + pulse * 0.7;
    }
    if (this._furnaceLight && this._furnaceLight.visible) {
      this._furnaceLight.intensity = 40 + pulse * 8;
    }
    if (this._pipeGlowLight && this._pipeGlowLight.visible) {
      const pipePulse = 0.5 + 0.5 * Math.cos(t * 1.9);
      this._pipeGlowLight.intensity = 24 + pipePulse * 6;
    }

    // Blinking warm amber-orange aviation beacons atop distant smokestacks
    if (this._beaconMat) {
      const blink = Math.sin(t * 2.6) > 0.15 ? 1.0 : 0.22;
      this._beaconMat.color.setRGB(1.0 * blink, 0.34 * blink, 0.08 * blink);
    }

    // Gentle industrial voltage shimmer on refinery signboards
    for (let i = 0; i < this._signboardMats.length; i++) {
      const hum = 0.5 + 0.5 * Math.sin(t * 3.0 + i * 1.4);
      this._signboardMats[i].emissiveIntensity = 0.58 + hum * 0.14;
    }
  }

  /**
   * Apply quality preset dynamically (shadows + <= 2 accent lights).
   * Intentionally does NOT overwrite scene.fog.density.
   *
   * @param {any} qualityConfig
   */
  setQuality(qualityConfig) {
    if (!qualityConfig) return;
    this.qualityConfig = qualityConfig;

    if (this._dirLight) {
      const shadowsOn = Boolean(qualityConfig.shadowsEnabled);
      this._dirLight.castShadow = shadowsOn;
      if (shadowsOn && Number.isFinite(qualityConfig.shadowMapSize)) {
        const size = qualityConfig.shadowMapSize;
        if (
          this._dirLight.shadow.mapSize.width !== size ||
          this._dirLight.shadow.mapSize.height !== size
        ) {
          this._dirLight.shadow.mapSize.set(size, size);
          if (this._dirLight.shadow.map) {
            this._dirLight.shadow.map.dispose();
            this._dirLight.shadow.map = null;
          }
        }
      }
    }

    const maxDynamic = Number.isFinite(qualityConfig.dynamicLights)
      ? Math.max(0, Math.min(2, qualityConfig.dynamicLights))
      : this._accentLights.length;
    for (let i = 0; i < this._accentLights.length; i++) {
      this._accentLights[i].visible = i < maxDynamic;
    }
  }

  /**
   * Cleanly dispose all geometries, materials, lights, and owned TextureGenerator resources.
   * Does NOT dispose sharedTexGen if one was passed into the constructor.
   */
  dispose() {
    if (this.root && this.root.parent) {
      this.root.parent.remove(this.root);
    }

    for (let i = 0; i < this._geometries.length; i++) {
      this._geometries[i].dispose();
    }
    this._geometries.length = 0;

    for (let i = 0; i < this._materials.length; i++) {
      this._materials[i].dispose();
    }
    this._materials.length = 0;

    for (let i = 0; i < this._lights.length; i++) {
      if (this._lights[i].shadow && this._lights[i].shadow.map) {
        this._lights[i].shadow.map.dispose();
      }
    }
    this._lights.length = 0;
    this._accentLights.length = 0;
    this._dirLight = null;
    this._hemiLight = null;
    this._furnaceLight = null;
    this._pipeGlowLight = null;

    this._turbineRotor = null;
    this._furnaceGlowMat = null;
    this._beaconMat = null;
    this._signboardMats.length = 0;

    if (this._ownsTexGen && this._texGen) {
      this._texGen.dispose();
      this._texGen = null;
    }
    this._built = false;
  }
}
  __exports.Map2RefineryBuilder = Map2RefineryBuilder;
});
