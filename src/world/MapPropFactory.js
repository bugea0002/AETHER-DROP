// Module: src/world/MapPropFactory.js
__define("src/world/MapPropFactory.js", (__exports, __require) => {
const PROP_GLB_REGISTRY = Object.freeze({
  orbital_drop_pod: './assets/models/props/orbital_drop_pod.glb?v=20261128h',
  ruined_viaduct_pier: './assets/models/props/ruined_viaduct_pier.glb?v=20261128h',
  crane_cargo_rig: './assets/models/props/crane_cargo_rig.glb?v=20261128h',
  destructible_barricade: './assets/models/props/destructible_barricade.glb?v=20261128h',
  steam_valve_tower: './assets/models/props/steam_valve_tower.glb?v=20261128h',
  crater_bunker_arch: './assets/models/props/crater_bunker_arch.glb?v=20261128h',
  aegis_barrier_gate: './assets/models/props/aegis_barrier_gate.glb?v=20261128h',
  emp_boost_rail: './assets/models/props/emp_boost_rail.glb?v=20261128h',
  reactor_turbine_core: './assets/models/props/reactor_turbine_core.glb?v=20261128h',
  aegis_cover_crate: './assets/models/props/aegis_cover_crate.glb?v=20261128h',
  drydock_gantry_arch: './assets/models/props/drydock_gantry_arch.glb?v=20261128h',
  abyss_monolith_cover: './assets/models/props/abyss_monolith_cover.glb?v=20261128h',
  void_portal_arch: './assets/models/props/void_portal_arch.glb?v=20261128h',
  singularity_crystal_node: './assets/models/props/singularity_crystal_node.glb?v=20261128h',
  floating_island_spire: './assets/models/props/floating_island_spire.glb?v=20261128h',
});

let _sharedInstance = null;

/**
 * Modular GLB Prop Cache & Collider Extractor for Redesigned Campaign Arenas and Orbital Drop Pod.
 * Preloads sculpted high-density Blender props into memory, shares base geometries,
 * extracts local COLLIDER_* bounding volumes without extra draw calls, and cleanly handles
 * deferred mount upgrades if needed.
 */
class MapPropFactory {
  constructor() {
    this._cache = new Map();
    this._loading = new Set();
    this._failed = new Set();
    this._preloadPromise = null;
    this._detailRoughMap = null;
  }

  static getShared() {
    if (!_sharedInstance) {
      _sharedInstance = new MapPropFactory();
      if (typeof document !== 'undefined' && globalThis.GLTFLoader) {
        _sharedInstance.preloadProps().catch(() => {});
      }
    }
    return _sharedInstance;
  }

  _getRoughMap() {
    if (this._detailRoughMap || typeof document === 'undefined') return this._detailRoughMap;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#cfcfcf';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 420; i++) {
        const x = (i * 53) % size;
        const y = (i * 97) % size;
        const shade = 175 + (i % 58);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.fillStyle = 'rgba(135,135,135,0.35)';
      ctx.fillRect(0, 62, size, 2);
      ctx.fillRect(62, 0, 2, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      tex.needsUpdate = true;
      this._detailRoughMap = tex;
    }
    return this._detailRoughMap;
  }

  /**
   * Preload all 15 prop & drop pod GLB assets once in parallel.
   * @returns {Promise<void>}
   */
  preloadProps() {
    if (this._preloadPromise) return this._preloadPromise;
    if (typeof document === 'undefined' || !globalThis.GLTFLoader) {
      this._preloadPromise = Promise.resolve();
      return this._preloadPromise;
    }

    const loader = new globalThis.GLTFLoader();
    const entries = Object.entries(PROP_GLB_REGISTRY);
    const roughMap = this._getRoughMap();

    this._preloadPromise = Promise.all(
      entries.map(([id, url]) => {
        if (this._cache.has(id) || this._failed.has(id)) return Promise.resolve();
        this._loading.add(id);
        return new Promise((resolve) => {
          loader.load(
            url,
            (gltf) => {
              this._loading.delete(id);
              const scene = gltf && gltf.scene;
              if (!scene) {
                this._failed.add(id);
                resolve();
                return;
              }
              const colliderSpecs = [];
              scene.updateMatrixWorld(true);
              scene.traverse((obj) => {
                if (/^COLLIDER_/i.test(obj.name || '')) {
                  obj.visible = false;
                  colliderSpecs.push({
                    name: obj.name,
                    x: obj.position.x,
                    y: obj.position.y,
                    z: obj.position.z,
                    w: Math.max(0.1, Math.abs(obj.scale.x)),
                    h: Math.max(0.1, Math.abs(obj.scale.y)),
                    d: Math.max(0.1, Math.abs(obj.scale.z)),
                  });
                } else if (obj.isMesh) {
                  obj.castShadow = true;
                  obj.receiveShadow = true;
                  if (roughMap && obj.material && !obj.material.emissiveIntensity && !obj.material.roughnessMap) {
                    obj.material.roughnessMap = roughMap;
                    obj.material.needsUpdate = true;
                  }
                }
              });
              scene.userData.colliderSpecs = colliderSpecs;
              this._cache.set(id, scene);
              resolve();
            },
            undefined,
            () => {
              this._loading.delete(id);
              this._failed.add(id);
              resolve();
            }
          );
        });
      })
    ).then(() => {});

    return this._preloadPromise;
  }

  hasProp(propId) {
    return this._cache.has(propId);
  }

  /**
   * Clone a cached prop GLB scene cleanly into a wrapper Group.
   * Note: clone() shares BufferGeometries to minimize VRAM while optional `cloneMaterials`
   * isolates dynamic emissive swaps (e.g., crane triggers, portal cores, Drop Pod strobes).
   */
  createPropInstance(propId, { cloneMaterials = false, castShadow = true, receiveShadow = true } = {}) {
    const tpl = this._cache.get(propId);
    if (!tpl) return null;

    const clone = tpl.clone(true);
    const ownedMaterials = [];
    if (cloneMaterials) {
      clone.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        if (Array.isArray(node.material)) {
          node.material = node.material.map((m) => {
            const cm = m.clone();
            ownedMaterials.push(cm);
            return cm;
          });
        } else {
          const cm = node.material.clone();
          ownedMaterials.push(cm);
          node.material = cm;
        }
      });
    }
    clone.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = castShadow;
        node.receiveShadow = receiveShadow;
      }
      if (/^COLLIDER_/i.test(node.name || '')) {
        node.visible = false;
      }
    });

    return {
      root: clone,
      colliderSpecs: tpl.userData.colliderSpecs || [],
      ownedMaterials,
      dispose() {
        for (let i = 0; i < ownedMaterials.length; i++) {
          ownedMaterials[i].dispose();
        }
      },
    };
  }

  /**
   * Mount a sculptural prop into `parentGroup` immediately if cached, or defer seamlessly until
   * `preloadProps()` resolves. Calls `onMounted(instance)` once attached cleanly.
   */
  mountProp(parentGroup, propId, {
    position = null,
    rotationY = 0,
    scale = 1,
    cloneMaterials = false,
    castShadow = true,
    receiveShadow = true,
    onMounted = null,
  } = {}) {
    const mountRoot = new THREE.Group();
    mountRoot.name = `PropMount_${propId}`;
    if (position) mountRoot.position.copy(position);
    if (rotationY) mountRoot.rotation.y = rotationY;
    if (typeof scale === 'number' && scale !== 1) mountRoot.scale.setScalar(scale);
    else if (scale && typeof scale === 'object') mountRoot.scale.set(scale.x || 1, scale.y || 1, scale.z || 1);
    parentGroup.add(mountRoot);

    const applyInstance = () => {
      if (mountRoot.userData.disposed) return null;
      const inst = this.createPropInstance(propId, { cloneMaterials, castShadow, receiveShadow });
      if (!inst) return null;
      mountRoot.add(inst.root);
      mountRoot.userData.propInstance = inst;
      if (typeof onMounted === 'function') onMounted(inst, mountRoot);
      return inst;
    };

    if (this._cache.has(propId)) {
      applyInstance();
    } else if (!this._failed.has(propId) && typeof document !== 'undefined' && globalThis.GLTFLoader) {
      this.preloadProps().then(() => applyInstance());
    }

    return mountRoot;
  }

  /**
   * Convert local GLB COLLIDER_* specifications into world-space AABBs in CollisionWorld
   * cleanly accounting for position, yaw rotation, and scale.
   */
  static registerTransformedColliders(specs, collisionWorld, pos, yaw = 0, scale = 1, tag = 'cover') {
    if (!collisionWorld || !Array.isArray(specs) || specs.length === 0) return [];
    const ids = [];
    const sX = typeof scale === 'number' ? scale : (scale.x || 1);
    const sY = typeof scale === 'number' ? scale : (scale.y || 1);
    const sZ = typeof scale === 'number' ? scale : (scale.z || 1);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const absCos = Math.abs(cosY);
    const absSin = Math.abs(sinY);

    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      const lx = sp.x * sX;
      const ly = sp.y * sY;
      const lz = sp.z * sZ;
      const cx = (pos ? pos.x : 0) + lx * cosY + lz * sinY;
      const cy = (pos ? pos.y : 0) + ly;
      const cz = (pos ? pos.z : 0) - lx * sinY + lz * cosY;

      const bw = sp.w * sX;
      const bh = sp.h * sY;
      const bd = sp.d * sZ;
      const worldHalfW = (bw * absCos + bd * absSin) * 0.5;
      const worldHalfD = (bw * absSin + bd * absCos) * 0.5;
      const worldHalfH = bh * 0.5;

      const box = collisionWorld.addBox(
        cx - worldHalfW,
        cy - worldHalfH,
        cz - worldHalfD,
        cx + worldHalfW,
        cy + worldHalfH,
        cz + worldHalfD,
        tag
      );
      if (box) ids.push(box.id);
    }
    return ids;
  }
}

__exports.PROP_GLB_REGISTRY = PROP_GLB_REGISTRY;
__exports.MapPropFactory = MapPropFactory;
});
