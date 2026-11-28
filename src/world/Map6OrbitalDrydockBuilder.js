// Module: src/world/Map6OrbitalDrydockBuilder.js
__define("src/world/Map6OrbitalDrydockBuilder.js", (__exports, __require) => {
const { ARENA_CONFIG } = __require("src/config/constants.js");
const { TextureGenerator } = __require("src/world/TextureGenerator.js");
const { MapPropFactory } = __require("src/world/MapPropFactory.js");

function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scaleGeometryUVs(geo, scaleU = 0.22, scaleV = 0.22) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * scaleU, uv.getY(i) * scaleV);
  }
  uv.needsUpdate = true;
  return geo;
}

function scaleBoxUVs(geo, w, h, d, tileU = 2.0, tileV = 2.0) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (!pos || !norm || !uv) return geo;
  const invU = 1 / (tileU || 1);
  const invV = 1 / (tileV || 1);
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
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
 * Map 6 Builder — "SECTOR-99 // AEGIS DRYDOCK"
 * Charcoal-gunmetal & tungsten-amber derelict orbital warship drydock & keel cradle.
 * Features riveted warship floor plates, wrap-around y=4.2m shipyard gantry catwalks,
 * overhead gantry crane bridges (y >= 8.6m), 4 wide stepped ramps (0.30m/step),
 * 4 jump pads, and a colossal derelict dreadnought hull skeleton beyond the North wall.
 */
class Map6OrbitalDrydockBuilder {
  constructor(scene, collisionWorld, qualityConfig = {}, sharedTexGen = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.qualityConfig = qualityConfig || {};

    this._ownsTexGen = !sharedTexGen;
    this._texGen = sharedTexGen || new TextureGenerator(4);

    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_SECTOR99_AegisDrydock';

    this._geometries = [];
    this._materials = [];
    this._lights = [];
    this._accentLights = [];
    this._dirLight = null;
    this._hemiLight = null;

    this._tungstenAmberMat = null;
    this._keelEmberMat = null;
    this._radarDish = null;
    this._radarRing = null;
    this._distantBeaconMat = null;
    this._keelLight = null;
    this._gantryLight = null;
    this._propMounts = [];

    this._built = false;
  }

  _trackGeo(geo) {
    this._geometries.push(geo);
    return geo;
  }

  _trackMat(mat) {
    this._materials.push(mat);
    return mat;
  }

