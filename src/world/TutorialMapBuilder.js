// Module: src/world/TutorialMapBuilder.js
__define("src/world/TutorialMapBuilder.js", (__exports, __require) => {
const { ARENA_CONFIG } = __require("src/config/constants.js");
const { TextureGenerator } = __require("src/world/TextureGenerator.js");

/**
 * Dedicated Clean Holographic Training Bay (mapIndex: 6)
 * Built strictly with ONLY the functional zones required for the 6-step tutorial:
 * - South: Mobility lane + Jump Pad -> Elevated Platform
 * - Center: Terra-Beacon Control Zone + Explosive Barrels
 * - East/West: Item Spawn Pads (HP / Shield / Ammo) & Weapon Drop Pads
 * - North: Firing & Shield-Block Target Range
 */
class TutorialMapBuilder {
  constructor(scene, collisionWorld, qualityConfig = {}, sharedTexGen = null) {
    this.scene = scene;
    this.collisionWorld = collisionWorld;
    this.qualityConfig = qualityConfig || {};
    this._ownsTexGen = !sharedTexGen;
    this._texGen = sharedTexGen || new TextureGenerator(4);

    this.root = null;
    this._geometries = [];
    this._materials = [];
    this._lights = [];
    this._accentLights = [];
    this._dirLight = null;
    this._hemiLight = null;
    this._built = false;
    this._ringMesh = null;
  }

  _trackGeo(geo) {
    this._geometries.push(geo);
    return geo;
  }

  _trackMat(mat) {
    this._materials.push(mat);
    return mat;
  }

  _createGridTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#182234';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 32; i < 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  build() {
    if (this._built) this.dispose();
    this._built = true;

    this.root = new THREE.Group();
    this.root.name = 'ArenaRoot_TutorialTrainingBay';
    this.scene.add(this.root);

    const innerBound = 24.5;
    const wallH = 10.0;
    this.collisionWorld.setArenaBounds(-innerBound, innerBound, -innerBound, innerBound, 0, 24);

    const gridTex = this._createGridTexture();
    const floorMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        map: gridTex,
        roughness: 0.55,
        metalness: 0.35,
      })
    );
    const wallMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.62,
        metalness: 0.42,
      })
    );
    const deckMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.48,
        metalness: 0.55,
      })
    );
    const cyanGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: new THREE.Color(0x0284c7),
        emissiveIntensity: 1.8,
        roughness: 0.2,
      })
    );
    const amberGlowMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: new THREE.Color(0xd97706),
        emissiveIntensity: 1.8,
        roughness: 0.2,
      })
    );

    // 1. Clean Grid Training Floor
    const floorGeo = this._trackGeo(new THREE.PlaneGeometry(innerBound * 2 + 2, innerBound * 2 + 2));
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI * 0.5;
    floorMesh.receiveShadow = true;
    this.root.add(floorMesh);

    // 2. Clean Perimeter Training Walls with Cyan Trim Strip
    const wallSpan = innerBound * 2 + 1.0;
    const wallThick = 1.0;
    const nsGeo = this._trackGeo(new THREE.BoxGeometry(wallSpan, wallH, wallThick));
    const ewGeo = this._trackGeo(new THREE.BoxGeometry(wallThick, wallH, wallSpan));
    const trimNS = this._trackGeo(new THREE.BoxGeometry(wallSpan - 1, 0.22, 0.14));
    const trimEW = this._trackGeo(new THREE.BoxGeometry(0.14, 0.22, wallSpan - 1));

    const wallDefs = [
      { geo: nsGeo, trim: trimNS, pos: [0, wallH * 0.5, -innerBound - 0.5], tPos: [0, 3.6, -innerBound + 0.06] },
      { geo: nsGeo, trim: trimNS, pos: [0, wallH * 0.5, innerBound + 0.5], tPos: [0, 3.6, innerBound - 0.06] },
      { geo: ewGeo, trim: trimEW, pos: [-innerBound - 0.5, wallH * 0.5, 0], tPos: [-innerBound + 0.06, 3.6, 0] },
      { geo: ewGeo, trim: trimEW, pos: [innerBound + 0.5, wallH * 0.5, 0], tPos: [innerBound - 0.06, 3.6, 0] },
    ];
    for (let i = 0; i < wallDefs.length; i++) {
      const d = wallDefs[i];
      const wMesh = new THREE.Mesh(d.geo, wallMat);
      wMesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
      wMesh.receiveShadow = true;
      this.root.add(wMesh);

      const tMesh = new THREE.Mesh(d.trim, cyanGlowMat);
      tMesh.position.set(d.tPos[0], d.tPos[1], d.tPos[2]);
      this.root.add(tMesh);
    }

    // 3. Elevated Jump-Pad Target Platform (West side: x = -17..-10, z = 4..12, height = 3.6m)
    const platW = 7.5;
    const platH = 3.6;
    const platD = 8.5;
    const platCx = -15.5;
    const platCz = 7.5;
    const platGeo = this._trackGeo(new THREE.BoxGeometry(platW, platH, platD));
    const platMesh = new THREE.Mesh(platGeo, deckMat);
    platMesh.position.set(platCx, platH * 0.5, platCz);
    platMesh.castShadow = true;
    platMesh.receiveShadow = true;
    this.root.add(platMesh);
    this.collisionWorld.addBox(
      platCx - platW * 0.5,
      0,
      platCz - platD * 0.5,
      platCx + platW * 0.5,
      platH,
      platCz + platD * 0.5,
      'platform'
    );

    const platTrimGeo = this._trackGeo(new THREE.BoxGeometry(platW + 0.12, 0.16, platD + 0.12));
    const platTrim = new THREE.Mesh(platTrimGeo, amberGlowMat);
    platTrim.position.set(platCx, platH - 0.08, platCz);
    this.root.add(platTrim);

    // 4. Low Tactical Cover Wall in front of Firing Range (z = -6, x = -4..4) for Shield/Peeking practice
    const coverGeo = this._trackGeo(new THREE.BoxGeometry(4.2, 1.35, 0.8));
    for (const cx of [-6.5, 6.5]) {
      const cover = new THREE.Mesh(coverGeo, deckMat);
      cover.position.set(cx, 0.675, -5.5);
      cover.castShadow = true;
      cover.receiveShadow = true;
      this.root.add(cover);
      this.collisionWorld.addBox(cx - 2.1, 0, -5.9, cx + 2.1, 1.35, -5.1, 'cover');
    }

    // 5. Center Terra-Beacon Holographic Floor Ring + Overhead Floating Halo
    const centerRingGeo = this._trackGeo(new THREE.RingGeometry(4.8, 5.15, 40));
    centerRingGeo.rotateX(-Math.PI * 0.5);
    const centerRing = new THREE.Mesh(centerRingGeo, cyanGlowMat);
    centerRing.position.y = 0.04;
    this.root.add(centerRing);

    const overheadGeo = this._trackGeo(new THREE.TorusGeometry(9.5, 0.22, 8, 42));
    overheadGeo.rotateX(Math.PI * 0.5);
    this._ringMesh = new THREE.Mesh(overheadGeo, cyanGlowMat);
    this._ringMesh.position.set(0, 11.5, 0);
    this.root.add(this._ringMesh);

    // 6. Crisp High-Visibility Lighting
    this.scene.background = new THREE.Color(0x0c1424);
    this.scene.fog = new THREE.FogExp2(0x101c30, 0.0072);

    this._hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.15);
    this._hemiLight.position.set(0, 28, 0);
    this.root.add(this._hemiLight);
    this._lights.push(this._hemiLight);

    this._dirLight = new THREE.DirectionalLight(0xf8fafc, 2.2);
    this._dirLight.position.set(-18, 32, 18);
    this._dirLight.shadow.camera.left = -28;
    this._dirLight.shadow.camera.right = 28;
    this._dirLight.shadow.camera.top = 28;
    this._dirLight.shadow.camera.bottom = -28;
    this._dirLight.shadow.camera.near = 6;
    this._dirLight.shadow.camera.far = 90;
    this.root.add(this._dirLight);
    this._lights.push(this._dirLight);

    const centerLight = new THREE.PointLight(0x38bdf8, 22, 32, 1.4);
    centerLight.position.set(0, 4.5, 0);
    this.root.add(centerLight);
    this._accentLights.push(centerLight);
    this._lights.push(centerLight);

    this.setQuality(this.qualityConfig);

    return {
      mapId: 'tutorial_training_bay',
      mapIndex: 6,
      mapCode: 'TRN-00',
      mapName: 'SECTOR-00 // VANGUARD TRAINING BAY',
      mapSubtitle: '전술 기동 · 방패 · 무기 강화 종합 훈련장',
      atmosphere: {
        bgColor: 0x0c1424,
        fogColor: 0x101c30,
        fogDensity: 0.0072,
      },
      playerSpawn: {
        pos: new THREE.Vector3(0, 0.05, 16.5),
        yaw: 0,
      },
      enemySpawns: [
        { pos: new THREE.Vector3(0.0, 0.05, -14.0), isElevated: false },
        { pos: new THREE.Vector3(-6.0, 0.05, -15.0), isElevated: false },
        { pos: new THREE.Vector3(6.0, 0.05, -15.0), isElevated: false },
        { pos: new THREE.Vector3(-10.0, 0.05, -12.0), isElevated: false },
        { pos: new THREE.Vector3(10.0, 0.05, -12.0), isElevated: false },
      ],
      // Dedicated Map-Spawned Item Pads (Health, Shield, Ammo) clearly visible in training bay!
      pickupSpawns: [
        { pos: new THREE.Vector3(8.5, 0.0, 9.5), type: 'health' },
        { pos: new THREE.Vector3(11.5, 0.0, 9.5), type: 'shield' },
        { pos: new THREE.Vector3(10.0, 0.0, 6.5), type: 'ammo' },
        { pos: new THREE.Vector3(-15.5, 3.62, 7.5), type: 'shield' },
      ],
      // Dedicated Explosive Fuel Barrels for Step 1 Barrel Tutorial!
      barrelSpawns: [
        new THREE.Vector3(-3.5, 0.0, 4.5),
        new THREE.Vector3(3.5, 0.0, 4.5),
      ],
      // Dedicated Jump Pad launching cleanly onto the West Elevated Platform (-15.5, 3.6, 7.5)
      jumpPadSpawns: [
        { pos: new THREE.Vector3(-6.8, 0.0, 7.5), launchVy: 16.5, launchDirX: -1, launchDirZ: 0 },
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

  update(dt) {
    if (!this._built) return;
    if (this._ringMesh && Number.isFinite(dt)) {
      this._ringMesh.rotation.y += Math.min(dt, 0.1) * 0.35;
    }
  }

  setQuality(qualityConfig) {
    if (!qualityConfig) return;
    this.qualityConfig = qualityConfig;
    if (this._dirLight) {
      this._dirLight.castShadow = Boolean(qualityConfig.shadowsEnabled);
    }
  }

  dispose() {
    if (this.root && this.root.parent) {
      this.root.parent.remove(this.root);
    }
    for (let i = 0; i < this._geometries.length; i++) this._geometries[i].dispose();
    this._geometries.length = 0;
    for (let i = 0; i < this._materials.length; i++) this._materials[i].dispose();
    this._materials.length = 0;
    this._lights.length = 0;
    this._accentLights.length = 0;
    this._dirLight = null;
    this._hemiLight = null;
    this._ringMesh = null;
    if (this._ownsTexGen && this._texGen) this._texGen.dispose();
    this._built = false;
  }
}
  __exports.TutorialMapBuilder = TutorialMapBuilder;
});
