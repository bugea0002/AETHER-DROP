// Module: src/world/Map8AbyssSanctumBuilder.js
__define("src/world/Map8AbyssSanctumBuilder.js", (__exports, __require) => {
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
 * Map 8 Builder — "SECTOR-120 // TRANSCENDENT ABYSS SANCTUM"
 * Act 3 Final Boss Crucible (Waves 14–15).
 * Features obsidian sanctum floor, flanking y=4.6m catwalk decks + ramps + 4 jump pads,
 * 8 obsidian perimeter monoliths, North abyssal singularity vortex backdrop,
 * localized Low-Gravity Zones + central boss-phase 3 low-G support, and <= 2 PointLights.
 */
class Map8AbyssSanctumBuilder {
  constructor(scene, collisionWorld, qualityConfig = {}, sharedTexGen = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.qualityConfig = qualityConfig || {};

    this._ownsTexGen = !sharedTexGen;
    this._texGen = sharedTexGen || new TextureGenerator(4);

    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_SECTOR120_TranscendentSanctum';

    this._geometries = [];
    this._materials = [];
    this._lights = [];
    this._accentLights = [];
    this._dirLight = null;
    this._hemiLight = null;
    this._sanctumLight = null;
    this._vortexLight = null;

    this._crimsonGlowMat = null;
    this._violetGlowMat = null;
    this._vortexRings = [];
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
    this.root.name = 'ArenaRoot_SECTOR120_TranscendentSanctum';
    this.scene.add(this.root);

    const half = ARENA_CONFIG.halfSize; // 32
    const innerBound = half - 0.5; // 31.5
    const wallH = ARENA_CONFIG.wallHeight; // 11

    this.collisionWorld.setArenaBounds(-innerBound, innerBound, -innerBound, innerBound, 0, 32);

    const mats = this._createMaterials();
    this._buildSanctumFloor(mats, innerBound);
    this._buildWallsAndSignboards(mats, innerBound, wallH);
    this._buildSanctumDecksAndRamps(mats, innerBound);
    this._buildSanctumCoversAndMonoliths(mats);
    this._buildSingularityVortex(mats, innerBound);
    this._buildLighting();
    this.setQuality(this.qualityConfig);

    return {
      mapId: 'transcendent_sanctum',
      mapIndex: 8,
      mapCode: 'SEC-120',
      mapName: 'SECTOR-120 // TRANSCENDENT ABYSS SANCTUM',
      mapSubtitle: 'ORBITAL SINGULARITY CORE — FINAL BOSS',
      atmosphere: {
        bgColor: 0x06030e,
        fogColor: 0x100724,
        fogDensity: 0.0074,
      },
      playerSpawn: {
        pos: new THREE.Vector3(0, 0.05, 22.8),
        yaw: 0,
      },
      enemySpawns: [
        { pos: new THREE.Vector3(0.0, 0.05, -18.5), isElevated: false },
        { pos: new THREE.Vector3(-9.0, 0.05, -19.5), isElevated: false },
        { pos: new THREE.Vector3(9.0, 0.05, -19.5), isElevated: false },
        { pos: new THREE.Vector3(0.0, 0.05, -8.5), isElevated: false },
        { pos: new THREE.Vector3(-19.0, 0.05, -7.5), isElevated: false },
        { pos: new THREE.Vector3(19.0, 0.05, -7.5), isElevated: false },
        { pos: new THREE.Vector3(-19.0, 0.05, 7.5), isElevated: false },
        { pos: new THREE.Vector3(19.0, 0.05, 7.5), isElevated: false },
        { pos: new THREE.Vector3(-27.8, 4.65, -10.5), isElevated: true },
        { pos: new THREE.Vector3(27.8, 4.65, -10.5), isElevated: true },
        { pos: new THREE.Vector3(-27.8, 4.65, 10.5), isElevated: true },
        { pos: new THREE.Vector3(27.8, 4.65, 10.5), isElevated: true },
      ],
      pickupSpawns: [
        { pos: new THREE.Vector3(-27.8, 4.65, 0.0), type: 'shield' },
        { pos: new THREE.Vector3(27.8, 4.65, 0.0), type: 'health' },
        { pos: new THREE.Vector3(0.0, 4.65, -27.8), type: 'ammo' },
        { pos: new THREE.Vector3(-18.0, 0.0, 12.5), type: 'ammo' },
        { pos: new THREE.Vector3(18.0, 0.0, 12.5), type: 'shield' },
        { pos: new THREE.Vector3(0.0, 0.0, 16.5), type: 'health' },
      ],
      barrelSpawns: [
        new THREE.Vector3(-8.2, 0.0, -4.5),
        new THREE.Vector3(8.2, 0.0, -4.5),
        new THREE.Vector3(-4.5, 0.0, -14.5),
        new THREE.Vector3(4.5, 0.0, -14.5),
        new THREE.Vector3(-14.5, 0.0, 10.0),
        new THREE.Vector3(14.5, 0.0, 10.0),
      ],
      jumpPadSpawns: [
        { pos: new THREE.Vector3(-14.5, 0.0, -17.5), launchVy: 18.4, launchDirX: 0, launchDirZ: -1 },
        { pos: new THREE.Vector3(14.5, 0.0, -17.5), launchVy: 18.4, launchDirX: 0, launchDirZ: -1 },
        { pos: new THREE.Vector3(-14.5, 0.0, 17.5), launchVy: 18.4, launchDirX: 0, launchDirZ: 1 },
        { pos: new THREE.Vector3(14.5, 0.0, 17.5), launchVy: 18.4, launchDirX: 0, launchDirZ: 1 },
      ],
      lowGravityZones: [
        { pos: new THREE.Vector3(-17.5, 0.0, -1.5), radius: 6.4, height: 9.0, gravityScale: 0.45 },
        { pos: new THREE.Vector3(17.5, 0.0, -1.5), radius: 6.4, height: 9.0, gravityScale: 0.45 },
      ],
      bossCentralLowGravityZone: {
        pos: new THREE.Vector3(0.0, 0.0, 0.0),
        radius: 9.0,
        height: 11.0,
        gravityScale: 0.42,
      },
      voidGateSpawns: [
        { pos: new THREE.Vector3(-22.0, 0.0, -14.0), yaw: Math.PI * 0.25 },
        { pos: new THREE.Vector3(22.0, 0.0, -14.0), yaw: -Math.PI * 0.25 },
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

    const floorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa494d4,
        map: abyssTex.map,
        roughnessMap: abyssTex.roughnessMap,
        bumpMap: abyssTex.bumpMap,
        bumpScale: 0.05,
        metalness: 0.58,
        roughness: 0.54,
      })
    );

    const wallMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1a1529,
        map: concreteTex.map,
        roughnessMap: concreteTex.roughnessMap,
        bumpMap: concreteTex.bumpMap,
        bumpScale: 0.04,
        metalness: 0.56,
        roughness: 0.68,
      })
    );

    const obsidianMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0e0c1b,
        metalness: 0.84,
        roughness: 0.28,
      })
    );

    const deckMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x261f3d,
        map: catwalkTex.map,
        roughnessMap: catwalkTex.roughnessMap,
        bumpMap: catwalkTex.bumpMap,
        bumpScale: 0.035,
        metalness: 0.7,
        roughness: 0.52,
      })
    );

    const violetGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: new THREE.Color(0x9333ea),
        emissiveIntensity: 1.85,
        roughness: 0.22,
        metalness: 0.2,
      })
    );

    const crimsonGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: new THREE.Color(0xe11d48),
        emissiveIntensity: 1.65,
        roughness: 0.24,
        metalness: 0.2,
      })
    );

    this._violetGlowMat = violetGlowMat;
    this._crimsonGlowMat = crimsonGlowMat;

    return {
      floorMat,
      wallMat,
      obsidianMat,
      deckMat,
      violetGlowMat,
      crimsonGlowMat,
    };
  }

  _buildSanctumFloor(mats, innerBound) {
    const floorSize = innerBound * 2 + 2;
    const floorMesh = new THREE.Mesh(
      this._trackGeo(new THREE.PlaneGeometry(floorSize, floorSize)),
      mats.floorMat
    );
    floorMesh.rotation.x = -Math.PI * 0.5;
    floorMesh.receiveShadow = true;
    this.root.add(floorMesh);

    this.collisionWorld.addBox(-34, -1.0, -34, 34, 0.0, 34, 'floor');

    // Central Sanctum Octagon Dais (y=0.22m)
    const dais = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(6.4, 7.0, 0.22, 8)),
      mats.obsidianMat
    );
    dais.position.y = 0.11;
    dais.receiveShadow = true;
    this.root.add(dais);

    this.collisionWorld.addBox(-4.6, 0, -4.6, 4.6, 0.22, 4.6, 'platform');
    this.collisionWorld.addBox(-6.2, 0, -2.4, 6.2, 0.22, 2.4, 'platform');
    this.collisionWorld.addBox(-2.4, 0, -6.2, 2.4, 0.22, 6.2, 'platform');

    const outerRing = new THREE.Mesh(
      this._trackGeo(new THREE.RingGeometry(4.9, 5.4, 32)),
      mats.violetGlowMat
    );
    outerRing.rotation.x = -Math.PI * 0.5;
    outerRing.position.y = 0.225;
    this.root.add(outerRing);

    const innerRing = new THREE.Mesh(
      this._trackGeo(new THREE.RingGeometry(2.8, 3.15, 24)),
      mats.crimsonGlowMat
    );
    innerRing.rotation.x = -Math.PI * 0.5;
    innerRing.position.y = 0.228;
    this.root.add(innerRing);
  }

  _buildWallsAndSignboards(mats, innerBound, wallH) {
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

    const signs = [
      { title: 'ABYSS SANCTUM', subtitle: 'OMEGA CORE // SECTOR-120', accent: '#f43f5e', pos: [0, 8.4, -(innerBound - 0.36)], rotY: 0 },
      { title: 'SANCTUM ENTRY', subtitle: 'FINAL CONVERGENCE', accent: '#c084fc', pos: [0, 8.4, innerBound - 0.36], rotY: Math.PI },
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
          emissiveIntensity: 0.75,
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

  _buildSanctumDecksAndRamps(mats, innerBound) {
    const deckY = 4.6;
    const deckThick = 0.42;
    const decks = [
      { minX: -innerBound, maxX: innerBound, minZ: -innerBound, maxZ: -25.4, side: 'south' },
      { minX: -innerBound, maxX: innerBound, minZ: 25.4, maxZ: innerBound, side: 'north' },
      { minX: -innerBound, maxX: -25.4, minZ: -25.4, maxZ: 25.4, side: 'east' },
      { minX: 25.4, maxX: innerBound, minZ: -25.4, maxZ: 25.4, side: 'west' },
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
        mats.violetGlowMat
      );
      trim.position.set(
        p.side === 'east' ? p.maxX : p.side === 'west' ? p.minX : cx,
        deckY - 0.06,
        p.side === 'south' ? p.maxZ : p.side === 'north' ? p.minZ : cz
      );
      this.root.add(trim);

      this.collisionWorld.addBox(p.minX, deckY - deckThick, p.minZ, p.maxX, deckY, p.maxZ, 'platform');
    }

    // 4 Wide Stepped Ramps (0.31m/step)
    const steps = 15;
    const rampConfigs = [
      { cx: -21.4, zStart: -25.4, zEnd: -16.2, climbFrom: 'south' },
      { cx: 21.4, zStart: -25.4, zEnd: -16.2, climbFrom: 'south' },
      { cx: -21.4, zStart: 16.2, zEnd: 25.4, climbFrom: 'north' },
      { cx: 21.4, zStart: 16.2, zEnd: 25.4, climbFrom: 'north' },
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
        const mesh = new THREE.Mesh(
          this._trackGeo(new THREE.BoxGeometry(rw, h, stepLen + 0.04)),
          mats.deckMat
        );
        mesh.position.set(rc.cx, h * 0.5, (z0 + z1) * 0.5);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.root.add(mesh);
        this.collisionWorld.addBox(rc.cx - rw * 0.5, 0, z0, rc.cx + rw * 0.5, h, z1, 'ramp');
      }
    }
  }

  _buildSanctumCoversAndMonoliths(mats) {
    // Low-profile tactical cover blocks allowing clean sightlines to hovering turrets
    const covers = [
      { x: -11.5, z: -11.5, w: 3.6, h: 1.7, d: 1.4 },
      { x: 11.5, z: -11.5, w: 3.6, h: 1.7, d: 1.4 },
      { x: -11.5, z: 11.5, w: 3.6, h: 1.7, d: 1.4 },
      { x: 11.5, z: 11.5, w: 3.6, h: 1.7, d: 1.4 },
      { x: 0.0, z: 14.5, w: 5.2, h: 1.6, d: 1.3 },
      { x: 0.0, z: -16.5, w: 5.2, h: 1.6, d: 1.3 },
    ];
    for (let i = 0; i < covers.length; i++) {
      const c = covers[i];
      const mesh = new THREE.Mesh(
        this._trackGeo(scaleBoxUVs(new THREE.BoxGeometry(c.w, c.h, c.d), c.w, c.h, c.d, 1.6, 1.6)),
        mats.obsidianMat
      );
      mesh.position.set(c.x, c.h * 0.5, c.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);

      const strip = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(c.w + 0.05, 0.08, c.d + 0.05)),
        i % 2 === 0 ? mats.violetGlowMat : mats.crimsonGlowMat
      );
      strip.position.set(c.x, c.h - 0.14, c.z);
      this.root.add(strip);

      this.collisionWorld.addBox(c.x - c.w * 0.5, 0, c.z - c.d * 0.5, c.x + c.w * 0.5, c.h, c.z + c.d * 0.5, 'cover');
    }

    // 8 Towering Obsidian Monoliths outside perimeter
    const monoGeo = this._trackGeo(new THREE.BoxGeometry(3.4, 38, 3.4));
    const coreGeo = this._trackGeo(new THREE.BoxGeometry(0.45, 32, 0.45));
    const radius = 45;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const mx = Math.cos(ang) * radius;
      const mz = Math.sin(ang) * radius;
      const mono = new THREE.Mesh(monoGeo, mats.obsidianMat);
      mono.position.set(mx, 17, mz);
      mono.lookAt(0, 17, 0);
      this.root.add(mono);

      const core = new THREE.Mesh(coreGeo, i % 2 === 0 ? mats.crimsonGlowMat : mats.violetGlowMat);
      core.position.set(mx * 0.94, 17, mz * 0.94);
      this.root.add(core);
    }
  }

  _buildSingularityVortex(mats, innerBound) {
    // North Orbital Abyss Singularity Vortex Rings (pure visual backdrop)
    const r1 = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(24, 0.95, 12, 48)),
      mats.violetGlowMat
    );
    r1.position.set(0, 22, -(innerBound + 28));
    this.root.add(r1);

    const r2 = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(17, 0.65, 10, 44)),
      mats.crimsonGlowMat
    );
    r2.position.set(0, 22, -(innerBound + 27));
    r2.rotation.y = 0.4;
    this.root.add(r2);

    const r3 = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(10.5, 0.45, 8, 36)),
      mats.violetGlowMat
    );
    r3.position.set(0, 22, -(innerBound + 26));
    r3.rotation.x = 0.5;
    this.root.add(r3);

    this._vortexRings.push(r1, r2, r3);
  }

  _buildLighting() {
    this.scene.background = new THREE.Color(0x06030e);
    this.scene.fog = new THREE.FogExp2(0x100724, 0.0074);

    this._hemiLight = new THREE.HemisphereLight(0xe9d5ff, 0x10081c, 1.05);
    this._hemiLight.position.set(0, 32, 0);
    this.root.add(this._hemiLight);
    this._lights.push(this._hemiLight);

    this._dirLight = new THREE.DirectionalLight(0xfde68a, 2.35);
    this._dirLight.position.set(-24, 40, -22);
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
    const sanctumLight = new THREE.PointLight(0xc084fc, 30, 38, 1.35);
    sanctumLight.position.set(0, 3.6, 0);
    sanctumLight.castShadow = false;
    this.root.add(sanctumLight);
    this._accentLights.push(sanctumLight);
    this._lights.push(sanctumLight);
    this._sanctumLight = sanctumLight;

    const vortexLight = new THREE.PointLight(0xf43f5e, 28, 42, 1.35);
    vortexLight.position.set(0, 10.5, -20);
    vortexLight.castShadow = false;
    this.root.add(vortexLight);
    this._accentLights.push(vortexLight);
    this._lights.push(vortexLight);
    this._vortexLight = vortexLight;
  }

  update(dt, elapsedTime) {
    if (!this._built) return;
    const t = Number.isFinite(elapsedTime) ? elapsedTime : 0;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;

    if (this._vortexRings.length >= 3) {
      this._vortexRings[0].rotation.z += safeDt * 0.25;
      this._vortexRings[1].rotation.x += safeDt * 0.45;
      this._vortexRings[1].rotation.y += safeDt * 0.32;
      this._vortexRings[2].rotation.y -= safeDt * 0.68;
    }

    const pulse = 0.5 + 0.5 * Math.sin(t * 2.8);
    if (this._violetGlowMat) {
      this._violetGlowMat.emissiveIntensity = 1.5 + pulse * 0.65;
    }
    if (this._crimsonGlowMat) {
      this._crimsonGlowMat.emissiveIntensity = 1.35 + pulse * 0.6;
    }
    if (this._sanctumLight && this._sanctumLight.visible) {
      this._sanctumLight.intensity = 24 + pulse * 8;
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
    this._vortexRings.length = 0;
    this._dirLight = null;
    this._hemiLight = null;
    this._sanctumLight = null;
    this._vortexLight = null;
    this._violetGlowMat = null;
    this._crimsonGlowMat = null;

    if (this._ownsTexGen && this._texGen) {
      this._texGen.dispose();
    }
    this._built = false;
  }
}
  __exports.Map8AbyssSanctumBuilder = Map8AbyssSanctumBuilder;
});