  build() {
    if (this._built) {
      this.dispose();
    }
    this._built = true;

    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_SECTOR99_AegisDrydock';
    this.scene.add(this.root);

    const halfX = 29.5; // 60m width
    const halfZ = 38.5; // 78m length: 3 Parallel Gantry Bridges over Deep Space Chasms!
    const wallH = ARENA_CONFIG.wallHeight; // 11

    // Open space void chasms drop freely down past voidFallY = -14!
    this.collisionWorld.setArenaBounds(-halfX - 8, halfX + 8, -halfZ - 4, halfZ + 4, -26, 30);

    const mats = this._createMaterials();
    this._buildDrydockFloorAndTurntable(mats, halfX, halfZ);
    this._buildPerimeterWalls(mats, halfX, halfZ, wallH);
    this._buildSectorSignboards(mats, halfX, halfZ);
    this._buildGantriesAndRamps(mats, halfX, halfZ);
    this._buildKeelButtressesAndBulkheads(mats);
    this._buildCranesDreadnoughtAndSkyDome(mats, halfX);
    this._buildLighting();
    this.setQuality(this.qualityConfig);

    return {
      mapId: 'aegis_drydock',
      mapIndex: 5,
      mapCode: '제99구역',
      mapName: '제99구역 · 이지스 건조 도크',
      mapSubtitle: '3갈래 평행 도크 교량 & 심우주 균열 — 2막 보스 구역',
      atmosphere: {
        bgColor: 0x050712,
        fogColor: 0x0c1026,
        fogDensity: 0.0076,
      },
      playerSpawn: {
        pos: new THREE.Vector3(0, 0.05, 30.5),
        yaw: 0,
      },
      enemySpawns: [
        { pos: new THREE.Vector3(0.0, 0.05, -24.0), isElevated: false },
        { pos: new THREE.Vector3(-4.5, 0.05, -24.5), isElevated: false },
        { pos: new THREE.Vector3(4.5, 0.05, -24.5), isElevated: false },
        { pos: new THREE.Vector3(0.0, 0.05, -9.5), isElevated: false },
        { pos: new THREE.Vector3(-20.5, 0.05, -14.0), isElevated: false },
        { pos: new THREE.Vector3(20.5, 0.05, -14.0), isElevated: false },
        { pos: new THREE.Vector3(-20.5, 0.05, 14.0), isElevated: false },
        { pos: new THREE.Vector3(20.5, 0.05, 14.0), isElevated: false },
        { pos: new THREE.Vector3(-24.0, 4.25, -8.0), isElevated: true },
        { pos: new THREE.Vector3(24.0, 4.25, -8.0), isElevated: true },
        { pos: new THREE.Vector3(-24.0, 4.25, 8.0), isElevated: true },
        { pos: new THREE.Vector3(24.0, 4.25, 8.0), isElevated: true },
      ],
      pickupSpawns: [
        { pos: new THREE.Vector3(-24.0, 4.20, 0.0), type: 'shield' },
        { pos: new THREE.Vector3(24.0, 4.20, 0.0), type: 'health' },
        { pos: new THREE.Vector3(0.0, 0.0, -30.5), type: 'ammo' },
        { pos: new THREE.Vector3(-20.5, 0.0, 0.0), type: 'ammo' },
        { pos: new THREE.Vector3(20.5, 0.0, 0.0), type: 'shield' },
        { pos: new THREE.Vector3(0.0, 0.0, 18.0), type: 'health' },
      ],
      barrelSpawns: [
        new THREE.Vector3(-6.0, 0.0, 0.0),
        new THREE.Vector3(6.0, 0.0, 0.0),
        new THREE.Vector3(-3.5, 0.0, -16.0),
        new THREE.Vector3(3.5, 0.0, -16.0),
        new THREE.Vector3(-20.5, 0.0, 18.0),
        new THREE.Vector3(20.5, 0.0, -18.0),
      ],
      jumpPadSpawns: [
        { pos: new THREE.Vector3(-19.0, 0.0, -25.0), launchVy: 17.6, launchDirX: -0.5, launchDirZ: 0.86 },
        { pos: new THREE.Vector3(19.0, 0.0, -25.0), launchVy: 17.6, launchDirX: 0.5, launchDirZ: 0.86 },
        { pos: new THREE.Vector3(-19.0, 0.0, 25.0), launchVy: 17.6, launchDirX: -0.5, launchDirZ: -0.86 },
        { pos: new THREE.Vector3(19.0, 0.0, 25.0), launchVy: 17.6, launchDirX: 0.5, launchDirZ: -0.86 },
      ],
      boostRails: [
        { x: -20.5, y: 0, z: 8.0, minX: -22.2, maxX: -18.8, minZ: 1.0, maxZ: 15.0, width: 3.4, length: 13.0, dirX: 0, dirZ: -1, yaw: Math.PI, speed: 26.0 },
        { x: 20.5, y: 0, z: -8.0, minX: 18.8, maxX: 22.2, minZ: -15.0, maxZ: -1.0, width: 3.4, length: 13.0, dirX: 0, dirZ: 1, yaw: 0, speed: 26.0 },
      ],
      barrierGates: [
        { x: -20.5, y: 0, z: -15.0, yaw: 0, initialActive: true, width: 4.1, height: 3.2 },
        { x: 20.5, y: 0, z: 15.0, yaw: 0, initialActive: false, width: 4.1, height: 3.2 },
      ],
      voidFallY: -14.0,
      controlZoneCenter: new THREE.Vector3(0, 0.2, -14.0),
      controlZoneRadius: ARENA_CONFIG.controlZoneRadius,
      arenaBounds: {
        minX: -halfX,
        maxX: halfX,
        minZ: -halfZ,
        maxZ: halfZ,
      },
    };
  }

