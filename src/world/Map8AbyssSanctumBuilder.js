// Module: src/world/Map8AbyssSanctumBuilder.js
__define("src/world/Map8AbyssSanctumBuilder.js", (__exports, __require) => {
const { ARENA_CONFIG } = __require("src/config/constants.js");
const { TextureGenerator } = __require("src/world/TextureGenerator.js");
const { MapPropFactory } = __require("src/world/MapPropFactory.js");

/**
 * Sector-120: Transcendent Sanctum Core (Waves 14-15 Final Boss)
 * Non-square 76x64m 3-tier stepped octagonal floating sanctuary over open
 * deep-space void cliffs (voidFallY = -14), flanking void bastion wings,
 * bidirectional dimensional portals, singularity vortex crystals,
 * floating_island_spire + abyss_monolith_cover Blender GLB props, and
 * clean central Boss Arena stage for TRANSCENDENT-OMEGA & orbiting turrets.
 */
class Map8AbyssSanctumBuilder {
  constructor(scene, collisionWorld, qualityConfig = {}, texGen = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.qualityConfig = qualityConfig;

    this._ownsTexGen = !texGen;
    this._texGen = texGen || new TextureGenerator(4);

    this.root = null;
    this._geometries = [];
    this._materials = [];
    this._lights = [];
    this._accentLights = [];
    this._vortexRings = [];
    this._propMounts = [];

    this._hemiLight = null;
    this._dirLight = null;
    this._sanctumLight = null;
    this._vortexLight = null;
    this._violetGlowMat = null;
    this._crimsonGlowMat = null;

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

  _addBoxMeshAndCollider(w, h, d, x, yBottom, z, mat, tag = 'wall', castShadow = true, receiveShadow = true) {
    const mesh = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, yBottom + h * 0.5, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    this.root.add(mesh);

    if (this.collisionWorld && tag) {
      this.collisionWorld.addBox(
        x - w * 0.5,
        yBottom,
        z - d * 0.5,
        x + w * 0.5,
        yBottom + h,
        z + d * 0.5,
        tag
      );
    }
    return mesh;
  }

  _buildSteppedRamp(mats, x1, z1, x2, z2, width, yStart, yEnd, steps = 6) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const totalLen = alongX ? Math.abs(dx) : Math.abs(dz);
    const stepLen = totalLen / steps;

    const deckGeo = this._trackGeo(
      new THREE.BoxGeometry(alongX ? totalLen + 0.1 : width, 0.36, alongX ? width : totalLen + 0.1)
    );
    const deck = new THREE.Mesh(deckGeo, mats.deckMat);
    const midY = (yStart + yEnd) * 0.5 - 0.16;
    deck.position.set((x1 + x2) * 0.5, midY, (z1 + z2) * 0.5);
    const pitch = Math.atan2(yEnd - yStart, totalLen);
    if (alongX) {
      deck.rotation.z = dx >= 0 ? pitch : -pitch;
    } else {
      deck.rotation.x = dz >= 0 ? -pitch : pitch;
    }
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.root.add(deck);

    const stripGeo = this._trackGeo(
      new THREE.BoxGeometry(alongX ? totalLen : 0.14, 0.08, alongX ? 0.14 : totalLen)
    );
    for (let side = -1; side <= 1; side += 2) {
      const strip = new THREE.Mesh(stripGeo, mats.crimsonGlowMat);
      strip.position.set(
        (x1 + x2) * 0.5 + (alongX ? 0 : side * (width * 0.5 - 0.12)),
        midY + 0.19,
        (z1 + z2) * 0.5 + (alongX ? side * (width * 0.5 - 0.12) : 0)
      );
      strip.rotation.x = deck.rotation.x;
      strip.rotation.z = deck.rotation.z;
      this.root.add(strip);
    }

    for (let i = 0; i < steps; i++) {
      const frac = (i + 1) / steps;
      const topY = yStart + (yEnd - yStart) * frac;
      const centerRatio = (i + 0.5) / steps;
      const cx = x1 + dx * centerRatio;
      const cz = z1 + dz * centerRatio;
      const halfW = alongX ? stepLen * 0.52 : width * 0.5;
      const halfD = alongX ? width * 0.5 : stepLen * 0.52;
      this.collisionWorld.addBox(cx - halfW, -1.2, cz - halfD, cx + halfW, topY, cz + halfD, 'ramp');
    }
  }

  build() {
    if (this._built) {
      this.dispose();
    }
    this._built = true;

    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_SECTOR120_TranscendentSanctum';
    this.scene.add(this.root);

    const halfX = 38.0; // 76m wide
    const halfZ = 32.0; // 64m deep (non-square stepped sanctum silhouette)

    // Allow open stratosphere-void falls beyond platform decks past voidFallY = -14
    this.collisionWorld.setArenaBounds(-halfX - 2, halfX + 2, -halfZ - 2, halfZ + 2, -26, 36);

    const mats = this._createMaterials();
    this._buildSteppedSanctumDecksAndBridges(mats);
    this._buildSanctumPropsAndCovers(mats);
    this._buildSingularityVortex(mats, halfZ);
    this._buildLighting();
    this.setQuality(this.qualityConfig);

    return {
      mapId: 'abyss_sanctum',
      mapIndex: 8,
      mapCode: '제120구역',
      mapName: '제120구역 · 초월 심연 성소',
      mapSubtitle: '3단 팔각 부유 성소 & 외곽 개방 공허 낭떠러지',
      atmosphere: {
        bgColor: 0x04030c,
        fogColor: 0x0b051c,
        fogDensity: 0.0068,
      },
      playerSpawn: {
        pos: new THREE.Vector3(0, 1.85, 22.0),
        yaw: 0,
      },
      enemySpawns: [
        { pos: new THREE.Vector3(0.0, 0.05, -6.5), isElevated: false },
        { pos: new THREE.Vector3(-10.5, 0.05, -10.5), isElevated: false },
        { pos: new THREE.Vector3(10.5, 0.05, -10.5), isElevated: false },
        { pos: new THREE.Vector3(-8.5, 1.85, -24.5), isElevated: true },
        { pos: new THREE.Vector3(8.5, 1.85, -24.5), isElevated: true },
        { pos: new THREE.Vector3(-28.5, 3.85, 5.5), isElevated: true },
        { pos: new THREE.Vector3(28.5, 3.85, -5.5), isElevated: true },
        { pos: new THREE.Vector3(0.0, 0.05, 8.5), isElevated: false },
      ],
      controlZoneCenter: new THREE.Vector3(0.0, 1.85, -24.0),
      voidFallY: -14.0,
      portals: [
        {
          id: 'sanctum_west_wing',
          pairId: 'west_north_flank',
          x: -31.0,
          y: 3.8,
          z: -6.5,
          targetX: 11.5,
          targetY: 1.8,
          targetZ: -23.5,
          yaw: 0.0,
          exitYaw: Math.PI,
          radius: 2.2,
        },
        {
          id: 'sanctum_north_east',
          pairId: 'west_north_flank',
          x: 11.5,
          y: 1.8,
          z: -27.0,
          targetX: -31.0,
          targetY: 3.8,
          targetZ: 0.0,
          yaw: Math.PI,
          exitYaw: 0.0,
          radius: 2.2,
        },
        {
          id: 'sanctum_east_wing',
          pairId: 'east_south_flank',
          x: 31.0,
          y: 3.8,
          z: 6.5,
          targetX: -11.5,
          targetY: 1.8,
          targetZ: 23.5,
          yaw: Math.PI,
          exitYaw: 0.0,
          radius: 2.2,
        },
        {
          id: 'sanctum_south_west',
          pairId: 'east_south_flank',
          x: -11.5,
          y: 1.8,
          z: 27.0,
          targetX: 31.0,
          targetY: 3.8,
          targetZ: 0.0,
          yaw: 0.0,
          exitYaw: Math.PI,
          radius: 2.2,
        },
      ],
      singularityNodes: [
        {
          x: -20.5,
          y: 1.4,
          z: -13.5,
          yaw: 0.78,
          pullRadius: 15.5,
          duration: 3.0,
          force: 16.5,
          cooldown: 10.0,
        },
        {
          x: 20.5,
          y: 1.4,
          z: 13.5,
          yaw: -2.35,
          pullRadius: 15.5,
          duration: 3.0,
          force: 16.5,
          cooldown: 10.0,
        },
      ],
      barrelSpawns: [
        { pos: new THREE.Vector3(-14.5, 0.0, -10.5), type: 'plasma' },
        { pos: new THREE.Vector3(14.5, 0.0, -10.5), type: 'plasma' },
        { pos: new THREE.Vector3(-14.5, 0.0, 10.5), type: 'shock' },
        { pos: new THREE.Vector3(14.5, 0.0, 10.5), type: 'shock' },
        { pos: new THREE.Vector3(-25.0, 3.8, 0.0), type: 'plasma' },
        { pos: new THREE.Vector3(25.0, 3.8, 0.0), type: 'plasma' },
      ],
      jumpPadSpawns: [
        { pos: new THREE.Vector3(-16.0, 0.0, 0.0), boostY: 15.5, boostHorizontal: 13.5 },
        { pos: new THREE.Vector3(16.0, 0.0, 0.0), boostY: 15.5, boostHorizontal: 13.5 },
        { pos: new THREE.Vector3(0.0, 0.0, -14.0), boostY: 15.0, boostHorizontal: 11.0 },
        { pos: new THREE.Vector3(0.0, 0.0, 14.0), boostY: 15.0, boostHorizontal: 11.0 },
        { pos: new THREE.Vector3(-26.0, 3.8, -9.5), boostY: 15.0, boostHorizontal: 13.5 },
        { pos: new THREE.Vector3(26.0, 3.8, 9.5), boostY: 15.0, boostHorizontal: 13.5 },
      ],
      pickupSpawns: [
        { pos: new THREE.Vector3(-12.5, 0.05, 8.5), type: 'health', amount: 42, respawnTime: 18 },
        { pos: new THREE.Vector3(-29.0, 3.85, 0.0), type: 'shield', amount: 42, respawnTime: 18 },
        { pos: new THREE.Vector3(29.0, 3.85, 0.0), type: 'damage', amount: 1, respawnTime: 22 },
        { pos: new THREE.Vector3(6.5, 1.85, -22.5), type: 'health', amount: 42, respawnTime: 18 },
      ],
      gimmickPylons: [
        { pos: new THREE.Vector3(-14.5, 0.0, 0.0), type: 'emp' },
        { pos: new THREE.Vector3(14.5, 0.0, 0.0), type: 'emp' },
        { pos: new THREE.Vector3(0.0, 1.8, -19.5), type: 'emp' },
      ],
      lowGravityZones: [
        { pos: new THREE.Vector3(-20.0, 1.5, 0.0), radius: 5.0, height: 7.5 },
        { pos: new THREE.Vector3(20.0, 1.5, 0.0), radius: 5.0, height: 7.5 },
      ],
      bossCentralLowGravityZone: {
        pos: new THREE.Vector3(0.0, 0.0, 0.0),
        radius: 13.5,
        height: 15.0,
      },
      voidGateSpawns: [
        new THREE.Vector3(-9.5, 1.8, -25.0),
        new THREE.Vector3(9.5, 1.8, -25.0),
        new THREE.Vector3(0.0, 0.0, -13.5),
      ],
      arenaBounds: {
        minX: -halfX,
        maxX: halfX,
        minZ: -halfZ,
        maxZ: halfZ,
      },
    };
  }

  _createMaterials() {
    const floorTex = this._texGen.getAbyssFloorTextures(7, 6);
    const concreteTex = this._texGen.getWallTextures(5, 2);
    const catwalkTex = this._texGen.getCatwalkTextures(5, 2);

    const floorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1a1530,
        map: floorTex.map,
        roughnessMap: floorTex.roughnessMap,
        bumpMap: floorTex.bumpMap,
        bumpScale: 0.045,
        metalness: 0.72,
        roughness: 0.44,
      })
    );

    const bastionMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x221d38,
        map: concreteTex.map,
        roughnessMap: concreteTex.roughnessMap,
        bumpMap: concreteTex.bumpMap,
        bumpScale: 0.04,
        metalness: 0.58,
        roughness: 0.62,
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
        color: 0x272040,
        map: catwalkTex.map,
        roughnessMap: catwalkTex.roughnessMap,
        bumpMap: catwalkTex.bumpMap,
        bumpScale: 0.035,
        metalness: 0.70,
        roughness: 0.50,
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
    this._violetGlowMat = violetGlowMat;

    const crimsonGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: new THREE.Color(0xe11d48),
        emissiveIntensity: 1.65,
        roughness: 0.24,
        metalness: 0.25,
      })
    );
    this._crimsonGlowMat = crimsonGlowMat;

    return { floorMat, bastionMat, obsidianMat, deckMat, violetGlowMat, crimsonGlowMat };
  }

  _buildSteppedSanctumDecksAndBridges(mats) {
    // Tier 1: Wide Inner Boss Combat Sanctum (y = 0.0, x[-18..18], z[-16..16])
    this._addBoxMeshAndCollider(36, 2.6, 32, 0, -2.6, 0, mats.floorMat, 'floor', true, true);

    // Inner Sanctum glowing octagonal boss ring trim
    const daisMesh = new THREE.Mesh(
      this._trackGeo(new THREE.CylinderGeometry(8.2, 8.8, 0.08, 8)),
      mats.obsidianMat
    );
    daisMesh.position.set(0, 0.02, 0);
    daisMesh.receiveShadow = true;
    this.root.add(daisMesh);

    const daisTrim = new THREE.Mesh(
      this._trackGeo(new THREE.RingGeometry(8.5, 8.9, 8)),
      mats.crimsonGlowMat
    );
    daisTrim.rotation.x = -Math.PI * 0.5;
    daisTrim.position.set(0, 0.06, 0);
    this.root.add(daisTrim);

    // Tier 2: North Beacon Dais & South Entry Deck (y = 1.8m)
    this._addBoxMeshAndCollider(32, 2.6, 12, 0, -0.8, -24, mats.bastionMat, 'floor', true, true);
    this._addBoxMeshAndCollider(32, 2.6, 12, 0, -0.8, 24, mats.bastionMat, 'floor', true, true);

    // North Off-Center Control Zone Visual Halo at (0, 1.84, -24.0)
    const beaconRing = new THREE.Mesh(
      this._trackGeo(new THREE.RingGeometry(4.8, 5.25, 32)),
      mats.violetGlowMat
    );
    beaconRing.rotation.x = -Math.PI * 0.5;
    beaconRing.position.set(0, 1.84, -24.0);
    this.root.add(beaconRing);

    // Tier 3: Outer Floating West & East Bastion Wings (y = 3.8m)
    this._addBoxMeshAndCollider(12, 2.8, 24, -29, 1.0, 0, mats.bastionMat, 'floor', true, true);
    this._addBoxMeshAndCollider(12, 2.8, 24, 29, 1.0, 0, mats.bastionMat, 'floor', true, true);

    // Emissive Cliff-Edge Warning Lips around every floating tier (zero side guard walls!)
    const rimSpecs = [
      { x: 0, z: -30 + 0.12, w: 32, d: 0.24, y: 1.82, m: mats.crimsonGlowMat },
      { x: 0, z: 30 - 0.12, w: 32, d: 0.24, y: 1.82, m: mats.violetGlowMat },
      { x: -35 + 0.12, z: 0, w: 0.24, d: 24, y: 3.82, m: mats.crimsonGlowMat },
      { x: 35 - 0.12, z: 0, w: 0.24, d: 24, y: 3.82, m: mats.crimsonGlowMat },
      { x: -18 + 0.12, z: 0, w: 0.24, d: 32, y: 0.02, m: mats.violetGlowMat },
      { x: 18 - 0.12, z: 0, w: 0.24, d: 32, y: 0.02, m: mats.violetGlowMat },
    ];
    for (let i = 0; i < rimSpecs.length; i++) {
      const r = rimSpecs[i];
      const rim = new THREE.Mesh(this._trackGeo(new THREE.BoxGeometry(r.w, 0.06, r.d)), r.m);
      rim.position.set(r.x, r.y, r.z);
      this.root.add(rim);
    }

    // Wide Stepped Ramps connecting Tier 1 <-> Tier 2 (leaving open abyss trenches on outer flanks!)
    this._buildSteppedRamp(mats, -6.5, 18.0, -6.5, 14.5, 5.2, 1.8, 0.0, 6);
    this._buildSteppedRamp(mats, 6.5, 18.0, 6.5, 14.5, 5.2, 1.8, 0.0, 6);
    this._buildSteppedRamp(mats, -6.5, -18.0, -6.5, -14.5, 5.2, 1.8, 0.0, 6);
    this._buildSteppedRamp(mats, 6.5, -18.0, 6.5, -14.5, 5.2, 1.8, 0.0, 6);

    // Narrow High-Bridge Ramps connecting Tier 1 <-> West/East Tier 3 Bastions (y = 0 -> 3.8)
    this._buildSteppedRamp(mats, -17.5, 0, -23.0, 0, 4.6, 0.0, 3.8, 9);
    this._buildSteppedRamp(mats, 17.5, 0, 23.0, 0, 4.6, 0.0, 3.8, 9);
  }

  _buildSanctumPropsAndCovers(mats) {
    const factory = MapPropFactory.getShared();

    // 1. Floating Island Underside Crystal Spires
    const spires = [
      { pos: new THREE.Vector3(0, -1.8, 0), rotY: 0.4, scale: 2.8 },
      { pos: new THREE.Vector3(0, -0.4, -24), rotY: 1.2, scale: 2.2 },
      { pos: new THREE.Vector3(0, -0.4, 24), rotY: 2.5, scale: 2.2 },
      { pos: new THREE.Vector3(-29, 1.4, 0), rotY: 0.8, scale: 2.0 },
      { pos: new THREE.Vector3(29, 1.4, 0), rotY: -1.1, scale: 2.0 },
      // Pylons floating underneath the 2 Singularity Vortex Nodes in NW/SE chasms
      { pos: new THREE.Vector3(-20.5, 0.6, -13.5), rotY: 0.3, scale: 0.72 },
      { pos: new THREE.Vector3(20.5, 0.6, 13.5), rotY: 2.4, scale: 0.72 },
    ];
    for (let i = 0; i < spires.length; i++) {
      const sp = spires[i];
      const mount = factory.mountProp(this.root, 'floating_island_spire', {
        position: sp.pos,
        rotationY: sp.rotY,
        scale: sp.scale,
        cloneMaterials: false,
      });
      this._propMounts.push(mount);
    }

    // 2. Abyss Monolith Covers (flanking boss stage & bastions — keeps center [-8..8] open for Boss)
    const covers = [
      { x: -10.5, y: 0.0, z: -7.5, rotY: 0.0, w: 2.8, d: 1.5, h: 2.1 },
      { x: 10.5, y: 0.0, z: -7.5, rotY: 0.0, w: 2.8, d: 1.5, h: 2.1 },
      { x: -10.5, y: 0.0, z: 7.5, rotY: 0.0, w: 2.8, d: 1.5, h: 2.1 },
      { x: 10.5, y: 0.0, z: 7.5, rotY: 0.0, w: 2.8, d: 1.5, h: 2.1 },
      { x: -27.5, y: 3.8, z: -4.0, rotY: Math.PI * 0.5, w: 1.5, d: 2.8, h: 2.1 },
      { x: 27.5, y: 3.8, z: 4.0, rotY: Math.PI * 0.5, w: 1.5, d: 2.8, h: 2.1 },
    ];
    for (let i = 0; i < covers.length; i++) {
      const c = covers[i];
      const mount = factory.mountProp(this.root, 'abyss_monolith_cover', {
        position: new THREE.Vector3(c.x, c.y, c.z),
        rotationY: c.rotY,
        scale: 1.0,
        cloneMaterials: false,
      });
      this._propMounts.push(mount);
      if (this.collisionWorld) {
        this.collisionWorld.addBox(
          c.x - c.w * 0.5,
          c.y,
          c.z - c.d * 0.5,
          c.x + c.w * 0.5,
          c.y + c.h,
          c.z + c.d * 0.5,
          'cover'
        );
      }
    }

    // North & South flank sanctum cover curbs at Tier 2
    const tier2Covers = [
      { x: -10.5, z: -20.5, y: 1.8 },
      { x: 10.5, z: -20.5, y: 1.8 },
      { x: -10.5, z: 20.5, y: 1.8 },
      { x: 10.5, z: 20.5, y: 1.8 },
    ];
    for (let i = 0; i < tier2Covers.length; i++) {
      const t = tier2Covers[i];
      this._addBoxMeshAndCollider(2.6, 1.45, 1.1, t.x, t.y, t.z, mats.obsidianMat, 'cover', true, true);
    }

    // Outer deep-void obsidian obelisks beyond the floating sanctum for grand horizon framing
    const monoGeo = this._trackGeo(new THREE.BoxGeometry(3.2, 42, 3.2));
    const coreGeo = this._trackGeo(new THREE.BoxGeometry(0.45, 36, 0.45));
    const outerCoords = [
      [-48, -42], [48, -42], [-50, 0], [50, 0], [-48, 42], [48, 42], [-24, -48], [24, -48],
    ];
    for (let i = 0; i < outerCoords.length; i++) {
      const [ox, oz] = outerCoords[i];
      const m = new THREE.Mesh(monoGeo, mats.obsidianMat);
      m.position.set(ox, 10, oz);
      this.root.add(m);
      const beam = new THREE.Mesh(coreGeo, i % 2 === 0 ? mats.violetGlowMat : mats.crimsonGlowMat);
      beam.position.set(ox * 0.94, 10, oz * 0.94);
      this.root.add(beam);
    }
  }

  _buildSingularityVortex(mats, halfZ) {
    // High Celestial Singularity Halo (y = 14m, clear of Boss & Aerial Combat)
    const ring1 = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(13.0, 0.34, 10, 48)),
      mats.violetGlowMat
    );
    ring1.position.set(0, 14.5, 0);
    ring1.rotation.x = Math.PI * 0.38;
    this.root.add(ring1);
    this._vortexRings.push(ring1);

    const ring2 = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(8.5, 0.26, 10, 40)),
      mats.crimsonGlowMat
    );
    ring2.position.set(0, 14.5, 0);
    ring2.rotation.y = Math.PI * 0.32;
    this.root.add(ring2);
    this._vortexRings.push(ring2);

    const ring3 = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(5.0, 0.20, 8, 32)),
      mats.violetGlowMat
    );
    ring3.position.set(0, 14.5, 0);
    this.root.add(ring3);
    this._vortexRings.push(ring3);

    // Distant cosmic arch behind North Beacon Dais
    const zenithArch = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(32, 0.95, 10, 52, Math.PI)),
      mats.crimsonGlowMat
    );
    zenithArch.position.set(0, 4, -(halfZ + 20));
    this.root.add(zenithArch);
  }

  _buildLighting() {
    this.scene.background = new THREE.Color(0x04030c);
    this.scene.fog = new THREE.FogExp2(0x0b051c, 0.0068);

    this._hemiLight = new THREE.HemisphereLight(0xf3e8ff, 0x0c0718, 1.15);
    this._hemiLight.position.set(0, 36, 0);
    this.root.add(this._hemiLight);
    this._lights.push(this._hemiLight);

    this._dirLight = new THREE.DirectionalLight(0xfde68a, 2.35);
    this._dirLight.position.set(-24, 42, -22);
    this._dirLight.shadow.camera.left = -40;
    this._dirLight.shadow.camera.right = 40;
    this._dirLight.shadow.camera.top = 36;
    this._dirLight.shadow.camera.bottom = -36;
    this._dirLight.shadow.camera.near = 8;
    this._dirLight.shadow.camera.far = 115;
    this._dirLight.shadow.bias = -0.0005;
    this._dirLight.shadow.normalBias = 0.03;
    this.root.add(this._dirLight);
    this._lights.push(this._dirLight);

    // Strictly <= 2 PointLights
    const sanctumLight = new THREE.PointLight(0xc084fc, 30, 44, 1.35);
    sanctumLight.position.set(0, 5.2, 0);
    sanctumLight.castShadow = false;
    this.root.add(sanctumLight);
    this._accentLights.push(sanctumLight);
    this._lights.push(sanctumLight);
    this._sanctumLight = sanctumLight;

    const vortexLight = new THREE.PointLight(0xf43f5e, 28, 44, 1.35);
    vortexLight.position.set(0, 7.5, -24.0);
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

    const maxAccent = Number.isFinite(qualityConfig.maxPointLights)
      ? Math.min(2, qualityConfig.maxPointLights)
      : 2;
    for (let i = 0; i < this._accentLights.length; i++) {
      this._accentLights[i].visible = i < maxAccent;
    }
  }

  dispose() {
    if (!this._built) return;
    this._built = false;

    if (this.root) {
      this.scene.remove(this.root);
      this.root.clear();
      this.root = null;
    }

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

    for (let i = 0; i < this._geometries.length; i++) {
      this._geometries[i].dispose();
    }
    this._geometries.length = 0;

    for (let i = 0; i < this._materials.length; i++) {
      this._materials[i].dispose();
    }
    this._materials.length = 0;

    for (let i = 0; i < this._lights.length; i++) {
      if (this._lights[i].dispose) this._lights[i].dispose();
    }
    this._lights.length = 0;
    this._accentLights.length = 0;
    this._vortexRings.length = 0;

    this._hemiLight = null;
    this._dirLight = null;
    this._sanctumLight = null;
    this._vortexLight = null;
    this._violetGlowMat = null;
    this._crimsonGlowMat = null;

    if (this._ownsTexGen && this._texGen) {
      this._texGen.dispose();
    }
  }
}
  __exports.Map8AbyssSanctumBuilder = Map8AbyssSanctumBuilder;
});
