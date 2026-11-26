// Module: src/world/TextureGenerator.js
__define("src/world/TextureGenerator.js", (__exports, __require) => {
/**
 * Deterministic fast PRNG (Mulberry32) for consistent procedural PBR art direction.
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
 * Tileable 2D value noise helper on a periodic grid so 512x512 textures wrap seamlessly.
 * @param {number} gridSize
 * @param {number} seed
 */
function createTileableNoise(gridSize, seed) {
  const rng = createRng(seed);
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = rng();
  }

  return function sample(u, v) {
    const x = (((u % 1) + 1) % 1) * gridSize;
    const y = (((v % 1) + 1) % 1) * gridSize;
    const x0 = Math.floor(x) % gridSize;
    const y0 = Math.floor(y) % gridSize;
    const x1 = (x0 + 1) % gridSize;
    const y1 = (y0 + 1) % gridSize;

    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = grid[y0 * gridSize + x0];
    const n10 = grid[y0 * gridSize + x1];
    const n01 = grid[y1 * gridSize + x0];
    const n11 = grid[y1 * gridSize + x1];

    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  };
}

/**
 * Tileable Worley / cellular ridge distance helper (F2 - F1) for seamless asphalt cracks
 * and volcanic basalt cooling fissures.
 * @param {number} cells
 * @param {number} seed
 */
function createTileableCellCracks(cells, seed) {
  const rng = createRng(seed);
  const ptsX = new Float32Array(cells * cells);
  const ptsY = new Float32Array(cells * cells);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const idx = cy * cells + cx;
      ptsX[idx] = cx + 0.14 + rng() * 0.72;
      ptsY[idx] = cy + 0.14 + rng() * 0.72;
    }
  }

  return function sampleEdge(u, v) {
    const gx = (((u % 1) + 1) % 1) * cells;
    const gy = (((v % 1) + 1) % 1) * cells;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);

    let d1 = 99;
    let d2 = 99;

    for (let oy = -1; oy <= 1; oy++) {
      const ncy = ((iy + oy) % cells + cells) % cells;
      const shiftY = iy + oy - ncy;
      for (let ox = -1; ox <= 1; ox++) {
        const ncx = ((ix + ox) % cells + cells) % cells;
        const shiftX = ix + ox - ncx;
        const idx = ncy * cells + ncx;
        const dx = ptsX[idx] + shiftX - gx;
        const dy = ptsY[idx] + shiftY - gy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < d1) {
          d2 = d1;
          d1 = dist;
        } else if (dist < d2) {
          d2 = dist;
        }
      }
    }
    return d2 - d1;
  };
}

/**
 * Portable rounded rectangle path helper (works across all WebView / Canvas2D versions).
 */
function traceRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * Parse a hex color string like '#f59e0b' into { r, g, b } components.
 */
