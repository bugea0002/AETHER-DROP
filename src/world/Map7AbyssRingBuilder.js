// Module: src/world/Map7AbyssRingBuilder.js
__define("src/world/Map7AbyssRingBuilder.js", (__exports, __require) => {
const { ARENA_CONFIG } = __require("src/config/constants.js");
const { TextureGenerator } = __require("src/world/TextureGenerator.js");

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
 * Map 7 Builder — "SECTOR-108 // ABYSSAL CONDUIT RING"
 * Act 3 Orbital Abyss Core map (Waves 11–13).
 * Features obsidian hexagonal energy floor, flanking y=3.8m conduit decks + wide ramps,
 * 4 jump pads, 2 localized Low-Gravity Core Zones, Void Gate spawn pedestals,
 * rotating dimensional conduit rings, and <= 2 dynamic PointLights.
 */
class Map7AbyssRingBuilder {
  constructor(scene, collisionWorld, qualityConfig = {}, sharedTexGen = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.qualityConfig = qualityConfig || {};

    this._ownsTexGen = !sharedTexGen;
    this._texGen = sharedTexGen || new TextureGenerator(4);

    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_SECTOR108_AbyssConduitRing';

    this._geometries = [];
    this._materials = [];
    this._lights = [];
    this._accentLights = [];
    this._dirLight = null;
    this._hemiLight = null;
    this._coreLight = null;
    this._riftLight = null;

    this._violetGlowMat = null;
    this._cyanGlowMat = null;
    this._singularityRings = [];
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
    this.root.name = 'ArenaRoot_SECTOR108_AbyssConduitRing';
    this.scene.add(this.root);

    const half = ARENA_CONFIG.halfSize; // 32
    const innerBound = half - 0.5; // 31.5
    const wallH = ARENA_CONFIG.wallHeight; // 11

    this.collisionWorld.setArenaBounds(-innerBound, innerBound, -innerBound, innerBound, 0, 30);

    const mats = this._createMaterials();
    this._buildFloorAndSingularity(mats, innerBound);
    this._buildPerimeterWallsAndSignboards(mats, innerBound, wallH);
    this._buildConduitDecksAndRamps(mats, innerBound);
    this._buildTacticalCover(mats);
    this._buildSkyConduitBackdrop(mats, innerBound);
    this._buildLighting();
    this.setQuality(this.qualityConfig);

    return {
      mapId: 'abyss_conduit_ring',
      mapIndex: 7,
      mapCode: '제108구역',
      mapName: '제108구역 · 심연 도관 링',
      mapSubtitle: '저중력 궤도 도관 및 차원 균열',
      atmosphere: {
        bgColor: 0x05040f,
        fogColor: 0x0b0720,
        fogDensity: 0.0078,
      },
      playerSpawn: {
        pos: new THREE.Vector3(0, 0.05, 22.8),
        yaw: 0,
      },
      enemySpawns: [
        { pos: new THREE.Vector3(0.0, 0.05, -20.0), isElevated: false },
        { pos: new THREE.Vector3(-8.5, 0.05, -19.5), isElevated: false },
        { pos: new THREE.Vector3(8.5, 0.05, -19.5), isElevated: false },
        { pos: new THREE.Vector3(-19.5, 0.05, -8.0), isElevated: false },
        { pos: new THREE.Vector3(19.5, 0.05, -8.0), isElevated: false },
        { pos: new THREE.Vector3(-19.5, 0.05, 8.0), isElevated: false },
        { pos: new THREE.Vector3(19.5, 0.05, 8.0), isElevated: false },
        { pos: new THREE.Vector3(0.0, 0.05, -10.5), isElevated: false },
        { pos: new THREE.Vector3(-27.2, 3.85, -10.0), isElevated: true },
        { pos: new THREE.Vector3(27.2, 3.85, -10.0), isElevated: true },
        { pos: new THREE.Vector3(-27.2, 3.85, 10.0), isElevated: true },
        { pos: new THREE.Vector3(27.2, 3.85, 10.0), isElevated: true },
      ],
      pickupSpawns: [
        { pos: new THREE.Vector3(-27.2, 3.85, 0.0), type: 'shield' },
        { pos: new THREE.Vector3(27.2, 3.85, 0.0), type: 'health' },
        { pos: new THREE.Vector3(0.0, 3.85, -27.2), type: 'ammo' },
        { pos: new THREE.Vector3(-14.0, 0.0, 14.0), type: 'ammo' },
        { pos: new THREE.Vector3(14.0, 0.0, -14.0), type: 'shield' },
        { pos: new THREE.Vector3(0.0, 0.0, 15.8), type: 'health' },
      ],
      barrelSpawns: [
        new THREE.Vector3(-7.8, 0.0, -6.5),
        new THREE.Vector3(7.8, 0.0, -6.5),
        new THREE.Vector3(-7.8, 0.0, 6.5),
        new THREE.Vector3(7.8, 0.0, 6.5),
        new THREE.Vector3(0.0, 0.0, -14.5),
        new THREE.Vector3(0.0, 0.0, 11.5),
      ],
      jumpPadSpawns: [
        { pos: new THREE.Vector3(-14.5, 0.0, -17.5), launchVy: 17.2, launchDirX: 0, launchDirZ: -1 },
        { pos: new THREE.Vector3(14.5, 0.0, -17.5), launchVy: 17.2, launchDirX: 0, launchDirZ: -1 },
        { pos: new THREE.Vector3(-14.5, 0.0, 17.5), launchVy: 17.2, launchDirX: 0, launchDirZ: 1 },
        { pos: new THREE.Vector3(14.5, 0.0, 17.5), launchVy: 17.2, launchDirX: 0, launchDirZ: 1 },
      ],
      lowGravityZones: [
        { pos: new THREE.Vector3(-14.0, 0.0, -4.0), radius: 6.8, height: 8.5, gravityScale: 0.45 },
        { pos: new THREE.Vector3(14.0, 0.0, 4.0), radius: 6.8, height: 8.5, gravityScale: 0.45 },
      ],
      voidGateSpawns: [
        { pos: new THREE.Vector3(-20.5, 0.0, -16.5), yaw: Math.PI * 0.22 },
        { pos: new THREE.Vector3(20.5, 0.0, -16.5), yaw: -Math.PI * 0.22 },
      ],
      controlZoneCenter: new THREE.Vector3(0, 0.2, 0),
      controlZoneRadius: ARENA_CONFIG.controlZoneRadius,
      arenaBounds: {
        minX: -innerBound,
        maxX: innerBound,
        minZ: -innerBound,
        maxZ: innerBound,
      },
    };
  }

  _createMaterials() {
    const abyssTex = this._texGen.getAbyssFloorTextures(14, 14);
    const concreteTex = this._texGen.getWallTextures(1, 1);
    const catwalkTex = this._texGen.getCatwalkTextures(1, 1);
    const hazardTex = this._texGen.getHazardTextures(1, 1);

    const floorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x9aa4cf,
        map: abyssTex.map,
        roughnessMap: abyssTex.roughnessMap,
        bumpMap: abyssTex.bumpMap,
        bumpScale: 0.045,
        metalness: 0.55,
        roughness: 0.56,
      })
    );

    const wallMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1d1c30,
        map: concreteTex.map,
        roughnessMap: concreteTex.roughnessMap,
        bumpMap: concreteTex.bumpMap,
        bumpScale: 0.04,
        metalness: 0.52,
        roughness: 0.72,
      })
    );

    const obsidianMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x131324,
        metalness: 0.78,
        roughness: 0.34,
      })
    );

    const deckMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x262945,
        map: catwalkTex.map,
        roughnessMap: catwalkTex.roughnessMap,
        bumpMap: catwalkTex.bumpMap,
        bumpScale: 0.035,
        metalness: 0.68,
        roughness: 0.54,
      })
    );

    const hazardMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: hazardTex.map,
        roughnessMap: hazardTex.roughnessMap,
        metalness: 0.38,
        roughness: 0.7,
      })
    );

    const violetGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: new THREE.Color(0x9333ea),
        emissiveIntensity: 1.8,
        roughness: 0.25,
        metalness: 0.2,
      })
    );

    const cyanGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: new THREE.Color(0x0284c7),
        emissiveIntensity: 1.55,
        roughness: 0.25,
        metalness: 0.2,
      })
    );

    this._violetGlowMat = violetGlowMat;
    this._cyanGlowMat = cyanGlowMat;

    return {
      floorMat,
      wallMat,
      obsidianMat,
      deckMat,
      hazardMat,
      violetGlowMat,
      cyanGlowMat,
    };
  }

  _buildFloorAndSingularity(mats, innerBound) {
    const floorSize = innerBound * 2 + 2;
    const floorGeo = this._trackGeo(new THREE.PlaneGeometry(floorSize, floorSize));
    const floorMesh = new THREE.Mesh(floorGeo, mats.floorMat);
    floorMesh.rotation.x = -Math.PI * 0.5;
    floorMesh.receiveShadow = true;
    this.root.add(floorMesh);

    this.collisionWorld.addBox(-34, -1.0, -34, 34, 0.0, 34, 'floor');

    // Center raised octagonal conduit pad (y=0.20m)
    const daisGeo = this._trackGeo(new THREE.CylinderGeometry(5.6, 6.2, 0.2, 8));
    const dais = new THREE.Mesh(daisGeo, mats.obsidianMat);
    dais.position.y = 0.1;
    dais.receiveShadow = true;
    this.root.add(dais);
    this.collisionWorld.addBox(-4.2, 0, -4.2, 4.2, 0.2, 4.2, 'platform');
    this.collisionWorld.addBox(-5.6, 0, -2.2, 5.6, 0.2, 2.2, 'platform');
    this.collisionWorld.addBox(-2.2, 0, -5.6, 2.2, 0.2, 5.6, 'platform');

    const outerRing = new THREE.Mesh(
      this._trackGeo(new THREE.RingGeometry(4.3, 4.7, 32)),
      mats.violetGlowMat
    );
    outerRing.rotation.x = -Math.PI * 0.5;
    outerRing.position.y = 0.21;
    this.root.add(outerRing);

    const innerRing = new THREE.Mesh(
      this._trackGeo(new THREE.RingGeometry(2.2, 2.55, 24)),
      mats.cyanGlowMat
    );
    innerRing.rotation.x = -Math.PI * 0.5;
    innerRing.position.y = 0.212;
    this.root.add(innerRing);

    // High-altitude orbital abyss singularity torus rings overhead (pure decoration, y >= 15m)
    const r1 = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(9.5, 0.22, 10, 48)),
      mats.violetGlowMat
    );
    r1.position.set(0, 17.5, 0);
    r1.rotation.x = Math.PI * 0.42;
    this.root.add(r1);

    const r2 = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(6.8, 0.16, 8, 40)),
      mats.cyanGlowMat
    );
    r2.position.set(0, 17.5, 0);
    r2.rotation.y = Math.PI * 0.35;
    this.root.add(r2);

    this._singularityRings.push(r1, r2);
  }

  _buildPerimeterWallsAndSignboards(mats, innerBound, wallH) {
    const wallThick = 1.5;
    const wallSpan = innerBound * 2 + wallThick * 2;
    const wallGeoX = this._trackGeo(
      scaleBoxUVs(new THREE.BoxGeometry(wallSpan, wallH, wallThick), wallSpan, wallH, wallThick, 6.4, 5.5)
    );
    const wallGeoZ = this._trackGeo(
      scaleBoxUVs(new THREE.BoxGeometry(wallThick, wallH, wallSpan), wallThick, wallH, wallSpan, 6.4, 5.5)
    );

    const defs = [
      { geo: wallGeoX, pos: [0, wallH * 0.5, -(innerBound + wallThick * 0.5)], box: [-innerBound - wallThick, 0, -innerBound - wallThick, innerBound + wallThick, wallH + 4, -innerBound] },
      { geo: wallGeoX, pos: [0, wallH * 0.5, innerBound + wallThick * 0.5], box: [-innerBound - wallThick, 0, innerBound, innerBound + wallThick, wallH + 4, innerBound + wallThick] },
      { geo: wallGeoZ, pos: [-(innerBound + wallThick * 0.5), wallH * 0.5, 0], box: [-innerBound - wallThick, 0, -innerBound, -innerBound, wallH + 4, innerBound] },
      { geo: wallGeoZ, pos: [innerBound + wallThick * 0.5, wallH * 0.5, 0], box: [innerBound, 0, -innerBound, innerBound + wallThick, wallH + 4, innerBound] },
    ];
    for (let i = 0; i < defs.length; i++) {
      const m = new THREE.Mesh(defs[i].geo, mats.wallMat);
      m.position.set(defs[i].pos[0], defs[i].pos[1], defs[i].pos[2]);
      m.receiveShadow = true;
      this.root.add(m);
      const b = defs[i].box;
      this.collisionWorld.addBox(b[0], b[1], b[2], b[3], b[4], b[5], 'wall');
    }

    // Perimeter glowing conduit ribs
    const ribGeo = this._trackGeo(new THREE.BoxGeometry(0.45, 7.0, 0.65));
    const stripGeo = this._trackGeo(new THREE.BoxGeometry(0.14, 6.2, 0.14));
    const offsets = [-22, -11, 11, 22];
    for (let i = 0; i < offsets.length; i++) {
      const off = offsets[i];
      const positions = [
        [off, 5.5, -innerBound + 0.3],
        [off, 5.5, innerBound - 0.3],
        [-innerBound + 0.3, 5.5, off],
        [innerBound - 0.3, 5.5, off],
      ];
      for (let s = 0; s < positions.length; s++) {
        const p = positions[s];
        const rib = new THREE.Mesh(ribGeo, mats.obsidianMat);
        rib.position.set(p[0], p[1], p[2]);
        if (s >= 2) rib.rotation.y = Math.PI * 0.5;
        this.root.add(rib);

        const strip = new THREE.Mesh(stripGeo, i % 2 === 0 ? mats.violetGlowMat : mats.cyanGlowMat);
        strip.position.set(p[0], p[1], p[2]);
        if (s === 0) strip.position.z += 0.36;
        else if (s === 1) strip.position.z -= 0.36;
        else if (s === 2) strip.position.x += 0.36;
        else strip.position.x -= 0.36;
        this.root.add(strip);
      }
    }

    // Sector 108 Signboard North/South
    const signs = [
      { title: 'ABYSSAL CONDUIT', subtitle: 'LOW-G RING // SECTOR-108', accent: '#c084fc', pos: [0, 8.2, -(innerBound - 0.36)], rotY: 0 },
      { title: 'SINGULARITY BAY', subtitle: 'ORBITAL CORE ACCESS', accent: '#38bdf8', pos: [0, 8.2, innerBound - 0.36], rotY: Math.PI },
    ];
    const boardGeo = this._trackGeo(new THREE.PlaneGeometry(5.6, 3.0));
    const bezelGeo = this._trackGeo(new THREE.BoxGeometry(6.0, 3.4, 0.22));
    for (let i = 0; i < signs.length; i++) {
      const s = signs[i];
      const tex = this._texGen.getSignboardTexture(s.title, s.subtitle, s.accent);
      const bMat = this._trackMat(
        new THREE.MeshStandardMaterial({
          map: tex,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: tex,
          emissiveIntensity: 0.72,
          roughness: 0.45,
          metalness: 0.25,
        })
      );
      const grp = new THREE.Group();
      grp.position.set(s.pos[0], s.pos[1], s.pos[2]);
      grp.rotation.y = s.rotY;
      const bezel = new THREE.Mesh(bezelGeo, mats.obsidianMat);
      bezel.position.z = -0.14;
      const board = new THREE.Mesh(boardGeo, bMat);
      board.position.z = 0.02;
      grp.add(bezel, board);
      this.root.add(grp);
    }
  }

  _buildConduitDecksAndRamps(mats, innerBound) {
    const deckY = 3.8;
    const deckThick = 0.4;
    const decks = [
      { minX: -innerBound, maxX: innerBound, minZ: -innerBound, maxZ: -25.2, side: 'south' },
      { minX: -innerBound, maxX: innerBound, minZ: 25.2, maxZ: innerBound, side: 'north' },
      { minX: -innerBound, maxX: -25.2, minZ: -25.2, maxZ: 25.2, side: 'east' },
      { minX: 25.2, maxX: innerBound, minZ: -25.2, maxZ: 25.2, side: 'west' },
    ];

    for (let i = 0; i < decks.length; i++) {
      const p = decks[i];
      const w = p.maxX - p.minX;
      const d = p.maxZ - p.minZ;
      const cx = (p.minX + p.maxX) * 0.5;
      const cz = (p.minZ + p.maxZ) * 0.5;

      const hull = new THREE.Mesh(
        this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(w - 0.05, deckThick, d - 0.05), w, deckThick, d, 2.5, 2.5)),
        mats.deckMat
      );
      hull.position.set(cx, deckY - deckThick * 0.5, cz);
      hull.castShadow = true;
      hull.receiveShadow = true;
      this.root.add(hull);

      const trimIsZ = p.side === 'south' || p.side === 'north';
      const trim = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(trimIsZ ? w : 0.14, 0.10, trimIsZ ? 0.14 : d)),
        mats.cyanGlowMat
      );
      trim.position.set(
        p.side === 'east' ? p.maxX : p.side === 'west' ? p.minX : cx,
        deckY - 0.06,
        p.side === 'south' ? p.maxZ : p.side === 'north' ? p.minZ : cz
      );
      this.root.add(trim);

      this.collisionWorld.addBox(p.minX, deckY - deckThick, p.minZ, p.maxX, deckY, p.maxZ, 'platform');
    }

    // 4 Wide Stepped Ramps leading onto East/West Conduit Decks (0.30m/step for smooth climb)
    const steps = 13;
    const rampConfigs = [
      { cx: -21.2, zStart: -25.2, zEnd: -16.8, climbFrom: 'south' },
      { cx: 21.2, zStart: -25.2, zEnd: -16.8, climbFrom: 'south' },
      { cx: -21.2, zStart: 16.8, zEnd: 25.2, climbFrom: 'north' },
      { cx: 21.2, zStart: 16.8, zEnd: 25.2, climbFrom: 'north' },
    ];
    for (let r = 0; r < rampConfigs.length; r++) {
      const rc = rampConfigs[r];
      const rw = 4.2;
      const totalLen = Math.abs(rc.zEnd - rc.zStart);
      const stepLen = totalLen / steps;
      for (let s = 0; s < steps; s++) {
        const frac = (s + 1) / steps;
        const h = deckY * frac;
        const z0 =
          rc.climbFrom === 'south'
            ? rc.zEnd - (s + 1) * stepLen
            : rc.zStart + s * stepLen;
        const z1 = z0 + stepLen;
        const boxGeo = this._trackGeo(new THREE.BoxGeometry(rw, h, stepLen + 0.04));
        const mesh = new THREE.Mesh(boxGeo, mats.deckMat);
        mesh.position.set(rc.cx, h * 0.5, (z0 + z1) * 0.5);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.root.add(mesh);
        this.collisionWorld.addBox(rc.cx - rw * 0.5, 0, z0, rc.cx + rw * 0.5, h, z1, 'ramp');
      }
    }
  }

  _buildTacticalCover(mats) {
    const covers = [
      { x: -10.5, z: -12.0, w: 3.4, h: 1.75, d: 1.4 },
      { x: 10.5, z: -12.0, w: 3.4, h: 1.75, d: 1.4 },
      { x: -10.5, z: 12.0, w: 3.4, h: 1.75, d: 1.4 },
      { x: 10.5, z: 12.0, w: 3.4, h: 1.75, d: 1.4 },
      { x: -15.5, z: -13.5, w: 1.8, h: 2.2, d: 1.8 },
      { x: 15.5, z: -13.5, w: 1.8, h: 2.2, d: 1.8 },
      { x: 0.0, z: 14.2, w: 4.8, h: 1.55, d: 1.3 },
      { x: 0.0, z: -16.8, w: 4.8, h: 1.65, d: 1.3 },
    ];
    for (let i = 0; i < covers.length; i++) {
      const c = covers[i];
      const geo = this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(c.w, c.h, c.d), c.w, c.h, c.d, 1.6, 1.6));
      const mesh = new THREE.Mesh(geo, mats.obsidianMat);
      mesh.position.set(c.x, c.h * 0.5, c.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);

      const trim = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(c.w + 0.04, 0.08, c.d + 0.04)),
        i % 2 === 0 ? mats.violetGlowMat : mats.cyanGlowMat
      );
      trim.position.set(c.x, c.h - 0.14, c.z);
      this.root.add(trim);

      this.collisionWorld.addBox(c.x - c.w * 0.5, 0, c.z - c.d * 0.5, c.x + c.w * 0.5, c.h, c.z + c.d * 0.5, 'cover');
    }
  }

  _buildSkyConduitBackdrop(mats, innerBound) {
    // Tall obsidian orbital monoliths surrounding the ring beyond the perimeter
    const monoGeo = this._trackGeo(new THREE.BoxGeometry(3.2, 34, 3.2));
    const coreGeo = this._trackGeo(new THREE.BoxGeometry(0.42, 28, 0.42));
    const coords = [
      [-42, -40], [42, -40], [-48, 0], [48, 0], [-42, 40], [42, 40], [-22, -48], [22, -48],
    ];
    for (let i = 0; i < coords.length; i++) {
      const [mx, mz] = coords[i];
      const mono = new THREE.Mesh(monoGeo, mats.obsidianMat);
      mono.position.set(mx, 15, mz);
      this.root.add(mono);

      const core = new THREE.Mesh(coreGeo, i % 2 === 0 ? mats.violetGlowMat : mats.cyanGlowMat);
      core.position.set(mx * 0.95, 14, mz * 0.95);
      this.root.add(core);
    }

    // Distant orbital vortex ring beyond North wall
    const gateArc = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(28, 0.85, 10, 48, Math.PI)),
      mats.violetGlowMat
    );
    gateArc.position.set(0, 6, -(innerBound + 26));
    this.root.add(gateArc);
  }

  _buildLighting() {
    this.scene.background = new THREE.Color(0x05040f);
    this.scene.fog = new THREE.FogExp2(0x0b0720, 0.0078);

    this._hemiLight = new THREE.HemisphereLight(0xd8b4fe, 0x0b0a1c, 1.05);
    this._hemiLight.position.set(0, 32, 0);
    this.root.add(this._hemiLight);
    this._lights.push(this._hemiLight);

    this._dirLight = new THREE.DirectionalLight(0xe0e7ff, 2.25);
    this._dirLight.position.set(-22, 38, -22);
    this._dirLight.shadow.camera.left = -36;
    this._dirLight.shadow.camera.right = 36;
    this._dirLight.shadow.camera.top = 36;
    this._dirLight.shadow.camera.bottom = -36;
    this._dirLight.shadow.camera.near = 8;
    this._dirLight.shadow.camera.far = 110;
    this._dirLight.shadow.bias = -0.0005;
    this._dirLight.shadow.normalBias = 0.03;
    this.root.add(this._dirLight);
    this._lights.push(this._dirLight);

    // Strictly <= 2 PointLights
    const coreLight = new THREE.PointLight(0xc084fc, 28, 36, 1.35);
    coreLight.position.set(0, 3.2, 0);
    coreLight.castShadow = false;
    this.root.add(coreLight);
    this._accentLights.push(coreLight);
    this._lights.push(coreLight);
    this._coreLight = coreLight;

    const riftLight = new THREE.PointLight(0x38bdf8, 26, 40, 1.35);
    riftLight.position.set(0, 8.5, -18);
    riftLight.castShadow = false;
    this.root.add(riftLight);
    this._accentLights.push(riftLight);
    this._lights.push(riftLight);
    this._riftLight = riftLight;
  }

  update(dt, elapsedTime) {
    if (!this._built) return;
    const t = Number.isFinite(elapsedTime) ? elapsedTime : 0;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;

    if (this._singularityRings.length >= 2) {
      this._singularityRings[0].rotation.z += safeDt * 0.42;
      this._singularityRings[1].rotation.x += safeDt * 0.56;
      this._singularityRings[1].rotation.y += safeDt * 0.34;
    }

    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    if (this._violetGlowMat) {
      this._violetGlowMat.emissiveIntensity = 1.45 + pulse * 0.6;
    }
    if (this._cyanGlowMat) {
      this._cyanGlowMat.emissiveIntensity = 1.3 + pulse * 0.5;
    }
    if (this._coreLight && this._coreLight.visible) {
      this._coreLight.intensity = 22 + pulse * 8;
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
    this._singularityRings.length = 0;
    this._dirLight = null;
    this._hemiLight = null;
    this._coreLight = null;
    this._riftLight = null;
    this._violetGlowMat = null;
    this._cyanGlowMat = null;

    if (this._ownsTexGen && this._texGen) {
      this._texGen.dispose();
    }
    this._built = false;
  }
}
  __exports.Map7AbyssRingBuilder = Map7AbyssRingBuilder;
});
