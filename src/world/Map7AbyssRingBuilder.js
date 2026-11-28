// Module: src/world/Map7AbyssRingBuilder.js
__define("src/world/Map7AbyssRingBuilder.js", (__exports, __require) => {
const { ARENA_CONFIG } = __require("src/config/constants.js");
const { TextureGenerator } = __require("src/world/TextureGenerator.js");
const { MapPropFactory } = __require("src/world/MapPropFactory.js");

/**
 * Sector-108: Abyssal Floating Archipelago (Waves 11-13)
 * Non-square 76x68m suspended 5-island void battlefield with slender unguarded
 * energy bridges, bidirectional dimensional portals, singularity vortex crystals,
 * floating_island_spire + abyss_monolith_cover Blender GLB props, and open void cliffs.
 */
class Map7AbyssRingBuilder {
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
    this._singularityRings = [];
    this._propMounts = [];

    this._hemiLight = null;
    this._dirLight = null;
    this._coreLight = null;
    this._riftLight = null;
    this._violetGlowMat = null;
    this._cyanGlowMat = null;

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

  /**
   * Build walkable stepped ramp/bridge between outer islands (y=0) and central dais (y=1.4).
   * @private
   */
  _buildSlenderBridgeRamp(mats, x1, z1, x2, z2, width, yStart, yEnd, steps = 6) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const totalLen = alongX ? Math.abs(dx) : Math.abs(dz);
    const stepLen = totalLen / steps;

    // Visual smooth inclined span + side energy strips
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
    deck.receiveShadow = true;
    deck.castShadow = true;
    this.root.add(deck);

    // Side abyss-warn emissive strips (zero barrier walls — open edge!)
    const stripGeo = this._trackGeo(
      new THREE.BoxGeometry(alongX ? totalLen : 0.14, 0.08, alongX ? 0.14 : totalLen)
    );
    for (let side = -1; side <= 1; side += 2) {
      const s = new THREE.Mesh(stripGeo, mats.violetGlowMat);
      s.position.set(
        (x1 + x2) * 0.5 + (alongX ? 0 : side * (width * 0.5 - 0.1)),
        midY + 0.19,
        (z1 + z2) * 0.5 + (alongX ? side * (width * 0.5 - 0.1) : 0)
      );
      s.rotation.x = deck.rotation.x;
      s.rotation.z = deck.rotation.z;
      this.root.add(s);
    }

    // Precision stepped AABBs (step rise <= 0.24m so player & ground AI traverse smoothly)
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
    this.root.name = 'ArenaRoot_SECTOR108_AbyssFloatingIslands';
    this.scene.add(this.root);

    const halfX = 38.0; // 76m wide
    const halfZ = 34.0; // 68m deep (non-square archipelago footprint)

    // Allow open free-fall past voidFallY = -14 everywhere beyond islands & bridges
    this.collisionWorld.setArenaBounds(-halfX - 2, halfX + 2, -halfZ - 2, halfZ + 2, -26, 32);

    const mats = this._createMaterials();
    this._buildFloatingIslandsAndBridges(mats);
    this._buildIslandPropsAndCovers(mats);
    this._buildSingularityVortexAndVoidBackdrop(mats, halfX, halfZ);
    this._buildLighting();
    this.setQuality(this.qualityConfig);

    return {
      mapId: 'abyss_ring',
      mapIndex: 7,
      mapCode: '제108구역',
      mapName: '제108구역 · 심연 부유 군도',
      mapSubtitle: '차원 워프 포탈 & 특이점 중력 붕괴 군도',
      atmosphere: {
        bgColor: 0x050410,
        fogColor: 0x0a0720,
        fogDensity: 0.0072,
      },
      playerSpawn: {
        pos: new THREE.Vector3(0, 0.05, 28.0),
        yaw: 0,
      },
      enemySpawns: [
        { pos: new THREE.Vector3(-9.5, 0.05, -26.5), isElevated: false },
        { pos: new THREE.Vector3(9.5, 0.05, -26.5), isElevated: false },
        { pos: new THREE.Vector3(0.0, 0.05, -30.0), isElevated: false },
        { pos: new THREE.Vector3(-26.5, 0.05, -5.5), isElevated: false },
        { pos: new THREE.Vector3(-26.5, 0.05, 5.5), isElevated: false },
        { pos: new THREE.Vector3(26.5, 0.05, -5.5), isElevated: false },
        { pos: new THREE.Vector3(26.5, 0.05, 5.5), isElevated: false },
        { pos: new THREE.Vector3(0.0, 1.45, 0.0), isElevated: true },
      ],
      controlZoneCenter: new THREE.Vector3(0.0, 0.05, -23.0),
      voidFallY: -14.0,
      portals: [
        {
          id: 'portal_south_west',
          pairId: 'south_north_diag',
          x: -11.5,
          y: 0.0,
          z: 17.5,
          targetX: 11.5,
          targetY: 0.0,
          targetZ: -21.0,
          yaw: 0.35,
          exitYaw: 0,
          radius: 2.2,
        },
        {
          id: 'portal_north_east',
          pairId: 'south_north_diag',
          x: 11.5,
          y: 0.0,
          z: -17.5,
          targetX: -11.5,
          targetY: 0.0,
          targetZ: 21.5,
          yaw: Math.PI + 0.35,
          exitYaw: Math.PI,
          radius: 2.2,
        },
        {
          id: 'portal_west_flank',
          pairId: 'east_west_cross',
          x: -32.0,
          y: 0.0,
          z: 0.0,
          targetX: 27.5,
          targetY: 0.0,
          targetZ: 0.0,
          yaw: Math.PI * 0.5,
          exitYaw: -Math.PI * 0.5,
          radius: 2.2,
        },
        {
          id: 'portal_east_flank',
          pairId: 'east_west_cross',
          x: 32.0,
          y: 0.0,
          z: 0.0,
          targetX: -27.5,
          targetY: 0.0,
          targetZ: 0.0,
          yaw: -Math.PI * 0.5,
          exitYaw: Math.PI * 0.5,
          radius: 2.2,
        },
      ],
      singularityNodes: [
        {
          x: -11.5,
          y: 0.0,
          z: -11.5,
          yaw: 0.78,
          pullRadius: 15.5,
          duration: 3.0,
          force: 16.5,
          cooldown: 10.0,
        },
        {
          x: 11.5,
          y: 0.0,
          z: 11.5,
          yaw: -2.35,
          pullRadius: 15.5,
          duration: 3.0,
          force: 16.5,
          cooldown: 10.0,
        },
      ],
      barrelSpawns: [
        { pos: new THREE.Vector3(-5.0, 0.0, -18.0), type: 'plasma' },
        { pos: new THREE.Vector3(5.0, 0.0, -18.0), type: 'plasma' },
        { pos: new THREE.Vector3(-20.0, 0.0, -5.5), type: 'shock' },
        { pos: new THREE.Vector3(20.0, 0.0, 5.5), type: 'shock' },
        { pos: new THREE.Vector3(-5.5, 1.4, -5.5), type: 'plasma' },
        { pos: new THREE.Vector3(5.5, 1.4, 5.5), type: 'plasma' },
      ],
      jumpPadSpawns: [
        { pos: new THREE.Vector3(0.0, 0.0, 14.8), boostY: 14.5, boostHorizontal: 11.0 },
        { pos: new THREE.Vector3(0.0, 0.0, -14.8), boostY: 14.5, boostHorizontal: 11.0 },
        { pos: new THREE.Vector3(-18.5, 0.0, 0.0), boostY: 14.8, boostHorizontal: 13.0 },
        { pos: new THREE.Vector3(18.5, 0.0, 0.0), boostY: 14.8, boostHorizontal: 13.0 },
        { pos: new THREE.Vector3(11.5, 0.0, 15.5), boostY: 15.0, boostHorizontal: 14.0 },
        { pos: new THREE.Vector3(-11.5, 0.0, -15.5), boostY: 15.0, boostHorizontal: 14.0 },
      ],
      pickupSpawns: [
        { pos: new THREE.Vector3(6.5, 0.05, 25.5), type: 'health', amount: 38, respawnTime: 18 },
        { pos: new THREE.Vector3(-23.0, 0.05, 0.0), type: 'shield', amount: 38, respawnTime: 18 },
        { pos: new THREE.Vector3(23.0, 0.05, 0.0), type: 'damage', amount: 1, respawnTime: 24 },
        { pos: new THREE.Vector3(-8.0, 0.05, -24.5), type: 'health', amount: 38, respawnTime: 18 },
      ],
      gimmickPylons: [
        { pos: new THREE.Vector3(-8.5, 0.0, 22.0), type: 'emp' },
        { pos: new THREE.Vector3(24.0, 0.0, -7.5), type: 'emp' },
        { pos: new THREE.Vector3(0.0, 0.0, -16.5), type: 'emp' },
      ],
      lowGravityZones: [
        { pos: new THREE.Vector3(0.0, 1.4, 0.0), radius: 8.5, height: 14.0 },
        { pos: new THREE.Vector3(-18.5, 0.0, 0.0), radius: 5.2, height: 12.0 },
        { pos: new THREE.Vector3(18.5, 0.0, 0.0), radius: 5.2, height: 12.0 },
      ],
      voidGateSpawns: [
        new THREE.Vector3(0.0, 0.0, -29.5),
        new THREE.Vector3(-29.0, 0.0, -7.5),
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
    const floorTex = this._texGen.getAbyssFloorTextures(6, 6);
    const deckTex = this._texGen.getCatwalkTextures(4, 2);

    const floorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e1d36,
        map: floorTex.map,
        roughnessMap: floorTex.roughnessMap,
        bumpMap: floorTex.bumpMap,
        bumpScale: 0.045,
        metalness: 0.68,
        roughness: 0.46,
      })
    );

    const islandSlabMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x151428,
        metalness: 0.78,
        roughness: 0.36,
      })
    );

    const obsidianMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0f0e1d,
        metalness: 0.84,
        roughness: 0.30,
      })
    );

    const deckMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x262848,
        map: deckTex.map,
        roughnessMap: deckTex.roughnessMap,
        bumpMap: deckTex.bumpMap,
        bumpScale: 0.035,
        metalness: 0.72,
        roughness: 0.48,
      })
    );

    const violetGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: new THREE.Color(0x9333ea),
        emissiveIntensity: 1.75,
        roughness: 0.24,
        metalness: 0.2,
      })
    );
    this._violetGlowMat = violetGlowMat;

    const cyanGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: new THREE.Color(0x0284c7),
        emissiveIntensity: 1.55,
        roughness: 0.24,
        metalness: 0.25,
      })
    );
    this._cyanGlowMat = cyanGlowMat;

    return { floorMat, islandSlabMat, obsidianMat, deckMat, violetGlowMat, cyanGlowMat };
  }

  _buildFloatingIslandsAndBridges(mats) {
    // 5 Separated Islands (zero outer barrier walls — open cosmic void cliffs everywhere!)
    const islands = [
      // South Entry Island (y=0, x[-15..15], z[13..33])
      { x: 0, z: 23, w: 30, d: 20, yTop: 0.0, thickness: 2.4, accent: mats.cyanGlowMat },
      // North Beacon Island (y=0, x[-16..16], z[-33..-13])
      { x: 0, z: -23, w: 32, d: 20, yTop: 0.0, thickness: 2.4, accent: mats.violetGlowMat },
      // West Sanctuary Island (y=0, x[-36..-16], z[-11..11])
      { x: -26, z: 0, w: 20, d: 22, yTop: 0.0, thickness: 2.4, accent: mats.violetGlowMat },
      // East Sanctuary Island (y=0, x[16..36], z[-11..11])
      { x: 26, z: 0, w: 20, d: 22, yTop: 0.0, thickness: 2.4, accent: mats.cyanGlowMat },
      // Center Singularity Dais Island (y=1.4, x[-8.5..8.5], z[-8.5..8.5])
      { x: 0, z: 0, w: 17, d: 17, yTop: 1.4, thickness: 3.0, accent: mats.violetGlowMat },
    ];

    for (let i = 0; i < islands.length; i++) {
      const isl = islands[i];
      const yBottom = isl.yTop - isl.thickness;
      // Top walkable cap
      this._addBoxMeshAndCollider(isl.w, isl.thickness, isl.d, isl.x, yBottom, isl.z, mats.floorMat, 'floor', true, true);

      // Stepped under-chassis trim so floating silhouette reads sharply
      const subMesh = new THREE.Mesh(
        this._trackGeo(new THREE.BoxGeometry(isl.w * 0.78, 1.4, isl.d * 0.78)),
        mats.islandSlabMat
      );
      subMesh.position.set(isl.x, yBottom - 0.7, isl.z);
      this.root.add(subMesh);

      // Perimeter cliff warning edge strip (flush at surface lip)
      const rimThick = 0.22;
      const rimY = isl.yTop + 0.02;
      const nsRimGeo = this._trackGeo(new THREE.BoxGeometry(isl.w, 0.05, rimThick));
      const ewRimGeo = this._trackGeo(new THREE.BoxGeometry(rimThick, 0.05, isl.d));
      const rimN = new THREE.Mesh(nsRimGeo, isl.accent);
      rimN.position.set(isl.x, rimY, isl.z - isl.d * 0.5 + rimThick * 0.5);
      const rimS = new THREE.Mesh(nsRimGeo, isl.accent);
      rimS.position.set(isl.x, rimY, isl.z + isl.d * 0.5 - rimThick * 0.5);
      const rimW = new THREE.Mesh(ewRimGeo, isl.accent);
      rimW.position.set(isl.x - isl.w * 0.5 + rimThick * 0.5, rimY, isl.z);
      const rimE = new THREE.Mesh(ewRimGeo, isl.accent);
      rimE.position.set(isl.x + isl.w * 0.5 - rimThick * 0.5, rimY, isl.z);
      this.root.add(rimN, rimS, rimW, rimE);
    }

    // North Island Off-Center Beacon Ring Plinth visual at (0, 0.02, -23)
    const beaconRing = new THREE.Mesh(
      this._trackGeo(new THREE.RingGeometry(4.8, 5.2, 32)),
      mats.cyanGlowMat
    );
    beaconRing.rotation.x = -Math.PI * 0.5;
    beaconRing.position.set(0, 0.04, -23.0);
    this.root.add(beaconRing);

    // 4 Narrow Unguarded Obsidian Energy Ramp-Bridges (w = 4.6m)
    this._buildSlenderBridgeRamp(mats, 0, 13.0, 0, 8.5, 4.6, 0.0, 1.4, 6);
    this._buildSlenderBridgeRamp(mats, 0, -13.0, 0, -8.5, 4.6, 0.0, 1.4, 6);
    this._buildSlenderBridgeRamp(mats, -16.0, 0, -8.5, 0, 4.6, 0.0, 1.4, 7);
    this._buildSlenderBridgeRamp(mats, 16.0, 0, 8.5, 0, 4.6, 0.0, 1.4, 7);
  }

  _buildIslandPropsAndCovers(mats) {
    const factory = MapPropFactory.getShared();

    // 1. Sculpted Floating Island Crystal Spires underneath each island + chasm singularity nodes
    const spires = [
      { pos: new THREE.Vector3(0, -1.6, 23), rotY: 0.2, scale: 2.3 },
      { pos: new THREE.Vector3(0, -1.6, -23), rotY: 1.4, scale: 2.4 },
      { pos: new THREE.Vector3(-26, -1.6, 0), rotY: 2.2, scale: 2.1 },
      { pos: new THREE.Vector3(26, -1.6, 0), rotY: -0.9, scale: 2.1 },
      { pos: new THREE.Vector3(0, -0.6, 0), rotY: 0.78, scale: 1.8 },
      // Subtle crystal spire pylons floating under the NW/SE Singularity Crystal Nodes
      { pos: new THREE.Vector3(-11.5, -0.8, -11.5), rotY: 0.4, scale: 0.72 },
      { pos: new THREE.Vector3(11.5, -0.8, 11.5), rotY: 2.6, scale: 0.72 },
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

    // 2. Sculpted Abyss Monolith Tactical Covers + clean tight AABB colliders
    const covers = [
      { x: -6.5, y: 0.0, z: 20.5, rotY: 0.0, w: 2.8, d: 1.5, h: 2.1 },
      { x: 6.5, y: 0.0, z: 20.5, rotY: 0.0, w: 2.8, d: 1.5, h: 2.1 },
      { x: -7.5, y: 0.0, z: -18.5, rotY: 0.0, w: 2.8, d: 1.5, h: 2.1 },
      { x: 7.5, y: 0.0, z: -18.5, rotY: 0.0, w: 2.8, d: 1.5, h: 2.1 },
      { x: -23.0, y: 0.0, z: 5.5, rotY: Math.PI * 0.5, w: 1.5, d: 2.8, h: 2.1 },
      { x: 23.0, y: 0.0, z: -5.5, rotY: Math.PI * 0.5, w: 1.5, d: 2.8, h: 2.1 },
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

    // Small low cover curbs on Center Island corners (leave central 7m flat open)
    const centerCurbs = [
      { x: -5.5, z: -5.5 },
      { x: 5.5, z: 5.5 },
      { x: -5.5, z: 5.5 },
      { x: 5.5, z: -5.5 },
    ];
    for (let i = 0; i < centerCurbs.length; i++) {
      const cc = centerCurbs[i];
      this._addBoxMeshAndCollider(1.8, 1.35, 1.8, cc.x, 1.4, cc.z, mats.obsidianMat, 'cover', true, true);
    }
  }

  _buildSingularityVortexAndVoidBackdrop(mats, halfX, halfZ) {
    // High overhead spinning singularity rings above Center Island (clear of jumping player headroom)
    const outerRing = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(6.8, 0.24, 10, 40)),
      mats.violetGlowMat
    );
    outerRing.position.set(0, 10.5, 0);
    outerRing.rotation.x = Math.PI * 0.36;
    this.root.add(outerRing);
    this._singularityRings.push(outerRing);

    const innerRing = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(4.2, 0.18, 10, 32)),
      mats.cyanGlowMat
    );
    innerRing.position.set(0, 10.5, 0);
    innerRing.rotation.y = Math.PI * 0.25;
    this.root.add(innerRing);
    this._singularityRings.push(innerRing);

    // Distant deep cosmic abyss glow ring far below voidFallY (-28m)
    const abyssGlowDisk = new THREE.Mesh(
      this._trackGeo(new THREE.RingGeometry(18, 48, 48)),
      this._trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x3b0764,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )
    );
    abyssGlowDisk.rotation.x = -Math.PI * 0.5;
    abyssGlowDisk.position.set(0, -28, 0);
    this.root.add(abyssGlowDisk);

    // Distant orbital void monoliths & giant dimensional horizon arc
    const monoGeo = this._trackGeo(new THREE.BoxGeometry(3.4, 38, 3.4));
    const coreGeo = this._trackGeo(new THREE.BoxGeometry(0.46, 32, 0.46));
    const coords = [
      [-48, -42], [48, -42], [-52, 0], [52, 0], [-48, 42], [48, 42], [-24, -50], [24, -50],
    ];
    for (let i = 0; i < coords.length; i++) {
      const [mx, mz] = coords[i];
      const mono = new THREE.Mesh(monoGeo, mats.obsidianMat);
      mono.position.set(mx, 8, mz);
      this.root.add(mono);

      const core = new THREE.Mesh(coreGeo, i % 2 === 0 ? mats.violetGlowMat : mats.cyanGlowMat);
      core.position.set(mx * 0.94, 8, mz * 0.94);
      this.root.add(core);
    }

    const gateArc = new THREE.Mesh(
      this._trackGeo(new THREE.TorusGeometry(30, 0.9, 10, 48, Math.PI)),
      mats.violetGlowMat
    );
    gateArc.position.set(0, 4, -(halfZ + 22));
    this.root.add(gateArc);
  }

  _buildLighting() {
    this.scene.background = new THREE.Color(0x050410);
    this.scene.fog = new THREE.FogExp2(0x0a0720, 0.0072);

    this._hemiLight = new THREE.HemisphereLight(0xd8b4fe, 0x0b0a1c, 1.1);
    this._hemiLight.position.set(0, 34, 0);
    this.root.add(this._hemiLight);
    this._lights.push(this._hemiLight);

    this._dirLight = new THREE.DirectionalLight(0xe0e7ff, 2.35);
    this._dirLight.position.set(-22, 42, -24);
    this._dirLight.shadow.camera.left = -40;
    this._dirLight.shadow.camera.right = 40;
    this._dirLight.shadow.camera.top = 38;
    this._dirLight.shadow.camera.bottom = -38;
    this._dirLight.shadow.camera.near = 8;
    this._dirLight.shadow.camera.far = 115;
    this._dirLight.shadow.bias = -0.0005;
    this._dirLight.shadow.normalBias = 0.03;
    this.root.add(this._dirLight);
    this._lights.push(this._dirLight);

    // Strictly <= 2 PointLights
    const coreLight = new THREE.PointLight(0xc084fc, 28, 42, 1.35);
    coreLight.position.set(0, 7.5, 0);
    coreLight.castShadow = false;
    this.root.add(coreLight);
    this._accentLights.push(coreLight);
    this._lights.push(coreLight);
    this._coreLight = coreLight;

    const riftLight = new THREE.PointLight(0x38bdf8, 26, 44, 1.35);
    riftLight.position.set(0, 6.5, -23.0);
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
    this._singularityRings.length = 0;

    this._hemiLight = null;
    this._dirLight = null;
    this._coreLight = null;
    this._riftLight = null;
    this._violetGlowMat = null;
    this._cyanGlowMat = null;

    if (this._ownsTexGen && this._texGen) {
      this._texGen.dispose();
    }
  }
}
  __exports.Map7AbyssRingBuilder = Map7AbyssRingBuilder;
});
