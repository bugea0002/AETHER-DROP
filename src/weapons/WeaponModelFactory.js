// Module: src/weapons/WeaponModelFactory.js
__define("src/weapons/WeaponModelFactory.js", (__exports, __require) => {
const TWO_PI = Math.PI * 2;

/**
 * AAA Procedural 1st-Person Weapon & VANGUARD-09 Robot-Hand Sculpting Factory
 * for AETHER DROP: RECLAIM EARTH.
 * Builds 4 rugged Post-Apocalyptic Military-SF firearms (40-55+ parts each) plus an
 * arm-mounted Thermal Pry-Blade using ExtrudeGeometry, LatheGeometry, TubeGeometry,
 * procedural weathered paint & brushed-steel Canvas PBR maps, crisp amber/gold optical
 * reticles, and fast MeshStandardMaterial shaders (zero MeshPhysicalMaterial, zero neon).
 */
class WeaponModelFactory {
  constructor() {
    /** @type {Array<THREE.Texture>} */
    this._sharedTextures = [];
    /** @type {Array<THREE.Material>} */
    this._sharedMaterials = [];

    this._buildProceduralTextures();
    this._buildSharedMaterials();
  }

  // ---------------------------------------------------------------------------
  // Procedural Weathered Military-SF PBR & Reticle Texture Generators
  // ---------------------------------------------------------------------------

  /** @private */
  _makeCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  /** @private */
  _registerTexture(canvas, { repeatX = 1, repeatY = 1, isColor = false } = {}) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    this._sharedTextures.push(tex);
    return tex;
  }

  /** @private */
  _paintChippedSurface(ctx, w, h, baseHex, seamHex, grimeHex, chipHex, streakHex) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    // Subtle weathered dust / oil wash patches
    for (let i = 0; i < 44; i++) {
      const x = (i * 59) % w;
      const y = (i * 97) % h;
      const r = 16 + (i % 34);
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, grimeHex);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Precision milled armor panel seams
    ctx.strokeStyle = seamHex;
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h * 0.47);
    ctx.strokeRect(4, h * 0.52, w - 8, h * 0.45);

    // Chipped paint along panel borders & corners exposing bare steel
    ctx.fillStyle = chipHex;
    for (let i = 0; i < 72; i++) {
      const edgeBand = i % 4;
      let cx;
      let cy;
      if (edgeBand === 0) {
        cx = (i * 31) % w;
        cy = 3 + (i % 7);
      } else if (edgeBand === 1) {
        cx = (i * 43) % w;
        cy = h * 0.51 + (i % 7) - 3;
      } else if (edgeBand === 2) {
        cx = 3 + (i % 6);
        cy = (i * 37) % h;
      } else {
        cx = (i * 67) % w;
        cy = (i * 53) % h;
      }
      const cw = 2 + (i % 7);
      const ch = 1 + ((i * 3) % 4);
      ctx.fillRect(cx, cy, cw, ch);
    }

    // Fine directional wear scratches
    ctx.strokeStyle = streakHex;
    ctx.lineWidth = 1;
    for (let i = 0; i < 55; i++) {
      const sx = (i * 47) % w;
      const sy = (i * 83) % h;
      const len = 8 + (i % 24);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + len, sy + ((i % 3) - 1) * 3);
      ctx.stroke();
    }
  }

  /** @private */
  _buildProceduralTextures() {
    // 1. Brushed Gunmetal / Titanium-Steel Bump & Roughness
    const metalCanvas = this._makeCanvas(256, 256);
    const mCtx = metalCanvas.getContext('2d');
    if (mCtx) {
      mCtx.fillStyle = '#7c7c7c';
      mCtx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y++) {
        const shade = 108 + ((y * 37) % 36);
        mCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
        mCtx.fillRect(0, y, 256, 1);
      }
      for (let i = 0; i < 420; i++) {
        const x = (i * 73) % 256;
        const y = (i * 29) % 256;
        const len = 14 + (i % 44);
        const lum = i % 2 === 0 ? 156 : 86;
        mCtx.fillStyle = `rgba(${lum},${lum},${lum},0.45)`;
        mCtx.fillRect(x, y, len, 1);
      }
      mCtx.strokeStyle = 'rgba(26,26,26,0.88)';
      mCtx.lineWidth = 2;
      mCtx.strokeRect(4, 4, 248, 120);
      mCtx.strokeRect(4, 132, 248, 120);
      mCtx.strokeStyle = 'rgba(205,205,205,0.4)';
      mCtx.lineWidth = 1;
      mCtx.strokeRect(6, 6, 244, 116);

      const bolts = [
        [18, 18], [238, 18], [18, 110], [238, 110],
        [18, 146], [238, 146], [18, 238], [238, 238],
      ];
      for (let i = 0; i < bolts.length; i++) {
        const [bx, by] = bolts[i];
        mCtx.fillStyle = '#242424';
        mCtx.beginPath();
        mCtx.arc(bx, by, 4.2, 0, TWO_PI);
        mCtx.fill();
        mCtx.fillStyle = '#aeaeae';
        mCtx.beginPath();
        mCtx.arc(bx, by, 2.1, 0, TWO_PI);
        mCtx.fill();
      }
    }
    this._texMetalBump = this._registerTexture(metalCanvas, { repeatX: 2, repeatY: 2 });

    // 2. Weathered Olive-Drab Military Paint Albedo (chipped edges + grime)
    const oliveCanvas = this._makeCanvas(256, 256);
    const oCtx = oliveCanvas.getContext('2d');
    if (oCtx) {
      this._paintChippedSurface(
        oCtx,
        256,
        256,
        '#4b5340',
        'rgba(28,32,24,0.82)',
        'rgba(98,88,68,0.28)',
        'rgba(88,94,98,0.72)',
        'rgba(128,134,126,0.34)'
      );
    }
    this._texOliveColor = this._registerTexture(oliveCanvas, { repeatX: 2, repeatY: 2, isColor: true });

    // 3. Weathered Ceramic-White VANGUARD-09 Armor Albedo (chipped edges + soot)
    const ceramicCanvas = this._makeCanvas(256, 256);
    const ceCtx = ceramicCanvas.getContext('2d');
    if (ceCtx) {
      this._paintChippedSurface(
        ceCtx,
        256,
        256,
        '#dcd7cc',
        'rgba(82,78,72,0.76)',
        'rgba(130,118,102,0.22)',
        'rgba(58,64,70,0.78)',
        'rgba(96,92,86,0.35)'
      );
      // Subtle military stencil hash marks
      ceCtx.fillStyle = 'rgba(72,66,58,0.55)';
      ceCtx.fillRect(24, 18, 18, 3);
      ceCtx.fillRect(24, 24, 11, 3);
      ceCtx.fillRect(204, 218, 22, 3);
    }
    this._texCeramicColor = this._registerTexture(ceramicCanvas, { repeatX: 2, repeatY: 2, isColor: true });

    // 4. Armor Panel & Paint-Chip Bump Map
    const armorBumpCanvas = this._makeCanvas(256, 256);
    const abCtx = armorBumpCanvas.getContext('2d');
    if (abCtx) {
      this._paintChippedSurface(
        abCtx,
        256,
        256,
        '#9a9a9a',
        'rgba(30,30,30,0.9)',
        'rgba(120,120,120,0.25)',
        'rgba(50,50,50,0.8)',
        'rgba(60,60,60,0.45)'
      );
    }
    this._texArmorBump = this._registerTexture(armorBumpCanvas, { repeatX: 2, repeatY: 2 });

    // 5. Reinforced Industrial Composite Polymer Bump
    const compCanvas = this._makeCanvas(128, 128);
    const cCtx = compCanvas.getContext('2d');
    if (cCtx) {
      cCtx.fillStyle = '#5c5c5c';
      cCtx.fillRect(0, 0, 128, 128);
      const cell = 8;
      for (let y = 0; y < 128; y += cell) {
        for (let x = 0; x < 128; x += cell) {
          const alt = ((x / cell) + (y / cell)) % 2 === 0;
          cCtx.fillStyle = alt ? '#7c7c7c' : '#424242';
          cCtx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
      }
    }
    this._texCompositeBump = this._registerTexture(compCanvas, { repeatX: 5, repeatY: 5 });

    // 6. Diamond-Knurled Rubberized Grip Bump
    const knurlCanvas = this._makeCanvas(128, 128);
    const kCtx = knurlCanvas.getContext('2d');
    if (kCtx) {
      kCtx.fillStyle = '#252525';
      kCtx.fillRect(0, 0, 128, 128);
      const step = 16;
      for (let y = -step; y <= 128 + step; y += step) {
        for (let x = -step; x <= 128 + step; x += step) {
          const grad = kCtx.createRadialGradient(x, y, 1, x, y, step * 0.55);
          grad.addColorStop(0, '#ededed');
          grad.addColorStop(0.65, '#868686');
          grad.addColorStop(1, '#181818');
          kCtx.fillStyle = grad;
          kCtx.beginPath();
          kCtx.moveTo(x, y - step * 0.48);
          kCtx.lineTo(x + step * 0.48, y);
          kCtx.lineTo(x, y + step * 0.48);
          kCtx.lineTo(x - step * 0.48, y);
          kCtx.closePath();
          kCtx.fill();
        }
      }
    }
    this._texKnurlBump = this._registerTexture(knurlCanvas, { repeatX: 4, repeatY: 4 });

    // 7. Braided Steel Hydraulic / Servo Hose Bump
    const braidCanvas = this._makeCanvas(128, 128);
    const bCtx = braidCanvas.getContext('2d');
    if (bCtx) {
      bCtx.fillStyle = '#383838';
      bCtx.fillRect(0, 0, 128, 128);
      bCtx.lineWidth = 6;
      for (let i = -128; i < 256; i += 16) {
        bCtx.strokeStyle = '#c8c8c8';
        bCtx.beginPath();
        bCtx.moveTo(i, 0);
        bCtx.lineTo(i + 128, 128);
        bCtx.stroke();

        bCtx.strokeStyle = '#8c8c8c';
        bCtx.beginPath();
        bCtx.moveTo(i + 128, 0);
        bCtx.lineTo(i, 128);
        bCtx.stroke();
      }
    }
    this._texBraidBump = this._registerTexture(braidCanvas, { repeatX: 8, repeatY: 2 });

    // 8. Copper-Wound Induction Coil Albedo & Bump (for HV-7 Rail Lance)
    const coilColorCanvas = this._makeCanvas(128, 128);
    const ccCtx = coilColorCanvas.getContext('2d');
    const coilBumpCanvas = this._makeCanvas(128, 128);
    const cbCtx = coilBumpCanvas.getContext('2d');
    if (ccCtx && cbCtx) {
      for (let y = 0; y < 128; y += 8) {
        const cg = ccCtx.createLinearGradient(0, y, 0, y + 8);
        cg.addColorStop(0.0, '#4e270f');
        cg.addColorStop(0.28, '#c67a3c');
        cg.addColorStop(0.5, '#e8a25d');
        cg.addColorStop(0.72, '#b86c30');
        cg.addColorStop(1.0, '#3e1e0a');
        ccCtx.fillStyle = cg;
        ccCtx.fillRect(0, y, 128, 8);

        const bg = cbCtx.createLinearGradient(0, y, 0, y + 8);
        bg.addColorStop(0.0, '#222222');
        bg.addColorStop(0.5, '#f0f0f0');
        bg.addColorStop(1.0, '#222222');
        cbCtx.fillStyle = bg;
        cbCtx.fillRect(0, y, 128, 8);
      }
    }
    this._texCopperColor = this._registerTexture(coilColorCanvas, { repeatX: 3, repeatY: 2, isColor: true });
    this._texCopperBump = this._registerTexture(coilBumpCanvas, { repeatX: 3, repeatY: 2 });

    // 8.5. Procedural Weapon Skin PBR Maps (Carbon Weave, Arctic Digital, Obsidian Magma, Omega Gold Hex)
    const carbonCanvas = this._makeCanvas(256, 256);
    const caCtx = carbonCanvas.getContext('2d');
    if (caCtx) {
      caCtx.fillStyle = '#1b1e24';
      caCtx.fillRect(0, 0, 256, 256);
      const cw = 16;
      for (let y = 0; y < 256; y += cw) {
        for (let x = 0; x < 256; x += cw) {
          const alt = ((x / cw) + (y / cw)) % 2 === 0;
          caCtx.fillStyle = alt ? '#2a2f3a' : '#14171d';
          caCtx.fillRect(x, y, cw - 1, cw - 1);
          caCtx.fillStyle = alt ? 'rgba(90, 105, 130, 0.25)' : 'rgba(10, 12, 16, 0.35)';
          caCtx.fillRect(x + 2, y + 2, cw - 5, 3);
        }
      }
      caCtx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      caCtx.lineWidth = 3;
      caCtx.beginPath();
      caCtx.moveTo(0, 128); caCtx.lineTo(256, 128);
      caCtx.stroke();
      caCtx.strokeStyle = 'rgba(20, 24, 30, 0.9)';
      caCtx.lineWidth = 2;
      caCtx.strokeRect(4, 4, 248, 248);
    }
    this._texSkinCarbon = this._registerTexture(carbonCanvas, { repeatX: 3, repeatY: 3, isColor: true });

    const arcticCanvas = this._makeCanvas(256, 256);
    const arCtx = arcticCanvas.getContext('2d');
    if (arCtx) {
      arCtx.fillStyle = '#e2e8f0';
      arCtx.fillRect(0, 0, 256, 256);
      const shades = ['#cbd5e1', '#94a3b8', '#f8fafc', '#475569'];
      for (let i = 0; i < 96; i++) {
        const bx = ((i * 53) % 16) * 16;
        const by = ((i * 97) % 16) * 16;
        const bw = (1 + (i % 3)) * 16;
        const bh = (1 + ((i * 7) % 2)) * 16;
        arCtx.fillStyle = shades[i % shades.length];
        arCtx.fillRect(bx, by, bw, bh);
      }
      arCtx.strokeStyle = 'rgba(34, 211, 238, 0.78)';
      arCtx.lineWidth = 3;
      arCtx.strokeRect(6, 6, 244, 244);
      arCtx.beginPath();
      arCtx.moveTo(0, 64); arCtx.lineTo(256, 64);
      arCtx.stroke();
    }
    this._texSkinArctic = this._registerTexture(arcticCanvas, { repeatX: 2, repeatY: 2, isColor: true });

    const magmaCanvas = this._makeCanvas(256, 256);
    const mgCtx = magmaCanvas.getContext('2d');
    const magmaGlowCanvas = this._makeCanvas(256, 256);
    const mggCtx = magmaGlowCanvas.getContext('2d');
    if (mgCtx && mggCtx) {
      mgCtx.fillStyle = '#1d1412';
      mgCtx.fillRect(0, 0, 256, 256);
      mggCtx.fillStyle = '#000000';
      mggCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 36; i++) {
        const x0 = (i * 67) % 256;
        const y0 = (i * 43) % 256;
        const x1 = x0 + ((i % 2 === 0 ? 1 : -1) * (32 + (i % 48)));
        const y1 = y0 + (24 + ((i * 5) % 44));
        mgCtx.strokeStyle = '#ff4500';
        mgCtx.lineWidth = 2.6 + (i % 2);
        mgCtx.beginPath();
        mgCtx.moveTo(x0, y0);
        mgCtx.lineTo((x0 + x1) * 0.5 + 8, (y0 + y1) * 0.5 - 6);
        mgCtx.lineTo(x1, y1);
        mgCtx.stroke();

        mggCtx.strokeStyle = i % 3 === 0 ? '#ffb703' : '#ff5500';
        mggCtx.lineWidth = 2.4 + (i % 2);
        mggCtx.beginPath();
        mggCtx.moveTo(x0, y0);
        mggCtx.lineTo((x0 + x1) * 0.5 + 8, (y0 + y1) * 0.5 - 6);
        mggCtx.lineTo(x1, y1);
        mggCtx.stroke();
      }
      mgCtx.strokeStyle = 'rgba(251, 146, 60, 0.35)';
      mgCtx.lineWidth = 2;
      mgCtx.strokeRect(4, 4, 248, 248);
    }
    this._texSkinMagma = this._registerTexture(magmaCanvas, { repeatX: 2, repeatY: 2, isColor: true });
    this._texSkinMagmaGlow = this._registerTexture(magmaGlowCanvas, { repeatX: 2, repeatY: 2, isColor: true });

    const goldCanvas = this._makeCanvas(256, 256);
    const goCtx = goldCanvas.getContext('2d');
    if (goCtx) {
      const grad = goCtx.createLinearGradient(0, 0, 256, 256);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(0.5, '#fde047');
      grad.addColorStop(1, '#d97706');
      goCtx.fillStyle = grad;
      goCtx.fillRect(0, 0, 256, 256);
      goCtx.strokeStyle = 'rgba(28, 22, 16, 0.72)';
      goCtx.lineWidth = 2;
      const r = 20;
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          const cx = col * r * 1.65;
          const cy = row * r * 1.45 + (col % 2 === 0 ? 0 : r * 0.72);
          goCtx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            const px = cx + Math.cos(a) * (r * 0.65);
            const py = cy + Math.sin(a) * (r * 0.65);
            if (k === 0) goCtx.moveTo(px, py);
            else goCtx.lineTo(px, py);
          }
          goCtx.closePath();
          goCtx.stroke();
        }
      }
      goCtx.strokeStyle = '#fffbeb';
      goCtx.lineWidth = 3;
      goCtx.strokeRect(4, 4, 248, 248);
    }
    this._texSkinGoldHex = this._registerTexture(goldCanvas, { repeatX: 2, repeatY: 2, isColor: true });

    // 9. Crisp Warm Military-SF Optic Reticle Textures (Zero Neon)
    this._reticleTextures = {
      pulse_rifle: this._createReticleTexture('pulse_rifle', '#f59e0b'),
      scattergun: this._createReticleTexture('scattergun', '#ea580c'),
      railgun: this._createReticleTexture('railgun', '#fbbf24'),
      plasma_smg: this._createReticleTexture('plasma_smg', '#d4a359'),
      weld_pistol: this._createReticleTexture('weld_pistol', '#f97316'),
      arc_rivet: this._createReticleTexture('arc_rivet', '#38bdf8'),
      repulsor: this._createReticleTexture('repulsor', '#22c55e'),
    };
  }

  /** @private */
  _createReticleTexture(weaponId, hexCss) {
    const size = 256;
    const canvas = this._makeCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const c = size * 0.5;
      ctx.clearRect(0, 0, size, size);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Subtle dark contrast shadow so warm amber/gold reticle stays razor-sharp in daylight dust
      ctx.shadowColor = 'rgba(12, 10, 8, 0.85)';
      ctx.shadowBlur = 5;
      ctx.strokeStyle = hexCss;
      ctx.fillStyle = hexCss;

      if (weaponId === 'pulse_rifle') {
        // M41-A Military Reflex Sight: crisp amber outer segmented ring + 4 stadia ticks + hot gold dot
        ctx.lineWidth = 3.2;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(c, c, 54, -Math.PI * 0.36, Math.PI * 0.36);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c, c, 54, Math.PI * 0.64, Math.PI * 1.36);
        ctx.stroke();

        ctx.globalAlpha = 0.96;
        ctx.lineWidth = 3.8;
        const gap = 16;
        const len = 24;
        ctx.beginPath();
        ctx.moveTo(c - gap - len, c); ctx.lineTo(c - gap, c);
        ctx.moveTo(c + gap, c); ctx.lineTo(c + gap + len, c);
        ctx.moveTo(c, c - gap - len * 0.8); ctx.lineTo(c, c - gap);
        ctx.moveTo(c, c + gap); ctx.lineTo(c, c + gap + len * 0.8);
        ctx.stroke();

        ctx.fillStyle = '#fff3d1';
        ctx.beginPath();
        ctx.arc(c, c, 4.2, 0, TWO_PI);
        ctx.fill();
      } else if (weaponId === 'scattergun') {
        // BR-12 Breacher Ghost-Ring Optic: wide buckshot spread brackets + center diamond + crisp pip
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.94;
        ctx.beginPath();
        ctx.arc(c, c, 70, -Math.PI * 0.28, Math.PI * 0.28);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c, c, 70, Math.PI * 0.72, Math.PI * 1.28);
        ctx.stroke();

        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(c - 90, c); ctx.lineTo(c - 70, c);
        ctx.moveTo(c + 70, c); ctx.lineTo(c + 90, c);
        ctx.stroke();

        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(c, c - 14);
        ctx.lineTo(c + 14, c);
        ctx.lineTo(c, c + 14);
        ctx.lineTo(c - 14, c);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#ffeacc';
        ctx.beginPath();
        ctx.arc(c, c, 3.8, 0, TWO_PI);
        ctx.fill();
      } else if (weaponId === 'railgun') {
        // HV-7 Orbital Anti-Materiel Sniper Mil-Dot Reticle: fine gold crosshairs + BDC drop ticks
        ctx.lineWidth = 2.6;
        ctx.globalAlpha = 0.82;
        ctx.beginPath();
        ctx.arc(c, c, 94, 0, TWO_PI);
        ctx.stroke();

        ctx.globalAlpha = 0.96;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(c - 92, c); ctx.lineTo(c - 12, c);
        ctx.moveTo(c + 12, c); ctx.lineTo(c + 92, c);
        ctx.moveTo(c, c - 92); ctx.lineTo(c, c - 12);
        ctx.moveTo(c, c + 12); ctx.lineTo(c, c + 92);
        ctx.stroke();

        ctx.lineWidth = 2.0;
        for (let d = 28; d <= 72; d += 22) {
          ctx.beginPath();
          ctx.moveTo(c - d, c - 5); ctx.lineTo(c - d, c + 5);
          ctx.moveTo(c + d, c - 5); ctx.lineTo(c + d, c + 5);
          ctx.moveTo(c - 6, c + d); ctx.lineTo(c + 6, c + d);
          ctx.stroke();
        }

        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(c - 110, c); ctx.lineTo(c - 94, c);
        ctx.moveTo(c + 94, c); ctx.lineTo(c + 110, c);
        ctx.moveTo(c, c + 94); ctx.lineTo(c, c + 110);
        ctx.stroke();

        ctx.fillStyle = '#fff6d6';
        ctx.beginPath();
        ctx.arc(c, c, 3.3, 0, TWO_PI);
        ctx.fill();
      } else if (weaponId === 'weld_pistol') {
        // W-01 Thermal Weld Pistol: industrial thermal clamp brackets + hot core dot
        ctx.lineWidth = 3.6;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(c, c, 44, -Math.PI * 0.28, Math.PI * 0.28);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c, c, 44, Math.PI * 0.72, Math.PI * 1.28);
        ctx.stroke();

        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(c - 64, c); ctx.lineTo(c - 44, c);
        ctx.moveTo(c + 44, c); ctx.lineTo(c + 64, c);
        ctx.moveTo(c, c + 24); ctx.lineTo(c, c + 48);
        ctx.stroke();

        ctx.fillStyle = '#fff4d6';
        ctx.beginPath();
        ctx.arc(c, c, 4.2, 0, TWO_PI);
        ctx.fill();
      } else if (weaponId === 'arc_rivet') {
        // T-4 Arc Rivet: electric sky-blue target-painter diamond + pierce axis ticks
        ctx.lineWidth = 3.2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(c, c - 36);
        ctx.lineTo(c + 36, c);
        ctx.lineTo(c, c + 36);
        ctx.lineTo(c - 36, c);
        ctx.closePath();
        ctx.stroke();

        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(c - 68, c); ctx.lineTo(c - 42, c);
        ctx.moveTo(c + 42, c); ctx.lineTo(c + 68, c);
        ctx.moveTo(c, c - 60); ctx.lineTo(c, c - 42);
        ctx.moveTo(c, c + 42); ctx.lineTo(c, c + 60);
        ctx.stroke();

        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(c, c, 3.6, 0, TWO_PI);
        ctx.fill();
      } else if (weaponId === 'repulsor') {
        // K-0 Kinetic Repulsor: wide CQB shock emitter ring + 3 radial shock ticks
        ctx.lineWidth = 4.0;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(c, c, 64, 0, TWO_PI);
        ctx.stroke();

        ctx.lineWidth = 3.2;
        for (let k = 0; k < 3; k++) {
          const ang = -Math.PI * 0.5 + (k * TWO_PI) / 3;
          ctx.beginPath();
          ctx.moveTo(c + Math.cos(ang) * 44, c + Math.sin(ang) * 44);
          ctx.lineTo(c + Math.cos(ang) * 78, c + Math.sin(ang) * 78);
          ctx.stroke();
        }

        ctx.fillStyle = '#dcfce7';
        ctx.beginPath();
        ctx.arc(c, c, 4.5, 0, TWO_PI);
        ctx.fill();
      } else {
        // K-9 Scrapper PDW Micro-Dot: rugged brass/amber apex chevron + flank lead ticks
        ctx.lineWidth = 4.4;
        ctx.globalAlpha = 0.96;
        ctx.beginPath();
        ctx.moveTo(c - 22, c + 16);
        ctx.lineTo(c, c - 8);
        ctx.lineTo(c + 22, c + 16);
        ctx.stroke();

        ctx.lineWidth = 3.2;
        ctx.globalAlpha = 0.82;
        ctx.beginPath();
        ctx.moveTo(c - 56, c); ctx.lineTo(c - 34, c);
        ctx.moveTo(c + 34, c); ctx.lineTo(c + 56, c);
        ctx.moveTo(c, c + 24); ctx.lineTo(c, c + 44);
        ctx.stroke();

        ctx.fillStyle = '#fff3d4';
        ctx.beginPath();
        ctx.arc(c, c - 8, 3.6, 0, TWO_PI);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this._sharedTextures.push(tex);
    return tex;
  }

  /** @private */
  _buildSharedMaterials() {
    const reg = (mat) => {
      this._sharedMaterials.push(mat);
      return mat;
    };

    // Ceramic-white orbital armor plating (VANGUARD-09 hands, HV-7 Rail Lance shroud)
    this._pilotHandGroups = [];
    this._matPilotHandArmor = reg(
      new THREE.MeshStandardMaterial({
        color: 0xdce4ee,
        metalness: 0.58,
        roughness: 0.34,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.15,
      })
    );
    this._matPilotHandAccent = reg(
      new THREE.MeshStandardMaterial({
        color: 0x4d5b44,
        metalness: 0.62,
        roughness: 0.38,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.15,
      })
    );
    this._matPilotHandGlow = reg(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: new THREE.Color(0xf59e0b),
        emissiveIntensity: 2.8,
        roughness: 0.2,
        metalness: 0.1,
      })
    );

    this._matCeramicWhite = reg(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this._texCeramicColor,
      metalness: 0.24,
      roughness: 0.44,
      bumpMap: this._texArmorBump,
      bumpScale: 0.005,
    }));

    // Weathered olive-drab military paint (M41-A receiver, K-9 PDW, VANGUARD-09 armor cuffs)
    this._matOliveArmor = reg(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this._texOliveColor,
      metalness: 0.30,
      roughness: 0.50,
      bumpMap: this._texArmorBump,
      bumpScale: 0.0055,
    }));

    // Exposed titanium-steel structural frame & robot joints (0x3a4046)
    this._matTitaniumSteel = reg(new THREE.MeshStandardMaterial({
      color: 0x3a4046,
      metalness: 0.84,
      roughness: 0.34,
      bumpMap: this._texMetalBump,
      bumpScale: 0.0045,
      roughnessMap: this._texMetalBump,
    }));

    // Weathered gunmetal steel (receivers, magazines, mounts)
    this._matGunmetal = reg(new THREE.MeshStandardMaterial({
      color: 0x2e343a,
      metalness: 0.86,
      roughness: 0.32,
      bumpMap: this._texMetalBump,
      bumpScale: 0.004,
      roughnessMap: this._texMetalBump,
    }));

    // Exposed chrome hydraulic piston rods, pins, bolts & bolt carriers
    this._matChrome = reg(new THREE.MeshStandardMaterial({
      color: 0xb2bcc4,
      metalness: 0.94,
      roughness: 0.18,
      bumpMap: this._texMetalBump,
      bumpScale: 0.0022,
    }));

    // Dark parkerized barrel & brake steel
    this._matBarrelSteel = reg(new THREE.MeshStandardMaterial({
      color: 0x202428,
      metalness: 0.88,
      roughness: 0.32,
      bumpMap: this._texMetalBump,
      bumpScale: 0.0032,
    }));

    // Matte reinforced industrial polymer
    this._matPolymer = reg(new THREE.MeshStandardMaterial({
      color: 0x242725,
      metalness: 0.18,
      roughness: 0.64,
      bumpMap: this._texCompositeBump,
      bumpScale: 0.0055,
    }));

    // Diamond-knurled rubberized grip & actuator pads
    this._matGrip = reg(new THREE.MeshStandardMaterial({
      color: 0x1a1c1a,
      metalness: 0.12,
      roughness: 0.78,
      bumpMap: this._texKnurlBump,
      bumpScale: 0.009,
    }));

    // Braided steel hydraulic / servo cables
    this._matBraid = reg(new THREE.MeshStandardMaterial({
      color: 0x3f444a,
      metalness: 0.78,
      roughness: 0.36,
      bumpMap: this._texBraidBump,
      bumpScale: 0.008,
    }));

    // Machined brass hardware & exposed cartridges
    this._matBrass = reg(new THREE.MeshStandardMaterial({
      color: 0xc89a42,
      metalness: 0.90,
      roughness: 0.24,
      bumpMap: this._texMetalBump,
      bumpScale: 0.0028,
    }));

    // Copper-wound induction coils (HV-7 Rail Lance)
    this._matCopperCoil = reg(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this._texCopperColor,
      metalness: 0.92,
      roughness: 0.26,
      bumpMap: this._texCopperBump,
      bumpScale: 0.008,
    }));

    // Rust-orange weathered military trim (BR-12 Breacher Shotgun)
    this._matRustPlate = reg(new THREE.MeshStandardMaterial({
      color: 0x8f3a18,
      metalness: 0.42,
      roughness: 0.52,
      bumpMap: this._texArmorBump,
      bumpScale: 0.0045,
    }));

    // Tactical red 12-gauge shotgun hull polymer
    this._matShellRed = reg(new THREE.MeshStandardMaterial({
      color: 0x8b2418,
      metalness: 0.14,
      roughness: 0.56,
    }));

    // Fast anti-reflective optic glass (MeshStandardMaterial — ZERO MeshPhysicalMaterial!)
    this._matOpticGlass = reg(new THREE.MeshStandardMaterial({
      color: 0x8b98a1,
      metalness: 0.20,
      roughness: 0.12,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));

    // Fast tinted window glass for battery/slug pack inspection slot
    this._matWindowGlass = reg(new THREE.MeshStandardMaterial({
      color: 0xb29e7e,
      metalness: 0.18,
      roughness: 0.16,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    }));
  }

  // ---------------------------------------------------------------------------
  // Sculpting Geometry Helpers (Tracked Per-Rig for Clean Disposal)
  // ---------------------------------------------------------------------------

  /**
   * Extrude a 2D side-profile in (z, y) centered along weapon X axis.
   * Negative z = forward (muzzle), positive z = rear (stock), positive y = up.
   * @private
   */
  _extrudeSide(geoList, ptsZY, widthX, bevel = 0.004, holesZY = null) {
    const shape = new THREE.Shape();
    shape.moveTo(ptsZY[0][0], ptsZY[0][1]);
    for (let i = 1; i < ptsZY.length; i++) {
      shape.lineTo(ptsZY[i][0], ptsZY[i][1]);
    }
    shape.closePath();

    if (holesZY) {
      for (let h = 0; h < holesZY.length; h++) {
        const holePts = holesZY[h];
        const path = new THREE.Path();
        path.moveTo(holePts[0][0], holePts[0][1]);
        for (let i = 1; i < holePts.length; i++) {
          path.lineTo(holePts[i][0], holePts[i][1]);
        }
        path.closePath();
        shape.holes.push(path);
      }
    }

    const depth = Math.max(0.002, widthX - bevel * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 6,
    });
    geo.translate(0, 0, -depth * 0.5);
    geo.rotateY(-Math.PI * 0.5);
    geo.computeVertexNormals();
    geoList.push(geo);
    return geo;
  }

  /**
   * Extrude a 2D cross-section in (x, y) centered along weapon Z axis.
   * @private
   */
  _extrudeCross(geoList, ptsXY, lengthZ, bevel = 0.0025, holesXY = null) {
    const shape = new THREE.Shape();
    shape.moveTo(ptsXY[0][0], ptsXY[0][1]);
    for (let i = 1; i < ptsXY.length; i++) {
      shape.lineTo(ptsXY[i][0], ptsXY[i][1]);
    }
    shape.closePath();

    if (holesXY) {
      for (let h = 0; h < holesXY.length; h++) {
        const holePts = holesXY[h];
        const path = new THREE.Path();
        path.moveTo(holePts[0][0], holePts[0][1]);
        for (let i = 1; i < holePts.length; i++) {
          path.lineTo(holePts[i][0], holePts[i][1]);
        }
        path.closePath();
        shape.holes.push(path);
      }
    }

    const depth = Math.max(0.002, lengthZ - bevel * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 8,
    });
    geo.translate(0, 0, -depth * 0.5);
    geo.computeVertexNormals();
    geoList.push(geo);
    return geo;
  }

  /**
   * Build a LatheGeometry revolved around the weapon Z axis from [radius, z] pairs.
   * @private
   */
  _latheZ(geoList, profileRZ, segments = 20) {
    const pts = [];
    for (let i = 0; i < profileRZ.length; i++) {
      pts.push(new THREE.Vector2(Math.max(0.0005, profileRZ[i][0]), profileRZ[i][1]));
    }
    const geo = new THREE.LatheGeometry(pts, segments);
    geo.rotateX(Math.PI * 0.5);
    geo.computeVertexNormals();
    geoList.push(geo);
    return geo;
  }

  /**
   * Build a curved braided steel cable TubeGeometry from 3D control points.
   * @private
   */
  _tube(geoList, points3D, radius = 0.006, tubularSegments = 18, radialSegments = 8) {
    const vecs = points3D.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(vecs);
    const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    geoList.push(geo);
    return geo;
  }

  /** @private */
  _box(geoList, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geoList.push(geo);
    return geo;
  }

  /** @private */
  _cyl(geoList, rt, rb, h, seg = 12) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
    geoList.push(geo);
    return geo;
  }

  /** @private */
  _addMesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (rx || ry || rz) mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);
    return mesh;
  }

  /**
   * Create a warm tactical emissive indicator / heated metal material tracked per rig.
   * @private
   */
  _makeEmissiveMat(matList, colorHex, intensity = 2.0) {
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: intensity,
      roughness: 0.25,
      metalness: 0.22,
    });
    matList.push(mat);
    return mat;
  }

  /**
   * Build crisp Picatinny rail teeth along top of receiver.
   * @private
   */
  _addPicatinnyRail(parent, geoList, y, zStart, zEnd, count, width = 0.024) {
    const span = zEnd - zStart;
    const baseGeo = this._box(geoList, width * 0.84, 0.006, Math.abs(span));
    this._addMesh(parent, baseGeo, this._matBarrelSteel, 0, y, (zStart + zEnd) * 0.5);

    const toothGeo = this._box(geoList, width, 0.0055, (Math.abs(span) / count) * 0.54);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const z = zStart + span * t;
      this._addMesh(parent, toothGeo, this._matTitaniumSteel, 0, y + 0.0045, z);
    }
  }

  /**
   * Build recessed diegetic tactical LED ammo bar segments (each with its own emissive material
   * so WeaponSystem can dim segments individually as shots are fired).
   * @private
   */
  _addDiegeticAmmoBar(parent, geoList, matList, colorHex, count, pos, rot, barLen = 0.072, barH = 0.011) {
    const holder = new THREE.Group();
    holder.position.set(pos[0], pos[1], pos[2]);
    holder.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(holder);

    const bezelGeo = this._box(geoList, 0.007, barH + 0.008, barLen + 0.012);
    this._addMesh(holder, bezelGeo, this._matBarrelSteel, 0, 0, 0);

    const recessGeo = this._box(geoList, 0.005, barH + 0.002, barLen + 0.004);
    this._addMesh(holder, recessGeo, this._matGrip, -0.0022, 0, 0);

    const segments = [];
    const step = barLen / count;
    const segGeo = this._box(geoList, 0.0038, barH * 0.78, step * 0.72);

    for (let i = 0; i < count; i++) {
      const segMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 2.3,
        roughness: 0.24,
        metalness: 0.15,
        toneMapped: false,
      });
      matList.push(segMat);

      const z = barLen * 0.5 - step * (i + 0.5);
      const segMesh = this._addMesh(holder, segGeo, segMat, -0.0036, 0, z);
      segMesh.userData.baseColor = colorHex;
      segments.push(segMesh);
    }

    return segments;
  }

  /**
   * Build the anti-reflective optic glass lens & crisp reticle plane at local (0, opticY, opticZ).
   * Uses fast MeshStandardMaterial (zero MeshPhysicalMaterial).
   * @private
   */
  _addOpticGlassAndReticle(parent, geoList, matList, weaponId, opticY, opticZ, glassW, glassH, reticleSize) {
    const glassGeo = new THREE.PlaneGeometry(glassW, glassH);
    geoList.push(glassGeo);
    this._addMesh(parent, glassGeo, this._matOpticGlass, 0, opticY, opticZ);

    const retGeo = new THREE.PlaneGeometry(reticleSize, reticleSize);
    geoList.push(retGeo);
    const retMat = new THREE.MeshBasicMaterial({
      map: this._reticleTextures[weaponId] || this._reticleTextures.pulse_rifle,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    matList.push(retMat);

    const reticleMesh = this._addMesh(parent, retGeo, retMat, 0, opticY, opticZ + 0.0025);
    reticleMesh.renderOrder = 4;
    return reticleMesh;
  }

  // ---------------------------------------------------------------------------
  // Articulated VANGUARD-09 Orbital Combat Robot Hands & Forearms (25+ parts each)
  // ---------------------------------------------------------------------------

  /**
   * Build an articulated VANGUARD-09 mechanical robot hand & layered forearm assembly.
   * Local origin (0,0,0) is centered on the palm grip point; forearm extends toward +Z.
   * @param {'left'|'right'} side
   * @param {Array} geoList
   * @param {Array} matList
   * @param {THREE.Material} statusEmissiveMat
   * @param {'pistol'|'forend'|'fist'} [gripStyle='pistol']
   * @private
   */
  setPilotFrameStyle(frameId, frameSkinCfg = null) {
    const styles = {
      vanguard: { armor: 0xdce4ee, accent: 0x4d5b44, glow: 0xf59e0b, em: 0x101010, scale: [1.0, 1.0, 1.0] },
      strider:  { armor: 0x93c5fd, accent: 0x0c4a6e, glow: 0x00f0ff, em: 0x062a42, scale: [0.84, 0.88, 1.08] },
      bastion:  { armor: 0x334155, accent: 0x16a34a, glow: 0x22c55e, em: 0x072614, scale: [1.26, 1.24, 1.08] },
      apex:     { armor: 0x181822, accent: 0xb91c1c, glow: 0xff2a44, em: 0x2b060c, scale: [1.06, 1.06, 1.14] },
    };
    const base = styles[frameId] || styles.vanguard;
    const armorHex = frameSkinCfg && frameSkinCfg.armorHex != null ? frameSkinCfg.armorHex : base.armor;
    const accentHex = frameSkinCfg && frameSkinCfg.accentHex != null ? frameSkinCfg.accentHex : base.accent;
    const glowHex = frameSkinCfg && frameSkinCfg.glowHex != null ? frameSkinCfg.glowHex : base.glow;
    const emHex = frameSkinCfg && frameSkinCfg.armorHex != null ? 0x121216 : base.em;

    if (this._matPilotHandArmor) {
      this._matPilotHandArmor.color.setHex(armorHex);
      this._matPilotHandArmor.emissive.setHex(emHex);
    }
    if (this._matPilotHandAccent) {
      this._matPilotHandAccent.color.setHex(accentHex);
      this._matPilotHandAccent.emissive.setHex(emHex);
    }
    if (this._matPilotHandGlow) {
      this._matPilotHandGlow.color.setHex(glowHex);
      this._matPilotHandGlow.emissive.setHex(glowHex);
    }
    if (this._pilotHandGroups) {
      for (let i = 0; i < this._pilotHandGroups.length; i++) {
        this._pilotHandGroups[i].scale.set(base.scale[0], base.scale[1], base.scale[2]);
      }
    }
  }

  _buildRobotHand(side, geoList, matList, statusEmissiveMat, gripStyle = 'pistol') {
    const s = side === 'right' ? 1 : -1;
    const handGroup = new THREE.Group();
    if (this._pilotHandGroups) this._pilotHandGroups.push(handGroup);

    // 1. Exposed Titanium-Steel Mechanical Palm Chassis
    const palmCoreGeo = this._extrudeCross(
      geoList,
      [
        [-0.025, -0.021],
        [0.025, -0.021],
        [0.031, 0.004],
        [0.021, 0.023],
        [-0.021, 0.023],
        [-0.031, 0.004],
      ],
      0.066,
      0.0035
    );
    this._addMesh(handGroup, palmCoreGeo, this._matTitaniumSteel, 0, 0, 0.012);

    // 2. Ceramic-White Beveled Dorsal Hand Armor Shield + Olive-Drab Side Palm Guard
    const dorsalShieldGeo = this._extrudeCross(
      geoList,
      [
        [-0.024, 0.009],
        [0.024, 0.009],
        [0.020, 0.031],
        [-0.020, 0.031],
      ],
      0.056,
      0.003
    );
    this._addMesh(handGroup, dorsalShieldGeo, this._matPilotHandArmor, s * 0.004, 0.003, 0.004, 0.08, 0, -s * 0.14);

    const sideGuardGeo = this._box(geoList, 0.010, 0.026, 0.050);
    this._addMesh(handGroup, sideGuardGeo, this._matPilotHandAccent, s * 0.028, 0.004, 0.012);

    // Recessed Tactical Amber Status Pip on Dorsal Hand Plate
    const handStatusGeo = this._box(geoList, 0.026, 0.0035, 0.005);
    this._addMesh(handGroup, handStatusGeo, this._matPilotHandGlow, s * 0.004, 0.031, 0.016);

    // 3. Exposed Hex Joint Bolts along Knuckle Bridge & Wrist Gimbal
    const hexBoltGeo = this._cyl(geoList, 0.0042, 0.0042, 0.006, 6);
    this._addMesh(handGroup, hexBoltGeo, this._matChrome, s * 0.018, 0.022, -0.016);
    this._addMesh(handGroup, hexBoltGeo, this._matChrome, -s * 0.010, 0.022, -0.016);
    this._addMesh(handGroup, hexBoltGeo, this._matChrome, s * 0.034, 0.002, 0.044, 0, 0, Math.PI * 0.5);
    this._addMesh(handGroup, hexBoltGeo, this._matChrome, -s * 0.028, 0.002, 0.044, 0, 0, Math.PI * 0.5);

    // 4. Five Articulated Mechanical Servo Fingers (Knuckle Pins + Titanium Links + Ceramic Tips + Grip Pads)
    const fingerOffsets = [-0.019, -0.006, 0.007, 0.019];
    const fingerLens = [0.034, 0.038, 0.035, 0.029];
    const servoPinGeo = this._cyl(geoList, 0.0058, 0.0058, 0.013, 8);
    const padGeo = this._box(geoList, 0.009, 0.008, 0.012);

    for (let i = 0; i < 4; i++) {
      const fz = -0.020 + i * 0.013;
      const isTriggerFinger = side === 'right' && i === 0 && gripStyle === 'pistol';
      const proxGeo = this._box(geoList, 0.011, 0.0115, fingerLens[i]);
      const distGeo = this._box(geoList, 0.0098, 0.010, fingerLens[i] * 0.78);

      if (gripStyle === 'pistol') {
        const yOff = 0.014 - i * 0.0155;
        this._addMesh(handGroup, servoPinGeo, this._matChrome, s * 0.022, yOff, -0.022);
        if (isTriggerFinger) {
          this._addMesh(handGroup, proxGeo, this._matTitaniumSteel, s * 0.018, yOff + 0.004, -0.044, 0.06, s * 0.18, 0);
          this._addMesh(handGroup, distGeo, this._matPilotHandArmor, s * 0.006, yOff + 0.002, -0.064, 0.04, s * 0.58, 0);
        } else {
          this._addMesh(handGroup, proxGeo, this._matTitaniumSteel, s * 0.004, yOff, -0.036, 0, s * 1.12, 0);
          this._addMesh(handGroup, distGeo, this._matPilotHandArmor, -s * 0.016, yOff, -0.032, 0, s * 1.85, 0);
          this._addMesh(handGroup, padGeo, this._matGrip, -s * 0.020, yOff, -0.026, 0, s * 1.85, 0);
        }
      } else if (gripStyle === 'fist') {
        // Clenched combat fist for Thermal Pry-Blade strikes
        const xOff = fingerOffsets[i] * 0.55;
        this._addMesh(handGroup, servoPinGeo, this._matChrome, xOff, 0.010, -0.022, 0, 0, Math.PI * 0.5);
        this._addMesh(handGroup, proxGeo, this._matTitaniumSteel, xOff, -0.008, -0.034, 1.05, 0, 0);
        this._addMesh(handGroup, distGeo, this._matPilotHandArmor, xOff, -0.022, -0.020, 2.15, 0, 0);
      } else {
        // Left-hand forend / pump cradle: mechanical claws wrap up around handguard
        const xOff = fingerOffsets[i] * 0.35;
        this._addMesh(handGroup, servoPinGeo, this._matChrome, -s * 0.020, -0.008, fz - 0.012);
        this._addMesh(handGroup, proxGeo, this._matTitaniumSteel, -s * 0.028, 0.010, fz - 0.016, -0.55, s * 0.25, -s * 0.45);
        this._addMesh(handGroup, distGeo, this._matPilotHandArmor, -s * 0.020 + xOff, 0.032, fz - 0.018, -0.15, s * 0.1, s * 0.35);
      }
    }

    // 5. Opposing Articulated Robot Thumb (Ceramic armor shell + Chrome pin + Grip tip)
    const thumbProx = this._box(geoList, 0.013, 0.013, 0.033);
    const thumbDist = this._box(geoList, 0.011, 0.011, 0.025);
    if (gripStyle === 'pistol') {
      this._addMesh(handGroup, servoPinGeo, this._matChrome, -s * 0.025, 0.014, -0.004);
      this._addMesh(handGroup, thumbProx, this._matTitaniumSteel, -s * 0.022, 0.018, -0.014, -0.25, -s * 0.42, 0);
      this._addMesh(handGroup, thumbDist, this._matPilotHandArmor, -s * 0.014, 0.024, -0.036, -0.1, -s * 0.75, 0);
    } else if (gripStyle === 'fist') {
      this._addMesh(handGroup, servoPinGeo, this._matChrome, s * 0.022, 0.008, -0.008);
      this._addMesh(handGroup, thumbProx, this._matTitaniumSteel, s * 0.018, -0.002, -0.026, 0.35, s * 0.65, 0);
      this._addMesh(handGroup, thumbDist, this._matPilotHandArmor, -s * 0.002, -0.010, -0.036, 0.25, s * 1.15, 0);
    } else {
      this._addMesh(handGroup, servoPinGeo, this._matChrome, s * 0.026, 0.012, -0.004);
      this._addMesh(handGroup, thumbProx, this._matTitaniumSteel, s * 0.024, 0.016, -0.010, 0.2, s * 0.48, 0);
      this._addMesh(handGroup, thumbDist, this._matPilotHandArmor, s * 0.016, 0.028, -0.030, 0.15, s * 0.85, 0);
    }

    // 6. Robotic Wrist Gimbal + Tactical Amber Status Bar
    const wristGimbalGeo = this._latheZ(
      geoList,
      [
        [0.024, 0.042],
        [0.029, 0.050],
        [0.026, 0.062],
        [0.031, 0.072],
      ],
      12
    );
    this._addMesh(handGroup, wristGimbalGeo, this._matTitaniumSteel, s * 0.005, -0.003, 0);

    // Ceramic-white angled wrist armor collar
    const wristCollarGeo = this._extrudeCross(
      geoList,
      [
        [-0.036, -0.028],
        [0.036, -0.028],
        [0.042, 0.0],
        [0.033, 0.032],
        [-0.033, 0.032],
        [-0.042, 0.0],
      ],
      0.044,
      0.004
    );
    this._addMesh(handGroup, wristCollarGeo, this._matPilotHandArmor, s * 0.006, -0.004, 0.074);

    // Recessed Tactical Amber Wrist Status Bar (in dark gunmetal bezel)
    const wristBarBezel = this._box(geoList, 0.056, 0.009, 0.016);
    this._addMesh(handGroup, wristBarBezel, this._matBarrelSteel, s * 0.006, 0.029, 0.074);
    const wristBarAmber = this._box(geoList, 0.046, 0.0045, 0.008);
    this._addMesh(handGroup, wristBarAmber, this._matPilotHandGlow, s * 0.006, 0.032, 0.074);

    // 7. Exposed Titanium-Steel Structural Forearm Core (visible behind armor cowling)
    const forearmCoreGeo = this._latheZ(
      geoList,
      [
        [0.030, 0.084],
        [0.036, 0.14],
        [0.042, 0.28],
        [0.048, 0.40],
      ],
      10
    );
    this._addMesh(handGroup, forearmCoreGeo, this._matTitaniumSteel, s * 0.012, -0.012, 0.0);

    // 8. Layered Ceramic-White & Olive-Drab Forearm Armor Cowling (ExtrudeGeometry)
    const ceramicCowlingGeo = this._extrudeSide(
      geoList,
      [
        [0.092, 0.024],
        [0.18, 0.042],
        [0.34, 0.048],
        [0.36, 0.016],
        [0.105, 0.002],
      ],
      0.068,
      0.0045
    );
    this._addMesh(handGroup, ceramicCowlingGeo, this._matPilotHandArmor, s * 0.018, 0.002, 0.0, 0, 0, -s * 0.16);

    const oliveCowlingGeo = this._extrudeSide(
      geoList,
      [
        [0.115, 0.006],
        [0.24, 0.014],
        [0.35, 0.012],
        [0.35, -0.022],
        [0.125, -0.020],
      ],
      0.074,
      0.0035
    );
    this._addMesh(handGroup, oliveCowlingGeo, this._matPilotHandAccent, s * 0.014, -0.006, 0.0, 0, 0, -s * 0.14);

    // 9. Exposed Chrome Hydraulic Piston Rods & Gunmetal Actuator Sleeves
    const sleeveGeo = this._cyl(geoList, 0.0072, 0.0072, 0.095, 8);
    const pistonRodGeo = this._cyl(geoList, 0.0044, 0.0044, 0.11, 8);
    this._addMesh(handGroup, sleeveGeo, this._matBarrelSteel, s * 0.042, 0.018, 0.23, Math.PI * 0.5, 0, 0);
    this._addMesh(handGroup, pistonRodGeo, this._matChrome, s * 0.042, 0.018, 0.145, Math.PI * 0.5, 0, 0);

    this._addMesh(handGroup, sleeveGeo, this._matBarrelSteel, -s * 0.016, 0.032, 0.24, Math.PI * 0.5, 0, 0);
    this._addMesh(handGroup, pistonRodGeo, this._matChrome, -s * 0.016, 0.032, 0.155, Math.PI * 0.5, 0, 0);

    // 10. Braided Steel Servo Cables curving from Forearm Housing into Wrist Gimbal
    const servoCableGeo = this._tube(
      geoList,
      [
        [s * 0.038, -0.006, 0.064],
        [s * 0.050, -0.014, 0.135],
        [s * 0.046, -0.010, 0.220],
        [s * 0.038, -0.004, 0.295],
      ],
      0.0052,
      14,
      7
    );
    this._addMesh(handGroup, servoCableGeo, this._matBraid);

    // Twin Titanium Armor Clasps + Exposed Hex Bolts
    const claspGeo = this._box(geoList, 0.076, 0.012, 0.018);
    this._addMesh(handGroup, claspGeo, this._matTitaniumSteel, s * 0.014, 0.028, 0.16);
    this._addMesh(handGroup, claspGeo, this._matTitaniumSteel, s * 0.016, 0.032, 0.26);
    this._addMesh(handGroup, hexBoltGeo, this._matChrome, s * 0.048, 0.028, 0.16);
    this._addMesh(handGroup, hexBoltGeo, this._matChrome, s * 0.050, 0.032, 0.26);

    return handGroup;
  }

  // ---------------------------------------------------------------------------
  // Public API: Build Any of the 4 Military-SF Weapons
  // ---------------------------------------------------------------------------

  /**
   * Build a sculpted 40-55+ part 1P weapon rig tailored to weaponConfig from weapons.js.
   * @param {object} weaponConfig
   */
  createWeaponRig(weaponConfig) {
    const id = weaponConfig?.id || 'pulse_rifle';
    if (id === 'scattergun') return this._buildScattergun(weaponConfig);
    if (id === 'railgun') return this._buildRailgun(weaponConfig);
    if (id === 'plasma_smg') return this._buildPlasmaSmg(weaponConfig);
    if (id === 'weld_pistol') return this._buildWeldPistol(weaponConfig);
    if (id === 'arc_rivet') return this._buildArcRivet(weaponConfig);
    if (id === 'repulsor') return this._buildRepulsor(weaponConfig);
    return this._buildPulseRifle(weaponConfig);
  }


  // ---------------------------------------------------------------------------
  // SECONDARY 1: W-01 THERMAL WELD PISTOL (Rust-Plated Industrial Torch, #f97316)
  // ADS reticle target: (0, +0.145, +0.02) -> matches adsOffset.y = -0.15
  // ---------------------------------------------------------------------------

  /** @private */
  _buildWeldPistol(cfg) {
    const root = new THREE.Group();
    root.name = 'rig_weld_pistol';
    const geos = [];
    const mats = [];
    const accentColor = cfg.color ?? 0xf97316;

    const heatLedMat = this._makeEmissiveMat(mats, accentColor, 2.2);
    const arcTipMat = this._makeEmissiveMat(mats, 0xffd199, 2.8);
    const chargeEmissives = [heatLedMat, arcTipMat];

    // 1. Weathered Rust-Plate Thermal Upper Shroud (compact industrial pistol profile)
    const upperGeo = this._extrudeSide(
      geos,
      [
        [-0.28, 0.014],
        [-0.25, 0.072],
        [-0.04, 0.080],
        [0.12, 0.076],
        [0.15, 0.052],
        [0.14, 0.012],
        [-0.28, 0.012],
      ],
      0.056,
      0.005
    );
    this._addMesh(root, upperGeo, this._matRustPlate);

    // 2. Heavy Gunmetal Frame + Hollow Trigger Guard
    const lowerGeo = this._extrudeSide(
      geos,
      [
        [-0.22, 0.014],
        [0.13, 0.014],
        [0.11, -0.036],
        [0.01, -0.036],
        [-0.02, -0.058],
        [-0.14, -0.058],
        [-0.22, -0.014],
      ],
      0.046,
      0.0035,
      [
        [
          [0.005, -0.030],
          [0.068, -0.030],
          [0.072, -0.004],
          [0.002, -0.004],
        ],
      ]
    );
    this._addMesh(root, lowerGeo, this._matGunmetal);

    // 3. Ribbed Polymer Pistol Grip
    const gripGeo = this._extrudeSide(
      geos,
      [
        [0.062, -0.018],
        [0.126, -0.018],
        [0.156, -0.142],
        [0.086, -0.152],
      ],
      0.038,
      0.004
    );
    this._addMesh(root, gripGeo, this._matGrip);

    // 4. Slotted Thermal Heat-Vent Louvers along both flanks (4 glowing copper-lined gills)
    const ventMat = this._matCopperCoil;
    for (let i = 0; i < 4; i++) {
      const vz = -0.06 - i * 0.046;
      const finGeo = this._box(geos, 0.062, 0.022, 0.014);
      this._addMesh(root, finGeo, ventMat, 0, 0.046, vz, 0.25, 0, 0);
      const glowSlitGeo = this._box(geos, 0.060, 0.008, 0.010);
      this._addMesh(root, glowSlitGeo, heatLedMat, 0, 0.044, vz - 0.014);
    }

    // 5. Lathed Copper-Core Thermal Welding Nozzle + Twin Ceramic Arc Electrodes
    const nozzleGeo = this._latheZ(
      geos,
      [
        [0.024, -0.275],
        [0.026, -0.320],
        [0.019, -0.355],
        [0.022, -0.382],
        [0.014, -0.415],
        [0.009, -0.415],
      ],
      16
    );
    this._addMesh(root, nozzleGeo, this._matBarrelSteel, 0, 0.040, 0);

    const coilWrapGeo = this._cyl(geos, 0.025, 0.025, 0.075, 16);
    this._addMesh(root, coilWrapGeo, this._matCopperCoil, 0, 0.040, -0.325, Math.PI * 0.5, 0, 0);

    // Twin protruding ceramic welding prongs + glowing plasma arc core
    for (const sx of [-0.018, 0.018]) {
      const prongGeo = this._box(geos, 0.007, 0.010, 0.064);
      this._addMesh(root, prongGeo, this._matCeramicWhite, sx, 0.040, -0.422);
      const tipGeo = this._box(geos, 0.006, 0.006, 0.014);
      this._addMesh(root, tipGeo, arcTipMat, sx * 0.78, 0.040, -0.456);
    }

    // 6. Underslung Pressurized Brass Gas Canister (replaces magazine — no-reload heat weapon!)
    const magazineGroup = new THREE.Group();
    magazineGroup.name = 'magazineGroup';
    const tankGeo = this._cyl(geos, 0.022, 0.022, 0.145, 16);
    this._addMesh(magazineGroup, tankGeo, this._matBrass, 0, -0.042, -0.185, Math.PI * 0.44, 0, 0);
    const tankCapGeo = this._cyl(geos, 0.024, 0.020, 0.022, 16);
    this._addMesh(magazineGroup, tankCapGeo, this._matTitaniumSteel, 0, -0.056, -0.256, Math.PI * 0.44, 0, 0);
    // Braided flexible fuel hose connecting tank to upper thermal chamber
    const hoseGeo = this._tube(
      geos,
      [
        [0.022, -0.036, -0.155],
        [0.042, -0.010, -0.170],
        [0.038, 0.028, -0.195],
        [0.024, 0.040, -0.220],
      ],
      0.0055,
      14,
      8
    );
    this._addMesh(magazineGroup, hoseGeo, this._matBraid);
    root.add(magazineGroup);

    // 7. Top Picatinny Rail + Open-Frame Industrial Thermal Reflex Sight (opticY = 0.145)
    this._addPicatinnyRail(root, geos, 0.082, -0.16, 0.08, 9, 0.024);
    const opticY = 0.145;
    const opticZ = 0.02;
    const riserGeo = this._box(geos, 0.036, 0.028, 0.072);
    this._addMesh(root, riserGeo, this._matGunmetal, 0, 0.098, opticZ);
    const hoodGeo = this._extrudeCross(
      geos,
      [
        [-0.036, -0.028],
        [0.036, -0.028],
        [0.040, 0.008],
        [0.026, 0.030],
        [-0.026, 0.030],
        [-0.040, 0.008],
      ],
      0.052,
      0.0025,
      [
        [
          [-0.028, -0.018],
          [0.028, -0.018],
          [0.031, 0.006],
          [0.020, 0.022],
          [-0.020, 0.022],
          [-0.031, 0.006],
        ],
      ]
    );
    this._addMesh(root, hoodGeo, this._matOliveArmor, 0, opticY, opticZ);
    const reticleMesh = this._addOpticGlassAndReticle(
      root, geos, mats, 'weld_pistol', opticY, opticZ, 0.058, 0.042, 0.036
    );

    // 8. Animated Thermal Vent Slide (`boltMesh`)
    const boltMesh = new THREE.Group();
    boltMesh.name = 'boltMesh_weld';
    const slideGeo = this._box(geos, 0.062, 0.020, 0.085);
    this._addMesh(boltMesh, slideGeo, this._matTitaniumSteel, 0, 0.068, -0.055);
    const rearRingGeo = this._box(geos, 0.044, 0.016, 0.014);
    this._addMesh(boltMesh, rearRingGeo, this._matBrass, 0, 0.068, 0.135);
    root.add(boltMesh);

    // 9. Diegetic 10-LED Thermal Heat Strip on Rear Left Receiver
    const ammoBarSegments = this._addDiegeticAmmoBar(
      root, geos, mats, accentColor, 10, [-0.030, 0.060, 0.055], [0, 0, -0.28], 0.080, 0.011
    );

    // 10. Muzzle & Ejection Anchors
    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.040, -0.462);
    root.add(muzzleAnchor);

    const ejectAnchor = new THREE.Object3D();
    ejectAnchor.position.set(0.045, 0.058, -0.055);
    root.add(ejectAnchor);

    // 11. Articulated VANGUARD-09 Robot Hands (braced pistol stance)
    const rightHand = this._buildRobotHand('right', geos, mats, heatLedMat, 'pistol');
    rightHand.position.set(0.016, -0.078, 0.105);
    rightHand.rotation.set(0.20, 0.12, -0.08);
    root.add(rightHand);

    const leftHand = this._buildRobotHand('left', geos, mats, heatLedMat, 'forend');
    leftHand.position.set(-0.018, -0.072, -0.088);
    leftHand.rotation.set(0.22, -0.45, -0.12);
    root.add(leftHand);

    return this._finalizeRig({
      root,
      muzzleAnchor,
      ejectAnchor,
      boltMesh,
      magazineGroup,
      ammoBarSegments,
      chargeEmissives,
      leftHand,
      rightHand,
      reticleMesh,
      geos,
      mats,
      pumpLinkedLeftHand: false,
      boltKickDist: 0.032,
      recoilKickZ: 0.042,
      recoilPitchKick: 0.055,
      magDropY: -0.02,
      magTiltX: 0.05,
    });
  }

  // ---------------------------------------------------------------------------
  // SECONDARY 2: T-4 ARC RIVET GUN (Ceramic & Titanium Twin-Rail Marker, #38bdf8)
  // ADS reticle target: (0, +0.145, +0.02) -> matches adsOffset.y = -0.15
  // ---------------------------------------------------------------------------

  /** @private */
  _buildArcRivet(cfg) {
    const root = new THREE.Group();
    root.name = 'rig_arc_rivet';
    const geos = [];
    const mats = [];
    const accentColor = cfg.color ?? 0x38bdf8;

    const arcLedMat = this._makeEmissiveMat(mats, accentColor, 2.3);
    const coreGlowMat = this._makeEmissiveMat(mats, 0xbae6fd, 2.6);
    const chargeEmissives = [arcLedMat, coreGlowMat];

    // 1. Sleek Ceramic-White & Titanium Angular Upper Chassis
    const upperGeo = this._extrudeSide(
      geos,
      [
        [-0.36, 0.018],
        [-0.34, 0.062],
        [-0.12, 0.076],
        [0.13, 0.078],
        [0.17, 0.056],
        [0.15, 0.014],
        [-0.36, 0.014],
      ],
      0.050,
      0.0045
    );
    this._addMesh(root, upperGeo, this._matCeramicWhite);

    // 2. Dark Gunmetal Lower Rail Frame + Trigger Guard
    const lowerGeo = this._extrudeSide(
      geos,
      [
        [-0.32, 0.016],
        [0.14, 0.016],
        [0.12, -0.034],
        [0.00, -0.034],
        [-0.03, -0.048],
        [-0.24, -0.048],
        [-0.32, -0.012],
      ],
      0.042,
      0.003,
      [
        [
          [0.010, -0.028],
          [0.072, -0.028],
          [0.076, -0.002],
          [0.006, -0.002],
        ],
      ]
    );
    this._addMesh(root, lowerGeo, this._matGunmetal);

    // 3. Ergonomic Forward-Cant Pistol Grip
    const gripGeo = this._extrudeSide(
      geos,
      [
        [0.068, -0.016],
        [0.132, -0.016],
        [0.168, -0.146],
        [0.096, -0.156],
      ],
      0.036,
      0.004
    );
    this._addMesh(root, gripGeo, this._matGrip);

    // 4. Twin Forward Electromagnetic Guide Rails + Exposed Copper Accelerator Coils
    for (const sy of [0.054, 0.020]) {
      const railGeo = this._box(geos, 0.014, 0.012, 0.24);
      this._addMesh(root, railGeo, this._matTitaniumSteel, -0.016, sy, -0.37);
      this._addMesh(root, railGeo, this._matTitaniumSteel, 0.016, sy, -0.37);
    }
    // Glowing sky-blue magnetic track running between the twin rails
    const trackGeo = this._box(geos, 0.012, 0.008, 0.23);
    this._addMesh(root, trackGeo, arcLedMat, 0, 0.037, -0.365);

    // 3 Copper Induction Coil Rings wrapping the accelerator channel
    for (let i = 0; i < 3; i++) {
      const cz = -0.28 - i * 0.062;
      const coilGeo = this._box(geos, 0.052, 0.048, 0.020);
      this._addMesh(root, coilGeo, this._matCopperCoil, 0, 0.037, cz);
    }

    // 5. Three-Cell Auto-Regen Capacitor Array (visually represents 3-shot auto-charge!)
    const magazineGroup = new THREE.Group();
    magazineGroup.name = 'magazineGroup';
    for (let i = 0; i < 3; i++) {
      const cz = -0.06 - i * 0.042;
      const cellGeo = this._cyl(geos, 0.010, 0.010, 0.056, 12);
      this._addMesh(magazineGroup, cellGeo, coreGlowMat, -0.032, 0.044, cz, 0, 0, 0.28);
      const capGeo = this._cyl(geos, 0.012, 0.012, 0.012, 12);
      this._addMesh(magazineGroup, capGeo, this._matTitaniumSteel, -0.038, 0.070, cz, 0, 0, 0.28);
    }
    // High-voltage arc conduit cable on right side
    const cableGeo = this._tube(
      geos,
      [
        [0.026, 0.030, -0.02],
        [0.042, 0.026, -0.14],
        [0.038, 0.036, -0.26],
        [0.024, 0.037, -0.32],
      ],
      0.0045,
      14,
      8
    );
    this._addMesh(magazineGroup, cableGeo, this._matBraid);
    root.add(magazineGroup);

    // 6. Cantilevered Holographic Target-Painter Optic (opticY = 0.145)
    this._addPicatinnyRail(root, geos, 0.079, -0.14, 0.10, 10, 0.022);
    const opticY = 0.145;
    const opticZ = 0.02;
    const mountGeo = this._box(geos, 0.028, 0.032, 0.062);
    this._addMesh(root, mountGeo, this._matTitaniumSteel, 0, 0.098, opticZ);
    const hoodGeo = this._extrudeCross(
      geos,
      [
        [-0.038, -0.026],
        [0.038, -0.026],
        [0.032, 0.028],
        [-0.032, 0.028],
      ],
      0.056,
      0.002,
      [
        [
          [-0.030, -0.018],
          [0.030, -0.018],
          [0.025, 0.021],
          [-0.025, 0.021],
        ],
      ]
    );
    this._addMesh(root, hoodGeo, this._matGunmetal, 0, opticY, opticZ);
    const reticleMesh = this._addOpticGlassAndReticle(
      root, geos, mats, 'arc_rivet', opticY, opticZ, 0.060, 0.042, 0.038
    );

    // 7. Animated Pneumatic Striker Piston (`boltMesh`)
    const boltMesh = new THREE.Group();
    boltMesh.name = 'boltMesh_rivet';
    const pistonGeo = this._cyl(geos, 0.009, 0.009, 0.11, 12);
    this._addMesh(boltMesh, pistonGeo, this._matChrome, 0, 0.054, -0.04, Math.PI * 0.5, 0, 0);
    const strikerBlockGeo = this._box(geos, 0.032, 0.018, 0.028);
    this._addMesh(boltMesh, strikerBlockGeo, this._matTitaniumSteel, 0, 0.058, 0.145);
    root.add(boltMesh);

    // 8. Diegetic 6-LED Charge Strip on Rear Left
    const ammoBarSegments = this._addDiegeticAmmoBar(
      root, geos, mats, accentColor, 6, [-0.028, 0.064, 0.068], [0, 0, -0.25], 0.072, 0.011
    );

    // 9. Muzzle & Ejection Anchors
    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.037, -0.495);
    root.add(muzzleAnchor);

    const ejectAnchor = new THREE.Object3D();
    ejectAnchor.position.set(0.040, 0.052, -0.04);
    root.add(ejectAnchor);

    // 10. Articulated VANGUARD-09 Robot Hands
    const rightHand = this._buildRobotHand('right', geos, mats, arcLedMat, 'pistol');
    rightHand.position.set(0.016, -0.078, 0.112);
    rightHand.rotation.set(0.18, 0.12, -0.08);
    root.add(rightHand);

    const leftHand = this._buildRobotHand('left', geos, mats, arcLedMat, 'forend');
    leftHand.position.set(-0.014, -0.060, -0.155);
    leftHand.rotation.set(0.22, -0.50, -0.14);
    root.add(leftHand);

    return this._finalizeRig({
      root,
      muzzleAnchor,
      ejectAnchor,
      boltMesh,
      magazineGroup,
      ammoBarSegments,
      chargeEmissives,
      leftHand,
      rightHand,
      reticleMesh,
      geos,
      mats,
      pumpLinkedLeftHand: false,
      boltKickDist: 0.048,
      recoilKickZ: 0.055,
      recoilPitchKick: 0.072,
      magDropY: -0.02,
      magTiltX: 0.04,
    });
  }

  // ---------------------------------------------------------------------------
  // SECONDARY 3: K-0 KINETIC REPULSOR (Heavy Bell-Mouth Shock Cannon, #22c55e)
  // ADS reticle target: (0, +0.145, +0.02) -> matches adsOffset.y = -0.15
  // ---------------------------------------------------------------------------

  /** @private */
  _buildRepulsor(cfg) {
    const root = new THREE.Group();
    root.name = 'rig_repulsor';
    const geos = [];
    const mats = [];
    const accentColor = cfg.color ?? 0x22c55e;

    const pulseLedMat = this._makeEmissiveMat(mats, accentColor, 2.3);
    const dishGlowMat = this._makeEmissiveMat(mats, 0x86efac, 2.5);
    const chargeEmissives = [pulseLedMat, dishGlowMat];

    // 1. Heavy Weathered Olive-Drab Armored Receiver Block
    const upperGeo = this._extrudeSide(
      geos,
      [
        [-0.25, 0.008],
        [-0.23, 0.084],
        [-0.02, 0.088],
        [0.13, 0.080],
        [0.16, 0.048],
        [0.14, 0.008],
        [-0.25, 0.008],
      ],
      0.076,
      0.0055
    );
    this._addMesh(root, upperGeo, this._matOliveArmor);

    // 2. Reinforced Gunmetal Chassis + Oversized Trigger Guard
    const lowerGeo = this._extrudeSide(
      geos,
      [
        [-0.24, 0.010],
        [0.14, 0.010],
        [0.11, -0.042],
        [-0.02, -0.042],
        [-0.06, -0.062],
        [-0.22, -0.052],
        [-0.24, -0.014],
      ],
      0.064,
      0.004,
      [
        [
          [-0.002, -0.034],
          [0.068, -0.034],
          [0.072, -0.004],
          [-0.006, -0.004],
        ],
      ]
    );
    this._addMesh(root, lowerGeo, this._matGunmetal);

    // 3. Heavy Braced Pistol Grip
    const gripGeo = this._extrudeSide(
      geos,
      [
        [0.058, -0.020],
        [0.128, -0.020],
        [0.164, -0.148],
        [0.088, -0.158],
      ],
      0.044,
      0.0045
    );
    this._addMesh(root, gripGeo, this._matGrip);

    // 4. Wide Flared Bell-Mouth Kinetic Emitter Dish (LatheGeometry)
    const bellGeo = this._latheZ(
      geos,
      [
        [0.034, -0.240],
        [0.038, -0.295],
        [0.052, -0.345],
        [0.068, -0.390],
        [0.072, -0.408],
        [0.060, -0.408],
        [0.044, -0.355],
        [0.022, -0.310],
      ],
      18
    );
    this._addMesh(root, bellGeo, this._matBarrelSteel, 0, 0.038, 0);

    // Glowing emerald kinetic emitter core ring inside the bell-mouth
    const coreRingGeo = this._cyl(geos, 0.036, 0.026, 0.024, 16);
    this._addMesh(root, coreRingGeo, dishGlowMat, 0, 0.038, -0.355, Math.PI * 0.5, 0, 0);

    // 3 Radial Shock-Absorber Struts bracing the flared emitter dish
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI * 2) / 3 + Math.PI / 6;
      const sx = Math.cos(ang) * 0.054;
      const sy = 0.038 + Math.sin(ang) * 0.054;
      const strutGeo = this._box(geos, 0.014, 0.014, 0.145);
      this._addMesh(root, strutGeo, this._matTitaniumSteel, sx, sy, -0.320, 0, 0, ang);
    }

    // 5. Dual Side-Mounted Kinetic Charge Drums (2 charges)
    const magazineGroup = new THREE.Group();
    magazineGroup.name = 'magazineGroup';
    for (const sx of [-0.048, 0.048]) {
      const drumGeo = this._cyl(geos, 0.022, 0.022, 0.095, 14);
      this._addMesh(magazineGroup, drumGeo, this._matGunmetal, sx, 0.016, -0.145, Math.PI * 0.5, 0, 0);
      const bandGeo = this._cyl(geos, 0.0235, 0.0235, 0.022, 14);
      this._addMesh(magazineGroup, bandGeo, pulseLedMat, sx, 0.016, -0.145, Math.PI * 0.5, 0, 0);
    }
    root.add(magazineGroup);

    // 6. Wide-Aperture CQB Holo Ring Sight (opticY = 0.145)
    this._addPicatinnyRail(root, geos, 0.088, -0.16, 0.08, 8, 0.028);
    const opticY = 0.145;
    const opticZ = 0.02;
    const baseGeo = this._box(geos, 0.046, 0.024, 0.068);
    this._addMesh(root, baseGeo, this._matGunmetal, 0, 0.100, opticZ);
    const hoodGeo = this._extrudeCross(
      geos,
      [
        [-0.044, -0.028],
        [0.044, -0.028],
        [0.048, 0.010],
        [0.034, 0.032],
        [-0.034, 0.032],
        [-0.048, 0.010],
      ],
      0.048,
      0.0025,
      [
        [
          [-0.036, -0.018],
          [0.036, -0.018],
          [0.039, 0.008],
          [0.028, 0.024],
          [-0.028, 0.024],
          [-0.039, 0.008],
        ],
      ]
    );
    this._addMesh(root, hoodGeo, this._matOliveArmor, 0, opticY, opticZ);
    const reticleMesh = this._addOpticGlassAndReticle(
      root, geos, mats, 'repulsor', opticY, opticZ, 0.072, 0.046, 0.044
    );

    // 7. Twin Hydraulic Recoil Cylinders (`boltMesh` kicks back hard on shock blast!)
    const boltMesh = new THREE.Group();
    boltMesh.name = 'boltMesh_repulsor';
    for (const sx of [-0.042, 0.042]) {
      const rodGeo = this._cyl(geos, 0.009, 0.009, 0.13, 12);
      this._addMesh(boltMesh, rodGeo, this._matChrome, sx, 0.060, -0.16, Math.PI * 0.5, 0, 0);
      const collarGeo = this._cyl(geos, 0.013, 0.013, 0.026, 12);
      this._addMesh(boltMesh, collarGeo, this._matBrass, sx, 0.060, -0.22, Math.PI * 0.5, 0, 0);
    }
    root.add(boltMesh);

    // 8. Diegetic 4-LED Kinetic Charge Bar on Rear Left
    const ammoBarSegments = this._addDiegeticAmmoBar(
      root, geos, mats, accentColor, 4, [-0.040, 0.066, 0.056], [0, 0, -0.22], 0.076, 0.014
    );

    // 9. Muzzle & Ejection Anchors
    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.038, -0.425);
    root.add(muzzleAnchor);

    const ejectAnchor = new THREE.Object3D();
    ejectAnchor.position.set(0.055, 0.055, -0.10);
    root.add(ejectAnchor);

    // 10. Articulated VANGUARD-09 Robot Hands (heavy two-handed shock brace)
    const rightHand = this._buildRobotHand('right', geos, mats, pulseLedMat, 'pistol');
    rightHand.position.set(0.018, -0.080, 0.108);
    rightHand.rotation.set(0.20, 0.12, -0.08);
    root.add(rightHand);

    const leftHand = this._buildRobotHand('left', geos, mats, pulseLedMat, 'forend');
    leftHand.position.set(-0.020, -0.068, -0.165);
    leftHand.rotation.set(0.26, -0.52, -0.14);
    root.add(leftHand);

    return this._finalizeRig({
      root,
      muzzleAnchor,
      ejectAnchor,
      boltMesh,
      magazineGroup,
      ammoBarSegments,
      chargeEmissives,
      leftHand,
      rightHand,
      reticleMesh,
      geos,
      mats,
      pumpLinkedLeftHand: false,
      boltKickDist: 0.068,
      recoilKickZ: 0.095,
      recoilPitchKick: 0.135,
      magDropY: -0.02,
      magTiltX: 0.04,
    });
  }

  // ---------------------------------------------------------------------------
  // WEAPON 1: M41-A KINETIC RIFLE (Olive-Drab & Gunmetal Carbine, Amber #f59e0b)
  // ADS reticle target: (0, +0.145, +0.02) -> matches adsOffset.y = -0.145
  // ---------------------------------------------------------------------------

  /** @private */
  _buildPulseRifle(cfg) {
    const root = new THREE.Group();
    root.name = 'rig_pulse_rifle';
    const geos = [];
    const mats = [];
    const accentColor = cfg.color ?? 0xf59e0b;

    const amberLedMat = this._makeEmissiveMat(mats, accentColor, 1.9);
    const chargeEmissives = [amberLedMat];

    // 1. Weathered Olive-Drab Upper Receiver (ExtrudeGeometry)
    const upperGeo = this._extrudeSide(
      geos,
      [
        [-0.35, 0.016],
        [-0.31, 0.076],
        [-0.08, 0.084],
        [0.14, 0.084],
        [0.19, 0.068],
        [0.19, 0.012],
        [-0.35, 0.012],
      ],
      0.062,
      0.0055
    );
    this._addMesh(root, upperGeo, this._matOliveArmor);

    // 2. Dark Gunmetal Lower Receiver + Magwell + Hollow Trigger Guard
    const lowerGeo = this._extrudeSide(
      geos,
      [
        [-0.24, 0.016],
        [0.17, 0.016],
        [0.16, -0.028],
        [0.095, -0.056],
        [-0.015, -0.056],
        [-0.045, -0.068],
        [-0.145, -0.068],
        [-0.165, -0.022],
        [-0.24, -0.018],
      ],
      0.052,
      0.004,
      [
        [
          [0.002, -0.042],
          [0.072, -0.042],
          [0.076, -0.012],
          [-0.002, -0.012],
        ],
      ]
    );
    this._addMesh(root, lowerGeo, this._matGunmetal);

    // 3. Tactical Skeletal Stock + Ceramic Cheek Riser + Rubber Buttpad
    const stockGeo = this._extrudeSide(
      geos,
      [
        [0.165, 0.072],
        [0.245, 0.076],
        [0.265, 0.062],
        [0.265, -0.055],
        [0.215, -0.042],
        [0.165, -0.012],
      ],
      0.046,
      0.0045,
      [
        [
          [0.192, 0.042],
          [0.238, 0.042],
          [0.238, -0.010],
          [0.192, 0.006],
        ],
      ]
    );
    this._addMesh(root, stockGeo, this._matOliveArmor);

    const cheekGeo = this._box(geos, 0.050, 0.014, 0.078);
    this._addMesh(root, cheekGeo, this._matCeramicWhite, 0, 0.076, 0.21);
    const buttpadGeo = this._box(geos, 0.048, 0.118, 0.012);
    this._addMesh(root, buttpadGeo, this._matGrip, 0, 0.006, 0.268);

    // 4. Diamond-Knurled Pistol Grip, Selector Switch, Mag Release & Steel Trigger
    const gripGeo = this._extrudeSide(
      geos,
      [
        [0.078, -0.015],
        [0.132, -0.015],
        [0.162, -0.145],
        [0.106, -0.152],
        [0.076, -0.060],
      ],
      0.036,
      0.0045
    );
    this._addMesh(root, gripGeo, this._matGrip);

    const gripPlateGeo = this._box(geos, 0.040, 0.086, 0.032);
    this._addMesh(root, gripPlateGeo, this._matPolymer, 0, -0.090, 0.116, -0.22, 0, 0);

    const triggerGeo = this._box(geos, 0.006, 0.028, 0.008);
    this._addMesh(root, triggerGeo, this._matChrome, 0, -0.025, 0.048, 0.34, 0, 0);

    const selectorGeo = this._box(geos, 0.006, 0.008, 0.022);
    this._addMesh(root, selectorGeo, this._matTitaniumSteel, -0.030, 0.002, 0.088, 0.38, 0, 0);

    // 5. Ventilated Perforated Handguard Shroud + Exposed Steel Gas Block & Tube
    const handguardGeo = this._extrudeSide(
      geos,
      [
        [-0.50, 0.004],
        [-0.46, 0.066],
        [-0.22, 0.074],
        [-0.22, -0.024],
        [-0.45, -0.022],
      ],
      0.066,
      0.005
    );
    this._addMesh(root, handguardGeo, this._matGunmetal);

    // Olive-drab & ceramic-white tactical flank rail panels
    const sidePlateGeo = this._extrudeSide(
      geos,
      [
        [-0.43, 0.014],
        [-0.40, 0.056],
        [-0.14, 0.060],
        [-0.11, 0.022],
        [-0.22, 0.004],
      ],
      0.072,
      0.003
    );
    this._addMesh(root, sidePlateGeo, this._matOliveArmor);

    // Recessed Dark Perforated M-LOK Cooling Slots (5 vents per side)
    const ventSlotGeo = this._box(geos, 0.076, 0.009, 0.026);
    for (let i = 0; i < 5; i++) {
      const vz = -0.24 - i * 0.046;
      this._addMesh(root, ventSlotGeo, this._matBarrelSteel, 0, 0.035, vz, -0.14, 0, 0);
    }

    // Exposed Steel Gas Tube & Front Gas Block
    const gasTubeGeo = this._cyl(geos, 0.0055, 0.0055, 0.24, 10);
    this._addMesh(root, gasTubeGeo, this._matChrome, 0, 0.060, -0.38, Math.PI * 0.5, 0, 0);
    const gasBlockGeo = this._box(geos, 0.032, 0.046, 0.034);
    this._addMesh(root, gasBlockGeo, this._matTitaniumSteel, 0, 0.044, -0.495);

    // 6. Fluted Steel Carbine Barrel (LatheGeometry) + Tactical 3-Prong Flash Hider
    const barrelGeo = this._latheZ(
      geos,
      [
        [0.014, -0.60],
        [0.019, -0.596],
        [0.019, -0.575],
        [0.015, -0.570],
        [0.015, -0.556],
        [0.018, -0.538],
        [0.015, -0.526],
        [0.018, -0.508],
        [0.015, -0.496],
        [0.019, -0.472],
        [0.022, -0.340],
      ],
      18
    );
    this._addMesh(root, barrelGeo, this._matBarrelSteel, 0, 0.032, 0);

    // 3-Prong Tactical Flash Hider (base collar + 3 individual machined steel prongs)
    const prongBaseGeo = this._cyl(geos, 0.018, 0.018, 0.022, 12);
    this._addMesh(root, prongBaseGeo, this._matTitaniumSteel, 0, 0.032, -0.608, Math.PI * 0.5, 0, 0);
    const prongGeo = this._box(geos, 0.0055, 0.0085, 0.056);
    for (let p = 0; p < 3; p++) {
      const ang = (p * TWO_PI) / 3 + Math.PI / 6;
      const px = Math.cos(ang) * 0.0135;
      const py = 0.032 + Math.sin(ang) * 0.0135;
      this._addMesh(root, prongGeo, this._matBarrelSteel, px, py, -0.642, 0, 0, ang + Math.PI * 0.5);
    }

    // Under-barrel laser/rangefinder box + subtle warm amber indicator LED
    const peqBoxGeo = this._box(geos, 0.030, 0.024, 0.115);
    this._addMesh(root, peqBoxGeo, this._matPolymer, 0, -0.025, -0.39);
    const peqClampGeo = this._box(geos, 0.034, 0.012, 0.022);
    this._addMesh(root, peqClampGeo, this._matTitaniumSteel, 0, -0.022, -0.35);
    const peqLedGeo = this._box(geos, 0.004, 0.005, 0.014);
    this._addMesh(root, peqLedGeo, amberLedMat, -0.016, -0.022, -0.39);

    // 7. Continuous Top Picatinny Rail (14 teeth)
    this._addPicatinnyRail(root, geos, 0.088, -0.30, 0.14, 14, 0.026);

    // 8. Rugged Military Reflex Optic centered at EXACT (0, +0.145, +0.10)
    const opticY = 0.145;
    const opticZ = 0.10;
    const opticBaseGeo = this._box(geos, 0.046, 0.022, 0.074);
    this._addMesh(root, opticBaseGeo, this._matGunmetal, 0, 0.104, opticZ);

    // Hollow chamfered armored panoramic reflex hood
    const hoodGeo = this._extrudeCross(
      geos,
      [
        [-0.044, -0.035],
        [0.044, -0.035],
        [0.048, 0.004],
        [0.041, 0.035],
        [-0.041, 0.035],
        [-0.048, 0.004],
      ],
      0.046,
      0.002,
      [
        [
          [-0.037, -0.028],
          [0.037, -0.028],
          [0.041, 0.004],
          [0.034, 0.028],
          [-0.034, 0.028],
          [-0.041, 0.004],
        ],
      ]
    );
    this._addMesh(root, hoodGeo, this._matBarrelSteel, 0, opticY, opticZ);

    // Machined optic windage turret + cross-bolts + subtle amber power dot
    const turretGeo = this._cyl(geos, 0.007, 0.007, 0.012, 10);
    this._addMesh(root, turretGeo, this._matBrass, 0.027, 0.104, opticZ - 0.018, 0, 0, Math.PI * 0.5);
    const opticCrossBolt = this._cyl(geos, 0.005, 0.005, 0.052, 8);
    this._addMesh(root, opticCrossBolt, this._matChrome, 0, 0.096, opticZ + 0.024, 0, 0, Math.PI * 0.5);
    const opticLedGeo = this._box(geos, 0.004, 0.005, 0.018);
    this._addMesh(root, opticLedGeo, amberLedMat, -0.023, 0.104, opticZ);

    // Low folded backup iron sight post (never obscures reflex sightline)
    const foldedPostGeo = this._box(geos, 0.018, 0.010, 0.024);
    this._addMesh(root, foldedPostGeo, this._matTitaniumSteel, 0, 0.072, -0.45);

    const reticleMesh = this._addOpticGlassAndReticle(
      root,
      geos,
      mats,
      'pulse_rifle',
      opticY,
      opticZ,
      0.080,
      0.056,
      0.046
    );

    // 9. Braided Steel Servo/Sensor Conduit along Left Receiver Flank
    const leftCableGeo = this._tube(
      geos,
      [
        [-0.034, 0.056, -0.04],
        [-0.046, 0.046, -0.14],
        [-0.044, 0.018, -0.25],
        [-0.035, 0.010, -0.35],
      ],
      0.0048,
      16,
      7
    );
    this._addMesh(root, leftCableGeo, this._matBraid);

    // 10. Right-side Ejection Port Recess + Brass Deflector + Hinged Dust Cover
    const portRecessGeo = this._box(geos, 0.010, 0.026, 0.088);
    this._addMesh(root, portRecessGeo, this._matGrip, 0.030, 0.048, -0.075);
    const deflectorGeo = this._box(geos, 0.014, 0.022, 0.016);
    this._addMesh(root, deflectorGeo, this._matOliveArmor, 0.035, 0.048, -0.018, 0, 0.45, 0);
    const dustCoverGeo = this._box(geos, 0.004, 0.020, 0.084);
    this._addMesh(root, dustCoverGeo, this._matBarrelSteel, 0.036, 0.024, -0.075, 0, 0, -0.35);

    // 11. Animated Reciprocating Steel Bolt Carrier + Left Charging Handle
    const boltMesh = new THREE.Group();
    boltMesh.name = 'boltMesh';
    const boltBodyGeo = this._box(geos, 0.014, 0.021, 0.078);
    this._addMesh(boltMesh, boltBodyGeo, this._matChrome, 0.028, 0.048, -0.080);
    const chargeHandleGeo = this._box(geos, 0.028, 0.011, 0.014);
    this._addMesh(boltMesh, chargeHandleGeo, this._matTitaniumSteel, -0.042, 0.056, -0.155);
    const chargeTipGeo = this._box(geos, 0.012, 0.014, 0.018);
    this._addMesh(boltMesh, chargeTipGeo, this._matGrip, -0.056, 0.056, -0.155);
    root.add(boltMesh);

    // 12. Curved Detachable Steel STANAG Magazine (with ribs, floorplate & brass bullet tip)
    const magazineGroup = new THREE.Group();
    magazineGroup.name = 'magazineGroup';
    const magBodyGeo = this._extrudeSide(
      geos,
      [
        [-0.132, -0.052],
        [-0.058, -0.052],
        [-0.070, -0.128],
        [-0.088, -0.205],
        [-0.164, -0.194],
        [-0.144, -0.124],
      ],
      0.034,
      0.003
    );
    this._addMesh(magazineGroup, magBodyGeo, this._matGunmetal);

    // Stamped vertical STANAG stiffening ribs
    const magRibGeo = this._box(geos, 0.038, 0.110, 0.012);
    this._addMesh(magazineGroup, magRibGeo, this._matTitaniumSteel, 0, -0.126, -0.095, 0.14, 0, 0);
    this._addMesh(magazineGroup, magRibGeo, this._matTitaniumSteel, 0, -0.126, -0.126, 0.14, 0, 0);

    // Tactical floorplate pull-tab + top brass cartridge tip visible on reload
    const magPlateGeo = this._box(geos, 0.040, 0.015, 0.084);
    this._addMesh(magazineGroup, magPlateGeo, this._matPolymer, 0, -0.201, -0.126, 0.14, 0, 0);
    const topRoundGeo = this._cyl(geos, 0.0045, 0.0055, 0.048, 8);
    this._addMesh(magazineGroup, topRoundGeo, this._matBrass, 0, -0.050, -0.096, Math.PI * 0.5, 0, 0);
    root.add(magazineGroup);

    // 13. Diegetic Tactical Amber LED Ammo Strip on Left Rear Receiver
    const ammoBarSegments = this._addDiegeticAmmoBar(
      root,
      geos,
      mats,
      accentColor,
      10,
      [-0.034, 0.072, 0.068],
      [0, 0, -0.34],
      0.095,
      0.012
    );

    // 14. Muzzle & Ejection Anchors
    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.032, -0.68);
    root.add(muzzleAnchor);

    const ejectAnchor = new THREE.Object3D();
    ejectAnchor.position.set(0.052, 0.052, -0.075);
    root.add(ejectAnchor);

    // 15. Articulated VANGUARD-09 Robot Hands
    const rightHand = this._buildRobotHand('right', geos, mats, amberLedMat, 'pistol');
    rightHand.position.set(0.020, -0.076, 0.120);
    rightHand.rotation.set(0.22, 0.12, -0.08);
    root.add(rightHand);

    const leftHand = this._buildRobotHand('left', geos, mats, amberLedMat, 'forend');
    leftHand.position.set(-0.014, -0.032, -0.320);
    leftHand.rotation.set(0.18, -0.48, -0.16);
    root.add(leftHand);

    return this._finalizeRig({
      root,
      muzzleAnchor,
      ejectAnchor,
      boltMesh,
      magazineGroup,
      ammoBarSegments,
      chargeEmissives,
      leftHand,
      rightHand,
      reticleMesh,
      geos,
      mats,
      pumpLinkedLeftHand: false,
      boltKickDist: 0.052,
    });
  }

  // ---------------------------------------------------------------------------
  // WEAPON 2: BR-12 BREACHER SHOTGUN (Rust-Orange #ea580c, Side-Saddle Shells)
  // ADS reticle target: (0, +0.160, +0.04) -> matches adsOffset.y = -0.160
  // ---------------------------------------------------------------------------

  /** @private */
  _buildScattergun(cfg) {
    const root = new THREE.Group();
    root.name = 'rig_scattergun';
    const geos = [];
    const mats = [];
    const accentColor = cfg.color ?? 0xea580c;

    const statusLedMat = this._makeEmissiveMat(mats, accentColor, 1.9);
    const chargeEmissives = [statusLedMat];

    // 1. Broad-Shouldered Heavy Steel Breacher Upper Receiver + Rust-Orange Breach Cowls
    const upperGeo = this._extrudeSide(
      geos,
      [
        [-0.30, 0.008],
        [-0.25, 0.092],
        [0.16, 0.096],
        [0.21, 0.076],
        [0.21, 0.002],
        [-0.30, 0.002],
      ],
      0.084,
      0.0065
    );
    this._addMesh(root, upperGeo, this._matGunmetal);

    const cowlGeo = this._extrudeSide(
      geos,
      [
        [-0.26, 0.024],
        [-0.22, 0.084],
        [0.09, 0.086],
        [0.14, 0.038],
        [-0.08, 0.018],
      ],
      0.092,
      0.0035
    );
    this._addMesh(root, cowlGeo, this._matRustPlate);

    // 2. Heavy Lower Receiver + Oversized Gloved Trigger Guard
    const lowerGeo = this._extrudeSide(
      geos,
      [
        [-0.24, 0.010],
        [0.18, 0.010],
        [0.17, -0.038],
        [0.11, -0.068],
        [-0.02, -0.068],
        [-0.04, -0.040],
        [-0.24, -0.036],
      ],
      0.066,
      0.0045,
      [
        [
          [0.002, -0.052],
          [0.082, -0.052],
          [0.086, -0.016],
          [-0.002, -0.016],
        ],
      ]
    );
    this._addMesh(root, lowerGeo, this._matPolymer);

    // 3. Heavy Breacher Grip + Ceramic/Polymer Buttstock + Steel Trigger
    const gripGeo = this._extrudeSide(
      geos,
      [
        [0.086, -0.018],
        [0.148, -0.018],
        [0.178, -0.154],
        [0.116, -0.160],
        [0.084, -0.066],
      ],
      0.042,
      0.005
    );
    this._addMesh(root, gripGeo, this._matGrip);

    const stockGeo = this._extrudeSide(
      geos,
      [
        [0.185, 0.078],
        [0.258, 0.078],
        [0.268, -0.064],
        [0.190, -0.034],
      ],
      0.062,
      0.005
    );
    this._addMesh(root, stockGeo, this._matOliveArmor);

    const stockPadGeo = this._box(geos, 0.064, 0.132, 0.014);
    this._addMesh(root, stockPadGeo, this._matGrip, 0, 0.008, 0.268);

    const triggerGeo = this._box(geos, 0.008, 0.032, 0.010);
    this._addMesh(root, triggerGeo, this._matChrome, 0, -0.030, 0.052, 0.30, 0, 0);

    // 4. Heavy Combat Barrel + Under-Barrel Mag Tube + Dual Steel Clamps
    const topBarrelGeo = this._latheZ(
      geos,
      [
        [0.019, -0.58],
        [0.023, -0.576],
        [0.023, -0.545],
        [0.020, -0.538],
        [0.022, -0.510],
        [0.020, -0.500],
        [0.024, -0.260],
      ],
      18
    );
    this._addMesh(root, topBarrelGeo, this._matBarrelSteel, 0, 0.056, 0);

    const magTubeGeo = this._latheZ(
      geos,
      [
        [0.018, -0.575],
        [0.021, -0.570],
        [0.021, -0.530],
        [0.017, -0.524],
        [0.019, -0.250],
      ],
      16
    );
    this._addMesh(root, magTubeGeo, this._matBarrelSteel, 0, 0.008, 0);

    // Large Slotted Tank-Style Muzzle Brake + Breach Standoff Teeth
    const brakeGeo = this._extrudeCross(
      geos,
      [
        [-0.036, 0.014],
        [0.036, 0.014],
        [0.042, 0.044],
        [0.034, 0.086],
        [-0.034, 0.086],
        [-0.042, 0.044],
      ],
      0.090,
      0.004,
      [
        [
          [-0.018, 0.038],
          [0.018, 0.038],
          [0.018, 0.074],
          [-0.018, 0.074],
        ],
      ]
    );
    this._addMesh(root, brakeGeo, this._matTitaniumSteel, 0, 0, -0.605);

    // Machined vertical gas baffle slats inside tank-style brake
    const baffleGeo = this._box(geos, 0.076, 0.012, 0.020);
    this._addMesh(root, baffleGeo, this._matBarrelSteel, 0, 0.056, -0.585);
    this._addMesh(root, baffleGeo, this._matBarrelSteel, 0, 0.056, -0.618);

    // 5. Chunky Perforated Heat-Shield Shroud + 6 Dark Cooling Perforations
    const shroudGeo = this._extrudeSide(
      geos,
      [
        [-0.54, 0.046],
        [-0.51, 0.092],
        [-0.24, 0.096],
        [-0.24, 0.044],
      ],
      0.064,
      0.004
    );
    this._addMesh(root, shroudGeo, this._matTitaniumSteel);

    const heatVentGeo = this._box(geos, 0.068, 0.014, 0.020);
    for (let i = 0; i < 6; i++) {
      this._addMesh(root, heatVentGeo, this._matBarrelSteel, 0, 0.073, -0.275 - i * 0.044, -0.22, 0, 0);
    }

    // Twin heavy barrel clamp brackets
    const clampGeo = this._box(geos, 0.056, 0.082, 0.020);
    this._addMesh(root, clampGeo, this._matTitaniumSteel, 0, 0.032, -0.535);
    this._addMesh(root, clampGeo, this._matTitaniumSteel, 0, 0.032, -0.275);

    // 6. Side-Saddle Spare 12-Gauge Red/Brass Shells on Left Receiver (visible in 1P!)
    const saddlePlateGeo = this._box(geos, 0.012, 0.036, 0.115);
    this._addMesh(root, saddlePlateGeo, this._matPolymer, -0.048, 0.050, -0.045);

    const shellHullGeo = this._cyl(geos, 0.0085, 0.0085, 0.042, 10);
    const shellBrassGeo = this._cyl(geos, 0.009, 0.009, 0.014, 10);
    for (let s = 0; s < 4; s++) {
      const sz = -0.086 + s * 0.027;
      this._addMesh(root, shellHullGeo, this._matShellRed, -0.056, 0.050, sz);
      this._addMesh(root, shellBrassGeo, this._matBrass, -0.056, 0.024, sz);
    }

    // 7. Top Rail + Rugged Ghost-Ring / Amber Breacher Optic at EXACT (0, +0.160, +0.10)
    this._addPicatinnyRail(root, geos, 0.098, -0.22, 0.14, 10, 0.032);

    const opticY = 0.160;
    const opticZ = 0.10;
    const sightBaseGeo = this._box(geos, 0.064, 0.024, 0.074);
    this._addMesh(root, sightBaseGeo, this._matGunmetal, 0, 0.114, opticZ);

    const wideHoodGeo = this._extrudeCross(
      geos,
      [
        [-0.050, -0.036],
        [0.050, -0.036],
        [0.054, 0.016],
        [0.044, 0.037],
        [-0.044, 0.037],
        [-0.054, 0.016],
      ],
      0.044,
      0.0025,
      [
        [
          [-0.043, -0.029],
          [0.043, -0.029],
          [0.047, 0.014],
          [0.037, 0.030],
          [-0.037, 0.030],
          [-0.047, 0.014],
        ],
      ]
    );
    this._addMesh(root, wideHoodGeo, this._matBarrelSteel, 0, opticY, opticZ);

    // Low rust-orange front ramp sight blade (kept well below optic sightline)
    const frontBladeGeo = this._box(geos, 0.006, 0.016, 0.014);
    this._addMesh(root, frontBladeGeo, this._matRustPlate, 0, 0.098, -0.57);

    const reticleMesh = this._addOpticGlassAndReticle(
      root,
      geos,
      mats,
      'scattergun',
      opticY,
      opticZ,
      0.090,
      0.058,
      0.054
    );

    // 8. Right-side Heavy Ejection Port + Steel Breech Block
    const portGeo = this._box(geos, 0.012, 0.034, 0.092);
    this._addMesh(root, portGeo, this._matGrip, 0.042, 0.054, -0.065);
    const breechGeo = this._box(geos, 0.010, 0.028, 0.076);
    this._addMesh(root, breechGeo, this._matChrome, 0.040, 0.054, -0.065);

    // 9. Animated `boltMesh` — Ribbed Polymer/Steel Pump Forend + Dual Action Bars!
    const boltMesh = new THREE.Group();
    boltMesh.name = 'boltMesh_pump';

    const pumpBodyGeo = this._extrudeCross(
      geos,
      [
        [-0.038, -0.038],
        [0.038, -0.038],
        [0.044, 0.004],
        [0.030, 0.028],
        [-0.030, 0.028],
        [-0.044, 0.004],
      ],
      0.19,
      0.005
    );
    this._addMesh(boltMesh, pumpBodyGeo, this._matGrip, 0, 0.004, -0.40);

    // 7 Heavy steel/polymer pump grip ribs + front/rear hand-stops
    const ribGeo = this._box(geos, 0.090, 0.050, 0.011);
    for (let i = 0; i < 7; i++) {
      this._addMesh(boltMesh, ribGeo, this._matTitaniumSteel, 0, -0.006, -0.318 - i * 0.026);
    }

    const pumpStopGeo = this._box(geos, 0.088, 0.018, 0.014);
    this._addMesh(boltMesh, pumpStopGeo, this._matRustPlate, 0, -0.024, -0.492);

    const rodGeo = this._cyl(geos, 0.0045, 0.0045, 0.24, 8);
    this._addMesh(boltMesh, rodGeo, this._matChrome, -0.036, 0.016, -0.25, Math.PI * 0.5, 0, 0);
    this._addMesh(boltMesh, rodGeo, this._matChrome, 0.036, 0.016, -0.25, Math.PI * 0.5, 0, 0);
    root.add(boltMesh);

    // 10. Detachable Heavy 8-Round Box Shotgun Magazine (`magazineGroup`)
    const magazineGroup = new THREE.Group();
    magazineGroup.name = 'magazineGroup';

    const boxMagGeo = this._extrudeSide(
      geos,
      [
        [-0.175, -0.036],
        [-0.088, -0.036],
        [-0.098, -0.188],
        [-0.186, -0.182],
      ],
      0.046,
      0.004
    );
    this._addMesh(magazineGroup, boxMagGeo, this._matGunmetal);

    // Stamped steel stiffening ribs & heavy floorplate
    const magSideRib = this._box(geos, 0.052, 0.11, 0.014);
    this._addMesh(magazineGroup, magSideRib, this._matTitaniumSteel, 0, -0.112, -0.118, 0.06, 0, 0);
    this._addMesh(magazineGroup, magSideRib, this._matTitaniumSteel, 0, -0.112, -0.156, 0.06, 0, 0);

    const magBaseGeo = this._box(geos, 0.054, 0.016, 0.096);
    this._addMesh(magazineGroup, magBaseGeo, this._matPolymer, 0, -0.188, -0.142, 0.06, 0, 0);

    // Visible brass-rimmed red 12g shell at top of box mag
    const topShellGeo = this._cyl(geos, 0.009, 0.009, 0.062, 10);
    this._addMesh(magazineGroup, topShellGeo, this._matShellRed, 0, -0.034, -0.132, Math.PI * 0.5, 0, 0);
    root.add(magazineGroup);

    // 11. Diegetic 8-Shell Rust-Orange Tactical LED Ammo Counter
    const ammoBarSegments = this._addDiegeticAmmoBar(
      root,
      geos,
      mats,
      accentColor,
      8,
      [-0.045, 0.080, 0.082],
      [0, 0, -0.30],
      0.104,
      0.015
    );

    // 12. Muzzle & Ejection Anchors
    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.056, -0.66);
    root.add(muzzleAnchor);

    const ejectAnchor = new THREE.Object3D();
    ejectAnchor.position.set(0.062, 0.056, -0.065);
    root.add(ejectAnchor);

    // 13. Articulated VANGUARD-09 Robot Hands (left hand dynamically linked to pump stroke!)
    const rightHand = this._buildRobotHand('right', geos, mats, statusLedMat, 'pistol');
    rightHand.position.set(0.024, -0.084, 0.132);
    rightHand.rotation.set(0.22, 0.12, -0.08);
    root.add(rightHand);

    const leftHand = this._buildRobotHand('left', geos, mats, statusLedMat, 'forend');
    leftHand.position.set(-0.014, -0.042, -0.395);
    leftHand.rotation.set(0.20, -0.46, -0.14);
    root.add(leftHand);

    return this._finalizeRig({
      root,
      muzzleAnchor,
      ejectAnchor,
      boltMesh,
      magazineGroup,
      ammoBarSegments,
      chargeEmissives,
      leftHand,
      rightHand,
      reticleMesh,
      geos,
      mats,
      pumpLinkedLeftHand: true,
      boltKickDist: 0.115,
    });
  }

  // ---------------------------------------------------------------------------
  // WEAPON 3: HV-7 RAIL LANCE (Ceramic-White & Dark Tungsten, Copper Coils, Gold #fbbf24)
  // ADS reticle target: (0, +0.135, +0.01), reticle plane at +0.105 -> adsOffset.y = -0.135
  // ---------------------------------------------------------------------------

  /** @private */
  _buildRailgun(cfg) {
    const root = new THREE.Group();
    root.name = 'rig_railgun';
    const geos = [];
    const mats = [];
    const accentColor = cfg.color ?? 0xfbbf24;

    const capacitorGlowMat = this._makeEmissiveMat(mats, accentColor, 2.0);
    const hotTungstenMat = this._makeEmissiveMat(mats, 0xffe29a, 2.3);
    const chargeEmissives = [capacitorGlowMat, hotTungstenMat];

    // 1. Heavy Ceramic-White & Dark Tungsten Anti-Materiel Chassis (ExtrudeGeometry)
    const chassisGeo = this._extrudeSide(
      geos,
      [
        [-0.36, -0.012],
        [-0.30, 0.068],
        [0.14, 0.072],
        [0.22, 0.056],
        [0.24, -0.036],
        [0.18, -0.044],
        [0.12, -0.014],
        [-0.36, -0.018],
      ],
      0.064,
      0.005,
      [
        [
          [0.155, 0.038],
          [0.212, 0.036],
          [0.212, -0.016],
          [0.155, -0.002],
        ],
      ]
    );
    this._addMesh(root, chassisGeo, this._matCeramicWhite);

    // Dark tungsten lower frame & flank armor plates
    const fairingGeo = this._extrudeSide(
      geos,
      [
        [-0.32, 0.004],
        [-0.26, 0.058],
        [0.06, 0.060],
        [0.10, 0.022],
        [-0.14, -0.006],
      ],
      0.072,
      0.0035
    );
    this._addMesh(root, fairingGeo, this._matGunmetal);

    const cheekRiserGeo = this._box(geos, 0.056, 0.016, 0.088);
    this._addMesh(root, cheekRiserGeo, this._matGrip, 0, 0.068, 0.185);
    const buttpadGeo = this._box(geos, 0.058, 0.095, 0.014);
    this._addMesh(root, buttpadGeo, this._matGrip, 0, 0.008, 0.242);

    // 2. Precision Grip + Hollow Trigger Guard + Steel Trigger
    const lowerGeo = this._extrudeSide(
      geos,
      [
        [-0.22, -0.012],
        [0.14, -0.012],
        [0.12, -0.056],
        [-0.02, -0.056],
        [-0.04, -0.024],
        [-0.22, -0.026],
      ],
      0.048,
      0.0035,
      [
        [
          [0.004, -0.044],
          [0.078, -0.044],
          [0.080, -0.018],
          [0.004, -0.018],
        ],
      ]
    );
    this._addMesh(root, lowerGeo, this._matTitaniumSteel);

    const gripGeo = this._extrudeSide(
      geos,
      [
        [0.084, -0.016],
        [0.138, -0.016],
        [0.168, -0.148],
        [0.112, -0.154],
        [0.082, -0.058],
      ],
      0.036,
      0.0045
    );
    this._addMesh(root, gripGeo, this._matGrip);

    const triggerGeo = this._box(geos, 0.006, 0.026, 0.007);
    this._addMesh(root, triggerGeo, this._matChrome, 0, -0.028, 0.052, 0.30, 0, 0);

    // Stowed heavy folding bipod legs under forward chassis
    const bipodHubGeo = this._box(geos, 0.046, 0.022, 0.042);
    this._addMesh(root, bipodHubGeo, this._matTitaniumSteel, 0, -0.028, -0.36);
    const bipodLegGeo = this._cyl(geos, 0.006, 0.005, 0.20, 8);
    this._addMesh(root, bipodLegGeo, this._matBarrelSteel, -0.032, -0.024, -0.47, Math.PI * 0.5, 0, 0);
    this._addMesh(root, bipodLegGeo, this._matBarrelSteel, 0.032, -0.024, -0.47, Math.PI * 0.5, 0, 0);

    // 3. Dual Reinforced Ceramic-White & Dark Tungsten Barrel Shroud + Rails
    const topRailGeo = this._extrudeSide(
      geos,
      [
        [-0.86, 0.052],
        [-0.81, 0.072],
        [-0.28, 0.076],
        [-0.28, 0.048],
      ],
      0.034,
      0.0035
    );
    this._addMesh(root, topRailGeo, this._matCeramicWhite);

    const botRailGeo = this._extrudeSide(
      geos,
      [
        [-0.84, 0.016],
        [-0.80, -0.014],
        [-0.28, -0.018],
        [-0.28, 0.018],
      ],
      0.038,
      0.0035
    );
    this._addMesh(root, botRailGeo, this._matBarrelSteel);

    // Tungsten-gold conductive busbars + glowing amber capacitor charge strips inside rail gap
    const busbarGeo = this._box(geos, 0.018, 0.006, 0.56);
    this._addMesh(root, busbarGeo, this._matBrass, 0, 0.046, -0.56);
    this._addMesh(root, busbarGeo, this._matBrass, 0, 0.020, -0.56);

    const coreRodGeo = this._cyl(geos, 0.004, 0.004, 0.54, 10);
    this._addMesh(root, coreRodGeo, hotTungstenMat, 0, 0.033, -0.55, Math.PI * 0.5, 0, 0);

    // Dual Tungsten Reinforced Side Shroud Fins
    const finGeo = this._extrudeSide(
      geos,
      [
        [-0.78, 0.028],
        [-0.72, 0.046],
        [-0.36, 0.048],
        [-0.32, 0.020],
      ],
      0.010,
      0.002
    );
    this._addMesh(root, finGeo, this._matGunmetal, -0.032, 0, 0, 0, 0, 0.22);
    this._addMesh(root, finGeo, this._matGunmetal, 0.032, 0, 0, 0, 0, -0.22);

    // 4. Four Visible Copper-Wound Induction Coils (LatheGeometry) + Titanium Collars
    const coilCopperGeo = this._latheZ(
      geos,
      [
        [0.027, -0.022],
        [0.037, -0.016],
        [0.037, 0.016],
        [0.027, 0.022],
      ],
      18
    );
    const coilCollarGeo = this._latheZ(
      geos,
      [
        [0.035, -0.025],
        [0.040, -0.023],
        [0.040, -0.015],
        [0.035, -0.013],
      ],
      18
    );
    const coilChargeRingGeo = this._latheZ(
      geos,
      [
        [0.037, -0.005],
        [0.0395, -0.003],
        [0.0395, 0.003],
        [0.037, 0.005],
      ],
      16
    );

    const coilPositions = [-0.36, -0.49, -0.62, -0.75];
    for (let i = 0; i < coilPositions.length; i++) {
      const cz = coilPositions[i];
      this._addMesh(root, coilCopperGeo, this._matCopperCoil, 0, 0.033, cz);
      this._addMesh(root, coilCollarGeo, this._matTitaniumSteel, 0, 0.033, cz);
      this._addMesh(root, coilCollarGeo, this._matTitaniumSteel, 0, 0.033, cz + 0.038);
      this._addMesh(root, coilChargeRingGeo, capacitorGlowMat, 0, 0.033, cz);
    }

    // 5. Heavy Braided High-Voltage Power Cables (TubeGeometry) + Brass Cable Clips
    const leftCableGeo = this._tube(
      geos,
      [
        [-0.036, 0.022, -0.06],
        [-0.056, 0.012, -0.20],
        [-0.054, 0.036, -0.38],
        [-0.048, 0.033, -0.58],
        [-0.038, 0.033, -0.74],
      ],
      0.0068,
      22,
      8
    );
    this._addMesh(root, leftCableGeo, this._matBraid);

    const rightCableGeo = this._tube(
      geos,
      [
        [0.036, 0.022, -0.06],
        [0.056, 0.012, -0.20],
        [0.054, 0.036, -0.38],
        [0.048, 0.033, -0.58],
        [0.038, 0.033, -0.74],
      ],
      0.0068,
      22,
      8
    );
    this._addMesh(root, rightCableGeo, this._matBraid);

    const cableClipGeo = this._box(geos, 0.016, 0.018, 0.016);
    this._addMesh(root, cableClipGeo, this._matBrass, -0.052, 0.024, -0.29);
    this._addMesh(root, cableClipGeo, this._matBrass, 0.052, 0.024, -0.29);

    // 6. Solid-Walled Octagonal Armored Military Sniper Scope at EXACT (0, +0.135, +0.01)
    const opticY = 0.135;
    const opticZ = 0.01;

    this._addPicatinnyRail(root, geos, 0.075, -0.26, 0.12, 12, 0.024);

    // Dual cantilevered scope mount rings (inner hole wraps cleanly outside tube bore)
    const ringGeo = this._extrudeCross(
      geos,
      [
        [-0.030, -0.058],
        [0.030, -0.058],
        [0.033, 0.018],
        [0.020, 0.033],
        [-0.020, 0.033],
        [-0.033, 0.018],
      ],
      0.022,
      0.0025,
      [
        [
          [-0.0235, -0.0235],
          [0.0235, -0.0235],
          [0.0235, 0.0235],
          [-0.0235, 0.0235],
        ],
      ]
    );
    this._addMesh(root, ringGeo, this._matTitaniumSteel, 0, opticY, -0.14);
    this._addMesh(root, ringGeo, this._matTitaniumSteel, 0, opticY, 0.04);

    // Solid-walled hollow machined inner scope tube + bells
    const scopeBodyGeo = this._latheZ(
      geos,
      [
        [0.027, -0.28],
        [0.032, -0.28],
        [0.034, -0.26],
        [0.034, -0.19],
        [0.023, -0.14],
        [0.023, 0.02],
        [0.028, 0.05],
        [0.028, 0.075],
        [0.031, 0.095],
        [0.031, 0.145],
        [0.029, 0.148],
        [0.025, 0.148],
        [0.025, 0.092],
        [0.020, 0.02],
        [0.020, -0.14],
        [0.027, -0.19],
        [0.027, -0.28],
      ],
      20
    );
    this._addMesh(root, scopeBodyGeo, this._matBarrelSteel, 0, opticY, 0);

    // Solid-Walled Octagonal Armored Outer Scope Shroud sleeve
    const octShroudGeo = this._extrudeCross(
      geos,
      [
        [-0.016, -0.031],
        [0.016, -0.031],
        [0.031, -0.016],
        [0.031, 0.016],
        [0.016, 0.031],
        [-0.016, 0.031],
        [-0.031, 0.016],
        [-0.031, -0.016],
      ],
      0.16,
      0.002,
      [
        [
          [-0.0235, -0.0235],
          [0.0235, -0.0235],
          [0.0235, 0.0235],
          [-0.0235, 0.0235],
        ],
      ]
    );
    this._addMesh(root, octShroudGeo, this._matOliveArmor, 0, opticY, -0.05);

    // Knurled Brass/Titanium Elevation & Windage Turrets + Amber Ocular Index Ring
    const turretTopGeo = this._cyl(geos, 0.0095, 0.0105, 0.018, 12);
    this._addMesh(root, turretTopGeo, this._matBrass, 0, opticY + 0.032, -0.05);
    this._addMesh(root, turretTopGeo, this._matBrass, -0.032, opticY, -0.05, 0, 0, Math.PI * 0.5);

    const scopeIndexRing = this._latheZ(
      geos,
      [
        [0.0315, 0.122],
        [0.0325, 0.125],
        [0.0325, 0.130],
        [0.0315, 0.133],
      ],
      20
    );
    this._addMesh(root, scopeIndexRing, capacitorGlowMat, 0, opticY, 0);

    // Fast optic glass & crisp gold mil-dot sniper reticle at EXACT (0, 0.135, +0.105)
    const reticleMesh = this._addOpticGlassAndReticle(
      root,
      geos,
      mats,
      'railgun',
      opticY,
      opticZ + 0.095,
      0.044,
      0.044,
      0.042
    );

    // 7. Animated Reciprocating Breech / Capacitor Heat-Sink Slide (`boltMesh`)
    const boltMesh = new THREE.Group();
    boltMesh.name = 'boltMesh_railgun';
    const breechSlideGeo = this._box(geos, 0.078, 0.024, 0.115);
    this._addMesh(boltMesh, breechSlideGeo, this._matChrome, 0, 0.048, -0.095);
    const ventFinGeo = this._box(geos, 0.082, 0.010, 0.082);
    this._addMesh(boltMesh, ventFinGeo, this._matBrass, 0, 0.048, -0.095);
    root.add(boltMesh);

    // 8. Detachable Armored Battery / Tungsten-Slug Pack (`magazineGroup`)
    const magazineGroup = new THREE.Group();
    magazineGroup.name = 'magazineGroup';

    const cageGeo = this._extrudeSide(
      geos,
      [
        [-0.21, -0.018],
        [-0.08, -0.018],
        [-0.09, -0.108],
        [-0.20, -0.108],
      ],
      0.046,
      0.004
    );
    this._addMesh(magazineGroup, cageGeo, this._matCeramicWhite);

    const cellCapGeo = this._box(geos, 0.050, 0.024, 0.112);
    this._addMesh(magazineGroup, cellCapGeo, this._matGunmetal, 0, -0.102, -0.145);

    // Exposed copper bus terminals & amber window inspection slot
    const coreCellGeo = this._latheZ(
      geos,
      [
        [0.018, -0.195],
        [0.022, -0.185],
        [0.022, -0.105],
        [0.018, -0.095],
      ],
      14
    );
    this._addMesh(magazineGroup, coreCellGeo, this._matBrass, 0, -0.062, 0);
    const cellWindowGeo = this._box(geos, 0.049, 0.028, 0.074);
    this._addMesh(magazineGroup, cellWindowGeo, this._matWindowGlass, 0, -0.062, -0.145);
    root.add(magazineGroup);

    // 9. Diegetic 5-Slug Orbital-Gold Charge Bar
    const ammoBarSegments = this._addDiegeticAmmoBar(
      root,
      geos,
      mats,
      accentColor,
      5,
      [-0.036, 0.060, 0.064],
      [0, 0, -0.26],
      0.092,
      0.014
    );

    // 10. Muzzle & Energy Exhaust Anchors
    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.033, -0.88);
    root.add(muzzleAnchor);

    const ejectAnchor = new THREE.Object3D();
    ejectAnchor.position.set(0.056, 0.048, -0.095);
    root.add(ejectAnchor);

    // 11. Articulated VANGUARD-09 Robot Hands
    const rightHand = this._buildRobotHand('right', geos, mats, capacitorGlowMat, 'pistol');
    rightHand.position.set(0.020, -0.078, 0.126);
    rightHand.rotation.set(0.22, 0.12, -0.08);
    root.add(rightHand);

    const leftHand = this._buildRobotHand('left', geos, mats, capacitorGlowMat, 'forend');
    leftHand.position.set(-0.014, -0.030, -0.350);
    leftHand.rotation.set(0.16, -0.50, -0.16);
    root.add(leftHand);

    return this._finalizeRig({
      root,
      muzzleAnchor,
      ejectAnchor,
      boltMesh,
      magazineGroup,
      ammoBarSegments,
      chargeEmissives,
      leftHand,
      rightHand,
      reticleMesh,
      geos,
      mats,
      pumpLinkedLeftHand: false,
      boltKickDist: 0.072,
    });
  }

  // ---------------------------------------------------------------------------
  // WEAPON 4: K-9 SCRAPPER PDW (Weathered Olive/Gunmetal/Brass Field PDW #d4a359)
  // ADS reticle target: (0, +0.150, +0.03) -> matches adsOffset.y = -0.150
  // ---------------------------------------------------------------------------

  /** @private */
  _buildPlasmaSmg(cfg) {
    const root = new THREE.Group();
    root.name = 'rig_plasma_smg';
    const geos = [];
    const mats = [];
    const accentColor = cfg.color ?? 0xd4a359;

    const brassLedMat = this._makeEmissiveMat(mats, accentColor, 1.85);
    const chargeEmissives = [brassLedMat];

    // 1. Stamped Steel & Olive-Drab Industrial Field PDW Receiver
    const receiverGeo = this._extrudeSide(
      geos,
      [
        [-0.31, -0.024],
        [-0.27, 0.076],
        [0.09, 0.080],
        [0.14, 0.056],
        [0.14, -0.012],
        [0.07, -0.048],
        [-0.03, -0.048],
        [-0.06, -0.072],
        [-0.17, -0.072],
        [-0.21, -0.024],
      ],
      0.056,
      0.005,
      [
        [
          [-0.015, -0.036],
          [0.056, -0.036],
          [0.060, -0.012],
          [-0.015, -0.012],
        ],
      ]
    );
    this._addMesh(root, receiverGeo, this._matGunmetal);

    const topArmorGeo = this._extrudeSide(
      geos,
      [
        [-0.29, 0.024],
        [-0.25, 0.074],
        [0.06, 0.078],
        [0.12, 0.044],
        [-0.18, 0.014],
      ],
      0.064,
      0.0035
    );
    this._addMesh(root, topArmorGeo, this._matOliveArmor);

    const sideAccentGeo = this._extrudeSide(
      geos,
      [
        [-0.26, -0.006],
        [-0.21, 0.036],
        [-0.04, 0.038],
        [-0.08, -0.016],
      ],
      0.068,
      0.003
    );
    this._addMesh(root, sideAccentGeo, this._matCeramicWhite);

    // 2. Steep Knurled PDW Grip + Folded Wire/Skeleton Stock Silhouette + Foregrip
    const gripGeo = this._extrudeSide(
      geos,
      [
        [0.058, -0.012],
        [0.108, -0.012],
        [0.126, -0.136],
        [0.076, -0.142],
        [0.056, -0.052],
      ],
      0.034,
      0.0045
    );
    this._addMesh(root, gripGeo, this._matGrip);

    // Folded wire skeleton stock hinge + folded twin steel wire struts + buttplate
    const stockHingeGeo = this._box(geos, 0.040, 0.056, 0.022);
    this._addMesh(root, stockHingeGeo, this._matTitaniumSteel, 0, 0.018, 0.148);
    const wireStrutGeo = this._cyl(geos, 0.0045, 0.0045, 0.155, 8);
    this._addMesh(root, wireStrutGeo, this._matChrome, -0.032, 0.034, 0.085, Math.PI * 0.5, 0, 0);
    this._addMesh(root, wireStrutGeo, this._matChrome, -0.032, 0.002, 0.085, Math.PI * 0.5, 0, 0);
    const foldedPadGeo = this._box(geos, 0.014, 0.058, 0.026);
    this._addMesh(root, foldedPadGeo, this._matGrip, -0.034, 0.018, 0.015);

    const triggerGeo = this._box(geos, 0.006, 0.024, 0.007);
    this._addMesh(root, triggerGeo, this._matChrome, 0, -0.024, 0.032, 0.28, 0, 0);

    const foregripGeo = this._extrudeSide(
      geos,
      [
        [-0.29, -0.018],
        [-0.23, -0.018],
        [-0.19, -0.092],
        [-0.24, -0.098],
      ],
      0.032,
      0.004
    );
    this._addMesh(root, foregripGeo, this._matGrip);

    // 3. Perforated Shroud Compensator + Fluted Micro-Barrel (LatheGeometry)
    const shroudGeo = this._extrudeCross(
      geos,
      [
        [-0.024, -0.016],
        [0.024, -0.016],
        [0.028, 0.018],
        [0.018, 0.044],
        [-0.018, 0.044],
        [-0.028, 0.018],
      ],
      0.16,
      0.0035
    );
    this._addMesh(root, shroudGeo, this._matBarrelSteel, 0, 0.016, -0.36);

    const barrelGeo = this._latheZ(
      geos,
      [
        [0.012, -0.468],
        [0.017, -0.464],
        [0.017, -0.440],
        [0.013, -0.436],
        [0.016, -0.380],
        [0.018, -0.280],
      ],
      16
    );
    this._addMesh(root, barrelGeo, this._matChrome, 0, 0.028, 0);

    // Perforated compensator cooling slots + brass muzzle collar
    const compSlotGeo = this._box(geos, 0.058, 0.010, 0.020);
    this._addMesh(root, compSlotGeo, this._matGrip, 0, 0.028, -0.34);
    this._addMesh(root, compSlotGeo, this._matGrip, 0, 0.028, -0.38);
    this._addMesh(root, compSlotGeo, this._matGrip, 0, 0.028, -0.42);
    const muzzleBrassGeo = this._cyl(geos, 0.0175, 0.0175, 0.014, 12);
    this._addMesh(root, muzzleBrassGeo, this._matBrass, 0, 0.028, -0.452, Math.PI * 0.5, 0, 0);

    // 4. Exposed Hydraulic Dampener Tube + Chrome Piston Rod (replaces neon plasma tube)
    const dampCylinderGeo = this._latheZ(
      geos,
      [
        [0.011, -0.30],
        [0.015, -0.29],
        [0.015, -0.17],
        [0.011, -0.16],
      ],
      14
    );
    this._addMesh(root, dampCylinderGeo, this._matTitaniumSteel, 0, 0.074, 0);

    const dampRodGeo = this._cyl(geos, 0.006, 0.006, 0.11, 10);
    this._addMesh(root, dampRodGeo, this._matChrome, 0, 0.074, -0.125, Math.PI * 0.5, 0, 0);

    const collarGeo = this._latheZ(
      geos,
      [
        [0.015, -0.007],
        [0.019, -0.005],
        [0.019, 0.005],
        [0.015, 0.007],
      ],
      14
    );
    const collarZs = [-0.285, -0.225, -0.170, -0.095];
    for (let i = 0; i < collarZs.length; i++) {
      this._addMesh(root, collarGeo, this._matBrass, 0, 0.074, collarZs[i]);
    }

    // 5. Dual Braided Steel Micro-Hoses (TubeGeometry)
    const cableL = this._tube(
      geos,
      [
        [-0.020, 0.072, -0.12],
        [-0.040, 0.056, -0.18],
        [-0.038, 0.026, -0.25],
        [-0.026, 0.020, -0.31],
      ],
      0.0045,
      14,
      7
    );
    this._addMesh(root, cableL, this._matBraid);

    const cableR = this._tube(
      geos,
      [
        [0.020, 0.072, -0.12],
        [0.040, 0.056, -0.18],
        [0.038, 0.026, -0.25],
        [0.026, 0.020, -0.31],
      ],
      0.0045,
      14,
      7
    );
    this._addMesh(root, cableR, this._matBraid);

    // 6. Rugged Top Iron / Micro-Dot Sight centered at EXACT (0, +0.150, +0.065)
    const opticY = 0.150;
    const opticZ = 0.065;

    this._addPicatinnyRail(root, geos, 0.084, -0.05, 0.10, 6, 0.024);

    const riserGeo = this._extrudeSide(
      geos,
      [
        [0.015, 0.086],
        [0.098, 0.086],
        [0.090, 0.123],
        [0.025, 0.123],
      ],
      0.034,
      0.003
    );
    this._addMesh(root, riserGeo, this._matGunmetal);

    const microHoodGeo = this._extrudeCross(
      geos,
      [
        [-0.036, -0.029],
        [0.036, -0.029],
        [0.040, 0.004],
        [0.032, 0.029],
        [-0.032, 0.029],
        [-0.040, 0.004],
      ],
      0.034,
      0.002,
      [
        [
          [-0.030, -0.023],
          [0.030, -0.023],
          [0.034, 0.004],
          [0.026, 0.023],
          [-0.026, 0.023],
          [-0.034, 0.004],
        ],
      ]
    );
    this._addMesh(root, microHoodGeo, this._matBarrelSteel, 0, opticY, opticZ);

    // Low iron backup front post (stays below optic sightline)
    const frontIronGeo = this._box(geos, 0.006, 0.016, 0.012);
    this._addMesh(root, frontIronGeo, this._matTitaniumSteel, 0, 0.068, -0.43);

    const reticleMesh = this._addOpticGlassAndReticle(
      root,
      geos,
      mats,
      'plasma_smg',
      opticY,
      opticZ,
      0.066,
      0.046,
      0.038
    );

    // 7. Animated Rapid-Cycle Steel Bolt (`boltMesh`)
    const boltMesh = new THREE.Group();
    boltMesh.name = 'boltMesh_smg';
    const boltSlabGeo = this._box(geos, 0.012, 0.018, 0.056);
    this._addMesh(boltMesh, boltSlabGeo, this._matChrome, 0.028, 0.044, -0.085);
    const chargeNubGeo = this._box(geos, 0.022, 0.009, 0.012);
    this._addMesh(boltMesh, chargeNubGeo, this._matTitaniumSteel, -0.038, 0.046, -0.14);
    root.add(boltMesh);

    // 8. Forward-Canted Steel Stick Magazine (`magazineGroup`) with Witness Slots & Brass Bumper
    const magazineGroup = new THREE.Group();
    magazineGroup.name = 'magazineGroup';

    const stickGeo = this._extrudeSide(
      geos,
      [
        [-0.155, -0.048],
        [-0.095, -0.048],
        [-0.145, -0.235],
        [-0.205, -0.222],
      ],
      0.030,
      0.003
    );
    this._addMesh(magazineGroup, stickGeo, this._matGunmetal);

    // Witness window slot revealing stacked brass ammo indicator
    const witnessSlotGeo = this._box(geos, 0.033, 0.115, 0.010);
    this._addMesh(magazineGroup, witnessSlotGeo, this._matBrass, 0, -0.142, -0.152, -0.26, 0, 0);

    const magBaseGeo = this._box(geos, 0.036, 0.016, 0.068);
    this._addMesh(magazineGroup, magBaseGeo, this._matBrass, 0, -0.232, -0.176, 0.24, 0, 0);
    root.add(magazineGroup);

    // 9. Diegetic 12-LED Brass/Amber Ammo Counter Strip on Left Rear Receiver
    const ammoBarSegments = this._addDiegeticAmmoBar(
      root,
      geos,
      mats,
      accentColor,
      12,
      [-0.032, 0.064, 0.046],
      [0, 0, -0.32],
      0.088,
      0.010
    );

    // 10. Muzzle & Ejection Anchors
    const muzzleAnchor = new THREE.Object3D();
    muzzleAnchor.position.set(0, 0.028, -0.48);
    root.add(muzzleAnchor);

    const ejectAnchor = new THREE.Object3D();
    ejectAnchor.position.set(0.048, 0.046, -0.085);
    root.add(ejectAnchor);

    // 11. Articulated VANGUARD-09 Robot Hands
    const rightHand = this._buildRobotHand('right', geos, mats, brassLedMat, 'pistol');
    rightHand.position.set(0.018, -0.068, 0.096);
    rightHand.rotation.set(0.18, 0.12, -0.08);
    root.add(rightHand);

    const leftHand = this._buildRobotHand('left', geos, mats, brassLedMat, 'forend');
    leftHand.position.set(-0.012, -0.060, -0.232);
    leftHand.rotation.set(0.24, -0.52, -0.14);
    root.add(leftHand);

    return this._finalizeRig({
      root,
      muzzleAnchor,
      ejectAnchor,
      boltMesh,
      magazineGroup,
      ammoBarSegments,
      chargeEmissives,
      leftHand,
      rightHand,
      reticleMesh,
      geos,
      mats,
      pumpLinkedLeftHand: false,
      boltKickDist: 0.038,
    });
  }

  // ---------------------------------------------------------------------------
  // VANGUARD-09 Robot Arm-Mounted Thermal Pry-Blade (Quick Melee Rig)
  // ---------------------------------------------------------------------------

  /**
   * Build the VANGUARD-09 robot arm-mounted Thermal Pry-Blade for quick melee slashes.
   * Ceramic-white forearm armor + glowing superheated tungsten-orange industrial cutter edge.
   */
  createMeleeBladeRig() {
    const root = new THREE.Group();
    root.name = 'rig_melee_blade';
    const geos = [];
    const mats = [];

    const amberStatusMat = this._makeEmissiveMat(mats, 0xf59e0b, 2.2);
    const bladeEdgeMat = this._makeEmissiveMat(mats, 0xff6a1a, 3.2);
    const bladeFilamentMat = this._makeEmissiveMat(mats, 0xffe2b0, 3.5);

    // Articulated left ceramic-white robot forearm & clenched combat fist
    const forearm = this._buildRobotHand('left', geos, mats, amberStatusMat, 'fist');
    forearm.position.set(0, -0.02, 0.04);
    forearm.rotation.set(0.08, 0.0, 0.18);
    root.add(forearm);

    // Twin chrome hydraulic blade deployment pistons along forearm side
    const strutGeo = this._cyl(geos, 0.005, 0.005, 0.24, 10);
    this._addMesh(root, strutGeo, this._matChrome, -0.032, 0.026, 0.02, Math.PI * 0.5, 0, 0);
    this._addMesh(root, strutGeo, this._matChrome, -0.032, 0.008, 0.02, Math.PI * 0.5, 0, 0);

    // Ceramic-white & gunmetal industrial thermal cutter emitter housing
    const emitterGeo = this._extrudeSide(
      geos,
      [
        [-0.14, -0.012],
        [-0.08, 0.038],
        [0.06, 0.042],
        [0.08, 0.006],
        [-0.10, -0.020],
      ],
      0.034,
      0.004
    );
    this._addMesh(root, emitterGeo, this._matCeramicWhite, -0.030, 0.016, 0);

    // Heavy notched titanium pry-blade spine (industrial chisel + pry-notch profile)
    const spineGeo = this._extrudeSide(
      geos,
      [
        [-0.64, 0.012],
        [-0.48, 0.050],
        [-0.24, 0.056],
        [-0.08, 0.038],
        [-0.10, 0.018],
        [-0.30, 0.028],
        [-0.50, 0.018],
      ],
      0.013,
      0.0025
    );
    this._addMesh(root, spineGeo, this._matTitaniumSteel, -0.028, 0.008, 0);

    // Superheated Tungsten-Orange Industrial Cutter Edge
    const edgeGeo = this._extrudeSide(
      geos,
      [
        [-0.67, 0.006],
        [-0.50, 0.020],
        [-0.28, 0.028],
        [-0.10, 0.016],
        [-0.12, -0.016],
        [-0.34, -0.018],
        [-0.54, -0.010],
      ],
      0.0055,
      0.0012
    );
    this._addMesh(root, edgeGeo, bladeEdgeMat, -0.028, 0.008, 0);

    // White-amber superheated cutter filament along edge tip
    const filamentGeo = this._extrudeSide(
      geos,
      [
        [-0.665, 0.004],
        [-0.52, -0.008],
        [-0.32, -0.014],
        [-0.14, -0.011],
        [-0.14, -0.005],
        [-0.32, -0.007],
        [-0.52, -0.002],
      ],
      0.0072,
      0.0005
    );
    this._addMesh(root, filamentGeo, bladeFilamentMat, -0.028, 0.008, 0);

    // Braided armored hydraulic power feed hose connecting forearm to thermal cutter
    const feedTube = this._tube(
      geos,
      [
        [-0.046, 0.022, 0.14],
        [-0.056, 0.036, 0.06],
        [-0.044, 0.034, -0.04],
        [-0.032, 0.024, -0.10],
      ],
      0.0052,
      14,
      8
    );
    this._addMesh(root, feedTube, this._matBraid);

    return {
      root,
      bladeEdgeMat,
      dispose() {
        for (let i = 0; i < geos.length; i++) geos[i].dispose();
        for (let i = 0; i < mats.length; i++) mats[i].dispose();
      },
    };
  }

  /** @private */
  _isDescendantOf(obj, ancestor) {
    let cur = obj;
    while (cur) {
      if (cur === ancestor) return true;
      cur = cur.parent;
    }
    return false;
  }

  /** @private */
  _buildWeaponSkinAttachments(root, muzzleAnchor, geos, mats) {
    const mz = muzzleAnchor ? muzzleAnchor.position : new THREE.Vector3(0, 0.04, -0.45);
    const isShort = mz.z > -0.52;
    const s = isShort ? 0.78 : 1.0;

    const skinPrimaryMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.36,
      bumpMap: this._texArmorBump,
      bumpScale: 0.005,
    });
    const skinSecondaryMat = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      metalness: 0.85,
      roughness: 0.30,
      bumpMap: this._texMetalBump,
      bumpScale: 0.004,
    });
    const skinAccentGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 2.6,
      metalness: 0.25,
      roughness: 0.20,
      toneMapped: false,
    });
    const skinGoldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.94,
      roughness: 0.18,
    });
    mats.push(skinPrimaryMat, skinSecondaryMat, skinAccentGlowMat, skinGoldTrimMat);

    const group = new THREE.Group();
    group.name = 'skinAttachments';

    const mzX = mz.x;
    const mzY = mz.y;
    const mzZ = mz.z;
    const flankX = isShort ? 0.038 : 0.046;

    // Tier 1 (Carbon Stealth): Underbarrel tactical laser box + sleek muzzle shroud vents
    const tier1 = new THREE.Group();
    const laserBoxGeo = this._box(geos, 0.024 * s, 0.020 * s, 0.075 * s);
    this._addMesh(tier1, laserBoxGeo, skinSecondaryMat, mzX, mzY - 0.036 * s, mzZ + 0.12 * s);
    const laserLensGeo = this._cyl(geos, 0.006 * s, 0.006 * s, 0.012 * s, 10);
    this._addMesh(tier1, laserLensGeo, skinAccentGlowMat, mzX, mzY - 0.036 * s, mzZ + 0.08 * s, Math.PI * 0.5, 0, 0);
    const shroudGeo = this._box(geos, 0.056 * s, 0.010 * s, 0.095 * s);
    this._addMesh(tier1, shroudGeo, skinAccentGlowMat, mzX, mzY - 0.016 * s, mzZ + 0.10 * s);
    tier1.visible = false;
    group.add(tier1);

    // Tier 2 (Arctic Cryo): Twin cryo-radiator side fins + frosted cheek blades
    const tier2 = new THREE.Group();
    const finLen = isShort ? 0.15 : 0.24;
    const cryoRailGeo = this._box(geos, 0.010 * s, 0.020 * s, finLen);
    const cryoCoreGeo = this._box(geos, 0.006 * s, 0.008 * s, finLen * 0.82);
    for (const side of [-1, 1]) {
      this._addMesh(tier2, cryoRailGeo, skinPrimaryMat, side * flankX, mzY - 0.004 * s, mzZ + finLen * 0.55 + 0.08);
      this._addMesh(tier2, cryoCoreGeo, skinAccentGlowMat, side * (flankX + 0.005 * s), mzY - 0.004 * s, mzZ + finLen * 0.55 + 0.08);
    }
    tier2.visible = false;
    group.add(tier2);

    // Tier 3 (Obsidian Magma): Serrated magma heat-sink blades + flared muzzle brake wings
    const tier3 = new THREE.Group();
    const wingGeo = this._extrudeSide(
      geos,
      [
        [-0.08 * s, -0.014 * s],
        [0.08 * s, -0.018 * s],
        [0.10 * s, 0.018 * s],
        [-0.03 * s, 0.022 * s],
      ],
      0.010 * s,
      0.0018
    );
    const bladeSlitGeo = this._box(geos, 0.007 * s, 0.008 * s, 0.13 * s);
    for (const side of [-1, 1]) {
      this._addMesh(tier3, wingGeo, skinSecondaryMat, side * (flankX + 0.004), mzY - 0.005 * s, mzZ + 0.16 * s, 0, side * -0.10, side * 0.14);
      this._addMesh(tier3, bladeSlitGeo, skinAccentGlowMat, side * (flankX + 0.009), mzY - 0.002 * s, mzZ + 0.16 * s);
    }
    const muzzleFangGeo = this._box(geos, 0.068 * s, 0.014 * s, 0.050 * s);
    this._addMesh(tier3, muzzleFangGeo, skinAccentGlowMat, mzX, mzY - 0.024 * s, mzZ + 0.04 * s);
    tier3.visible = false;
    group.add(tier3);

    // Tier 4 (Omega Crown Gold): Gilded fluted side rails + twin angled crown stabilizer fins + rear solar chevron
    const tier4 = new THREE.Group();
    const crownFinGeo = this._extrudeSide(
      geos,
      [
        [-0.05 * s, 0.0],
        [0.09 * s, 0.0],
        [0.11 * s, 0.038 * s],
        [0.01 * s, 0.032 * s],
      ],
      0.008 * s,
      0.0015
    );
    const goldRailGeo = this._box(geos, 0.011 * s, 0.014 * s, (isShort ? 0.18 : 0.28));
    for (const side of [-1, 1]) {
      this._addMesh(tier4, goldRailGeo, skinGoldTrimMat, side * (flankX + 0.005), mzY - 0.010 * s, mzZ + 0.20 * s);
      this._addMesh(tier4, crownFinGeo, skinGoldTrimMat, side * (flankX * 0.85), mzY + 0.022 * s, mzZ + 0.22 * s, 0, 0, side * -0.48);
      this._addMesh(tier4, crownFinGeo, skinAccentGlowMat, side * (flankX * 0.76), mzY + 0.018 * s, mzZ + 0.34 * s, 0, 0, side * -0.52);
    }
    const crownBarGeo = this._box(geos, 0.032 * s, 0.008 * s, 0.11 * s);
    this._addMesh(tier4, crownBarGeo, skinAccentGlowMat, mzX, mzY - 0.032 * s, mzZ + 0.15 * s);
    tier4.visible = false;
    group.add(tier4);

    root.add(group);
    return {
      group,
      tier1,
      tier2,
      tier3,
      tier4,
      skinPrimaryMat,
      skinSecondaryMat,
      skinAccentGlowMat,
      skinGoldTrimMat,
    };
  }

  /**
   * Apply a Weapon Skin (procedural PBR coat + 3D modeled attachments + emissive/LED hue) to a weapon rig.
   */
  applyWeaponSkin(rig, weaponCfg, skinCfg) {
    if (!rig || !rig.skinSystem) return;
    const ss = rig.skinSystem;
    const isStandard = !skinCfg || skinCfg.id === 'standard';

    const primaryMeshes = ss.primaryMeshes;
    const secondaryMeshes = ss.secondaryMeshes;

    if (isStandard) {
      for (let i = 0; i < primaryMeshes.length; i++) {
        const m = primaryMeshes[i];
        m.material = m.userData._origSkinMat || m.material;
      }
      for (let i = 0; i < secondaryMeshes.length; i++) {
        const m = secondaryMeshes[i];
        m.material = m.userData._origSkinMat || m.material;
      }
      ss.tier1.visible = false;
      ss.tier2.visible = false;
      ss.tier3.visible = false;
      ss.tier4.visible = false;

      const baseCol = weaponCfg && weaponCfg.color != null ? weaponCfg.color : 0xf59e0b;
      if (rig.chargeEmissives) {
        for (let i = 0; i < rig.chargeEmissives.length; i++) {
          const mat = rig.chargeEmissives[i];
          const orig = mat.userData && mat.userData._origEmColor != null ? mat.userData._origEmColor : baseCol;
          mat.color.setHex(orig);
          mat.emissive.setHex(orig);
        }
      }
      if (rig.ammoBarSegments) {
        for (let i = 0; i < rig.ammoBarSegments.length; i++) {
          const seg = rig.ammoBarSegments[i];
          const origSeg = seg.userData._origBaseColor != null ? seg.userData._origBaseColor : baseCol;
          seg.userData.baseColor = origSeg;
        }
      }
      return;
    }

    // Apply custom PBR texture & metallic coating to primary and secondary receiver meshes
    const pMat = ss.skinPrimaryMat;
    const sMat = ss.skinSecondaryMat;
    let mapTex = null;
    let emMap = null;
    let emCol = 0x000000;
    let emInt = 0.0;
    if (skinCfg.pattern === 'carbon') {
      mapTex = this._texSkinCarbon;
    } else if (skinCfg.pattern === 'digital') {
      mapTex = this._texSkinArctic;
    } else if (skinCfg.pattern === 'magma') {
      mapTex = this._texSkinMagma;
      emMap = this._texSkinMagmaGlow;
      emCol = skinCfg.emissiveColor || 0xff4500;
      emInt = 1.65;
    } else if (skinCfg.pattern === 'hex_gold') {
      mapTex = this._texSkinGoldHex;
      emCol = 0x523400;
      emInt = 0.25;
    }

    pMat.map = mapTex;
    pMat.color.setHex(mapTex ? 0xffffff : (skinCfg.primaryColor || 0xffffff));
    pMat.metalness = skinCfg.metalness != null ? skinCfg.metalness : 0.55;
    pMat.roughness = skinCfg.roughness != null ? skinCfg.roughness : 0.35;
    pMat.emissive.setHex(emCol);
    pMat.emissiveMap = emMap;
    pMat.emissiveIntensity = emInt;
    pMat.needsUpdate = true;

    sMat.color.setHex(skinCfg.secondaryColor != null ? skinCfg.secondaryColor : 0x1c2026);
    sMat.metalness = Math.min(0.95, (skinCfg.metalness != null ? skinCfg.metalness : 0.7) + 0.12);
    sMat.roughness = Math.max(0.16, (skinCfg.roughness != null ? skinCfg.roughness : 0.32) - 0.04);
    sMat.needsUpdate = true;

    const accentHex = skinCfg.accentColor != null ? skinCfg.accentColor : 0x38bdf8;
    const emissiveHex = skinCfg.emissiveColor != null ? skinCfg.emissiveColor : accentHex;
    ss.skinAccentGlowMat.color.setHex(accentHex);
    ss.skinAccentGlowMat.emissive.setHex(emissiveHex);

    for (let i = 0; i < primaryMeshes.length; i++) {
      primaryMeshes[i].material = pMat;
    }
    for (let i = 0; i < secondaryMeshes.length; i++) {
      secondaryMeshes[i].material = sMat;
    }

    const tier = skinCfg.attachmentTier || 0;
    ss.tier1.visible = tier === 1;
    ss.tier2.visible = tier === 2;
    ss.tier3.visible = tier === 3;
    ss.tier4.visible = tier >= 4;

    if (rig.chargeEmissives) {
      for (let i = 0; i < rig.chargeEmissives.length; i++) {
        const mat = rig.chargeEmissives[i];
        if (!mat.userData) mat.userData = {};
        if (mat.userData._origEmColor == null) {
          mat.userData._origEmColor = mat.emissive ? mat.emissive.getHex() : (weaponCfg ? weaponCfg.color : 0xf59e0b);
        }
        mat.color.setHex(emissiveHex);
        mat.emissive.setHex(emissiveHex);
      }
    }
    if (rig.ammoBarSegments) {
      for (let i = 0; i < rig.ammoBarSegments.length; i++) {
        const seg = rig.ammoBarSegments[i];
        if (seg.userData._origBaseColor == null) {
          seg.userData._origBaseColor = seg.userData.baseColor;
        }
        seg.userData.baseColor = emissiveHex;
      }
    }
  }

  /** @private */
  _finalizeRig({
    root,
    muzzleAnchor,
    ejectAnchor,
    boltMesh,
    magazineGroup,
    ammoBarSegments,
    chargeEmissives,
    leftHand,
    rightHand,
    reticleMesh,
    geos,
    mats,
    pumpLinkedLeftHand,
    boltKickDist,
  }) {
    const primaryMeshes = [];
    const secondaryMeshes = [];
    root.traverse((obj) => {
      if (!obj || !obj.isMesh) return;
      if (leftHand && this._isDescendantOf(obj, leftHand)) return;
      if (rightHand && this._isDescendantOf(obj, rightHand)) return;
      const mat = obj.material;
      if (
        mat === this._matOliveArmor ||
        mat === this._matCeramicWhite ||
        mat === this._matRustPlate
      ) {
        obj.userData._origSkinMat = mat;
        primaryMeshes.push(obj);
      } else if (mat === this._matGunmetal) {
        obj.userData._origSkinMat = mat;
        secondaryMeshes.push(obj);
      }
    });

    const attachInfo = this._buildWeaponSkinAttachments(root, muzzleAnchor, geos, mats);
    const skinSystem = Object.assign(attachInfo, {
      primaryMeshes,
      secondaryMeshes,
    });

    const boltRestPos = boltMesh.position.clone();
    const magRestPos = magazineGroup.position.clone();
    const magRestRot = magazineGroup.rotation.clone();
    const leftHandRestPos = leftHand.position.clone();
    const leftHandRestRot = leftHand.rotation.clone();
    const rightHandRestPos = rightHand.position.clone();

    return {
      root,
      muzzleAnchor,
      ejectAnchor,
      boltMesh,
      magazineGroup,
      ammoBarSegments,
      chargeEmissives,
      leftHand,
      rightHand,
      reticleMesh,
      skinSystem,
      pumpLinkedLeftHand,
      boltKickDist,
      boltRestPos,
      magRestPos,
      magRestRot,
      leftHandRestPos,
      leftHandRestRot,
      rightHandRestPos,
      dispose() {
        for (let i = 0; i < geos.length; i++) geos[i].dispose();
        for (let i = 0; i < mats.length; i++) mats[i].dispose();
      },
    };
  }

  /**
   * Dispose all shared procedural textures and shared PBR materials.
   */
  dispose() {
    for (let i = 0; i < this._sharedMaterials.length; i++) {
      this._sharedMaterials[i].dispose();
    }
    this._sharedMaterials.length = 0;

    for (let i = 0; i < this._sharedTextures.length; i++) {
      this._sharedTextures[i].dispose();
    }
    this._sharedTextures.length = 0;
  }
}
  __exports.WeaponModelFactory = WeaponModelFactory;
});