  _createMaterials() {
    const floorTex = this._texGen.getDrydockFloorTextures(14, 14);
    const concreteTex = this._texGen.getWallTextures(1, 1);
    const catwalkTex = this._texGen.getCatwalkTextures(1, 1);
    const rustTex = this._texGen.getRustMetalTextures(1, 1);
    const hazardTex = this._texGen.getHazardTextures(1, 1);
    const ruinedSkyTex = this._texGen.getRuinedSkylineTextures();

    const drydockFloorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x475577,
        map: floorTex.map,
        roughnessMap: floorTex.roughnessMap,
        bumpMap: floorTex.bumpMap,
        bumpScale: 0.045,
        metalness: 0.45,
        roughness: 0.68,
      })
    );

    const bulkheadWallMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x14192e,
        map: concreteTex.map,
        roughnessMap: concreteTex.roughnessMap,
        bumpMap: concreteTex.bumpMap,
        bumpScale: 0.055,
        metalness: 0.48,
        roughness: 0.72,
      })
    );

    const hullArmorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd4a942,
        map: rustTex.map,
        roughnessMap: rustTex.roughnessMap,
        bumpMap: rustTex.bumpMap,
        bumpScale: 0.04,
        metalness: 0.72,
        roughness: 0.56,
      })
    );

    const darkIronMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x090d1c,
        roughnessMap: rustTex.roughnessMap,
        bumpMap: rustTex.bumpMap,
        bumpScale: 0.032,
        metalness: 0.82,
        roughness: 0.48,
      })
    );

    const catwalkMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e2845,
        map: catwalkTex.map,
        roughnessMap: catwalkTex.roughnessMap,
        bumpMap: catwalkTex.bumpMap,
        bumpScale: 0.04,
        metalness: 0.74,
        roughness: 0.58,
      })
    );

    const stepMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x334168,
        map: catwalkTex.map,
        roughnessMap: catwalkTex.roughnessMap,
        bumpMap: catwalkTex.bumpMap,
        bumpScale: 0.04,
        metalness: 0.68,
        roughness: 0.64,
      })
    );

    const hazardMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: hazardTex.map,
        roughnessMap: hazardTex.roughnessMap,
        bumpMap: hazardTex.bumpMap,
        bumpScale: 0.035,
        metalness: 0.36,
        roughness: 0.76,
      })
    );

    const tungstenAmberMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: new THREE.Color(0xf59e0b),
        emissiveIntensity: 1.25,
        roughness: 0.36,
        metalness: 0.25,
      })
    );

    const keelEmberMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: new THREE.Color(0x0284c7),
        emissiveIntensity: 1.35,
        roughness: 0.4,
        metalness: 0.15,
      })
    );

    const ruinedSkylineMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x11172b,
        map: ruinedSkyTex.map,
        roughnessMap: ruinedSkyTex.roughnessMap,
        roughness: 0.88,
        metalness: 0.34,
      })
    );

    const distantBeaconMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
      })
    );

    this._tungstenAmberMat = tungstenAmberMat;
    this._keelEmberMat = keelEmberMat;
    this._distantBeaconMat = distantBeaconMat;

    return {
      drydockFloorMat,
      bulkheadWallMat,
      hullArmorMat,
      darkIronMat,
      catwalkMat,
      stepMat,
      hazardMat,
      tungstenAmberMat,
      keelEmberMat,
      ruinedSkylineMat,
      distantBeaconMat,
    };
  }

  _buildDrydockFloorAndTurntable(mats, halfX, halfZ) {
    // 3 Parallel Gantry Bridges separated by 2 Deep-Space Void Chasms + 3 Cross-Connectors!
    const decks = [
      // West, Center (18m Boss Spine!), and East Parallel Bridges
      { minX: -27.0, maxX: -14.5, minZ: -36.5, maxZ: 36.5 },
      { minX: -9.0, maxX: 9.0, minZ: -36.5, maxZ: 36.5 },
      { minX: 14.5, maxX: 27.0, minZ: -36.5, maxZ: 36.5 },
      // 3 Cross-Connectors bridging Chasms at North, Center, South
      { minX: -14.5, maxX: -9.0, minZ: -33.0, maxZ: -24.0 },
      { minX: 9.0, maxX: 14.5, minZ: -33.0, maxZ: -24.0 },
      { minX: -14.5, maxX: -9.0, minZ: -4.5, maxZ: 4.5 },
      { minX: 9.0, maxX: 14.5, minZ: -4.5, maxZ: 4.5 },
      { minX: -14.5, maxX: -9.0, minZ: 24.0, maxZ: 33.0 },
      { minX: 9.0, maxX: 14.5, minZ: 24.0, maxZ: 33.0 },
    ];
    for (const b of decks) {
      const w = b.maxX - b.minX;
      const d = b.maxZ - b.minZ;
      const cx = (b.minX + b.maxX) * 0.5;
      const cz = (b.minZ + b.maxZ) * 0.5;
      const geo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(w, 0.85, d), w, 0.85, d, 3.0, 3.0));
      const m = new THREE.Mesh(geo, mats.drydockFloorMat);
      m.position.set(cx, -0.425, cz);
      m.receiveShadow = true;
      this.root.add(m);
      this.collisionWorld.addBox(b.minX, -0.95, b.minZ, b.maxX, 0.0, b.maxZ, 'floor');
    }

    // Hazard caution curbs along inner open space chasms (x = ±9.15 & ±14.35 in open chasm bands!)
    const curbGeo = this._trackGeo(new THREE.BoxGeometry(0.28, 0.08, 19.5));
    for (const cx of [-9.14, 9.14, -14.36, 14.36]) {
      for (const cz of [-14.25, 14.25]) {
        const cm = new THREE.Mesh(curbGeo, mats.hazardMat);
        cm.position.set(cx, 0.04, cz);
        this.root.add(cm);
      }
    }

    // Center Keel Boss Arena Pad
    const daisGeo = this._trackGeo(new THREE.CylinderGeometry(6.0, 6.6, 0.2, 8));
    const dais = new THREE.Mesh(daisGeo, mats.hullArmorMat);
    dais.position.y = 0.1;
    dais.receiveShadow = true;
    this.root.add(dais);
    this.collisionWorld.addBox(-4.3, 0, -4.3, 4.3, 0.2, 4.3, 'platform');
    this.collisionWorld.addBox(-5.6, 0, -2.3, 5.6, 0.2, 2.3, 'platform');
    this.collisionWorld.addBox(-2.3, 0, -5.6, 2.3, 0.2, 5.6, 'platform');
  }

  _buildPerimeterWalls(mats, halfX, halfZ, wallH) {
    // Only Bow/Stern end-dock structural bulkheads (keep side edges & chasms open into deep space!)
    const wallThick = 1.6;
    const endGeo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(18.0, wallH, wallThick), 18.0, wallH, wallThick, 5.0, 5.0));
    for (const sz of [-(36.5 + wallThick * 0.5), 36.5 + wallThick * 0.5]) {
      const m = new THREE.Mesh(endGeo, mats.bulkheadWallMat);
      m.position.set(0, wallH * 0.5, sz);
      m.receiveShadow = true;
      this.root.add(m);
    }
    this.collisionWorld.addBox(-9.0, 0, -36.5 - wallThick, 9.0, wallH + 4, -36.5, 'wall');
    this.collisionWorld.addBox(-9.0, 0, 36.5, 9.0, wallH + 4, 36.5 + wallThick, 'wall');
  }

  _buildSectorSignboards(mats, halfX, halfZ) {
    const configs = [
      { title: 'AEGIS DRYDOCK', subtitle: 'TRIPLE GANTRY // SECTOR-99', accent: '#f09d38', pos: [0, 8.3, -36.1], rotY: 0 },
      { title: 'AFT KEEL BAY', subtitle: 'BOSS CRUCIBLE // SOUTH', accent: '#e05814', pos: [0, 8.3, 36.1], rotY: Math.PI },
    ];
    const screenW = 5.6;
    const screenH = 3.2;
    const bezelGeo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(screenW + 0.5, screenH + 0.5, 0.24), screenW + 0.5, screenH + 0.5, 0.24, 2.0, 2.0));
    const boardGeo = this._trackGeo(new THREE.PlaneGeometry(screenW, screenH));
    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const tex = this._texGen.getSignboardTexture(cfg.title, cfg.subtitle, cfg.accent);
      const boardMat = this._trackMat(new THREE.MeshStandardMaterial({ map: tex, emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.65, roughness: 0.5, metalness: 0.28 }));
      const g = new THREE.Group();
      g.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      g.rotation.y = cfg.rotY;
      const bezel = new THREE.Mesh(bezelGeo, mats.darkIronMat); bezel.position.z = -0.14;
      const board = new THREE.Mesh(boardGeo, boardMat); board.position.z = 0.02;
      g.add(bezel, board);
      this.root.add(g);
    }
  }

  _buildGantriesAndRamps(mats, halfX, halfZ) {
    const deckY = 4.2;
    const deckThick = 0.4;
    // Elevated Side Gantry Catwalk Wings (West [-27..-21.5] & East [21.5..27] along z in [-16..16])
    for (const side of [
      { minX: -27.0, maxX: -21.5, minZ: -16.0, maxZ: 16.0 },
      { minX: 21.5, maxX: 27.0, minZ: -16.0, maxZ: 16.0 },
    ]) {
      const w = side.maxX - side.minX;
      const d = side.maxZ - side.minZ;
      const cx = (side.minX + side.maxX) * 0.5;
      const cz = (side.minZ + side.maxZ) * 0.5;
      const geo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(w, deckThick, d), w, deckThick, d, 2.4, 2.4));
      const m = new THREE.Mesh(geo, mats.catwalkMat);
      m.position.set(cx, deckY - deckThick * 0.5, cz);
      m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
      this.collisionWorld.addBox(side.minX, deckY - deckThick, side.minZ, side.maxX, deckY, side.maxZ, 'platform');
    }

    // 4 Wide Stepped Gantry Stairs climbing onto Port & Starboard Elevated Catwalks (14 steps x 0.30m)
    const steps = 14;
    const stepH = deckY / steps;
    const stepD = 0.7;
    const rW = 3.8;
    const stepGeo = this._trackGeo(new THREE.BoxGeometry(rW, stepH + 0.04, stepD));
    for (const rc of [
      { cx: -24.25, zStart: -25.8, dirZ: 1 },
      { cx: -24.25, zStart: 25.8, dirZ: -1 },
      { cx: 24.25, zStart: -25.8, dirZ: 1 },
      { cx: 24.25, zStart: 25.8, dirZ: -1 },
    ]) {
      for (let s = 0; s < steps; s++) {
        const sy = (s + 1) * stepH;
        const sz = rc.zStart + rc.dirZ * (s + 0.5) * stepD;
        const sm = new THREE.Mesh(stepGeo, mats.stepMat);
        sm.position.set(rc.cx, sy - stepH * 0.5, sz);
        sm.castShadow = true; sm.receiveShadow = true;
        this.root.add(sm);
        this.collisionWorld.addBox(rc.cx - rW * 0.5, 0, sz - stepD * 0.5, rc.cx + rW * 0.5, sy, sz + stepD * 0.5, 'ramp');
      }
    }
  }

  _buildKeelButtressesAndBulkheads(mats) {
    const factory = MapPropFactory.getShared();
    // Mount 4 Sculpted Drydock Gantry Arches spanning over Center Boss Spine & Side Bridges
    for (const ga of [
      { x: 0, z: -20.0, r: 0 }, { x: 0, z: 16.0, r: 0 },
      { x: -20.5, z: 0, r: 0 }, { x: 20.5, z: 0, r: 0 },
    ]) {
      const pos = new THREE.Vector3(ga.x, 0, ga.z);
      const m = factory.mountProp(this.root, 'drydock_gantry_arch', {
        position: pos,
        rotationY: ga.r,
        scale: 1,
        onMounted: (inst) => {
          MapPropFactory.registerTransformedColliders(inst.colliderSpecs, this.collisionWorld, pos, ga.r, 1, 'pillar');
        },
      });
      this._propMounts.push(m);
    }

    // Mount 6 Aegis Cover Crates cleanly on bridges
    for (const cr of [
      { x: -5.8, z: 10.0, r: 0 }, { x: 5.8, z: 10.0, r: 0 },
      { x: -5.8, z: -22.0, r: 0 }, { x: 5.8, z: -22.0, r: 0 },
      { x: -17.5, z: 12.0, r: Math.PI * 0.5 }, { x: 17.5, z: -12.0, r: Math.PI * 0.5 },
    ]) {
      const pos = new THREE.Vector3(cr.x, 0, cr.z);
      const m = factory.mountProp(this.root, 'aegis_cover_crate', {
        position: pos,
        rotationY: cr.r,
        scale: 1,
        onMounted: (inst) => {
          MapPropFactory.registerTransformedColliders(inst.colliderSpecs, this.collisionWorld, pos, cr.r, 1, 'cover');
        },
      });
      this._propMounts.push(m);
    }
  }

  _createCitadelSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#02030a');
    grad.addColorStop(0.48, '#090e24');
    grad.addColorStop(0.78, '#171333');
    grad.addColorStop(1.0, '#050712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    // Golden Solar Eclipse Corona
    const corona = ctx.createRadialGradient(256, 86, 16, 256, 86, 84);
    corona.addColorStop(0, 'rgba(251,191,36,0.95)');
    corona.addColorStop(0.32, 'rgba(244,63,94,0.45)');
    corona.addColorStop(0.7, 'rgba(56,189,248,0.18)');
    corona.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = corona;
    ctx.fillRect(140, 0, 232, 190);
    ctx.fillStyle = '#04060f';
    ctx.beginPath();
    ctx.arc(256, 86, 17, 0, Math.PI * 2);
    ctx.fill();
    const rng = createRng(99099);
    for (let i = 0; i < 480; i++) {
      const x = rng() * 512;
      const y = rng() * 210;
      const r = rng() < 0.14 ? 1.6 : 0.85;
      ctx.fillStyle = rng() < 0.25 ? 'rgba(253,224,71,0.9)' : 'rgba(224,242,254,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildCranesDreadnoughtAndSkyDome(mats, innerBound) {
    // 1. Cosmic Deep-Space Starfield & Golden Solar Eclipse Sky Dome
    const skyTex = this._createCitadelSkyTexture();
    const skyGeo = this._trackGeo(new THREE.SphereGeometry(195, 28, 18));
    const skyMat = this._trackMat(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.root.add(new THREE.Mesh(skyGeo, skyMat));

    const sovereignCrimsonMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: new THREE.Color(0xe11d48),
        emissiveIntensity: 1.9,
        roughness: 0.25,
        metalness: 0.4,
      })
    );

    // 2. Grand Concentric Gold & Sovereign-Cyan Floor Inlay Rings Framing the Boss Arena
    const floorRingOuter = this._trackGeo(new THREE.RingGeometry(11.6, 12.2, 48));
    floorRingOuter.rotateX(-Math.PI * 0.5);
    const outerMesh = new THREE.Mesh(floorRingOuter, mats.tungstenAmberMat);
    outerMesh.position.y = 0.04;
    this.root.add(outerMesh);

    const floorRingMid = this._trackGeo(new THREE.RingGeometry(19.2, 19.7, 48));
    floorRingMid.rotateX(-Math.PI * 0.5);
    const midMesh = new THREE.Mesh(floorRingMid, mats.keelEmberMat);
    midMesh.position.y = 0.04;
    this.root.add(midMesh);

    // 3. Colossal Overhead Sovereign Orbital Dreadnought Halo Assembly (y = 14.8m)
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 14.8, 0);

    const giantRingGeo = this._trackGeo(new THREE.TorusGeometry(21.5, 0.55, 10, 56));
    giantRingGeo.rotateX(Math.PI * 0.5);
    this._radarRing = new THREE.Mesh(giantRingGeo, mats.tungstenAmberMat);
    haloGroup.add(this._radarRing);

    const innerHaloGeo = this._trackGeo(new THREE.TorusGeometry(14.5, 0.38, 10, 44));
    innerHaloGeo.rotateX(Math.PI * 0.5);
    this._radarDish = new THREE.Mesh(innerHaloGeo, mats.keelEmberMat);
    this._radarDish.position.y = -1.6;
    haloGroup.add(this._radarDish);
    this.root.add(haloGroup);

    // 4. Eight Towering Sovereign Monolith Obelisks with Floating Halo Rings Around Perimeter
    const obeliskGeo = this._trackGeo(new THREE.CylinderGeometry(1.2, 2.4, 28, 6));
    const obeliskHaloGeo = this._trackGeo(new THREE.TorusGeometry(2.6, 0.18, 8, 20));
    obeliskHaloGeo.rotateX(Math.PI * 0.5);
    const spireCapGeo = this._trackGeo(new THREE.OctahedronGeometry(1.4, 0));

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const dist = innerBound + 7.5;
      const ox = Math.cos(ang) * dist;
      const oz = Math.sin(ang) * dist;

      const ob = new THREE.Mesh(obeliskGeo, mats.darkIronMat);
      ob.position.set(ox, 12, oz);
      this.root.add(ob);

      const ped = new THREE.Mesh(
        this._trackGeo(new THREE.CylinderGeometry(2.8, 3.4, 2.4, 6)),
        mats.hullArmorMat
      );
      ped.position.set(ox, 1.2, oz);
      this.root.add(ped);

      const conduit = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(0.32, 22, 0.32)),
        i % 2 === 0 ? mats.keelEmberMat : mats.tungstenAmberMat
      );
      conduit.position.set(ox * 0.96, 12, oz * 0.96);
      this.root.add(conduit);

      const cap = new THREE.Mesh(spireCapGeo, i % 2 === 0 ? mats.tungstenAmberMat : sovereignCrimsonMat);
      cap.position.set(ox, 27.5, oz);
      this.root.add(cap);

      const oHalo = new THREE.Mesh(obeliskHaloGeo, i % 2 === 0 ? mats.keelEmberMat : mats.tungstenAmberMat);
      oHalo.position.set(ox, 22.5, oz);
      this.root.add(oHalo);
    }

    // 5. Distant Sovereign Orbital Fleet Silhouette Arches Beyond North Wall
    const fleetArcGeo = this._trackGeo(new THREE.TorusGeometry(42, 1.1, 10, 48, Math.PI));
    const fleetArc = new THREE.Mesh(fleetArcGeo, mats.hullArmorMat);
    fleetArc.position.set(0, 6, -68);
    this.root.add(fleetArc);
    const fleetGlowGeo = this._trackGeo(new THREE.TorusGeometry(39.5, 0.45, 8, 44, Math.PI));
    const fleetGlow = new THREE.Mesh(fleetGlowGeo, sovereignCrimsonMat);
    fleetGlow.position.set(0, 6, -67.5);
    this.root.add(fleetGlow);
  }

  _buildLighting() {
    this.scene.background = new THREE.Color(0x050712);
    this.scene.fog = new THREE.FogExp2(0x0c1026, 0.0076);

    this._hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0c091c, 1.08);
    this._hemiLight.position.set(0, 32, 0);
    this.root.add(this._hemiLight);
    this._lights.push(this._hemiLight);

    this._dirLight = new THREE.DirectionalLight(0xffe4b5, 2.45);
    this._dirLight.position.set(-26, 38, -24);
    this._dirLight.shadow.camera.left = -36;
    this._dirLight.shadow.camera.right = 36;
    this._dirLight.shadow.camera.top = 36;
    this._dirLight.shadow.camera.bottom = -36;
    this._dirLight.shadow.camera.near = 8;
    this._dirLight.shadow.camera.far = 112;
    this._dirLight.shadow.bias = -0.0005;
    this._dirLight.shadow.normalBias = 0.03;
    this.root.add(this._dirLight);
    this._lights.push(this._dirLight);

    // Strictly <= 2 PointLights
    const keelLight = new THREE.PointLight(0x38bdf8, 30, 34, 1.4);
    keelLight.position.set(0, 2.0, 0);
    keelLight.castShadow = false;
    this.root.add(keelLight);
    this._accentLights.push(keelLight);
    this._lights.push(keelLight);
    this._keelLight = keelLight;

    const gantryLight = new THREE.PointLight(0xf59e0b, 28, 38, 1.4);
    gantryLight.position.set(0, 9.5, -16);
    gantryLight.castShadow = false;
    this.root.add(gantryLight);
    this._accentLights.push(gantryLight);
    this._lights.push(gantryLight);
    this._gantryLight = gantryLight;
  }

  update(dt, elapsedTime) {
    if (!this._built) return;
    const t = Number.isFinite(elapsedTime) ? elapsedTime : 0;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;

    if (this._radarRing) {
      this._radarRing.rotation.y += safeDt * 0.48;
      this._radarRing.rotation.z = Math.sin(t * 0.5) * 0.08;
    }
    if (this._radarDish) {
      this._radarDish.rotation.y += safeDt * 0.85;
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.3);
    if (this._tungstenAmberMat) {
      this._tungstenAmberMat.emissiveIntensity = 1.05 + pulse * 0.45;
    }
    if (this._keelEmberMat) {
      this._keelEmberMat.emissiveIntensity = 1.15 + pulse * 0.45;
    }
    if (this._keelLight && this._keelLight.visible) {
      this._keelLight.intensity = 22 + pulse * 8;
    }
    if (this._distantBeaconMat) {
      const blink = Math.sin(t * 2.4) > 0.2 ? 1.0 : 0.25;
      this._distantBeaconMat.color.setRGB(0.22 * blink, 0.74 * blink, 0.97 * blink);
    }
  }

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
    this._keelLight = null;
    this._gantryLight = null;
    this._tungstenAmberMat = null;
    this._keelEmberMat = null;
    this._radarDish = null;
    this._radarRing = null;
    this._distantBeaconMat = null;
    if (this._propMounts) {
      for (let i = 0; i < this._propMounts.length; i++) {
        const m = this._propMounts[i];
        if (m) {
          m.userData.disposed = true;
          if (m.userData.propInstance && typeof m.userData.propInstance.dispose === 'function') {
            m.userData.propInstance.dispose();
          }
        }
      }
      this._propMounts.length = 0;
    }

    if (this._ownsTexGen && this._texGen) {
      this._texGen.dispose();
    }
    this._built = false;
  }
}
  __exports.Map6OrbitalDrydockBuilder = Map6OrbitalDrydockBuilder;
});