function parseHexColor(hex) {
  const clean = typeof hex === 'string' ? hex.replace('#', '') : 'f59e0b';
  const num = parseInt(
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean,
    16
  );
  if (!Number.isFinite(num)) return { r: 245, g: 158, b: 11 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Procedural 512x512 Canvas PBR Texture Generator for AETHER DROP: RECLAIM EARTH.
 * Produces 100% Post-Apocalyptic Earth Reclamation materials (zero neon) shared across
 * Map 1 (Dead Metropolis), Map 2 (Sunken Refinery), and Map 3 (Crater Citadel),
 * with seamless RepeatWrapping, proper color spaces, anisotropic filtering, and disposal tracking.
 */
class TextureGenerator {
  /**
   * @param {number} [anisotropy=4]
   */
  constructor(anisotropy = 4) {
    this._anisotropy = Math.max(1, Math.min(16, anisotropy || 4));
    /** @type {THREE.CanvasTexture[]} */
    this._textures = [];
    /** @type {Map<string, any>} */
    this._cache = new Map();
  }

  /** @private */
  _createCanvas(width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  }

  /** @private */
  _buildTexture(canvas, { isColor = true, repeatX = 1, repeatY = 1, wrap = true, wrapS, wrapT } = {}) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = wrapS !== undefined ? wrapS : wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = wrapT !== undefined ? wrapT : wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = this._anisotropy;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this._textures.push(tex);
    return tex;
  }

  /**
   * 512x512 cracked asphalt slabs + wind-blown ochre sand drifts + faded military tarmac markings.
   * Zero emissiveMap.
   *
   * @param {number} [repeatX=16]
   * @param {number} [repeatY=16]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getFloorTextures(repeatX = 16, repeatY = 16) {
    const cacheKey = `floor_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);

    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const rng = createRng(9091);
    const sandLow = createTileableNoise(5, 101);
    const sandDetail = createTileableNoise(16, 202);
    const aggregate = createTileableNoise(48, 303);
    const crackNoise = createTileableCellCracks(6, 404);
    const crackWarp = createTileableNoise(14, 505);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);
    const aData = aImg.data;
    const rData = rImg.data;
    const bData = bImg.data;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;

        const agg = aggregate(u, v);
        const coarse = sandDetail(u, v);
        const warp = (crackWarp(u, v) - 0.5) * 0.032;

        // Wind-blown ochre sand ripples & drifts
        const windRipple = Math.sin((u * 10 + v * 3 + coarse * 1.4) * Math.PI * 2) * 0.5 + 0.5;
        const driftBase = sandLow(u, v) * 0.68 + coarse * 0.32;
        const sandFactor = smoothstep(0.51, 0.74, driftBase + windRipple * 0.08);

        // Cracked tarmac fissures
        const cDist = crackNoise(u + warp, v - warp * 0.8);
        const crack = 1 - smoothstep(0.012, 0.044, cDist);

        // Base sun-bleached dark asphalt tarmac (#35312d + aggregate grit)
        let r = 42 + agg * 22 + coarse * 8;
        let g = 39 + agg * 19 + coarse * 7;
        let b = 36 + agg * 16 + coarse * 6;
        let roughVal = 156 + agg * 42 - coarse * 16;
        let bumpVal = 154 + (agg - 0.5) * 44;

        // Blend wind-blown ochre-amber desert dust over tarmac
        if (sandFactor > 0.005) {
          const sr = 148 + windRipple * 22 + agg * 14;
          const sg = 114 + windRipple * 16 + agg * 12;
          const sb = 76 + windRipple * 10 + agg * 8;
          r = r * (1 - sandFactor) + sr * sandFactor;
          g = g * (1 - sandFactor) + sg * sandFactor;
          b = b * (1 - sandFactor) + sb * sandFactor;
          roughVal = roughVal * (1 - sandFactor) + (222 + agg * 22) * sandFactor;
          bumpVal = bumpVal * (1 - sandFactor) + (168 + windRipple * 18) * sandFactor;
        }

        // Carve weathered fracture cracks filled with dark ash/sand
        if (crack > 0.01) {
          r = r * (1 - crack * 0.72) + 22 * crack;
          g = g * (1 - crack * 0.72) + 18 * crack;
          b = b * (1 - crack * 0.72) + 15 * crack;
          roughVal = roughVal * (1 - crack) + 236 * crack;
          bumpVal = bumpVal * (1 - crack) + 28 * crack;
        }

        aData[idx] = clampByte(r);
        aData[idx + 1] = clampByte(g);
        aData[idx + 2] = clampByte(b);
        aData[idx + 3] = 255;

        const rv = clampByte(roughVal);
        rData[idx] = rv;
        rData[idx + 1] = rv;
        rData[idx + 2] = rv;
        rData[idx + 3] = 255;

        const bv = clampByte(bumpVal);
        bData[idx] = bv;
        bData[idx + 1] = bv;
        bData[idx + 2] = bv;
        bData[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // 2. Concrete expansion joints forming 2x2 highway tarmac slabs (seam-aligned at 0, 256, 512)
    const seams = [0, 256, 512];
    for (let i = 0; i < seams.length; i++) {
      const s = seams[i];
      aCtx.fillStyle = 'rgba(18, 15, 13, 0.85)';
      aCtx.fillRect(s - 3, 0, 6, size);
      aCtx.fillRect(0, s - 3, size, 6);

      // Dust packed along slab joint shoulders
      aCtx.fillStyle = 'rgba(146, 112, 74, 0.28)';
      aCtx.fillRect(s + 3, 0, 6, size);
      aCtx.fillRect(0, s + 3, size, 6);

      bCtx.fillStyle = '#1a1a1a';
      bCtx.fillRect(s - 3, 0, 6, size);
      bCtx.fillRect(0, s - 3, size, 6);

      rCtx.fillStyle = '#e8e8e8';
      rCtx.fillRect(s - 4, 0, 8, size);
      rCtx.fillRect(0, s - 4, size, 8);
    }

    // 3. Faded military tarmac markings (broken ochre lane stripes & stenciled zone hash)
    aCtx.save();
    aCtx.fillStyle = 'rgba(198, 148, 66, 0.36)';
    aCtx.fillRect(118, 22, 16, 92);
    aCtx.fillRect(118, 142, 16, 92);
    aCtx.fillRect(374, 278, 16, 92);
    aCtx.fillRect(374, 398, 16, 92);

    // Faded off-white military drop-lane boundary dashes
    aCtx.fillStyle = 'rgba(196, 186, 166, 0.24)';
    aCtx.fillRect(26, 232, 84, 10);
    aCtx.fillRect(282, 488, 84, 10);

    // Erode painted lines with grit speckles so they read as sun-bleached & chipped
    for (let i = 0; i < 220; i++) {
      const ex = rng() * size;
      const ey = rng() * size;
      aCtx.fillStyle = rng() > 0.5 ? 'rgba(54, 48, 42, 0.45)' : 'rgba(138, 106, 70, 0.32)';
      aCtx.fillRect(ex, ey, 3 + rng() * 8, 2 + rng() * 6);
    }
    aCtx.restore();

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 weathered brutalist concrete walls with exposed rebar scars,
   * rainwater/rust streaks, and formwork tie holes.
   *
   * @param {number} [repeatX=8]
   * @param {number} [repeatY=2]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getWallTextures(repeatX = 8, repeatY = 2) {
    const cacheKey = `wall_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);

    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const rng = createRng(4242);
    const concreteNoise = createTileableNoise(18, 511);
    const fineNoise = createTileableNoise(56, 619);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      const isPlinth = y >= 376;
      const isMidBand = y >= 160 && y <= 350;

      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        const n1 = concreteNoise(u, v);
        const n2 = fineNoise(u, v);
        const mix = n1 * 0.62 + n2 * 0.38;

        // Warm weathered ash-concrete tones (darker soot plinth near ground)
        const base = isPlinth ? 52 + mix * 24 : isMidBand ? 76 + mix * 30 : 68 + mix * 28;
        aImg.data[idx] = clampByte(base * 1.04);
        aImg.data[idx + 1] = clampByte(base * 0.96);
        aImg.data[idx + 2] = clampByte(base * 0.86);
        aImg.data[idx + 3] = 255;

        const rVal = clampByte(isPlinth ? 204 + mix * 36 : 188 + mix * 46);
        rImg.data[idx] = rVal;
        rImg.data[idx + 1] = rVal;
        rImg.data[idx + 2] = rVal;
        rImg.data[idx + 3] = 255;

        const bVal = clampByte(150 + (mix - 0.5) * 46);
        bImg.data[idx] = bVal;
        bImg.data[idx + 1] = bVal;
        bImg.data[idx + 2] = bVal;
        bImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // Horizontal architectural formwork pours & vertical slab joints
    const hJoints = [0, 160, 352, 376, 512];
    for (let i = 0; i < hJoints.length; i++) {
      const y = hJoints[i];
      aCtx.fillStyle = '#231e1b';
      aCtx.fillRect(0, y - 3, size, 6);
      bCtx.fillStyle = '#181818';
      bCtx.fillRect(0, y - 3, size, 6);
      rCtx.fillStyle = '#ececec';
      rCtx.fillRect(0, y - 3, size, 6);
    }

    for (const x of [0, 256, 512]) {
      aCtx.fillStyle = '#231e1b';
      aCtx.fillRect(x - 3, 0, 6, size);
      bCtx.fillStyle = '#181818';
      bCtx.fillRect(x - 3, 0, 6, size);
    }

    // Formwork tie-rod holes + rust bleed drips underneath each hole
    const holeRows = [54, 118, 224, 304, 434];
    for (let p = 0; p < 2; p++) {
      const ox = p * 256;
      for (let hr = 0; hr < holeRows.length; hr++) {
        const hy = holeRows[hr];
        for (const hx of [ox + 42, ox + 128, ox + 214]) {
          // Recessed formwork cone hole
          aCtx.fillStyle = '#1c1714';
          aCtx.beginPath();
          aCtx.arc(hx, hy, 5.5, 0, Math.PI * 2);
          aCtx.fill();

          bCtx.fillStyle = '#121212';
          bCtx.beginPath();
          bCtx.arc(hx, hy, 5.5, 0, Math.PI * 2);
          bCtx.fill();

          // Rust stain weeping below tie hole
          const dripLen = 28 + rng() * 44;
          const dripGrad = aCtx.createLinearGradient(hx, hy, hx, hy + dripLen);
          dripGrad.addColorStop(0, 'rgba(116, 58, 28, 0.52)');
          dripGrad.addColorStop(1, 'rgba(116, 58, 28, 0.0)');
          aCtx.fillStyle = dripGrad;
          aCtx.fillRect(hx - 2.5, hy + 2, 5, dripLen);
        }
      }
    }

    // Exposed rebar spalling scars (2 dramatic battle-damaged concrete cavities)
    const rebarScars = [
      { cx: 128, cy: 256, rx: 52, ry: 28 },
      { cx: 392, cy: 102, rx: 44, ry: 24 },
    ];
    for (let s = 0; s < rebarScars.length; s++) {
      const scar = rebarScars[s];
      const traceScar = (ctx) => {
        ctx.beginPath();
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          const jitter = 0.72 + rng() * 0.45;
          const px = scar.cx + Math.cos(a) * scar.rx * jitter;
          const py = scar.cy + Math.sin(a) * scar.ry * jitter;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      traceScar(aCtx);
      aCtx.fillStyle = '#241c17';
      aCtx.fill();
      aCtx.strokeStyle = '#6a5b4e';
      aCtx.lineWidth = 3;
      aCtx.stroke();

      traceScar(bCtx);
      bCtx.fillStyle = '#141414';
      bCtx.fill();

      traceScar(rCtx);
      rCtx.fillStyle = '#f2f2f2';
      rCtx.fill();

      // Rusted exposed iron rebar lattice inside spall cavity
      aCtx.save();
      traceScar(aCtx);
      aCtx.clip();

      for (let ry = scar.cy - 18; ry <= scar.cy + 18; ry += 12) {
        aCtx.fillStyle = '#6e341c';
        aCtx.fillRect(scar.cx - scar.rx, ry - 2, scar.rx * 2, 4);
        aCtx.fillStyle = '#9c522c';
        aCtx.fillRect(scar.cx - scar.rx, ry - 1, scar.rx * 2, 1.5);

        bCtx.fillStyle = '#9a9a9a';
        bCtx.fillRect(scar.cx - scar.rx + 8, ry - 2, scar.rx * 2 - 16, 4);
      }
      for (let rx = scar.cx - 32; rx <= scar.cx + 32; rx += 20) {
        aCtx.fillStyle = '#5a2916';
        aCtx.fillRect(rx - 2, scar.cy - scar.ry, 4, scar.ry * 2);
      }
      aCtx.restore();
    }

    // Rainwater & soot weathering streaks cascading from horizontal seams
    for (let i = 0; i < 82; i++) {
      const sx = rng() * size;
      const startY = i % 3 === 0 ? 162 : i % 3 === 1 ? 354 : 4;
      const len = 36 + rng() * 124;
      const w = 2 + rng() * 5;
      const isRust = i % 4 === 0;
      const grad = aCtx.createLinearGradient(sx, startY, sx, startY + len);
      grad.addColorStop(0, isRust ? 'rgba(102, 48, 22, 0.44)' : 'rgba(20, 17, 15, 0.48)');
      grad.addColorStop(1, 'rgba(20, 17, 15, 0.0)');
      aCtx.fillStyle = grad;
      aCtx.fillRect(sx, startY, w, len);
    }

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 oil-stained industrial refinery concrete/steel drainage floor slabs
   * with dark slick crude oil spills (high specular contrast), recessed floor drain grates,
   * and bolted slab expansion seams (used by Map 2: SECTOR-14 // SUNKEN REFINERY).
   *
   * @param {number} [repeatX=16]
   * @param {number} [repeatY=16]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getRefineryFloorTextures(repeatX = 16, repeatY = 16) {
    const cacheKey = `refinery_floor_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);

    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const rng = createRng(1414);
    const oilLow = createTileableNoise(5, 1401);
    const oilMid = createTileableNoise(14, 1409);
    const grit = createTileableNoise(44, 1423);
    const rustPatch = createTileableNoise(10, 1433);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;

        const g = grit(u, v);
        const oilField = oilLow(u, v) * 0.65 + oilMid(u, v) * 0.35;
        const oilSlick = smoothstep(0.56, 0.70, oilField);
        const rustAmt = smoothstep(0.58, 0.80, rustPatch(u, v) * 0.7 + g * 0.3) * (1 - oilSlick * 0.75);

        // Industrial concrete-steel slab base (#46423d) with rust oxidation pockets
        let r = 56 + g * 18 + rustAmt * 48;
        let gCol = 53 + g * 16 + rustAmt * 14;
        let b = 49 + g * 14 - rustAmt * 8;

        let rv = 166 + g * 38 + rustAmt * 42;
        let bv = 152 + (g - 0.5) * 34;

        // Dark slick viscous oil/sludge spills with mirror-low roughness
        if (oilSlick > 0.01) {
          const irid = Math.sin((oilField * 24 + u * 4) * Math.PI) * 5;
          r = r * (1 - oilSlick) + (18 + irid) * oilSlick;
          gCol = gCol * (1 - oilSlick) + (16 + irid * 0.6) * oilSlick;
          b = b * (1 - oilSlick) + (15 - irid * 0.4) * oilSlick;
          rv = rv * (1 - oilSlick) + (24 + g * 14) * oilSlick;
          bv = bv * (1 - oilSlick) + 144 * oilSlick;
        }

        aImg.data[idx] = clampByte(r);
        aImg.data[idx + 1] = clampByte(gCol);
        aImg.data[idx + 2] = clampByte(b);
        aImg.data[idx + 3] = 255;

        const rByte = clampByte(rv);
        rImg.data[idx] = rByte;
        rImg.data[idx + 1] = rByte;
        rImg.data[idx + 2] = rByte;
        rImg.data[idx + 3] = 255;

        const bByte = clampByte(bv);
        bImg.data[idx] = bByte;
        bImg.data[idx + 1] = bByte;
        bImg.data[idx + 2] = bByte;
        bImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // 2x2 Bolted concrete/iron slab seams & recessed industrial drainage channels
    for (const s of [0, 256, 512]) {
      aCtx.fillStyle = '#1b1714';
      aCtx.fillRect(s - 5, 0, 10, size);
      aCtx.fillRect(0, s - 5, size, 10);

      bCtx.fillStyle = '#1a1a1a';
      bCtx.fillRect(s - 5, 0, 10, size);
      bCtx.fillRect(0, s - 5, size, 10);

      rCtx.fillStyle = '#dcdcdc';
      rCtx.fillRect(s - 5, 0, 10, size);
      rCtx.fillRect(0, s - 5, size, 10);
    }

    // Recessed slotted steel drainage trench grates centered in 2 of the 4 quadrants
    const drains = [
      [128, 128],
      [384, 384],
    ];
    for (let d = 0; d < drains.length; d++) {
      const [dx, dy] = drains[d];
      const dw = 112;
      const dh = 68;
      aCtx.fillStyle = '#2d2824';
      aCtx.fillRect(dx - dw * 0.5 - 6, dy - dh * 0.5 - 6, dw + 12, dh + 12);
      aCtx.fillStyle = '#110e0c';
      aCtx.fillRect(dx - dw * 0.5, dy - dh * 0.5, dw, dh);
      bCtx.fillStyle = '#141414';
      bCtx.fillRect(dx - dw * 0.5, dy - dh * 0.5, dw, dh);

      for (let gx = dx - dw * 0.5 + 8; gx < dx + dw * 0.5 - 4; gx += 14) {
        aCtx.fillStyle = '#4c433b';
        aCtx.fillRect(gx, dy - dh * 0.5 + 4, 6, dh - 8);
        bCtx.fillStyle = '#d0d0d0';
        bCtx.fillRect(gx, dy - dh * 0.5 + 4, 6, dh - 8);
        rCtx.fillStyle = '#6e6e6e';
        rCtx.fillRect(gx, dy - dh * 0.5 + 4, 6, dh - 8);
      }
    }

    // Faded ochre safety stripe dashes flanking drainage troughs & slab corner bolts
    aCtx.fillStyle = 'rgba(208, 142, 38, 0.34)';
    aCtx.fillRect(72, 82, 112, 6);
    aCtx.fillRect(72, 168, 112, 6);
    aCtx.fillRect(328, 338, 112, 6);
    aCtx.fillRect(328, 424, 112, 6);

    for (let py = 0; py < 2; py++) {
      for (let px = 0; px < 2; px++) {
        const ox = px * 256;
        const oy = py * 256;
        for (const [bx, by] of [
          [ox + 20, oy + 20],
          [ox + 236, oy + 20],
          [ox + 20, oy + 236],
          [ox + 236, oy + 236],
        ]) {
          aCtx.fillStyle = '#1d1815';
          aCtx.beginPath();
          aCtx.arc(bx, by, 4.5, 0, Math.PI * 2);
          aCtx.fill();
          bCtx.fillStyle = '#ebebeb';
          bCtx.beginPath();
          bCtx.arc(bx, by, 4, 0, Math.PI * 2);
          bCtx.fill();
        }
      }
    }

    // Subtle grease/tire-track streaks
    for (let i = 0; i < 30; i++) {
      const sx = rng() * size;
      const sy = rng() * size;
      aCtx.fillStyle = 'rgba(18, 15, 12, 0.25)';
      aCtx.fillRect(sx, sy, 4 + rng() * 14, 2 + rng() * 6);
    }

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 rusted perforated diamond-plate industrial grating with worn amber edge scuff.
   *
   * @param {number} [repeatX=6]
   * @param {number} [repeatY=2]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getCatwalkTextures(repeatX = 6, repeatY = 2) {
    const cacheKey = `catwalk_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);

    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const rng = createRng(6262);
    const rustNoise = createTileableNoise(14, 701);
    const gritNoise = createTileableNoise(42, 709);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        const rn = rustNoise(u, v) * 0.68 + gritNoise(u, v) * 0.32;
        const rustPatch = smoothstep(0.47, 0.72, rn);

        // Worn center foot-traffic path cleans away rust along middle of deck
        const centerWear = Math.exp(-Math.pow((u - 0.5) * 3.4, 2));
        const rustAmt = rustPatch * (1 - centerWear * 0.65);

        const steelR = 62 + gritNoise(u, v) * 18;
        const steelG = 60 + gritNoise(u, v) * 17;
        const steelB = 58 + gritNoise(u, v) * 16;

        const r = steelR * (1 - rustAmt) + 122 * rustAmt;
        const g = steelG * (1 - rustAmt) + 60 * rustAmt;
        const b = steelB * (1 - rustAmt) + 32 * rustAmt;

        aImg.data[idx] = clampByte(r);
        aImg.data[idx + 1] = clampByte(g);
        aImg.data[idx + 2] = clampByte(b);
        aImg.data[idx + 3] = 255;

        const rv = clampByte(115 * (1 - rustAmt) + 225 * rustAmt - centerWear * 26);
        rImg.data[idx] = rv;
        rImg.data[idx + 1] = rv;
        rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;

        const bv = clampByte(142 + (gritNoise(u, v) - 0.5) * 28 + rustAmt * 18);
        bImg.data[idx] = bv;
        bImg.data[idx + 1] = bv;
        bImg.data[idx + 2] = bv;
        bImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // Repeating perforated grate slots & alternating 45° diamond-plate lugs
    const cell = 32;
    for (let gy = 0; gy < size / cell; gy++) {
      for (let gx = 0; gx < size / cell; gx++) {
        const cx = gx * cell + cell * 0.5;
        const cy = gy * cell + cell * 0.5;
        const isHole = (gx + gy) % 2 === 0;

        if (isHole) {
          aCtx.fillStyle = '#0e0c0b';
          traceRoundedRect(aCtx, cx - 7, cy - 4, 14, 8, 3);
          aCtx.fill();

          aCtx.strokeStyle = 'rgba(128, 66, 36, 0.52)';
          aCtx.lineWidth = 1.2;
          aCtx.stroke();

          rCtx.fillStyle = '#f0f0f0';
          traceRoundedRect(rCtx, cx - 7, cy - 4, 14, 8, 3);
          rCtx.fill();

          bCtx.fillStyle = '#0c0c0c';
          traceRoundedRect(bCtx, cx - 7, cy - 4, 14, 8, 3);
          bCtx.fill();
        } else {
          const angle = gx % 2 === 0 ? Math.PI * 0.25 : -Math.PI * 0.25;
          const drawLug = (ctx, fill) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.ellipse(0, 0, 9.2, 3.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          };
          drawLug(aCtx, '#6c6660');
          drawLug(rCtx, '#4c4c4c');
          drawLug(bCtx, '#f0f0f0');
        }
      }
    }

    // Structural deck cross-rib beams (every 256px)
    for (const ry of [0, 256, 512]) {
      aCtx.fillStyle = '#38322e';
      aCtx.fillRect(0, ry - 10, size, 20);
      aCtx.fillStyle = '#181412';
      aCtx.fillRect(0, ry - 2, size, 4);

      bCtx.fillStyle = '#d8d8d8';
      bCtx.fillRect(0, ry - 10, size, 20);
      bCtx.fillStyle = '#242424';
      bCtx.fillRect(0, ry - 2, size, 4);
    }

    // Heavy side steel flange rails + worn amber safety edge scuff
    const drawSideFlange = (x0, w, amberX) => {
      aCtx.fillStyle = '#3a342f';
      aCtx.fillRect(x0, 0, w, size);
      aCtx.strokeStyle = '#181411';
      aCtx.lineWidth = 3;
      aCtx.strokeRect(x0, 0, w, size);

      // Worn amber safety paint strip along inner flange shoulder
      aCtx.fillStyle = 'rgba(218, 142, 32, 0.78)';
      aCtx.fillRect(amberX, 0, 10, size);
      for (let i = 0; i < 42; i++) {
        aCtx.fillStyle = i % 2 === 0 ? 'rgba(62, 54, 48, 0.72)' : 'rgba(118, 56, 26, 0.65)';
        aCtx.fillRect(amberX - 1, rng() * size, 12, 4 + rng() * 14);
      }

      rCtx.fillStyle = '#888888';
      rCtx.fillRect(x0, 0, w, size);
      bCtx.fillStyle = '#dcdcdc';
      bCtx.fillRect(x0, 0, w, size);

      for (let by = 24; by < size; by += 64) {
        const bx = x0 + w * 0.5;
        aCtx.fillStyle = '#1c1714';
        aCtx.beginPath();
        aCtx.arc(bx, by, 4.5, 0, Math.PI * 2);
        aCtx.fill();
        bCtx.fillStyle = '#ffffff';
        bCtx.beginPath();
        bCtx.arc(bx, by, 4, 0, Math.PI * 2);
        bCtx.fill();
      }
    };
    drawSideFlange(0, 26, 26);
    drawSideFlange(size - 26, 26, size - 36);

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 heavily oxidized riveted iron/rust armor plates with weld seams & grease streaks.
   * Used by Map 1 wreckage/monoliths, Map 2 refinery silos/pipes, and Map 3 citadel hulls.
   *
   * @param {number} [repeatX=4]
   * @param {number} [repeatY=4]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getRustMetalTextures(repeatX = 4, repeatY = 4) {
    const cacheKey = `rustmetal_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);

    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const rng = createRng(8181);
    const oxLow = createTileableNoise(8, 811);
    const oxMid = createTileableNoise(22, 823);
    const micro = createTileableNoise(60, 839);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        const ox = oxLow(u, v) * 0.56 + oxMid(u, v) * 0.34 + micro(u, v) * 0.1;
        const flake = smoothstep(0.42, 0.72, ox);
        const deepRust = smoothstep(0.62, 0.86, ox);

        // Dark gunmetal iron base -> flaky burnt orange/mahogany ferric oxide
        const ironR = 64 + micro(u, v) * 18;
        const ironG = 61 + micro(u, v) * 16;
        const ironB = 58 + micro(u, v) * 15;

        const rustR = 138 + deepRust * 26 + micro(u, v) * 18;
        const rustG = 62 + deepRust * 10 + micro(u, v) * 12;
        const rustB = 30 + micro(u, v) * 8;

        aImg.data[idx] = clampByte(ironR * (1 - flake) + rustR * flake);
        aImg.data[idx + 1] = clampByte(ironG * (1 - flake) + rustG * flake);
        aImg.data[idx + 2] = clampByte(ironB * (1 - flake) + rustB * flake);
        aImg.data[idx + 3] = 255;

        const rv = clampByte(96 * (1 - flake) + 234 * flake + (micro(u, v) - 0.5) * 24);
        rImg.data[idx] = rv;
        rImg.data[idx + 1] = rv;
        rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;

        const bv = clampByte(146 + flake * 34 + (micro(u, v) - 0.5) * 30);
        bImg.data[idx] = bv;
        bImg.data[idx + 1] = bv;
        bImg.data[idx + 2] = bv;
        bImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // Welded armor plate seams (2x2 grid at 0, 256, 512)
    const seams = [0, 256, 512];
    for (let i = 0; i < seams.length; i++) {
      const s = seams[i];
      aCtx.fillStyle = '#1e1916';
      aCtx.fillRect(s - 3, 0, 6, size);
      aCtx.fillRect(0, s - 3, size, 6);

      // Raised bumpy weld bead flanking the seam
      for (let t = 4; t < size; t += 10) {
        aCtx.fillStyle = 'rgba(110, 96, 86, 0.36)';
        aCtx.beginPath();
        aCtx.arc(s, t, 4.5, 0, Math.PI * 2);
        aCtx.arc(t, s, 4.5, 0, Math.PI * 2);
        aCtx.fill();

        bCtx.fillStyle = '#dcdcdc';
        bCtx.beginPath();
        bCtx.arc(s, t, 4.2, 0, Math.PI * 2);
        bCtx.arc(t, s, 4.2, 0, Math.PI * 2);
        bCtx.fill();
      }
    }

    // Heavy iron dome rivets around each 256x256 plate border
    for (let py = 0; py < 2; py++) {
      for (let px = 0; px < 2; px++) {
        const ox = px * 256;
        const oy = py * 256;
        for (let k = 24; k <= 232; k += 42) {
          const coords = [
            [ox + k, oy + 18],
            [ox + k, oy + 238],
            [ox + 18, oy + k],
            [ox + 238, oy + k],
          ];
          for (let c = 0; c < coords.length; c++) {
            const [rx, ry] = coords[c];
            aCtx.fillStyle = '#201815';
            aCtx.beginPath();
            aCtx.arc(rx, ry, 5, 0, Math.PI * 2);
            aCtx.fill();
            aCtx.fillStyle = '#6f655c';
            aCtx.beginPath();
            aCtx.arc(rx - 1, ry - 1, 2.8, 0, Math.PI * 2);
            aCtx.fill();

            bCtx.fillStyle = '#f4f4f4';
            bCtx.beginPath();
            bCtx.arc(rx, ry, 4.5, 0, Math.PI * 2);
            bCtx.fill();
          }
        }
      }
    }

    // Dark hydraulic oil & grease drips (noticeably glossier on roughnessMap!)
    for (let i = 0; i < 38; i++) {
      const gx = rng() * size;
      const gy = i % 2 === 0 ? 18 : 274;
      const len = 45 + rng() * 145;
      const w = 2.5 + rng() * 6;
      const grad = aCtx.createLinearGradient(gx, gy, gx, gy + len);
      grad.addColorStop(0, 'rgba(18, 15, 13, 0.62)');
      grad.addColorStop(1, 'rgba(18, 15, 13, 0.0)');
      aCtx.fillStyle = grad;
      aCtx.fillRect(gx, gy, w, len);

      const rGrad = rCtx.createLinearGradient(gx, gy, gx, gy + len);
      rGrad.addColorStop(0, 'rgba(48, 48, 48, 0.65)');
      rGrad.addColorStop(1, 'rgba(48, 48, 48, 0.0)');
      rCtx.fillStyle = rGrad;
      rCtx.fillRect(gx, gy, w, len);
    }

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 scorched volcanic basalt/ash crater terrain with subtle deep cooling-ember
   * fissures in emissiveMap (used by Map 3: Crater Citadel).
   *
   * @param {number} [repeatX=12]
   * @param {number} [repeatY=12]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture, emissiveMap: THREE.CanvasTexture }}
   */
  getCraterGroundTextures(repeatX = 12, repeatY = 12) {
    const cacheKey = `crater_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);
    const emissive = this._createCanvas(size, size);

    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;
    const eCtx = emissive.ctx;

    const cells = createTileableCellCracks(7, 991);
    const warpNoise = createTileableNoise(14, 997);
    const ashNoise = createTileableNoise(10, 1009);
    const basaltGrain = createTileableNoise(44, 1013);
    const heatPocket = createTileableNoise(6, 1021);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);
    const eImg = eCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;

        const warp = (warpNoise(u, v) - 0.5) * 0.048;
        const edge = cells(u + warp, v - warp * 0.9);
        const ash = ashNoise(u, v);
        const grain = basaltGrain(u, v);
        const pocket = heatPocket(u, v);

        // Deep jagged basalt fissure mask
        const crackDeep = 1 - smoothstep(0.012, 0.055, edge);
        const emberCore = 1 - smoothstep(0.004, 0.026, edge);
        const heatMask = smoothstep(0.36, 0.72, pocket);
        const emberStrength = emberCore * (0.28 + heatMask * 0.72);

        // Scorched volcanic basalt dusted with grey-umber ash
        const ashMix = smoothstep(0.48, 0.78, ash);
        let r = 30 + grain * 18 + ashMix * 34;
        let g = 26 + grain * 15 + ashMix * 30;
        let b = 25 + grain * 14 + ashMix * 27;

        let rv = 175 + grain * 42 + ashMix * 38;
        let bv = 166 + (grain - 0.5) * 52;

        if (crackDeep > 0.01) {
          r = r * (1 - crackDeep) + (16 + emberStrength * 145) * crackDeep;
          g = g * (1 - crackDeep) + (12 + emberStrength * 48) * crackDeep;
          b = b * (1 - crackDeep) + (11 + emberStrength * 8) * crackDeep;
          rv = rv * (1 - crackDeep) + 230 * crackDeep;
          bv = bv * (1 - crackDeep) + 24 * crackDeep;
        }

        aImg.data[idx] = clampByte(r);
        aImg.data[idx + 1] = clampByte(g);
        aImg.data[idx + 2] = clampByte(b);
        aImg.data[idx + 3] = 255;

        const rByte = clampByte(rv);
        rImg.data[idx] = rByte;
        rImg.data[idx + 1] = rByte;
        rImg.data[idx + 2] = rByte;
        rImg.data[idx + 3] = 255;

        const bByte = clampByte(bv);
        bImg.data[idx] = bByte;
        bImg.data[idx + 1] = bByte;
        bImg.data[idx + 2] = bByte;
        bImg.data[idx + 3] = 255;

        // Subtle cooling-ember veins in emissiveMap (warm volcanic orange-red, zero neon)
        eImg.data[idx] = clampByte(emberStrength * 225);
        eImg.data[idx + 1] = clampByte(emberStrength * emberStrength * 92);
        eImg.data[idx + 2] = clampByte(emberStrength * 10);
        eImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);
    eCtx.putImageData(eImg, 0, 0);

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
      emissiveMap: this._buildTexture(emissive.canvas, { isColor: true, repeatX, repeatY }),
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 peeling weathered industrial black/ochre caution stripes with scratches & rust wear.
   * Tiles 100% seamlessly horizontally and vertically.
   *
   * @param {number} [repeatX=4]
   * @param {number} [repeatY=1]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getHazardTextures(repeatX = 4, repeatY = 1) {
    const cacheKey = `hazard_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);

    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const rng = createRng(7711);
    const wearNoise = createTileableNoise(16, 773);

    const period = 128;
    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      const inBorder = y < 28 || y > size - 28;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        const n = wearNoise(u * 2, v * 2);

        const phase = (x + y) % period;
        const isOchre = !inBorder && phase < period * 0.5;

        const edgeDist = Math.min(phase, Math.abs(phase - period * 0.5), period - phase);
        const chipped = !inBorder && ((edgeDist < 8 && n > 0.54) || n > 0.8);

        let r, g, b, roughVal, bumpVal;
        if (inBorder) {
          r = 46 + n * 14;
          g = 40 + n * 12;
          b = 35 + n * 10;
          roughVal = 140 + n * 42;
          bumpVal = 186;
        } else if (chipped) {
          // Oxidized iron & scuffed bare steel beneath peeling paint
          const rustBit = n > 0.86;
          r = rustBit ? 116 + n * 24 : 78 + n * 22;
          g = rustBit ? 54 + n * 14 : 74 + n * 20;
          b = rustBit ? 28 + n * 10 : 70 + n * 18;
          roughVal = rustBit ? 215 : 108;
          bumpVal = 104;
        } else if (isOchre) {
          const grime = 1 - n * 0.3;
          r = 216 * grime;
          g = 142 * grime;
          b = 32 * grime;
          roughVal = 152 + n * 48;
          bumpVal = 172;
        } else {
          r = 28 + n * 12;
          g = 25 + n * 11;
          b = 22 + n * 10;
          roughVal = 192 + n * 38;
          bumpVal = 160;
        }

        aImg.data[idx] = clampByte(r);
        aImg.data[idx + 1] = clampByte(g);
        aImg.data[idx + 2] = clampByte(b);
        aImg.data[idx + 3] = 255;

        const rv = clampByte(roughVal);
        rImg.data[idx] = rv;
        rImg.data[idx + 1] = rv;
        rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;

        const bv = clampByte(bumpVal);
        bImg.data[idx] = bv;
        bImg.data[idx + 1] = bv;
        bImg.data[idx + 2] = bv;
        bImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    for (const y of [28, size - 28]) {
      aCtx.fillStyle = '#151210';
      aCtx.fillRect(0, y - 2, size, 4);
      bCtx.fillStyle = '#181818';
      bCtx.fillRect(0, y - 2, size, 4);
    }
    for (let x = 32; x < size; x += 64) {
      for (const y of [14, size - 14]) {
        aCtx.fillStyle = '#685b50';
        aCtx.beginPath();
        aCtx.arc(x, y, 4, 0, Math.PI * 2);
        aCtx.fill();
        bCtx.fillStyle = '#f2f2f2';
        bCtx.beginPath();
        bCtx.arc(x, y, 4, 0, Math.PI * 2);
        bCtx.fill();
      }
    }

    // Industrial metal scratches & impact scuffs
    for (let i = 0; i < 46; i++) {
      const x1 = rng() * size;
      const y1 = 30 + rng() * (size - 60);
      const len = 14 + rng() * 40;
      const ang = (rng() - 0.5) * 1.4;
      aCtx.strokeStyle = 'rgba(156, 146, 134, 0.36)';
      aCtx.lineWidth = 1.2;
      aCtx.beginPath();
      aCtx.moveTo(x1, y1);
      aCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
      aCtx.stroke();
    }

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };

    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 weathered bolted steel military stencil plate with rust corners,
   * stencil typography, and sector classification code.
   *
   * @param {string} title
   * @param {string} subtitle
   * @param {string} [accentHex='#f59e0b']
   * @returns {THREE.CanvasTexture}
   */
  getSignboardTexture(title, subtitle, accentHex = '#f59e0b') {
    const cacheKey = `signboard_${title}_${subtitle}_${accentHex}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const { canvas, ctx } = this._createCanvas(size, size);
    const { r, g, b } = parseHexColor(accentHex);
    const rgba = (alpha) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
    const rng = createRng((title || '').length * 197 + (subtitle || '').length * 37 + 911);

    // 1. Weathered military olive-gunmetal steel plate background
    const plateGrad = ctx.createLinearGradient(0, 0, size, size);
    plateGrad.addColorStop(0, '#32342e');
    plateGrad.addColorStop(0.5, '#292b27');
    plateGrad.addColorStop(1, '#20211d');
    ctx.fillStyle = plateGrad;
    ctx.fillRect(0, 0, size, size);

    // Horizontal brushed steel streaks & grime
    for (let y = 0; y < size; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(255, 245, 225, 0.025)' : 'rgba(12, 10, 8, 0.05)';
      ctx.fillRect(0, y, size, 2);
    }

    // 2. Heavy rust corrosion blooming around all 4 corners & edges
    const corners = [
      [0, 0],
      [size, 0],
      [0, size],
      [size, size],
    ];
    for (let i = 0; i < corners.length; i++) {
      const [cx, cy] = corners[i];
      const rustGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, 185);
      rustGrad.addColorStop(0, 'rgba(118, 48, 22, 0.85)');
      rustGrad.addColorStop(0.45, 'rgba(92, 42, 20, 0.42)');
      rustGrad.addColorStop(1, 'rgba(92, 42, 20, 0.0)');
      ctx.fillStyle = rustGrad;
      ctx.fillRect(0, 0, size, size);
    }

    // 3. Riveted steel border plate & caution corner stripes
    ctx.strokeStyle = '#141210';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, size - 24, size - 24);

    ctx.strokeStyle = rgba(0.68);
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, size - 52, size - 52);

    // Top military hazard accent header bar
    ctx.fillStyle = rgba(0.82);
    ctx.fillRect(34, 38, size - 68, 42);
    ctx.fillStyle = '#1b1a16';
    for (let sx = 44; sx < 130; sx += 22) {
      ctx.beginPath();
      ctx.moveTo(sx, 80);
      ctx.lineTo(sx + 11, 80);
      ctx.lineTo(sx + 25, 38);
      ctx.lineTo(sx + 14, 38);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#181612';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('AETHER-DROP // RECLAIM EARTH', 148, 60);

    // 4. Corner hex mounting bolts with downward rust drip stains
    const boltPos = [
      [34, 34],
      [size - 34, 34],
      [34, size - 34],
      [size - 34, size - 34],
      [256, 24],
      [256, size - 24],
    ];
    for (let i = 0; i < boltPos.length; i++) {
      const [bx, by] = boltPos[i];
      const drip = ctx.createLinearGradient(bx, by, bx, by + 56);
      drip.addColorStop(0, 'rgba(110, 44, 18, 0.65)');
      drip.addColorStop(1, 'rgba(110, 44, 18, 0.0)');
      ctx.fillStyle = drip;
      ctx.fillRect(bx - 4, by, 8, 56);

      ctx.fillStyle = '#1a1613';
      ctx.beginPath();
      ctx.arc(bx, by, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6f695f';
      ctx.beginPath();
      ctx.arc(bx - 1, by - 1, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Bold painted military stencil typography
    const titleStr = String(title || 'SECTOR-09').toUpperCase();
    let titleFontSize = 56;
    ctx.font = `900 ${titleFontSize}px "Arial Black", Impact, sans-serif`;
    while (ctx.measureText(titleStr).width > 420 && titleFontSize > 24) {
      titleFontSize -= 3;
      ctx.font = `900 ${titleFontSize}px "Arial Black", Impact, sans-serif`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark grime drop-shadow behind stencil
    ctx.fillStyle = 'rgba(14, 12, 10, 0.72)';
    ctx.fillText(titleStr, 259, 206);
    ctx.fillStyle = '#e5dccb';
    ctx.fillText(titleStr, 256, 202);

    // Subtitle military plate band
    ctx.fillStyle = 'rgba(18, 17, 14, 0.85)';
    ctx.fillRect(46, 268, size - 92, 50);
    ctx.strokeStyle = rgba(0.75);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(46, 268, size - 92, 50);

    const subStr = String(subtitle || 'RECLAMATION PROTOCOL').toUpperCase();
    let subFontSize = 21;
    ctx.font = `700 ${subFontSize}px monospace`;
    while (ctx.measureText(subStr).width > 395 && subFontSize > 11) {
      subFontSize -= 1;
      ctx.font = `700 ${subFontSize}px monospace`;
    }
    ctx.fillStyle = accentHex;
    ctx.fillText(subStr, 256, 294);

    // Bottom military logistics code & emblem bars
    ctx.fillStyle = 'rgba(218, 206, 184, 0.72)';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('UNIT: VANGUARD-09 // AUTH: ORBITAL-CMD', 46, 378);
    ctx.fillText('GRID REF: 34.05N // 118.24W // RECLAMATION', 46, 404);

    // Bottom weathered stencil chevron bars
    ctx.fillStyle = rgba(0.76);
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(46 + i * 42, 434, 30, 14);
    }

    // 6. Chipped paint scuffs, bullet pockmarks & wind-blown dust speckles over lettering
    for (let i = 0; i < 160; i++) {
      const sx = 18 + rng() * (size - 36);
      const sy = 18 + rng() * (size - 36);
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(104, 48, 22, 0.45)'
          : i % 3 === 1
          ? 'rgba(38, 36, 32, 0.55)'
          : 'rgba(165, 134, 96, 0.24)';
      ctx.fillRect(sx, sy, 2 + rng() * 9, 1.5 + rng() * 5);
    }

    for (let i = 0; i < 18; i++) {
      const x1 = rng() * size;
      const y1 = rng() * size;
      const len = 18 + rng() * 52;
      const ang = (rng() - 0.5) * 1.1;
      ctx.strokeStyle = 'rgba(150, 142, 130, 0.34)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
      ctx.stroke();
    }

    const tex = this._buildTexture(canvas, { isColor: true, repeatX: 1, repeatY: 1, wrap: false });
    this._cache.set(cacheKey, tex);
    return tex;
  }

  /**
   * 512x512 frosted slate-concrete cryo basin floor with glossy ice-slick melt patches,
   * expansion joints, and pale-frost steel coolant grates (used by Map 4: Cryo Vault).
   *
   * @param {number} [repeatX=14]
   * @param {number} [repeatY=14]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getCryoFloorTextures(repeatX = 14, repeatY = 14) {
    const cacheKey = `cryo_floor_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);
    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const frostLow = createTileableNoise(6, 2101);
    const frostMid = createTileableNoise(16, 2111);
    const grit = createTileableNoise(44, 2129);
    const crackNoise = createTileableCellCracks(6, 2141);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        const g = grit(u, v);
        const fField = frostLow(u, v) * 0.65 + frostMid(u, v) * 0.35;
        const iceSlick = smoothstep(0.55, 0.72, fField);
        const crack = 1 - smoothstep(0.012, 0.042, crackNoise(u, v));

        let r = 56 + g * 20;
        let gCol = 66 + g * 22;
        let b = 78 + g * 24;
        let rv = 176 + g * 38;
        let bv = 152 + (g - 0.5) * 38;

        if (iceSlick > 0.01) {
          r = r * (1 - iceSlick) + (128 + g * 18) * iceSlick;
          gCol = gCol * (1 - iceSlick) + (148 + g * 20) * iceSlick;
          b = b * (1 - iceSlick) + (168 + g * 20) * iceSlick;
          rv = rv * (1 - iceSlick) + (42 + g * 24) * iceSlick;
          bv = bv * (1 - iceSlick) + 146 * iceSlick;
        }
        if (crack > 0.01) {
          r = r * (1 - crack * 0.6) + 30 * crack;
          gCol = gCol * (1 - crack * 0.6) + 38 * crack;
          b = b * (1 - crack * 0.6) + 48 * crack;
          bv = bv * (1 - crack) + 28 * crack;
        }

        aImg.data[idx] = clampByte(r);
        aImg.data[idx + 1] = clampByte(gCol);
        aImg.data[idx + 2] = clampByte(b);
        aImg.data[idx + 3] = 255;

        const rb = clampByte(rv);
        rImg.data[idx] = rb;
        rImg.data[idx + 1] = rb;
        rImg.data[idx + 2] = rb;
        rImg.data[idx + 3] = 255;

        const bb = clampByte(bv);
        bImg.data[idx] = bb;
        bImg.data[idx + 1] = bb;
        bImg.data[idx + 2] = bb;
        bImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    for (const s of [0, 256, 512]) {
      aCtx.fillStyle = '#1e2730';
      aCtx.fillRect(s - 4, 0, 8, size);
      aCtx.fillRect(0, s - 4, size, 8);
      bCtx.fillStyle = '#181818';
      bCtx.fillRect(s - 4, 0, 8, size);
      bCtx.fillRect(0, s - 4, size, 8);
    }

    // Subtle frosted amber-orange thermal stencil lanes
    aCtx.fillStyle = 'rgba(212, 140, 58, 0.32)';
    aCtx.fillRect(96, 120, 64, 8);
    aCtx.fillRect(352, 376, 64, 8);

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };
    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 scorched desert sandstone & wind-swept ochre dust floor with heliostat bay markings
   * (used by Map 5: Helios Graveyard).
   *
   * @param {number} [repeatX=14]
   * @param {number} [repeatY=14]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getSolarFloorTextures(repeatX = 14, repeatY = 14) {
    const cacheKey = `solar_floor_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);
    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const duneLow = createTileableNoise(5, 3701);
    const duneMid = createTileableNoise(14, 3719);
    const grain = createTileableNoise(48, 3733);
    const crackNoise = createTileableCellCracks(7, 3761);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        const g = grain(u, v);
        const ripple = Math.sin((u * 12 + v * 4 + duneMid(u, v) * 1.5) * Math.PI * 2) * 0.5 + 0.5;
        const sandMix = smoothstep(0.42, 0.72, duneLow(u, v) * 0.65 + duneMid(u, v) * 0.35 + ripple * 0.1);
        const crack = 1 - smoothstep(0.01, 0.04, crackNoise(u, v));

        let r = 88 + g * 24;
        let gCol = 69 + g * 20;
        let b = 49 + g * 14;
        let rv = 188 + g * 34;
        let bv = 154 + (g - 0.5) * 42;

        if (sandMix > 0.01) {
          r = r * (1 - sandMix) + (168 + ripple * 20 + g * 14) * sandMix;
          gCol = gCol * (1 - sandMix) + (128 + ripple * 16 + g * 12) * sandMix;
          b = b * (1 - sandMix) + (82 + ripple * 10 + g * 8) * sandMix;
          rv = rv * (1 - sandMix) + (226 + g * 20) * sandMix;
          bv = bv * (1 - sandMix) + (168 + ripple * 18) * sandMix;
        }
        if (crack > 0.01) {
          r = r * (1 - crack * 0.68) + 34 * crack;
          gCol = gCol * (1 - crack * 0.68) + 26 * crack;
          b = b * (1 - crack * 0.68) + 18 * crack;
          bv = bv * (1 - crack) + 26 * crack;
        }

        aImg.data[idx] = clampByte(r);
        aImg.data[idx + 1] = clampByte(gCol);
        aImg.data[idx + 2] = clampByte(b);
        aImg.data[idx + 3] = 255;

        const rb = clampByte(rv);
        rImg.data[idx] = rb;
        rImg.data[idx + 1] = rb;
        rImg.data[idx + 2] = rb;
        rImg.data[idx + 3] = 255;

        const bb = clampByte(bv);
        bImg.data[idx] = bb;
        bImg.data[idx + 1] = bb;
        bImg.data[idx + 2] = bb;
        bImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    for (const s of [0, 256, 512]) {
      aCtx.fillStyle = 'rgba(42, 30, 20, 0.72)';
      aCtx.fillRect(s - 3, 0, 6, size);
      aCtx.fillRect(0, s - 3, size, 6);
      bCtx.fillStyle = '#222222';
      bCtx.fillRect(s - 3, 0, 6, size);
      bCtx.fillRect(0, s - 3, size, 6);
    }

    aCtx.fillStyle = 'rgba(232, 168, 56, 0.36)';
    aCtx.fillRect(64, 240, 128, 8);
    aCtx.fillRect(320, 494, 128, 8);

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };
    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * 512x512 charcoal gunmetal orbital drydock hull deck plates with riveted armor seams,
   * keel tie-down rail slots, and tungsten-amber bay markings (used by Map 6: Aegis Drydock).
   *
   * @param {number} [repeatX=14]
   * @param {number} [repeatY=14]
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture, bumpMap: THREE.CanvasTexture }}
   */
  getDrydockFloorTextures(repeatX = 14, repeatY = 14) {
    const cacheKey = `drydock_floor_${repeatX}_${repeatY}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const bump = this._createCanvas(size, size);
    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const bCtx = bump.ctx;

    const plateNoise = createTileableNoise(12, 9901);
    const micro = createTileableNoise(46, 9923);

    const aImg = aCtx.createImageData(size, size);
    const rImg = rCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        const n = plateNoise(u, v) * 0.55 + micro(u, v) * 0.45;
        const scuff = smoothstep(0.56, 0.78, n);

        const r = 40 + n * 22 + scuff * 14;
        const g = 43 + n * 22 + scuff * 12;
        const b = 50 + n * 24 + scuff * 10;

        aImg.data[idx] = clampByte(r);
        aImg.data[idx + 1] = clampByte(g);
        aImg.data[idx + 2] = clampByte(b);
        aImg.data[idx + 3] = 255;

        const rv = clampByte(112 + (1 - scuff) * 34 + micro(u, v) * 36);
        rImg.data[idx] = rv;
        rImg.data[idx + 1] = rv;
        rImg.data[idx + 2] = rv;
        rImg.data[idx + 3] = 255;

        const bv = clampByte(148 + (micro(u, v) - 0.5) * 32);
        bImg.data[idx] = bv;
        bImg.data[idx + 1] = bv;
        bImg.data[idx + 2] = bv;
        bImg.data[idx + 3] = 255;
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    for (const s of [0, 128, 256, 384, 512]) {
      aCtx.fillStyle = '#171920';
      aCtx.fillRect(s - 2.5, 0, 5, size);
      aCtx.fillRect(0, s - 2.5, size, 5);
      bCtx.fillStyle = '#202020';
      bCtx.fillRect(s - 2.5, 0, 5, size);
      bCtx.fillRect(0, s - 2.5, size, 5);
    }

    // Recessed hangar tie-down slots + subtle amber dock bay stencil dashes
    for (let y = 64; y < size; y += 128) {
      for (let x = 64; x < size; x += 128) {
        aCtx.fillStyle = '#14161b';
        aCtx.fillRect(x - 14, y - 4, 28, 8);
        bCtx.fillStyle = '#121212';
        bCtx.fillRect(x - 14, y - 4, 28, 8);
      }
    }
    aCtx.fillStyle = 'rgba(224, 146, 48, 0.36)';
    aCtx.fillRect(28, 118, 72, 6);
    aCtx.fillRect(284, 374, 72, 6);

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX, repeatY }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX, repeatY }),
      bumpMap: this._buildTexture(bump.canvas, { isColor: false, repeatX, repeatY }),
    };
    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * Procedural 512x512 post-apocalyptic sky dome texture supporting 6 sector worlds:
   * - 'metropolis': golden-ash sunset sky + AETHER-1 orbital carrier + drop-pod streaks
   * - 'refinery': heavy toxic-amber industrial smog sky + distant furnace haze
   * - 'citadel': crimson-ember dusk sky + colossal shattered orbital elevator ring arc
   * - 'cryo': frigid nuclear-winter overcast slate sky + cold sun veil
   * - 'solar': scorching ochre desert glare horizon + heat-haze dust bands
   * - 'drydock': high-altitude steel-charcoal twilight + derelict orbital shipyard arc
   *
   * @param {'metropolis'|'refinery'|'citadel'|'cryo'|'solar'|'drydock'} [variant='metropolis']
   * @returns {THREE.CanvasTexture}
   */
  getSkyDomeTexture(variant = 'metropolis') {
    const allowed = ['metropolis', 'refinery', 'citadel', 'cryo', 'solar', 'drydock'];
    const key = allowed.includes(variant) ? variant : 'metropolis';
    const cacheKey = `sky_dome_${key}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const { canvas, ctx } = this._createCanvas(size, size);
    const seedMap = {
      metropolis: 55123,
      refinery: 66234,
      citadel: 77345,
      cryo: 88456,
      solar: 99567,
      drydock: 11678,
    };
    const rng = createRng(seedMap[key] || 55123);

    const drawPeriodic = (fn) => {
      fn(0);
      fn(-size);
      fn(size);
    };

    const drawPeriodicRadialGlow = (cx, cy, r1, stops) => {
      drawPeriodic((ox) => {
        const px = cx + ox;
        if (px + r1 < 0 || px - r1 > size) return;
        const g = ctx.createRadialGradient(px, cy, 4, px, cy, r1);
        for (let s = 0; s < stops.length; s++) {
          g.addColorStop(stops[s][0], stops[s][1]);
        }
        ctx.fillStyle = g;
        ctx.fillRect(px - r1, cy - r1, r1 * 2, r1 * 2);
      });
    };

    const drawPeriodicEllipse = (cx, cy, rx, ry, fillStyle) => {
      ctx.fillStyle = fillStyle;
      drawPeriodic((ox) => {
        const px = cx + ox;
        if (px + rx < 0 || px - rx > size) return;
        ctx.beginPath();
        ctx.ellipse(px, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    if (key === 'metropolis') {
      // Golden-ash sunset sky (strictly vertical -> seamless horizontally)
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0.0, '#1f2b38');
      grad.addColorStop(0.24, '#3a4a58');
      grad.addColorStop(0.44, '#7d5f47');
      grad.addColorStop(0.56, '#c9864c');
      grad.addColorStop(0.68, '#7a5942');
      grad.addColorStop(1.0, '#362a21');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Warm sunset disc & atmospheric ash glow wrapped cleanly across 360° seam
      drawPeriodicRadialGlow(148, 286, 165, [
        [0, 'rgba(255, 232, 185, 0.92)'],
        [0.25, 'rgba(244, 172, 98, 0.56)'],
        [0.6, 'rgba(182, 108, 56, 0.20)'],
        [1, 'rgba(120, 82, 56, 0.0)'],
      ]);

      // Broken warm-lit ash cloud wisps wrapped periodically across seam
      for (let i = 0; i < 24; i++) {
        const cx = rng() * size;
        const cy = 135 + rng() * 145;
        const w = 70 + rng() * 130;
        const h = 10 + rng() * 18;
        const col = i % 2 === 0 ? 'rgba(218, 152, 98, 0.14)' : 'rgba(56, 46, 42, 0.22)';
        drawPeriodicEllipse(cx, cy, w, h, col);
      }

      // Seamless periodic distant ash/dust haze ridge along horizon
      ctx.fillStyle = 'rgba(42, 33, 27, 0.34)';
      ctx.beginPath();
      ctx.moveTo(0, 320);
      for (let x = 0; x <= size; x += 8) {
        const u = x / size;
        const hOff =
          Math.sin(u * Math.PI * 2) * 8 +
          Math.cos(u * Math.PI * 6 + 0.8) * 5 +
          Math.sin(u * Math.PI * 10 + 1.9) * 3;
        ctx.lineTo(x, 286 + hOff);
      }
      ctx.lineTo(size, 320);
      ctx.closePath();
      ctx.fill();

      // AETHER-1 Orbital Carrier silhouette + sunlit upper metallic rim + drop-pod reentry streaks
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(232, 92);
      ctx.quadraticCurveTo(342, 48, 456, 88);
      ctx.strokeStyle = 'rgba(255, 222, 182, 0.25)';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(234, 92);
      ctx.quadraticCurveTo(342, 50, 454, 88);
      ctx.strokeStyle = '#2d333b';
      ctx.lineWidth = 4.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(236, 90);
      ctx.quadraticCurveTo(342, 48, 452, 86);
      ctx.strokeStyle = 'rgba(248, 224, 188, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      for (const [nx, ny, nw, nh] of [
        [290, 74, 12, 5],
        [342, 66, 22, 7],
        [398, 74, 14, 5],
      ]) {
        ctx.fillStyle = '#22272e';
        ctx.fillRect(nx - nw * 0.5, ny - nh * 0.5, nw, nh);
        ctx.fillStyle = 'rgba(255, 206, 142, 0.78)';
        ctx.fillRect(nx - nw * 0.4, ny - nh * 0.5, nw * 0.8, 1.5);
      }

      const pods = [
        [296, 78, 256, 178],
        [334, 70, 294, 192],
        [364, 72, 330, 172],
        [394, 76, 368, 164],
      ];
      for (let i = 0; i < pods.length; i++) {
        const [x0, y0, x1, y1] = pods[i];
        const cg = ctx.createLinearGradient(x0, y0, x1, y1);
        cg.addColorStop(0, 'rgba(240, 224, 200, 0.05)');
        cg.addColorStop(0.6, 'rgba(245, 192, 130, 0.34)');
        cg.addColorStop(0.95, 'rgba(255, 152, 68, 0.72)');
        cg.addColorStop(1, 'rgba(255, 120, 42, 0)');
        ctx.strokeStyle = cg;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.fillStyle = '#ffd296';
        ctx.beginPath();
        ctx.arc(x1, y1, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (key === 'refinery') {
      // Heavy toxic-amber industrial smog sky + distant furnace glow
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0.0, '#221a12');
      grad.addColorStop(0.28, '#4a341e');
      grad.addColorStop(0.48, '#8a5828');
      grad.addColorStop(0.59, '#bd7b32');
      grad.addColorStop(0.74, '#624224');
      grad.addColorStop(1.0, '#291d12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Distant refinery furnace horizon glow bursts wrapped periodically across seam
      for (const [fx, rad] of [
        [110, 140],
        [275, 165],
        [420, 135],
      ]) {
        drawPeriodicRadialGlow(fx, 305, rad, [
          [0, 'rgba(255, 176, 68, 0.44)'],
          [0.45, 'rgba(196, 108, 34, 0.18)'],
          [1, 'rgba(92, 56, 26, 0.0)'],
        ]);
      }

      // Dense rolling ochre/soot smog cloud bands wrapped across seam
      for (let i = 0; i < 36; i++) {
        const cx = rng() * size;
        const cy = 60 + rng() * 240;
        const w = 65 + rng() * 140;
        const h = 14 + rng() * 26;
        const col = i % 3 === 0 ? 'rgba(210, 142, 62, 0.14)' : 'rgba(42, 28, 16, 0.28)';
        drawPeriodicEllipse(cx, cy, w, h, col);
      }

      // Periodic industrial smog horizon ridge
      ctx.fillStyle = 'rgba(34, 23, 14, 0.36)';
      ctx.beginPath();
      ctx.moveTo(0, 330);
      for (let x = 0; x <= size; x += 8) {
        const u = x / size;
        const hOff =
          Math.cos(u * Math.PI * 2) * 7 +
          Math.sin(u * Math.PI * 6 + 1.2) * 5;
        ctx.lineTo(x, 294 + hOff);
      }
      ctx.lineTo(size, 330);
      ctx.closePath();
      ctx.fill();
    } else if (key === 'citadel') {
      // 'citadel': crimson-ember dusk sky + colossal shattered orbital elevator ring arc
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0.0, '#140f13');
      grad.addColorStop(0.25, '#33191b');
      grad.addColorStop(0.46, '#752b22');
      grad.addColorStop(0.58, '#b84726');
      grad.addColorStop(0.72, '#5c261d');
      grad.addColorStop(1.0, '#211210');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Volcanic ember horizon glow wrapped periodically across seam
      drawPeriodicRadialGlow(256, 300, 230, [
        [0, 'rgba(255, 118, 48, 0.48)'],
        [0.45, 'rgba(182, 54, 30, 0.24)'],
        [1, 'rgba(54, 18, 16, 0.0)'],
      ]);

      // Crimson-ash atmospheric clouds wrapped periodically
      for (let i = 0; i < 22; i++) {
        const cx = rng() * size;
        const cy = 95 + rng() * 175;
        const w = 60 + rng() * 120;
        const h = 10 + rng() * 18;
        const col = i % 2 === 0 ? 'rgba(194, 72, 42, 0.14)' : 'rgba(28, 16, 18, 0.26)';
        drawPeriodicEllipse(cx, cy, w, h, col);
      }

      // Colossal shattered orbital elevator ring arc using C1-periodic cosine curve:
      // ringY(0) === ringY(1) === 220 and dy/du === 0 at seam (u=0/1), with shattered gap at u in [0.56, 0.65]
      const ringY = (u) => 154 + 66 * Math.cos(u * Math.PI * 2);
      const gapStart = 0.56;
      const gapEnd = 0.65;

      const drawPeriodicRingSpan = (uFrom, uTo, yOff, strokeStyle, lineWidth) => {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        const steps = 72;
        for (let i = 0; i <= steps; i++) {
          const u = uFrom + ((uTo - uFrom) * i) / steps;
          const px = u * size;
          const py = ringY(u) + yOff;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      };

      ctx.save();
      // Left-through-seam continuous arc [0..gapStart] and right-through-seam arc [gapEnd..1]
      drawPeriodicRingSpan(-0.02, gapStart, 0, 'rgba(28, 22, 24, 0.92)', 10);
      drawPeriodicRingSpan(gapEnd, 1.02, 0, 'rgba(28, 22, 24, 0.92)', 10);

      // Sunlit crimson-orange underside rim matching seamlessly across u=0 / u=1
      drawPeriodicRingSpan(-0.02, gapStart, 5, 'rgba(246, 128, 66, 0.68)', 2.2);
      drawPeriodicRingSpan(gapEnd, 1.02, 5, 'rgba(246, 128, 66, 0.68)', 2.2);

      // Floating jagged ring fracture debris suspended inside shattered gap
      for (let i = 0; i < 16; i++) {
        const tGap = gapStart + 0.01 + (i / 15) * (gapEnd - gapStart - 0.02);
        const dx = tGap * size + (rng() - 0.5) * 14;
        const dy = ringY(tGap) + (rng() - 0.5) * 28;
        const s = 2 + rng() * 5;
        ctx.fillStyle = i % 3 === 0 ? '#d96a38' : '#261d1e';
        ctx.fillRect(dx, dy, s * 1.4, s);
      }

      // Drifting glowing cinders in upper atmosphere wrapped periodically
      for (let i = 0; i < 90; i++) {
        const sx = rng() * size;
        const sy = 60 + rng() * 250;
        const r = 0.7 + rng() * 1.6;
        ctx.fillStyle = `rgba(255, ${110 + Math.floor(rng() * 100)}, 48, ${0.25 + rng() * 0.5})`;
        drawPeriodic((ox) => {
          const px = sx + ox;
          if (px + r < 0 || px - r > size) return;
          ctx.beginPath();
          ctx.arc(px, sy, r, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();
    } else if (key === 'cryo') {
      // Frigid nuclear-winter slate-blue overcast sky + pale winter sun veil
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0.0, '#121a24');
      grad.addColorStop(0.28, '#233242');
      grad.addColorStop(0.5, '#465c70');
      grad.addColorStop(0.62, '#62798d');
      grad.addColorStop(0.76, '#364656');
      grad.addColorStop(1.0, '#18212b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      drawPeriodicRadialGlow(180, 278, 170, [
        [0, 'rgba(220, 236, 248, 0.72)'],
        [0.32, 'rgba(148, 182, 206, 0.36)'],
        [1, 'rgba(64, 86, 106, 0.0)'],
      ]);

      for (let i = 0; i < 30; i++) {
        const cx = rng() * size;
        const cy = 75 + rng() * 210;
        const w = 75 + rng() * 145;
        const h = 12 + rng() * 22;
        const col = i % 2 === 0 ? 'rgba(176, 198, 218, 0.14)' : 'rgba(24, 34, 46, 0.24)';
        drawPeriodicEllipse(cx, cy, w, h, col);
      }

      ctx.fillStyle = 'rgba(26, 36, 46, 0.42)';
      ctx.beginPath();
      ctx.moveTo(0, 326);
      for (let x = 0; x <= size; x += 8) {
        const u = x / size;
        const hOff = Math.sin(u * Math.PI * 2) * 9 + Math.cos(u * Math.PI * 6 + 0.4) * 5;
        ctx.lineTo(x, 290 + hOff);
      }
      ctx.lineTo(size, 326);
      ctx.closePath();
      ctx.fill();
    } else if (key === 'solar') {
      // Scorching desert-ochre glare horizon + dusty atmospheric mirage bands
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0.0, '#2e241b');
      grad.addColorStop(0.24, '#5e4730');
      grad.addColorStop(0.46, '#a47744');
      grad.addColorStop(0.58, '#dfb062');
      grad.addColorStop(0.72, '#8a6034');
      grad.addColorStop(1.0, '#3a2919');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      drawPeriodicRadialGlow(256, 282, 185, [
        [0, 'rgba(255, 245, 212, 0.92)'],
        [0.24, 'rgba(248, 194, 108, 0.56)'],
        [0.62, 'rgba(186, 122, 54, 0.22)'],
        [1, 'rgba(92, 62, 34, 0.0)'],
      ]);

      for (let i = 0; i < 26; i++) {
        const cx = rng() * size;
        const cy = 110 + rng() * 170;
        const w = 80 + rng() * 135;
        const h = 8 + rng() * 16;
        const col = i % 2 === 0 ? 'rgba(236, 182, 106, 0.16)' : 'rgba(68, 48, 28, 0.2)';
        drawPeriodicEllipse(cx, cy, w, h, col);
      }

      ctx.fillStyle = 'rgba(54, 38, 22, 0.36)';
      ctx.beginPath();
      ctx.moveTo(0, 326);
      for (let x = 0; x <= size; x += 8) {
        const u = x / size;
        const hOff = Math.cos(u * Math.PI * 2 + 1.0) * 7 + Math.sin(u * Math.PI * 4) * 5;
        ctx.lineTo(x, 294 + hOff);
      }
      ctx.lineTo(size, 326);
      ctx.closePath();
      ctx.fill();
    } else if (key === 'drydock') {
      // High-altitude charcoal-steel twilight + orbital drydock gantry horizon
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0.0, '#0d1016');
      grad.addColorStop(0.28, '#1b202b');
      grad.addColorStop(0.48, '#383d4a');
      grad.addColorStop(0.6, '#645952');
      grad.addColorStop(0.75, '#2b2d36');
      grad.addColorStop(1.0, '#13151c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      drawPeriodicRadialGlow(340, 294, 165, [
        [0, 'rgba(246, 178, 92, 0.52)'],
        [0.35, 'rgba(148, 106, 68, 0.24)'],
        [1, 'rgba(30, 32, 42, 0.0)'],
      ]);

      for (let i = 0; i < 65; i++) {
        const sx = rng() * size;
        const sy = 18 + rng() * 165;
        const r = 0.6 + rng() * 1.1;
        ctx.fillStyle = `rgba(218, 224, 236, ${0.22 + rng() * 0.45})`;
        drawPeriodic((ox) => {
          const px = sx + ox;
          if (px + r < 0 || px - r > size) return;
          ctx.beginPath();
          ctx.arc(px, sy, r, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      for (let i = 0; i < 20; i++) {
        const cx = rng() * size;
        const cy = 120 + rng() * 160;
        const w = 70 + rng() * 130;
        const h = 10 + rng() * 18;
        drawPeriodicEllipse(cx, cy, w, h, 'rgba(22, 24, 32, 0.28)');
      }
    }

    const tex = this._buildTexture(canvas, {
      isColor: true,
      repeatX: 1,
      repeatY: 1,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
    this._cache.set(cacheKey, tex);
    return tex;
  }

  /**
   * 512x512 shattered concrete skyscrapers with dark blown-out window frames
   * & sparse warm amber emergency beacons (zero neon).
   *
   * @returns {{ map: THREE.CanvasTexture, roughnessMap: THREE.CanvasTexture }}
   */
  getRuinedSkylineTextures() {
    const cacheKey = 'ruined_skyline';
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const size = 512;
    const albedo = this._createCanvas(size, size);
    const rough = this._createCanvas(size, size);
    const aCtx = albedo.ctx;
    const rCtx = rough.ctx;
    const rng = createRng(8844);

    // Sun-baked ash concrete skyscraper facade
    aCtx.fillStyle = '#3c3631';
    aCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#d4d4d4';
    rCtx.fillRect(0, 0, size, size);

    // Subtle concrete grime gradient & vertical facade pilasters
    const dirtGrad = aCtx.createLinearGradient(0, 0, 0, size);
    dirtGrad.addColorStop(0, 'rgba(26, 22, 19, 0.25)');
    dirtGrad.addColorStop(0.5, 'rgba(62, 54, 48, 0.12)');
    dirtGrad.addColorStop(1, 'rgba(18, 15, 13, 0.55)');
    aCtx.fillStyle = dirtGrad;
    aCtx.fillRect(0, 0, size, size);

    for (let x = 0; x < size; x += 32) {
      aCtx.fillStyle = '#4c443d';
      aCtx.fillRect(x, 0, 5, size);
      aCtx.fillStyle = '#25211e';
      aCtx.fillRect(x + 5, 0, 2, size);
    }

    // Blown-out concrete window grid with jagged soot scorch & sparse amber emergency beacons
    for (let row = 0; row < 34; row++) {
      const y = row * 15 + 10;
      if (y > size - 14) break;
      for (let col = 0; col < 16; col++) {
        const x = col * 32 + 9;
        const w = 18;
        const h = 9;

        // Blown-out hollow dark window interior
        aCtx.fillStyle = rng() > 0.35 ? '#120f0d' : '#1b1714';
        aCtx.fillRect(x, y, w, h);

        // Occasional remaining shattered glass reflection in roughnessMap
        const hasGlass = rng() > 0.72;
        rCtx.fillStyle = hasGlass ? '#464646' : '#ebebeb';
        rCtx.fillRect(x, y, w, h);

        // Soot scorch streak above burned-out window bays
        if (rng() > 0.62) {
          const soot = aCtx.createLinearGradient(x, y, x, y - 10);
          soot.addColorStop(0, 'rgba(15, 12, 10, 0.52)');
          soot.addColorStop(1, 'rgba(15, 12, 10, 0.0)');
          aCtx.fillStyle = soot;
          aCtx.fillRect(x - 1, y - 10, w + 2, 10);
        }

        // Sparse warm amber emergency maintenance beacons (<= ~2.5% of windows)
        if (rng() > 0.974) {
          aCtx.fillStyle = '#f59e0b';
          aCtx.fillRect(x + 4, y + 3, 6, 3);
        }
      }
    }

    // Diagonal structural cracks across concrete facade
    for (let i = 0; i < 16; i++) {
      let cx = rng() * size;
      let cy = rng() * size;
      aCtx.strokeStyle = 'rgba(20, 17, 14, 0.75)';
      aCtx.lineWidth = 1.6;
      aCtx.beginPath();
      aCtx.moveTo(cx, cy);
      for (let s = 0; s < 5; s++) {
        cx += (rng() - 0.5) * 28;
        cy += 10 + rng() * 20;
        aCtx.lineTo(cx, cy);
      }
      aCtx.stroke();
    }

    const result = {
      map: this._buildTexture(albedo.canvas, { isColor: true, repeatX: 1, repeatY: 2 }),
      roughnessMap: this._buildTexture(rough.canvas, { isColor: false, repeatX: 1, repeatY: 2 }),
    };
    this._cache.set(cacheKey, result);
    return result;
  }

  /**
   * Cleanly dispose every generated CanvasTexture to prevent WebGL memory leaks.
   */
  dispose() {
    for (let i = 0; i < this._textures.length; i++) {
      this._textures[i].dispose();
    }
    this._textures.length = 0;
    this._cache.clear();
  }
}
  __exports.TextureGenerator = TextureGenerator;
});
