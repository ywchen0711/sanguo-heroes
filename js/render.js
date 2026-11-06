// The HD-2D look: pixel-art tiles and sprites in a lit 3D diorama, seen through a tilted camera with bloom, a tilt-shift
// blur at the top and bottom of the screen, a warm colour grade and a vignette. The same view draws the land, a town
// and (with its own stage) a battle.
import * as THREE from '../lib/three.module.min.js';
import { EffectComposer } from '../lib/addons/EffectComposer.js';
import { RenderPass } from '../lib/addons/RenderPass.js';
import { UnrealBloomPass } from '../lib/addons/UnrealBloomPass.js';
import { OutputPass } from '../lib/addons/OutputPass.js';
import { ShaderPass } from '../lib/addons/ShaderPass.js';
import { tileAtlas, treeCanvas, rockCanvas, flagCanvas, personSheet, beastSheet } from './sprites.js';
export { THREE };

const TiltShift = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, dir: { value: new THREE.Vector2(1, 0) }, focus: { value: 0.5 }, band: { value: 0.17 }, amount: { value: 2.4 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res, dir; uniform float focus, band, amount; varying vec2 vUv;
    void main(){
      float d = max(0.0, abs(vUv.y - focus) - band), r = clamp(d * 3.5, 0.0, 1.0) * amount;
      vec2 st = dir / res * r;
      vec4 c = texture2D(tDiffuse, vUv) * 0.2270270270;
      c += texture2D(tDiffuse, vUv + st * 1.3846153846) * 0.3162162162; c += texture2D(tDiffuse, vUv - st * 1.3846153846) * 0.3162162162;
      c += texture2D(tDiffuse, vUv + st * 3.2307692308) * 0.0702702703; c += texture2D(tDiffuse, vUv - st * 3.2307692308) * 0.0702702703;
      gl_FragColor = c;
    }`,
};
const Grade = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.06 }, contrast: { value: 1.06 }, tint: { value: new THREE.Vector3(1.03, 1.0, 0.95) }, vig: { value: 0.55 }, fade: { value: 0 }, flash: { value: 0 }, flashColor: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: TiltShift.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, contrast, vig, fade, flash; uniform vec3 tint, flashColor; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - 0.5) * contrast + 0.5; c.rgb *= tint;
      float l2 = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += mix(vec3(-0.02, 0.0, 0.05), vec3(0.04, 0.02, -0.03), smoothstep(0.15, 0.85, l2));
      vec2 d = vUv - 0.5; c.rgb *= 1.0 - dot(d, d) * vig * 1.8;
      c.rgb = mix(c.rgb, flashColor, flash); c.rgb *= 1.0 - fade;
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0);
    }`,
};
const tex = (canvas) => { const t = new THREE.CanvasTexture(canvas); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
export const canvasTex = tex;

export class View {
  constructor(host) {
    this.host = host;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.shadowMap.autoUpdate = false; // see follow()
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    host.appendChild(r.domElement);
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog('#c8d8e8', 26, 60);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);
    this.camOff = new THREE.Vector3(0, 16.4, 13.8); this.baseOff = this.camOff.clone(); this.yaw = 0; this.zoom = 1;
    this.hemi = new THREE.HemisphereLight('#dfefff', '#6a5a3a', 1.35); this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff0d8', 2.1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    // post: bloom, tilt-shift (two passes), the grade
    const cp = this.composer = new EffectComposer(r);
    cp.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.6, 0.82); cp.addPass(this.bloom);
    this.tsH = new ShaderPass(TiltShift); this.tsV = new ShaderPass(TiltShift); this.tsV.uniforms.dir.value.set(0, 1); cp.addPass(this.tsH); cp.addPass(this.tsV);
    this.grade = new ShaderPass(Grade); cp.addPass(this.grade); cp.addPass(new OutputPass());
    this.atlas = tileAtlas(); this.atlasTex = tex(this.atlas.canvas);
    this.groundMat = new THREE.MeshLambertMaterial({ map: this.atlasTex, vertexColors: true });
    this.chunks = new Map(); this.actors = new Set(); this.labels = []; this.t = 0;
    this.labelLayer = document.createElement('div'); this.labelLayer.className = 'labels'; host.appendChild(this.labelLayer);
    this.resize(); window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
    this.renderer.setSize(w, h); this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    for (const p of [this.tsH, this.tsV]) p.uniforms.res.value.set(w, h);
    this.W = w; this.H = h;
  }
  // ---------------------------------------------------------------- a map: M = { W, H, tile(x,y) -> { top, side, h }, deco(x,y), water: level|null, fog, sky }
  setMap(M) {
    this.clearMap(); this.M = M; this.shadowDirty = true;
    this.scene.background = new THREE.Color(M.sky || '#9ac8f0'); this.scene.fog.color.set(M.fog || M.sky || '#c8d8e8');
    this.scene.fog.near = M.fogNear || 26; this.scene.fog.far = M.fogFar || 60; this.fogBase = [this.scene.fog.near, this.scene.fog.far];
    if (this.zoom !== 1) { this.scene.fog.near *= Math.max(1, this.zoom); this.scene.fog.far *= Math.max(1, this.zoom); }
    this.hemi.intensity = M.dark ? 0.75 : 1.35; this.sun.intensity = M.dark ? 0.45 : 2.1; this.hemi.color.set(M.dark ? '#d8b898' : '#dfefff');
    // the party carries a torch in the dark
    if (M.dark && !this.torch) { this.torch = new THREE.PointLight('#ffb070', 3.2, 11, 1.4); this.scene.add(this.torch); } if (this.torch) this.torch.visible = !!M.dark;
    this.mapGroup = new THREE.Group(); this.scene.add(this.mapGroup);
    if (M.water != null) {
      const g = new THREE.PlaneGeometry(M.W + 80, M.H + 80, 1, 1); g.rotateX(-Math.PI / 2);
      this.waterMat = new THREE.ShaderMaterial({ transparent: true, fog: true, uniforms: { t: { value: 0 }, ...THREE.UniformsLib.fog },
        vertexShader: ['varying vec3 wp;', '#include <fog_pars_vertex>', 'void main(){', '  vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz;', '  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;', '  #include <fog_vertex>', '}'].join('\n'),
        fragmentShader: ['uniform float t; varying vec3 wp;', '#include <fog_pars_fragment>', 'void main(){',
          '  vec2 p = floor(wp.xz * 4.0) / 4.0; float w = sin(p.x * 1.7 + t * 1.3) * sin(p.y * 1.3 - t) + sin((p.x + p.y) * 0.7 + t * 0.8);',
          '  vec3 c = mix(vec3(0.16, 0.42, 0.72), vec3(0.22, 0.55, 0.85), w * 0.25 + 0.5); if (w > 1.35) c = vec3(0.75, 0.9, 1.0);',
          '  gl_FragColor = vec4(c, 0.86);', '  #include <fog_fragment>', '}'].join('\n') });
      const water = new THREE.Mesh(g, this.waterMat); water.position.set(M.W / 2, M.water, M.H / 2); water.renderOrder = 1; this.mapGroup.add(water);
    }
    for (const p of M.props || []) this.addProp(p);
    setTimeout(() => this.warm(), 0);
  }
  clearMap() {
    for (const c of this.chunks.values()) { c.mesh.geometry.dispose(); }
    this.chunks.clear();
    if (this.mapGroup) this.scene.remove(this.mapGroup);
    for (const a of [...this.actors]) this.removeActor(a);
    for (const l of this.labels) l.el.remove(); this.labels = [];
  }
  // build the chunks near a point, drop the far ones
  // budget: how many missing chunks to build now (the nearest first); the rest come in the next frames
  updateChunks(cx, cz, budget = Infinity) {
    const S = 16, R = 3, kx = Math.floor(cx / S), kz = Math.floor(cz / S), want = new Set(), need = [];
    if (!this.M) return;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const x = kx + dx, z = kz + dz; if (x < 0 || z < 0 || x * S >= this.M.W || z * S >= this.M.H) continue;
      const k = x + ',' + z; want.add(k); if (!this.chunks.has(k)) need.push([dx * dx + dz * dz, k, x, z]);
    }
    need.sort((a, b) => a[0] - b[0]);
    for (const [, k, x, z] of need.slice(0, budget)) { this.chunks.set(k, this.buildChunk(x * S, z * S, S)); this.shadowDirty = true; }
    for (const [k, c] of this.chunks) if (!want.has(k)) { this.mapGroup.remove(c.mesh); c.mesh.geometry.dispose(); for (const s of c.deco) { this.mapGroup.remove(s); s.dispose?.(); } this.chunks.delete(k); }
  }
  buildChunk(x0, z0, S) {
    const M = this.M, A = this.atlas, pos = [], uv = [], col = [], nor = [], idx = [];
    const uvOf = (n) => { const u0 = (n % A.cols) / A.cols, v0 = 1 - Math.floor(n / A.cols) / A.rows, du = 1 / A.cols, dv = 1 / A.rows, e = 0.002; return [u0 + e, v0 - dv + e, u0 + du - e, v0 - e]; };
    const quad = (p, n, n2, c, flipV) => { const b = pos.length / 3; pos.push(...p); const [u0, v0, u1, v1] = uvOf(n2); if (flipV) uv.push(u0, v1, u1, v1, u1, v0, u0, v0); else uv.push(u0, v0, u1, v0, u1, v1, u0, v1); for (let k = 0; k < 4; k++) { nor.push(...n); col.push(c, c, c); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
    const deco = [];
    for (let z = z0; z < Math.min(M.H, z0 + S); z++) for (let x = x0; x < Math.min(M.W, x0 + S); x++) {
      const T = M.tile(x, z); if (!T) continue;
      const h = T.h, sh = 0.9 + ((x * 7 + z * 13) % 5) * 0.025;
      quad([x, h, z + 1, x + 1, h, z + 1, x + 1, h, z, x, h, z], [0, 1, 0], T.top, sh);
      // sides down to each lower neighbour
      for (const [dx, dz, n] of [[0, 1, [0, 0, 1]], [1, 0, [1, 0, 0]], [0, -1, [0, 0, -1]], [-1, 0, [-1, 0, 0]]]) {
        const N = M.tile(x + dx, z + dz), nh = N ? N.h : -1; if (nh >= h - 0.001) continue;
        const lo = Math.max(nh, -1), c = sh * (dx ? 0.78 : dz > 0 ? 0.9 : 0.7);
        // tall sides get one tile of texture per unit of height
        for (let y = h; y > lo + 0.001; y -= 1) { const y1 = Math.max(lo, y - 1), side = y === h ? T.side : T.side2 ?? T.side;
          if (dz === 1) quad([x, y1, z + 1, x + 1, y1, z + 1, x + 1, y, z + 1, x, y, z + 1], n, side, c, false);
          else if (dz === -1) quad([x + 1, y1, z, x, y1, z, x, y, z, x + 1, y, z], n, side, c, false);
          else if (dx === 1) quad([x + 1, y1, z + 1, x + 1, y1, z, x + 1, y, z, x + 1, y, z + 1], n, side, c, false);
          else quad([x, y1, z, x, y1, z + 1, x, y, z + 1, x, y, z], n, side, c, false); }
      }
      const d = M.deco ? M.deco(x, z) : 0;
      if (d) for (const s of this.decoSpots(d, x, z, h)) deco.push(s);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const mesh = new THREE.Mesh(g, this.groundMat); mesh.receiveShadow = true; mesh.castShadow = true; this.mapGroup.add(mesh);
    return { mesh, deco: this.decoBatch(deco) };
  }
  // trees (1-3 kinds, 4 a blossom), 5 a rock, 6 a snowy rock: where they stand in a tile
  decoSpots(d, x, z, h) {
    const out = [], n = d <= 4 ? (((x * 31 + z * 17) % 3) ? 2 : 1) : 1;
    for (let i = 0; i < n; i++) {
      const k = d >= 5 ? 0.9 : 1.25 + ((x + z * 3 + i) % 4) * 0.12;
      const ox = n > 1 ? (i ? 0.72 : 0.3) : 0.5, oz = n > 1 ? (i ? 0.35 : 0.75) : 0.55;
      out.push({ d, x: x + ox, y: h, z: z + oz, sx: k * (d >= 5 ? 0.9 : 0.75), sy: k });
    }
    return out;
  }
  // all the trees and rocks of a chunk as a few instanced boards (upright, stretched like the actors to read right from
  // the tilted camera) - one draw call per kind instead of one per tree
  decoBatch(spots) {
    if (!spots.length) return [];
    this.decoMats ||= {};
    const mat = (k) => this.decoMats[k] ||= new THREE.MeshBasicMaterial({ map: tex(k >= 5 ? rockCanvas(k === 6) : treeCanvas(k - 1)), alphaTest: 0.5, fog: true, side: THREE.DoubleSide });
    const geo = this.decoGeo ||= new THREE.PlaneGeometry(1, 1).translate(0, 0.49, 0);
    const up = this.upK();
    const byKind = new Map(); for (const s of spots) { if (!byKind.has(s.d)) byKind.set(s.d, []); byKind.get(s.d).push(s); }
    const out = [], m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw || 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [k, list] of byKind) {
      const im = new THREE.InstancedMesh(geo, mat(k), list.length); im.userData.spots = list;
      list.forEach((s, i) => { m.compose(v.set(s.x, s.y, s.z), q, sc.set(s.sx, s.sy * up, 1)); im.setMatrixAt(i, m); });
      im.instanceMatrix.needsUpdate = true; if (im.computeBoundingSphere) im.computeBoundingSphere(); else im.frustumCulled = false;
      this.mapGroup.add(im); out.push(im);
    }
    return out;
  }
  // ---------------------------------------------------------------- props: cities on the land, houses in a town
  addProp(p) {
    this.shadowDirty = true;
    const g = new THREE.Group(); g.position.set(p.x, p.y || 0, p.z);
    const box = (w, h, d, n, x, y, z, color = '#ffffff') => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.propMat(n, color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    if (p.kind === 'city') {
      const R = p.r + 0.5, hgt = 0.75, th = 0.28;
      // the four walls and a gate in the south one
      box(R * 2, hgt, th, 'brick', 0, hgt / 2, -R); box(th, hgt, R * 2, 'brick', -R, hgt / 2, 0); box(th, hgt, R * 2, 'brick', R, hgt / 2, 0);
      box(R - 0.45, hgt, th, 'brick', -R / 2 - 0.23, hgt / 2, R); box(R - 0.45, hgt, th, 'brick', R / 2 + 0.23, hgt / 2, R);
      for (const [x, z] of [[-R, -R], [R, -R], [-R, R], [R, R]]) { box(0.5, hgt + 0.3, 0.5, 'brick', x, (hgt + 0.3) / 2, z); this.roof(g, x, hgt + 0.3, z, 0.7, 0.7, 0.35, p.roofRed); }
      this.roof(g, 0, hgt + 0.05, R, 1.1, 0.6, 0.35, p.roofRed); // the gatehouse
      // the keep: one storey for a small city, three for a great one
      let y = 0; const floors = p.size >= 3 ? 3 : p.size === 2 ? 2 : 1;
      for (let k = 0; k < floors; k++) { const w = 1.5 - k * 0.32; box(w, 0.45, w, 'wall', 0, y + 0.225, -0.2); this.roof(g, 0, y + 0.45, -0.2, w + 0.45, w + 0.45, 0.32, p.roofRed); y += 0.62; }
      // houses inside
      for (const [x, z] of p.size >= 2 ? [[-R + 0.75, R - 0.7], [R - 0.75, R - 0.7], [-R + 0.75, -R + 0.8], [R - 0.75, -R + 0.8]] : [[-0.7, 0.55], [0.7, 0.55]]) { box(0.6, 0.3, 0.5, 'wall', x, 0.15, z); this.roof(g, x, 0.3, z, 0.8, 0.7, 0.22, !p.roofRed); }
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(flagCanvas(p.color || '#888')), alphaTest: 0.5 })); fl.center.set(0.1, 0); fl.scale.set(0.6, 1, 1); fl.position.set(0.1, y + 0.1, -0.2); g.add(fl); g.userData.flag = fl;
    }
    if (p.kind === 'house') {
      box(p.w - 0.2, p.h, p.d - 0.2, 'wall', p.w / 2, p.h / 2, p.d / 2);
      for (let i = 0; i < p.w - 1; i++) box(0.12, p.h, 0.05, 'wood', 0.6 + i, p.h / 2, p.d - 0.08);
      const rf = this.roof(g, p.w / 2, p.h, p.d / 2, p.w + 0.35, p.d + 0.35, p.roofH || 0.8, p.red); if (p.straw) rf.material = this.strawMat ||= new THREE.MeshLambertMaterial({ color: '#c8a868', side: THREE.DoubleSide });
      if (p.floors === 2) { box(p.w - 0.7, 0.7, p.d - 0.7, 'wall', p.w / 2, p.h + 0.75, p.d / 2); this.roof(g, p.w / 2, p.h + 1.1, p.d / 2, p.w - 0.1, p.d - 0.1, 0.7, p.red); }
      if (p.sign) { const c = document.createElement('canvas'); c.width = 32; c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#3a2a1a'; x.fillRect(0, 0, 32, 16); x.fillStyle = '#e8c860'; x.fillRect(1, 1, 30, 14); x.fillStyle = '#3a2a1a'; x.fillRect(2, 2, 28, 12); x.fillStyle = '#f0e0b0'; x.font = 'bold 11px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.sign, 16, 8.5);
        const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: tex(c) })); s.position.set(p.door + 0.5, p.h - 0.25, p.d + 0.02); g.add(s); }
      if (p.door != null) box(0.8, 0.95, 0.06, 'door', p.door + 0.5, 0.48, p.d - 0.07, '#3a2418');
    }
    // a county town on the land: a small walled square with one hall and a flag
    if (p.kind === 'county') {
      const R = 0.75, hg = 0.5, th = 0.18;
      box(R * 2, hg, th, 'brick', 0, hg / 2, -R); box(th, hg, R * 2, 'brick', -R, hg / 2, 0); box(th, hg, R * 2, 'brick', R, hg / 2, 0);
      box(R - 0.3, hg, th, 'brick', -R / 2 - 0.15, hg / 2, R); box(R - 0.3, hg, th, 'brick', R / 2 + 0.15, hg / 2, R);
      box(0.8, 0.4, 0.7, 'wall', 0, 0.2, -0.15); this.roof(g, 0, 0.4, -0.15, 1.15, 1.0, 0.3, true);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(flagCanvas(p.color || '#888')), alphaTest: 0.5 })); fl.center.set(0.1, 0); fl.scale.set(0.45, 0.75, 1); fl.position.set(0.55, 0.3, -0.55); g.add(fl);
    }
    // a village: three farmhouses with straw roofs round a haystack
    if (p.kind === 'village') {
      for (const [x, z, w] of [[-0.55, -0.35, 0.6], [0.5, -0.45, 0.55], [0.05, 0.45, 0.65]]) { box(w, 0.32, 0.45, 'wall', x, 0.16, z); const rf = this.roof(g, x, 0.32, z, w + 0.2, 0.6, 0.28, false); rf.material = this.strawMat ||= new THREE.MeshLambertMaterial({ color: '#c8a868', side: THREE.DoubleSide }); }
      const hay = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 8), this.strawMat); hay.position.set(-0.6, 0.2, 0.5); hay.castShadow = true; g.add(hay);
    }
    // the mouth of a cave: a heap of rock with a black opening
    if (p.kind === 'cave') {
      const rock = this.propMat('stone', '#8a8478');
      for (const [x, y, z, sx, sy, sz] of [[0, 0.45, -0.1, 1.3, 0.9, 0.9], [-0.45, 0.3, 0.1, 0.5, 0.6, 0.6], [0.45, 0.32, 0.12, 0.5, 0.64, 0.6], [0, 0.85, -0.05, 0.8, 0.35, 0.7]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), rock); m.position.set(x, y, z); m.rotation.y = x * 0.6; m.castShadow = m.receiveShadow = true; g.add(m); }
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#050302' })); hole.position.set(0, 0.02, 0.37); g.add(hole);
      const hole2 = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.3), hole.material); hole2.position.set(0, -0.12, 0.37); g.add(hole2);
    }
    // a chest in a cave; opened, its lid stands up
    if (p.kind === 'chest') {
      box(0.62, 0.36, 0.42, 'wood', 0.5, 0.18, 0.5, '#a06a3a'); box(0.66, 0.05, 0.08, 'lamp', 0.5, 0.2, 0.72, '#e8c860');
      const lid = new THREE.Group(); lid.position.set(0.5, 0.36, 0.29); g.add(lid);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.44), this.propMat('wood', '#b07a44')); l.position.set(0, 0.06, 0.22); l.castShadow = true; lid.add(l);
      g.userData.lid = lid; if (p.open) lid.rotation.x = -1.9;
    }
    if (p.kind === 'stele') { box(0.5, 1.3, 0.2, 'stone', 0.5, 0.65, 0.5, p.used ? '#7a7a7a' : '#c8c0b0'); box(0.6, 0.15, 0.3, 'stone', 0.5, 0.07, 0.5, '#8a8478'); }
    if (p.kind === 'spring') { const w = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.used ? '#2a4a6a' : '#5ac8ff' })); w.position.set(0.5, 0.03, 0.5); g.add(w); for (const [x, z] of [[0.05, 0.5], [0.95, 0.5], [0.5, 0.05], [0.5, 0.95]]) box(0.22, 0.2, 0.22, 'stone', x, 0.1, z, '#8a8478'); }
    if (p.kind === 'bones') { for (const [x, z, r] of [[0.35, 0.5, 0.3], [0.6, 0.45, -0.6], [0.5, 0.7, 1.2]]) { const b = box(0.4, 0.06, 0.07, 'wall', x, 0.04, z, '#e8e0d0'); b.rotation.y = r; } box(0.16, 0.14, 0.16, 'wall', 0.62, 0.08, 0.62, '#e8e0d0'); }
    if (p.kind === 'shrine') { box(0.6, 0.5, 0.45, 'wood', 0.5, 0.25, 0.5, '#8a3a2a'); this.roof(g, 0.5, 0.5, 0.5, 0.8, 0.65, 0.25, true); box(0.2, 0.18, 0.06, 'lamp', 0.5, 0.3, 0.74, p.used ? '#5a5a5a' : '#ffd86a'); }
    if (p.kind === 'tree') { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(treeCanvas(p.t || 0)), alphaTest: 0.5 })); s.center.set(0.5, 0.02); s.scale.set(1.3, 1.7, 1); g.add(s); }
    if (p.kind === 'well') { box(0.8, 0.4, 0.8, 'brick', 0.5, 0.2, 0.5); box(0.06, 0.8, 0.06, 'wood', 0.15, 0.6, 0.5); box(0.06, 0.8, 0.06, 'wood', 0.85, 0.6, 0.5); this.roof(g, 0.5, 1, 0.5, 1, 0.6, 0.25, true); }
    if (p.kind === 'lantern' && p.wall) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: '#ffb060' })); l.position.set(0.5, 1.3, 0.5); g.add(l); const pl = new THREE.PointLight('#ff9a50', 2.2, 7, 1.6); pl.position.set(0.5, 1.3, 0.5); g.add(pl); }
    else if (p.kind === 'lantern') { box(0.1, 0.9, 0.1, 'wood', 0.5, 0.45, 0.5); const l = box(0.28, 0.32, 0.28, 'lamp', 0.5, 1.05, 0.5, '#ff8a4a'); l.material = new THREE.MeshBasicMaterial({ color: '#ffb060' }); }
    if (p.kind === 'banner') { const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(flagCanvas(p.color)), alphaTest: 0.5 })); fl.center.set(0.1, 0); fl.scale.set(0.9, 1.5, 1); fl.position.set(0.5, 0, 0.5); g.add(fl); }
    this.mapGroup.add(g); p.obj = g;
    if (p.label) this.addLabel(p.label, g, p.labelY ?? 2.4, p.labelClass);
    return g;
  }
  propMat(n, color) {
    this.pm ||= {}; const k = n + color; if (this.pm[k]) return this.pm[k];
    const N = { brick: 11, wall: 21, wood: 13, door: 13, lamp: 21, roof: 12, roofRed: 20, stone: 10 }[n] ?? 21, A = this.atlas;
    const c = document.createElement('canvas'); c.width = c.height = A.T; c.getContext('2d').drawImage(A.canvas, (N % A.cols) * A.T, Math.floor(N / A.cols) * A.T, A.T, A.T, 0, 0, A.T, A.T);
    return this.pm[k] = new THREE.MeshLambertMaterial({ map: tex(c), color });
  }
  // a Chinese hip roof: a low pyramid with the eaves turned up a little
  roof(g, x, y, z, w, d, h, red) {
    const geo = new THREE.BufferGeometry(), e = 0.08, hw = w / 2, hd = d / 2, rid = Math.max(0, hw - hd) * 0.9;
    const v = [-hw, e, -hd, hw, e, -hd, hw, e, hd, -hw, e, hd, -rid, h, 0, rid, h, 0];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 2, 0, 0, 0, 0.6, 1.4, 1.4, 1.4], 2));
    geo.setIndex([0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0, 0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.roofMat(red)); m.position.set(x, y, z); m.castShadow = true; g.add(m);
    return m;
  }
  roofMat(red) {
    this.rm ||= {}; if (this.rm[red ? 1 : 0]) return this.rm[red ? 1 : 0];
    const A = this.atlas, N = red ? 20 : 12, c = document.createElement('canvas'); c.width = c.height = A.T; c.getContext('2d').drawImage(A.canvas, (N % A.cols) * A.T, Math.floor(N / A.cols) * A.T, A.T, A.T, 0, 0, A.T, A.T);
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return this.rm[red ? 1 : 0] = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide, color: red ? '#ffffff' : '#b8d0e8', emissive: red ? '#2a0a04' : '#0a1a2a' });
  }
  // ---------------------------------------------------------------- labels in the DOM, following a 3D point
  addLabel(html, obj, dy = 2, cls = '') { const el = document.createElement('div'); el.className = 'lbl ' + cls; el.innerHTML = html; this.labelLayer.appendChild(el); const l = { el, obj, dy }; this.labels.push(l); return l; }
  removeLabel(l) { l.el.remove(); this.labels = this.labels.filter((x) => x !== l); }
  // ---------------------------------------------------------------- actors: a sprite sheet on a billboard, with a blob shadow
  addActor(sheet, x, z, o = {}) {
    // each frame is read half a pixel in from its edges, so the neighbouring frame (the feet of the row above) never shows
    const t = tex(sheet.canvas), iu = 0.5 / sheet.canvas.width, iv = 0.5 / sheet.canvas.height; t.repeat.set(1 / 3 - 2 * iu, 1 / 4 - 2 * iv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    // an upright board (not a camera-facing sprite: that would lean back into the wall behind a character), stretched
    // up so that seen from the tilted camera it keeps its proportions
    const s = new THREE.Mesh(this.boardGeo ||= new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, fog: true, side: THREE.DoubleSide }));
    const k = o.scale || 1; this.sizeActor({ sprite: s }, 1.15 * k, 1.53 * k);
    const sh = new THREE.Mesh(this.shadowGeo ||= new THREE.CircleGeometry(0.32, 16).rotateX(-Math.PI / 2), this.shadowMat ||= new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    const a = { sheet, sprite: s, shadow: sh, tex: t, iu, iv, x, z, y: 0, dir: 0, frame: 1, walkT: 0, ...o };
    this.scene.add(s, sh); this.actors.add(a); this.placeActor(a);
    return a;
  }
  // the board's size as it should look on screen
  sizeActor(a, w, h) { a.sprite.scale.set(w, h * this.upK(), 1); }
  removeActor(a) { this.scene.remove(a.sprite, a.shadow); a.tex.dispose(); a.sprite.material.dispose(); if (a.label) this.removeLabel(a.label); this.actors.delete(a); }
  placeActor(a) {
    const h = a.y ?? 0; a.sprite.position.set(a.x + 0.5, h, a.z + 0.5); a.shadow.position.set(a.x + 0.5, h + 0.03, a.z + 0.5); a.sprite.rotation.y = this.yaw || 0;
    // a beast's sheet is two side-view frames facing left (face 2 turns it round); a person's is 4 directions x 3 frames
    if (a.beast) { const flip = a.face === 2; a.tex.repeat.set((flip ? -1 : 1) * (1 / 2 - 2 * a.iu), 1 - 2 * a.iv); a.tex.offset.set(((a.bframe || 0) % 2) / 2 + (flip ? 0.5 - a.iu : a.iu), a.iv); return; }
    a.tex.offset.set(a.frame / 3 + a.iu, 1 - (this.viewRow(a.dir) + 1) / 4 + a.iv);
  }
  // ---------------------------------------------------------------- the free camera
  // yaw: how far round the camera has turned (0 = looking north as before); zoom: 1 as before, less is closer
  setView(yaw, zoom) {
    const was = this.yaw; this.yaw = yaw; this.zoom = Math.max(0.55, Math.min(1.7, zoom));
    const b = this.baseOff, k = this.zoom, horiz = b.z * k;
    this.camOff.set(Math.sin(yaw) * horiz, b.y * k, Math.cos(yaw) * horiz);
    if (this.fogBase) { this.scene.fog.near = this.fogBase[0] * Math.max(1, k); this.scene.fog.far = this.fogBase[1] * Math.max(1, k); }
    const sc = this.sun.shadow.camera, ext = 26 * Math.max(1, k); if (sc.right !== ext) { Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext }); sc.updateProjectionMatrix(); }
    if (Math.abs(was - yaw) > 0.02 || this._decoYaw == null) this.turnDeco();
    for (const a of this.actors) this.placeActor(a);
    this.shadowDirty = true;
  }
  // which row of a sheet to show: a figure's facing in the world, seen from where the camera is now
  viewRow(dir) {
    if (!this.yaw) return dir;
    const f = [[0, 1], [-1, 0], [1, 0], [0, -1]][dir] || [0, 1], s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const toward = f[0] * s + f[1] * c, right = f[0] * c - f[1] * s;
    return Math.abs(toward) >= Math.abs(right) ? (toward > 0 ? 0 : 3) : right > 0 ? 2 : 1;
  }
  // the world direction (0 down 1 left 2 right 3 up) that a key means on screen right now
  screenDir(key) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const v = { down: [s, c], up: [-s, -c], right: [c, -s], left: [-c, s] }[key];
    const W = [['down', 0, 1], ['left', -1, 0], ['right', 1, 0], ['up', 0, -1]];
    return W.reduce((best, w) => (w[1] * v[0] + w[2] * v[1] > best[1] ? [w[0], w[1] * v[0] + w[2] * v[1]] : best), ['down', -9])[0];
  }
  // trees and rocks are boards too: they turn to face the camera
  turnDeco() {
    this._decoYaw = this.yaw;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = this.upK();
    for (const c of this.chunks.values()) for (const im of c.deco) { const list = im.userData.spots; if (!list) continue; list.forEach((s, i) => { m.compose(v.set(s.x, s.y, s.z), q, sc.set(s.sx, s.sy * up, 1)); im.setMatrixAt(i, m); }); im.instanceMatrix.needsUpdate = true; }
  }
  upK() { const o = this.camOff, horiz = Math.hypot(o.x, o.z); return Math.min(1.5, (Math.hypot(o.y, horiz) / Math.max(0.001, horiz)) * 0.82); }
  // ---------------------------------------------------------------- the frame
  follow(x, y, z, snap) {
    const tgt = (this._tgt ||= new THREE.Vector3()).set(x + 0.5, y, z + 0.5);
    this.camTarget = snap || !this.camTarget ? tgt.clone() : this.camTarget.lerp(tgt, 0.12);
    this.camera.position.copy(this.camTarget).add(this.camOff); this.camera.lookAt(this.camTarget.x, this.camTarget.y + 0.6, this.camTarget.z);
    // only the scenery casts into the shadow map (the people have blob shadows), so it is drawn again only when the view
    // has moved a few tiles or the scenery has changed - not every frame (it was some three hundred draw calls a frame)
    const st = this.sun.target.position;
    if (this.shadowDirty || Math.abs(st.x - this.camTarget.x) > 3 || Math.abs(st.z - this.camTarget.z) > 3) {
      this.sun.position.set(this.camTarget.x - 12, this.camTarget.y + 22, this.camTarget.z + 6); st.copy(this.camTarget); this.sun.target.updateMatrixWorld();
      this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false;
    }
  }
  render(dt) {
    this.t += dt; if (this.waterMat) this.waterMat.uniforms.t.value = this.t;
    this.composer.render();
    // labels
    const v = this._lv ||= new THREE.Vector3(), cam = this.camera.position, far = 34 + Math.hypot(this.camOff.y, this.camOff.z) - 16;
    for (const l of this.labels) {
      l.obj.getWorldPosition(v); v.y += l.dy; const d = v.distanceTo(cam);
      let vis = d < far, tr = '';
      if (vis) { v.project(this.camera); vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1; if (vis) tr = `translate(${Math.round((v.x * 0.5 + 0.5) * this.W)}px, ${Math.round((-v.y * 0.5 + 0.5) * this.H)}px) translate(-50%, -100%)`; }
      if (l.vis !== vis) { l.el.style.display = vis ? '' : 'none'; l.vis = vis; }
      if (vis && l.tr !== tr) { l.el.style.transform = tr; l.tr = tr; }
    }
    this.quality(dt);
  }
  quality(dt) {
    const Q = this._q ||= { t: 0, n: 0, sum: 0, level: 0 }; Q.t += dt; Q.n++; Q.sum += dt;
    if (Q.t < 3) return; const avg = Q.sum / Q.n; Q.t = Q.n = Q.sum = 0;
    if (avg > 1 / 28 && Q.level < 3) {
      Q.level++;
      if (Q.level === 1) this.renderer.setPixelRatio(Math.min(1.2, window.devicePixelRatio || 1));
      if (Q.level === 2) { this.renderer.setPixelRatio(1); this.bloom.enabled = false; }
      if (Q.level === 3) { this.renderer.setPixelRatio(0.85); this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
      this.resize();
    }
  }
  // compile every material on the map now, so nothing stalls the first time it comes into view
  warm() { try { this.renderer.compile(this.scene, this.camera); } catch (e) {} }
  // the season tints the grade a little: spring green, summer warm, autumn gold, winter cold
  // the hour and the weather over an open map: l = daylight (1 noon … 0.4 night), wx = 'rain' | 'snow' | null
  mood(l, wx) {
    const M = this.M; if (!M || M.dark) return;
    const sky = new THREE.Color(M.sky || '#9ac8f0'), fog = new THREE.Color(M.fog || M.sky || '#c8d8e8'), night = new THREE.Color('#0c1630'), grey = new THREE.Color(wx === 'snow' ? '#c8ccd4' : '#7a848e'), wet = wx ? 0.65 : 0, k = Math.min(0.8, (1 - l) / 0.6);
    this.scene.background.copy(sky.lerp(grey, wet).lerp(night, k * 0.92)); this.scene.fog.color.copy(fog.lerp(grey, wet).lerp(night, k * 0.92));
    this.hemi.intensity = 1.35 * (0.3 + 0.7 * (1 - k)) * (wx ? 0.85 : 1); this.sun.intensity = 2.1 * (0.06 + 0.94 * (1 - k)) * (wx ? 0.4 : 1);
    this.hemi.color.set(k > 0.5 ? '#a8b8f0' : '#dfefff'); this.sun.color.set(k > 0.2 && k < 0.8 ? '#ffc890' : '#fff0d8');
    // a torch for the party at night
    if (k > 0.5 && !this.torch) { this.torch = new THREE.PointLight('#ffb070', 3.2, 11, 1.4); this.scene.add(this.torch); } if (this.torch) this.torch.visible = k > 0.5;
  }
  season(month) {
    const T = { 1: [0.96, 0.99, 1.06], 2: [0.98, 1, 1.04], 3: [1.0, 1.02, 0.96], 4: [1.01, 1.02, 0.95], 5: [1.02, 1.01, 0.94], 6: [1.04, 1.0, 0.92], 7: [1.05, 1.0, 0.9], 8: [1.05, 0.99, 0.9], 9: [1.06, 0.99, 0.88], 10: [1.07, 0.98, 0.86], 11: [1.0, 0.98, 0.98], 12: [0.95, 0.98, 1.08] }[month];
    this.grade.uniforms.tint.value.set(...T);
  }
}
export { personSheet, beastSheet };
