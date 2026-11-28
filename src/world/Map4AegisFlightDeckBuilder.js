// Module: src/world/Map4AegisFlightDeckBuilder.js
__define("src/world/Map4AegisFlightDeckBuilder.js", (__exports, __require) => {
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
 * Map 4 Builder — "SECTOR-61 // AEGIS FLIGHT DECK" (Stages 6–7)
 * Unified Orbital Aegis Citadel forward hangar apron in charcoal-gunmetal & tungsten-amber.
 * Features riveted warship deck plates, U-shaped y=3.9m flight catwalks + side overlooks,
 * 4 wide stepped ramps (0.30m/step), 4 jump pads, 4 orbital capacitor pylons,
 * overhead hangar bridge rails (y=8.4m), and a docked Aegis frigate bow vista.
 */
class Map4AegisFlightDeckBuilder {
  constructor(scene, collisionWorld, qualityConfig = {}, sharedTexGen = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.qualityConfig = qualityConfig || {};

    this._ownsTexGen = !sharedTexGen;
    this._texGen = sharedTexGen || new TextureGenerator(4);

    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_SECTOR61_AegisFlightDeck';

    this._geometries = [];
    this._materials = [];
    this._lights = [];
    this._accentLights = [];
    this._dirLight = null;
    this._hemiLight = null;

    this._tungstenAmberMat = null;
    this._keelEmberMat = null;
    this._radarRingOuter = null;
    this._radarRingInner = null;
    this._distantBeaconMat = null;
    this._coreLight = null;
    this._northHangarLight = null;
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
    this.root.name = 'ArenaRoot_SECTOR61_AegisFlightDeck';
    this.scene.add(this.root);

    const halfX = 22.5; // Narrow 45m carrier width
    const halfZ = 41.5; // Long 83m runway length!
    const wallH = ARENA_CONFIG.wallHeight; // 11

    // Allow free fall off open stratosphere outer flank cliffs down past voidFallY = -14!
    this.collisionWorld.setArenaBounds(-halfX - 8, halfX + 8, -halfZ, halfZ, -26, 28);

    const mats = this._createMaterials();
    this._buildFlightDeckFloorAndPlinth(mats, halfX, halfZ);
    this._buildPerimeterWalls(mats, halfX, halfZ, wallH);
    this._buildSectorSignboards(mats, halfX, halfZ);
    this._buildElevatedCatwalksAndRamps(mats, halfX, halfZ);
    this._buildCapacitorsAndBulkheads(mats);
    this._buildHangarOverheadAndVista(mats, halfZ);
    this._buildLighting();
    this.setQuality(this.qualityConfig);

    return {
      mapId: 'aegis_flight_deck',
      mapIndex: 3,
      mapCode: '제61구역',
      mapName: '제61구역 · 이지스 비행갑판',
      mapSubtitle: '가속 레일 & 외곽 개방 성층권 낭떠러지',
      atmosphere: {
        bgColor: 0x061020,
        fogColor: 0x0a1c36,
        fogDensity: 0.0080,
      },
      playerSpawn: {
        pos: new THREE.Vector3(0, 0.05, 34.0),
        yaw: 0,
      },
      enemySpawns: [
        { pos: new THREE.Vector3(0.0, 0.05, -28.0), isElevated: false },
        { pos: new THREE.Vector3(-8.5, 0.05, -28.5), isElevated: false },
        { pos: new THREE.Vector3(8.5, 0.05, -28.5), isElevated: false },
        { pos: new THREE.Vector3(0.0, 0.05, -10.5), isElevated: false },
        { pos: new THREE.Vector3(-12.5, 0.05, -14.5), isElevated: false },
        { pos: new THREE.Vector3(12.5, 0.05, -14.5), isElevated: false },
        { pos: new THREE.Vector3(-19.0, 0.05, 0.0), isElevated: false },
        { pos: new THREE.Vector3(19.0, 0.05, 0.0), isElevated: false },
        { pos: new THREE.Vector3(-19.0, 3.95, 0.0), isElevated: true },
        { pos: new THREE.Vector3(19.0, 3.95, 0.0), isElevated: true },
        { pos: new THREE.Vector3(-8.0, 3.95, -35.0), isElevated: true },
        { pos: new THREE.Vector3(8.0, 3.95, -35.0), isElevated: true },
      ],
      pickupSpawns: [
        { pos: new THREE.Vector3(-19.5, 3.90, 0.0), type: 'shield' },
        { pos: new THREE.Vector3(19.5, 3.90, 0.0), type: 'health' },
        { pos: new THREE.Vector3(0.0, 3.90, -35.0), type: 'ammo' },
        { pos: new THREE.Vector3(-12.0, 0.0, 26.0), type: 'ammo' },
        { pos: new THREE.Vector3(12.0, 0.0, 26.0), type: 'shield' },
        { pos: new THREE.Vector3(0.0, 0.0, 12.0), type: 'health' },
      ],
      barrelSpawns: [
        new THREE.Vector3(-8.0, 0.0, 0.0),
        new THREE.Vector3(8.0, 0.0, 0.0),
        new THREE.Vector3(-5.0, 0.0, -23.0),
        new THREE.Vector3(5.0, 0.0, -23.0),
        new THREE.Vector3(-13.0, 0.0, 14.0),
        new THREE.Vector3(13.0, 0.0, 14.0),
      ],
      jumpPadSpawns: [
        { pos: new THREE.Vector3(-13.5, 0.0, 4.0), launchVy: 17.4, launchDirX: -1, launchDirZ: 0 },
        { pos: new THREE.Vector3(13.5, 0.0, 4.0), launchVy: 17.4, launchDirX: 1, launchDirZ: 0 },
        { pos: new THREE.Vector3(-6.5, 0.0, -21.5), launchVy: 17.4, launchDirX: 0, launchDirZ: -1 },
        { pos: new THREE.Vector3(6.5, 0.0, -21.5), launchVy: 17.4, launchDirX: 0, launchDirZ: -1 },
      ],
      boostRails: [
        { x: -5.0, y: 0, z: 12.0, minX: -6.8, maxX: -3.2, minZ: 4.5, maxZ: 19.5, width: 3.4, length: 14.0, dirX: 0, dirZ: -1, yaw: Math.PI, speed: 27.0 },
        { x: 5.0, y: 0, z: -12.0, minX: 3.2, maxX: 6.8, minZ: -19.5, maxZ: -4.5, width: 3.4, length: 14.0, dirX: 0, dirZ: 1, yaw: 0, speed: 27.0 },
      ],
      barrierGates: [
        { x: -11.5, y: 0, z: -2.0, yaw: 0, initialActive: true, width: 4.1, height: 3.2 },
        { x: 11.5, y: 0, z: 2.0, yaw: 0, initialActive: false, width: 4.1, height: 3.2 },
      ],
      voidFallY: -14.0,
      controlZoneCenter: new THREE.Vector3(0, 0.2, -19.5),
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
    const deckTex = this._texGen.getDrydockFloorTextures(14, 14);
    const concreteTex = this._texGen.getWallTextures(1, 1);
    const catwalkTex = this._texGen.getCatwalkTextures(1, 1);
    const rustTex = this._texGen.getRustMetalTextures(1, 1);
    const hazardTex = this._texGen.getHazardTextures(1, 1);
    const ruinedSkyTex = this._texGen.getRuinedSkylineTextures();

    const deckFloorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x8fb3d4,
        map: deckTex.map,
        roughnessMap: deckTex.roughnessMap,
        bumpMap: deckTex.bumpMap,
        bumpScale: 0.045,
        metalness: 0.45,
        roughness: 0.68,
      })
    );

    const bulkheadWallMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x16243a,
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
        color: 0xcbd5e1,
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
        color: 0x0f1b2e,
        roughnessMap: rustTex.roughnessMap,
        bumpMap: rustTex.bumpMap,
        bumpScale: 0.032,
        metalness: 0.82,
        roughness: 0.48,
      })
    );

    const catwalkMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x334e6e,
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
        color: 0x6482a6,
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
        color: 0x38bdf8,
        emissive: new THREE.Color(0x00e5ff),
        emissiveIntensity: 1.25,
        roughness: 0.36,
        metalness: 0.25,
      })
    );

    const keelEmberMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: new THREE.Color(0x0284c7),
        emissiveIntensity: 1.35,
        roughness: 0.4,
        metalness: 0.15,
      })
    );

    const ruinedSkylineMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x132238,
        map: ruinedSkyTex.map,
        roughnessMap: ruinedSkyTex.roughnessMap,
        roughness: 0.88,
        metalness: 0.34,
      })
    );

    const distantBeaconMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
      })
    );

    this._tungstenAmberMat = tungstenAmberMat;
    this._keelEmberMat = keelEmberMat;
    this._distantBeaconMat = distantBeaconMat;

    return {
      deckFloorMat,
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

  _buildFlightDeckFloorAndPlinth(mats, halfX, halfZ) {
    // Central 32m x 83m Carrier Runway + North/Mid/South Hangar Spurs leaving OPEN Stratosphere Void Cliffs on flanks!
    const deckPlates = [
      { minX: -16.0, maxX: 16.0, minZ: -halfZ, maxZ: halfZ },
      { minX: -halfX, maxX: -16.0, minZ: -halfZ, maxZ: -22.0 },
      { minX: 16.0, maxX: halfX, minZ: -halfZ, maxZ: -22.0 },
      { minX: -halfX, maxX: -16.0, minZ: -7.0, maxZ: 7.0 },
      { minX: 16.0, maxX: halfX, minZ: -7.0, maxZ: 7.0 },
      { minX: -halfX, maxX: -16.0, minZ: 22.0, maxZ: halfZ },
      { minX: 16.0, maxX: halfX, minZ: 22.0, maxZ: halfZ },
    ];
    for (let i = 0; i < deckPlates.length; i++) {
      const p = deckPlates[i];
      const w = p.maxX - p.minX;
      const d = p.maxZ - p.minZ;
      const cx = (p.minX + p.maxX) * 0.5;
      const cz = (p.minZ + p.maxZ) * 0.5;
      const geo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(w, 0.8, d), w, 0.8, d, 3.0, 3.0));
      const m = new THREE.Mesh(geo, mats.deckFloorMat);
      m.position.set(cx, -0.4, cz);
      m.receiveShadow = true;
      this.root.add(m);
      this.collisionWorld.addBox(p.minX, -0.9, p.minZ, p.maxX, 0.0, p.maxZ, 'floor');
    }

    // Bright hazard warning curbs framing the 4 Open Stratosphere Cliff Drop-Offs (|x|=15.85 along [-22..-7] and [7..22])
    const edgeStripGeo = this._trackGeo(new THREE.BoxGeometry(0.32, 0.08, 15.0));
    for (const sx of [-15.84, 15.84]) {
      for (const sz of [-14.5, 14.5]) {
        const edge = new THREE.Mesh(edgeStripGeo, mats.hazardMat);
        edge.position.set(sx, 0.04, sz);
        this.root.add(edge);
      }
    }

    // Center Tactical Turntable Dais
    const daisGeo = this._trackGeo(new THREE.CylinderGeometry(5.6, 6.2, 0.2, 8));
    const dais = new THREE.Mesh(daisGeo, mats.hullArmorMat);
    dais.position.y = 0.1;
    dais.receiveShadow = true;
    this.root.add(dais);
    this.collisionWorld.addBox(-4.0, 0, -4.0, 4.0, 0.2, 4.0, 'platform');
    this.collisionWorld.addBox(-5.3, 0, -2.2, 5.3, 0.2, 2.2, 'platform');
    this.collisionWorld.addBox(-2.2, 0, -5.3, 2.2, 0.2, 5.3, 'platform');
  }

  _buildPerimeterWalls(mats, halfX, halfZ, wallH) {
    const wallThick = 1.5;
    const wallSpanX = halfX * 2 + wallThick * 2;
    const wallGeoX = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(wallSpanX, wallH, wallThick), wallSpanX, wallH, wallThick, 6.4, 5.5));
    // Solid Bow & Stern hangar walls (side flank bays stay UNWALLED over open stratosphere cliffs!)
    const endDefs = [
      { pos: [0, wallH * 0.5, -(halfZ + wallThick * 0.5)], box: [-halfX - wallThick, 0, -halfZ - wallThick, halfX + wallThick, wallH + 4, -halfZ] },
      { pos: [0, wallH * 0.5, halfZ + wallThick * 0.5], box: [-halfX - wallThick, 0, halfZ, halfX + wallThick, wallH + 4, halfZ + wallThick] },
    ];
    for (const d of endDefs) {
      const w = new THREE.Mesh(wallGeoX, mats.bulkheadWallMat);
      w.position.set(d.pos[0], d.pos[1], d.pos[2]);
      w.receiveShadow = true;
      this.root.add(w);
      this.collisionWorld.addBox(d.box[0], d.box[1], d.box[2], d.box[3], d.box[4], d.box[5], 'wall');
    }

    // Side Spur Tip Wall Segments ONLY on docked bay segments (leaving [-22..-7] and [7..22] open to sky drop!)
    const spurSegments = [
      { minZ: -halfZ, maxZ: -22.0 },
      { minZ: -7.0, maxZ: 7.0 },
      { minZ: 22.0, maxZ: halfZ },
    ];
    for (const seg of spurSegments) {
      const len = seg.maxZ - seg.minZ;
      const cz = (seg.minZ + seg.maxZ) * 0.5;
      const wGeo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(wallThick, wallH, len), wallThick, wallH, len, 4.0, 5.0));
      for (const sx of [-(halfX + wallThick * 0.5), halfX + wallThick * 0.5]) {
        const w = new THREE.Mesh(wGeo, mats.bulkheadWallMat);
        w.position.set(sx, wallH * 0.5, cz);
        w.receiveShadow = true;
        this.root.add(w);
      }
      this.collisionWorld.addBox(-halfX - wallThick, 0, seg.minZ, -halfX, wallH + 4, seg.maxZ, 'wall');
      this.collisionWorld.addBox(halfX, 0, seg.minZ, halfX + wallThick, wallH + 4, seg.maxZ, 'wall');
    }
  }

  _buildSectorSignboards(mats, halfX, halfZ) {
    const configs = [
      { title: 'FLIGHT RUNWAY', subtitle: 'CATAPULT // SECTOR-61', accent: '#f09d38', pos: [0, 8.3, -(halfZ - 0.36)], rotY: 0 },
      { title: 'LAUNCH BAY', subtitle: 'STERN APPROACH // SOUTH', accent: '#e05814', pos: [0, 8.3, halfZ - 0.36], rotY: Math.PI },
      { title: 'PORT OVERLOOK', subtitle: 'SPUR DECK +3.9M', accent: '#f09d38', pos: [-(halfX - 0.36), 8.3, 0], rotY: Math.PI * 0.5 },
      { title: 'STARBOARD OVERLOOK', subtitle: 'SPUR DECK +3.9M', accent: '#f09d38', pos: [halfX - 0.36, 8.3, 0], rotY: -Math.PI * 0.5 },
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

  _buildElevatedCatwalksAndRamps(mats, halfX, halfZ) {
    const deckY = 3.9;
    const deckThick = 0.4;
    const platformSpecs = [
      { minX: -halfX, maxX: -16.0, minZ: -6.5, maxZ: 6.5 },
      { minX: 16.0, maxX: halfX, minZ: -6.5, maxZ: 6.5 },
      { minX: -16.0, maxX: 16.0, minZ: -halfZ, maxZ: -31.0 },
    ];
    for (const p of platformSpecs) {
      const w = p.maxX - p.minX;
      const d = p.maxZ - p.minZ;
      const cx = (p.minX + p.maxX) * 0.5;
      const cz = (p.minZ + p.maxZ) * 0.5;
      const hullGeo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(w, deckThick, d), w, deckThick, d, 2.4, 2.4));
      const m = new THREE.Mesh(hullGeo, mats.catwalkMat);
      m.position.set(cx, deckY - deckThick * 0.5, cz);
      m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
      this.collisionWorld.addBox(p.minX, deckY - deckThick, p.minZ, p.maxX, deckY, p.maxZ, 'platform');
    }

    // 2 Wide Stepped Ramps climbing up onto North Control Bridge (z=-21.9..-31.0, 13 steps x 0.30m)
    const steps = 13;
    const stepH = deckY / steps;
    const stepD = 0.7;
    const rW = 4.2;
    const stepGeo = this._trackGeo(new THREE.BoxGeometry(rW, stepH + 0.04, stepD));
    for (const rx of [-11.5, 11.5]) {
      for (let s = 0; s < steps; s++) {
        const sy = (s + 1) * stepH;
        const sz = -21.9 - (s + 0.5) * stepD;
        const sm = new THREE.Mesh(stepGeo, mats.stepMat);
        sm.position.set(rx, sy - stepH * 0.5, sz);
        sm.castShadow = true; sm.receiveShadow = true;
        this.root.add(sm);
        this.collisionWorld.addBox(rx - rW * 0.5, 0, sz - stepD * 0.5, rx + rW * 0.5, sy, sz + stepD * 0.5, 'ramp');
      }
    }
  }

  _buildCapacitorsAndBulkheads(mats) {
    const factory = MapPropFactory.getShared();
    const crateCoords = [
      { x: -7.5, z: 18.0, r: 0 }, { x: 7.5, z: 18.0, r: 0 },
      { x: -7.5, z: -8.0, r: 0 }, { x: 7.5, z: -8.0, r: 0 },
      { x: -13.0, z: 0.0, r: Math.PI * 0.5 }, { x: 13.0, z: 0.0, r: Math.PI * 0.5 },
      { x: -7.5, z: -26.0, r: 0 }, { x: 7.5, z: -26.0, r: 0 },
    ];
    for (const c of crateCoords) {
      const pos = new THREE.Vector3(c.x, 0, c.z);
      const mount = factory.mountProp(this.root, 'aegis_cover_crate', {
        position: pos,
        rotationY: c.r,
        scale: 1,
        onMounted: (inst) => {
          MapPropFactory.registerTransformedColliders(inst.colliderSpecs, this.collisionWorld, pos, c.r, 1, 'cover');
        },
      });
      this._propMounts.push(mount);
    }
  }

  _createOrbitalSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#020612');
    grad.addColorStop(0.45, '#071730');
    grad.addColorStop(0.72, '#0c2c52');
    grad.addColorStop(1.0, '#051020');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    // Crisp starfield
    const rng = createRng(61061);
    for (let i = 0; i < 420; i++) {
      const x = rng() * 512;
      const y = rng() * 190;
      const r = rng() < 0.15 ? 1.6 : 0.9;
      ctx.fillStyle = rng() < 0.3 ? 'rgba(125,211,252,0.9)' : 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glowing Orbital Blue Earth horizon arc
    const pGrad = ctx.createRadialGradient(256, 245, 25, 256, 245, 130);
    pGrad.addColorStop(0, 'rgba(56,189,248,0.65)');
    pGrad.addColorStop(0.5, 'rgba(14,165,233,0.28)');
    pGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pGrad;
    ctx.fillRect(0, 80, 512, 176);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildHangarOverheadAndVista(mats, innerBound) {
    // 1. Deep-Space Starfield & Glowing Blue Earth Horizon Sky Dome
    const skyTex = this._createOrbitalSkyTexture();
    const skyGeo = this._trackGeo(new THREE.SphereGeometry(195, 28, 18));
    const skyMat = this._trackMat(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.root.add(new THREE.Mesh(skyGeo, skyMat));

    // Translucent cyan holographic force-field material
    const holoFieldMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const whiteHullMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xeaf2fb,
        metalness: 0.78,
        roughness: 0.22,
      })
    );

    // 2. Glowing Cyan Magnetic Launch Runway Strips & Chevron Guide Arrows along the Flight Deck
    const stripGeo = this._trackGeo(new THREE.PlaneGeometry(0.45, innerBound * 1.75));
    stripGeo.rotateX(-Math.PI * 0.5);
    for (const sx of [-4.2, 4.2, -12.8, 12.8]) {
      const strip = new THREE.Mesh(stripGeo, mats.tungstenAmberMat);
      strip.position.set(sx, 0.04, 0);
      this.root.add(strip);
    }
    const chevGeo = this._trackGeo(new THREE.BoxGeometry(2.6, 0.04, 0.35));
    for (let z = -22; z <= 18; z += 8) {
      for (const side of [-1, 1]) {
        const chev = new THREE.Mesh(chevGeo, mats.keelEmberMat);
        chev.position.set(side * 1.15, 0.05, z);
        chev.rotation.y = side * 0.45;
        this.root.add(chev);
      }
    }

    // 3. Three Sweeping Holographic Hangar Force-Field Arches Spanning Overhead (y = 9.5m..14m)
    const archGeo = this._trackGeo(new THREE.TorusGeometry(innerBound * 0.92, 0.42, 8, 36, Math.PI));
    const archGlowGeo = this._trackGeo(new THREE.TorusGeometry(innerBound * 0.89, 0.16, 8, 36, Math.PI));
    for (const az of [-15, 0, 15]) {
      const arch = new THREE.Mesh(archGeo, mats.hullArmorMat);
      arch.position.set(0, 6.0, az);
      this.root.add(arch);
      const glowArch = new THREE.Mesh(archGlowGeo, mats.tungstenAmberMat);
      glowArch.position.set(0, 6.0, az);
      this.root.add(glowArch);
    }

    // 4. Two Multi-Part Detailed Aegis Orbital Gunships Suspended on Overhead Magnetic Docking Clamps
    this._dockedFighters = [];
    const fuselageGeo = this._trackGeo(new THREE.ConeGeometry(1.25, 9.8, 6));
    fuselageGeo.rotateX(Math.PI * 0.5);
    const bodyCoreGeo = this._trackGeo(new THREE.BoxGeometry(2.1, 1.2, 5.2));
    const canopyGeo = this._trackGeo(new THREE.BoxGeometry(1.1, 0.55, 2.4));
    const wingGeo = this._trackGeo(new THREE.BoxGeometry(9.6, 0.20, 3.2));
    const tailFinGeo = this._trackGeo(new THREE.BoxGeometry(0.18, 2.1, 2.2));
    const podGeo = this._trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 3.2, 8));
    podGeo.rotateX(Math.PI * 0.5);
    const engineGeo = this._trackGeo(new THREE.TorusGeometry(0.68, 0.15, 8, 18));
    const clampGeo = this._trackGeo(new THREE.BoxGeometry(0.45, 5.2, 0.65));

    for (const fx of [-13.5, 13.5]) {
      const fighter = new THREE.Group();
      fighter.position.set(fx, 11.4, -5.5);
      fighter.rotation.z = fx < 0 ? 0.12 : -0.12;
      fighter.add(new THREE.Mesh(fuselageGeo, whiteHullMat));

      const core = new THREE.Mesh(bodyCoreGeo, mats.darkIronMat);
      core.position.set(0, -0.15, -1.6);
      fighter.add(core);

      const canopy = new THREE.Mesh(canopyGeo, mats.keelEmberMat);
      canopy.position.set(0, 0.58, 0.4);
      fighter.add(canopy);

      const wing = new THREE.Mesh(wingGeo, mats.hullArmorMat);
      wing.position.set(0, -0.1, -1.2);
      fighter.add(wing);

      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(tailFinGeo, whiteHullMat);
        fin.position.set(side * 2.2, 0.85, -3.4);
        fin.rotation.z = side * -0.28;
        fighter.add(fin);

        const pod = new THREE.Mesh(podGeo, mats.darkIronMat);
        pod.position.set(side * 3.4, -0.45, -0.6);
        fighter.add(pod);

        const eng = new THREE.Mesh(engineGeo, mats.tungstenAmberMat);
        eng.position.set(side * 1.65, 0, -4.6);
        fighter.add(eng);

        const clamp = new THREE.Mesh(clampGeo, mats.darkIronMat);
        clamp.position.set(side * 1.4, 3.2, -1.2);
        fighter.add(clamp);
      }
      this.root.add(fighter);
      this._dockedFighters.push(fighter);
    }

    // 5. Giant Orbital Planet Earth Sphere & Rotating Orbital Ring Beyond North Hangar Bay
    const planetGroup = new THREE.Group();
    planetGroup.position.set(0, 26, -98);
    const planetGeo = this._trackGeo(new THREE.SphereGeometry(28, 24, 18));
    const planetMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: new THREE.Color(0x0369a1),
        emissiveIntensity: 0.65,
        roughness: 0.55,
        metalness: 0.1,
      })
    );
    planetGroup.add(new THREE.Mesh(planetGeo, planetMat));
    const ringGeo = this._trackGeo(new THREE.TorusGeometry(39, 0.55, 8, 48));
    ringGeo.rotateX(Math.PI * 0.42);
    this._radarRingOuter = new THREE.Mesh(ringGeo, mats.tungstenAmberMat);
    planetGroup.add(this._radarRingOuter);

    const innerRingGeo = this._trackGeo(new THREE.TorusGeometry(34, 0.35, 8, 40));
    innerRingGeo.rotateX(Math.PI * 0.46);
    this._radarRingInner = new THREE.Mesh(innerRingGeo, holoFieldMat);
    planetGroup.add(this._radarRingInner);
    this.root.add(planetGroup);

    // 6. Glowing Cyan Hangar Force-Field Portal Screens on North/East/West Perimeter
    const fieldGeo = this._trackGeo(new THREE.PlaneGeometry(24, 9.5));
    const northField = new THREE.Mesh(fieldGeo, holoFieldMat);
    northField.position.set(0, 15.2, -innerBound + 0.4);
    this.root.add(northField);
  }

  _buildLighting() {
    this.scene.background = new THREE.Color(0x061020);
    this.scene.fog = new THREE.FogExp2(0x0a1c36, 0.0080);

    this._hemiLight = new THREE.HemisphereLight(0xb8dcff, 0x0a182e, 1.12);
    this._hemiLight.position.set(0, 32, 0);
    this.root.add(this._hemiLight);
    this._lights.push(this._hemiLight);

    this._dirLight = new THREE.DirectionalLight(0xd8f0ff, 2.35);
    this._dirLight.position.set(-28, 38, -22);
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
    const coreLight = new THREE.PointLight(0x00e5ff, 30, 34, 1.4);
    coreLight.position.set(0, 2.2, 0);
    coreLight.castShadow = false;
    this.root.add(coreLight);
    this._accentLights.push(coreLight);
    this._lights.push(coreLight);
    this._coreLight = coreLight;

    const northHangar = new THREE.PointLight(0x38bdf8, 26, 38, 1.4);
    northHangar.position.set(0, 9.5, -18);
    northHangar.castShadow = false;
    this.root.add(northHangar);
    this._accentLights.push(northHangar);
    this._lights.push(northHangar);
    this._northHangarLight = northHangar;
  }

  update(dt, elapsedTime) {
    if (!this._built) return;
    const t = Number.isFinite(elapsedTime) ? elapsedTime : 0;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;

    if (this._radarRingOuter) {
      this._radarRingOuter.rotation.y += safeDt * 0.45;
    }
    if (this._radarRingInner) {
      this._radarRingInner.rotation.y -= safeDt * 0.72;
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    if (this._tungstenAmberMat) {
      this._tungstenAmberMat.emissiveIntensity = 1.05 + pulse * 0.45;
    }
    if (this._keelEmberMat) {
      this._keelEmberMat.emissiveIntensity = 1.15 + pulse * 0.45;
    }
    if (this._coreLight && this._coreLight.visible) {
      this._coreLight.intensity = 22 + pulse * 8;
    }
    if (this._distantBeaconMat) {
      const blink = Math.sin(t * 2.4) > 0.25 ? 1.0 : 0.25;
      this._distantBeaconMat.color.setRGB(0.05 * blink, 0.85 * blink, 1.0 * blink);
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
    this._coreLight = null;
    this._northHangarLight = null;
    this._tungstenAmberMat = null;
    this._keelEmberMat = null;
    this._radarRingOuter = null;
    this._radarRingInner = null;
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
  __exports.Map4AegisFlightDeckBuilder = Map4AegisFlightDeckBuilder;
});
