// Module: src/ai/EnemyModelFactory.js
__define("src/ai/EnemyModelFactory.js", (__exports, __require) => {
/**
 * AETHER DROP: RECLAIM EARTH — Post-Apocalyptic Feral Scrap-Machine 3D Model Factory
 * Sculpted multi-part articulated silhouettes built with THREE.ExtrudeGeometry,
 * THREE.LatheGeometry, THREE.TubeGeometry, and procedural Canvas PBR corroded iron,
 * rust, weld-bead, soot, industrial blast-shield & furnace-red optic textures.
 *
 * ZERO NEON & ZERO MeshPhysicalMaterial — strictly weathered rust, corroded cast iron,
 * exposed pistons/exhausts, bolted steel plates, and high-contrast furnace-red/amber optics.
 *
 * Shared GPU geometries & procedural textures are cached on the factory instance
 * while per-enemy materials allow crisp hit-flashes, shield ripples, phase shifts,
 * death-dissolve animations, and zero-stutter rig pooling without affecting siblings.
 */
const GLB_MODEL_REGISTRY = Object.freeze({
  // Act 1: Ash-Furnace Legion (Waves 1-5)
  rusher_drone: './assets/models/rusher_drone.glb?v=20261128a',
  tactical_trooper: './assets/models/tactical_trooper.glb?v=20261128a',
  heavy_enforcer: './assets/models/heavy_enforcer.glb?v=20261128a',
  sniper_stalker: './assets/models/sniper_stalker.glb?v=20261128a',
  cyber_mech_boss: './assets/models/colossus_iv.glb?v=20261128a',
  // Act 2: Aegis Orbital Vanguard (Waves 6-10)
  interceptor_drone: './assets/models/interceptor_drone.glb?v=20261128g',
  shock_breacher: './assets/models/shock_breacher.glb?v=20261128g',
  rail_warden: './assets/models/rail_warden.glb?v=20261128g',
  mortar_artillery: './assets/models/mortar_artillery.glb?v=20261128g',
  vanguard_assassin: './assets/models/vanguard_assassin.glb?v=20261128g',
  aegis_overlord_boss: './assets/models/aegis_overlord.glb?v=20261128f',
  // Act 3: Abyssal Singularity Swarm (Waves 11-15)
  volatile_rusher: './assets/models/volatile_rusher.glb?v=20261128g',
  void_warper: './assets/models/void_warper.glb?v=20261128g',
  void_swarmer: './assets/models/void_swarmer.glb?v=20261128g',
  abyss_sentinel: './assets/models/abyss_sentinel.glb?v=20261128g',
  transcendent_omega_boss: './assets/models/transcendent_omega.glb?v=20261128f',
});
const ALL_GLB_MODELS = GLB_MODEL_REGISTRY;

class EnemyModelFactory {
  /**
   * Generate and statically cache a seamless 512x512 tangent-space micro-normal map
   * (panel seams, anisotropic brushed steel streaks, chamfered micro-rivets, louvers)
   * and matching roughnessMap across all enemy rigs.
   * @returns {{ normalMap: THREE.CanvasTexture | null, roughnessMap: THREE.CanvasTexture | null }}
   */
  static _getSharedMechanicalDetailMaps() {
    if (EnemyModelFactory._sharedMechDetailMaps) {
      return EnemyModelFactory._sharedMechDetailMaps;
    }
    if (typeof document === 'undefined' || typeof THREE === 'undefined') {
      return { normalMap: null, roughnessMap: null };
    }

    const size = 512;
    const mask = size - 1;
    const height = new Float32Array(size * size);
    const rough = new Float32Array(size * size);
    height.fill(0.5);
    rough.fill(0.80);

    // 1. Seamless anisotropic brushed-steel micro-streaks & fine cast grain
    for (let y = 0; y < size; y++) {
      const rowHash = (((y * 2654435761) >>> 0) % 1000) / 1000 - 0.5;
      const rowOffset = rowHash * 6.283185;
      const rowOffsetY = y * size;
      for (let x = 0; x < size; x++) {
        const uPhase = (x / size) * Math.PI * 2;
        const streakWave = Math.sin(uPhase * 5.0 + rowOffset) * 0.5 + Math.sin(uPhase * 13.0 - rowOffset * 1.7) * 0.25;
        const microGrain = ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000) / 1000 - 0.5;
        const idx = rowOffsetY + x;
        height[idx] += rowHash * 0.015 + streakWave * 0.008 + microGrain * 0.006;
        rough[idx] = Math.max(
          0.44,
          Math.min(0.96, rough[idx] - rowHash * 0.065 - streakWave * 0.04 + microGrain * 0.03)
        );
      }
    }

    // 2. Seamless chamfered armor panel seams (periodic modulo 512)
    const carveSeamPixel = (px, py, dist) => {
      const idx = (py & mask) * size + (px & mask);
      if (dist <= 1) {
        height[idx] -= 0.19 * (1 - dist * 0.32);
        rough[idx] = Math.max(rough[idx], 0.94);
      } else if (dist === 2) {
        height[idx] -= 0.045;
        rough[idx] = Math.max(rough[idx], 0.88);
      } else if (dist === 3) {
        height[idx] += 0.035;
        rough[idx] = Math.min(rough[idx], 0.62);
      }
    };

    const carveHSeam = (yCenter, xStart, xLen) => {
      for (let i = 0; i < xLen; i++) {
        const px = xStart + i;
        for (let d = -3; d <= 3; d++) {
          carveSeamPixel(px, yCenter + d, Math.abs(d));
        }
      }
    };

    const carveVSeam = (xCenter, yStart, yLen) => {
      for (let i = 0; i < yLen; i++) {
        const py = yStart + i;
        for (let d = -3; d <= 3; d++) {
          carveSeamPixel(xCenter + d, py, Math.abs(d));
        }
      }
    };

    // Primary tiling seams on boundaries + interior panel subdivisions
    carveHSeam(0, 0, size);
    carveHSeam(176, 0, size);
    carveHSeam(352, 0, size);
    carveVSeam(0, 0, size);
    carveVSeam(256, 0, size);
    carveVSeam(128, 176, 176);
    carveVSeam(384, 0, 176);

    // Milled cooling louver slots inside secondary panel
    for (let s = 0; s < 6; s++) {
      const lx = 294 + s * 32;
      for (let py = 222; py < 306; py++) {
        for (let dx = -5; dx <= 5; dx++) {
          const adx = Math.abs(dx);
          const idx = py * size + ((lx + dx) & mask);
          if (adx <= 3) {
            height[idx] -= 0.13;
            rough[idx] = Math.max(rough[idx], 0.95);
          } else {
            height[idx] += 0.025;
            rough[idx] = Math.min(rough[idx], 0.65);
          }
        }
      }
    }

    // 3. Raised micro-rivets with chamfered socket collars along panel borders
    const stampRivet = (cx, cy, radius = 3.8) => {
      const bound = Math.ceil(radius + 2);
      for (let dy = -bound; dy <= bound; dy++) {
        for (let dx = -bound; dx <= bound; dx++) {
          const dist = Math.hypot(dx, dy);
          const px = (cx + dx) & mask;
          const py = (cy + dy) & mask;
          const idx = py * size + px;
          if (dist <= radius) {
            const t = dist / radius;
            const dome = Math.sqrt(Math.max(0, 1 - t * t));
            height[idx] += 0.16 * dome;
            rough[idx] = Math.min(rough[idx], 0.58 - 0.10 * dome);
          } else if (dist <= radius + 1.5) {
            height[idx] -= 0.07;
            rough[idx] = Math.max(rough[idx], 0.92);
          }
        }
      }
    };

    const panelRects = [
      [0, 0, 256, 176],
      [256, 0, 128, 176],
      [384, 0, 128, 176],
      [0, 176, 128, 176],
      [128, 176, 128, 176],
      [256, 176, 256, 176],
      [0, 352, 256, 160],
      [256, 352, 256, 160],
    ];
    for (let i = 0; i < panelRects.length; i++) {
      const [px, py, pw, ph] = panelRects[i];
      const inset = 14;
      stampRivet(px + inset, py + inset);
      stampRivet(px + pw - inset, py + inset);
      stampRivet(px + inset, py + ph - inset);
      stampRivet(px + pw - inset, py + ph - inset);
      if (pw >= 200) {
        stampRivet(px + (pw >> 1), py + inset);
        stampRivet(px + (pw >> 1), py + ph - inset);
      }
    }

    // 4. Derive periodic tangent-space NormalMap (Sobel 3x3) & RoughnessMap
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = size;
    normalCanvas.height = size;
    const nCtx = normalCanvas.getContext('2d');
    const nImg = nCtx.createImageData(size, size);
    const nData = nImg.data;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');
    const rImg = rCtx.createImageData(size, size);
    const rData = rImg.data;

    const strength = 1.65;
    for (let y = 0; y < size; y++) {
      const ym = ((y - 1) & mask) * size;
      const y0 = y * size;
      const yp = ((y + 1) & mask) * size;
      for (let x = 0; x < size; x++) {
        const xm = (x - 1) & mask;
        const xp = (x + 1) & mask;

        const dhdx =
          height[yp + xp] + 2 * height[y0 + xp] + height[ym + xp] -
          (height[yp + xm] + 2 * height[y0 + xm] + height[ym + xm]);
        const dhdy =
          height[yp + xm] + 2 * height[yp + x] + height[yp + xp] -
          (height[ym + xm] + 2 * height[ym + x] + height[ym + xp]);

        // OpenGL tangent-space (+X right, +Y up in UV, +Z out); canvas Y grows downward
        let nx = -dhdx * strength;
        let ny = dhdy * strength;
        let nz = 1.0;
        const invLen = 1.0 / Math.hypot(nx, ny, nz);
        nx *= invLen;
        ny *= invLen;
        nz *= invLen;

        const pIdx = (y0 + x) * 4;
        nData[pIdx] = Math.max(0, Math.min(255, Math.round((nx * 0.5 + 0.5) * 255)));
        nData[pIdx + 1] = Math.max(0, Math.min(255, Math.round((ny * 0.5 + 0.5) * 255)));
        nData[pIdx + 2] = Math.max(0, Math.min(255, Math.round((nz * 0.5 + 0.5) * 255)));
        nData[pIdx + 3] = 255;

        const rVal = Math.max(0, Math.min(255, Math.round(rough[y0 + x] * 255)));
        rData[pIdx] = rVal;
        rData[pIdx + 1] = rVal;
        rData[pIdx + 2] = rVal;
        rData[pIdx + 3] = 255;
      }
    }
    nCtx.putImageData(nImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    for (const tex of [normalMap, roughnessMap]) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      tex.anisotropy = 8;
      if (THREE.NoColorSpace !== undefined) {
        tex.colorSpace = THREE.NoColorSpace;
      }
      tex.needsUpdate = true;
    }

    EnemyModelFactory._sharedMechDetailMaps = { normalMap, roughnessMap };
    return EnemyModelFactory._sharedMechDetailMaps;
  }

  constructor() {
    this._geoCache = new Map();
    this._textures = this._createProceduralTextures();

    this._contactShadowMat = new THREE.MeshBasicMaterial({
      color: 0x080605,
      map: this._textures.contactShadow,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    // Warm-preload all registered GLB models non-blockingly; missing Act 2/3 GLBs fall back gracefully
    if (typeof document !== 'undefined' && globalThis.GLTFLoader) {
      this.preloadModels().catch(() => {});
    }
  }

  /**
   * Preload sculpted GLB models from GLB_MODEL_REGISTRY (Act 1 + Act 2 + Act 3).
   * Cached once across factory instances; missing GLBs are marked so legacy builders run cleanly.
   * @returns {Promise<void>}
   */
  preloadModels() {
    const ids = Object.keys(GLB_MODEL_REGISTRY);
    if (
      ids.every(
        (id) => EnemyModelFactory._glbCache.has(id) || EnemyModelFactory._glbMissing.has(id)
      )
    ) {
      return Promise.resolve();
    }
    if (EnemyModelFactory._glbLoadPromise) {
      return EnemyModelFactory._glbLoadPromise;
    }
    if (!globalThis.GLTFLoader) {
      return Promise.resolve();
    }
    const loader = new globalThis.GLTFLoader();
    EnemyModelFactory._glbLoadPromise = Promise.all(
      ids.map((id) => {
        if (EnemyModelFactory._glbCache.has(id) || EnemyModelFactory._glbMissing.has(id)) {
          return Promise.resolve();
        }
        return loader
          .loadAsync(GLB_MODEL_REGISTRY[id])
          .then((gltf) => {
            if (gltf && gltf.scene) {
              EnemyModelFactory._glbCache.set(id, gltf.scene);
              if (id === 'cyber_mech_boss') {
                EnemyModelFactory._colossusGltf = gltf.scene;
              }
            } else {
              EnemyModelFactory._glbMissing.add(id);
            }
          })
          .catch((err) => {
            EnemyModelFactory._glbMissing.add(id);
            const msg = err && err.message ? String(err.message) : String(err || '');
            const isNotFound = /\b404\b|not found|failed to fetch/i.test(msg);
            if (!isNotFound) {
              console.warn(`[EnemyModelFactory] Failed to preload ${id} GLB, using fallback rig:`, err);
            }
          });
      })
    );
    return EnemyModelFactory._glbLoadPromise;
  }

  /**
   * Generate shared procedural Canvas PBR textures:
   * - armorWear: subtle corroded iron, rust stains, scratched paint & exhaust soot albedo map
   * - armorBump: pitted cast iron, bolted plate seams, raised rivets, weld beads & louver vents
   * - armorRoughness: bright bare-metal scratches vs matte soot & oxidized rust patches
   * - blastShield: welded heavy industrial blast shield (diagonal hazard rivets, steel grid cage,
   *   and glowing heated thermal-amber impact lattice)
   * - visorGrid: glowing furnace-red optical scanner matrix
   * - contactShadow: soft radial ground contact shadow disc
   * @private
   */
  _createProceduralTextures() {
    if (typeof document === 'undefined') {
      return {
        armorWear: null,
        armorBump: null,
        armorRoughness: null,
        blastShield: null,
        hexShield: null,
        visorGrid: null,
        contactShadow: null,
      };
    }

    const size = 512;

    // 1. Corroded, pitted cast-iron & rust armor albedo/bump/roughness trio (512x512)
    const wearCanvas = document.createElement('canvas');
    wearCanvas.width = size;
    wearCanvas.height = size;
    const wCtx = wearCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');

    // Neutral light warm steel base so archetype colors tint cleanly while showing wear
    wCtx.fillStyle = '#d8d0c8';
    wCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#848484';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#9a9a9a'; // matte-satin weathered cast iron
    rCtx.fillRect(0, 0, size, size);

    // Pitted cast-iron micro-grain & corrosion flecks
    for (let i = 0; i < 1900; i++) {
      const px = (i * 197 + (i % 13) * 17) % size;
      const py = (i * 113 + (i % 7) * 29) % size;
      const r = 1 + (i % 3);
      const isPit = i % 3 !== 0;

      if (isPit) {
        bCtx.fillStyle = i % 2 === 0 ? '#4d4d4d' : '#656565';
        bCtx.fillRect(px, py, r, r);
        rCtx.fillStyle = '#c8c8c8';
        rCtx.fillRect(px, py, r, r);
        wCtx.fillStyle = i % 4 === 0 ? '#8c4c2b' : '#aba199';
        wCtx.fillRect(px, py, r + 1, r + 1);
      } else {
        // Oxidation rust bloom spots
        wCtx.fillStyle = 'rgba(155, 76, 36, 0.24)';
        wCtx.fillRect(px, py, 6 + (i % 10), 4 + (i % 8));
        rCtx.fillStyle = 'rgba(225, 225, 225, 0.35)';
        rCtx.fillRect(px, py, 6 + (i % 10), 4 + (i % 8));
      }
    }

    // Bolted steel armor sub-plates with recessed weld seams & corner dome rivets
    const panels = [
      [14, 14, 228, 228],
      [268, 14, 228, 142],
      [268, 172, 228, 70],
      [14, 268, 152, 228],
      [182, 268, 314, 110],
      [182, 394, 314, 102],
    ];

    for (let i = 0; i < panels.length; i++) {
      const [px, py, pw, ph] = panels[i];

      // Deep dark panel seam & exhaust soot bleed
      wCtx.fillStyle = '#524943';
      wCtx.fillRect(px - 5, py - 5, pw + 10, ph + 10);
      bCtx.fillStyle = '#1b1b1b';
      bCtx.fillRect(px - 5, py - 5, pw + 10, ph + 10);
      rCtx.fillStyle = '#e8e8e8';
      rCtx.fillRect(px - 5, py - 5, pw + 10, ph + 10);

      // Weld bead border ripples around panel perimeter
      bCtx.fillStyle = '#dadada';
      bCtx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
      rCtx.fillStyle = '#555555';
      rCtx.fillRect(px - 1, py - 1, pw + 2, ph + 2);

      for (let wx = px; wx < px + pw; wx += 10) {
        bCtx.beginPath();
        bCtx.arc(wx, py, 3.2, 0, Math.PI * 2);
        bCtx.arc(wx, py + ph, 3.2, 0, Math.PI * 2);
        bCtx.fillStyle = '#d4d4d4';
        bCtx.fill();
      }

      // Main worn plate face
      wCtx.fillStyle = '#ded6ce';
      wCtx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
      bCtx.fillStyle = '#929292';
      bCtx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
      rCtx.fillStyle = '#969696';
      rCtx.fillRect(px + 4, py + 4, pw - 8, ph - 8);

      // Rust streaking down from rivets & top edge
      const rustGrad = wCtx.createLinearGradient(px, py, px, py + Math.min(72, ph));
      rustGrad.addColorStop(0, 'rgba(130, 58, 24, 0.42)');
      rustGrad.addColorStop(1, 'rgba(130, 58, 24, 0.0)');
      wCtx.fillStyle = rustGrad;
      wCtx.fillRect(px + 4, py + 4, pw - 8, Math.min(72, ph - 8));

      // Heavy dome-head rivets around plate edges
      const inset = 14;
      const rivets = [
        [px + inset, py + inset],
        [px + pw * 0.5, py + inset],
        [px + pw - inset, py + inset],
        [px + inset, py + ph - inset],
        [px + pw * 0.5, py + ph - inset],
        [px + pw - inset, py + ph - inset],
      ];
      for (let c = 0; c < rivets.length; c++) {
        const [rx, ry] = rivets[c];
        bCtx.beginPath();
        bCtx.arc(rx, ry, 5.2, 0, Math.PI * 2);
        bCtx.fillStyle = '#262626';
        bCtx.fill();
        bCtx.beginPath();
        bCtx.arc(rx, ry, 3.4, 0, Math.PI * 2);
        bCtx.fillStyle = '#efefef';
        bCtx.fill();

        wCtx.beginPath();
        wCtx.arc(rx, ry, 4.0, 0, Math.PI * 2);
        wCtx.fillStyle = '#6c5a4f';
        wCtx.fill();
      }
    }

    // Scratched paint / bare-steel gouge marks (glossy steel core + raised bump edge)
    for (let s = 0; s < 42; s++) {
      const sx = (s * 89 + 23) % (size - 60);
      const sy = (s * 131 + 19) % (size - 60);
      const dx = 18 + (s % 5) * 14;
      const dy = (s % 2 === 0 ? 1 : -1) * (8 + (s % 4) * 7);

      bCtx.strokeStyle = '#383838';
      bCtx.lineWidth = 2.6;
      bCtx.beginPath();
      bCtx.moveTo(sx, sy);
      bCtx.lineTo(sx + dx, sy + dy);
      bCtx.stroke();

      rCtx.strokeStyle = '#363636'; // bright metallic scratch
      rCtx.lineWidth = 2.0;
      rCtx.beginPath();
      rCtx.moveTo(sx, sy);
      rCtx.lineTo(sx + dx, sy + dy);
      rCtx.stroke();

      wCtx.strokeStyle = '#f2ede6';
      wCtx.lineWidth = 1.8;
      wCtx.beginPath();
      wCtx.moveTo(sx, sy);
      wCtx.lineTo(sx + dx, sy + dy);
      wCtx.stroke();
    }

    // Exhaust soot & cooling louver vents on plates 2 & 5
    for (let v = 0; v < 7; v++) {
      const vx = 292 + v * 28;
      bCtx.fillStyle = '#1e1e1e';
      bCtx.fillRect(vx, 184, 14, 44);
      rCtx.fillStyle = '#efefef';
      rCtx.fillRect(vx, 184, 14, 44);
      wCtx.fillStyle = '#342c28';
      wCtx.fillRect(vx, 184, 14, 44);
    }
    const sootGrad = wCtx.createRadialGradient(392, 448, 12, 392, 448, 130);
    sootGrad.addColorStop(0, 'rgba(26, 20, 18, 0.72)');
    sootGrad.addColorStop(1, 'rgba(26, 20, 18, 0.0)');
    wCtx.fillStyle = sootGrad;
    wCtx.fillRect(182, 394, 314, 102);

    for (let v = 0; v < 8; v++) {
      const vx = 204 + v * 34;
      bCtx.fillStyle = '#1e1e1e';
      bCtx.fillRect(vx, 422, 18, 50);
      rCtx.fillStyle = '#f0f0f0';
      rCtx.fillRect(vx, 422, 18, 50);
    }

    const armorWear = new THREE.CanvasTexture(wearCanvas);
    armorWear.colorSpace = THREE.SRGBColorSpace;
    armorWear.wrapS = THREE.RepeatWrapping;
    armorWear.wrapT = THREE.RepeatWrapping;
    armorWear.repeat.set(2, 2);

    const armorBump = new THREE.CanvasTexture(bumpCanvas);
    armorBump.wrapS = THREE.RepeatWrapping;
    armorBump.wrapT = THREE.RepeatWrapping;
    armorBump.repeat.set(2, 2);

    const armorRoughness = new THREE.CanvasTexture(roughCanvas);
    armorRoughness.wrapS = THREE.RepeatWrapping;
    armorRoughness.wrapT = THREE.RepeatWrapping;
    armorRoughness.repeat.set(2, 2);

    // 2. Welded Heavy Industrial Blast Shield Texture (512x512 RGBA — zero cyan neon!)
    const shieldCanvas = document.createElement('canvas');
    shieldCanvas.width = size;
    shieldCanvas.height = size;
    const sCtx = shieldCanvas.getContext('2d');

    sCtx.clearRect(0, 0, size, size);

    // Heated thermal-amber impact lattice glow backdrop
    const heatGrad = sCtx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.06,
      size * 0.5,
      size * 0.5,
      size * 0.56
    );
    heatGrad.addColorStop(0, 'rgba(255, 138, 35, 0.52)');
    heatGrad.addColorStop(0.55, 'rgba(220, 74, 18, 0.44)');
    heatGrad.addColorStop(0.88, 'rgba(92, 36, 18, 0.72)');
    heatGrad.addColorStop(1, 'rgba(42, 24, 18, 0.96)');
    sCtx.fillStyle = heatGrad;
    sCtx.fillRect(0, 0, size, size);

    // Glowing heated thermal-amber impact lattice (diamond + hex thermal grid)
    const cell = 34;
    sCtx.lineWidth = 3.0;
    for (let y = -cell; y < size + cell; y += cell) {
      for (let x = -cell; x < size + cell; x += cell) {
        const hot = ((x / cell + y / cell) & 3) === 0;
        sCtx.strokeStyle = hot ? 'rgba(255, 175, 65, 0.92)' : 'rgba(255, 102, 24, 0.68)';
        sCtx.beginPath();
        sCtx.moveTo(x, y);
        sCtx.lineTo(x + cell, y + cell);
        sCtx.moveTo(x + cell, y);
        sCtx.lineTo(x, y + cell);
        sCtx.stroke();
      }
    }

    // Welded heavy steel grid cage bars over the heated thermal lattice
    sCtx.strokeStyle = 'rgba(34, 26, 22, 0.94)';
    sCtx.lineWidth = 7;
    for (let g = 64; g < size; g += 64) {
      sCtx.beginPath();
      sCtx.moveTo(g, 0);
      sCtx.lineTo(g, size);
      sCtx.stroke();

      sCtx.beginPath();
      sCtx.moveTo(0, g);
      sCtx.lineTo(size, g);
      sCtx.stroke();
    }
    // Metallic rim highlights on steel cage intersections
    sCtx.strokeStyle = 'rgba(130, 104, 86, 0.65)';
    sCtx.lineWidth = 1.8;
    for (let g = 64; g < size; g += 64) {
      sCtx.beginPath();
      sCtx.moveTo(g - 3, 0);
      sCtx.lineTo(g - 3, size);
      sCtx.moveTo(0, g - 3);
      sCtx.lineTo(size, g - 3);
      sCtx.stroke();
    }

    // Diagonal hazard stripe steel perimeter bands (top, bottom, left, right)
    const band = 40;
    sCtx.save();
    sCtx.beginPath();
    sCtx.rect(0, 0, size, size);
    sCtx.rect(band, band, size - band * 2, size - band * 2);
    sCtx.clip('evenodd');

    sCtx.fillStyle = '#241d19';
    sCtx.fillRect(0, 0, size, size);
    sCtx.fillStyle = '#c26b14';
    for (let d = -size; d < size * 2; d += 38) {
      sCtx.beginPath();
      sCtx.moveTo(d, 0);
      sCtx.lineTo(d + 19, 0);
      sCtx.lineTo(d - size + 19, size);
      sCtx.lineTo(d - size, size);
      sCtx.closePath();
      sCtx.fill();
    }
    // Grime & soot over hazard border
    sCtx.fillStyle = 'rgba(28, 20, 16, 0.34)';
    sCtx.fillRect(0, 0, size, size);
    sCtx.restore();

    // Heavy welded steel perimeter frame + diagonal corner hazard rivets
    sCtx.strokeStyle = '#3b302a';
    sCtx.lineWidth = 12;
    sCtx.strokeRect(band, band, size - band * 2, size - band * 2);

    const frameRivets = [20, 84, 148, 212, 276, 340, 404, 468, 492];
    for (let i = 0; i < frameRivets.length; i++) {
      const p = frameRivets[i];
      const pts = [
        [p, 20],
        [p, size - 20],
        [20, p],
        [size - 20, p],
      ];
      for (let k = 0; k < pts.length; k++) {
        const [rx, ry] = pts[k];
        sCtx.beginPath();
        sCtx.arc(rx, ry, 5.5, 0, Math.PI * 2);
        sCtx.fillStyle = '#181210';
        sCtx.fill();
        sCtx.beginPath();
        sCtx.arc(rx - 1, ry - 1, 3.2, 0, Math.PI * 2);
        sCtx.fillStyle = '#8b7768';
        sCtx.fill();
      }
    }

    const blastShield = new THREE.CanvasTexture(shieldCanvas);
    blastShield.colorSpace = THREE.SRGBColorSpace;
    blastShield.wrapS = THREE.ClampToEdgeWrapping;
    blastShield.wrapT = THREE.ClampToEdgeWrapping;

    // 3. Glowing Furnace-Red Optical Scanner Grid Texture (256x128)
    const visorCanvas = document.createElement('canvas');
    visorCanvas.width = 256;
    visorCanvas.height = 128;
    const vCtx = visorCanvas.getContext('2d');
    vCtx.fillStyle = '#ff6b4a';
    vCtx.fillRect(0, 0, 256, 128);

    // Hot furnace center strip
    const vGrad = vCtx.createLinearGradient(0, 0, 0, 128);
    vGrad.addColorStop(0, '#a81c0e');
    vGrad.addColorStop(0.5, '#ffdfcf');
    vGrad.addColorStop(1, '#a81c0e');
    vCtx.fillStyle = vGrad;
    vCtx.fillRect(0, 0, 256, 128);

    // Dark armored aperture louver slits
    vCtx.fillStyle = 'rgba(38, 6, 2, 0.45)';
    for (let y = 0; y < 128; y += 8) {
      vCtx.fillRect(0, y, 256, 2);
    }
    vCtx.strokeStyle = 'rgba(42, 6, 2, 0.36)';
    vCtx.lineWidth = 2;
    for (let x = 0; x < 256; x += 22) {
      vCtx.beginPath();
      vCtx.moveTo(x, 0);
      vCtx.lineTo(x, 128);
      vCtx.stroke();
    }
    const visorGrid = new THREE.CanvasTexture(visorCanvas);
    visorGrid.colorSpace = THREE.SRGBColorSpace;
    visorGrid.wrapS = THREE.RepeatWrapping;
    visorGrid.wrapT = THREE.RepeatWrapping;

    // 4. Radial Grounded Contact Shadow Disc Texture (128x128)
    const shCanvas = document.createElement('canvas');
    shCanvas.width = 128;
    shCanvas.height = 128;
    const shCtx = shCanvas.getContext('2d');
    const shGrad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
    shGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    shGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.55)');
    shGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    shCtx.fillStyle = shGrad;
    shCtx.fillRect(0, 0, 128, 128);
    const contactShadow = new THREE.CanvasTexture(shCanvas);

    // 4b. Clean Neutral Hex-Grid Orbital Energy Shield Texture (512x512, zero orange tint)
    const hexCanvas = document.createElement('canvas');
    hexCanvas.width = size;
    hexCanvas.height = size;
    const hCtx = hexCanvas.getContext('2d');

    const hGrad = hCtx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.08,
      size * 0.5,
      size * 0.5,
      size * 0.58
    );
    hGrad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    hGrad.addColorStop(0.55, 'rgba(224, 246, 255, 0.48)');
    hGrad.addColorStop(0.88, 'rgba(180, 228, 255, 0.64)');
    hGrad.addColorStop(1, 'rgba(220, 244, 255, 0.92)');
    hCtx.fillStyle = hGrad;
    hCtx.fillRect(0, 0, size, size);

    const hexR = 26;
    const hexW = hexR * Math.sqrt(3);
    const hexH = hexR * 1.5;
    hCtx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    hCtx.lineWidth = 2.2;
    for (let row = -1; row < size / hexH + 2; row++) {
      for (let col = -1; col < size / hexW + 2; col++) {
        const cx = col * hexW + (row % 2 === 0 ? 0 : hexW * 0.5);
        const cy = row * hexH;
        hCtx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = (Math.PI / 3) * k - Math.PI / 6;
          const vx = cx + Math.cos(ang) * (hexR - 2);
          const vy = cy + Math.sin(ang) * (hexR - 2);
          if (k === 0) hCtx.moveTo(vx, vy);
          else hCtx.lineTo(vx, vy);
        }
        hCtx.closePath();
        hCtx.stroke();
      }
    }

    // Precision orbital emitter border & scan bands (white/silver luminance)
    hCtx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    hCtx.lineWidth = 8;
    hCtx.strokeRect(10, 10, size - 20, size - 20);
    hCtx.strokeStyle = 'rgba(210, 240, 255, 0.55)';
    hCtx.lineWidth = 2;
    hCtx.strokeRect(24, 24, size - 48, size - 48);

    const hexShield = new THREE.CanvasTexture(hexCanvas);
    hexShield.colorSpace = THREE.SRGBColorSpace;
    hexShield.wrapS = THREE.ClampToEdgeWrapping;
    hexShield.wrapT = THREE.ClampToEdgeWrapping;

    return {
      armorWear,
      armorBump,
      armorRoughness,
      blastShield,
      hexShield,
      visorGrid,
      contactShadow,
    };
  }

  /**
   * Retrieve or build & cache a shared BufferGeometry by key.
   * @private
   */
  _getGeo(key, builderFn) {
    let geo = this._geoCache.get(key);
    if (!geo) {
      geo = builderFn();
      this._geoCache.set(key, geo);
    }
    return geo;
  }

  /**
   * Build a centered beveled ExtrudeGeometry from a 2D polygon point list.
   * @private
   */
  _makeExtrudedPoly(key, points, depth, bevelThickness = 0.025, bevelSize = 0.02, bevelSegments = 2) {
    return this._getGeo(key, () => {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i][0], points[i][1]);
      }
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness,
        bevelSize,
        bevelSegments,
        curveSegments: 6,
      });
      geo.translate(0, 0, -depth * 0.5);
      geo.computeVertexNormals();
      return geo;
    });
  }

  /**
   * Build a cached LatheGeometry from [radius, y] pairs.
   * @private
   */
  _makeLathe(key, profilePairs, segments = 18) {
    return this._getGeo(key, () => {
      const pts = profilePairs.map(([r, y]) => new THREE.Vector2(r, y));
      const geo = new THREE.LatheGeometry(pts, segments);
      geo.computeVertexNormals();
      return geo;
    });
  }

  /**
   * Build a cached TubeGeometry from 3D control point triples.
   * @private
   */
  _makeTube(key, pointTriples, radius = 0.025, tubularSegments = 12, radialSegments = 7) {
    return this._getGeo(key, () => {
      const pts = pointTriples.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const curve = new THREE.CatmullRomCurve3(pts);
      return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    });
  }

  /**
   * Create per-enemy material palette sharing the procedural PBR maps.
   * Strictly MeshStandardMaterial — corroded iron, rusted plates, greased rubber,
   * steel pistons, and high-contrast furnace-red/amber weakpoints.
   * @private
   */
  _createPalette(archetype) {
    const { armorWear, armorBump, armorRoughness, visorGrid } = this._textures;

    const isAbyssOrbital =
      archetype.id === 'volatile_rusher' ||
      archetype.id === 'void_warper' ||
      archetype.id === 'void_swarmer' ||
      archetype.id === 'abyss_sentinel' ||
      archetype.id === 'transcendent_omega_boss';

    const isAegisOrbital =
      isAbyssOrbital ||
      archetype.id === 'interceptor_drone' ||
      archetype.id === 'shock_breacher' ||
      archetype.id === 'rail_warden' ||
      archetype.id === 'mortar_artillery' ||
      archetype.id === 'vanguard_assassin' ||
      archetype.id === 'aegis_overlord_boss';

    const primaryArmor = isAbyssOrbital
      ? new THREE.MeshStandardMaterial({
          color: 0x141028,
          metalness: 0.82,
          roughness: 0.22,
          emissive: new THREE.Color(0x160a2a),
          emissiveIntensity: 0.34,
        })
      : isAegisOrbital
      ? new THREE.MeshStandardMaterial({
          color: archetype.id === 'vanguard_assassin' ? 0x1e1b2e : 0xeaf2fb,
          metalness: 0.78,
          roughness: 0.20,
          emissive: new THREE.Color(archetype.id === 'vanguard_assassin' ? 0x1f0a28 : 0x0c243e),
          emissiveIntensity: 0.28,
        })
      : new THREE.MeshStandardMaterial({
          color: 0x6f6965,
          map: armorWear,
          metalness: 0.62,
          roughness: 0.42,
          bumpMap: armorBump,
          bumpScale: 0.052,
          roughnessMap: armorRoughness,
          emissive: new THREE.Color(0x1a1311),
          emissiveIntensity: 0.24,
        });

    const coloredPlate = isAegisOrbital
      ? new THREE.MeshStandardMaterial({
          color: archetype.color,
          metalness: 0.74,
          roughness: 0.22,
          emissive: new THREE.Color(archetype.color),
          emissiveIntensity: isAbyssOrbital ? 0.62 : 0.52,
        })
      : new THREE.MeshStandardMaterial({
          color: archetype.color,
          map: armorWear,
          metalness: 0.42,
          roughness: 0.48,
          bumpMap: armorBump,
          bumpScale: 0.036,
          roughnessMap: armorRoughness,
          emissive: new THREE.Color(archetype.color),
          emissiveIntensity: 0.28,
        });

    const darkFrame = isAbyssOrbital
      ? new THREE.MeshStandardMaterial({
          color: 0x090714,
          metalness: 0.90,
          roughness: 0.24,
          emissive: new THREE.Color(0x0c061c),
          emissiveIntensity: 0.18,
        })
      : isAegisOrbital
      ? new THREE.MeshStandardMaterial({
          color: 0x0b1222,
          metalness: 0.88,
          roughness: 0.26,
          emissive: new THREE.Color(0x06101f),
          emissiveIntensity: 0.15,
        })
      : new THREE.MeshStandardMaterial({
          color: 0x201b18,
          metalness: 0.78,
          roughness: 0.58,
          bumpMap: armorBump,
          bumpScale: 0.024,
          roughnessMap: armorRoughness,
          emissive: new THREE.Color(0x000000),
          emissiveIntensity: 0.0,
        });

    const pistonSteel = new THREE.MeshStandardMaterial({
      color:
        archetype.id === 'aegis_overlord_boss'
          ? 0xf59e0b
          : isAbyssOrbital
          ? 0xc4b5fd
          : isAegisOrbital
          ? 0xf1f5f9
          : 0xcbd5e1,
      metalness: 0.92,
      roughness: 0.20,
      emissive: new THREE.Color(
        archetype.id === 'aegis_overlord_boss'
          ? 0x4a2a00
          : isAbyssOrbital
          ? 0x241046
          : 0x000000
      ),
      emissiveIntensity: archetype.id === 'aegis_overlord_boss' ? 0.35 : isAbyssOrbital ? 0.24 : 0.0,
    });

    const cableMat = isAbyssOrbital
      ? new THREE.MeshStandardMaterial({
          color: 0x2e1065,
          metalness: 0.58,
          roughness: 0.32,
          emissive: new THREE.Color(archetype.accentColor),
          emissiveIntensity: 0.72,
        })
      : isAegisOrbital
      ? new THREE.MeshStandardMaterial({
          color: 0x164e63,
          metalness: 0.55,
          roughness: 0.35,
          emissive: new THREE.Color(archetype.accentColor),
          emissiveIntensity: 0.45,
        })
      : new THREE.MeshStandardMaterial({
          color: 0x2b231f,
          metalness: 0.22,
          roughness: 0.78,
          emissive: new THREE.Color(0x000000),
          emissiveIntensity: 0.0,
        });

    const accentGlow = new THREE.MeshStandardMaterial({
      color: archetype.accentColor,
      emissive: new THREE.Color(archetype.accentColor),
      emissiveIntensity: isAbyssOrbital ? 3.4 : isAegisOrbital ? 3.1 : 2.85,
      metalness: 0.15,
      roughness: 0.20,
      fog: false,
    });

    const opticColor = isAbyssOrbital
      ? archetype.id === 'volatile_rusher'
        ? 0xff2a6d
        : archetype.id === 'void_warper'
        ? 0xc084fc
        : archetype.id === 'void_swarmer'
        ? 0xd8b4fe
        : archetype.id === 'abyss_sentinel'
        ? 0x38bdf8
        : 0xe879f9
      : isAegisOrbital
      ? archetype.id === 'vanguard_assassin'
        ? 0xf43f5e
        : archetype.id === 'mortar_artillery'
        ? 0xe879f9
        : archetype.id === 'aegis_overlord_boss'
        ? 0xfbbf24
        : 0x00f0ff
      : archetype.id === 'tactical_trooper'
      ? 0xff3b14
      : 0xff220c;

    const weakpointGlow = new THREE.MeshStandardMaterial({
      color: isAegisOrbital ? 0xffffff : 0xffe4d6,
      map: visorGrid,
      emissive: new THREE.Color(opticColor),
      emissiveIntensity: isAegisOrbital ? 4.0 : 4.8,
      metalness: 0.1,
      roughness: 0.14,
      fog: false,
    });

    const holoEnergy = new THREE.MeshStandardMaterial({
      color: archetype.accentColor,
      emissive: new THREE.Color(archetype.accentColor),
      emissiveIntensity: isAbyssOrbital ? 3.0 : 2.6,
      metalness: 0.1,
      roughness: 0.15,
      transparent: true,
      opacity: 0.54,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });

    const flashMaterials = [
      primaryArmor,
      coloredPlate,
      darkFrame,
      pistonSteel,
      cableMat,
      accentGlow,
      weakpointGlow,
      holoEnergy,
    ];

    return {
      primaryArmor,
      coloredPlate,
      darkFrame,
      pistonSteel,
      cableMat,
      accentGlow,
      weakpointGlow,
      holoEnergy,
      flashMaterials,
    };
  }

  /**
   * Create diegetic floating world-space health bar mounted cleanly above enemy head.
   * @private
   */
  _createHealthBar(archetype, ownedMaterials) {
    const isHeavy =
      archetype.id === 'heavy_enforcer' ||
      archetype.id === 'rail_warden' ||
      archetype.id === 'mortar_artillery' ||
      archetype.id === 'abyss_sentinel';
    const barWidth = archetype.isBoss ? 2.25 : isHeavy ? 1.15 : 0.86;
    const barHeight = archetype.isBoss ? 0.16 : 0.085;

    const bgGeo = this._getGeo(`hp_bg_${archetype.id}`, () => {
      return new THREE.PlaneGeometry(barWidth + 0.07, barHeight + 0.055);
    });
    const fillGeo = this._getGeo(`hp_fill_${archetype.id}`, () => {
      const g = new THREE.PlaneGeometry(barWidth, barHeight);
      g.translate(barWidth * 0.5, 0, 0);
      return g;
    });

    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x120e0c,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const fillHex = isHeavy ? archetype.accentColor : archetype.color;
    const fillMat = new THREE.MeshBasicMaterial({
      color: fillHex,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    ownedMaterials.push(bgMat, fillMat);

    const healthBarBg = new THREE.Mesh(bgGeo, bgMat);
    healthBarBg.position.set(0, archetype.height + 0.34, 0);
    healthBarBg.visible = false;
    healthBarBg.renderOrder = 10;

    const healthBarFill = new THREE.Mesh(fillGeo, fillMat);
    healthBarFill.position.set(-barWidth * 0.5, 0, 0.004);
    healthBarFill.renderOrder = 11;
    healthBarBg.add(healthBarFill);

    return { healthBarBg, healthBarFill };
  }

  /**
   * Build a sculpted, articulated Feral Scrap-Machine rig for the requested archetype.
   * @param {import('../config/waves.js').ENEMY_ARCHETYPES[keyof typeof import('../config/waves.js').ENEMY_ARCHETYPES]} archetype
   */
  createEnemyRig(archetype) {
    const root = new THREE.Group();
    root.name = `enemy_${archetype.id}`;

    const bodyGroup = new THREE.Group();
    const headGroup = new THREE.Group();
    const headAnchor = new THREE.Object3D();
    const leftArm = new THREE.Group();
    const rightArm = new THREE.Group();
    const leftLeg = new THREE.Group();
    const rightLeg = new THREE.Group();
    const leftThigh = leftLeg;
    const rightThigh = rightLeg;
    const weaponMuzzle = new THREE.Object3D();
    let leftWeaponMuzzle = null;

    const rotors = [];
    const coreRings = [];
    const barrelSlides = [];
    const heatVents = [];
    const missilePods = [];
    const wingShieldFins = [];
    const stabilizers = [];
    let shieldMesh = null;
    let laserLine = null;
    let overloadRing = null;

    const palette = this._createPalette(archetype);
    const ownedMaterials = [...palette.flashMaterials];
    const ownedGeometries = [];

    const rig = {
      root,
      bodyGroup,
      pelvis: null,
      headGroup,
      headAnchor,
      leftThigh,
      leftShin: null,
      leftFoot: null,
      rightThigh,
      rightShin: null,
      rightFoot: null,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      weaponSlide: null,
      leftWeaponSlide: null,
      barrelSlides,
      shieldFrame: null,
      weaponMuzzle,
      leftWeaponMuzzle: null,
      heatVents,
      missilePods,
      wingCoreL: null,
      wingCoreR: null,
      wingShieldFins,
      coreShutter: null,
      stabilizers,
      shieldMesh: null,
      rotors,
      coreRings,
      laserLine: null,
      overloadRing: null,
      healthBarFill: null,
      healthBarBg: null,
      flashMaterials: palette.flashMaterials,
      dispose: null,
    };

    const buildCtx = (extras = null) => ({
      p: palette,
      ownedMaterials,
      bodyGroup,
      headGroup,
      headAnchor,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      leftThigh,
      rightThigh,
      weaponMuzzle,
      leftWeaponMuzzle,
      rotors,
      coreRings,
      barrelSlides,
      heatVents,
      missilePods,
      wingShieldFins,
      stabilizers,
      shieldMesh,
      rigRef: rig,
      ...(extras || {}),
    });

    root.add(bodyGroup);

    switch (archetype.id) {
      case 'rusher_drone':
        this._buildWithGlb(
          'rusher_drone',
          buildCtx(),
          () =>
            this._buildRusherDrone(
              palette,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              weaponMuzzle,
              rotors
            )
        );
        break;
      case 'tactical_trooper':
        this._buildWithGlb(
          'tactical_trooper',
          buildCtx(),
          () =>
            this._buildTacticalTrooper(
              palette,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle
            )
        );
        break;
      case 'heavy_enforcer':
        shieldMesh = this._createHeavyBlastShieldMesh(ownedMaterials);
        this._buildWithGlb(
          'heavy_enforcer',
          buildCtx({ shieldMesh }),
          () =>
            this._buildHeavyEnforcer(
              palette,
              ownedMaterials,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              shieldMesh
            )
        );
        break;
      case 'sniper_stalker':
        laserLine = this._createLaserBeam(ownedMaterials, ownedGeometries, root, 0xe62020, 0xffb3a0);
        this._buildWithGlb(
          'sniper_stalker',
          buildCtx(),
          () =>
            this._buildSniperStalker(
              palette,
              ownedMaterials,
              ownedGeometries,
              root,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle
            )
        );
        break;
      case 'cyber_mech_boss': {
        shieldMesh = this._createBossPhaseShieldMesh(ownedMaterials, bodyGroup);
        leftWeaponMuzzle = new THREE.Object3D();
        this._buildWithGlb(
          'cyber_mech_boss',
          buildCtx({ leftWeaponMuzzle, shieldMesh }),
          () =>
            this._buildLegacyCyberMechBoss(
              palette,
              ownedMaterials,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              leftWeaponMuzzle,
              rotors,
              coreRings,
              shieldMesh
            )
        );
        break;
      }
      case 'interceptor_drone':
        leftWeaponMuzzle = new THREE.Object3D();
        this._buildWithGlb(
          'interceptor_drone',
          buildCtx({ leftWeaponMuzzle }),
          () =>
            this._buildInterceptorDrone(
              palette,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              weaponMuzzle,
              rotors,
              leftWeaponMuzzle
            )
        );
        break;
      case 'shock_breacher':
        this._buildWithGlb(
          'shock_breacher',
          buildCtx(),
          () =>
            this._buildShockBreacher(
              palette,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle
            )
        );
        break;
      case 'rail_warden':
        shieldMesh = this._createRailWardenShieldMesh(ownedMaterials);
        laserLine = this._createLaserBeam(ownedMaterials, ownedGeometries, root, 0x00f0ff, 0xe0ffff);
        this._buildWithGlb(
          'rail_warden',
          buildCtx({ shieldMesh }),
          () =>
            this._buildRailWarden(
              palette,
              ownedMaterials,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              shieldMesh
            )
        );
        break;
      case 'mortar_artillery':
        this._buildWithGlb(
          'mortar_artillery',
          buildCtx(),
          () =>
            this._buildMortarArtillery(
              palette,
              ownedMaterials,
              ownedGeometries,
              root,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              true
            )
        );
        break;
      case 'vanguard_assassin':
        leftWeaponMuzzle = new THREE.Object3D();
        this._buildWithGlb(
          'vanguard_assassin',
          buildCtx({ leftWeaponMuzzle }),
          () =>
            this._buildVanguardAssassin(
              palette,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              leftWeaponMuzzle
            )
        );
        break;
      case 'aegis_overlord_boss': {
        shieldMesh = this._createOverlordPhaseShieldMesh(ownedMaterials, bodyGroup);
        leftWeaponMuzzle = new THREE.Object3D();
        this._buildWithGlb(
          'aegis_overlord_boss',
          buildCtx({ leftWeaponMuzzle, shieldMesh }),
          () =>
            this._buildAegisOverlordBoss(
              palette,
              ownedMaterials,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              rotors,
              coreRings,
              shieldMesh,
              leftWeaponMuzzle,
              rig
            )
        );
        break;
      }
      case 'volatile_rusher':
        overloadRing = this._createVolatileOverloadRing(ownedMaterials, root);
        this._buildWithGlb(
          'volatile_rusher',
          buildCtx(),
          () =>
            this._buildVolatileRusher(
              palette,
              ownedMaterials,
              root,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              coreRings,
              overloadRing
            )
        );
        break;
      case 'void_warper':
        leftWeaponMuzzle = new THREE.Object3D();
        leftWeaponMuzzle.position.set(0, -0.32, 0.56);
        leftArm.add(leftWeaponMuzzle);
        this._buildWithGlb(
          'void_warper',
          buildCtx({ leftWeaponMuzzle }),
          () =>
            this._buildVoidWarper(
              palette,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle
            )
        );
        break;
      case 'void_swarmer':
        laserLine = this._createLaserBeam(ownedMaterials, ownedGeometries, root, 0xa855f7, 0x38bdf8);
        this._buildWithGlb(
          'void_swarmer',
          buildCtx(),
          () =>
            this._buildVoidSwarmer(
              palette,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              weaponMuzzle,
              rotors
            )
        );
        break;
      case 'abyss_sentinel':
        shieldMesh = this._createAbyssSentinelShieldMesh(ownedMaterials);
        this._buildWithGlb(
          'abyss_sentinel',
          buildCtx({ shieldMesh }),
          () =>
            this._buildAbyssSentinel(
              palette,
              ownedMaterials,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              shieldMesh
            )
        );
        break;
      case 'transcendent_omega_boss': {
        shieldMesh = this._createOmegaTurretShieldMesh(ownedMaterials, bodyGroup);
        leftWeaponMuzzle = new THREE.Object3D();
        this._buildWithGlb(
          'transcendent_omega_boss',
          buildCtx({ leftWeaponMuzzle, shieldMesh }),
          () =>
            this._buildTranscendentOmegaBoss(
              palette,
              ownedMaterials,
              bodyGroup,
              headGroup,
              headAnchor,
              leftArm,
              rightArm,
              leftLeg,
              rightLeg,
              weaponMuzzle,
              rotors,
              coreRings,
              shieldMesh,
              leftWeaponMuzzle
            )
        );
        break;
      }
      default:
        this._buildTacticalTrooper(
          palette,
          bodyGroup,
          headGroup,
          headAnchor,
          leftArm,
          rightArm,
          leftLeg,
          rightLeg,
          weaponMuzzle
        );
        break;
    }

    // Grounded radial contact shadow disc for all ground-based enemies
    if (!archetype.isFlying) {
      const shadowGeo = this._getGeo('contact_shadow_disc', () => {
        const g = new THREE.CircleGeometry(1, 20);
        g.rotateX(-Math.PI * 0.5);
        return g;
      });
      const shadowRadius = archetype.isBoss
        ? archetype.id === 'transcendent_omega_boss'
          ? 2.85
          : archetype.id === 'aegis_overlord_boss'
          ? 2.55
          : 2.35
        : archetype.id === 'heavy_enforcer' ||
          archetype.id === 'rail_warden' ||
          archetype.id === 'abyss_sentinel'
        ? 1.18
        : archetype.id === 'mortar_artillery'
        ? 1.14
        : archetype.id === 'shock_breacher'
        ? 0.92
        : archetype.id === 'sniper_stalker' ||
          archetype.id === 'vanguard_assassin' ||
          archetype.id === 'void_warper' ||
          archetype.id === 'volatile_rusher'
        ? 0.72
        : 0.78;
      const shadowDisc = new THREE.Mesh(shadowGeo, this._contactShadowMat);
      shadowDisc.position.set(0, 0.03, 0);
      shadowDisc.scale.set(shadowRadius, 1, shadowRadius);
      shadowDisc.castShadow = false;
      shadowDisc.receiveShadow = false;
      shadowDisc.renderOrder = 1;
      root.add(shadowDisc);
    }

    // Cast & receive shadows cleanly across solid sculpted armor meshes
    root.traverse((obj) => {
      if (obj.isMesh && obj !== shieldMesh && obj !== overloadRing) {
        const mat = obj.material;
        if (mat && !mat.transparent) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      }
    });

    const { healthBarBg, healthBarFill } = this._createHealthBar(archetype, ownedMaterials);
    root.add(healthBarBg);

    // Store base emissive state on each flash material for zero-GC flash recovery & pool reset
    for (let i = 0; i < palette.flashMaterials.length; i++) {
      const m = palette.flashMaterials[i];
      m.userData.baseEmissive = m.emissive.clone();
      m.userData.baseEmissiveIntensity = m.emissiveIntensity;
    }

    const dispose = () => {
      bodyGroup.userData.disposed = true;
      for (let i = 0; i < ownedMaterials.length; i++) {
        ownedMaterials[i].dispose();
      }
      for (let i = 0; i < ownedGeometries.length; i++) {
        ownedGeometries[i].dispose();
      }
    };

    if (leftWeaponMuzzle && !rig.leftWeaponMuzzle) {
      rig.leftWeaponMuzzle = leftWeaponMuzzle;
    }
    rig.shieldMesh = shieldMesh;
    rig.laserLine = laserLine;
    rig.overloadRing = overloadRing;
    rig.healthBarFill = healthBarFill;
    rig.healthBarBg = healthBarBg;
    rig.resetPose = () => this.resetRigPose(rig);
    this._cacheAllRigRestPoses(rig);
    rig.dispose = dispose;

    return rig;
  }

  // ===========================================================================
  // 1. HUNTER-KILLER RAZOR DRONE (Swept Arrowhead Hull + Mandible Fangs + Tri-Optic)
  // ===========================================================================
  _buildRusherDrone(
    p,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    weaponMuzzle,
    rotors
  ) {
    bodyGroup.position.set(0, 0.55, 0);

    // Aggressive swept arrowhead armored hunter chassis
    const hullGeo = this._makeExtrudedPoly(
      'scavenger_hull_predator',
      [
        [-0.14, 0.36],
        [0.14, 0.36],
        [0.36, 0.08],
        [0.30, -0.26],
        [0.16, -0.38],
        [-0.16, -0.38],
        [-0.30, -0.26],
        [-0.36, 0.08],
      ],
      0.19,
      0.032,
      0.024,
      2
    );
    const hull = new THREE.Mesh(hullGeo, p.primaryArmor);
    hull.rotation.x = Math.PI * 0.5;
    hull.position.set(0, 0.05, 0);
    bodyGroup.add(hull);

    // Sloped dorsal armored predator carapace + glowing core intake vent
    const cowlGeo = this._makeExtrudedPoly(
      'scavenger_cowl_predator',
      [
        [-0.17, -0.26],
        [0.17, -0.26],
        [0.24, 0.10],
        [0.0, 0.36],
        [-0.24, 0.10],
      ],
      0.12,
      0.022,
      0.02,
      2
    );
    const cowl = new THREE.Mesh(cowlGeo, p.coloredPlate);
    cowl.rotation.x = Math.PI * 0.5;
    cowl.position.set(0, 0.17, -0.02);
    bodyGroup.add(cowl);

    // Swept Dorsal Razor Spine Fins
    const dorsalFinGeo = this._makeExtrudedPoly(
      'scavenger_dorsal_fin',
      [
        [-0.02, -0.02],
        [0.22, -0.04],
        [0.06, 0.24],
        [-0.08, 0.28],
      ],
      0.028,
      0.008,
      0.007,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const fin = new THREE.Mesh(dorsalFinGeo, p.darkFrame);
      fin.position.set(side * 0.14, 0.22, -0.10);
      fin.rotation.y = Math.PI * 0.5 + side * 0.18;
      fin.rotation.z = side * 0.22;
      bodyGroup.add(fin);
    }

    // Menacing Curved Predator Scythe-Mandibles flanking lower prow
    const fangGeo = this._makeExtrudedPoly(
      'scavenger_scythe_fang',
      [
        [-0.035, 0.0],
        [0.045, 0.0],
        [0.08, 0.22],
        [-0.02, 0.36],
        [-0.05, 0.16],
      ],
      0.045,
      0.01,
      0.009,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const mandible = new THREE.Mesh(fangGeo, p.pistonSteel);
      mandible.position.set(side * 0.21, -0.08, 0.22);
      mandible.rotation.x = Math.PI * 0.5 + 0.12;
      mandible.rotation.z = -side * 0.32;
      bodyGroup.add(mandible);
    }

    // Dual Angled Communications / Targeter Spikes
    for (let side = -1; side <= 1; side += 2) {
      const spike = new THREE.Mesh(
        this._getGeo('scavenger_antenna_spike', () => new THREE.ConeGeometry(0.022, 0.36, 6)),
        p.pistonSteel
      );
      spike.position.set(side * 0.20, 0.32, -0.22);
      spike.rotation.z = -side * 0.26;
      spike.rotation.x = -0.34;
      bodyGroup.add(spike);
    }

    // Quad LatheGeometry Ducted Industrial Turbofans on Aggressive Cant Outriggers
    const mainShroudGeo = this._makeLathe(
      'scavenger_shroud_main',
      [
        [0.16, -0.10],
        [0.22, -0.08],
        [0.24, 0.01],
        [0.21, 0.09],
        [0.15, 0.10],
        [0.14, 0.03],
        [0.14, -0.06],
        [0.16, -0.10],
      ],
      18
    );
    const smallShroudGeo = this._makeLathe(
      'scavenger_shroud_rear',
      [
        [0.115, -0.07],
        [0.155, -0.05],
        [0.165, 0.01],
        [0.145, 0.07],
        [0.105, 0.08],
        [0.095, -0.05],
        [0.115, -0.07],
      ],
      14
    );
    const bladeGeo = this._makeExtrudedPoly(
      'scavenger_blade',
      [
        [-0.14, -0.022],
        [0.14, -0.022],
        [0.12, 0.022],
        [-0.12, 0.022],
      ],
      0.014,
      0.004,
      0.004,
      1
    );
    const hubGeo = this._getGeo('scavenger_rotor_hub', () => new THREE.CylinderGeometry(0.038, 0.044, 0.09, 8));
    const emberRingGeo = this._getGeo('scavenger_heat_ring', () => new THREE.TorusGeometry(0.16, 0.014, 6, 16));

    const mountFan = (x, y, z, tiltZ, tiltX, isRear) => {
      const fanGroup = new THREE.Group();
      fanGroup.position.set(x, y, z);
      fanGroup.rotation.z = tiltZ;
      fanGroup.rotation.x = tiltX;

      fanGroup.add(new THREE.Mesh(isRear ? smallShroudGeo : mainShroudGeo, p.primaryArmor));

      if (!isRear) {
        const heatRing = new THREE.Mesh(emberRingGeo, p.accentGlow);
        heatRing.rotation.x = Math.PI * 0.5;
        heatRing.position.y = -0.055;
        fanGroup.add(heatRing);
      }

      const rotorPivot = new THREE.Group();
      rotorPivot.add(new THREE.Mesh(hubGeo, p.darkFrame));
      const bladeCount = isRear ? 2 : 3;
      const scale = isRear ? 0.68 : 1.0;
      for (let b = 0; b < bladeCount; b++) {
        const blade = new THREE.Mesh(bladeGeo, p.pistonSteel);
        blade.scale.set(scale, 1, 1);
        blade.rotation.x = Math.PI * 0.5;
        blade.rotation.z = (b / bladeCount) * Math.PI;
        rotorPivot.add(blade);
      }
      fanGroup.add(rotorPivot);
      rotors.push(rotorPivot);
      bodyGroup.add(fanGroup);
    };

    for (let side = -1; side <= 1; side += 2) {
      // Swept aggressive gunship tilt
      mountFan(side * 0.49, 0.05, 0.08, -side * 0.26, 0.16, false);
      mountFan(side * 0.36, 0.14, -0.30, -side * 0.30, 0.24, true);

      // Swept armored wing-spar strut + armored stabilizer tip
      bodyGroup.add(
        new THREE.Mesh(
          this._makeTube(
            `scavenger_strut_${side}`,
            [
              [side * 0.16, 0.06, 0.04],
              [side * 0.34, 0.08, 0.07],
              [side * 0.45, 0.05, 0.08],
            ],
            0.030,
            8,
            6
          ),
          p.darkFrame
        )
      );

      // Exposed hydraulic / power conduits
      bodyGroup.add(
        new THREE.Mesh(
          this._makeTube(
            `scavenger_wire_a_${side}`,
            [
              [side * 0.12, 0.11, 0.08],
              [side * 0.26, 0.20, -0.06],
              [side * 0.32, 0.12, -0.24],
            ],
            0.015,
            10,
            6
          ),
          p.cableMat
        )
      );
      bodyGroup.add(
        new THREE.Mesh(
          this._makeTube(
            `scavenger_wire_b_${side}`,
            [
              [side * 0.18, -0.02, -0.06],
              [side * 0.32, -0.10, 0.08],
              [side * 0.08, -0.14, 0.12],
            ],
            0.013,
            10,
            6
          ),
          p.cableMat
        )
      );
    }

    // Twin Blazing Rear Thruster Afterburner Nozzles + Central Radiator Core
    const mufflerGeo = this._makeLathe(
      'scavenger_exhaust',
      [
        [0.068, 0.0],
        [0.098, 0.04],
        [0.092, 0.22],
        [0.12, 0.26],
        [0.082, 0.26],
      ],
      12
    );
    for (let side = -1; side <= 1; side += 2) {
      const thr = new THREE.Mesh(mufflerGeo, p.darkFrame);
      thr.rotation.x = -Math.PI * 0.46;
      thr.position.set(side * 0.12, 0.04, -0.28);
      bodyGroup.add(thr);

      const core = new THREE.Mesh(
        this._getGeo('scavenger_ember', () => new THREE.CylinderGeometry(0.058, 0.058, 0.06, 8)),
        p.accentGlow
      );
      core.rotation.x = Math.PI * 0.5;
      core.position.set(side * 0.12, 0.02, -0.35);
      bodyGroup.add(core);
    }

    // Sinister Skull-Pod Tri-Optic Scanner Head (headGroup / headAnchor)
    headGroup.position.set(0, 0.02, 0.29);
    bodyGroup.add(headGroup);

    const skullCoreGeo = this._makeExtrudedPoly(
      'scavenger_skull_face',
      [
        [-0.22, 0.08],
        [-0.12, 0.18],
        [0.12, 0.18],
        [0.22, 0.08],
        [0.17, -0.14],
        [0.0, -0.18],
        [-0.17, -0.14],
      ],
      0.24,
      0.024,
      0.02,
      2
    );
    headGroup.add(new THREE.Mesh(skullCoreGeo, p.darkFrame));

    // Heavy frowning armored shutter brow hood (deep predatory V-brow)
    const shutterHoodGeo = this._makeExtrudedPoly(
      'scavenger_shutter_hood_v',
      [
        [-0.26, 0.02],
        [-0.18, 0.21],
        [0.0, 0.14],
        [0.18, 0.21],
        [0.26, 0.02],
        [0.14, 0.08],
        [0.0, 0.02],
        [-0.14, 0.08],
      ],
      0.19,
      0.02,
      0.016,
      1
    );
    const hood = new THREE.Mesh(shutterHoodGeo, p.coloredPlate);
    hood.position.set(0, 0.05, 0.05);
    headGroup.add(hood);

    // Central blazing crimson cyclops optic + twin fierce flanking micro-slit eyes
    const irIrisGeo = this._getGeo('scavenger_ir_iris', () => new THREE.SphereGeometry(0.115, 16, 12));
    const irIris = new THREE.Mesh(irIrisGeo, p.weakpointGlow);
    irIris.scale.set(1.15, 0.85, 0.68);
    irIris.position.set(0, 0.015, 0.105);
    headGroup.add(irIris);

    const sideEyeGeo = this._getGeo('scavenger_side_eye', () => new THREE.BoxGeometry(0.085, 0.028, 0.05));
    for (let side = -1; side <= 1; side += 2) {
      const se = new THREE.Mesh(sideEyeGeo, p.weakpointGlow);
      se.position.set(side * 0.135, 0.035, 0.105);
      se.rotation.z = side * 0.34;
      headGroup.add(se);
    }

    const irBezel = new THREE.Mesh(
      this._getGeo('scavenger_ir_bezel', () => new THREE.TorusGeometry(0.148, 0.018, 8, 18)),
      p.accentGlow
    );
    irBezel.position.set(0, 0.015, 0.115);
    headGroup.add(irBezel);

    // Glowing Crimson Jaw-Vent Teeth Bars under the Eye
    for (let t = -2; t <= 2; t++) {
      const fangBar = new THREE.Mesh(
        this._getGeo('scavenger_jaw_tooth', () => new THREE.BoxGeometry(0.018, 0.055, 0.04)),
        p.pistonSteel
      );
      fangBar.position.set(t * 0.046, -0.105, 0.125);
      headGroup.add(fangBar);
    }

    headAnchor.position.set(0, 0, 0.06);
    headGroup.add(headAnchor);

    // Under-slung Twin-Barrel Shredder Autocannon + Bayonet Blade (rightArm gimbal)
    rightArm.position.set(0, -0.19, 0.12);
    bodyGroup.add(rightArm);

    const gunBoxGeo = this._makeExtrudedPoly(
      'scavenger_gun_box',
      [
        [-0.095, -0.07],
        [0.095, -0.07],
        [0.105, 0.07],
        [-0.105, 0.07],
      ],
      0.34,
      0.016,
      0.014,
      1
    );
    rightArm.add(new THREE.Mesh(gunBoxGeo, p.darkFrame));

    const drumMag = new THREE.Mesh(
      this._getGeo('scavenger_ammo_drum', () => new THREE.CylinderGeometry(0.072, 0.072, 0.12, 10)),
      p.coloredPlate
    );
    drumMag.rotation.z = Math.PI * 0.5;
    drumMag.position.set(0.12, -0.02, 0.02);
    rightArm.add(drumMag);

    const autoBarrelGeo = this._makeLathe(
      'scavenger_auto_barrel',
      [
        [0.028, 0.0],
        [0.028, 0.18],
        [0.020, 0.20],
        [0.020, 0.38],
        [0.030, 0.40],
        [0.018, 0.45],
      ],
      10
    );
    for (let side = -1; side <= 1; side += 2) {
      const gunBarrel = new THREE.Mesh(autoBarrelGeo, p.pistonSteel);
      gunBarrel.rotation.x = Math.PI * 0.5;
      gunBarrel.position.set(side * 0.044, -0.005, 0.12);
      rightArm.add(gunBarrel);

      const hotCollar = new THREE.Mesh(
        this._getGeo('scavenger_hot_collar', () => new THREE.CylinderGeometry(0.028, 0.028, 0.10, 8)),
        p.accentGlow
      );
      hotCollar.rotation.x = Math.PI * 0.5;
      hotCollar.position.set(side * 0.044, -0.005, 0.30);
      rightArm.add(hotCollar);
    }

    // Underslung Serrated Assault Bayonet under Shredder Gun
    const bayoGeo = this._makeExtrudedPoly(
      'scavenger_bayonet',
      [
        [-0.01, -0.02],
        [0.24, 0.0],
        [0.06, -0.075],
        [-0.01, -0.05],
      ],
      0.016,
      0.003,
      0.003,
      1
    );
    const bayonet = new THREE.Mesh(bayoGeo, p.pistonSteel);
    bayonet.rotation.y = -Math.PI * 0.5;
    bayonet.position.set(0, -0.065, 0.28);
    rightArm.add(bayonet);

    weaponMuzzle.position.set(0, -0.005, 0.56);
    rightArm.add(weaponMuzzle);
    bodyGroup.add(leftArm);
  }

  // ===========================================================================
  // 2. RUST-WALKER TROOPER (Asymmetric Scrap Armor + Diesel Exhaust Pack + Red Optic)
  // ===========================================================================
  _buildTacticalTrooper(
    p,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle
  ) {
    // Exposed Piston Cyber-Legs (hip pivot at y = 0.94)
    const thighStrutGeo = this._makeExtrudedPoly(
      'rustwalker_thigh',
      [
        [-0.075, 0.02],
        [0.075, 0.02],
        [0.09, -0.20],
        [0.06, -0.42],
        [-0.06, -0.42],
        [-0.085, -0.20],
      ],
      0.13,
      0.018,
      0.016,
      2
    );
    const shinStrutGeo = this._makeExtrudedPoly(
      'rustwalker_shin',
      [
        [-0.06, 0.0],
        [0.065, 0.0],
        [0.055, -0.36],
        [0.045, -0.44],
        [-0.05, -0.44],
        [-0.068, -0.22],
      ],
      0.11,
      0.014,
      0.012,
      1
    );
    const pistonRodGeo = this._getGeo('rustwalker_piston_rod', () => new THREE.CylinderGeometry(0.022, 0.022, 0.38, 8));
    const pistonSleeveGeo = this._getGeo('rustwalker_piston_slv', () => new THREE.CylinderGeometry(0.036, 0.036, 0.22, 8));
    const kneeJointGeo = this._getGeo('rustwalker_knee_drum', () => new THREE.CylinderGeometry(0.065, 0.065, 0.14, 10));
    const bootGeo = this._makeExtrudedPoly(
      'rustwalker_boot',
      [
        [-0.085, -0.06],
        [0.085, -0.06],
        [0.095, 0.16],
        [0.06, 0.25],
        [-0.06, 0.25],
        [-0.095, 0.16],
      ],
      0.09,
      0.015,
      0.014,
      1
    );
    const legHoseGeo = this._makeTube(
      'rustwalker_leg_hose',
      [
        [0, -0.10, -0.08],
        [0, -0.38, -0.14],
        [0, -0.72, -0.07],
      ],
      0.018,
      8,
      6
    );

    const buildLeg = (legGroup, sideX, hasScrapPlate) => {
      legGroup.position.set(sideX, 0.94, 0);
      legGroup.add(new THREE.Mesh(thighStrutGeo, p.darkFrame));

      // Exposed front hydraulic thigh piston
      const thighPiston = new THREE.Mesh(pistonRodGeo, p.pistonSteel);
      thighPiston.position.set(0, -0.24, 0.068);
      legGroup.add(thighPiston);

      const knee = new THREE.Mesh(kneeJointGeo, p.primaryArmor);
      knee.rotation.z = Math.PI * 0.5;
      knee.position.set(0, -0.43, 0.02);
      legGroup.add(knee);

      const shin = new THREE.Mesh(shinStrutGeo, p.darkFrame);
      shin.position.set(0, -0.44, -0.01);
      legGroup.add(shin);

      // Exposed shin piston cylinder
      const shinSleeve = new THREE.Mesh(pistonSleeveGeo, p.pistonSteel);
      shinSleeve.position.set(sideX > 0 ? 0.05 : -0.05, -0.62, 0.03);
      legGroup.add(shinSleeve);

      // Asymmetric bolted shin plate + knee ram spike
      const kneeSpur = new THREE.Mesh(
        this._getGeo('rustwalker_knee_spur', () => new THREE.ConeGeometry(0.052, 0.14, 5)),
        p.coloredPlate
      );
      kneeSpur.rotation.x = Math.PI * 0.38;
      kneeSpur.position.set(0, -0.42, 0.105);
      legGroup.add(kneeSpur);

      if (hasScrapPlate) {
        const scrapShin = new THREE.Mesh(
          this._getGeo('rustwalker_scrap_shin', () => new THREE.BoxGeometry(0.115, 0.30, 0.05)),
          p.coloredPlate
        );
        scrapShin.position.set(0, -0.64, 0.074);
        legGroup.add(scrapShin);
      }

      const boot = new THREE.Mesh(bootGeo, p.primaryArmor);
      boot.rotation.x = Math.PI * 0.5;
      boot.position.set(0, -0.89, 0.05);
      legGroup.add(boot);

      legGroup.add(new THREE.Mesh(legHoseGeo, p.cableMat));
      bodyGroup.add(legGroup);
    };

    buildLeg(leftLeg, 0.17, true);
    buildLeg(rightLeg, -0.17, false);

    // Pelvis & Skeletal Piston Spine
    const pelvisGeo = this._makeExtrudedPoly(
      'rustwalker_pelvis',
      [
        [-0.22, 0.08],
        [0.22, 0.08],
        [0.16, -0.12],
        [-0.16, -0.12],
      ],
      0.22,
      0.022,
      0.018,
      2
    );
    const pelvis = new THREE.Mesh(pelvisGeo, p.darkFrame);
    pelvis.position.set(0, 0.96, 0);
    bodyGroup.add(pelvis);

    const spineCore = new THREE.Mesh(
      this._getGeo('rustwalker_waist', () => new THREE.CylinderGeometry(0.12, 0.15, 0.24, 8)),
      p.pistonSteel
    );
    spineCore.position.set(0, 1.10, 0);
    bodyGroup.add(spineCore);

    // Welded Angular Cast-Iron Chest Hull + Layered Predator Ribcage Plates
    const chestGeo = this._makeExtrudedPoly(
      'rustwalker_chest',
      [
        [-0.29, 0.23],
        [-0.15, 0.30],
        [0.15, 0.30],
        [0.29, 0.23],
        [0.23, -0.07],
        [0.16, -0.19],
        [-0.16, -0.19],
        [-0.23, -0.07],
      ],
      0.27,
      0.032,
      0.026,
      2
    );
    const chest = new THREE.Mesh(chestGeo, p.primaryArmor);
    chest.position.set(0, 1.32, 0.02);
    bodyGroup.add(chest);

    // Angled Twin Armored Pectoral Slabs framing Glowing Furnace-Core Sternum Slit
    const ribPlateGeo = this._makeExtrudedPoly(
      'rustwalker_rib_plate',
      [
        [-0.18, 0.13],
        [0.02, 0.06],
        [0.0, -0.10],
        [-0.15, -0.05],
      ],
      0.065,
      0.014,
      0.012,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const rp = new THREE.Mesh(ribPlateGeo, p.coloredPlate);
      rp.position.set(side * 0.12, 1.37, 0.165);
      rp.scale.x = side;
      bodyGroup.add(rp);
    }

    // Glowing Crimson Sternum Core + Exposed Chest Ribs
    const chestCoreV = new THREE.Mesh(
      this._getGeo('rustwalker_chest_core_v', () => new THREE.BoxGeometry(0.08, 0.19, 0.045)),
      p.weakpointGlow
    );
    chestCoreV.position.set(0, 1.34, 0.175);
    bodyGroup.add(chestCoreV);

    for (let r = 0; r < 3; r++) {
      const ribBar = new THREE.Mesh(
        this._getGeo('rustwalker_sternum_bar', () => new THREE.BoxGeometry(0.14, 0.024, 0.035)),
        p.darkFrame
      );
      ribBar.position.set(0, 1.40 - r * 0.055, 0.198);
      bodyGroup.add(ribBar);
    }

    // Jagged Dorsal Spine Fins rising behind Collar
    const dorsalBladeGeo = this._getGeo('rustwalker_dorsal_blade', () => new THREE.ConeGeometry(0.036, 0.18, 4));
    for (let side = -1; side <= 1; side += 2) {
      const collarSpike = new THREE.Mesh(dorsalBladeGeo, p.darkFrame);
      collarSpike.position.set(side * 0.18, 1.62, -0.08);
      collarSpike.rotation.x = -0.35;
      collarSpike.rotation.z = -side * 0.25;
      bodyGroup.add(collarSpike);
    }

    // Rear Diesel / Battery Pack + Vertical Exhaust Smoke Pipe + Fuel Hoses
    const packGeo = this._makeExtrudedPoly(
      'rustwalker_diesel_pack',
      [
        [-0.18, 0.20],
        [0.18, 0.20],
        [0.20, -0.08],
        [0.14, -0.22],
        [-0.14, -0.22],
        [-0.20, -0.08],
      ],
      0.18,
      0.022,
      0.018,
      2
    );
    const pack = new THREE.Mesh(packGeo, p.primaryArmor);
    pack.position.set(0, 1.34, -0.22);
    bodyGroup.add(pack);

    // Twin battery / diesel canisters on back
    const cellGeo = this._makeLathe(
      'rustwalker_cell_drum',
      [
        [0.048, 0.0],
        [0.066, 0.03],
        [0.066, 0.26],
        [0.048, 0.29],
      ],
      10
    );
    for (let side = -1; side <= 1; side += 2) {
      const cell = new THREE.Mesh(cellGeo, p.darkFrame);
      cell.position.set(side * 0.085, 1.18, -0.32);
      bodyGroup.add(cell);
    }

    const packGauge = new THREE.Mesh(
      this._getGeo('rustwalker_pack_gauge', () => new THREE.BoxGeometry(0.036, 0.16, 0.03)),
      p.accentGlow
    );
    packGauge.position.set(0, 1.33, -0.32);
    bodyGroup.add(packGauge);

    // Vertical exhaust smoke pipe rising off right shoulder of diesel pack
    const pipeGeo = this._makeLathe(
      'rustwalker_exhaust_pipe',
      [
        [0.032, 0.0],
        [0.032, 0.36],
        [0.046, 0.40],
        [0.042, 0.44],
        [0.028, 0.44],
      ],
      10
    );
    const exhaustPipe = new THREE.Mesh(pipeGeo, p.darkFrame);
    exhaustPipe.position.set(-0.14, 1.46, -0.26);
    exhaustPipe.rotation.x = -0.16;
    exhaustPipe.rotation.z = 0.08;
    bodyGroup.add(exhaustPipe);

    // Fuel hoses curving from diesel pack into torso/waist
    for (let side = -1; side <= 1; side += 2) {
      bodyGroup.add(
        new THREE.Mesh(
          this._makeTube(
            `rustwalker_fuel_hose_${side}`,
            [
              [side * 0.13, 1.45, -0.24],
              [side * 0.23, 1.34, -0.14],
              [side * 0.17, 1.15, -0.04],
            ],
            0.022,
            10,
            6
          ),
          p.cableMat
        )
      );
    }

    // Predatory Skull-Cowl Helmet with Slanted Furnace-Crimson Eyes & Respirator Teeth (headHeight = 1.62)
    headGroup.position.set(0, 1.62, 0.02);
    bodyGroup.add(headGroup);

    const neck = new THREE.Mesh(
      this._getGeo('rustwalker_neck', () => new THREE.CylinderGeometry(0.072, 0.095, 0.13, 8)),
      p.pistonSteel
    );
    neck.position.set(0, -0.10, 0);
    headGroup.add(neck);

    const helmGeo = this._makeExtrudedPoly(
      'rustwalker_skull_helm',
      [
        [-0.10, -0.12],
        [0.10, -0.12],
        [0.16, 0.02],
        [0.13, 0.16],
        [0, 0.21],
        [-0.13, 0.16],
        [-0.16, 0.02],
      ],
      0.26,
      0.028,
      0.022,
      2
    );
    headGroup.add(new THREE.Mesh(helmGeo, p.primaryArmor));

    // Aggressive V-angled Predator Brow Crown
    const vBrowGeo = this._makeExtrudedPoly(
      'rustwalker_v_brow',
      [
        [-0.175, 0.03],
        [-0.12, 0.17],
        [0, 0.11],
        [0.12, 0.17],
        [0.175, 0.03],
        [0, -0.02],
      ],
      0.16,
      0.016,
      0.014,
      1
    );
    const browPlate = new THREE.Mesh(vBrowGeo, p.coloredPlate);
    browPlate.position.set(0, 0.06, 0.075);
    headGroup.add(browPlate);

    // Twin Blazing Slanted Predator Optic Slits + Forehead Sensor Eye
    const eyeSlitGeo = this._getGeo('rustwalker_pred_eye', () => new THREE.BoxGeometry(0.088, 0.028, 0.055));
    for (let side = -1; side <= 1; side += 2) {
      const eye = new THREE.Mesh(eyeSlitGeo, p.weakpointGlow);
      eye.position.set(side * 0.068, 0.025, 0.135);
      eye.rotation.z = side * 0.30;
      headGroup.add(eye);
    }
    const thirdEye = new THREE.Mesh(
      this._getGeo('rustwalker_third_eye', () => new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8)),
      p.weakpointGlow
    );
    thirdEye.rotation.x = Math.PI * 0.5;
    thirdEye.position.set(0, 0.095, 0.145);
    headGroup.add(thirdEye);

    // Serrated Steel Jaw Mask & Vertical Fang Grille
    const jawMask = new THREE.Mesh(
      this._getGeo('rustwalker_jaw_mask', () => new THREE.BoxGeometry(0.17, 0.075, 0.12)),
      p.darkFrame
    );
    jawMask.position.set(0, -0.065, 0.105);
    headGroup.add(jawMask);
    for (let f = -2; f <= 2; f++) {
      const fang = new THREE.Mesh(
        this._getGeo('rustwalker_jaw_tooth', () => new THREE.BoxGeometry(0.016, 0.06, 0.03)),
        p.pistonSteel
      );
      fang.position.set(f * 0.032, -0.06, 0.162);
      headGroup.add(fang);
    }

    // Swept Razor Helmet Ear-Fins & Asymmetric Comms Antenna
    for (let side = -1; side <= 1; side += 2) {
      const earFin = new THREE.Mesh(
        this._getGeo('rustwalker_ear_fin', () => new THREE.BoxGeometry(0.02, 0.18, 0.07)),
        p.coloredPlate
      );
      earFin.position.set(side * 0.155, 0.10, -0.04);
      earFin.rotation.x = -0.52;
      earFin.rotation.z = -side * 0.18;
      headGroup.add(earFin);
    }

    headAnchor.position.set(0, 0.02, 0.02);
    headGroup.add(headAnchor);

    // Mismatched Rusty Pauldrons & Articulated Arms
    const bigPauldronGeo = this._makeExtrudedPoly(
      'rustwalker_pauldron_big',
      [
        [-0.12, 0.14],
        [0.12, 0.10],
        [0.16, -0.07],
        [0.04, -0.14],
        [-0.12, -0.06],
      ],
      0.24,
      0.022,
      0.018,
      2
    );
    const smallCapGeo = this._makeLathe(
      'rustwalker_pauldron_cap',
      [
        [0.02, 0.08],
        [0.12, 0.06],
        [0.15, -0.02],
        [0.12, -0.08],
      ],
      10
    );
    const upperArmGeo = this._getGeo('rustwalker_uarm', () => new THREE.CylinderGeometry(0.056, 0.048, 0.30, 8));
    const forearmGeo = this._getGeo('rustwalker_farm', () => new THREE.BoxGeometry(0.095, 0.28, 0.105));

    // Right Arm (Spiked War Pauldron + Heavy Hellfire Pulse Carbine + Bayonet)
    rightArm.position.set(-0.35, 1.45, 0.02);
    const rPauldron = new THREE.Mesh(bigPauldronGeo, p.coloredPlate);
    rPauldron.position.set(-0.04, 0.04, 0);
    rPauldron.rotation.z = 0.28;
    rightArm.add(rPauldron);

    const pSpikeGeo = this._getGeo('rustwalker_pauldron_spike', () => new THREE.ConeGeometry(0.028, 0.13, 5));
    for (let sp = 0; sp < 2; sp++) {
      const ps = new THREE.Mesh(pSpikeGeo, p.pistonSteel);
      ps.position.set(-0.10 - sp * 0.05, 0.12 - sp * 0.04, (sp - 0.5) * 0.10);
      ps.rotation.z = 0.55;
      rightArm.add(ps);
    }

    const rUpper = new THREE.Mesh(upperArmGeo, p.pistonSteel);
    rUpper.position.set(-0.02, -0.14, 0.06);
    rUpper.rotation.x = -0.45;
    rightArm.add(rUpper);

    const rFore = new THREE.Mesh(forearmGeo, p.primaryArmor);
    rFore.position.set(0.02, -0.22, 0.24);
    rFore.rotation.x = -1.32;
    rightArm.add(rFore);

    // Upgraded Heavy Hellfire Pulse Carbine with Vented Shroud, Coil & Bayonet
    const rifleGroup = new THREE.Group();
    rifleGroup.position.set(0.08, -0.21, 0.38);

    const receiverGeo = this._makeExtrudedPoly(
      'rustwalker_rifle_body',
      [
        [-0.046, -0.07],
        [0.046, -0.07],
        [0.052, 0.06],
        [-0.052, 0.06],
      ],
      0.60,
      0.014,
      0.012,
      1
    );
    rifleGroup.add(new THREE.Mesh(receiverGeo, p.darkFrame));

    const handguard = new THREE.Mesh(
      this._getGeo('rustwalker_rifle_guard', () => new THREE.BoxGeometry(0.072, 0.058, 0.38)),
      p.coloredPlate
    );
    handguard.position.set(0, 0.052, 0.10);
    rifleGroup.add(handguard);

    const heatCoil = new THREE.Mesh(
      this._getGeo('rustwalker_rifle_coil', () => new THREE.BoxGeometry(0.056, 0.026, 0.24)),
      p.accentGlow
    );
    heatCoil.position.set(0, 0.015, 0.28);
    rifleGroup.add(heatCoil);

    const rifleBarrelGeo = this._makeLathe(
      'rustwalker_rifle_barrel',
      [
        [0.026, 0.0],
        [0.026, 0.28],
        [0.038, 0.31],
        [0.038, 0.40],
        [0.022, 0.42],
      ],
      10
    );
    const rifleBarrel = new THREE.Mesh(rifleBarrelGeo, p.pistonSteel);
    rifleBarrel.rotation.x = Math.PI * 0.5;
    rifleBarrel.position.set(0, 0.015, 0.26);
    rifleGroup.add(rifleBarrel);

    const mag = new THREE.Mesh(
      this._getGeo('rustwalker_rifle_mag', () => new THREE.BoxGeometry(0.044, 0.19, 0.085)),
      p.primaryArmor
    );
    mag.position.set(0, -0.12, 0.08);
    mag.rotation.x = 0.28;
    rifleGroup.add(mag);

    const sight = new THREE.Mesh(
      this._getGeo('rustwalker_rifle_sight', () => new THREE.BoxGeometry(0.038, 0.048, 0.095)),
      p.weakpointGlow
    );
    sight.position.set(0, 0.095, -0.02);
    rifleGroup.add(sight);

    const rifleBayo = new THREE.Mesh(
      this._getGeo('rustwalker_rifle_bayo', () => new THREE.BoxGeometry(0.014, 0.045, 0.22)),
      p.pistonSteel
    );
    rifleBayo.position.set(0, -0.055, 0.50);
    rifleGroup.add(rifleBayo);

    weaponMuzzle.position.set(0, 0.015, 0.68);
    rifleGroup.add(weaponMuzzle);
    rightArm.add(rifleGroup);
    bodyGroup.add(rightArm);

    // Left Arm (Armored Pauldron + Support Hand with Forearm Trench-Claw Blades)
    leftArm.position.set(0.35, 1.45, 0.02);
    const lCap = new THREE.Mesh(bigPauldronGeo, p.primaryArmor);
    lCap.scale.set(-0.85, 0.85, 0.85);
    lCap.position.set(0.04, 0.04, 0);
    lCap.rotation.z = -0.32;
    leftArm.add(lCap);

    const lUpper = new THREE.Mesh(upperArmGeo, p.pistonSteel);
    lUpper.position.set(0.01, -0.13, 0.08);
    lUpper.rotation.x = -0.62;
    lUpper.rotation.z = -0.22;
    leftArm.add(lUpper);

    const lFore = new THREE.Mesh(forearmGeo, p.darkFrame);
    lFore.position.set(-0.12, -0.20, 0.30);
    lFore.rotation.x = -1.25;
    lFore.rotation.y = 0.52;
    leftArm.add(lFore);

    for (let c = -1; c <= 1; c += 2) {
      const wristClaw = new THREE.Mesh(
        this._getGeo('rustwalker_wrist_claw', () => new THREE.BoxGeometry(0.014, 0.036, 0.20)),
        p.pistonSteel
      );
      wristClaw.position.set(-0.12 + c * 0.028, -0.19, 0.44);
      leftArm.add(wristClaw);
    }
    bodyGroup.add(leftArm);
  }

  // ===========================================================================
  // 3. BULWARK JUGGERNAUT (2.35m Sloped Bunker-Torso + Welded Thermal-Amber Blast Shield)
  // ===========================================================================
  _buildHeavyEnforcer(
    p,
    ownedMaterials,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    sharedShieldMesh = null
  ) {
    // Heavy Demolition Legs (hip pivot at y = 1.08)
    const thighGeo = this._makeExtrudedPoly(
      'bulwark_thigh',
      [
        [-0.16, 0.06],
        [0.16, 0.06],
        [0.19, -0.22],
        [0.14, -0.48],
        [-0.14, -0.48],
        [-0.19, -0.22],
      ],
      0.28,
      0.032,
      0.026,
      2
    );
    const shinGeo = this._makeExtrudedPoly(
      'bulwark_shin',
      [
        [-0.15, 0.02],
        [0.15, 0.02],
        [0.18, -0.46],
        [0.14, -0.54],
        [-0.14, -0.54],
        [-0.18, -0.46],
      ],
      0.27,
      0.03,
      0.024,
      2
    );
    const footGeo = this._makeExtrudedPoly(
      'bulwark_foot',
      [
        [-0.17, -0.12],
        [0.17, -0.12],
        [0.20, 0.24],
        [0.11, 0.34],
        [-0.11, 0.34],
        [-0.20, 0.24],
      ],
      0.13,
      0.022,
      0.02,
      1
    );
    const calfPistonGeo = this._makeTube(
      'bulwark_calf_piston',
      [
        [0, -0.16, -0.16],
        [0, -0.52, -0.24],
        [0, -0.90, -0.15],
      ],
      0.036,
      10,
      7
    );

    const buildHeavyLeg = (legGroup, sideX) => {
      legGroup.position.set(sideX, 1.08, 0);
      legGroup.add(new THREE.Mesh(thighGeo, p.primaryArmor));

      const kneeDrum = new THREE.Mesh(
        this._getGeo('bulwark_knee', () => new THREE.CylinderGeometry(0.13, 0.14, 0.28, 10)),
        p.pistonSteel
      );
      kneeDrum.rotation.z = Math.PI * 0.5;
      kneeDrum.position.set(0, -0.48, 0.04);
      legGroup.add(kneeDrum);

      const kneeCap = new THREE.Mesh(
        this._getGeo('bulwark_knee_cap', () => new THREE.BoxGeometry(0.28, 0.22, 0.14)),
        p.coloredPlate
      );
      kneeCap.position.set(0, -0.48, 0.16);
      legGroup.add(kneeCap);

      const kneeRamSpike = new THREE.Mesh(
        this._getGeo('bulwark_knee_spike', () => new THREE.ConeGeometry(0.068, 0.20, 5)),
        p.pistonSteel
      );
      kneeRamSpike.rotation.x = Math.PI * 0.42;
      kneeRamSpike.position.set(0, -0.46, 0.26);
      legGroup.add(kneeRamSpike);

      const shin = new THREE.Mesh(shinGeo, p.darkFrame);
      shin.position.set(0, -0.50, 0);
      legGroup.add(shin);

      const foot = new THREE.Mesh(footGeo, p.primaryArmor);
      foot.rotation.x = Math.PI * 0.5;
      foot.position.set(0, -1.01, 0.06);
      legGroup.add(foot);

      legGroup.add(new THREE.Mesh(calfPistonGeo, p.cableMat));
      bodyGroup.add(legGroup);
    };

    buildHeavyLeg(leftLeg, 0.28);
    buildHeavyLeg(rightLeg, -0.28);

    // Armored Pelvis & Massive Furnace-Rib Siege Torso
    const pelvisGeo = this._makeExtrudedPoly(
      'bulwark_pelvis',
      [
        [-0.40, 0.15],
        [0.40, 0.15],
        [0.30, -0.20],
        [-0.30, -0.20],
      ],
      0.40,
      0.036,
      0.032,
      2
    );
    const pelvis = new THREE.Mesh(pelvisGeo, p.darkFrame);
    pelvis.position.set(0, 1.12, 0);
    bodyGroup.add(pelvis);

    const torsoGeo = this._makeExtrudedPoly(
      'bulwark_torso',
      [
        [-0.58, 0.44],
        [-0.34, 0.58],
        [0.34, 0.58],
        [0.58, 0.44],
        [0.48, -0.14],
        [0.34, -0.36],
        [-0.34, -0.36],
        [-0.48, -0.14],
      ],
      0.54,
      0.055,
      0.044,
      2
    );
    const torso = new THREE.Mesh(torsoGeo, p.primaryArmor);
    torso.position.set(0, 1.62, 0.02);
    bodyGroup.add(torso);

    // Dual Sloped Glacis Breastplates + Roaring Internal Chest Furnace Reactor Core
    const ribArmorGeo = this._makeExtrudedPoly(
      'bulwark_chest_flank',
      [
        [-0.24, 0.28],
        [0.06, 0.18],
        [0.04, -0.22],
        [-0.20, -0.14],
      ],
      0.16,
      0.028,
      0.022,
      2
    );
    for (let side = -1; side <= 1; side += 2) {
      const flank = new THREE.Mesh(ribArmorGeo, p.coloredPlate);
      flank.position.set(side * 0.28, 1.66, 0.30);
      flank.scale.x = side;
      bodyGroup.add(flank);
    }

    const chestReactor = new THREE.Mesh(
      this._getGeo('bulwark_chest_reactor', () => new THREE.CylinderGeometry(0.18, 0.20, 0.12, 12)),
      p.accentGlow
    );
    chestReactor.rotation.x = Math.PI * 0.5;
    chestReactor.position.set(0, 1.66, 0.31);
    bodyGroup.add(chestReactor);

    for (let i = 0; i < 4; i++) {
      const cageBar = new THREE.Mesh(
        this._getGeo('bulwark_chest_cage', () => new THREE.BoxGeometry(0.40, 0.036, 0.045)),
        p.darkFrame
      );
      cageBar.position.set(0, 1.79 - i * 0.09, 0.375);
      bodyGroup.add(cageBar);
    }

    // Towering Spiked Dreadnought Gorget & Shoulder Collar Towers (head open from front!)
    const collarGeo = this._makeExtrudedPoly(
      'bulwark_collar',
      [
        [-0.50, 0.0],
        [-0.38, 0.34],
        [0.38, 0.34],
        [0.50, 0.0],
        [0.30, 0.0],
        [0.24, 0.22],
        [-0.24, 0.22],
        [-0.30, 0.0],
      ],
      0.38,
      0.03,
      0.025,
      2
    );
    const collar = new THREE.Mesh(collarGeo, p.primaryArmor);
    collar.position.set(0, 1.94, -0.08);
    bodyGroup.add(collar);

    const hornSpikeGeo = this._getGeo('bulwark_collar_horn', () => new THREE.ConeGeometry(0.06, 0.28, 5));
    for (let side = -1; side <= 1; side += 2) {
      const cHorn = new THREE.Mesh(hornSpikeGeo, p.pistonSteel);
      cHorn.position.set(side * 0.42, 2.34, -0.06);
      cHorn.rotation.z = -side * 0.30;
      bodyGroup.add(cHorn);
    }

    // Dual Hydraulic Spine Pistons + Twin Blazing Furnace Exhaust Stacks
    const exhaustGeo = this._makeLathe(
      'bulwark_exhaust',
      [
        [0.065, 0.0],
        [0.105, 0.05],
        [0.098, 0.48],
        [0.125, 0.56],
        [0.08, 0.58],
      ],
      12
    );
    const spineCylGeo = this._getGeo('bulwark_spine_cyl', () => new THREE.CylinderGeometry(0.052, 0.052, 0.70, 8));
    for (let side = -1; side <= 1; side += 2) {
      const stack = new THREE.Mesh(exhaustGeo, p.darkFrame);
      stack.position.set(side * 0.27, 1.90, -0.34);
      stack.rotation.x = -0.24;
      bodyGroup.add(stack);

      const stackEmber = new THREE.Mesh(
        this._getGeo('bulwark_stack_ember', () => new THREE.CylinderGeometry(0.075, 0.075, 0.06, 8)),
        p.accentGlow
      );
      stackEmber.position.set(side * 0.27, 2.42, -0.47);
      stackEmber.rotation.x = -0.24;
      bodyGroup.add(stackEmber);

      const spinePiston = new THREE.Mesh(spineCylGeo, p.pistonSteel);
      spinePiston.position.set(side * 0.18, 1.62, -0.32);
      bodyGroup.add(spinePiston);

      const hose = new THREE.Mesh(
        this._makeTube(
          `bulwark_back_hose_${side}`,
          [
            [side * 0.28, 1.24, -0.34],
            [side * 0.37, 1.66, -0.44],
            [side * 0.28, 2.02, -0.24],
          ],
          0.036,
          10,
          7
        ),
        p.cableMat
      );
      bodyGroup.add(hose);
    }

    // Menacing Dreadnought Demon-Skull Helm & Slit Optics protruding over Collar (headHeight ~ 2.08)
    headGroup.position.set(0, 2.12, 0.18);
    bodyGroup.add(headGroup);

    const pillboxHelmGeo = this._makeExtrudedPoly(
      'bulwark_demon_helm',
      [
        [-0.17, -0.14],
        [0.17, -0.14],
        [0.23, 0.04],
        [0.16, 0.22],
        [0, 0.25],
        [-0.16, 0.22],
        [-0.23, 0.04],
      ],
      0.30,
      0.034,
      0.028,
      2
    );
    headGroup.add(new THREE.Mesh(pillboxHelmGeo, p.coloredPlate));

    // Frowning heavy anvil brow + twin angry red slit eyes + vertical teeth bars
    const browShield = new THREE.Mesh(
      this._getGeo('bulwark_brow_plate', () => new THREE.BoxGeometry(0.42, 0.072, 0.18)),
      p.darkFrame
    );
    browShield.position.set(0, 0.115, 0.12);
    browShield.rotation.x = 0.22;
    headGroup.add(browShield);

    const bullEyeGeo = this._getGeo('bulwark_demon_eye', () => new THREE.BoxGeometry(0.115, 0.040, 0.065));
    for (let side = -1; side <= 1; side += 2) {
      const eye = new THREE.Mesh(bullEyeGeo, p.weakpointGlow);
      eye.position.set(side * 0.088, 0.035, 0.168);
      eye.rotation.z = side * 0.26;
      headGroup.add(eye);

      const helmHorn = new THREE.Mesh(
        this._getGeo('bulwark_helm_horn', () => new THREE.ConeGeometry(0.042, 0.22, 5)),
        p.pistonSteel
      );
      helmHorn.position.set(side * 0.18, 0.22, 0.08);
      helmHorn.rotation.z = -side * 0.42;
      helmHorn.rotation.x = 0.30;
      headGroup.add(helmHorn);
    }

    for (let f = -2; f <= 2; f++) {
      const teethBar = new THREE.Mesh(
        this._getGeo('bulwark_teeth_bar', () => new THREE.BoxGeometry(0.024, 0.095, 0.045)),
        p.pistonSteel
      );
      teethBar.position.set(f * 0.046, -0.075, 0.168);
      headGroup.add(teethBar);
    }

    headAnchor.position.set(0, 0.04, 0.04);
    headGroup.add(headAnchor);

    // Massive Multi-Bevel Siege Shoulder Pauldrons
    const heavyPauldronGeo = this._makeExtrudedPoly(
      'bulwark_pauldron',
      [
        [-0.22, 0.22],
        [0.18, 0.16],
        [0.25, -0.14],
        [0.08, -0.24],
        [-0.20, -0.10],
      ],
      0.38,
      0.036,
      0.03,
      2
    );

    // Right Arm — Spiked Pauldron + Twin-Barrel Linked Siege Autocannon
    rightArm.position.set(-0.62, 1.84, 0.04);
    const rPauldron = new THREE.Mesh(heavyPauldronGeo, p.coloredPlate);
    rPauldron.position.set(-0.08, 0.08, 0);
    rightArm.add(rPauldron);

    const rPauldronSpike = new THREE.Mesh(
      this._getGeo('bulwark_p_spike', () => new THREE.ConeGeometry(0.05, 0.24, 5)),
      p.pistonSteel
    );
    rPauldronSpike.position.set(-0.18, 0.26, 0.04);
    rPauldronSpike.rotation.z = 0.56;
    rightArm.add(rPauldronSpike);

    const rArmPiston = new THREE.Mesh(
      this._getGeo('bulwark_arm_core', () => new THREE.CylinderGeometry(0.11, 0.10, 0.44, 8)),
      p.pistonSteel
    );
    rArmPiston.position.set(-0.04, -0.22, 0.08);
    rArmPiston.rotation.x = -0.35;
    rightArm.add(rArmPiston);

    const cannonGroup = new THREE.Group();
    cannonGroup.position.set(-0.02, -0.34, 0.34);

    const breechGeo = this._makeExtrudedPoly(
      'bulwark_cannon_breech',
      [
        [-0.14, -0.14],
        [0.14, -0.14],
        [0.17, 0.14],
        [-0.17, 0.14],
      ],
      0.60,
      0.024,
      0.02,
      2
    );
    cannonGroup.add(new THREE.Mesh(breechGeo, p.primaryArmor));

    const cannonBarrelGeo = this._makeLathe(
      'bulwark_cannon_twin_barrel',
      [
        [0.056, 0.0],
        [0.060, 0.14],
        [0.046, 0.16],
        [0.046, 0.50],
        [0.074, 0.56],
        [0.064, 0.64],
        [0.038, 0.62],
      ],
      12
    );
    for (let side = -1; side <= 1; side += 2) {
      const barrel = new THREE.Mesh(cannonBarrelGeo, p.darkFrame);
      barrel.rotation.x = Math.PI * 0.5;
      barrel.position.set(side * 0.072, 0.02, 0.26);
      cannonGroup.add(barrel);
    }

    // Heated amber barrel cooling ribs + Under-barrel Siege Bayonet
    const heatRingGeo = this._getGeo('bulwark_cannon_heat', () => new THREE.TorusGeometry(0.125, 0.018, 8, 16));
    for (let c = 0; c < 3; c++) {
      const ring = new THREE.Mesh(heatRingGeo, p.accentGlow);
      ring.position.set(0, 0.02, 0.38 + c * 0.14);
      cannonGroup.add(ring);
    }

    const siegeBlade = new THREE.Mesh(
      this._getGeo('bulwark_cannon_blade', () => new THREE.BoxGeometry(0.032, 0.08, 0.42)),
      p.pistonSteel
    );
    siegeBlade.position.set(0, -0.12, 0.62);
    cannonGroup.add(siegeBlade);

    cannonGroup.add(
      new THREE.Mesh(
        this._makeTube(
          'bulwark_cannon_feed',
          [
            [0.08, 0.08, -0.18],
            [0.24, 0.28, -0.36],
            [0.34, 0.42, -0.52],
          ],
          0.036,
          10,
          6
        ),
        p.cableMat
      )
    );

    weaponMuzzle.position.set(0, 0.02, 0.94);
    cannonGroup.add(weaponMuzzle);
    rightArm.add(cannonGroup);
    bodyGroup.add(rightArm);

    // Left Arm — Spiked Pauldron + Molten-Slag Crimson Ram Siege Shield
    leftArm.position.set(0.62, 1.84, 0.06);
    const lPauldron = new THREE.Mesh(heavyPauldronGeo, p.coloredPlate);
    lPauldron.position.set(0.08, 0.08, 0);
    lPauldron.scale.x = -1;
    leftArm.add(lPauldron);

    const lPauldronSpike = new THREE.Mesh(
      this._getGeo('bulwark_p_spike', () => new THREE.ConeGeometry(0.05, 0.24, 5)),
      p.pistonSteel
    );
    lPauldronSpike.position.set(0.18, 0.26, 0.04);
    lPauldronSpike.rotation.z = -0.56;
    leftArm.add(lPauldronSpike);

    const lArmCore = new THREE.Mesh(
      this._getGeo('bulwark_arm_core', () => new THREE.CylinderGeometry(0.11, 0.10, 0.44, 8)),
      p.pistonSteel
    );
    lArmCore.position.set(0.02, -0.22, 0.16);
    lArmCore.rotation.x = -0.68;
    leftArm.add(lArmCore);

    // Heavy Ram-Bastion Frame leaving head cleanly exposed for weakpoint shots!
    const shieldPivot = new THREE.Group();
    shieldPivot.position.set(-0.22, -0.50, 0.62);
    shieldPivot.rotation.y = -0.22;

    const bumperBarGeo = this._makeExtrudedPoly(
      'bulwark_shield_bumper',
      [
        [-0.50, -0.07],
        [0.50, -0.07],
        [0.42, 0.07],
        [-0.42, 0.07],
      ],
      0.12,
      0.02,
      0.016,
      1
    );
    const topBumper = new THREE.Mesh(bumperBarGeo, p.primaryArmor);
    topBumper.position.set(0, 0.64, -0.02);
    shieldPivot.add(topBumper);
    const botBumper = new THREE.Mesh(bumperBarGeo, p.primaryArmor);
    botBumper.position.set(0, -0.64, -0.02);
    shieldPivot.add(botBumper);

    // Serrated Steel Ram-Spikes protruding from Shield Front & Sides
    const ramToothGeo = this._getGeo('bulwark_shield_ram_spike', () => new THREE.ConeGeometry(0.048, 0.22, 4));
    for (let st = -1; st <= 1; st++) {
      const topTooth = new THREE.Mesh(ramToothGeo, p.pistonSteel);
      topTooth.rotation.x = Math.PI * 0.48;
      topTooth.position.set(st * 0.28, 0.66, 0.12);
      shieldPivot.add(topTooth);

      const botTooth = new THREE.Mesh(ramToothGeo, p.pistonSteel);
      botTooth.rotation.x = Math.PI * 0.52;
      botTooth.position.set(st * 0.28, -0.66, 0.12);
      shieldPivot.add(botTooth);
    }

    const sideFrameGeo = this._getGeo('bulwark_shield_post', () => new THREE.BoxGeometry(0.10, 1.32, 0.11));
    for (let s = -1; s <= 1; s += 2) {
      const post = new THREE.Mesh(sideFrameGeo, p.darkFrame);
      post.position.set(s * 0.50, 0, -0.02);
      shieldPivot.add(post);
    }

    const shieldMesh = sharedShieldMesh || this._createHeavyBlastShieldMesh(ownedMaterials);
    shieldMesh.renderOrder = 6;
    shieldPivot.add(shieldMesh);

    leftArm.add(shieldPivot);
    bodyGroup.add(leftArm);

    return shieldMesh;
  }

  // ===========================================================================
  // 4. DEADEYE RECON (Gaunt Sniper Walker + Tattered Shroud Fins + Crimson Laser)
  // ===========================================================================
  _buildSniperStalker(
    p,
    ownedMaterials,
    ownedGeometries,
    root,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle
  ) {
    // Gaunt Digitigrade Recon Legs (hip pivot at y = 0.98)
    const thighGeo = this._makeExtrudedPoly(
      'deadeye_thigh',
      [
        [-0.065, 0.02],
        [0.065, 0.02],
        [0.078, -0.22],
        [0.048, -0.46],
        [-0.048, -0.46],
        [-0.068, -0.22],
      ],
      0.12,
      0.016,
      0.014,
      2
    );
    const shinStrutGeo = this._makeExtrudedPoly(
      'deadeye_shin',
      [
        [-0.05, 0.02],
        [0.05, 0.02],
        [0.04, -0.46],
        [0.024, -0.52],
        [-0.024, -0.52],
        [-0.048, -0.26],
      ],
      0.10,
      0.012,
      0.01,
      1
    );
    const tendonGeo = this._makeTube(
      'deadeye_leg_tendon',
      [
        [0, -0.14, -0.06],
        [0, -0.46, -0.14],
        [0, -0.82, -0.04],
      ],
      0.015,
      10,
      6
    );

    const buildReconLeg = (legGroup, sideX) => {
      legGroup.position.set(sideX, 0.98, 0);
      const thigh = new THREE.Mesh(thighGeo, p.primaryArmor);
      thigh.rotation.x = -0.14;
      legGroup.add(thigh);

      const kneeSpur = new THREE.Mesh(
        this._getGeo('deadeye_knee_spur', () => new THREE.ConeGeometry(0.04, 0.16, 4)),
        p.pistonSteel
      );
      kneeSpur.rotation.x = Math.PI * 0.35;
      kneeSpur.position.set(0, -0.42, 0.09);
      legGroup.add(kneeSpur);

      const shin = new THREE.Mesh(shinStrutGeo, p.darkFrame);
      shin.position.set(0, -0.44, 0.03);
      shin.rotation.x = 0.14;
      legGroup.add(shin);

      const piston = new THREE.Mesh(
        this._getGeo('deadeye_leg_piston', () => new THREE.CylinderGeometry(0.016, 0.016, 0.40, 6)),
        p.pistonSteel
      );
      piston.position.set(0, -0.66, -0.02);
      legGroup.add(piston);

      for (let t = -1; t <= 1; t += 2) {
        const footClaw = new THREE.Mesh(
          this._getGeo('deadeye_foot_talon', () => new THREE.BoxGeometry(0.036, 0.055, 0.26)),
          p.coloredPlate
        );
        footClaw.position.set(t * 0.036, -0.945, 0.07);
        footClaw.rotation.y = -t * 0.14;
        legGroup.add(footClaw);
      }

      legGroup.add(new THREE.Mesh(tendonGeo, p.cableMat));
      bodyGroup.add(legGroup);
    };

    buildReconLeg(leftLeg, 0.145);
    buildReconLeg(rightLeg, -0.145);

    // Gaunt Skeletal Ribcage Torso + Dorsal Hunter-Blade Rack
    const torsoGeo = this._makeExtrudedPoly(
      'deadeye_torso',
      [
        [-0.22, 0.27],
        [0.22, 0.27],
        [0.16, -0.04],
        [0.095, -0.26],
        [-0.095, -0.26],
        [-0.16, -0.04],
      ],
      0.20,
      0.024,
      0.02,
      2
    );
    const torso = new THREE.Mesh(torsoGeo, p.primaryArmor);
    torso.position.set(0, 1.32, 0);
    bodyGroup.add(torso);

    // Glowing furnace-crimson spine & chest core battery cells
    const spineStrip = new THREE.Mesh(
      this._getGeo('deadeye_spine_strip', () => new THREE.BoxGeometry(0.04, 0.42, 0.04)),
      p.weakpointGlow
    );
    spineStrip.position.set(0, 1.34, -0.125);
    bodyGroup.add(spineStrip);

    const chestEye = new THREE.Mesh(
      this._getGeo('deadeye_chest_core', () => new THREE.BoxGeometry(0.11, 0.04, 0.05)),
      p.accentGlow
    );
    chestEye.position.set(0, 1.38, 0.11);
    bodyGroup.add(chestEye);

    // 4 Towering Segmented Dorsal Hunter-Spines / Blade Tendrils curving over shoulders
    const dorsalBladeFinGeo = this._makeExtrudedPoly(
      'deadeye_dorsal_blade_fin',
      [
        [-0.03, 0.0],
        [0.05, 0.0],
        [0.14, 0.36],
        [0.03, 0.62],
        [-0.02, 0.34],
      ],
      0.026,
      0.008,
      0.007,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      for (let tier = 0; tier < 2; tier++) {
        const blade = new THREE.Mesh(dorsalBladeFinGeo, tier === 0 ? p.darkFrame : p.coloredPlate);
        blade.position.set(side * (0.14 + tier * 0.11), 1.48 - tier * 0.12, -0.12 - tier * 0.04);
        blade.rotation.z = -side * (0.28 + tier * 0.24);
        blade.rotation.x = -0.20 - tier * 0.14;
        bodyGroup.add(blade);
      }
    }

    // Jagged Stalker Shroud Plates framing Shoulders
    const shroudLargeGeo = this._makeExtrudedPoly(
      'deadeye_shroud_large',
      [
        [0.0, 0.18],
        [0.38, 0.36],
        [0.46, -0.06],
        [0.28, -0.24],
        [0.36, -0.46],
        [0.14, -0.64],
        [0.06, -0.36],
        [-0.04, -0.18],
      ],
      0.034,
      0.009,
      0.008,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const shroud = new THREE.Mesh(shroudLargeGeo, side > 0 ? p.coloredPlate : p.darkFrame);
      shroud.position.set(side * 0.14, 1.44, -0.11);
      shroud.scale.x = side;
      shroud.rotation.y = -side * 0.34;
      shroud.rotation.x = 0.16;
      bodyGroup.add(shroud);
    }

    // Dorsal Recon Rangefinder Antenna Spire
    const spire = new THREE.Mesh(
      this._getGeo('deadeye_spire', () => new THREE.CylinderGeometry(0.008, 0.022, 0.46, 6)),
      p.pistonSteel
    );
    spire.position.set(0.16, 1.78, -0.16);
    spire.rotation.x = -0.22;
    bodyGroup.add(spire);

    const spireTip = new THREE.Mesh(
      this._getGeo('deadeye_spire_tip', () => new THREE.SphereGeometry(0.026, 8, 6)),
      p.weakpointGlow
    );
    spireTip.position.set(0.16, 1.99, -0.21);
    bodyGroup.add(spireTip);

    // Nightmarish Narrow Predator Skull Cranium + 4 Asymmetric Arachnid Eyes (headHeight = 1.68)
    headGroup.position.set(0, 1.68, 0.03);
    bodyGroup.add(headGroup);

    const maskGeo = this._makeExtrudedPoly(
      'deadeye_stalker_cranium',
      [
        [0, -0.15],
        [0.14, 0.02],
        [0.12, 0.16],
        [0, 0.22],
        [-0.12, 0.16],
        [-0.14, 0.02],
      ],
      0.28,
      0.022,
      0.018,
      2
    );
    headGroup.add(new THREE.Mesh(maskGeo, p.darkFrame));

    // Sloped armored brow hood curving aggressively back
    const craniumCrest = new THREE.Mesh(
      this._getGeo('deadeye_cranium_crest', () => new THREE.BoxGeometry(0.16, 0.09, 0.36)),
      p.coloredPlate
    );
    craniumCrest.position.set(0, 0.15, -0.02);
    craniumCrest.rotation.x = 0.28;
    headGroup.add(craniumCrest);

    // 4 Protruding Arachnid Telescopic Crimson Optics (asymmetrical unsettling cluster)
    const scopeTubeGeo = this._makeLathe(
      'deadeye_optic_tube',
      [
        [0.028, -0.02],
        [0.046, 0.0],
        [0.048, 0.075],
        [0.038, 0.085],
      ],
      12
    );
    const lensCapGeo = this._getGeo('deadeye_optic_lens', () => new THREE.CylinderGeometry(0.036, 0.036, 0.02, 12));
    const lensPositions = [
      [0.018, 0.072, 0.12, 1.15],
      [-0.068, 0.015, 0.115, 0.86],
      [0.072, -0.022, 0.115, 0.92],
      [-0.048, -0.055, 0.112, 0.68],
    ];
    for (let i = 0; i < lensPositions.length; i++) {
      const [lx, ly, lz, sc] = lensPositions[i];
      const tube = new THREE.Mesh(scopeTubeGeo, p.pistonSteel);
      tube.rotation.x = Math.PI * 0.5;
      tube.position.set(lx, ly, lz);
      tube.scale.set(sc, 1, sc);
      headGroup.add(tube);

      const lens = new THREE.Mesh(lensCapGeo, p.weakpointGlow);
      lens.rotation.x = Math.PI * 0.5;
      lens.position.set(lx, ly, lz + 0.078);
      lens.scale.set(sc, 1, sc);
      headGroup.add(lens);
    }

    // Swept Dual Long Predator Ear-Blades
    for (let side = -1; side <= 1; side += 2) {
      const ear = new THREE.Mesh(
        this._getGeo('deadeye_ear', () => new THREE.BoxGeometry(0.022, 0.34, 0.06)),
        p.coloredPlate
      );
      ear.position.set(side * 0.12, 0.18, -0.10);
      ear.rotation.x = -0.68;
      ear.rotation.z = -side * 0.26;
      headGroup.add(ear);
    }

    headAnchor.position.set(0, 0.02, 0.02);
    headGroup.add(headAnchor);

    // Arms & Elongated Twin-Bar Anti-Materiel Rifle
    rightArm.position.set(-0.27, 1.46, 0.02);
    const armGeo = this._getGeo('deadeye_arm', () => new THREE.CylinderGeometry(0.042, 0.036, 0.34, 8));
    const rUpper = new THREE.Mesh(armGeo, p.pistonSteel);
    rUpper.position.set(0, -0.14, 0.08);
    rUpper.rotation.x = -0.6;
    rightArm.add(rUpper);

    const rifle = new THREE.Group();
    rifle.position.set(0.06, -0.14, 0.44);

    const stockGeo = this._makeExtrudedPoly(
      'deadeye_rifle_stock',
      [
        [-0.036, -0.065],
        [0.036, -0.065],
        [0.044, 0.05],
        [-0.044, 0.05],
      ],
      0.54,
      0.012,
      0.01,
      1
    );
    rifle.add(new THREE.Mesh(stockGeo, p.primaryArmor));

    // Twin elongated parallel anti-materiel magnetic rail-lance (1.22m!)
    const railGeo = this._makeExtrudedPoly(
      'deadeye_rail_bar',
      [
        [-0.019, -0.02],
        [0.019, -0.02],
        [0.014, 0.02],
        [-0.014, 0.02],
      ],
      1.22,
      0.005,
      0.005,
      1
    );
    const upperRail = new THREE.Mesh(railGeo, p.darkFrame);
    upperRail.position.set(0, 0.038, 0.72);
    rifle.add(upperRail);
    const lowerRail = new THREE.Mesh(railGeo, p.darkFrame);
    lowerRail.position.set(0, -0.024, 0.72);
    rifle.add(lowerRail);

    // Heated crimson inner magnetic accelerator tube + 4 glowing accelerator rings
    const coreBarrel = new THREE.Mesh(
      this._getGeo('deadeye_inner_barrel', () => new THREE.CylinderGeometry(0.014, 0.014, 1.16, 8)),
      p.accentGlow
    );
    coreBarrel.rotation.x = Math.PI * 0.5;
    coreBarrel.position.set(0, 0.008, 0.70);
    rifle.add(coreBarrel);

    const coilRingGeo = this._getGeo('deadeye_rail_coil', () => new THREE.TorusGeometry(0.044, 0.009, 6, 12));
    for (let rc = 0; rc < 4; rc++) {
      const cr = new THREE.Mesh(coilRingGeo, p.weakpointGlow);
      cr.position.set(0, 0.008, 0.36 + rc * 0.24);
      rifle.add(cr);
    }

    const recoilSpike = new THREE.Mesh(
      this._getGeo('deadeye_muzzle_spike', () => new THREE.ConeGeometry(0.02, 0.24, 4)),
      p.pistonSteel
    );
    recoilSpike.rotation.x = Math.PI * 0.5;
    recoilSpike.position.set(0, -0.052, 1.18);
    rifle.add(recoilSpike);

    // Heavy LatheGeometry telescopic rangefinder scope
    const scopeGeo = this._makeLathe(
      'deadeye_scope',
      [
        [0.024, 0.0],
        [0.028, 0.06],
        [0.02, 0.08],
        [0.02, 0.24],
        [0.035, 0.28],
        [0.035, 0.36],
        [0.026, 0.36],
      ],
      12
    );
    const scope = new THREE.Mesh(scopeGeo, p.coloredPlate);
    scope.rotation.x = Math.PI * 0.5;
    scope.position.set(0, 0.085, -0.04);
    rifle.add(scope);

    rifle.add(
      new THREE.Mesh(
        this._makeTube(
          'deadeye_rifle_hose',
          [
            [0.02, -0.05, 0.04],
            [0.12, -0.22, -0.14],
            [0.08, -0.32, -0.34],
          ],
          0.014,
          10,
          6
        ),
        p.cableMat
      )
    );

    weaponMuzzle.position.set(0, 0.008, 1.20);
    rifle.add(weaponMuzzle);
    rightArm.add(rifle);
    bodyGroup.add(rightArm);

    leftArm.position.set(0.27, 1.46, 0.02);
    const lUpper = new THREE.Mesh(armGeo, p.pistonSteel);
    lUpper.position.set(-0.08, -0.14, 0.22);
    lUpper.rotation.x = -1.1;
    lUpper.rotation.z = -0.38;
    leftArm.add(lUpper);
    bodyGroup.add(leftArm);

    // Active Visible Crimson Targeting Laser Beam (unit-length along +Z from z=0 to z=1)
    const outerBeamGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.0, 8, 1, true);
    outerBeamGeo.rotateX(Math.PI * 0.5);
    outerBeamGeo.translate(0, 0, 0.5);
    ownedGeometries.push(outerBeamGeo);

    const innerBeamGeo = new THREE.CylinderGeometry(0.006, 0.006, 1.0, 6, 1, true);
    innerBeamGeo.rotateX(Math.PI * 0.5);
    innerBeamGeo.translate(0, 0, 0.5);
    ownedGeometries.push(innerBeamGeo);

    const outerLaserMat = new THREE.MeshBasicMaterial({
      color: 0xe62020,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const innerLaserMat = new THREE.MeshBasicMaterial({
      color: 0xffb3a0,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    ownedMaterials.push(outerLaserMat, innerLaserMat);

    const laserLine = new THREE.Mesh(outerBeamGeo, outerLaserMat);
    const innerCore = new THREE.Mesh(innerBeamGeo, innerLaserMat);
    laserLine.add(innerCore);
    laserLine.visible = false;
    laserLine.frustumCulled = false;
    laserLine.renderOrder = 8;
    root.add(laserLine);

    return laserLine;
  }

  _createEnergyShieldMesh(
    ownedMaterials,
    { geoKey, geoFn, color, emissive, emissiveIntensity = 1.65, opacity = 0.85, baseOpacity, renderOrder = 6, parent = null, position = null, mapKey = 'blastShield' }
  ) {
    const shieldGeo = this._getGeo(geoKey, geoFn);
    const shieldTex = this._textures[mapKey] || this._textures.blastShield;
    const shieldMat = new THREE.MeshStandardMaterial({
      color,
      map: shieldTex,
      emissive: new THREE.Color(emissive),
      emissiveMap: shieldTex,
      emissiveIntensity,
      transparent: true,
      opacity,
      roughness: 0.36,
      metalness: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    shieldMat.userData.baseColor = shieldMat.color.clone();
    shieldMat.userData.baseEmissive = shieldMat.emissive.clone();
    shieldMat.userData.baseEmissiveIntensity = shieldMat.emissiveIntensity;
    shieldMat.userData.baseOpacity = baseOpacity !== undefined ? baseOpacity : opacity;
    ownedMaterials.push(shieldMat);

    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.castShadow = false;
    shieldMesh.receiveShadow = false;
    shieldMesh.renderOrder = renderOrder;
    if (position) shieldMesh.position.set(position[0], position[1], position[2]);
    if (opacity === 0.0) shieldMesh.visible = false;
    if (parent) parent.add(shieldMesh);
    return shieldMesh;
  }

  _createHeavyBlastShieldMesh(ownedMaterials) {
    const isGlb = EnemyModelFactory._glbCache.has('heavy_enforcer');
    return this._createEnergyShieldMesh(ownedMaterials, {
      geoKey: isGlb ? 'bulwark_blast_shield_compact' : 'bulwark_blast_shield',
      geoFn: () => {
        if (isGlb) {
          const geo = new THREE.CylinderGeometry(0.86, 0.86, 0.70, 16, 1, true, -0.34, 0.68);
          geo.translate(0, -0.02, -0.80);
          return geo;
        }
        const geo = new THREE.CylinderGeometry(1.15, 1.15, 1.24, 18, 1, true, -0.44, 0.88);
        geo.translate(0, 0, -1.06);
        return geo;
      },
      color: 0xff5a1f,
      emissive: 0xd9300e,
      emissiveIntensity: 1.55,
      opacity: 0.88,
      baseOpacity: 0.88,
      renderOrder: 6,
    });
  }

  _createRailWardenShieldMesh(ownedMaterials) {
    return this._createEnergyShieldMesh(ownedMaterials, {
      geoKey: 'warden_blast_shield_quad',
      geoFn: () => {
        const geo = new THREE.CylinderGeometry(0.95, 1.00, 0.80, 18, 1, true, -0.58, 1.16);
        geo.translate(0, 0, -0.96);
        return geo;
      },
      color: 0x22d3ee,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.85,
      opacity: 0.74,
      baseOpacity: 0.74,
      renderOrder: 6,
      mapKey: 'hexShield',
    });
  }

  _createAbyssSentinelShieldMesh(ownedMaterials) {
    return this._createEnergyShieldMesh(ownedMaterials, {
      geoKey: 'sentinel_shield_hex_ward',
      geoFn: () => {
        const geo = new THREE.CylinderGeometry(0.96, 1.02, 1.02, 6, 1, true, -0.58, 1.16);
        geo.translate(0, 0, -0.97);
        return geo;
      },
      color: 0x8b5cf6,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.75,
      opacity: 0.72,
      baseOpacity: 0.72,
      renderOrder: 6,
      mapKey: 'hexShield',
    });
  }

  _createOverlordPhaseShieldMesh(ownedMaterials, bodyGroup) {
    return this._createEnergyShieldMesh(ownedMaterials, {
      geoKey: 'overlord_phase_shield_v2',
      geoFn: () => new THREE.CylinderGeometry(1.62, 1.72, 2.25, 24, 1, true),
      color: 0x22d3ee,
      emissive: 0x00d8ff,
      emissiveIntensity: 2.15,
      opacity: 0.0,
      baseOpacity: 0.70,
      renderOrder: 7,
      parent: bodyGroup,
      position: [0, 2.04, 0.04],
      mapKey: 'hexShield',
    });
  }

  _createOmegaTurretShieldMesh(ownedMaterials, bodyGroup) {
    return this._createEnergyShieldMesh(ownedMaterials, {
      geoKey: 'omega_turret_shield',
      geoFn: () => new THREE.CylinderGeometry(2.12, 2.2, 3.1, 24, 1, true),
      color: 0xa855f7,
      emissive: 0x7c3aed,
      emissiveIntensity: 2.1,
      opacity: 0.0,
      baseOpacity: 0.62,
      renderOrder: 7,
      parent: bodyGroup,
      position: [0, 2.55, 0.04],
      mapKey: 'hexShield',
    });
  }

  _createVolatileOverloadRing(ownedMaterials, root) {
    const ringGeo = this._getGeo('vol_overload_ring', () => {
      const g = new THREE.RingGeometry(0.84, 1.0, 36);
      g.rotateX(-Math.PI * 0.5);
      return g;
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff2a6d,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    ownedMaterials.push(ringMat);
    const overloadRing = new THREE.Mesh(ringGeo, ringMat);
    overloadRing.position.set(0, 0.08, 0);
    overloadRing.visible = false;
    overloadRing.renderOrder = 8;
    root.add(overloadRing);
    return overloadRing;
  }

  _cachePivotRestPose(obj) {
    if (!obj) return;
    if (!obj.userData.basePosition) obj.userData.basePosition = obj.position.clone();
    else obj.userData.basePosition.copy(obj.position);
    if (!obj.userData.baseRotation) obj.userData.baseRotation = obj.rotation.clone();
    else obj.userData.baseRotation.copy(obj.rotation);
    if (!obj.userData.baseScale) obj.userData.baseScale = obj.scale.clone();
    else obj.userData.baseScale.copy(obj.scale);
  }

  _cacheAllRigRestPoses(rig) {
    if (!rig) return;
    const singleKeys = [
      'bodyGroup',
      'pelvis',
      'headGroup',
      'leftArm',
      'rightArm',
      'leftThigh',
      'leftShin',
      'leftFoot',
      'rightThigh',
      'rightShin',
      'rightFoot',
      'weaponSlide',
      'leftWeaponSlide',
      'shieldFrame',
      'coreShutter',
      'wingCoreL',
      'wingCoreR',
    ];
    for (let i = 0; i < singleKeys.length; i++) {
      this._cachePivotRestPose(rig[singleKeys[i]]);
    }
    const arrayKeys = [
      'barrelSlides',
      'heatVents',
      'missilePods',
      'wingShieldFins',
      'stabilizers',
      'rotors',
      'coreRings',
    ];
    for (let k = 0; k < arrayKeys.length; k++) {
      const arr = rig[arrayKeys[k]];
      if (!arr) continue;
      for (let j = 0; j < arr.length; j++) {
        this._cachePivotRestPose(arr[j]);
      }
    }
  }

  _restorePivotRestPose(obj) {
    if (!obj) return;
    if (obj.userData.basePosition) obj.position.copy(obj.userData.basePosition);
    if (obj.userData.baseRotation) obj.rotation.copy(obj.userData.baseRotation);
    if (obj.userData.baseScale) obj.scale.copy(obj.userData.baseScale);
  }

  resetRigPose(rig) {
    if (!rig) return;
    const singleKeys = [
      'bodyGroup',
      'pelvis',
      'headGroup',
      'leftArm',
      'rightArm',
      'leftThigh',
      'leftShin',
      'leftFoot',
      'rightThigh',
      'rightShin',
      'rightFoot',
      'weaponSlide',
      'leftWeaponSlide',
      'shieldFrame',
      'coreShutter',
      'wingCoreL',
      'wingCoreR',
    ];
    for (let i = 0; i < singleKeys.length; i++) {
      this._restorePivotRestPose(rig[singleKeys[i]]);
    }
    const arrayKeys = [
      'barrelSlides',
      'heatVents',
      'missilePods',
      'wingShieldFins',
      'stabilizers',
      'rotors',
      'coreRings',
    ];
    for (let k = 0; k < arrayKeys.length; k++) {
      const arr = rig[arrayKeys[k]];
      if (!arr) continue;
      for (let j = 0; j < arr.length; j++) {
        this._restorePivotRestPose(arr[j]);
      }
    }
  }

  _findGlbPivot(rootObj, names) {
    if (!rootObj) return null;
    for (let i = 0; i < names.length; i++) {
      const hit = rootObj.getObjectByName(names[i]);
      if (hit) return hit;
    }
    return null;
  }

  _collectGlbPivots(rootObj, exactNames, pattern, outArr) {
    if (!rootObj || !outArr) return outArr;
    const seen = new Set(outArr);
    for (let i = 0; i < exactNames.length; i++) {
      const hit = rootObj.getObjectByName(exactNames[i]);
      if (hit && !hit.isMesh && !seen.has(hit)) {
        seen.add(hit);
        outArr.push(hit);
      }
    }
    if (pattern) {
      rootObj.traverse((node) => {
        if (!node.isMesh && node.name && pattern.test(node.name) && !seen.has(node)) {
          seen.add(node);
          outArr.push(node);
        }
      });
    }
    return outArr;
  }

  _mountGlbRig(archetypeId, templateScene, ctx) {
    const {
      p,
      ownedMaterials,
      bodyGroup,
      headGroup,
      headAnchor,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      leftThigh = leftLeg,
      rightThigh = rightLeg,
      weaponMuzzle,
      leftWeaponMuzzle,
      rotors,
      coreRings,
      barrelSlides,
      heatVents,
      missilePods,
      wingShieldFins,
      stabilizers,
      shieldMesh,
      rigRef,
    } = ctx;

    const gltfRoot = templateScene.clone(true);
    const clonedMatMap = new Map();
    const detailMaps = EnemyModelFactory._getSharedMechanicalDetailMaps();
    // Replace unused procedural fallback palette entries in flashMaterials with the mounted GLB materials
    p.flashMaterials.length = 0;

    const cloneAndEnhanceMaterial = (srcMat, hasUv) => {
      if (!srcMat) return srcMat;
      const cacheKey = `${srcMat.uuid}:${hasUv ? 1 : 0}`;
      let cloned = clonedMatMap.get(cacheKey);
      if (!cloned) {
        cloned = srcMat.clone();

        const matName = (cloned.name || '').toLowerCase();
        const emissiveSum = cloned.emissive
          ? (cloned.emissive.r + cloned.emissive.g + cloned.emissive.b) *
            (cloned.emissiveIntensity ?? 1)
          : 0;
        const isEmissiveMat =
          Boolean(cloned.emissiveMap) ||
          emissiveSum > 0.08 ||
          /(optic|glow|core|visor|emissive|flame|plasma|laser|holo|energy|shield)/i.test(matName);

        if (!cloned.emissive) cloned.emissive = new THREE.Color(0x000000);
        if (cloned.emissiveIntensity === undefined || cloned.emissiveIntensity === null) {
          cloned.emissiveIntensity = 0;
        }
        cloned.userData.baseColor = cloned.color ? cloned.color.clone() : new THREE.Color(0xffffff);
        cloned.userData.baseEmissive = cloned.emissive.clone();
        cloned.userData.baseEmissiveIntensity = cloned.emissiveIntensity;

        const colorLuma = cloned.color
          ? cloned.color.r * 0.299 + cloned.color.g * 0.587 + cloned.color.b * 0.114
          : 1.0;
        const isArmorOrMetal =
          Boolean(cloned.isMeshStandardMaterial) &&
          !isEmissiveMat &&
          !cloned.transparent &&
          ((cloned.metalness !== undefined && cloned.metalness >= 0.15) ||
            colorLuma < 0.58 ||
            /(armor|metal|steel|frame|chassis|plate|titan|iron|brass|dark|obsidian|gun|barrel|hull|shell|carapace)/i.test(
              matName
            ));

        if (hasUv && isArmorOrMetal && detailMaps) {
          let modified = false;
          if (!cloned.normalMap && detailMaps.normalMap) {
            cloned.normalMap = detailMaps.normalMap;
            if (cloned.normalScale) {
              cloned.normalScale.set(0.55, 0.55);
            } else {
              cloned.normalScale = new THREE.Vector2(0.55, 0.55);
            }
            modified = true;
          }
          if (!cloned.roughnessMap && detailMaps.roughnessMap) {
            cloned.roughnessMap = detailMaps.roughnessMap;
            modified = true;
          }
          if (modified) {
            cloned.needsUpdate = true;
          }
        }

        clonedMatMap.set(cacheKey, cloned);
        ownedMaterials.push(cloned);
        if (!/wingcore/i.test(matName)) {
          p.flashMaterials.push(cloned);
        }
      }
      return cloned;
    };

    gltfRoot.traverse((obj) => {
      if (!obj.isMesh) return;
      const hasUv = Boolean(obj.geometry && obj.geometry.attributes && obj.geometry.attributes.uv);
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => cloneAndEnhanceMaterial(m, hasUv));
      } else if (obj.material) {
        obj.material = cloneAndEnhanceMaterial(obj.material, hasUv);
      }
      const firstMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      const isTransparent = Boolean(firstMat && firstMat.transparent);
      obj.castShadow = !isTransparent;
      obj.receiveShadow = !isTransparent;
    });

    const glbBody = this._findGlbPivot(gltfRoot, ['BodyGroup', 'bodyGroup']) || gltfRoot;
    const transferNamedPivot = (candidateNames, targetGroup) => {
      if (!targetGroup) return null;
      const node = this._findGlbPivot(glbBody, candidateNames);
      if (!node) return null;
      targetGroup.position.copy(node.position);
      targetGroup.rotation.copy(node.rotation);
      targetGroup.scale.copy(node.scale);
      while (node.children.length > 0) {
        targetGroup.add(node.children[0]);
      }
      const origParent = node.parent;
      if (origParent) origParent.remove(node);
      if (origParent && origParent !== glbBody && origParent !== gltfRoot) {
        origParent.add(targetGroup);
      } else if (targetGroup.parent !== bodyGroup) {
        bodyGroup.add(targetGroup);
      }
      return targetGroup;
    };

    transferNamedPivot(['HeadGroup', 'headGroup'], headGroup);
    const glbHeadAnchor =
      this._findGlbPivot(headGroup, ['HeadAnchor', 'headAnchor']) ||
      this._findGlbPivot(glbBody, ['HeadAnchor', 'headAnchor']);
    if (glbHeadAnchor) {
      headAnchor.position.copy(glbHeadAnchor.position);
      const anchorParent = glbHeadAnchor.parent;
      if (anchorParent) anchorParent.remove(glbHeadAnchor);
      if (anchorParent && anchorParent !== glbBody && anchorParent !== gltfRoot) {
        anchorParent.add(headAnchor);
      } else if (headAnchor.parent !== headGroup) {
        headGroup.add(headAnchor);
      }
    } else {
      headAnchor.position.set(0, 0.04, 0.06);
      if (headAnchor.parent !== headGroup) headGroup.add(headAnchor);
    }

    transferNamedPivot(['LeftThigh', 'LeftLeg', 'leftThigh', 'leftLeg'], leftThigh);
    transferNamedPivot(['RightThigh', 'RightLeg', 'rightThigh', 'rightLeg'], rightThigh);
    transferNamedPivot(['LeftArm', 'leftArm'], leftArm);
    transferNamedPivot(['RightArm', 'rightArm'], rightArm);

    if (archetypeId === 'rusher_drone') {
      bodyGroup.position.set(0, 0.55, 0);
    } else if (archetypeId === 'interceptor_drone') {
      bodyGroup.position.set(0, 0.62, 0);
    } else if (archetypeId === 'void_swarmer') {
      bodyGroup.position.set(0, 0.56, 0);
    }

    bodyGroup.add(glbBody);

    const glbMuzzleR =
      this._findGlbPivot(rightArm, ['WeaponMuzzleR', 'WeaponMuzzle_R', 'WeaponMuzzle']) ||
      this._findGlbPivot(bodyGroup, ['WeaponMuzzleR', 'WeaponMuzzle_R', 'WeaponMuzzle']);
    if (glbMuzzleR) {
      weaponMuzzle.position.copy(glbMuzzleR.position);
      weaponMuzzle.rotation.copy(glbMuzzleR.rotation);
      const muzzleParent = glbMuzzleR.parent || rightArm;
      if (glbMuzzleR.parent) glbMuzzleR.parent.remove(glbMuzzleR);
      muzzleParent.add(weaponMuzzle);
    } else if (weaponMuzzle.parent !== rightArm) {
      rightArm.add(weaponMuzzle);
    }

    const glbMuzzleL =
      this._findGlbPivot(leftArm, ['WeaponMuzzleL', 'WeaponMuzzle_L', 'LeftWeaponMuzzle']) ||
      this._findGlbPivot(bodyGroup, ['WeaponMuzzleL', 'WeaponMuzzle_L', 'LeftWeaponMuzzle']);
    const resolvedLeftMuzzle = leftWeaponMuzzle || (glbMuzzleL ? new THREE.Object3D() : null);
    if (resolvedLeftMuzzle) {
      if (glbMuzzleL) {
        resolvedLeftMuzzle.position.copy(glbMuzzleL.position);
        resolvedLeftMuzzle.rotation.copy(glbMuzzleL.rotation);
        const muzzleLParent = glbMuzzleL.parent || leftArm;
        if (glbMuzzleL.parent) glbMuzzleL.parent.remove(glbMuzzleL);
        muzzleLParent.add(resolvedLeftMuzzle);
      } else if (resolvedLeftMuzzle.parent !== leftArm) {
        leftArm.add(resolvedLeftMuzzle);
      }
    }

    if (archetypeId === 'mortar_artillery' && rightArm && rightArm.children.length > 0) {
      // Mortar GLB WeaponSlide is modeled at ~-0.665 rad (-38.1 deg) rest elevation inside RightArm,
      // while EnemyAI drives rightArm.rotation.x to -0.26 (idle) / -0.64 (telegraph).
      // Compensate +0.26 rad so idle aligns to the sculpted GLB pose and telegraph elevates cleanly.
      const pitchAlign = new THREE.Group();
      pitchAlign.name = 'MortarPitchAlign';
      pitchAlign.rotation.x = 0.26;
      while (rightArm.children.length > 0) {
        pitchAlign.add(rightArm.children[0]);
      }
      rightArm.add(pitchAlign);
    }

    // Recursively bind standardized articulation & gimmick pivots across the mounted rig
    const pelvis = this._findGlbPivot(bodyGroup, ['Pelvis', 'pelvis', 'PelvisGroup']);
    const leftShin =
      this._findGlbPivot(leftThigh, ['LeftShin', 'LeftKnee', 'Shin_L']) ||
      this._findGlbPivot(bodyGroup, ['LeftShin', 'Shin_L']);
    const leftFoot =
      this._findGlbPivot(leftThigh, ['LeftFoot', 'Foot_L']) ||
      this._findGlbPivot(bodyGroup, ['LeftFoot', 'Foot_L']);
    const rightShin =
      this._findGlbPivot(rightThigh, ['RightShin', 'RightKnee', 'Shin_R']) ||
      this._findGlbPivot(bodyGroup, ['RightShin', 'Shin_R']);
    const rightFoot =
      this._findGlbPivot(rightThigh, ['RightFoot', 'Foot_R']) ||
      this._findGlbPivot(bodyGroup, ['RightFoot', 'Foot_R']);

    const weaponSlide =
      this._findGlbPivot(rightArm, [
        'WeaponSlide',
        'WeaponSlide_R',
        'WeaponSlideR',
        'RightWeaponSlide',
        'CannonSlide_R',
        'CannonSlideR',
      ]) ||
      this._findGlbPivot(bodyGroup, [
        'WeaponSlide',
        'WeaponSlide_R',
        'WeaponSlideR',
        'RightWeaponSlide',
        'CannonSlide_R',
        'CannonSlideR',
      ]);
    const leftWeaponSlide =
      this._findGlbPivot(leftArm, [
        'LeftWeaponSlide',
        'WeaponSlide_L',
        'WeaponSlideL',
        'CannonSlide_L',
        'CannonSlideL',
      ]) ||
      this._findGlbPivot(bodyGroup, [
        'LeftWeaponSlide',
        'WeaponSlide_L',
        'WeaponSlideL',
        'CannonSlide_L',
        'CannonSlideL',
      ]);
    const shieldFrame =
      this._findGlbPivot(leftArm, ['ShieldFrame', 'Shield_Frame']) ||
      this._findGlbPivot(bodyGroup, ['ShieldFrame', 'Shield_Frame']);

    const wingCoreL = this._findGlbPivot(bodyGroup, ['WingCoreL', 'WingCore_L', 'WingCore_1']);
    const wingCoreR = this._findGlbPivot(bodyGroup, ['WingCoreR', 'WingCore_R', 'WingCore_-1']);
    const tagGlbWingCore = (wc, side) => {
      if (!wc) return;
      wc.scale.setScalar(1);
      let coreMesh = null;
      let haloMesh = null;
      wc.traverse((node) => {
        if (!node.isMesh || !node.material || Array.isArray(node.material)) return;
        const nodeName = (node.name || '').toLowerCase();
        const matName = (node.material.name || '').toLowerCase();
        if (!haloMesh && /halo/i.test(nodeName)) {
          haloMesh = node;
        }
        if (/_core\b|wingcore.*core/i.test(nodeName) || /wingcore/i.test(matName)) {
          coreMesh = node;
        } else if (
          !coreMesh &&
          node.material.userData &&
          (node.material.userData.baseEmissiveIntensity || 0) > 0.05
        ) {
          coreMesh = node;
        }
      });
      if (!coreMesh) {
        wc.traverse((node) => {
          if (!coreMesh && node.isMesh && node.material && !Array.isArray(node.material)) {
            coreMesh = node;
          }
        });
      }
      if (coreMesh) {
        let coreMat = coreMesh.material;
        let sharedOutside = false;
        bodyGroup.traverse((node) => {
          if (sharedOutside || !node.isMesh || node.material !== coreMat) return;
          let cur = node;
          let insideCore = false;
          while (cur) {
            if (cur === wc) {
              insideCore = true;
              break;
            }
            cur = cur.parent;
          }
          if (!insideCore) sharedOutside = true;
        });
        if (sharedOutside) {
          coreMat = coreMat.clone();
          coreMat.userData.baseColor = coreMat.color ? coreMat.color.clone() : new THREE.Color(0xffffff);
          coreMat.userData.baseEmissive = coreMat.emissive ? coreMat.emissive.clone() : new THREE.Color(0x000000);
          coreMat.userData.baseEmissiveIntensity = coreMat.emissiveIntensity ?? 0;
          coreMesh.material = coreMat;
          ownedMaterials.push(coreMat);
        } else {
          if (!coreMat.userData.baseColor && coreMat.color) {
            coreMat.userData.baseColor = coreMat.color.clone();
          }
          const flashIdx = p.flashMaterials.indexOf(coreMat);
          if (flashIdx !== -1) p.flashMaterials.splice(flashIdx, 1);
        }
        wc.userData.coreMaterial = coreMat;
        wc.userData.coreMesh = coreMesh;
      }
      if (haloMesh) {
        wc.userData.haloMesh = haloMesh;
        if (haloMesh.material && !Array.isArray(haloMesh.material)) {
          wc.userData.haloMaterial = haloMesh.material;
          const flashIdx = p.flashMaterials.indexOf(haloMesh.material);
          if (flashIdx !== -1) p.flashMaterials.splice(flashIdx, 1);
        }
      } else if (archetypeId === 'aegis_overlord_boss') {
        const glbHaloGeo = this._getGeo(
          'overlord_wing_core_glb_halo',
          () => new THREE.TorusGeometry(0.57, 0.028, 8, 24)
        );
        const haloMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: new THREE.Color(0xf59e0b),
          emissiveIntensity: 2.8,
          roughness: 0.2,
          metalness: 0.3,
          fog: false,
        });
        haloMat.userData.baseColor = haloMat.color.clone();
        haloMat.userData.baseEmissive = haloMat.emissive.clone();
        haloMat.userData.baseEmissiveIntensity = haloMat.emissiveIntensity;
        ownedMaterials.push(haloMat);

        const createdHalo = new THREE.Mesh(glbHaloGeo, haloMat);
        createdHalo.rotation.y = side * 0.12;
        wc.add(createdHalo);
        wc.userData.haloMesh = createdHalo;
        wc.userData.haloMaterial = haloMat;
      }
    };
    tagGlbWingCore(wingCoreL, 1);
    tagGlbWingCore(wingCoreR, -1);
    const coreShutter = this._findGlbPivot(bodyGroup, ['CoreShutter', 'Core_Shutter']);

    if (barrelSlides) {
      this._collectGlbPivots(
        bodyGroup,
        ['BarrelSlide_L', 'BarrelSlide_R', 'BarrelSlideL', 'BarrelSlideR', 'RailBarrelSlide'],
        /(?:^|_)BarrelSlide(_[-\w]+)?$/i,
        barrelSlides
      );
    }
    if (heatVents) {
      this._collectGlbPivots(
        bodyGroup,
        ['HeatVent_L', 'HeatVent_R', 'HeatVent_1', 'HeatVent_-1'],
        /^HeatVent(_[-\w]+)?$/i,
        heatVents
      );
    }
    if (missilePods) {
      this._collectGlbPivots(
        bodyGroup,
        [
          'Shoulder_MissileCitadel_L',
          'Shoulder_MissileCitadel_R',
          'Shoulder_MissileCitadel_1',
          'Shoulder_MissileCitadel_-1',
          'MissilePod_L',
          'MissilePod_R',
        ],
        /^(Shoulder_MissileCitadel|MissilePod)(_[-\w]+)?$/i,
        missilePods
      );
    }
    if (wingShieldFins) {
      this._collectGlbPivots(
        bodyGroup,
        ['WingShieldFin_L', 'WingShieldFin_R', 'WingShieldFin_1', 'WingShieldFin_-1'],
        /^WingShieldFin(_[-\w]+)?$/i,
        wingShieldFins
      );
    }
    if (stabilizers) {
      this._collectGlbPivots(
        bodyGroup,
        ['Stabilizer_L', 'Stabilizer_R', 'Stabilizer_1', 'Stabilizer_-1'],
        /^Stabilizer(_[-\w]+)?$/i,
        stabilizers
      );
    }

    this._collectGlbPivots(
      bodyGroup,
      ['LeftRotor', 'RightRotor', 'Rotor_L', 'Rotor_R', 'Rotor_0', 'Rotor_1', 'Rotor_2', 'Rotor_3'],
      /^(Rotor_\d+|WingRotor(_[-\w]+)?)$/i,
      rotors
    );

    const foundRings = [];
    this._collectGlbPivots(
      bodyGroup,
      ['OrbitRing_0', 'OrbitRing_1', 'OrbitRing_2', 'OrbitRing_3', 'CoreRing_0', 'CoreRing_1', 'CoreRing_2', 'CoreRing_3'],
      /^(OrbitRing|CoreRing)_\d+$/i,
      foundRings
    );
    for (let r = 0; r < foundRings.length; r++) {
      const ring = foundRings[r];
      ring.userData.baseRotation = ring.rotation.clone();
      coreRings.push(ring);
    }

    if (
      shieldMesh &&
      (archetypeId === 'heavy_enforcer' ||
        archetypeId === 'rail_warden' ||
        archetypeId === 'abyss_sentinel')
    ) {
      if (archetypeId === 'heavy_enforcer') {
        shieldMesh.geometry = this._getGeo('bulwark_blast_shield_compact', () => {
          const geo = new THREE.CylinderGeometry(0.86, 0.86, 0.70, 16, 1, true, -0.34, 0.68);
          geo.translate(0, -0.02, -0.80);
          return geo;
        });
      }
      if (shieldFrame) {
        shieldMesh.position.set(0, 0, 0.02);
        shieldMesh.rotation.set(0, 0, 0);
        shieldFrame.add(shieldMesh);
      } else {
        shieldMesh.position.set(-0.22, -0.50, 0.60);
        shieldMesh.rotation.set(0, 0.22, 0);
        leftArm.add(shieldMesh);
      }
    }

    if (rigRef) {
      rigRef.pelvis = pelvis;
      rigRef.leftThigh = leftThigh;
      rigRef.leftLeg = leftThigh;
      rigRef.leftShin = leftShin;
      rigRef.leftFoot = leftFoot;
      rigRef.rightThigh = rightThigh;
      rigRef.rightLeg = rightThigh;
      rigRef.rightShin = rightShin;
      rigRef.rightFoot = rightFoot;
      rigRef.weaponSlide = weaponSlide;
      rigRef.leftWeaponSlide = leftWeaponSlide;
      rigRef.shieldFrame = shieldFrame;
      rigRef.wingCoreL = wingCoreL;
      rigRef.wingCoreR = wingCoreR;
      rigRef.coreShutter = coreShutter;
      if (resolvedLeftMuzzle) rigRef.leftWeaponMuzzle = resolvedLeftMuzzle;
      this._cacheAllRigRestPoses(rigRef);
    }

    bodyGroup.userData.glbMounted = true;
  }

  _buildWithGlb(archetypeId, ctx, buildLegacyFn) {
    const cachedScene = EnemyModelFactory._glbCache.get(archetypeId);
    if (cachedScene) {
      this._mountGlbRig(archetypeId, cachedScene, ctx);
      return;
    }

    buildLegacyFn();

    if (
      typeof document !== 'undefined' &&
      globalThis.GLTFLoader &&
      GLB_MODEL_REGISTRY[archetypeId] &&
      !EnemyModelFactory._glbMissing.has(archetypeId)
    ) {
      const {
        bodyGroup,
        headGroup,
        headAnchor,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        weaponMuzzle,
        leftWeaponMuzzle,
        shieldMesh,
        rotors,
        coreRings,
        barrelSlides,
        heatVents,
        missilePods,
        wingShieldFins,
        stabilizers,
        rigRef,
      } = ctx;
      const groupsToPurge = [headGroup, leftArm, rightArm, leftLeg, rightLeg].filter(Boolean);
      const keepSet = new Set(
        [shieldMesh, headGroup, headAnchor, leftArm, rightArm, leftLeg, rightLeg, weaponMuzzle, leftWeaponMuzzle].filter(Boolean)
      );
      const fallbackBodyNodes = bodyGroup.children.filter((c) => !keepSet.has(c));

      this.preloadModels().then(() => {
        const sceneTpl = EnemyModelFactory._glbCache.get(archetypeId);
        if (!sceneTpl || bodyGroup.userData.glbMounted || bodyGroup.userData.disposed) return;
        if (shieldMesh && shieldMesh.parent && shieldMesh.parent !== bodyGroup) {
          shieldMesh.parent.remove(shieldMesh);
        }
        if (weaponMuzzle && weaponMuzzle.parent && weaponMuzzle.parent !== rightArm) {
          weaponMuzzle.parent.remove(weaponMuzzle);
        }
        if (leftWeaponMuzzle && leftWeaponMuzzle.parent && leftWeaponMuzzle.parent !== leftArm) {
          leftWeaponMuzzle.parent.remove(leftWeaponMuzzle);
        }
        for (let i = 0; i < fallbackBodyNodes.length; i++) {
          bodyGroup.remove(fallbackBodyNodes[i]);
        }
        for (let i = 0; i < groupsToPurge.length; i++) {
          const grp = groupsToPurge[i];
          const toRemove = grp.children.filter((c) => !keepSet.has(c));
          for (let j = 0; j < toRemove.length; j++) grp.remove(toRemove[j]);
          grp.position.set(0, 0, 0);
          grp.rotation.set(0, 0, 0);
          grp.scale.set(1, 1, 1);
        }
        rotors.length = 0;
        coreRings.length = 0;
        if (barrelSlides) barrelSlides.length = 0;
        if (heatVents) heatVents.length = 0;
        if (missilePods) missilePods.length = 0;
        if (wingShieldFins) wingShieldFins.length = 0;
        if (stabilizers) stabilizers.length = 0;
        if (rigRef) {
          rigRef.pelvis = null;
          rigRef.leftShin = null;
          rigRef.leftFoot = null;
          rigRef.rightShin = null;
          rigRef.rightFoot = null;
          rigRef.weaponSlide = null;
          rigRef.leftWeaponSlide = null;
          rigRef.shieldFrame = null;
          rigRef.wingCoreL = null;
          rigRef.wingCoreR = null;
          rigRef.coreShutter = null;
        }
        this._mountGlbRig(archetypeId, sceneTpl, ctx);
      });
    }
  }

  _buildWithAct1Glb(archetypeId, ctx, buildLegacyFn) {
    this._buildWithGlb(archetypeId, ctx, buildLegacyFn);
  }

  // ===========================================================================
  // 5. COLOSSUS-IV // ASH TITAN (4.2m Sculpted AAA Blender GLB + Legacy Fallback)
  // ===========================================================================
  _createBossPhaseShieldMesh(ownedMaterials, bodyGroup) {
    const bossShieldGeo = this._getGeo('colossus_phase_shield', () => {
      return new THREE.CylinderGeometry(1.78, 1.85, 2.2, 24, 1, true);
    });
    const bossShieldMat = new THREE.MeshStandardMaterial({
      color: 0xff7b24,
      map: this._textures.blastShield,
      emissive: new THREE.Color(0xe63916),
      emissiveMap: this._textures.blastShield,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.0,
      roughness: 0.38,
      metalness: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    bossShieldMat.userData.baseColor = bossShieldMat.color.clone();
    bossShieldMat.userData.baseEmissive = bossShieldMat.emissive.clone();
    bossShieldMat.userData.baseEmissiveIntensity = bossShieldMat.emissiveIntensity;
    bossShieldMat.userData.baseOpacity = 0.72;
    ownedMaterials.push(bossShieldMat);

    const shieldMesh = new THREE.Mesh(bossShieldGeo, bossShieldMat);
    shieldMesh.position.set(0, 2.15, 0.04);
    shieldMesh.visible = false;
    shieldMesh.renderOrder = 7;
    bodyGroup.add(shieldMesh);
    return shieldMesh;
  }

  _buildLegacyCyberMechBoss(
    p,
    ownedMaterials,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    leftWeaponMuzzle,
    rotors,
    coreRings,
    shieldMesh
  ) {
    // Colossal Reverse-Jointed Mining/Siege Walker Legs (hip pivot at y = 1.96)
    const thighGeo = this._makeExtrudedPoly(
      'colossus_thigh',
      [
        [-0.26, 0.14],
        [0.26, 0.14],
        [0.32, -0.34],
        [0.24, -0.86],
        [-0.24, -0.86],
        [-0.32, -0.34],
      ],
      0.52,
      0.05,
      0.044,
      2
    );
    const kneeDrumGeo = this._makeLathe(
      'colossus_knee_drum',
      [
        [0.14, -0.26],
        [0.28, -0.24],
        [0.30, 0.0],
        [0.28, 0.24],
        [0.14, 0.26],
      ],
      14
    );
    const shinGeo = this._makeExtrudedPoly(
      'colossus_shin',
      [
        [-0.24, 0.04],
        [0.24, 0.04],
        [0.30, -0.78],
        [0.22, -0.98],
        [-0.22, -0.98],
        [-0.30, -0.78],
      ],
      0.46,
      0.048,
      0.04,
      2
    );
    const clawToeGeo = this._makeExtrudedPoly(
      'colossus_toe_claw',
      [
        [-0.12, -0.04],
        [0.12, -0.04],
        [0.09, 0.44],
        [-0.09, 0.44],
      ],
      0.22,
      0.024,
      0.02,
      1
    );
    const legHydraulicGeo = this._makeTube(
      'colossus_leg_hose',
      [
        [0, -0.20, -0.28],
        [0, -0.88, -0.48],
        [0, -1.62, -0.22],
      ],
      0.068,
      12,
      8
    );

    const buildBossLeg = (legGroup, sideX) => {
      legGroup.position.set(sideX, 1.96, 0);

      const thigh = new THREE.Mesh(thighGeo, p.primaryArmor);
      thigh.rotation.x = -0.22;
      legGroup.add(thigh);

      // Reverse-jointed heavy knee drum + heated bronze/amber hydraulic bearing ring
      const knee = new THREE.Mesh(kneeDrumGeo, p.darkFrame);
      knee.rotation.z = Math.PI * 0.5;
      knee.position.set(0, -0.86, 0.16);
      legGroup.add(knee);

      const kneeRam = new THREE.Mesh(
        this._getGeo('colossus_knee_ram', () => new THREE.ConeGeometry(0.18, 0.44, 5)),
        p.pistonSteel
      );
      kneeRam.rotation.x = Math.PI * 0.40;
      kneeRam.position.set(0, -0.86, 0.44);
      legGroup.add(kneeRam);

      const kneeRing = new THREE.Mesh(
        this._getGeo('colossus_knee_ring', () => new THREE.TorusGeometry(0.24, 0.032, 8, 16)),
        p.accentGlow
      );
      kneeRing.rotation.y = Math.PI * 0.5;
      kneeRing.position.set(sideX > 0 ? 0.27 : -0.27, -0.86, 0.16);
      legGroup.add(kneeRing);

      const shin = new THREE.Mesh(shinGeo, p.coloredPlate);
      shin.position.set(0, -0.90, 0.12);
      shin.rotation.x = 0.14;
      legGroup.add(shin);

      // Exposed hydraulic cylinder behind shin
      const shinPiston = new THREE.Mesh(
        this._getGeo('colossus_shin_piston', () => new THREE.CylinderGeometry(0.08, 0.08, 0.85, 8)),
        p.pistonSteel
      );
      shinPiston.position.set(0, -1.32, -0.18);
      legGroup.add(shinPiston);

      // Heavy Industrial Hydraulic Talons (splayed outward properly: toe.rotation.z = -toeAngles[t])
      const footHub = new THREE.Mesh(
        this._getGeo('colossus_foot_hub', () => new THREE.CylinderGeometry(0.32, 0.38, 0.22, 8)),
        p.darkFrame
      );
      footHub.position.set(0, -1.85, 0.02);
      legGroup.add(footHub);

      const toeAngles = [-0.55, 0.0, 0.55];
      for (let t = 0; t < toeAngles.length; t++) {
        const toe = new THREE.Mesh(clawToeGeo, p.primaryArmor);
        toe.rotation.x = Math.PI * 0.5;
        toe.rotation.z = -toeAngles[t];
        toe.position.set(Math.sin(toeAngles[t]) * 0.28, -1.85, 0.14 + Math.cos(toeAngles[t]) * 0.12);
        legGroup.add(toe);
      }

      const heel = new THREE.Mesh(clawToeGeo, p.primaryArmor);
      heel.rotation.x = Math.PI * 0.5;
      heel.rotation.z = Math.PI;
      heel.position.set(0, -1.85, -0.24);
      legGroup.add(heel);

      legGroup.add(new THREE.Mesh(legHydraulicGeo, p.cableMat));
      bodyGroup.add(legGroup);
    };

    buildBossLeg(leftLeg, 0.62);
    buildBossLeg(rightLeg, -0.62);

    // Massive Gyro-Turret Waist & Bolted Pelvis
    const pelvisGeo = this._makeExtrudedPoly(
      'colossus_pelvis',
      [
        [-0.74, 0.26],
        [0.74, 0.26],
        [0.54, -0.34],
        [-0.54, -0.34],
      ],
      0.72,
      0.055,
      0.045,
      2
    );
    const pelvis = new THREE.Mesh(pelvisGeo, p.darkFrame);
    pelvis.position.set(0, 2.02, 0);
    bodyGroup.add(pelvis);

    const waistColumn = new THREE.Mesh(
      this._getGeo('colossus_waist', () => new THREE.CylinderGeometry(0.46, 0.54, 0.44, 12)),
      p.pistonSteel
    );
    waistColumn.position.set(0, 2.34, 0);
    bodyGroup.add(waistColumn);

    // Towering Multi-Tiered Siege Dreadnought Chassis
    const torsoGeo = this._makeExtrudedPoly(
      'colossus_torso',
      [
        [-0.98, 0.58],
        [-0.64, 0.82],
        [0.64, 0.82],
        [0.98, 0.58],
        [0.86, -0.26],
        [0.56, -0.62],
        [-0.56, -0.62],
        [-0.86, -0.26],
      ],
      0.92,
      0.085,
      0.07,
      2
    );
    const torso = new THREE.Mesh(torsoGeo, p.primaryArmor);
    torso.position.set(0, 2.94, 0.04);
    bodyGroup.add(torso);

    // Burnt-Crimson Siege Breastplate + Exposed Chest Furnace Reactor Grill
    const breastplateGeo = this._makeExtrudedPoly(
      'colossus_breastplate',
      [
        [-0.76, 0.44],
        [0.76, 0.44],
        [0.58, -0.38],
        [0, -0.52],
        [-0.58, -0.38],
      ],
      0.24,
      0.046,
      0.038,
      2
    );
    const breastplate = new THREE.Mesh(breastplateGeo, p.coloredPlate);
    breastplate.position.set(0, 2.96, 0.54);
    breastplate.rotation.x = -0.14;
    bodyGroup.add(breastplate);

    // Exposed Furnace Reactor Core + Heavy Iron Grill Cage on Chest
    const furnaceCoreGeo = this._makeLathe(
      'colossus_chest_furnace',
      [
        [0.05, 0.0],
        [0.24, 0.04],
        [0.28, 0.13],
        [0.18, 0.20],
      ],
      16
    );
    const chestFurnace = new THREE.Mesh(furnaceCoreGeo, p.accentGlow);
    chestFurnace.rotation.x = Math.PI * 0.5;
    chestFurnace.position.set(0, 2.98, 0.61);
    bodyGroup.add(chestFurnace);

    const grillBarGeo = this._getGeo('colossus_grill_bar', () => new THREE.BoxGeometry(0.56, 0.042, 0.045));
    for (let g = -2; g <= 2; g++) {
      const bar = new THREE.Mesh(grillBarGeo, p.darkFrame);
      bar.position.set(0, 2.98 + g * 0.095, 0.72);
      bodyGroup.add(bar);
    }

    for (let side = -1; side <= 1; side += 2) {
      for (let v = 0; v < 4; v++) {
        const louver = new THREE.Mesh(
          this._getGeo('colossus_side_vent', () => new THREE.BoxGeometry(0.14, 0.07, 0.34)),
          p.accentGlow
        );
        louver.position.set(side * 0.94, 3.24 - v * 0.16, 0.08);
        bodyGroup.add(louver);
      }

      // Massive dorsal coolant & fuel hoses
      bodyGroup.add(
        new THREE.Mesh(
          this._makeTube(
            `colossus_reactor_hose_${side}`,
            [
              [side * 0.44, 2.38, -0.46],
              [side * 0.72, 2.98, -0.78],
              [side * 0.66, 3.66, -0.32],
              [side * 0.38, 3.54, 0.06],
            ],
            0.075,
            14,
            8
          ),
          p.cableMat
        )
      );
    }

    // Twin Dorsal Smokestack Exhaust Chimneys (LatheGeometry)
    const smokestackGeo = this._makeLathe(
      'colossus_smokestack',
      [
        [0.16, 0.0],
        [0.20, 0.10],
        [0.18, 0.95],
        [0.24, 1.06],
        [0.21, 1.12],
        [0.14, 1.08],
      ],
      14
    );
    for (let side = -1; side <= 1; side += 2) {
      const stack = new THREE.Mesh(smokestackGeo, p.darkFrame);
      stack.position.set(side * 0.48, 3.28, -0.58);
      stack.rotation.x = -0.22;
      stack.rotation.z = -side * 0.08;
      bodyGroup.add(stack);

      const emberTop = new THREE.Mesh(
        this._getGeo('colossus_stack_ember', () => new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10)),
        p.accentGlow
      );
      emberTop.position.set(side * 0.56, 4.26, -0.80);
      emberTop.rotation.x = -0.22;
      bodyGroup.add(emberTop);
    }

    // Twin Glacis Siege Armor Tusks flanking Chest Furnace Cage
    const chestTuskGeo = this._makeExtrudedPoly(
      'colossus_chest_tusk',
      [
        [-0.12, -0.26],
        [0.14, -0.18],
        [0.24, 0.34],
        [0.02, 0.48],
        [-0.08, 0.16],
      ],
      0.20,
      0.03,
      0.024,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const tusk = new THREE.Mesh(chestTuskGeo, p.darkFrame);
      tusk.position.set(side * 0.66, 3.04, 0.48);
      tusk.scale.x = side;
      tusk.rotation.y = -side * 0.22;
      tusk.rotation.x = 0.12;
      bodyGroup.add(tusk);
    }

    // Twin Towering Shoulder-Mounted 9-Cell Missile Citadels
    const podGeo = this._makeExtrudedPoly(
      'colossus_missile_pod',
      [
        [-0.38, -0.26],
        [0.38, -0.26],
        [0.42, 0.28],
        [-0.42, 0.28],
      ],
      0.62,
      0.036,
      0.03,
      2
    );
    const warheadGeo = this._getGeo('colossus_warhead', () => new THREE.ConeGeometry(0.068, 0.16, 8));
    for (let side = -1; side <= 1; side += 2) {
      const pod = new THREE.Group();
      pod.position.set(side * 1.02, 3.90, -0.06);
      pod.rotation.x = -0.18;
      pod.rotation.z = -side * 0.14;
      pod.add(new THREE.Mesh(podGeo, p.primaryArmor));

      for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
          const tip = new THREE.Mesh(warheadGeo, c === 0 && r === 0 ? p.accentGlow : p.coloredPlate);
          tip.rotation.x = Math.PI * 0.5;
          tip.position.set(c * 0.20, r * 0.15, 0.34);
          pod.add(tip);
        }
      }
      bodyGroup.add(pod);
    }

    // Dreadnought Demon-Skull Cranial Furnace Weakpoint (Elevated Forward Over Upper Glacis!)
    headGroup.position.set(0, 3.82, 0.46);
    bodyGroup.add(headGroup);

    const cranialCoreGeo = this._makeLathe(
      'colossus_cranial_core',
      [
        [0.01, -0.34],
        [0.24, -0.28],
        [0.38, -0.08],
        [0.40, 0.12],
        [0.30, 0.32],
        [0.14, 0.42],
        [0.01, 0.44],
      ],
      20
    );
    headGroup.add(new THREE.Mesh(cranialCoreGeo, p.weakpointGlow));

    // Menacing Frowning Demon-Skull Brow Crown, Slit Optics & Jaw Mandibles framing Open Core
    const skullBrowGeo = this._makeExtrudedPoly(
      'colossus_skull_brow',
      [
        [-0.48, 0.04],
        [-0.30, 0.32],
        [0, 0.20],
        [0.30, 0.32],
        [0.48, 0.04],
        [0, -0.06],
      ],
      0.38,
      0.03,
      0.026,
      1
    );
    const skullBrow = new THREE.Mesh(skullBrowGeo, p.coloredPlate);
    skullBrow.position.set(0, 0.32, 0.10);
    skullBrow.rotation.x = 0.24;
    headGroup.add(skullBrow);

    const bossEyeSlitGeo = this._getGeo('colossus_demon_eye_slit', () => new THREE.BoxGeometry(0.19, 0.068, 0.10));
    for (let side = -1; side <= 1; side += 2) {
      const bEye = new THREE.Mesh(bossEyeSlitGeo, p.weakpointGlow);
      bEye.position.set(side * 0.21, 0.18, 0.33);
      bEye.rotation.z = side * 0.32;
      headGroup.add(bEye);
    }

    const jawCheekGeo = this._makeExtrudedPoly(
      'colossus_jaw_cheek',
      [
        [-0.08, -0.26],
        [0.10, -0.14],
        [0.08, 0.24],
        [-0.08, 0.18],
      ],
      0.38,
      0.024,
      0.02,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      // Swept curved dreadnought bull-horns towering above skull
      const curvedHorn = new THREE.Mesh(
        this._makeTube(
          `colossus_curved_horn_${side}`,
          [
            [side * 0.38, 0.24, -0.02],
            [side * 0.66, 0.60, 0.10],
            [side * 0.58, 1.02, 0.28],
          ],
          0.082,
          12,
          8
        ),
        p.pistonSteel
      );
      headGroup.add(curvedHorn);

      const cheekJaw = new THREE.Mesh(jawCheekGeo, p.coloredPlate);
      cheekJaw.position.set(side * 0.40, -0.04, 0.14);
      cheekJaw.scale.x = side;
      cheekJaw.rotation.y = side * 0.22;
      headGroup.add(cheekJaw);
    }

    // Iron Spike Chin Tusk Guard leaving glowing cranial furnace visible center-front
    for (let jf = -2; jf <= 2; jf++) {
      if (jf === 0) continue;
      const chinTusk = new THREE.Mesh(
        this._getGeo('colossus_chin_tusk', () => new THREE.ConeGeometry(0.052, 0.22, 4)),
        p.pistonSteel
      );
      chinTusk.position.set(jf * 0.13, -0.22, 0.30);
      chinTusk.rotation.x = 0.28;
      headGroup.add(chinTusk);
    }

    // Neck Gorget Collar below skull (clear of front eyes/reactor core!)
    const crownCollar = new THREE.Mesh(
      this._getGeo('colossus_crown_ring', () => new THREE.TorusGeometry(0.46, 0.048, 10, 22)),
      p.darkFrame
    );
    crownCollar.rotation.x = Math.PI * 0.5;
    crownCollar.position.set(0, -0.32, -0.04);
    headGroup.add(crownCollar);

    headAnchor.position.set(0, 0.06, 0.08);
    headGroup.add(headAnchor);

    // Twin Articulated Arms Wielding 6-Barrel Spinning Rotary Autocannons
    const bossPauldronGeo = this._makeExtrudedPoly(
      'colossus_pauldron',
      [
        [-0.36, 0.34],
        [0.32, 0.28],
        [0.42, -0.24],
        [0.14, -0.40],
        [-0.34, -0.18],
      ],
      0.68,
      0.05,
      0.044,
      2
    );
    const rotaryBarrelGeo = this._makeLathe(
      'colossus_rotary_barrel',
      [
        [0.036, 0.0],
        [0.036, 0.88],
        [0.048, 0.92],
        [0.042, 1.02],
        [0.028, 1.02],
      ],
      8
    );
    const clampDiskGeo = this._getGeo('colossus_rotary_clamp', () => new THREE.CylinderGeometry(0.21, 0.21, 0.06, 12));
    const gunHousingGeo = this._makeExtrudedPoly(
      'colossus_gun_housing',
      [
        [-0.24, -0.24],
        [0.24, -0.24],
        [0.28, 0.22],
        [-0.28, 0.22],
      ],
      0.86,
      0.036,
      0.03,
      2
    );

    const leftWeaponMuzzleReady = leftWeaponMuzzle || new THREE.Object3D();

    const buildBossCannonArm = (armGroup, side, muzzleObj) => {
      armGroup.position.set(side * 1.24, 3.24, 0.08);

      const pauldron = new THREE.Mesh(bossPauldronGeo, p.coloredPlate);
      pauldron.position.set(side * 0.14, 0.12, 0);
      pauldron.scale.x = -side;
      armGroup.add(pauldron);

      const upperArm = new THREE.Mesh(
        this._getGeo('colossus_upper_arm', () => new THREE.CylinderGeometry(0.18, 0.16, 0.72, 10)),
        p.pistonSteel
      );
      upperArm.position.set(side * 0.12, -0.38, 0.08);
      upperArm.rotation.x = -0.28;
      armGroup.add(upperArm);

      const cannonPod = new THREE.Group();
      cannonPod.position.set(side * 0.14, -0.68, 0.56);
      cannonPod.add(new THREE.Mesh(gunHousingGeo, p.primaryArmor));

      const gunShieldHood = new THREE.Mesh(
        this._getGeo('colossus_gun_hood', () => new THREE.BoxGeometry(0.54, 0.14, 0.72)),
        p.coloredPlate
      );
      gunShieldHood.position.set(0, 0.24, 0.12);
      cannonPod.add(gunShieldHood);

      const underBayonet = new THREE.Mesh(
        this._getGeo('colossus_gun_bayonet', () => new THREE.BoxGeometry(0.08, 0.16, 0.92)),
        p.pistonSteel
      );
      underBayonet.position.set(0, -0.24, 0.65);
      cannonPod.add(underBayonet);

      const heatRail = new THREE.Mesh(
        this._getGeo('colossus_gun_rail', () => new THREE.BoxGeometry(0.12, 0.08, 0.76)),
        p.accentGlow
      );
      heatRail.position.set(0, 0.25, 0.06);
      cannonPod.add(heatRail);

      // Spinning 6-barrel Gatling rotary autocannon cluster
      const barrelCluster = new THREE.Group();
      barrelCluster.position.set(0, -0.02, 0.40);
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2;
        const barrel = new THREE.Mesh(rotaryBarrelGeo, p.darkFrame);
        barrel.rotation.x = Math.PI * 0.5;
        barrel.position.set(Math.cos(ang) * 0.135, Math.sin(ang) * 0.135, 0);
        barrelCluster.add(barrel);
      }
      const clamp1 = new THREE.Mesh(clampDiskGeo, p.coloredPlate);
      clamp1.rotation.x = Math.PI * 0.5;
      clamp1.position.z = 0.34;
      barrelCluster.add(clamp1);

      const clamp2 = new THREE.Mesh(clampDiskGeo, p.accentGlow);
      clamp2.rotation.x = Math.PI * 0.5;
      clamp2.position.z = 0.78;
      barrelCluster.add(clamp2);

      cannonPod.add(barrelCluster);
      rotors.push(barrelCluster);

      cannonPod.add(
        new THREE.Mesh(
          this._makeTube(
            `colossus_ammo_feed_${side}`,
            [
              [-side * 0.16, 0.12, -0.26],
              [-side * 0.42, 0.48, -0.58],
              [-side * 0.52, 0.82, -0.52],
            ],
            0.055,
            10,
            6
          ),
          p.cableMat
        )
      );

      muzzleObj.position.set(0, -0.02, 1.48);
      cannonPod.add(muzzleObj);
      armGroup.add(cannonPod);
      bodyGroup.add(armGroup);
    };

    buildBossCannonArm(rightArm, -1, weaponMuzzle);
    buildBossCannonArm(leftArm, 1, leftWeaponMuzzleReady);

    // 3 Rotating Heavy Iron & Overheated Molten-Amber Orbital Cooling Rings (dorsal engine halo framing behind torso!)
    const ringConfigs = [
      { r: 2.15, tube: 0.046, tiltX: 0.22, tiltZ: 0.28, y: 3.12, z: -0.78, color: 0x5c4b42, emissive: 0xd97706 },
      { r: 2.42, tube: 0.042, tiltX: -0.26, tiltZ: 0.46, y: 3.14, z: -0.90, color: 0x7c2d12, emissive: 0xff3b1f },
      { r: 2.66, tube: 0.038, tiltX: 0.30, tiltZ: -0.34, y: 3.10, z: -1.02, color: 0x4f443d, emissive: 0xff6b1a },
    ];

    const finGeo = this._getGeo('colossus_ring_fin', () => new THREE.BoxGeometry(0.18, 0.12, 0.16));
    for (let i = 0; i < ringConfigs.length; i++) {
      const cfg = ringConfigs[i];
      const ringGroup = new THREE.Group();
      ringGroup.position.set(0, cfg.y, cfg.z);
      ringGroup.rotation.set(cfg.tiltX, i * 1.1, cfg.tiltZ);
      ringGroup.userData.baseRotation = new THREE.Euler(cfg.tiltX, i * 1.1, cfg.tiltZ);

      const ringMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: new THREE.Color(cfg.emissive),
        emissiveIntensity: 1.55,
        roughness: 0.38,
        metalness: 0.72,
      });
      ringMat.userData.baseColor = ringMat.color.clone();
      ringMat.userData.baseEmissive = ringMat.emissive.clone();
      ringMat.userData.baseEmissiveIntensity = ringMat.emissiveIntensity;
      ownedMaterials.push(ringMat);

      const ringGeo = this._getGeo(`colossus_orbit_ring_${i}`, () => {
        return new THREE.TorusGeometry(cfg.r, cfg.tube, 8, 36);
      });
      ringGroup.add(new THREE.Mesh(ringGeo, ringMat));

      // Heavy cast-iron cooling fin clamps anchored along each orbital ring
      for (let n = 0; n < 6; n++) {
        const ang = (n / 6) * Math.PI * 2;
        const fin = new THREE.Mesh(finGeo, n % 2 === 0 ? p.darkFrame : ringMat);
        fin.position.set(Math.cos(ang) * cfg.r, Math.sin(ang) * cfg.r, 0);
        fin.rotation.z = ang;
        ringGroup.add(fin);
      }

      ringGroup.userData.ringMaterial = ringMat;
      bodyGroup.add(ringGroup);
      coreRings.push(ringGroup);
    }

    // --- Hell-Furnace Titan Overhaul: 6 Armored Siege Dorsal Cooling Vanes & Molten Reactor Halo ---
    const siegeVaneGeo = this._makeExtrudedPoly(
      'colossus_hell_vane',
      [
        [-0.08, 0.0],
        [0.24, 0.22],
        [0.34, 2.38],
        [0.04, 2.75],
        [-0.14, 1.40],
      ],
      0.16,
      0.028,
      0.022,
      2
    );
    const vaneEmberGeo = this._getGeo('colossus_vane_ember', () => new THREE.BoxGeometry(0.06, 2.15, 0.22));
    for (const side of [-1, 1]) {
      for (let f = 0; f < 3; f++) {
        const angleZ = side * (-0.34 - f * 0.30);
        const vane = new THREE.Mesh(siegeVaneGeo, f === 1 ? p.coloredPlate : p.darkFrame);
        vane.position.set(side * (1.10 + f * 0.50), 3.05 - f * 0.22, -0.78 - f * 0.16);
        vane.scale.x = side;
        vane.rotation.set(-0.24, side * 0.18, angleZ);
        bodyGroup.add(vane);

        const emberVein = new THREE.Mesh(vaneEmberGeo, p.accentGlow);
        emberVein.position.set(side * (1.22 + f * 0.54), 3.72 - f * 0.22, -0.84 - f * 0.16);
        emberVein.rotation.set(-0.24, side * 0.18, angleZ);
        bodyGroup.add(emberVein);
      }
    }

    const hellCrownHalo = new THREE.Mesh(
      this._getGeo('colossus_hell_halo', () => new THREE.TorusGeometry(0.96, 0.068, 10, 28)),
      p.accentGlow
    );
    hellCrownHalo.position.set(0, 4.35, -0.25);
    hellCrownHalo.rotation.x = 0.25;
    bodyGroup.add(hellCrownHalo);
    coreRings.push(hellCrownHalo);

    const moltenSovereignRing = new THREE.Mesh(
      this._getGeo('colossus_molten_ring', () => new THREE.TorusGeometry(2.38, 0.072, 10, 36)),
      p.accentGlow
    );
    moltenSovereignRing.position.set(0, 2.90, -0.65);
    moltenSovereignRing.rotation.set(0.35, 0.2, 0);
    bodyGroup.add(moltenSovereignRing);
    coreRings.push(moltenSovereignRing);

    return { shieldMesh, leftWeaponMuzzle: leftWeaponMuzzleReady };
  }

  /**
   * Shared helper to create a clipped telegraph lock-on laser beam mesh.
   * @private
   */
  _createLaserBeam(ownedMaterials, ownedGeometries, root, outerColorHex, innerColorHex) {
    const outerBeamGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.0, 8, 1, true);
    outerBeamGeo.rotateX(Math.PI * 0.5);
    outerBeamGeo.translate(0, 0, 0.5);
    ownedGeometries.push(outerBeamGeo);

    const innerBeamGeo = new THREE.CylinderGeometry(0.006, 0.006, 1.0, 6, 1, true);
    innerBeamGeo.rotateX(Math.PI * 0.5);
    innerBeamGeo.translate(0, 0, 0.5);
    ownedGeometries.push(innerBeamGeo);

    const outerLaserMat = new THREE.MeshBasicMaterial({
      color: outerColorHex,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const innerLaserMat = new THREE.MeshBasicMaterial({
      color: innerColorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    ownedMaterials.push(outerLaserMat, innerLaserMat);

    const laserLine = new THREE.Mesh(outerBeamGeo, outerLaserMat);
    const innerCore = new THREE.Mesh(innerBeamGeo, innerLaserMat);
    laserLine.add(innerCore);
    laserLine.visible = false;
    laserLine.frustumCulled = false;
    laserLine.renderOrder = 8;
    root.add(laserLine);
    return laserLine;
  }

  // ===========================================================================
  // 6. AEGIS INTERCEPTOR (Swept-Wing Twin Tilt-Rotor Gunship + Twin Blasters)
  // ===========================================================================
  _buildInterceptorDrone(
    p,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    weaponMuzzle,
    rotors,
    sharedLeftMuzzle = null
  ) {
    bodyGroup.position.set(0, 0.62, 0);

    // Swept angular gunship fuselage
    const hullGeo = this._makeExtrudedPoly(
      'interceptor_hull',
      [
        [0.0, 0.44],
        [0.24, 0.14],
        [0.30, -0.26],
        [0.14, -0.46],
        [-0.14, -0.46],
        [-0.30, -0.26],
        [-0.24, 0.14],
      ],
      0.20,
      0.026,
      0.022,
      2
    );
    const hull = new THREE.Mesh(hullGeo, p.primaryArmor);
    hull.rotation.x = Math.PI * 0.5;
    hull.position.set(0, 0.04, 0);
    bodyGroup.add(hull);

    // Armored dorsal spine crest
    const spineGeo = this._makeExtrudedPoly(
      'interceptor_spine',
      [
        [0.0, 0.28],
        [0.12, -0.34],
        [-0.12, -0.34],
      ],
      0.11,
      0.018,
      0.015,
      1
    );
    const spine = new THREE.Mesh(spineGeo, p.coloredPlate);
    spine.rotation.x = Math.PI * 0.5;
    spine.position.set(0, 0.18, -0.05);
    bodyGroup.add(spine);

    // Swept Delta Thruster Wings + Twin Tilt-Rotor Nacelles
    const wingGeo = this._makeExtrudedPoly(
      'interceptor_wing',
      [
        [0.0, 0.16],
        [0.54, -0.10],
        [0.62, -0.30],
        [0.14, -0.22],
      ],
      0.045,
      0.012,
      0.01,
      1
    );
    const shroudGeo = this._makeLathe(
      'interceptor_rotor_shroud',
      [
        [0.17, -0.10],
        [0.23, -0.07],
        [0.24, 0.02],
        [0.21, 0.10],
        [0.16, 0.10],
        [0.15, -0.06],
        [0.17, -0.10],
      ],
      16
    );
    const bladeGeo = this._getGeo('interceptor_rotor_blade', () => new THREE.BoxGeometry(0.28, 0.016, 0.048));
    const hubGeo = this._getGeo('interceptor_rotor_hub', () => new THREE.CylinderGeometry(0.038, 0.044, 0.10, 8));
    const ringGeo = this._getGeo('interceptor_heat_ring', () => new THREE.TorusGeometry(0.165, 0.014, 6, 16));

    for (let side = -1; side <= 1; side += 2) {
      const wing = new THREE.Mesh(wingGeo, p.coloredPlate);
      wing.rotation.x = Math.PI * 0.5;
      wing.scale.x = side;
      wing.position.set(side * 0.18, 0.08, -0.04);
      bodyGroup.add(wing);

      const nacelle = new THREE.Group();
      nacelle.position.set(side * 0.72, 0.12, -0.16);
      nacelle.rotation.z = -side * 0.22;
      nacelle.rotation.x = 0.24;
      nacelle.add(new THREE.Mesh(shroudGeo, p.darkFrame));

      const ring = new THREE.Mesh(ringGeo, p.accentGlow);
      ring.rotation.x = Math.PI * 0.5;
      ring.position.y = -0.06;
      nacelle.add(ring);

      const rotorPivot = new THREE.Group();
      rotorPivot.add(new THREE.Mesh(hubGeo, p.pistonSteel));
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(bladeGeo, p.pistonSteel);
        blade.rotation.y = (b / 3) * Math.PI;
        rotorPivot.add(blade);
      }
      nacelle.add(rotorPivot);
      rotors.push(rotorPivot);
      bodyGroup.add(nacelle);

      // Rear coolant feed tube
      bodyGroup.add(
        new THREE.Mesh(
          this._makeTube(
            `interceptor_hose_${side}`,
            [
              [side * 0.14, 0.08, -0.24],
              [side * 0.42, 0.15, -0.32],
              [side * 0.64, 0.12, -0.20],
            ],
            0.016,
            8,
            6
          ),
          p.cableMat
        )
      );
    }

    // Rear jet exhaust thruster
    const exhaust = new THREE.Mesh(
      this._getGeo('interceptor_exhaust', () => new THREE.CylinderGeometry(0.11, 0.15, 0.24, 10)),
      p.darkFrame
    );
    exhaust.rotation.x = Math.PI * 0.5;
    exhaust.position.set(0, 0.04, -0.48);
    bodyGroup.add(exhaust);

    const thrusterGlow = new THREE.Mesh(
      this._getGeo('interceptor_thruster_core', () => new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10)),
      p.accentGlow
    );
    thrusterGlow.rotation.x = Math.PI * 0.5;
    thrusterGlow.position.set(0, 0.04, -0.58);
    bodyGroup.add(thrusterGlow);

    // Armored Sensor Pod Nose (headGroup / headAnchor)
    headGroup.position.set(0, 0.02, 0.38);
    bodyGroup.add(headGroup);

    const noseCowl = new THREE.Mesh(
      this._makeExtrudedPoly(
        'interceptor_nose_cowl',
        [
          [-0.18, 0.08],
          [0.18, 0.08],
          [0.12, -0.09],
          [-0.12, -0.09],
        ],
        0.18,
        0.018,
        0.015,
        1
      ),
      p.darkFrame
    );
    headGroup.add(noseCowl);

    const opticEye = new THREE.Mesh(
      this._getGeo('interceptor_optic_core', () => new THREE.BoxGeometry(0.24, 0.085, 0.10)),
      p.weakpointGlow
    );
    opticEye.position.set(0, 0, 0.08);
    headGroup.add(opticEye);

    headAnchor.position.set(0, 0, 0.08);
    headGroup.add(headAnchor);

    // Twin Wingtip Repeater Pods (rightArm -> weaponMuzzle, leftArm -> leftWeaponMuzzle)
    const podHousingGeo = this._getGeo('interceptor_pod_box', () => new THREE.BoxGeometry(0.11, 0.10, 0.36));
    const podBarrelGeo = this._getGeo('interceptor_pod_barrel', () => new THREE.CylinderGeometry(0.024, 0.028, 0.32, 8));
    const leftWeaponMuzzle = sharedLeftMuzzle || new THREE.Object3D();

    const mountPod = (armGroup, sideX, muzzleObj) => {
      armGroup.position.set(sideX, -0.09, 0.14);
      armGroup.add(new THREE.Mesh(podHousingGeo, p.darkFrame));
      const barrel = new THREE.Mesh(podBarrelGeo, p.pistonSteel);
      barrel.rotation.x = Math.PI * 0.5;
      barrel.position.set(0, -0.01, 0.24);
      armGroup.add(barrel);
      const collar = new THREE.Mesh(
        this._getGeo('interceptor_pod_collar', () => new THREE.CylinderGeometry(0.034, 0.034, 0.06, 8)),
        p.accentGlow
      );
      collar.rotation.x = Math.PI * 0.5;
      collar.position.set(0, -0.01, 0.34);
      armGroup.add(collar);
      muzzleObj.position.set(0, -0.01, 0.42);
      armGroup.add(muzzleObj);
      bodyGroup.add(armGroup);
    };

    mountPod(rightArm, -0.46, weaponMuzzle);
    mountPod(leftArm, 0.46, leftWeaponMuzzle);

    // --- Orbital Remodel: Swept-Forward Stealth Delta Wings, Plasma Halo Thrusters & Dorsal Holo Fin ---
    const deltaWingGeo = this._getGeo('interceptor_delta_wing', () => new THREE.BoxGeometry(0.68, 0.04, 0.42));
    const haloRingGeo = this._getGeo('interceptor_plasma_halo', () => new THREE.TorusGeometry(0.32, 0.032, 8, 22));
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(deltaWingGeo, p.primaryArmor);
      wing.position.set(side * 0.72, 0.06, 0.16);
      wing.rotation.set(0.08, side * -0.45, side * 0.18);
      bodyGroup.add(wing);

      const wingEdge = new THREE.Mesh(
        this._getGeo('interceptor_wing_holo', () => new THREE.PlaneGeometry(0.55, 0.18)),
        p.holoEnergy
      );
      wingEdge.position.set(side * 0.88, 0.06, 0.02);
      wingEdge.rotation.set(Math.PI * 0.5, 0, side * -0.45);
      bodyGroup.add(wingEdge);

      const halo = new THREE.Mesh(haloRingGeo, p.accentGlow);
      halo.position.set(side * 0.66, 0.08, -0.05);
      halo.rotation.x = Math.PI * 0.5;
      bodyGroup.add(halo);
      rotors.push(halo);
    }
    const dorsalFin = new THREE.Mesh(
      this._getGeo('interceptor_dorsal_fin', () => new THREE.ConeGeometry(0.14, 0.52, 4)),
      p.holoEnergy
    );
    dorsalFin.position.set(0, 0.44, -0.18);
    dorsalFin.rotation.x = -0.55;
    bodyGroup.add(dorsalFin);

    return leftWeaponMuzzle;
  }

  // ===========================================================================
  // 7. SHOCK BREACHER (Hunched Pneumatic Close-Assault Shotgunner + Ram Claw)
  // ===========================================================================
  _buildShockBreacher(
    p,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle
  ) {
    // Wide Digitigrade Pneumatic Breacher Legs (hip pivot at y = 0.96)
    const thighGeo = this._makeExtrudedPoly(
      'breacher_thigh',
      [
        [-0.13, 0.05],
        [0.13, 0.05],
        [0.16, -0.22],
        [0.11, -0.44],
        [-0.11, -0.44],
        [-0.16, -0.22],
      ],
      0.22,
      0.025,
      0.02,
      2
    );
    const shinGeo = this._makeExtrudedPoly(
      'breacher_shin',
      [
        [-0.12, 0.02],
        [0.12, 0.02],
        [0.14, -0.42],
        [0.10, -0.50],
        [-0.10, -0.50],
        [-0.14, -0.42],
      ],
      0.21,
      0.024,
      0.02,
      2
    );
    const footGeo = this._getGeo('breacher_foot', () => new THREE.BoxGeometry(0.24, 0.11, 0.38));

    const buildLeg = (legGroup, sideX) => {
      legGroup.position.set(sideX, 0.96, 0);
      const thigh = new THREE.Mesh(thighGeo, p.primaryArmor);
      thigh.rotation.x = -0.18;
      legGroup.add(thigh);
      const shin = new THREE.Mesh(shinGeo, p.darkFrame);
      shin.position.set(0, -0.42, 0.06);
      shin.rotation.x = 0.12;
      legGroup.add(shin);
      const piston = new THREE.Mesh(
        this._getGeo('breacher_piston', () => new THREE.CylinderGeometry(0.036, 0.036, 0.44, 8)),
        p.pistonSteel
      );
      piston.position.set(0, -0.62, -0.08);
      legGroup.add(piston);
      const foot = new THREE.Mesh(footGeo, p.coloredPlate);
      foot.position.set(0, -0.905, 0.07);
      legGroup.add(foot);
      bodyGroup.add(legGroup);
    };
    buildLeg(leftLeg, 0.24);
    buildLeg(rightLeg, -0.24);

    // Forward-Hunched Broad Siege Torso
    const pelvis = new THREE.Mesh(
      this._getGeo('breacher_pelvis', () => new THREE.BoxGeometry(0.56, 0.24, 0.34)),
      p.darkFrame
    );
    pelvis.position.set(0, 1.0, 0);
    bodyGroup.add(pelvis);

    const torsoGeo = this._makeExtrudedPoly(
      'breacher_torso',
      [
        [-0.46, 0.34],
        [0.46, 0.34],
        [0.36, -0.28],
        [-0.36, -0.28],
      ],
      0.44,
      0.04,
      0.032,
      2
    );
    const torso = new THREE.Mesh(torsoGeo, p.primaryArmor);
    torso.position.set(0, 1.42, 0.06);
    torso.rotation.x = 0.14;
    bodyGroup.add(torso);

    const breastPlate = new THREE.Mesh(
      this._getGeo('breacher_chest_plate', () => new THREE.BoxGeometry(0.68, 0.42, 0.14)),
      p.coloredPlate
    );
    breastPlate.position.set(0, 1.46, 0.28);
    breastPlate.rotation.x = -0.12;
    bodyGroup.add(breastPlate);

    // Dorsal Pressurized Plasma Canisters
    const tankGeo = this._getGeo('breacher_tank', () => new THREE.CylinderGeometry(0.11, 0.11, 0.56, 10));
    for (let side = -1; side <= 1; side += 2) {
      const tank = new THREE.Mesh(tankGeo, p.darkFrame);
      tank.position.set(side * 0.20, 1.54, -0.24);
      tank.rotation.x = -0.18;
      bodyGroup.add(tank);

      const band = new THREE.Mesh(
        this._getGeo('breacher_tank_glow', () => new THREE.CylinderGeometry(0.118, 0.118, 0.10, 10)),
        p.accentGlow
      );
      band.position.set(side * 0.20, 1.62, -0.25);
      band.rotation.x = -0.18;
      bodyGroup.add(band);
    }

    // Horned Jaw-Cage Helm (headHeight = 1.72)
    headGroup.position.set(0, 1.72, 0.16);
    bodyGroup.add(headGroup);

    const helmGeo = this._makeExtrudedPoly(
      'breacher_helm',
      [
        [-0.17, -0.11],
        [0.17, -0.11],
        [0.20, 0.08],
        [0.12, 0.20],
        [-0.12, 0.20],
        [-0.20, 0.08],
      ],
      0.26,
      0.025,
      0.02,
      2
    );
    headGroup.add(new THREE.Mesh(helmGeo, p.darkFrame));

    const twinVisor = new THREE.Mesh(
      this._getGeo('breacher_visor', () => new THREE.BoxGeometry(0.29, 0.085, 0.08)),
      p.weakpointGlow
    );
    twinVisor.position.set(0, 0.02, 0.13);
    headGroup.add(twinVisor);

    const hornGeo = this._getGeo('breacher_horn', () => new THREE.ConeGeometry(0.055, 0.22, 6));
    for (let side = -1; side <= 1; side += 2) {
      const horn = new THREE.Mesh(hornGeo, p.coloredPlate);
      horn.position.set(side * 0.16, 0.17, 0.02);
      horn.rotation.z = -side * 0.36;
      horn.rotation.x = 0.24;
      headGroup.add(horn);
    }
    headAnchor.position.set(0, 0.02, 0.06);
    headGroup.add(headAnchor);

    // Right Arm — Triple-Barrel Heavy Plasma Scattergun
    const pauldronGeo = this._getGeo('breacher_pauldron', () => new THREE.BoxGeometry(0.28, 0.26, 0.34));
    rightArm.position.set(-0.52, 1.56, 0.08);
    rightArm.add(new THREE.Mesh(pauldronGeo, p.coloredPlate));

    const shotgunGroup = new THREE.Group();
    shotgunGroup.position.set(-0.02, -0.32, 0.30);
    shotgunGroup.add(
      new THREE.Mesh(
        this._getGeo('breacher_shotgun_body', () => new THREE.BoxGeometry(0.18, 0.20, 0.56)),
        p.primaryArmor
      )
    );
    const barrelGeo = this._getGeo('breacher_shotgun_barrel', () => new THREE.CylinderGeometry(0.032, 0.032, 0.42, 8));
    for (let b = -1; b <= 1; b++) {
      const bar = new THREE.Mesh(barrelGeo, p.pistonSteel);
      bar.rotation.x = Math.PI * 0.5;
      bar.position.set(b * 0.052, 0.02, 0.36);
      shotgunGroup.add(bar);
    }
    const muzzleShroud = new THREE.Mesh(
      this._getGeo('breacher_muzzle_glow', () => new THREE.BoxGeometry(0.19, 0.06, 0.12)),
      p.accentGlow
    );
    muzzleShroud.position.set(0, 0.10, 0.44);
    shotgunGroup.add(muzzleShroud);
    weaponMuzzle.position.set(0, 0.02, 0.60);
    shotgunGroup.add(weaponMuzzle);
    rightArm.add(shotgunGroup);
    bodyGroup.add(rightArm);

    // Left Arm — Pneumatic Pile-Bunker Ram Gauntlet
    leftArm.position.set(0.52, 1.56, 0.08);
    leftArm.add(new THREE.Mesh(pauldronGeo, p.coloredPlate));
    const gauntlet = new THREE.Mesh(
      this._getGeo('breacher_ram_gauntlet', () => new THREE.BoxGeometry(0.22, 0.24, 0.44)),
      p.darkFrame
    );
    gauntlet.position.set(0.02, -0.30, 0.22);
    leftArm.add(gauntlet);
    const spike = new THREE.Mesh(
      this._getGeo('breacher_ram_spike', () => new THREE.ConeGeometry(0.085, 0.28, 6)),
      p.accentGlow
    );
    spike.rotation.x = Math.PI * 0.5;
    spike.position.set(0.02, -0.30, 0.52);
    leftArm.add(spike);
    bodyGroup.add(leftArm);

    // --- Orbital Remodel: Twin Cryo-Arc Gauntlet Rings, Dorsal Capacitor Spines & Energy Crest ---
    const arcRingGeo = this._getGeo('breacher_arc_ring', () => new THREE.TorusGeometry(0.19, 0.026, 8, 18));
    for (const arm of [leftArm, rightArm]) {
      const ring1 = new THREE.Mesh(arcRingGeo, p.accentGlow);
      ring1.position.set(0, -0.28, 0.34);
      arm.add(ring1);
      const shieldBlade = new THREE.Mesh(
        this._getGeo('breacher_holo_bracer', () => new THREE.BoxGeometry(0.06, 0.34, 0.46)),
        p.holoEnergy
      );
      shieldBlade.position.set(arm === leftArm ? 0.14 : -0.14, -0.26, 0.24);
      arm.add(shieldBlade);
    }
    const spineFinGeo = this._getGeo('breacher_spine_fin', () => new THREE.BoxGeometry(0.08, 0.38, 0.16));
    for (let s = -1; s <= 1; s++) {
      const fin = new THREE.Mesh(spineFinGeo, s === 0 ? p.accentGlow : p.primaryArmor);
      fin.position.set(s * 0.22, 1.56 - Math.abs(s) * 0.08, -0.34);
      fin.rotation.x = -0.38;
      fin.rotation.z = s * -0.22;
      bodyGroup.add(fin);
    }
    const helmCrest = new THREE.Mesh(
      this._getGeo('breacher_helm_crest', () => new THREE.BoxGeometry(0.06, 0.22, 0.34)),
      p.accentGlow
    );
    helmCrest.position.set(0, 0.22, -0.02);
    headGroup.add(helmCrest);
  }

  // ===========================================================================
  // 8. AEGIS PHALANX / RAIL WARDEN (2.4m Shielded Orbital Phalanx + Rail Lance)
  // ===========================================================================
  _buildRailWarden(
    p,
    ownedMaterials,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    sharedShieldMesh = null
  ) {
    // Heavy Orbital Armored Legs (hip pivot at y = 1.12)
    const thighGeo = this._makeExtrudedPoly(
      'warden_thigh',
      [
        [-0.14, 0.06],
        [0.14, 0.06],
        [0.17, -0.24],
        [0.12, -0.50],
        [-0.12, -0.50],
        [-0.17, -0.24],
      ],
      0.26,
      0.03,
      0.024,
      2
    );
    const shinGeo = this._makeExtrudedPoly(
      'warden_shin',
      [
        [-0.13, 0.02],
        [0.13, 0.02],
        [0.16, -0.48],
        [0.12, -0.56],
        [-0.12, -0.56],
        [-0.16, -0.48],
      ],
      0.24,
      0.028,
      0.022,
      2
    );
    const footGeo = this._getGeo('warden_foot', () => new THREE.BoxGeometry(0.28, 0.13, 0.42));

    const buildLeg = (legGroup, sideX) => {
      legGroup.position.set(sideX, 1.12, 0);
      legGroup.add(new THREE.Mesh(thighGeo, p.primaryArmor));
      const knee = new THREE.Mesh(
        this._getGeo('warden_knee', () => new THREE.BoxGeometry(0.22, 0.18, 0.12)),
        p.coloredPlate
      );
      knee.position.set(0, -0.48, 0.14);
      legGroup.add(knee);
      const shin = new THREE.Mesh(shinGeo, p.darkFrame);
      shin.position.set(0, -0.50, 0);
      legGroup.add(shin);
      const foot = new THREE.Mesh(footGeo, p.primaryArmor);
      foot.position.set(0, -1.055, 0.07);
      legGroup.add(foot);
      bodyGroup.add(legGroup);
    };
    buildLeg(leftLeg, 0.27);
    buildLeg(rightLeg, -0.27);

    // Tall Orbital Phalanx Chassis
    const pelvis = new THREE.Mesh(
      this._getGeo('warden_pelvis', () => new THREE.BoxGeometry(0.66, 0.28, 0.38)),
      p.darkFrame
    );
    pelvis.position.set(0, 1.15, 0);
    bodyGroup.add(pelvis);

    const torsoGeo = this._makeExtrudedPoly(
      'warden_torso',
      [
        [-0.50, 0.44],
        [-0.28, 0.56],
        [0.28, 0.56],
        [0.50, 0.44],
        [0.42, -0.22],
        [0.28, -0.36],
        [-0.28, -0.36],
        [-0.42, -0.22],
      ],
      0.46,
      0.045,
      0.036,
      2
    );
    const torso = new THREE.Mesh(torsoGeo, p.primaryArmor);
    torso.position.set(0, 1.66, 0.02);
    bodyGroup.add(torso);

    const sternum = new THREE.Mesh(
      this._getGeo('warden_sternum', () => new THREE.BoxGeometry(0.56, 0.52, 0.14)),
      p.coloredPlate
    );
    sternum.position.set(0, 1.70, 0.26);
    bodyGroup.add(sternum);

    // Dorsal Capacitor Backpack + Twin Cooling Fins
    const backpack = new THREE.Mesh(
      this._getGeo('warden_backpack', () => new THREE.BoxGeometry(0.52, 0.62, 0.28)),
      p.darkFrame
    );
    backpack.position.set(0, 1.72, -0.32);
    bodyGroup.add(backpack);

    const packCore = new THREE.Mesh(
      this._getGeo('warden_pack_glow', () => new THREE.BoxGeometry(0.32, 0.36, 0.06)),
      p.accentGlow
    );
    packCore.position.set(0, 1.74, -0.46);
    bodyGroup.add(packCore);

    // Crested Orbital Helm (headHeight = 2.08)
    headGroup.position.set(0, 2.08, 0.06);
    bodyGroup.add(headGroup);

    const helmGeo = this._makeExtrudedPoly(
      'warden_helm',
      [
        [-0.17, -0.12],
        [0.17, -0.12],
        [0.19, 0.10],
        [0.10, 0.24],
        [-0.10, 0.24],
        [-0.19, 0.10],
      ],
      0.27,
      0.028,
      0.022,
      2
    );
    headGroup.add(new THREE.Mesh(helmGeo, p.primaryArmor));

    const crestVisor = new THREE.Mesh(
      this._getGeo('warden_visor', () => new THREE.BoxGeometry(0.28, 0.095, 0.08)),
      p.weakpointGlow
    );
    crestVisor.position.set(0, 0.02, 0.14);
    headGroup.add(crestVisor);

    const headFin = new THREE.Mesh(
      this._getGeo('warden_crest_fin', () => new THREE.BoxGeometry(0.06, 0.20, 0.28)),
      p.coloredPlate
    );
    headFin.position.set(0, 0.22, -0.02);
    headGroup.add(headFin);

    headAnchor.position.set(0, 0.03, 0.04);
    headGroup.add(headAnchor);

    // Massive Flanged Shoulder Pauldrons
    const pauldronGeo = this._makeExtrudedPoly(
      'warden_pauldron',
      [
        [-0.22, 0.24],
        [0.18, 0.20],
        [0.24, -0.16],
        [-0.18, -0.16],
      ],
      0.38,
      0.034,
      0.028,
      2
    );

    // Right Arm — Long Twin-Rail Magnetic Accelerator Lance
    rightArm.position.set(-0.58, 1.88, 0.04);
    rightArm.add(new THREE.Mesh(pauldronGeo, p.coloredPlate));

    const railLance = new THREE.Group();
    railLance.position.set(-0.04, -0.34, 0.36);
    railLance.add(
      new THREE.Mesh(
        this._getGeo('warden_lance_breech', () => new THREE.BoxGeometry(0.18, 0.22, 0.54)),
        p.darkFrame
      )
    );
    const railBarGeo = this._getGeo('warden_rail_bar', () => new THREE.BoxGeometry(0.055, 0.055, 0.88));
    for (const ry of [-0.055, 0.055]) {
      const rail = new THREE.Mesh(railBarGeo, p.pistonSteel);
      rail.position.set(0, ry, 0.56);
      railLance.add(rail);
    }
    const coreSlot = new THREE.Mesh(
      this._getGeo('warden_rail_core', () => new THREE.BoxGeometry(0.042, 0.038, 0.78)),
      p.accentGlow
    );
    coreSlot.position.set(0, 0, 0.54);
    railLance.add(coreSlot);

    weaponMuzzle.position.set(0, 0, 1.04);
    railLance.add(weaponMuzzle);
    rightArm.add(railLance);
    bodyGroup.add(rightArm);

    // Left Arm — Tall Slotted Aegis Siege Tower Shield (shieldMesh)
    leftArm.position.set(0.58, 1.88, 0.06);
    const lPauldron = new THREE.Mesh(pauldronGeo, p.coloredPlate);
    lPauldron.scale.x = -1;
    leftArm.add(lPauldron);

    const shieldPivot = new THREE.Group();
    shieldPivot.position.set(-0.20, -0.52, 0.64);
    shieldPivot.rotation.y = -0.18;

    const frameBarGeo = this._getGeo('warden_shield_bar', () => new THREE.BoxGeometry(0.92, 0.11, 0.10));
    const topBar = new THREE.Mesh(frameBarGeo, p.primaryArmor);
    topBar.position.set(0, 0.72, -0.02);
    shieldPivot.add(topBar);
    const botBar = new THREE.Mesh(frameBarGeo, p.primaryArmor);
    botBar.position.set(0, -0.72, -0.02);
    shieldPivot.add(botBar);

    const sidePostGeo = this._getGeo('warden_shield_post', () => new THREE.BoxGeometry(0.09, 1.44, 0.09));
    for (let s = -1; s <= 1; s += 2) {
      const post = new THREE.Mesh(sidePostGeo, p.darkFrame);
      post.position.set(s * 0.46, 0, -0.02);
      shieldPivot.add(post);
    }

    const shieldMesh = sharedShieldMesh || this._createRailWardenShieldMesh(ownedMaterials);
    shieldMesh.renderOrder = 6;
    shieldPivot.add(shieldMesh);

    leftArm.add(shieldPivot);
    bodyGroup.add(leftArm);

    // --- Orbital Remodel: Twin Sweeping Cathedral Capacitor Wing-Pylons & Halo Crest ---
    const pylonGeo = this._getGeo('warden_wing_pylon', () => new THREE.BoxGeometry(0.12, 1.15, 0.28));
    const holoWingGeo = this._getGeo('warden_holo_wing', () => new THREE.PlaneGeometry(0.55, 1.05));
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(pylonGeo, p.primaryArmor);
      pylon.position.set(side * 0.62, 2.02, -0.32);
      pylon.rotation.set(-0.24, side * 0.18, side * -0.46);
      bodyGroup.add(pylon);

      const hWing = new THREE.Mesh(holoWingGeo, p.holoEnergy);
      hWing.position.set(side * 0.92, 2.18, -0.42);
      hWing.rotation.set(-0.2, side * 0.25, side * -0.46);
      bodyGroup.add(hWing);
    }
    const wardenHalo = new THREE.Mesh(
      this._getGeo('warden_head_halo', () => new THREE.TorusGeometry(0.28, 0.024, 8, 20)),
      p.accentGlow
    );
    wardenHalo.position.set(0, 0.24, -0.10);
    headGroup.add(wardenHalo);

    return shieldMesh;
  }

  // ===========================================================================
  // 9. SIEGE MORTAR (Wide-Stanced Bombardment Walker + Elevated Dorsal Cannon + Laser)
  // ===========================================================================
  _buildMortarArtillery(
    p,
    ownedMaterials,
    ownedGeometries,
    root,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    skipLaser = false
  ) {
    // Squat Heavy Stabilizer Legs (hip pivot at y = 0.88)
    const legStrutGeo = this._makeExtrudedPoly(
      'mortar_leg_strut',
      [
        [-0.14, 0.08],
        [0.14, 0.08],
        [0.24, -0.46],
        [0.20, -0.84],
        [-0.12, -0.84],
        [-0.18, -0.42],
      ],
      0.26,
      0.03,
      0.025,
      2
    );
    const padGeo = this._getGeo('mortar_foot_pad', () => new THREE.BoxGeometry(0.38, 0.14, 0.56));

    const buildStabilizer = (legGroup, sideX) => {
      legGroup.position.set(sideX, 0.88, 0);
      const strut = new THREE.Mesh(legStrutGeo, p.darkFrame);
      strut.position.set(sideX > 0 ? 0.08 : -0.08, 0, 0);
      strut.scale.x = sideX > 0 ? 1 : -1;
      legGroup.add(strut);

      const armorPlate = new THREE.Mesh(
        this._getGeo('mortar_leg_plate', () => new THREE.BoxGeometry(0.24, 0.44, 0.34)),
        p.primaryArmor
      );
      armorPlate.position.set(sideX > 0 ? 0.12 : -0.12, -0.34, 0.06);
      legGroup.add(armorPlate);

      const pad = new THREE.Mesh(padGeo, p.coloredPlate);
      pad.position.set(sideX > 0 ? 0.14 : -0.14, -0.81, 0.04);
      legGroup.add(pad);
      bodyGroup.add(legGroup);
    };
    buildStabilizer(leftLeg, 0.42);
    buildStabilizer(rightLeg, -0.42);

    // Wide Rotating Cylindrical Artillery Turret Hull
    const waistDrum = new THREE.Mesh(
      this._getGeo('mortar_waist_drum', () => new THREE.CylinderGeometry(0.46, 0.54, 0.42, 12)),
      p.darkFrame
    );
    waistDrum.position.set(0, 1.04, 0);
    bodyGroup.add(waistDrum);

    const turretHullGeo = this._makeExtrudedPoly(
      'mortar_turret_hull',
      [
        [-0.56, 0.28],
        [0.56, 0.28],
        [0.48, -0.26],
        [-0.48, -0.26],
      ],
      0.64,
      0.045,
      0.036,
      2
    );
    const turretHull = new THREE.Mesh(turretHullGeo, p.primaryArmor);
    turretHull.position.set(0, 1.46, 0);
    bodyGroup.add(turretHull);

    const glacisShield = new THREE.Mesh(
      this._getGeo('mortar_glacis', () => new THREE.BoxGeometry(0.84, 0.36, 0.18)),
      p.coloredPlate
    );
    glacisShield.position.set(0, 1.44, 0.36);
    glacisShield.rotation.x = -0.24;
    bodyGroup.add(glacisShield);

    // Front Optical Targeting Cyclops Turret (headHeight = 1.56)
    headGroup.position.set(0, 1.56, 0.38);
    bodyGroup.add(headGroup);

    const sensorPod = new THREE.Mesh(
      this._getGeo('mortar_sensor_pod', () => new THREE.CylinderGeometry(0.18, 0.20, 0.22, 12)),
      p.darkFrame
    );
    sensorPod.rotation.x = Math.PI * 0.5;
    headGroup.add(sensorPod);

    const eyeLens = new THREE.Mesh(
      this._getGeo('mortar_eye_lens', () => new THREE.SphereGeometry(0.135, 14, 10)),
      p.weakpointGlow
    );
    eyeLens.scale.set(1.0, 1.0, 0.65);
    eyeLens.position.set(0, 0, 0.09);
    headGroup.add(eyeLens);

    headAnchor.position.set(0, 0, 0.08);
    headGroup.add(headAnchor);

    // Right Arm — Elevated Dorsal Heavy Plasma Mortar Barrel
    rightArm.position.set(-0.18, 1.84, -0.02);
    const breech = new THREE.Mesh(
      this._getGeo('mortar_breech', () => new THREE.BoxGeometry(0.36, 0.34, 0.62)),
      p.darkFrame
    );
    breech.rotation.x = -0.22;
    rightArm.add(breech);

    const mortarTubeGeo = this._makeLathe(
      'mortar_cannon_tube',
      [
        [0.14, 0.0],
        [0.15, 0.22],
        [0.125, 0.26],
        [0.125, 0.78],
        [0.165, 0.84],
        [0.165, 0.96],
        [0.11, 0.96],
      ],
      16
    );
    const mortarTube = new THREE.Mesh(mortarTubeGeo, p.pistonSteel);
    mortarTube.rotation.x = Math.PI * 0.5 - 0.22;
    mortarTube.position.set(0, 0.06, 0.22);
    rightArm.add(mortarTube);

    const heatCollar = new THREE.Mesh(
      this._getGeo('mortar_heat_collar', () => new THREE.TorusGeometry(0.155, 0.024, 8, 16)),
      p.accentGlow
    );
    heatCollar.rotation.x = -0.22;
    heatCollar.position.set(0, 0.22, 0.88);
    rightArm.add(heatCollar);

    weaponMuzzle.position.set(0, 0.26, 1.14);
    rightArm.add(weaponMuzzle);
    bodyGroup.add(rightArm);

    // Left Arm — Heavy Rotary Ammunition Drum Pod
    leftArm.position.set(0.62, 1.48, -0.04);
    const ammoDrum = new THREE.Mesh(
      this._getGeo('mortar_ammo_drum', () => new THREE.CylinderGeometry(0.24, 0.24, 0.44, 12)),
      p.coloredPlate
    );
    ammoDrum.rotation.z = Math.PI * 0.5;
    leftArm.add(ammoDrum);
    leftArm.add(
      new THREE.Mesh(
        this._makeTube(
          'mortar_feed_chute',
          [
            [-0.12, 0.14, 0.0],
            [-0.44, 0.34, -0.04],
            [-0.72, 0.38, -0.04],
          ],
          0.045,
          8,
          6
        ),
        p.cableMat
      )
    );
    bodyGroup.add(leftArm);

    // --- Orbital Remodel: Hovering Anti-Gravity Base Ring, Plasma Mortar Coils & Dorsal Radar Dish ---
    const hoverRing = new THREE.Mesh(
      this._getGeo('mortar_hover_ring', () => new THREE.TorusGeometry(0.86, 0.055, 10, 28)),
      p.accentGlow
    );
    hoverRing.rotation.x = Math.PI * 0.5;
    hoverRing.position.set(0, 0.26, 0);
    bodyGroup.add(hoverRing);

    const hoverField = new THREE.Mesh(
      this._getGeo('mortar_hover_field', () => new THREE.CircleGeometry(0.82, 24)),
      p.holoEnergy
    );
    hoverField.rotation.x = -Math.PI * 0.5;
    hoverField.position.set(0, 0.24, 0);
    bodyGroup.add(hoverField);

    const coilGeo = this._getGeo('mortar_plasma_coil', () => new THREE.TorusGeometry(0.24, 0.03, 8, 18));
    for (let c = 0; c < 3; c++) {
      const coil = new THREE.Mesh(coilGeo, p.accentGlow);
      coil.position.set(0, 2.08 + c * 0.22, -0.18 - c * 0.14);
      coil.rotation.x = 0.55;
      bodyGroup.add(coil);
    }
    const radarDish = new THREE.Mesh(
      this._getGeo('mortar_radar_dish', () => new THREE.ConeGeometry(0.42, 0.18, 12, 1, true)),
      p.holoEnergy
    );
    radarDish.position.set(-0.48, 2.15, -0.35);
    radarDish.rotation.set(-0.65, 0.35, 0);
    bodyGroup.add(radarDish);

    // Neon-violet orbital target lock telegraph laser
    return skipLaser
      ? null
      : this._createLaserBeam(ownedMaterials, ownedGeometries, root, 0xa855f7, 0xf0abfc);
  }

  // ===========================================================================
  // 10. PHANTOM STALKER / VANGUARD ASSASSIN (Sleek Reverse-Jointed Cyber Flanker)
  // ===========================================================================
  _buildVanguardAssassin(
    p,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    sharedLeftMuzzle = null
  ) {
    // Sleek Reverse-Jointed Sprint Legs (hip pivot at y = 0.98)
    const thighGeo = this._makeExtrudedPoly(
      'assassin_thigh',
      [
        [-0.07, 0.03],
        [0.07, 0.03],
        [0.09, -0.22],
        [0.055, -0.44],
        [-0.055, -0.44],
        [-0.08, -0.22],
      ],
      0.13,
      0.016,
      0.014,
      2
    );
    const shinGeo = this._makeExtrudedPoly(
      'assassin_shin',
      [
        [-0.055, 0.02],
        [0.055, 0.02],
        [0.045, -0.46],
        [0.028, -0.54],
        [-0.028, -0.54],
        [-0.055, -0.24],
      ],
      0.11,
      0.012,
      0.01,
      1
    );
    const footGeo = this._getGeo('assassin_foot', () => new THREE.BoxGeometry(0.11, 0.07, 0.28));

    const buildLeg = (legGroup, sideX) => {
      legGroup.position.set(sideX, 0.98, 0);
      const thigh = new THREE.Mesh(thighGeo, p.primaryArmor);
      thigh.rotation.x = -0.20;
      legGroup.add(thigh);
      const shin = new THREE.Mesh(shinGeo, p.darkFrame);
      shin.position.set(0, -0.42, 0.06);
      shin.rotation.x = 0.16;
      legGroup.add(shin);
      const foot = new THREE.Mesh(footGeo, p.coloredPlate);
      foot.position.set(0, -0.945, 0.08);
      legGroup.add(foot);
      bodyGroup.add(legGroup);
    };
    buildLeg(leftLeg, 0.16);
    buildLeg(rightLeg, -0.16);

    // Tapered Aero-Hunter Torso + Twin Swept Dorsal Thruster Fins
    const torsoGeo = this._makeExtrudedPoly(
      'assassin_torso',
      [
        [-0.24, 0.28],
        [0.24, 0.28],
        [0.16, -0.06],
        [0.10, -0.28],
        [-0.10, -0.28],
        [-0.16, -0.06],
      ],
      0.22,
      0.024,
      0.02,
      2
    );
    const torso = new THREE.Mesh(torsoGeo, p.primaryArmor);
    torso.position.set(0, 1.32, 0.02);
    bodyGroup.add(torso);

    const finGeo = this._makeExtrudedPoly(
      'assassin_aero_fin',
      [
        [0.0, 0.0],
        [0.34, 0.36],
        [0.42, 0.18],
        [0.12, -0.16],
      ],
      0.036,
      0.009,
      0.008,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const fin = new THREE.Mesh(finGeo, p.coloredPlate);
      fin.scale.x = side;
      fin.position.set(side * 0.12, 1.48, -0.12);
      fin.rotation.y = side * 0.32;
      fin.rotation.x = -0.18;
      bodyGroup.add(fin);
    }

    const spineCore = new THREE.Mesh(
      this._getGeo('assassin_spine_glow', () => new THREE.BoxGeometry(0.05, 0.38, 0.04)),
      p.accentGlow
    );
    spineCore.position.set(0, 1.34, -0.13);
    bodyGroup.add(spineCore);

    // Angular Predator Cowl Helm (headHeight = 1.66)
    headGroup.position.set(0, 1.66, 0.08);
    bodyGroup.add(headGroup);

    const helmGeo = this._makeExtrudedPoly(
      'assassin_helm',
      [
        [-0.13, -0.09],
        [0.13, -0.09],
        [0.15, 0.07],
        [0.0, 0.19],
        [-0.15, 0.07],
      ],
      0.26,
      0.018,
      0.015,
      1
    );
    headGroup.add(new THREE.Mesh(helmGeo, p.darkFrame));

    const predatorVisor = new THREE.Mesh(
      this._getGeo('assassin_visor', () => new THREE.BoxGeometry(0.22, 0.065, 0.09)),
      p.weakpointGlow
    );
    predatorVisor.position.set(0, 0.02, 0.13);
    headGroup.add(predatorVisor);

    headAnchor.position.set(0, 0.02, 0.06);
    headGroup.add(headAnchor);

    // Right Arm — Suppressed Rapid Pulse Carbine
    const pauldronGeo = this._getGeo('assassin_pauldron', () => new THREE.BoxGeometry(0.16, 0.14, 0.22));
    rightArm.position.set(-0.28, 1.48, 0.02);
    rightArm.add(new THREE.Mesh(pauldronGeo, p.coloredPlate));
    const rArm = new THREE.Mesh(
      this._getGeo('assassin_arm_strut', () => new THREE.CylinderGeometry(0.045, 0.04, 0.34, 8)),
      p.pistonSteel
    );
    rArm.position.set(-0.02, -0.18, 0.08);
    rArm.rotation.x = -0.5;
    rightArm.add(rArm);

    const carbine = new THREE.Group();
    carbine.position.set(-0.02, -0.28, 0.28);
    carbine.add(
      new THREE.Mesh(
        this._getGeo('assassin_carbine_body', () => new THREE.BoxGeometry(0.08, 0.11, 0.44)),
        p.darkFrame
      )
    );
    const suppressor = new THREE.Mesh(
      this._getGeo('assassin_suppressor', () => new THREE.CylinderGeometry(0.028, 0.028, 0.28, 8)),
      p.pistonSteel
    );
    suppressor.rotation.x = Math.PI * 0.5;
    suppressor.position.set(0, 0.01, 0.34);
    carbine.add(suppressor);
    weaponMuzzle.position.set(0, 0.01, 0.50);
    carbine.add(weaponMuzzle);
    rightArm.add(carbine);
    bodyGroup.add(rightArm);

    // Left Arm — Long Thermal Wrist-Blade + Forearm Pulse Emitter
    leftArm.position.set(0.28, 1.48, 0.02);
    leftArm.add(new THREE.Mesh(pauldronGeo, p.coloredPlate));
    const lArm = new THREE.Mesh(
      this._getGeo('assassin_arm_strut', () => new THREE.CylinderGeometry(0.045, 0.04, 0.34, 8)),
      p.pistonSteel
    );
    lArm.position.set(0.02, -0.18, 0.08);
    lArm.rotation.x = -0.5;
    leftArm.add(lArm);

    const bladeGeo = this._makeExtrudedPoly(
      'assassin_wrist_blade',
      [
        [0.0, 0.03],
        [0.54, 0.0],
        [0.06, -0.06],
      ],
      0.024,
      0.005,
      0.005,
      1
    );
    const blade = new THREE.Mesh(bladeGeo, p.accentGlow);
    blade.rotation.y = -Math.PI * 0.5;
    blade.position.set(0.05, -0.28, 0.16);
    leftArm.add(blade);

    const leftWeaponMuzzle = sharedLeftMuzzle || new THREE.Object3D();
    leftWeaponMuzzle.position.set(0.02, -0.28, 0.44);
    leftArm.add(leftWeaponMuzzle);
    bodyGroup.add(leftArm);

    // --- Orbital Remodel: 4 Sweeping Holographic Wing-Blades, Forearm Plasma Katanas & Cyber Horns ---
    const wingBladeGeo = this._getGeo('assassin_holo_wing', () => new THREE.PlaneGeometry(0.22, 1.25));
    for (const side of [-1, 1]) {
      for (let w = 0; w < 2; w++) {
        const blade = new THREE.Mesh(wingBladeGeo, p.holoEnergy);
        blade.position.set(side * (0.42 + w * 0.28), 1.62 + w * 0.18, -0.34 - w * 0.12);
        blade.rotation.set(-0.35 - w * 0.15, side * 0.25, side * (-0.52 - w * 0.28));
        bodyGroup.add(blade);
      }
      const horn = new THREE.Mesh(
        this._getGeo('assassin_cyber_horn', () => new THREE.ConeGeometry(0.035, 0.28, 5)),
        p.accentGlow
      );
      horn.position.set(side * 0.12, 0.24, -0.04);
      horn.rotation.set(-0.45, 0, side * -0.28);
      headGroup.add(horn);
    }
    const katanaGeo = this._getGeo('assassin_plasma_katana', () => new THREE.BoxGeometry(0.03, 0.08, 0.78));
    for (const arm of [leftArm, rightArm]) {
      const katana = new THREE.Mesh(katanaGeo, p.holoEnergy);
      katana.position.set(0, -0.24, 0.56);
      arm.add(katana);
    }

    return leftWeaponMuzzle;
  }

  // ===========================================================================
  // 11. AEGIS-IX // ORBITAL OVERLORD (4.5m Stage-10 Final Boss Dreadnought)
  // ===========================================================================
  _buildAegisOverlordBoss(
    p,
    ownedMaterials,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    rotors,
    coreRings,
    sharedShieldMesh = null,
    sharedLeftMuzzle = null,
    rigRef = null
  ) {
    // Colossal Dreadnought Walker Legs (hip pivot at y = 2.08)
    const thighGeo = this._makeExtrudedPoly(
      'overlord_thigh',
      [
        [-0.28, 0.16],
        [0.28, 0.16],
        [0.34, -0.38],
        [0.26, -0.92],
        [-0.26, -0.92],
        [-0.34, -0.38],
      ],
      0.56,
      0.055,
      0.048,
      2
    );
    const shinGeo = this._makeExtrudedPoly(
      'overlord_shin',
      [
        [-0.26, 0.04],
        [0.26, 0.04],
        [0.32, -0.82],
        [0.24, -1.04],
        [-0.24, -1.04],
        [-0.32, -0.82],
      ],
      0.50,
      0.05,
      0.042,
      2
    );
    const clawToeGeo = this._makeExtrudedPoly(
      'overlord_toe',
      [
        [-0.13, -0.04],
        [0.13, -0.04],
        [0.10, 0.48],
        [-0.10, 0.48],
      ],
      0.24,
      0.025,
      0.02,
      1
    );

    const buildBossLeg = (legGroup, sideX) => {
      legGroup.position.set(sideX, 2.08, 0);
      const thigh = new THREE.Mesh(thighGeo, p.primaryArmor);
      thigh.rotation.x = -0.2;
      legGroup.add(thigh);

      const kneeRing = new THREE.Mesh(
        this._getGeo('overlord_knee_ring', () => new THREE.TorusGeometry(0.26, 0.036, 8, 16)),
        p.accentGlow
      );
      kneeRing.rotation.y = Math.PI * 0.5;
      kneeRing.position.set(sideX > 0 ? 0.28 : -0.28, -0.90, 0.16);
      legGroup.add(kneeRing);

      const shin = new THREE.Mesh(shinGeo, p.coloredPlate);
      shin.position.set(0, -0.94, 0.12);
      shin.rotation.x = 0.12;
      legGroup.add(shin);

      const footHub = new THREE.Mesh(
        this._getGeo('overlord_foot_hub', () => new THREE.CylinderGeometry(0.34, 0.42, 0.24, 8)),
        p.darkFrame
      );
      footHub.position.set(0, -1.96, 0.02);
      legGroup.add(footHub);

      for (const ang of [-0.55, 0.0, 0.55]) {
        const toe = new THREE.Mesh(clawToeGeo, p.primaryArmor);
        toe.rotation.x = Math.PI * 0.5;
        toe.rotation.z = -ang;
        toe.position.set(Math.sin(ang) * 0.30, -1.96, 0.16 + Math.cos(ang) * 0.12);
        legGroup.add(toe);
      }
      bodyGroup.add(legGroup);
    };
    buildBossLeg(leftLeg, 0.68);
    buildBossLeg(rightLeg, -0.68);

    // Armored Pelvis & Tiered Orbital Dreadnought Torso
    const pelvis = new THREE.Mesh(
      this._getGeo('overlord_pelvis', () => new THREE.BoxGeometry(1.48, 0.58, 0.78)),
      p.darkFrame
    );
    pelvis.position.set(0, 2.16, 0);
    bodyGroup.add(pelvis);

    const torsoGeo = this._makeExtrudedPoly(
      'overlord_torso',
      [
        [-1.08, 0.66],
        [-0.70, 0.90],
        [0.70, 0.90],
        [1.08, 0.66],
        [0.92, -0.28],
        [0.60, -0.66],
        [-0.60, -0.66],
        [-0.92, -0.28],
      ],
      1.0,
      0.09,
      0.075,
      2
    );
    const torso = new THREE.Mesh(torsoGeo, p.primaryArmor);
    torso.position.set(0, 3.12, 0.04);
    bodyGroup.add(torso);

    // Chest Orbital Core Turbine + Armored Ribs
    const coreDisc = new THREE.Mesh(
      this._getGeo('overlord_chest_core', () => new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16)),
      p.accentGlow
    );
    coreDisc.rotation.x = Math.PI * 0.5;
    coreDisc.position.set(0, 3.12, 0.56);
    bodyGroup.add(coreDisc);

    const grillGeo = this._getGeo('overlord_chest_rib', () => new THREE.BoxGeometry(0.76, 0.05, 0.06));
    for (let g = -2; g <= 2; g++) {
      const bar = new THREE.Mesh(grillGeo, p.darkFrame);
      bar.position.set(0, 3.12 + g * 0.11, 0.69);
      bodyGroup.add(bar);
    }

    // Twin Swept Dreadnought Wing-Thruster Pylons + Dorsal Exhaust Chimneys
    const wingPylonGeo = this._makeExtrudedPoly(
      'overlord_wing_pylon',
      [
        [0.0, 0.0],
        [0.86, 0.78],
        [1.12, 0.34],
        [0.24, -0.44],
      ],
      0.16,
      0.026,
      0.022,
      1
    );
    const wingCoreOrbGeo = this._getGeo('overlord_wing_core_orb', () => new THREE.SphereGeometry(0.34, 14, 10));
    const wingCoreHaloGeo = this._getGeo('overlord_wing_core_halo', () => new THREE.TorusGeometry(0.45, 0.048, 8, 22));
    const wingCoreCradleGeo = this._getGeo('overlord_wing_core_cradle', () => new THREE.CylinderGeometry(0.38, 0.44, 0.24, 10));
    const wingCoreStrutGeo = this._getGeo('overlord_wing_core_strut', () => new THREE.BoxGeometry(0.56, 0.14, 0.22));
    let wingCoreL = null;
    let wingCoreR = null;

    for (let side = -1; side <= 1; side += 2) {
      const wing = new THREE.Mesh(wingPylonGeo, p.coloredPlate);
      wing.scale.x = side;
      wing.position.set(side * 0.68, 3.46, -0.44);
      wing.rotation.y = side * 0.28;
      bodyGroup.add(wing);

      const thruster = new THREE.Mesh(
        this._getGeo('overlord_wing_thruster', () => new THREE.CylinderGeometry(0.18, 0.24, 0.85, 10)),
        p.darkFrame
      );
      thruster.position.set(side * 0.52, 3.72, -0.66);
      thruster.rotation.x = -0.22;
      bodyGroup.add(thruster);

      // Destructible Wing Core Weakpoint Pod (elevated above phase shield silhouette)
      const coreGroup = new THREE.Group();
      coreGroup.name = side > 0 ? 'WingCoreL' : 'WingCoreR';
      coreGroup.position.set(side * 1.62, 3.92, -0.14);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: new THREE.Color(0x00e5ff),
        emissiveIntensity: 3.6,
        roughness: 0.16,
        metalness: 0.25,
        fog: false,
      });
      coreMat.userData.baseColor = coreMat.color.clone();
      coreMat.userData.baseEmissive = coreMat.emissive.clone();
      coreMat.userData.baseEmissiveIntensity = coreMat.emissiveIntensity;
      ownedMaterials.push(coreMat);

      const haloMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: new THREE.Color(0xf59e0b),
        emissiveIntensity: 2.8,
        roughness: 0.2,
        metalness: 0.3,
        fog: false,
      });
      haloMat.userData.baseColor = haloMat.color.clone();
      haloMat.userData.baseEmissive = haloMat.emissive.clone();
      haloMat.userData.baseEmissiveIntensity = haloMat.emissiveIntensity;
      ownedMaterials.push(haloMat);

      const cradle = new THREE.Mesh(wingCoreCradleGeo, p.darkFrame);
      cradle.position.set(0, -0.16, 0);
      coreGroup.add(cradle);

      const strut = new THREE.Mesh(wingCoreStrutGeo, p.primaryArmor);
      strut.position.set(-side * 0.34, -0.18, -0.08);
      strut.rotation.z = side * 0.36;
      coreGroup.add(strut);

      const coreOrb = new THREE.Mesh(wingCoreOrbGeo, coreMat);
      coreGroup.add(coreOrb);

      const haloMesh = new THREE.Mesh(wingCoreHaloGeo, haloMat);
      haloMesh.rotation.x = 0.35;
      haloMesh.rotation.y = side * 0.45;
      coreGroup.add(haloMesh);

      coreGroup.userData.coreMaterial = coreMat;
      coreGroup.userData.haloMaterial = haloMat;
      coreGroup.userData.haloMesh = haloMesh;
      bodyGroup.add(coreGroup);

      if (side > 0) wingCoreL = coreGroup;
      else wingCoreR = coreGroup;
    }

    if (rigRef) {
      rigRef.wingCoreL = wingCoreL;
      rigRef.wingCoreR = wingCoreR;
    }

    // Winged Crown Helm housing Furnace Sensor Core Weakpoint (headHeight = 3.85)
    headGroup.position.set(0, 3.85, 0.18);
    bodyGroup.add(headGroup);

    const cranialCore = new THREE.Mesh(
      this._getGeo('overlord_cranial_core', () => new THREE.SphereGeometry(0.42, 16, 12)),
      p.weakpointGlow
    );
    headGroup.add(cranialCore);

    const hornGeo = this._makeExtrudedPoly(
      'overlord_crown_horn',
      [
        [-0.08, -0.24],
        [0.12, -0.18],
        [0.28, 0.54],
        [0.04, 0.64],
        [-0.08, 0.22],
      ],
      0.16,
      0.022,
      0.018,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const horn = new THREE.Mesh(hornGeo, p.coloredPlate);
      horn.position.set(side * 0.44, 0.14, -0.02);
      horn.scale.x = side;
      horn.rotation.y = side * 0.24;
      headGroup.add(horn);
    }

    const crownRing = new THREE.Mesh(
      this._getGeo('overlord_crown_ring', () => new THREE.TorusGeometry(0.48, 0.048, 10, 22)),
      p.darkFrame
    );
    crownRing.rotation.x = Math.PI * 0.5;
    crownRing.position.set(0, 0.04, 0);
    headGroup.add(crownRing);

    headAnchor.position.set(0, 0.06, 0.08);
    headGroup.add(headAnchor);

    // Twin Heavy Dual-Rail Siege Cannons (weaponMuzzle & leftWeaponMuzzle)
    const pauldronGeo = this._makeExtrudedPoly(
      'overlord_pauldron',
      [
        [-0.40, 0.36],
        [0.34, 0.30],
        [0.46, -0.26],
        [0.14, -0.44],
        [-0.36, -0.20],
      ],
      0.74,
      0.055,
      0.046,
      2
    );
    const cannonHousingGeo = this._getGeo('overlord_gun_housing', () => new THREE.BoxGeometry(0.54, 0.48, 0.96));
    const railBarrelGeo = this._getGeo('overlord_rail_barrel', () => new THREE.BoxGeometry(0.11, 0.11, 1.12));
    const clampDiskGeo = this._getGeo('overlord_rotor_clamp', () => new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10));

    const leftWeaponMuzzle = sharedLeftMuzzle || new THREE.Object3D();

    const buildOverlordArm = (armGroup, side, muzzleObj) => {
      armGroup.position.set(side * 1.36, 3.42, 0.08);
      const pauldron = new THREE.Mesh(pauldronGeo, p.coloredPlate);
      pauldron.position.set(side * 0.14, 0.14, 0);
      pauldron.scale.x = -side;
      armGroup.add(pauldron);

      const upper = new THREE.Mesh(
        this._getGeo('overlord_upper_arm', () => new THREE.CylinderGeometry(0.20, 0.18, 0.78, 10)),
        p.pistonSteel
      );
      upper.position.set(side * 0.12, -0.40, 0.08);
      upper.rotation.x = -0.26;
      armGroup.add(upper);

      const pod = new THREE.Group();
      pod.position.set(side * 0.14, -0.72, 0.58);
      pod.add(new THREE.Mesh(cannonHousingGeo, p.primaryArmor));

      // Twin heavy magnetic siege rails
      for (const rx of [-0.14, 0.14]) {
        const rail = new THREE.Mesh(railBarrelGeo, p.darkFrame);
        rail.position.set(rx, 0.02, 0.88);
        pod.add(rail);
      }

      // Central spinning internal accelerator core (rotors)
      const rotorCluster = new THREE.Group();
      rotorCluster.position.set(0, 0.02, 0.55);
      const disc = new THREE.Mesh(clampDiskGeo, p.accentGlow);
      disc.rotation.x = Math.PI * 0.5;
      disc.position.z = 0.62;
      rotorCluster.add(disc);
      const coreRod = new THREE.Mesh(
        this._getGeo('overlord_rotor_rod', () => new THREE.CylinderGeometry(0.06, 0.06, 1.05, 8)),
        p.pistonSteel
      );
      coreRod.rotation.x = Math.PI * 0.5;
      coreRod.position.z = 0.32;
      rotorCluster.add(coreRod);
      pod.add(rotorCluster);
      rotors.push(rotorCluster);

      muzzleObj.position.set(0, 0.02, 1.56);
      pod.add(muzzleObj);
      armGroup.add(pod);
      bodyGroup.add(armGroup);
    };

    buildOverlordArm(rightArm, -1, weaponMuzzle);
    buildOverlordArm(leftArm, 1, leftWeaponMuzzle);

    // 4 Rotating Gyroscopic Orbital Armor & Furnace Rings (coreRings)
    const ringConfigs = [
      { r: 1.85, tube: 0.055, tiltX: 0.42, tiltZ: 0.30, y: 3.12, color: 0x5c4b42, emissive: 0xf09d38 },
      { r: 2.12, tube: 0.050, tiltX: -0.55, tiltZ: 0.62, y: 3.14, color: 0x7c2d12, emissive: 0xff3b1f },
      { r: 2.36, tube: 0.044, tiltX: 0.78, tiltZ: -0.45, y: 3.10, color: 0x4f443d, emissive: 0xff6b1a },
      { r: 2.60, tube: 0.038, tiltX: -0.28, tiltZ: -0.72, y: 3.12, color: 0x3b404c, emissive: 0xe8923a },
    ];
    const finGeo = this._getGeo('overlord_ring_fin', () => new THREE.BoxGeometry(0.20, 0.14, 0.18));
    for (let i = 0; i < ringConfigs.length; i++) {
      const cfg = ringConfigs[i];
      const ringGroup = new THREE.Group();
      ringGroup.position.set(0, cfg.y, 0.04);
      ringGroup.rotation.set(cfg.tiltX, i * 0.95, cfg.tiltZ);
      ringGroup.userData.baseRotation = new THREE.Euler(cfg.tiltX, i * 0.95, cfg.tiltZ);

      const ringMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: new THREE.Color(cfg.emissive),
        emissiveIntensity: 1.6,
        roughness: 0.36,
        metalness: 0.74,
      });
      ringMat.userData.baseColor = ringMat.color.clone();
      ringMat.userData.baseEmissive = ringMat.emissive.clone();
      ringMat.userData.baseEmissiveIntensity = ringMat.emissiveIntensity;
      ownedMaterials.push(ringMat);

      const ringGeo = this._getGeo(`overlord_orbit_ring_${i}`, () => {
        return new THREE.TorusGeometry(cfg.r, cfg.tube, 8, 36);
      });
      ringGroup.add(new THREE.Mesh(ringGeo, ringMat));

      for (let n = 0; n < 6; n++) {
        const ang = (n / 6) * Math.PI * 2;
        const fin = new THREE.Mesh(finGeo, n % 2 === 0 ? p.darkFrame : ringMat);
        fin.position.set(Math.cos(ang) * cfg.r, Math.sin(ang) * cfg.r, 0);
        fin.rotation.z = ang;
        ringGroup.add(fin);
      }

      ringGroup.userData.ringMaterial = ringMat;
      bodyGroup.add(ringGroup);
      coreRings.push(ringGroup);
    }

    // Phase-Surge Heated Orbital Blast Shield Barrier
    const shieldMesh = sharedShieldMesh || this._createOverlordPhaseShieldMesh(ownedMaterials, bodyGroup);

    return { shieldMesh, leftWeaponMuzzle };
  }

  // ===========================================================================
  // 12. VOLATILE RUSHER (Overload Frenzy Canister Runner + Ground Blast Ring)
  // ===========================================================================
  _buildVolatileRusher(
    p,
    ownedMaterials,
    root,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    coreRings,
    sharedOverloadRing = null
  ) {
    const legGeo = this._getGeo('vol_rusher_leg', () => new THREE.BoxGeometry(0.14, 0.68, 0.18));
    const footGeo = this._getGeo('vol_rusher_foot', () => new THREE.BoxGeometry(0.18, 0.1, 0.28));
    for (const [legGrp, sx] of [
      [leftLeg, -0.22],
      [rightLeg, 0.22],
    ]) {
      legGrp.position.set(sx, 0.72, 0);
      const shin = new THREE.Mesh(legGeo, p.darkFrame);
      shin.position.set(0, -0.34, 0.02);
      legGrp.add(shin);
      const foot = new THREE.Mesh(footGeo, p.primaryArmor);
      foot.position.set(0, -0.66, 0.06);
      legGrp.add(foot);
      bodyGroup.add(legGrp);
    }

    // Hunched obsidian torso housing glowing unstable crimson-magenta plasma core
    const chestGeo = this._makeExtrudedPoly(
      'vol_rusher_chest',
      [
        [-0.3, -0.26],
        [0.3, -0.26],
        [0.38, 0.18],
        [0.18, 0.36],
        [-0.18, 0.36],
        [-0.38, 0.18],
      ],
      0.42,
      0.024,
      0.02,
      1
    );
    const chest = new THREE.Mesh(chestGeo, p.primaryArmor);
    chest.position.set(0, 0.96, 0);
    bodyGroup.add(chest);

    const reactorCore = new THREE.Mesh(
      this._getGeo('vol_rusher_core', () => new THREE.OctahedronGeometry(0.26, 1)),
      p.accentGlow
    );
    reactorCore.position.set(0, 1.0, 0.12);
    bodyGroup.add(reactorCore);

    const cageRing = new THREE.Group();
    cageRing.position.set(0, 1.0, 0.12);
    cageRing.add(
      new THREE.Mesh(
        this._getGeo('vol_rusher_cage', () => new THREE.TorusGeometry(0.32, 0.032, 8, 20)),
        p.coloredPlate
      )
    );
    bodyGroup.add(cageRing);
    coreRings.push(cageRing);

    // Cranial sensor pod (headHeight = 1.26)
    headGroup.position.set(0, 1.28, 0.14);
    bodyGroup.add(headGroup);
    const helm = new THREE.Mesh(
      this._getGeo('vol_rusher_helm', () => new THREE.BoxGeometry(0.32, 0.24, 0.34)),
      p.coloredPlate
    );
    headGroup.add(helm);
    const visor = new THREE.Mesh(
      this._getGeo('vol_rusher_visor', () => new THREE.BoxGeometry(0.28, 0.11, 0.08)),
      p.weakpointGlow
    );
    visor.position.set(0, 0, 0.16);
    headGroup.add(visor);
    headAnchor.position.set(0, 0, 0.05);
    headGroup.add(headAnchor);

    // Forward claw prongs + short-range plasma emitter
    const armGeo = this._getGeo('vol_rusher_arm', () => new THREE.BoxGeometry(0.12, 0.44, 0.14));
    leftArm.position.set(-0.38, 1.06, 0.08);
    leftArm.add(new THREE.Mesh(armGeo, p.pistonSteel));
    bodyGroup.add(leftArm);

    rightArm.position.set(0.38, 1.06, 0.08);
    rightArm.add(new THREE.Mesh(armGeo, p.pistonSteel));
    const barrel = new THREE.Mesh(
      this._getGeo('vol_rusher_barrel', () => new THREE.CylinderGeometry(0.06, 0.08, 0.42, 8)),
      p.darkFrame
    );
    barrel.rotation.x = Math.PI * 0.5;
    barrel.position.set(0, -0.14, 0.24);
    rightArm.add(barrel);
    weaponMuzzle.position.set(0, -0.14, 0.48);
    rightArm.add(weaponMuzzle);
    bodyGroup.add(rightArm);

    // Expanding ground telegraph ring for Overload Frenzy blast
    return sharedOverloadRing || this._createVolatileOverloadRing(ownedMaterials, root);
  }

  // ===========================================================================
  // 13. VOID WARPER (Dimensional Blink Flanker + Violet Mantle)
  // ===========================================================================
  _buildVoidWarper(
    p,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle
  ) {
    const legGeo = this._getGeo('warper_leg', () => new THREE.CylinderGeometry(0.08, 0.06, 0.92, 8));
    for (const [legGrp, sx] of [
      [leftLeg, -0.18],
      [rightLeg, 0.18],
    ]) {
      legGrp.position.set(sx, 0.92, 0);
      const leg = new THREE.Mesh(legGeo, p.darkFrame);
      leg.position.y = -0.46;
      legGrp.add(leg);
      const greave = new THREE.Mesh(
        this._getGeo('warper_greave', () => new THREE.BoxGeometry(0.14, 0.42, 0.18)),
        p.primaryArmor
      );
      greave.position.set(0, -0.62, 0.02);
      legGrp.add(greave);
      bodyGroup.add(legGrp);
    }

    const torsoGeo = this._makeExtrudedPoly(
      'warper_torso',
      [
        [-0.24, -0.34],
        [0.24, -0.34],
        [0.34, 0.22],
        [0.14, 0.4],
        [-0.14, 0.4],
        [-0.34, 0.22],
      ],
      0.34,
      0.022,
      0.018,
      1
    );
    const torso = new THREE.Mesh(torsoGeo, p.primaryArmor);
    torso.position.set(0, 1.24, 0);
    bodyGroup.add(torso);

    // Swept shoulder dimensional rift fins
    const finGeo = this._makeExtrudedPoly(
      'warper_fin',
      [
        [0, -0.05],
        [0.44, 0.38],
        [0.54, 0.12],
        [0.12, -0.22],
      ],
      0.08,
      0.014,
      0.012,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const fin = new THREE.Mesh(finGeo, p.coloredPlate);
      fin.scale.x = side;
      fin.position.set(side * 0.24, 1.46, -0.12);
      fin.rotation.y = side * 0.35;
      bodyGroup.add(fin);
    }

    const chestGem = new THREE.Mesh(
      this._getGeo('warper_gem', () => new THREE.OctahedronGeometry(0.12, 0)),
      p.accentGlow
    );
    chestGem.position.set(0, 1.28, 0.21);
    bodyGroup.add(chestGem);

    headGroup.position.set(0, 1.66, 0.04);
    bodyGroup.add(headGroup);
    const cowl = new THREE.Mesh(
      this._getGeo('warper_cowl', () => new THREE.ConeGeometry(0.2, 0.36, 6)),
      p.primaryArmor
    );
    cowl.rotation.x = Math.PI;
    headGroup.add(cowl);
    const optic = new THREE.Mesh(
      this._getGeo('warper_optic', () => new THREE.BoxGeometry(0.24, 0.07, 0.08)),
      p.weakpointGlow
    );
    optic.position.set(0, 0.02, 0.14);
    headGroup.add(optic);
    headAnchor.position.set(0, 0, 0.04);
    headGroup.add(headAnchor);

    // Twin blade/carbine arms
    leftArm.position.set(-0.34, 1.44, 0);
    const blade = new THREE.Mesh(
      this._getGeo('warper_blade', () => new THREE.BoxGeometry(0.05, 0.52, 0.14)),
      p.accentGlow
    );
    blade.position.set(0, -0.32, 0.2);
    blade.rotation.x = -0.7;
    leftArm.add(blade);
    bodyGroup.add(leftArm);

    rightArm.position.set(0.34, 1.44, 0);
    const rifle = new THREE.Mesh(
      this._getGeo('warper_rifle', () => new THREE.BoxGeometry(0.12, 0.14, 0.64)),
      p.coloredPlate
    );
    rifle.position.set(0, -0.22, 0.28);
    rightArm.add(rifle);
    weaponMuzzle.position.set(0, -0.22, 0.62);
    rightArm.add(weaponMuzzle);
    bodyGroup.add(rightArm);
  }

  // ===========================================================================
  // 14. VOID SWARMER (Airborne Rift-Summoned Construct)
  // ===========================================================================
  _buildVoidSwarmer(p, bodyGroup, headGroup, headAnchor, leftArm, rightArm, weaponMuzzle, rotors) {
    const hull = new THREE.Mesh(
      this._getGeo('swarmer_hull', () => new THREE.OctahedronGeometry(0.34, 1)),
      p.primaryArmor
    );
    hull.scale.set(1.15, 0.78, 1.3);
    bodyGroup.add(hull);

    const wingGeo = this._makeExtrudedPoly(
      'swarmer_wing',
      [
        [0, 0],
        [0.52, 0.16],
        [0.44, -0.14],
        [0.08, -0.18],
      ],
      0.05,
      0.01,
      0.01,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const wing = new THREE.Mesh(wingGeo, p.coloredPlate);
      wing.scale.x = side;
      wing.position.set(side * 0.2, 0.04, -0.06);
      bodyGroup.add(wing);

      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(side * 0.44, 0.14, -0.02);
      rotorGroup.add(
        new THREE.Mesh(
          this._getGeo('swarmer_rotor_ring', () => new THREE.TorusGeometry(0.16, 0.024, 6, 16)),
          p.holoEnergy
        )
      );
      bodyGroup.add(rotorGroup);
      rotors.push(rotorGroup);
    }

    headGroup.position.set(0, 0.06, 0.26);
    bodyGroup.add(headGroup);
    const eye = new THREE.Mesh(
      this._getGeo('swarmer_eye', () => new THREE.SphereGeometry(0.15, 10, 8)),
      p.weakpointGlow
    );
    headGroup.add(eye);
    headAnchor.position.set(0, 0, 0.04);
    headGroup.add(headAnchor);

    leftArm.position.set(-0.22, -0.12, 0.1);
    bodyGroup.add(leftArm);
    rightArm.position.set(0.22, -0.12, 0.12);
    const stinger = new THREE.Mesh(
      this._getGeo('swarmer_stinger', () => new THREE.BoxGeometry(0.08, 0.08, 0.34)),
      p.accentGlow
    );
    stinger.position.set(-0.22, -0.04, 0.22);
    rightArm.add(stinger);
    weaponMuzzle.position.set(-0.22, -0.04, 0.42);
    rightArm.add(weaponMuzzle);
    bodyGroup.add(rightArm);
  }

  // ===========================================================================
  // 15. ABYSS SENTINEL (Heavy Obsidian Shield Knight + Triple Plasma Repeater)
  // ===========================================================================
  _buildAbyssSentinel(
    p,
    ownedMaterials,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    sharedShieldMesh = null
  ) {
    const legGeo = this._getGeo('sentinel_leg', () => new THREE.BoxGeometry(0.26, 0.98, 0.3));
    for (const [legGrp, sx] of [
      [leftLeg, -0.3],
      [rightLeg, 0.3],
    ]) {
      legGrp.position.set(sx, 0.98, 0);
      const leg = new THREE.Mesh(legGeo, p.primaryArmor);
      leg.position.y = -0.49;
      legGrp.add(leg);
      bodyGroup.add(legGrp);
    }

    const chestGeo = this._makeExtrudedPoly(
      'sentinel_chest',
      [
        [-0.44, -0.42],
        [0.44, -0.42],
        [0.56, 0.24],
        [0.26, 0.52],
        [-0.26, 0.52],
        [-0.56, 0.24],
      ],
      0.58,
      0.035,
      0.028,
      2
    );
    const chest = new THREE.Mesh(chestGeo, p.primaryArmor);
    chest.position.set(0, 1.38, 0);
    bodyGroup.add(chest);

    const reactor = new THREE.Mesh(
      this._getGeo('sentinel_core', () => new THREE.CylinderGeometry(0.18, 0.18, 0.14, 12)),
      p.accentGlow
    );
    reactor.rotation.x = Math.PI * 0.5;
    reactor.position.set(0, 1.44, 0.34);
    bodyGroup.add(reactor);

    headGroup.position.set(0, 1.94, 0.08);
    bodyGroup.add(headGroup);
    const helm = new THREE.Mesh(
      this._getGeo('sentinel_helm', () => new THREE.BoxGeometry(0.36, 0.32, 0.38)),
      p.coloredPlate
    );
    headGroup.add(helm);
    const visor = new THREE.Mesh(
      this._getGeo('sentinel_visor', () => new THREE.BoxGeometry(0.32, 0.1, 0.08)),
      p.weakpointGlow
    );
    visor.position.set(0, 0.02, 0.2);
    headGroup.add(visor);
    headAnchor.position.set(0, 0, 0.05);
    headGroup.add(headAnchor);

    // Left arm with full abyssal reactive shield
    leftArm.position.set(-0.66, 1.56, 0.08);
    const pauldronL = new THREE.Mesh(
      this._getGeo('sentinel_pauldron', () => new THREE.BoxGeometry(0.34, 0.36, 0.42)),
      p.coloredPlate
    );
    leftArm.add(pauldronL);
    const shieldMesh = sharedShieldMesh || this._createAbyssSentinelShieldMesh(ownedMaterials);
    shieldMesh.position.set(-0.14, -0.34, 0.48);
    shieldMesh.rotation.y = 0.22;
    shieldMesh.renderOrder = 6;
    leftArm.add(shieldMesh);
    bodyGroup.add(leftArm);

    // Right arm triple-plasma repeater
    rightArm.position.set(0.66, 1.56, 0.06);
    rightArm.add(new THREE.Mesh(pauldronL.geometry, p.coloredPlate));
    const cannon = new THREE.Mesh(
      this._getGeo('sentinel_gun', () => new THREE.BoxGeometry(0.24, 0.24, 0.88)),
      p.darkFrame
    );
    cannon.position.set(0.06, -0.34, 0.42);
    rightArm.add(cannon);
    weaponMuzzle.position.set(0.06, -0.34, 0.9);
    rightArm.add(weaponMuzzle);
    bodyGroup.add(rightArm);

    return shieldMesh;
  }

  // ===========================================================================
  // 16. TRANSCENDENT-OMEGA (Wave 15 Final Abyssal Colossus Boss — 5.2m)
  // ===========================================================================
  _buildTranscendentOmegaBoss(
    p,
    ownedMaterials,
    bodyGroup,
    headGroup,
    headAnchor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMuzzle,
    rotors,
    coreRings,
    sharedShieldMesh = null,
    sharedLeftMuzzle = null
  ) {
    const thighGeo = this._getGeo('omega_thigh', () => new THREE.BoxGeometry(0.56, 1.15, 0.62));
    const shinGeo = this._getGeo('omega_shin', () => new THREE.BoxGeometry(0.46, 1.25, 0.56));
    const footGeo = this._getGeo('omega_foot', () => new THREE.BoxGeometry(0.7, 0.24, 0.95));
    for (const [legGrp, sx] of [
      [leftLeg, -0.68],
      [rightLeg, 0.68],
    ]) {
      legGrp.position.set(sx, 2.25, 0);
      const thigh = new THREE.Mesh(thighGeo, p.primaryArmor);
      thigh.position.y = -0.56;
      legGrp.add(thigh);
      const shin = new THREE.Mesh(shinGeo, p.darkFrame);
      shin.position.set(0, -1.55, 0.04);
      legGrp.add(shin);
      const foot = new THREE.Mesh(footGeo, p.coloredPlate);
      foot.position.set(0, -2.14, 0.14);
      legGrp.add(foot);
      bodyGroup.add(legGrp);
    }

    const pelvis = new THREE.Mesh(
      this._getGeo('omega_pelvis', () => new THREE.BoxGeometry(1.62, 0.52, 0.96)),
      p.darkFrame
    );
    pelvis.position.set(0, 2.28, 0);
    bodyGroup.add(pelvis);

    // Towering biomechanical abyssal carapace torso
    const chestGeo = this._makeExtrudedPoly(
      'omega_chest',
      [
        [-0.92, -0.74],
        [0.92, -0.74],
        [1.18, 0.42],
        [0.64, 0.92],
        [-0.64, 0.92],
        [-1.18, 0.42],
      ],
      1.12,
      0.06,
      0.045,
      2
    );
    const chest = new THREE.Mesh(chestGeo, p.primaryArmor);
    chest.position.set(0, 3.25, 0.04);
    bodyGroup.add(chest);

    const singularityCore = new THREE.Mesh(
      this._getGeo('omega_singularity_core', () => new THREE.OctahedronGeometry(0.54, 1)),
      p.accentGlow
    );
    singularityCore.position.set(0, 3.28, 0.56);
    bodyGroup.add(singularityCore);

    // Dorsal obsidian wing-ribs
    const wingGeo = this._makeExtrudedPoly(
      'omega_wing',
      [
        [0, 0],
        [1.35, 1.15],
        [1.65, 0.42],
        [0.32, -0.55],
      ],
      0.16,
      0.025,
      0.02,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const wing = new THREE.Mesh(wingGeo, p.coloredPlate);
      wing.scale.x = side;
      wing.position.set(side * 0.72, 3.65, -0.52);
      wing.rotation.y = side * 0.34;
      bodyGroup.add(wing);
    }

    // Floating horned crown helm (headHeight = 4.35)
    headGroup.position.set(0, 4.35, 0.16);
    bodyGroup.add(headGroup);
    const cranial = new THREE.Mesh(
      this._getGeo('omega_head_core', () => new THREE.SphereGeometry(0.46, 16, 12)),
      p.weakpointGlow
    );
    headGroup.add(cranial);
    const hornGeo = this._makeExtrudedPoly(
      'omega_crown_horn',
      [
        [-0.1, -0.25],
        [0.14, -0.2],
        [0.36, 0.72],
        [0.06, 0.82],
        [-0.1, 0.28],
      ],
      0.16,
      0.022,
      0.018,
      1
    );
    for (let side = -1; side <= 1; side += 2) {
      const horn = new THREE.Mesh(hornGeo, p.coloredPlate);
      horn.scale.x = side;
      horn.position.set(side * 0.48, 0.16, -0.02);
      horn.rotation.y = side * 0.25;
      headGroup.add(horn);
    }
    headAnchor.position.set(0, 0.04, 0.08);
    headGroup.add(headAnchor);

    // Twin siege-void arm cannons (weaponMuzzle & leftWeaponMuzzle)
    const housingGeo = this._getGeo('omega_cannon', () => new THREE.BoxGeometry(0.56, 0.52, 1.18));
    const discGeo = this._getGeo('omega_rotor_disc', () => new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12));
    const leftWeaponMuzzle = sharedLeftMuzzle || new THREE.Object3D();

    const buildOmegaArm = (armGroup, side, muzzleObj) => {
      armGroup.position.set(side * 1.48, 3.68, 0.08);
      const pauldron = new THREE.Mesh(
        this._getGeo('omega_pauldron', () => new THREE.BoxGeometry(0.74, 0.72, 0.84)),
        p.coloredPlate
      );
      pauldron.position.set(side * 0.14, 0.1, 0);
      armGroup.add(pauldron);

      const pod = new THREE.Group();
      pod.position.set(side * 0.16, -0.76, 0.58);
      pod.add(new THREE.Mesh(housingGeo, p.primaryArmor));

      const rotorCluster = new THREE.Group();
      rotorCluster.position.set(0, 0, 0.68);
      const disc = new THREE.Mesh(discGeo, p.accentGlow);
      disc.rotation.x = Math.PI * 0.5;
      disc.position.z = 0.52;
      rotorCluster.add(disc);
      pod.add(rotorCluster);
      rotors.push(rotorCluster);

      muzzleObj.position.set(0, 0, 1.56);
      pod.add(muzzleObj);
      armGroup.add(pod);
      bodyGroup.add(armGroup);
    };
    buildOmegaArm(rightArm, -1, weaponMuzzle);
    buildOmegaArm(leftArm, 1, leftWeaponMuzzle);

    // 4 Gyroscopic Singularity Rings (coreRings)
    const omegaRings = [
      { r: 2.05, tube: 0.055, tiltX: 0.44, tiltZ: 0.28, y: 3.35, color: 0x581c87, emissive: 0xc084fc },
      { r: 2.35, tube: 0.05, tiltX: -0.52, tiltZ: 0.64, y: 3.36, color: 0x1e1b4b, emissive: 0x38bdf8 },
      { r: 2.65, tube: 0.044, tiltX: 0.76, tiltZ: -0.44, y: 3.34, color: 0x4c0519, emissive: 0xf43f5e },
      { r: 2.95, tube: 0.038, tiltX: -0.26, tiltZ: -0.72, y: 3.35, color: 0x3b0764, emissive: 0xe879f9 },
    ];
    for (let i = 0; i < omegaRings.length; i++) {
      const cfg = omegaRings[i];
      const ringGroup = new THREE.Group();
      ringGroup.position.set(0, cfg.y, 0.04);
      ringGroup.rotation.set(cfg.tiltX, i * 0.9, cfg.tiltZ);
      ringGroup.userData.baseRotation = new THREE.Euler(cfg.tiltX, i * 0.9, cfg.tiltZ);

      const ringMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: new THREE.Color(cfg.emissive),
        emissiveIntensity: 1.9,
        roughness: 0.3,
        metalness: 0.78,
      });
      ringMat.userData.baseColor = ringMat.color.clone();
      ringMat.userData.baseEmissive = ringMat.emissive.clone();
      ringMat.userData.baseEmissiveIntensity = ringMat.emissiveIntensity;
      ownedMaterials.push(ringMat);

      const ringGeo = this._getGeo(`omega_orbit_ring_${i}`, () => {
        return new THREE.TorusGeometry(cfg.r, cfg.tube, 8, 36);
      });
      ringGroup.add(new THREE.Mesh(ringGeo, ringMat));
      ringGroup.userData.ringMaterial = ringMat;
      bodyGroup.add(ringGroup);
      coreRings.push(ringGroup);
    }

    // Turret-Link Abyssal Barrier Cylinder (visible while turrets live or phase shield surges)
    const shieldMesh = sharedShieldMesh || this._createOmegaTurretShieldMesh(ownedMaterials, bodyGroup);

    return { shieldMesh, leftWeaponMuzzle };
  }

  /**
   * Dispose all shared procedural textures, shared contact shadow material, and cached GPU geometries.
   * Call only on full application teardown.
   */
  dispose() {
    for (const geo of this._geoCache.values()) {
      geo.dispose();
    }
    this._geoCache.clear();
    if (this._contactShadowMat) {
      this._contactShadowMat.dispose();
      this._contactShadowMat = null;
    }
    if (this._textures.armorWear) this._textures.armorWear.dispose();
    if (this._textures.armorBump) this._textures.armorBump.dispose();
    if (this._textures.armorRoughness) this._textures.armorRoughness.dispose();
    if (this._textures.blastShield) this._textures.blastShield.dispose();
    if (this._textures.hexShield && this._textures.hexShield !== this._textures.blastShield) {
      this._textures.hexShield.dispose();
    }
    if (this._textures.visorGrid) this._textures.visorGrid.dispose();
    if (this._textures.contactShadow) this._textures.contactShadow.dispose();
  }
}
EnemyModelFactory._glbCache = new Map();
EnemyModelFactory._glbMissing = new Set();
EnemyModelFactory._glbLoadPromise = null;
EnemyModelFactory._colossusGltf = null;
EnemyModelFactory._sharedMechDetailMaps = null;
  __exports.EnemyModelFactory = EnemyModelFactory;
  __exports.GLB_MODEL_REGISTRY = GLB_MODEL_REGISTRY;
  __exports.ALL_GLB_MODELS = ALL_GLB_MODELS;
});
