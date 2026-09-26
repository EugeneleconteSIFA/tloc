// The Legend of Camille — moteur commun (rendu, monde, personnages, combat, HUD, menus, sauvegarde)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { chargerTexture, texturesEnAttente } from './assets.js';     // les textures décodées en tâche de fond
export { THREE };

// =====================================================================
//  Utilitaires
// =====================================================================
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const TAU = Math.PI * 2;
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
export function distSeg(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / l2 : 0;
  t = clamp(t, 0, 1);
  const dx = px - (ax + abx * t), dz = pz - (az + abz * t);
  return Math.hypot(dx, dz);
}
export function pointInPoly(px, pz, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > pz) !== (zj > pz) && px < (xj - xi) * (pz - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// =====================================================================
//  Rendu
// =====================================================================
const canvas = document.getElementById('game');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// La vérification des shaders (getProgramInfoLog) force le navigateur à finir chaque
// compilation sur-le-champ : 1,3 s d'attente au profil du chargement. Les joueurs n'en ont
// pas besoin ; ?debug dans l'adresse la remet pour chercher une erreur de shader.
renderer.debug.checkShaderErrors = /[?&]debug\b/.test(location.search);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(58, 1, 0.25, 3200);   // carte au 1:1 : la brume s'ouvre à ~2,5 km
export const SUN_DIR = new THREE.Vector3(0.62, 0.46, 0.34).normalize();   // ~26° au-dessus de l'horizon : fin d'après-midi
export const hemi = new THREE.HemisphereLight(0xc2d6ee, 0x6a5c33, 0.50);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffdcab, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 10, far: 420 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
sun.position.copy(SUN_DIR).multiplyScalar(130);
scene.add(sun, sun.target);

export let sky = null;
// Ciel atmosphérique : dégradé type Rayleigh (le zénith garde le bleu profond, l'horizon
// s'épaissit et blanchit parce que la lumière y traverse beaucoup plus d'air), disque
// solaire avec halo, et un voile de cirrus procédural très haut qui dérive lentement.
// `top`/`mid`/`bot` = zénith / ciel moyen / brume d'horizon, pour rester compatible avec
// les appels existants des niveaux intérieurs.
export function makeSky(top = 0x2f6fc4, mid = 0x8fbfe8, bot = 0xc6d6e2, withEnv = true) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bot) },
      sunDir: { value: SUN_DIR }, time: { value: 0 }, cirrus: { value: 0.42 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, mid, bot, sunDir; uniform float time, cirrus; varying vec3 vP;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hsh(i), hsh(i+vec2(1.0,0.0)), u.x), mix(hsh(i+vec2(0.0,1.0)), hsh(i+vec2(1.0,1.0)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p *= 2.07; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vP); float h = d.y;
        float az = max(dot(normalize(vec3(d.x, 0.0001, d.z)), normalize(vec3(sunDir.x, 0.0001, sunDir.z))), 0.0);
        // dégradé vertical : puissance < 1 pour que le bleu profond ne descende pas trop vite
        vec3 c = mix(mid, top, pow(clamp(h, 0.0, 1.0), 0.42));
        // brume d'horizon, plus chaude et plus haute du côté du soleil
        float hz = exp(-max(h, 0.0) * 8.0);
        c = mix(c, bot, clamp(hz * (0.55 + 0.45 * az * az), 0.0, 1.0));
        if (h < 0.0) c = mix(c, bot * 0.90, clamp(-h * 5.0, 0.0, 1.0));
        // soleil : disque net, halo serré, diffusion large dans tout le quadrant
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.00, 0.93, 0.74) * pow(s, 1800.0) * 3.2;
        c += vec3(1.00, 0.82, 0.56) * pow(s,   60.0) * 0.34;
        c += vec3(1.00, 0.74, 0.47) * pow(s,    6.0) * 0.13;
        // cirrus : projection du ciel sur un plan haut, donc l'échelle s'écrase vers l'horizon
        if (h > 0.015) {
          vec2 q = d.xz / max(h, 0.045) * 0.85 + vec2(time * 0.006, time * 0.0022);
          float ci = smoothstep(0.52, 0.95, fbm(q)) * smoothstep(0.015, 0.30, h) * (1.0 - smoothstep(0.75, 1.0, h) * 0.5);
          vec3 cc = mix(vec3(1.0, 0.98, 0.95), vec3(1.0, 0.85, 0.70), pow(az, 3.0));
          c = mix(c, cc, ci * cirrus);
        }
        gl_FragColor = vec4(c, 1.0); }`,
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(700, 48, 24), skyMat); sky.userData.dynamic = true; scene.add(sky);
  if (withEnv) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene(); envScene.add(sky.clone());
    scene.environment = pmrem.fromScene(envScene, 0.04, 0.1, 2000).texture;
    pmrem.dispose();
  }
  return sky;
}

// post-traitement : bloom discret + légère profondeur de champ + vignette
export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
export const bokeh = new BokehPass(scene, camera, { focus: 12, aperture: 0.00003, maxblur: 0.0025 });
composer.addPass(bokeh);
// LA PROFONDEUR DE CHAMP RÉUTILISE LA PROFONDEUR DE L'IMAGE. BokehPass redessinait toute la
// scène avec un matériau de profondeur, rien que pour la connaître — alors que la passe
// principale vient de l'écrire. Mesuré : 40 ms par image sur la vue du bourg. Les deux
// tampons du compositeur portent une DepthTexture, et le flou lit celle du tampon qu'il
// reçoit (RenderPass écrit dans readBuffer sans échanger).
composer.renderTarget1.depthTexture = new THREE.DepthTexture();
composer.renderTarget2.depthTexture = new THREE.DepthTexture();
bokeh.materialBokeh.defines.DEPTH_PACKING = 0; bokeh.materialBokeh.needsUpdate = true;
bokeh.render = function (r, writeBuffer, readBuffer) {
  this.uniforms.tColor.value = readBuffer.texture;
  this.uniforms.tDepth.value = readBuffer.depthTexture;
  this.uniforms.nearClip.value = this.camera.near; this.uniforms.farClip.value = this.camera.far;
  r.setRenderTarget(this.renderToScreen ? null : writeBuffer);
  if (!this.renderToScreen) r.clear();
  this.fsQuad.render(r);
};
export const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.5, 0.92);
composer.addPass(bloom);
const vignette = new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - smoothstep(0.5, 1.0, d) * 0.4; gl_FragColor = c; }',
});
composer.addPass(vignette);
composer.addPass(new OutputPass());
export const G = { postFX: true, echelle: 1, camYaw: Math.PI, camBack: 10.5, camUp: 6.5, camMaxY: Infinity, level: null, freeCam: null, fade: 0, fadeTarget: 0, fadeCb: null, journal: false, shake: 0, camPitch: 0, bowOut: false, mouseLook: false, mouseT: -10 };
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ---------- qualité adaptative : on baisse automatiquement si ça rame ----------
export const Q = {
  level: 0, hooks: [], frames: 0, acc: 0, warm: 0, locked: false,
  apply(l, silent = false) {
    l = clamp(l, 0, 3); Q.level = l;
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio([Math.min(dpr, 1.5), Math.min(dpr, 1.25), 1, 0.85][l]);
    sun.shadow.mapSize.set([2048, 1024, 1024, 512][l], [2048, 1024, 1024, 512][l]); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    sun.castShadow = l < 3 && Q.shadowsWanted;
    G.postFX = l < 2 && Q.postWanted; bokeh.enabled = l < 1;
    resize();
    for (const h of Q.hooks) h(l);
    try { localStorage.setItem('tloc_quality', String(l)); } catch (e) {}
    if (!silent) showMessage(`Qualité graphique : ${['maximale', 'élevée', 'moyenne', 'basse'][l]} (touches 1 à 4 pour choisir)`, 2.5);
  },
  tick(dt) {
    Q.warm += dt; if (Q.warm < 6 || Q.locked) return;
    Q.frames++; Q.acc += dt;
    if (Q.acc >= 2.5) { const fps = Q.frames / Q.acc; Q.frames = 0; Q.acc = 0; if (fps < 34 && Q.level < 3) Q.apply(Q.level + 1); }
  },
  shadowsWanted: true, postWanted: true,
};

// =====================================================================
//  Textures procédurales (couleur + relief)
// =====================================================================
export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// bruit de valeur lissé (tuilable)
export function valueNoise(w, h, cells, seed = 1) {
  const g = [], n = cells;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n * n; i++) g.push(rnd());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / w * n, fy = y / h * n, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const v = (xx, yy) => g[((yy % n) + n) % n * n + ((xx % n) + n) % n];
    const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
    out[y * w + x] = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }
  return out;
}
export function fbm(w, h, octaves = 4, seed = 1) {
  const out = new Float32Array(w * h); let amp = 0.5, cells = 4, total = 0;
  for (let o = 0; o < octaves; o++) { const n = valueNoise(w, h, cells, seed + o * 17); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; total += amp; amp *= 0.5; cells *= 2; }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
// carte de normales à partir d'une carte de hauteur (Float32 0..1)
export function normalMapFrom(height, w, h, strength = 2) {
  const [c, g] = makeCanvas(w, h); const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = height[y * w + (x + w - 1) % w], r = height[y * w + (x + 1) % w];
    const u = height[((y + h - 1) % h) * w + x], d = height[((y + 1) % h) * w + x];
    const nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); const i = (y * w + x) * 4;
    img.data[i] = (nx / len * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / len * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, 1, false);
}
export function brickTextures() {
  const W = 512, H = 256, [c, g] = makeCanvas(W, H);
  const height = new Float32Array(W * H).fill(0.25);
  g.fillStyle = '#c9b89a'; g.fillRect(0, 0, W, H);
  const n = fbm(W, H, 3, 5);
  const bw = 64, bh = 32;
  for (let row = 0; row < H / bh; row++) {
    const off = (row % 2) * bw / 2;
    for (let col = -1; col < W / bw + 1; col++) {
      const x0 = col * bw + off + 2, y0 = row * bh + 2, w = bw - 4, h = bh - 4;
      const hue = 10 + rand(-6, 8), sat = 45 + rand(-10, 12), lig = 36 + rand(-9, 9);
      g.fillStyle = `hsl(${hue},${sat}%,${lig}%)`; g.fillRect(x0, y0, w, h);
      for (let yy = Math.max(0, y0); yy < Math.min(H, y0 + h); yy++) for (let xx = Math.max(0, x0); xx < Math.min(W, x0 + w); xx++) height[yy * W + xx] = 0.7 + n[yy * W + xx] * 0.3;
    }
  }
  // grain
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) { const v = (n[i] - 0.5) * 40 + (Math.random() - 0.5) * 18; img.data[i * 4] += v; img.data[i * 4 + 1] += v; img.data[i * 4 + 2] += v; }
  g.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: normalMapFrom(height, W, H, 2.5) };
}
export function grassTextures(base = [78, 122, 46], variance = 1) {
  const W = 512, H = 512, [c, g] = makeCanvas(W, H);
  const n = fbm(W, H, 5, 11), n2 = fbm(W, H, 3, 23);
  const img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const patch = (n2[i] - 0.5) * 60 * variance, grain = (n[i] - 0.5) * 50 + (Math.random() - 0.5) * 22;
    img.data[i * 4] = base[0] + patch * 0.9 + grain * 0.8; img.data[i * 4 + 1] = base[1] + patch + grain; img.data[i * 4 + 2] = base[2] + patch * 0.5 + grain * 0.5; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // brins
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * W, y = Math.random() * H, l = rand(3, 9), a = rand(-0.5, 0.5);
    g.strokeStyle = `rgba(${base[0] + rand(-20, 50)},${base[1] + rand(-10, 60)},${base[2] + rand(-10, 30)},0.55)`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke();
  }
  return { map: tex(c), normalMap: normalMapFrom(n, W, H, 1.2) };
}
export function dirtTextures(base = [176, 152, 108]) {
  const W = 512, H = 512, [c, g] = makeCanvas(W, H);
  const n = fbm(W, H, 5, 31), img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const v = (n[i] - 0.5) * 70 + (Math.random() - 0.5) * 24; img.data[i * 4] = base[0] + v; img.data[i * 4 + 1] = base[1] + v; img.data[i * 4 + 2] = base[2] + v * 0.8; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${rand(90, 140)},${rand(80, 120)},${rand(60, 90)},0.5)`; g.beginPath(); g.ellipse(Math.random() * W, Math.random() * H, rand(1, 4), rand(1, 3), rand(0, TAU), 0, TAU); g.fill(); }
  return { map: tex(c), normalMap: normalMapFrom(n, W, H, 1.5) };
}
export function stoneTextures() {
  const W = 256, H = 256, [c, g] = makeCanvas(W, H);
  const n = fbm(W, H, 5, 41), img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const v = 190 + (n[i] - 0.5) * 70 + (Math.random() - 0.5) * 20; img.data[i * 4] = v; img.data[i * 4 + 1] = v - 6; img.data[i * 4 + 2] = v - 18; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: normalMapFrom(n, W, H, 2) };
}
export function barkTextures() {
  const W = 256, H = 512, [c, g] = makeCanvas(W, H);
  const n = fbm(W, H, 4, 77), img = g.createImageData(W, H), height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const streak = 0.5 + 0.5 * Math.sin(x * 0.35 + n[i] * 9 + Math.sin(y * 0.02) * 2);
    const h = streak * 0.6 + n[i] * 0.4; height[i] = h;
    const v = 55 + h * 60 + (Math.random() - 0.5) * 16;
    img.data[i * 4] = v + 12; img.data[i * 4 + 1] = v * 0.8; img.data[i * 4 + 2] = v * 0.55; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: normalMapFrom(height, W, H, 3) };
}
export function leafClusterTexture(hue = 100) {
  const W = 256, H = 256, [c, g] = makeCanvas(W, H);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * TAU, r = Math.pow(Math.random(), 0.6) * 105;
    const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r * 0.95;
    const lig = 22 + Math.random() * 30 + (1 - r / 105) * 10;
    g.fillStyle = `hsl(${hue + rand(-14, 14)},${rand(45, 65)}%,${lig}%)`;
    g.save(); g.translate(x, y); g.rotate(Math.random() * TAU);
    g.beginPath(); g.ellipse(0, 0, rand(7, 14), rand(3, 6), 0, 0, TAU); g.fill(); g.restore();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
export function grassBladeTexture() {
  const W = 128, H = 128, [c, g] = makeCanvas(W, H);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 22; i++) {
    const x = rand(8, W - 8), w = rand(3, 7), h = rand(60, 125), lean = rand(-25, 25);
    g.fillStyle = `hsl(${rand(85, 115)},${rand(45, 65)}%,${rand(24, 44)}%)`;
    g.beginPath(); g.moveTo(x - w / 2, H); g.quadraticCurveTo(x + lean * 0.5, H - h * 0.6, x + lean, H - h); g.quadraticCurveTo(x + lean * 0.5, H - h * 0.6, x + w / 2, H); g.fill();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
export function cloudTexture() {
  const W = 256, H = 128, [c, g] = makeCanvas(W, H);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = rand(40, W - 40), y = rand(45, H - 35), r = rand(18, 40);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// =====================================================================
//  Matières du bestiaire (BRIEF règle 1 : ces bêtes n'existent dans aucun
//  pack, elles restent maison — mais elles doivent monter au niveau du
//  décor photographique. Donc vraies cartes : albédo + normales + rugosité.)
// =====================================================================

/** Carte de gris (rugosité, occlusion…) à partir d'un tableau 0..1. */
export function grayMapFrom(v, w, h, lo = 0, hi = 1) {
  const [c, g] = makeCanvas(w, h), img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const x = Math.max(0, Math.min(255, (lo + v[i] * (hi - lo)) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = x; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, 1, false);
}

/** Trace `fn` en le répétant aux quatre bords : la tuile se raccorde. */
function bouclee(g, W, H, x, y, marge, fn) {
  for (const dx of (x < marge ? [0, W] : x > W - marge ? [0, -W] : [0]))
    for (const dy of (y < marge ? [0, H] : y > H - marge ? [0, -H] : [0])) {
      g.save(); g.translate(x + dx, y + dy); fn(g); g.restore();
    }
}

/**
 * Pelage. Le réalisme d'une fourrure basse-poly ne vient pas du maillage mais
 * du relief : des milliers de poils courts, orientés, qui accrochent la lumière.
 * `teinte` en HSL, `lg` = longueur du poil en pixels.
 */
export function furTextures(teinte = [24, 22, 26], lg = 26, W = 512, H = 512) {
  const [c, g] = makeCanvas(W, H);
  const [hu, sa, li] = teinte;
  g.fillStyle = `hsl(${hu},${sa}%,${Math.max(3, li - 12)}%)`; g.fillRect(0, 0, W, H);
  const sous = fbm(W, H, 4, 131);                      // sous-poil : taches claires/sombres
  { const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < W * H; i++) { const v = (sous[i] - 0.5) * 46;
      img.data[i * 4] += v; img.data[i * 4 + 1] += v * 0.92; img.data[i * 4 + 2] += v * 0.8; }
    g.putImageData(img, 0, 0); }
  const haut = new Float32Array(W * H).fill(0.35);
  g.lineCap = 'round';
  const N = Math.round(W * H / 42);                    // ~6 200 poils en 512²
  for (let i = 0; i < N; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const ang = -Math.PI / 2 + (sous[(y | 0) * W + (x | 0)] - 0.5) * 1.5 + rand(-0.35, 0.35);
    const l = lg * rand(0.55, 1.35), ep = rand(0.7, 1.9);
    const clair = rand(-9, 15) + (i % 23 === 0 ? 22 : 0);   // quelques poils blancs
    g.strokeStyle = `hsl(${hu + rand(-5, 6)},${sa}%,${Math.max(2, Math.min(80, li + clair))}%)`;
    g.lineWidth = ep;
    bouclee(g, W, H, x, y, lg + 4, gg => {
      gg.beginPath(); gg.moveTo(0, 0);
      gg.quadraticCurveTo(Math.cos(ang) * l * 0.5 + rand(-3, 3), Math.sin(ang) * l * 0.5,
                          Math.cos(ang) * l + rand(-5, 5), Math.sin(ang) * l);
      gg.stroke();
    });
    // le poil éclairci creuse la hauteur vers sa pointe : relief directionnel
    const px = x + Math.cos(ang) * l * 0.5, py = y + Math.sin(ang) * l * 0.5;
    const ix = ((px | 0) % W + W) % W, iy = ((py | 0) % H + H) % H;
    haut[iy * W + ix] = Math.min(1, haut[iy * W + ix] + 0.35);
  }
  // le relief vient de l'image elle-même : plus fidèle que des mèches isolées
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) haut[i] = (img.data[i * 4] + img.data[i * 4 + 1]) / 510;
  return { map: tex(c), normalMap: normalMapFrom(haut, W, H, 3.2),
           roughnessMap: grayMapFrom(haut, W, H, 0.98, 0.72) };
}

/** Plumage : rangées de pennes qui se recouvrent, avec le rachis au centre. */
export function featherTextures(teinte = [222, 20, 9], W = 512, H = 512) {
  const [c, g] = makeCanvas(W, H);
  const [hu, sa, li] = teinte;
  g.fillStyle = `hsl(${hu},${sa}%,${Math.max(2, li - 5)}%)`; g.fillRect(0, 0, W, H);
  const haut = new Float32Array(W * H).fill(0.4);
  const RG = 13, pas = H / RG;
  for (let r = 0; r < RG; r++) {
    const lp = W / (7 + (r % 2));                       // largeur de penne, alternée
    for (let k = -1; k < W / lp + 1; k++) {
      const x = k * lp + (r % 2) * lp / 2, y = r * pas;
      const lo = pas * rand(1.5, 1.9), la = lp * rand(0.52, 0.66);
      // irisation : le corbeau vire au bleu-vert selon l'angle
      const iri = Math.random() < 0.3 ? rand(-40, 18) : rand(-6, 6);
      g.fillStyle = `hsl(${hu + iri},${sa + rand(0, 22)}%,${Math.max(2, li + rand(-4, 9))}%)`;
      bouclee(g, W, H, x, y, lp + 4, gg => {
        gg.beginPath();
        gg.moveTo(0, 0);
        gg.bezierCurveTo(-la, lo * 0.35, -la * 0.75, lo, 0, lo);
        gg.bezierCurveTo(la * 0.75, lo, la, lo * 0.35, 0, 0);
        gg.fill();
        gg.strokeStyle = `hsla(${hu},${sa}%,2%,0.7)`; gg.lineWidth = 1.6;   // ombre de recouvrement
        gg.beginPath();
        gg.moveTo(0, 0); gg.bezierCurveTo(-la, lo * 0.35, -la * 0.75, lo, 0, lo);
        gg.bezierCurveTo(la * 0.75, lo, la, lo * 0.35, 0, 0); gg.stroke();
        gg.strokeStyle = `hsla(${hu},${sa}%,${li + 20}%,0.5)`; gg.lineWidth = 1;   // rachis
        gg.beginPath(); gg.moveTo(0, 2); gg.lineTo(0, lo - 2); gg.stroke();
      });
    }
  }
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) haut[i] = (img.data[i * 4] + img.data[i * 4 + 2]) / 510;
  return { map: tex(c), normalMap: normalMapFrom(haut, W, H, 4.5),
           roughnessMap: grayMapFrom(haut, W, H, 0.62, 0.28) };   // la plume est lustrée
}

/** Membrane alaire : peau fine tendue, nervures ramifiées, grain de cuir. */
export function membraneTextures(teinte = [288, 16, 20], W = 512, H = 512) {
  const [c, g] = makeCanvas(W, H);
  const [hu, sa, li] = teinte;
  g.fillStyle = `hsl(${hu},${sa}%,${li}%)`; g.fillRect(0, 0, W, H);
  const n = fbm(W, H, 5, 207);
  { const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < W * H; i++) { const v = (n[i] - 0.5) * 34;
      img.data[i * 4] += v * 1.2; img.data[i * 4 + 1] += v * 0.8; img.data[i * 4 + 2] += v; }
    g.putImageData(img, 0, 0); }
  const haut = new Float32Array(W * H);
  // nervures : quelques troncs qui se divisent
  g.lineCap = 'round';
  const branche = (x, y, ang, lon, ep, prof) => {
    if (prof > 4 || ep < 0.5) return;
    const x2 = x + Math.cos(ang) * lon, y2 = y + Math.sin(ang) * lon;
    g.strokeStyle = `hsla(${hu - 10},${sa + 26}%,${li + 13}%,${0.75 - prof * 0.1})`;
    g.lineWidth = ep;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + rand(-8, 8), (y + y2) / 2 + rand(-8, 8), x2, y2); g.stroke();
    branche(x2, y2, ang + rand(0.25, 0.7), lon * 0.68, ep * 0.62, prof + 1);
    branche(x2, y2, ang - rand(0.25, 0.7), lon * 0.68, ep * 0.62, prof + 1);
  };
  for (let i = 0; i < 7; i++) branche(rand(0, W), rand(0, H), rand(0, TAU), rand(60, 110), rand(3.5, 5.5), 0);
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) haut[i] = img.data[i * 4 + 2] / 255 * 0.6 + n[i] * 0.4;
  return { map: tex(c), normalMap: normalMapFrom(haut, W, H, 2.6),
           roughnessMap: grayMapFrom(haut, W, H, 0.86, 0.52) };
}

/** Nacre / coquille : stries de croissance concentriques et reflets changeants. */
export function shellTextures(W = 512, H = 512) {
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#10141f'; g.fillRect(0, 0, W, H);
  const cx = W * 0.5, cy = H * 1.12;                    // umbo hors champ, en bas
  const haut = new Float32Array(W * H);
  for (let r = 5; r < W * 1.6; r += rand(2.5, 6.5)) {
    const t = Math.min(1, r / (W * 1.4));
    g.strokeStyle = `hsl(${218 + Math.sin(r * 0.05) * 12},${22 + t * 14}%,${7 + t * 17 + rand(-3, 3)}%)`;
    g.lineWidth = rand(1, 2.6);
    g.beginPath(); g.ellipse(cx, cy, r, r * 0.8, 0, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
  }
  // stries radiales fines et voile irisé très discret
  for (let i = 0; i < 40; i++) {
    const a = Math.PI * (1.05 + Math.random() * 0.9);
    g.strokeStyle = `hsla(210,25%,${rand(10, 26)}%,0.35)`; g.lineWidth = rand(0.6, 1.6);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * W * 1.5, cy + Math.sin(a) * H * 1.2); g.stroke();
  }
  const lg = g.createLinearGradient(0, H, W, 0);
  lg.addColorStop(0.0, 'rgba(70,120,170,0.12)'); lg.addColorStop(0.45, 'rgba(130,95,175,0.09)');
  lg.addColorStop(0.75, 'rgba(70,165,140,0.08)'); lg.addColorStop(1, 'rgba(50,75,130,0.12)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) haut[i] = (img.data[i * 4] + img.data[i * 4 + 1] + img.data[i * 4 + 2]) / 765;
  return { map: tex(c), normalMap: normalMapFrom(haut, W, H, 3.2),
           roughnessMap: grayMapFrom(haut, W, H, 0.4, 0.08) };
}

/** Peau nue : queue annelée du rat, oreilles, pattes, groin. */
export function bareSkinTextures(teinte = [8, 34, 58], anneaux = true, W = 256, H = 256) {
  const [c, g] = makeCanvas(W, H);
  const [hu, sa, li] = teinte;
  g.fillStyle = `hsl(${hu},${sa}%,${li}%)`; g.fillRect(0, 0, W, H);
  const n = fbm(W, H, 5, 311);
  const haut = new Float32Array(W * H);
  if (anneaux) for (let y = 0; y < H; y += 7) {
    g.strokeStyle = `hsla(${hu - 4},${sa}%,${li - 16}%,0.7)`; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) {
    const pore = (Math.random() < 0.06 ? -22 : 0) + (n[i] - 0.5) * 26;
    img.data[i * 4] += pore; img.data[i * 4 + 1] += pore * 0.85; img.data[i * 4 + 2] += pore * 0.8;
    haut[i] = (img.data[i * 4] + img.data[i * 4 + 1]) / 510;
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: normalMapFrom(haut, W, H, 2.8),
           roughnessMap: grayMapFrom(haut, W, H, 0.72, 0.48) };
}

/** Cuir d'ogre : écailles serrées, pores, plis profonds, cicatrices. */
export function hideTextures(teinte = [10, 48, 26], W = 512, H = 512) {
  const [c, g] = makeCanvas(W, H);
  const [hu, sa, li] = teinte;
  g.fillStyle = `hsl(${hu},${sa}%,${Math.max(3, li - 10)}%)`; g.fillRect(0, 0, W, H);
  const n = fbm(W, H, 5, 419);
  // écailles : maille hexagonale décalée, chaque cellule bombée et déformée
  const PAS = 17, LIGNES = Math.round(H / (PAS * 0.86));
  for (let r = 0; r < LIGNES; r++) {
    const y = r * H / LIGNES;
    for (let k = -1; k < W / PAS + 1; k++) {
      const x = k * PAS + (r % 2) * PAS / 2 + rand(-2, 2);
      const rx = PAS * rand(0.44, 0.60), ry = PAS * rand(0.40, 0.56);
      const t = n[(((y | 0) % H) * W + (((x | 0) % W) + W) % W)];
      g.fillStyle = `hsl(${hu + rand(-4, 5)},${sa + rand(-8, 8)}%,${Math.max(4, li + (t - 0.4) * 26 + rand(-3, 4))}%)`;
      bouclee(g, W, H, ((x % W) + W) % W, y, PAS + 3, gg => {
        gg.beginPath(); gg.ellipse(0, 0, rx, ry, rand(-0.4, 0.4), 0, TAU); gg.fill();
      });
    }
  }
  const haut = new Float32Array(W * H);
  // pores et grain
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) {
    const v = (n[i] - 0.5) * 26 + (Math.random() < 0.05 ? -30 : 0) + (Math.random() - 0.5) * 10;
    img.data[i * 4] += v * 1.15; img.data[i * 4 + 1] += v * 0.8; img.data[i * 4 + 2] += v * 0.7;
  }
  g.putImageData(img, 0, 0);
  // plis profonds, puis quelques cicatrices claires
  g.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const x = rand(0, W), y = rand(0, H), a = rand(0, TAU), l = rand(60, 180);
    g.strokeStyle = `hsla(${hu},${sa}%,${Math.max(2, li - 17)}%,0.6)`; g.lineWidth = rand(2, 5);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rand(-25, 25), y + Math.sin(a) * l * 0.5 + rand(-25, 25),
                       x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = rand(0, W), y = rand(0, H), a = rand(0, TAU), l = rand(50, 120);
    g.strokeStyle = `hsla(${hu + 6},${Math.max(10, sa - 22)}%,${li + 19}%,0.75)`; g.lineWidth = rand(2.5, 5);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const img2 = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) haut[i] = (img2.data[i * 4] * 0.6 + img2.data[i * 4 + 1] * 0.4) / 255;
  return { map: tex(c), normalMap: normalMapFrom(haut, W, H, 4.2),
           roughnessMap: grayMapFrom(haut, W, H, 0.97, 0.66) };
}

/** Matériau de créature : les trois cartes, répétées au gabarit voulu. */
export function creatureMat(t, rx = 1, ry = 1, extra = {}) {
  const m = t.map.clone(), nm = t.normalMap.clone(), rm = t.roughnessMap.clone();
  for (const x of [m, nm, rm]) { x.repeat.set(rx, ry); x.needsUpdate = true; }
  return new THREE.MeshStandardMaterial({ map: m, normalMap: nm, roughnessMap: rm,
    roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1, 1), ...extra });
}

export const T = {
  brick: brickTextures(), grass: grassTextures(), fosse: grassTextures([62, 104, 40], 1.3), dirt: dirtTextures(), stone: stoneTextures(), bark: barkTextures(),
  leaf: [leafClusterTexture(100), leafClusterTexture(88), leafClusterTexture(112)], blade: grassBladeTexture(), cloud: cloudTexture(),
  waterN: normalMapFrom(fbm(256, 256, 4, 99), 256, 256, 1.6),
  plank: plankTextures(), rock: rockTextures(),
};
T.grass.map.repeat.set(30, 30); T.grass.normalMap.repeat.set(30, 30);
T.fosse.map.repeat.set(30, 30); T.fosse.normalMap.repeat.set(30, 30);
T.dirt.map.repeat.set(12, 12); T.dirt.normalMap.repeat.set(12, 12);
T.stone.map.repeat.set(0.5, 0.5); T.stone.normalMap.repeat.set(0.5, 0.5);

// Matières du bestiaire : fabriquées à la demande (chacune coûte ~30 ms de canvas,
// et une partie du bestiaire ne sort jamais des galeries).
const _CT = {};
const _CTF = {
  pelageRat:   () => furTextures([22, 26, 24], 22),
  pelageRoi:   () => furTextures([32, 20, 30], 26),
  pelageChauve:() => furTextures([278, 16, 15], 14, 256, 256),
  plumes:      () => featherTextures([222, 22, 8]),
  membrane:    () => membraneTextures([292, 18, 21]),
  nacre:       () => shellTextures(),
  peauNue:     () => bareSkinTextures([12, 20, 44], true),
  peauLisse:   () => bareSkinTextures([14, 24, 54], false),
  cuirOgre:    () => hideTextures([8, 46, 24]),
  chairMoule:  () => bareSkinTextures([28, 42, 52], false),
};
export const CT = new Proxy({}, { get: (_, k) => (_CT[k] ||= _CTF[k] && _CTF[k]()) });
function plankTextures() {
  const W = 256, H = 256, [c, g] = makeCanvas(W, H);
  const n = fbm(W, H, 4, 55), img = g.createImageData(W, H), height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, plank = Math.floor(y / 32), gap = (y % 32) < 2 ? 0 : 1;
    const grain = 0.5 + 0.5 * Math.sin(x * 0.25 + n[i] * 12 + plank * 3);
    height[i] = gap * (0.6 + grain * 0.3 + n[i] * 0.1);
    const v = gap ? 120 + grain * 40 + (n[i] - 0.5) * 30 + (plank % 3) * 8 : 40;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.72; img.data[i * 4 + 2] = v * 0.45; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: normalMapFrom(height, W, H, 2.5) };
}
function rockTextures() {
  const W = 512, H = 512, [c, g] = makeCanvas(W, H);
  const n = fbm(W, H, 6, 61), img = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const v = 70 + (n[i] - 0.5) * 90 + (Math.random() - 0.5) * 24; img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.95; img.data[i * 4 + 2] = v * 0.85; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return { map: tex(c), normalMap: normalMapFrom(n, W, H, 3.5) };
}

// ---------- matériaux et primitives ----------
export const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
export function pbr(t, extra = {}) { return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.95, metalness: 0, ...extra }); }
export function pbrRepeat(t, rx, ry, extra = {}) {
  const m = t.map.clone(), nm = t.normalMap.clone(); m.repeat.set(rx, ry); nm.repeat.set(rx, ry); m.needsUpdate = nm.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: m, normalMap: nm, roughness: 0.95, metalness: 0, ...extra });
}
// Échelle physique de la brique : la tuile de T.brick contient 8 briques × 8 assises.
// Brique flamande ≈ 22 cm de long, assise ≈ 7,5 cm avec le joint → tuile de 1,76 m × 0,60 m.
export const BRICK_TILE = { w: 1.76, h: 0.60 };
/** Matériau brique dont le motif est à l'échelle réelle pour une surface de w × h mètres. */
export function brickScaled(w, h, extra = {}) {
  return pbrRepeat(T.brick, Math.max(0.1, w) / BRICK_TILE.w, Math.max(0.1, h) / BRICK_TILE.h, extra);
}
export const brickMat = brickScaled(4, 4);

// =====================================================================
//  Matériaux photographiques (Poly Haven, CC0) — cf. BRIEF-DESIGN.md règle 3
// =====================================================================
// « tuile » = taille réelle du motif en mètres ; « repli » = teinte utilisée
// tant que la texture n'est pas chargée, ou si le fichier manque.
export const PH_BASE = 'assets_back/03_textures/polyhaven/';
// Les tuiles des trois briques sont calibrées : période verticale mesurée sur la texture
// (23,3 / 36,6 / 26,9 assises) × 7,5 cm d'assise réelle.
export const PH = {
  church_bricks_03:       { tuile: 2.75,  maps: ['couleur', 'normale', 'rugosite'], repli: 0xa98a78 },
  stacked_brick_wall:     { tuile: 1.75,  maps: ['couleur', 'normale', 'rugosite'], repli: 0x9c5540 },
  red_bricks_02:          { tuile: 2.05,  maps: ['couleur', 'normale', 'rugosite'], repli: 0x8c7c68 },
  grass_ground:           { tuile: 2.6,  maps: ['couleur', 'normale', 'rugosite'], repli: 0x6f7a4c },
  withered_grass:         { tuile: 2.4,  maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a9064 },
  brown_mud_03:           { tuile: 2.0,  maps: ['couleur', 'normale'],             repli: 0x5b4b39 },
  rocks_ground_08:        { tuile: 2.0,  maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a7a66 },
  wood_planks:            { tuile: 2.0,  maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a6a48 },
  hinoki_planks:          { tuile: 1.5,  maps: ['couleur', 'normale', 'rugosite'], repli: 0xc0a074 },
  wood_cabinet_worn_long: { tuile: 2.0,  maps: ['couleur', 'normale', 'rugosite'], repli: 0x6a4428 },
  worn_tile_floor:        { tuile: 1.6,  maps: ['couleur', 'normale', 'rugosite'], repli: 0x6a6a66 },
  metal_plate_02:         { tuile: 2.0,  maps: ['couleur', 'normale', 'rugosite', 'metal'], repli: 0x4a4038 },
  fabric_pattern_07:      { tuile: 0.45, maps: ['couleur', 'normale', 'rugosite'], repli: 0xa8403a },
  // v24 — téléchargements du 20/09 : toitures, murs de pierre, sols
  clay_roof_tiles:        { tuile: 4.2, maps: ['couleur', 'normale', 'rugosite'], repli: 0x59331c },
  clay_roof_tiles_02:     { tuile: 3.9, maps: ['couleur', 'normale', 'rugosite'], repli: 0x92502b },
  old_stone_wall_02:      { tuile: 2.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x867662 },
  rock_wall_14:           { tuile: 2.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x7d735b },
  rock_wall_17:           { tuile: 2.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x594a38 },
  rocky_trail:            { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x93806b },
  forest_leaves_02:       { tuile: 1.8, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8e703a },
  withered_grass:         { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0xac9379 },
  // v25 — pack « Pine Fir Forest » (Poly Haven) : écorces, sols de sous-bois, ruines
  pine_bark:              { tuile: 1.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x5b4a3a },
  fir_bark:               { tuile: 1.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x4d443a },
  pine_trunk_01:          { tuile: 2.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6a5744 },
  pine_trunk_02:          { tuile: 2.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x63513f },
  fir_trunk_01:           { tuile: 2.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x584a3c },
  tree_trunk:             { tuile: 2.2, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6b5a46 },
  tree_roots_01:          { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x5f4e3c },
  dead_tree_tiled:        { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a7c66 },
  dry_branches_01:        { tuile: 1.5, maps: ['couleur', 'normale', 'rugosite'], repli: 0x7a6a52 },
  forest_ground_04:       { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6f6252 },
  forest_leaves_04:       { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a6a42 },
  pine_cover_01:          { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x7a6850 },
  mousse:                 { tuile: 1.0, maps: ['couleur', 'rugosite'],            repli: 0x4c5c33 },
  rock_moss_01:           { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6e6a58 },
  rock_moss_02:           { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6a6656 },
  ruines_01:              { tuile: 2.4, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8d8574 },
  ruines_02:              { tuile: 2.4, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a8272 },
  ruines_03:              { tuile: 2.4, maps: ['couleur', 'normale', 'rugosite'], repli: 0x877f6f },
  // v25 — pack « Verdant Trail » (Poly Haven) : rochers, parois, terre battue
  rocher_01:              { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8f8574 },
  paroi_rocheuse:         { tuile: 2.6, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a8070 },
  paroi_rocheuse_2:       { tuile: 2.6, maps: ['couleur', 'normale', 'rugosite'], repli: 0x847a6a },
  falaise_mousse:         { tuile: 3.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x6f7358 },
  falaise_02:             { tuile: 3.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x7d7566 },
  roche_cotiere:          { tuile: 2.4, maps: ['couleur', 'normale', 'rugosite'], repli: 0x877e6e },
  terre_battue:           { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8a7458 },
  racine_01:              { tuile: 1.6, maps: ['couleur', 'normale', 'rugosite'], repli: 0x5f4e3c },
  tronc_mort_02:          { tuile: 2.0, maps: ['couleur', 'normale', 'rugosite'], repli: 0x7d7160 },
  // v26 — pack « Hidden Alley » : seuls les quatre matériaux compatibles XVIIe
  enduit_gris:            { tuile: 2.4, maps: ['couleur', 'normale', 'rugosite'], repli: 0x8e9080 },
  chaux_craquelee:        { tuile: 2.4, maps: ['couleur', 'normale', 'rugosite'], repli: 0xcfc6b4 },
  gravier:                { tuile: 1.6, maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a8d78 },
  brique_rouge_06:        { tuile: 2.2, maps: ['couleur', 'normale', 'rugosite'], repli: 0x9a5a42 },
};
const phCache = new Map();
function phTex(slug, map) {
  const k = slug + '/' + map;
  if (!phCache.has(k)) {
    const t = chargerTexture(PH_BASE + slug + '/' + map + '.webp', () => console.warn('texture Poly Haven absente :', k));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (map === 'couleur') t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    phCache.set(k, t);
  }
  return phCache.get(k);
}
/**
 * Matériau Poly Haven à l'échelle physique.
 * uSize / vSize : la taille réelle, en mètres, que couvre l'intervalle UV 0..1 de la géométrie.
 *   - BoxGeometry / RoundedBox  -> (largeur de la face, hauteur de la face)
 *   - ExtrudeGeometry           -> (1, 1)      les UV sont déjà en unités monde
 *   - flatMesh()                -> (100, 100)  les UV valent position / 100
 */
export function phMat(slug, uSize, vSize, extra = {}) {
  const d = PH[slug];
  if (!d) { console.warn('matériau Poly Haven inconnu :', slug); return mat(0x888888); }
  const rx = Math.max(0.01, uSize) / d.tuile, ry = Math.max(0.01, vSize) / d.tuile;
  const m = new THREE.MeshStandardMaterial({ color: d.repli, roughness: 1, metalness: 0, ...extra });
  m.userData.ph = slug;          // de quoi retrouver la teinte de repli quand la texture manque
  for (const k of d.maps) {
    const t = phTex(slug, k).clone();          // la source est partagée : un seul envoi GPU
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true;
    if (k === 'couleur') { m.map = t; if (extra.color === undefined) m.color.setHex(0xffffff); }
    else if (k === 'normale') m.normalMap = t;
    else if (k === 'rugosite') m.roughnessMap = t;
    else if (k === 'metal') { m.metalnessMap = t; m.metalness = 1; }
  }
  return m;
}

/**
 * Une matière Poly Haven qui porte un DESSIN : armoiries d'un écu, motif d'une enseigne.
 * Le dessin (un canevas) remplace la couleur de la matière ; son relief et sa rugosité
 * restent — le bois garde son grain sous la peinture, le fer ses rayures. Peint seul sur
 * un matériau uni, le même dessin faisait jouet à côté des murs photographiés (Eugène,
 * 27 septembre : « tu as tendance à créer des choses avec un thème cartoon »).
 */
export function phPeint(slug, uSize, vSize, dessin, extra = {}) {
  const m = phMat(slug, uSize, vSize, extra);
  m.map = dessin; m.color.setHex(0xffffff);
  return m;
}

// =====================================================================
//  Patine : variation à grande échelle sur les grandes surfaces
// =====================================================================
// Point 1 du BRIEF-DESIGN : à distance, un mur de brique de quarante mètres lit
// comme un aplat, quelle que soit la finesse de la texture, parce que le motif se
// répète à l'identique partout. On ne corrige pas ça en changeant de texture : il
// faut une variation dont la période est celle du BÂTIMENT, pas celle de la brique.
//
// Ce shader injecte quatre couches par-dessus l'albédo, toutes calées sur la
// position MONDE — donc continues d'un mesh à l'autre, sans couture aux angles :
//   1. macro-salissure    : taches lentes (période ~15 m) qui cassent l'aplat
//   2. humidité du pied   : le bas des murs boit, fonce et verdit
//   3. mousse             : là où l'humidité et la salissure se rencontrent
//   4. traînées de pluie  : coulures verticales sous les corniches
// Le tout ne coûte que deux lectures de texture et aucune géométrie.
let MACRO_TEX = null;
function macroTexture() {
  if (MACRO_TEX) return MACRO_TEX;
  const W = 512, [c, g] = makeCanvas(W, W);
  const tache = fbm(W, W, 6, 17), large = fbm(W, W, 3, 53), fin = fbm(W, W, 7, 91);
  const img = g.createImageData(W, W);
  for (let i = 0; i < W * W; i++) {
    const s = clamp(tache[i] * 0.62 + large[i] * 0.38, 0, 1);
    img.data[i * 4] = 255 * s;                                   // R : macro-salissure
    img.data[i * 4 + 1] = 255 * clamp(fin[i] * 0.7 + large[i] * 0.3, 0, 1);  // G : coulures
    img.data[i * 4 + 2] = 255 * clamp(large[i], 0, 1);           // B : plaques de mousse
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  MACRO_TEX = new THREE.CanvasTexture(c);
  MACRO_TEX.wrapS = MACRO_TEX.wrapT = THREE.RepeatWrapping;      // données, pas couleur : pas de sRGB
  return MACRO_TEX;
}

/**
 * Patine un matériau EN PLACE. Renvoie le matériau, pour chaîner.
 *   echelle : période de la macro-salissure, en mètres (≈ la taille du bâtiment)
 *   force   : profondeur des taches (0 = aucune, 1 = très sale)
 *   basY    : altitude du pied du mur, d'où part l'humidité
 *   humide  : hauteur sur laquelle l'humidité s'estompe, en mètres
 *   mousse  : teinte des plaques de mousse
 *   pluie   : intensité des coulures verticales
 */
export function patiner(m, opts = {}) {
  if (!m || m.userData.patine) return m;
  const o = {
    echelle: 15, force: 0.30, basY: 0, humide: 2.8, pluie: 0.22,
    mousse: 0x5f6f42, ...opts,
  };
  const carte = macroTexture(), mousse = new THREE.Color(o.mousse);
  m.userData.patine = true;
  // les réglages sont dans une fermeture, invisibles de l'extérieur : on les garde aussi en
  // clair, pour que la fusion ne réunisse pas deux murs patinés différemment (matKey)
  m.userData.patineOpts = JSON.stringify(o);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPatCarte = { value: carte };
    sh.uniforms.uPatEch = { value: o.echelle };
    sh.uniforms.uPatForce = { value: o.force };
    sh.uniforms.uPatBas = { value: o.basY };
    sh.uniforms.uPatHum = { value: o.humide };
    sh.uniforms.uPatPluie = { value: o.pluie };
    sh.uniforms.uPatMousse = { value: mousse };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPatPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPatPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPatPos;
        uniform sampler2D uPatCarte;
        uniform float uPatEch, uPatForce, uPatBas, uPatHum, uPatPluie;
        uniform vec3 uPatMousse;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // deux projections croisées : le mur garde sa variation quelle que soit son orientation
          vec2 uvA = vPatPos.xz / uPatEch;
          vec2 uvB = vec2(vPatPos.x + vPatPos.z, vPatPos.y) / (uPatEch * 0.55);
          vec3 ca = texture2D(uPatCarte, uvA).rgb;
          vec3 cb = texture2D(uPatCarte, uvB).rgb;
          float salis = mix(ca.r, cb.r, 0.55);
          diffuseColor.rgb *= 1.0 - uPatForce * (1.0 - salis);

          // humidité et mousse au pied du mur
          float bas = clamp(1.0 - (vPatPos.y - uPatBas) / max(0.05, uPatHum), 0.0, 1.0);
          bas *= bas;
          float plaque = smoothstep(0.42, 0.82, mix(ca.b, cb.b, 0.5));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, bas * 0.75);
          diffuseColor.rgb = mix(diffuseColor.rgb, uPatMousse, bas * plaque * 0.55);

          // coulures verticales : très étirées en Y, fines en X
          float coul = texture2D(uPatCarte, vec2((vPatPos.x + vPatPos.z) * 0.28, vPatPos.y * 0.012)).g;
          diffuseColor.rgb *= 1.0 - uPatPluie * smoothstep(0.58, 1.0, coul);
        }`);
    m.userData.shaderPatine = sh;
  };
  // une seule variante de programme pour toute la patine : les réglages sont des uniformes
  m.customProgramCacheKey = () => 'patine1';
  m.needsUpdate = true;
  return m;
}

export const stoneMat = pbr(T.stone, { roughness: 0.85, color: 0xb8b0a0 });
export const IRON = () => mat(0x3a3a40, { metalness: 0.85, roughness: 0.4 });
export const STEEL = () => mat(0xcfd6dd, { metalness: 0.9, roughness: 0.25 });
export const GOLD = () => mat(0xd9b24a, { metalness: 0.9, roughness: 0.3 });
export function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}
export const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const sphG = (r, s = 14) => new THREE.SphereGeometry(r, s, s);
export const capG = (r, l, s = 10) => new THREE.CapsuleGeometry(r, l, 4, s);
export function flatMesh(shape, m, y = 0) {
  const o = new THREE.Mesh(new THREE.ShapeGeometry(shape, 4), m);
  o.rotation.x = -Math.PI / 2; o.position.y = y; o.receiveShadow = true;
  const uv = o.geometry.attributes.uv, pos = o.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 100, pos.getY(i) / 100);
  return o;
}
export function extrudeMesh(shape, depth, bottomY, m) {
  const o = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), m);
  o.rotation.x = -Math.PI / 2; o.position.y = bottomY;
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
// boîte texturée entre deux points (murs) ; texture répétée en unités monde
/** Fusionne des géométries simples (positions + uv + index) en une seule.
 *  Indispensable dès qu'un décor se répète : cent vingt fenêtres à deux volets
 *  coûtent deux meshes au lieu de deux mille quatre cents. */
export function mergeParts(list) {
  const pos = [], uv = [], idx = []; let off = 0;
  for (const g of list) {
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array);
    idx.push(...Array.from(g.index.array).map(i => i + off)); off += g.attributes.position.count;
  }
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  ge.setIndex(idx); ge.computeVertexNormals();
  return ge;
}

/** UV EN MÈTRES. phMat(slug, 1, 1) crée un matériau dont la répétition vaut 1/tuile ;
 *  si les UV de la géométrie sont exprimés en mètres réels, la texture sort à l'échelle
 *  physique exacte — y compris dans un groupe agrandi. C'est aussi ce qui autorise la
 *  fusion : un ouvrage entier tient en quelques meshes. */
export function uvMeters(geo, uM, vM) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uM, uv.getY(i) * vM);
  return geo;
}

export function wallBox(ax, az, bx, bz, h, t, m, yBase = 0, texSet = T.brick) {
  const len = Math.hypot(bx - ax, bz - az);
  const o = new THREE.Mesh(new THREE.BoxGeometry(len, h, t),
    patiner(typeof texSet === 'string' ? phMat(texSet, len, h)
      : m.map ? pbrRepeat(texSet, len / (texSet === T.brick ? BRICK_TILE.w : 4), h / (texSet === T.brick ? BRICK_TILE.h : 4)) : m,
      { echelle: Math.max(12, len * 0.5), basY: yBase, humide: Math.min(3.2, h * 0.42) }));
  o.position.set((ax + bx) / 2, yBase + h / 2, (az + bz) / 2);
  o.rotation.y = -Math.atan2(bz - az, bx - ax);
  o.castShadow = true; o.receiveShadow = true;
  scene.add(o);
  return o;
}

// =====================================================================
//  Monde : collisions et hauteurs (générique, complété par chaque niveau)
// =====================================================================
export const world = {
  capsules: [],        // { ax, az, bx, bz, r, top? } obstacles (top = hauteur au-dessus de laquelle on passe)
  boxes: [],           // { x0, x1, z0, z1, top } volumes pleins (on marche dessus si on est assez haut)
  platforms: [],       // { x0, x1, z0, z1, h } ou rampes { ramp:true, x, z, dx, dz, len, w, h0, h1 }
  levelH: null,        // fonction (x,z) -> hauteur du terrain du niveau
  levelBlocked: null,  // fonction (x,z,r,flying,y) -> bool
  zoneName: () => '',
  bounds: null,        // fonction (x,z) -> bool (true = hors limites)
};
export function addCap(ax, az, bx, bz, r, top = Infinity) { cdirty = true; world.capsules.push({ ax, az, bx, bz, r, top }); return world.capsules[world.capsules.length - 1]; }

// ---------- index spatial des capsules ----------
// `blocked()` balayait la liste entière à chaque appel : avec une forêt de plusieurs
// milliers de troncs collisionnés, ça devient le poste le plus cher de la boucle.
// On range donc chaque capsule dans les cases d'une grille régulière, élargies de sa
// propre épaisseur plus une marge, et une requête ne regarde plus qu'une seule case.
const CCELL = 6, CPAD = 4.0;
let ccells = null, calways = [], cdirty = true;
export function indexCapsules() {
  const m = new Map(), always = [];
  for (const c of world.capsules) {
    const pad = c.r + CPAD;
    const gx0 = Math.floor((Math.min(c.ax, c.bx) - pad) / CCELL), gx1 = Math.floor((Math.max(c.ax, c.bx) + pad) / CCELL);
    const gz0 = Math.floor((Math.min(c.az, c.bz) - pad) / CCELL), gz1 = Math.floor((Math.max(c.az, c.bz) + pad) / CCELL);
    if (!Number.isFinite(gx0 + gz0 + gx1 + gz1) || (gx1 - gx0 + 1) * (gz1 - gz0 + 1) > 6000) { always.push(c); continue; }
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
      const k = gx * 100003 + gz; let a = m.get(k); if (!a) m.set(k, a = []); a.push(c);
    }
  }
  ccells = m; calways = always; cdirty = false;
  return { capsules: world.capsules.length, cases: m.size, horsGrille: always.length };
}
// capsules susceptibles de toucher un disque de rayon r centré en (x, z)
export function capsulesNear(x, z, r = 0) {
  if (cdirty) indexCapsules();
  if (r > CPAD) return world.capsules;                       // requête large : on ne peut pas garantir la case unique
  const a = ccells.get(Math.floor(x / CCELL) * 100003 + Math.floor(z / CCELL));
  if (!a) return calways;
  return calways.length ? a.concat(calways) : a;
}
export function addBox(x0, x1, z0, z1, top) { const b = { x0, x1, z0, z1, top }; world.boxes.push(b); return b; }
export function addPlatform(x0, x1, z0, z1, h) { const p = { x0, x1, z0, z1, h }; world.platforms.push(p); return p; }
export function addHelix(x, z, r0, r1, base, hTurn, turns, a0 = 0, cw = false) { const p = { helix: true, x, z, r0, r1, base, hTurn, turns, a0, cw }; world.platforms.push(p); return p; }
export function addRamp(x, z, dx, dz, len, w, h0, h1) { const p = { ramp: true, x, z, dx, dz, len, w, h0, h1 }; world.platforms.push(p); return p; }
// hauteur du sol sous (x,z), en tenant compte de la hauteur actuelle y (plateformes superposées)
export function getH(x, z, y = Infinity) {
  let h = world.levelH ? world.levelH(x, z) : 0;
  for (const b of world.boxes) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.top <= y + 0.6 && b.top > h) h = b.top;
  for (const p of world.platforms) {
    if (p.seg) { if (distSeg(x, z, p.ax, p.az, p.bx, p.bz) < p.w / 2 + 0.25 && p.h <= y + 0.6 && p.h > h) h = p.h; }
    else if (p.helix) {
      // escalier en colimaçon : hauteur = base + (angle/2π + tour) * hauteur par tour, entre r0 et r1 du centre
      const dx = x - p.x, dz = z - p.z, r = Math.hypot(dx, dz);
      if (r >= p.r0 - 0.2 && r <= p.r1 + 0.2) {
        let a = Math.atan2(dz, dx) - p.a0; a = ((a % TAU) + TAU) % TAU; if (p.cw) a = TAU - a;
        for (let k = 0; k <= p.turns; k++) { const ph = p.base + (a / TAU + k) * p.hTurn; if (ph <= p.base + p.turns * p.hTurn + 0.01 && ph <= y + 0.6 && ph > h) h = ph; }
      }
    }
    else if (p.ramp) {
      const lx = x - p.x, lz = z - p.z, s = lx * p.dx + lz * p.dz, t = -lx * p.dz + lz * p.dx;
      if (s >= 0 && s <= p.len && Math.abs(t) <= p.w / 2) { const ph = p.h0 + (p.h1 - p.h0) * s / p.len; if (ph <= y + 0.6 && ph > h) h = ph; }
    } else if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && p.h <= y + 0.6 && p.h > h) h = p.h;
  }
  return h;
}
export function blocked(x, z, r, flying, y = 0) {
  if (world.bounds && world.bounds(x, z)) return true;
  if (world.levelBlocked && world.levelBlocked(x, z, r, flying, y)) return true;
  for (const c of capsulesNear(x, z, r)) if (c.r > 0 && y < c.top && y > (c.bottom ?? -Infinity) && distSeg(x, z, c.ax, c.az, c.bx, c.bz) < c.r + r) return true; // r = 0 : grille ouverte, plus d'obstacle
  for (const b of world.boxes) if (y < b.top - 0.4 && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true;
  return false;
}
// déplacement avec glissement ; y = hauteur actuelle des pieds (permet de monter sur ce qui est ≤ 0.5 plus haut)
export function tryMove(pos, dx, dz, r, flying, maxStep = 0.5, noCliff = false) {
  const y = pos.y;
  const ok = (x, z) => { if (blocked(x, z, r, flying, y)) return false; if (flying) return true; const dh = getH(x, z, y) - y; return dh < maxStep && (!noCliff || dh > -2.5); };
  if (ok(pos.x + dx, pos.z + dz)) { pos.x += dx; pos.z += dz; return true; }
  if (ok(pos.x + dx, pos.z)) { pos.x += dx; return true; }
  if (ok(pos.x, pos.z + dz)) { pos.z += dz; return true; }
  return false;
}

// =====================================================================
//  Sons (WebAudio synthétisé)
// =====================================================================
export const SFX = (() => {
  let ctx;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f0, f1, dur, type = 'square', vol = 0.15) {
    try {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), c.currentTime + dur);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    } catch (e) { /* audio indisponible */ }
  }
  function noise(dur, vol = 0.2, freq = 1200) {
    try {
      const c = ac(), b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = c.createBufferSource(); s.buffer = b;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
      const g = c.createGain(); g.gain.value = vol;
      s.connect(f).connect(g).connect(c.destination); s.start();
    } catch (e) { /* audio indisponible */ }
  }
  // musique d'ambiance générative : nappe d'accords + basse, discrète
  let music = null, musicMode = 'day', muted = false;
  const CHORDS = { day: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [2, 5, 9, 12]], cave: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 1, 5, 8], [-5, -2, 2, 5]] };
  function startMusic(mode = 'day') {
    try {
      const c = ac(); musicMode = mode;
      if (music) return;
      const master = c.createGain(); master.gain.value = muted ? 0 : 0.055; master.connect(c.destination);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = mode === 'cave' ? 500 : 900; lp.connect(master);
      const voices = [];
      for (let v = 0; v < 4; v++) {
        const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
        o1.type = 'triangle'; o2.type = 'sine'; o2.detune.value = 6; g.gain.value = 0;
        o1.connect(g); o2.connect(g); g.connect(lp); o1.start(); o2.start(); voices.push({ o1, o2, g });
      }
      const bass = c.createOscillator(), bg = c.createGain(); bass.type = 'sine'; bg.gain.value = 0.5; bass.connect(bg); bg.connect(lp); bass.start();
      let step = 0;
      const base = mode === 'cave' ? 110 : 164.81; // la2 / mi3
      const tick = () => {
        const chord = CHORDS[musicMode][step % 4], t = c.currentTime;
        voices.forEach((vc, i) => { const f = base * Math.pow(2, chord[i] / 12) * (i === 3 ? 0.5 : 1); vc.o1.frequency.setTargetAtTime(f, t, 0.4); vc.o2.frequency.setTargetAtTime(f * 2.005, t, 0.4); vc.g.gain.setTargetAtTime(0.22 + (i % 2) * 0.05, t, 1.2); });
        bass.frequency.setTargetAtTime(base * Math.pow(2, chord[0] / 12) / 2, t, 0.3);
        step++;
      };
      tick(); music = { timer: setInterval(tick, mode === 'cave' ? 5200 : 4200), master };
    } catch (e) { /* pas de musique */ }
  }
  function toggleMute() { muted = !muted; if (music) music.master.gain.setTargetAtTime(muted ? 0 : 0.055, ac().currentTime, 0.2); return muted; }
  return {
    unlock: () => { try { ac(); } catch (e) {} },
    music: startMusic, toggleMute,
    chirp: () => { const f = 1800 + Math.random() * 1500; tone(f, f * (0.7 + Math.random() * 0.6), 0.07, 'sine', 0.05); setTimeout(() => tone(f * 1.1, f * 0.9, 0.06, 'sine', 0.04), 90); },
    step: () => noise(0.05, 0.05, 900),
    swing: () => noise(0.14, 0.25, 1500),
    hit: () => tone(320, 110, 0.12, 'square', 0.18),
    hurt: () => tone(200, 60, 0.3, 'sawtooth', 0.2),
    pickup: () => { tone(660, 660, 0.08, 'square', 0.12); setTimeout(() => tone(990, 990, 0.14, 'square', 0.12), 80); },
    kill: () => tone(520, 70, 0.35, 'triangle', 0.22),
    roar: () => { tone(80, 35, 1.0, 'sawtooth', 0.35); noise(0.8, 0.2, 300); },
    roll: () => noise(0.12, 0.1, 600),
    // la fauche : un froissement aigu et bref — l'herbe, pas l'air (le swing est plus grave)
    fauche: () => { noise(0.09, 0.16, 4200); setTimeout(() => noise(0.06, 0.08, 6000), 35); },
    // la pièce : un tintement de métal, plus clair que le ramassage
    piece: () => { tone(1320, 1320, 0.06, 'triangle', 0.10); setTimeout(() => tone(1760, 1760, 0.12, 'triangle', 0.09), 55); },
    // chaque dizaine d'écus : trois notes qui montent, qu'on reconnaît sans regarder le compteur
    dizaine: () => [988, 1319, 1760].forEach((f, i) => setTimeout(() => tone(f, f, 0.12, 'triangle', 0.11), i * 70)),
    stomp: () => { tone(60, 30, 0.5, 'sine', 0.4); noise(0.3, 0.3, 200); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, f, 0.28, 'square', 0.12), i * 150)),
    dead: () => [440, 370, 311, 220].forEach((f, i) => setTimeout(() => tone(f, f, 0.35, 'triangle', 0.15), i * 220)),
  };
})();

// =====================================================================

export const SKIN = 0xd8a986, SKIN_DARK = 0xc48f6c;
// =====================================================================
//  Architecture : volumes arrondis et moulures (pour sortir du « tout boîte »)
// =====================================================================
export const rboxG = (w, h, d, r = 0.12, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);
// profil de moulure (x = saillie, y = hauteur) : doucine, quart-de-rond, cavet…
export function mouldingProfile(kind = 'cyma', h = 0.3, p = 0.22) {
  const s = new THREE.Shape(); s.moveTo(0, 0);
  if (kind === 'cyma') { s.lineTo(p * 0.35, 0); s.quadraticCurveTo(p * 0.9, h * 0.15, p * 0.55, h * 0.5); s.quadraticCurveTo(p * 0.2, h * 0.85, p, h * 0.92); s.lineTo(p, h); s.lineTo(0, h); }
  else if (kind === 'ovolo') { s.lineTo(p, 0); s.quadraticCurveTo(p, h, 0, h); }
  else if (kind === 'cavet') { s.lineTo(p, 0); s.lineTo(p, h * 0.2); s.quadraticCurveTo(p * 0.1, h * 0.3, 0, h); }
  else if (kind === 'fillet') { s.lineTo(p, 0); s.lineTo(p, h); s.lineTo(0, h); }
  else if (kind === 'torus') { s.absarc(0, h / 2, h / 2, -Math.PI / 2, Math.PI / 2, false); s.lineTo(0, h); }
  s.closePath(); return s;
}
// moulure droite entre deux points (saillie vers l'extérieur = côté « n »), posée à la hauteur y
export function mouldingRun(ax, az, bx, bz, y, kind, h, p, m, nx, nz) {
  const len = Math.hypot(bx - ax, bz - az);
  const g = new THREE.ExtrudeGeometry(mouldingProfile(kind, h, p), { depth: len, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -len / 2);
  const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true;
  // l'extrusion suit z ; la saillie (x du profil) doit pointer vers (nx,nz)
  o.rotation.y = Math.atan2(-nz, nx);
  o.position.set((ax + bx) / 2, y, (az + bz) / 2);
  return o;
}
// corniche complète (moulure + larmier) tout autour d'un rectangle centré (cx,cz), demi-dimensions hw/hd, à la hauteur y
export function corniceAround(group, cx, y, cz, hw, hd, m, h = 0.35, p = 0.3, kind = 'cyma') {
  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, n = [Math.sign(mx) || 0, Math.sign(mz) || 0];
    const ext = p; // on prolonge de la saillie pour fermer les angles
    const dx = Math.sign(b[0] - a[0]), dz = Math.sign(b[1] - a[1]);
    group.add(mouldingRun(cx + a[0] - dx * ext, cz + a[1] - dz * ext, cx + b[0] + dx * ext, cz + b[1] + dz * ext, y, kind, h, p, m, n[0], n[1]));
  }
}
// pilastre / demi-colonne engagée : fût, base et chapiteau moulurés
export function pilaster(h, r, m, capM = m) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r * 1.08, h - r * 3, 12), m, 0, h / 2, 0));
  g.add(mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.5, r * 0.5, 12), capM, 0, r * 0.25, 0));
  g.add(mesh(new THREE.TorusGeometry(r * 1.15, r * 0.2, 6, 14), capM, 0, r * 0.7, 0).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.TorusGeometry(r * 1.1, r * 0.22, 6, 14), capM, 0, h - r * 1.4, 0).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.2, r * 0.7, 12), capM, 0, h - r * 0.8, 0));
  g.add(mesh(boxG(r * 3.2, r * 0.4, r * 3.2), capM, 0, h - r * 0.25, 0));
  return g;
}
// fenêtre en arc plein cintre avec encadrement mouluré, clef de voûte et appui
export function archWindow(w, h, m, frameM, opts = {}) {
  const g = new THREE.Group();
  const r = w / 2;
  g.add(mesh(new THREE.PlaneGeometry(w, h - r), m, 0, (h - r) / 2, 0));
  g.add(mesh(new THREE.CircleGeometry(r, 16, 0, Math.PI), m, 0, h - r, 0));
  for (const sx of [-1, 1]) g.add(mesh(rboxG(0.14, h - r + 0.05, 0.2, 0.05, 2), frameM, sx * (r + 0.07), (h - r) / 2, 0.05));
  g.add(mesh(new THREE.TorusGeometry(r + 0.06, 0.09, 8, 18, Math.PI), frameM, 0, h - r, 0.05));
  g.add(mesh(rboxG(0.28, 0.42, 0.24, 0.05, 2), frameM, 0, h + 0.02, 0.08)); // clef
  g.add(mesh(new THREE.ExtrudeGeometry(mouldingProfile('cyma', 0.16, 0.18), { depth: w + 0.5, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -(w + 0.5) / 2).rotateY(-Math.PI / 2), frameM, 0, -0.18, 0.02)); // appui
  if (opts.bars !== false) { g.add(mesh(boxG(w, 0.05, 0.03), frameM, 0, (h - r) * 0.5, 0.02)); g.add(mesh(boxG(0.05, h - r, 0.03), frameM, 0, (h - r) / 2, 0.02)); }
  if (opts.shutters) for (const sx of [-1, 1]) g.add(mesh(rboxG(w * 0.48, h - r + 0.1, 0.06, 0.02, 2), opts.shutters, sx * (r + 0.14 + w * 0.24), (h - r) / 2, 0.02));
  return g;
}
// lucarne sur un toit : petite façade avec fenêtre et toit à deux pans
export function dormer(w, h, wallM, roofM, winM) {
  const g = new THREE.Group();
  g.add(mesh(rboxG(w, h, 1.2, 0.06, 2), wallM, 0, h / 2, 0));
  g.add(mesh(new THREE.PlaneGeometry(w * 0.55, h * 0.6), winM, 0, h * 0.5, 0.61));
  g.add(mesh(boxG(w * 0.6, 0.05, 0.03), mat(0xf4efe4), 0, h * 0.5, 0.63)); g.add(mesh(boxG(0.05, h * 0.6, 0.03), mat(0xf4efe4), 0, h * 0.5, 0.63));
  const tri = new THREE.Shape(); tri.moveTo(-w / 2 - 0.2, 0); tri.lineTo(w / 2 + 0.2, 0); tri.lineTo(0, w * 0.55); tri.closePath();
  const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.5, bevelEnabled: false }), roofM); rf.position.set(0, h, -0.75); rf.castShadow = true; g.add(rf);
  return g;
}
// oriel (bow-window) en demi-cylindre avec fenêtres, moulures haut et bas
export function oriel(r, h, wallM, frameM, winM) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, h, 14, 1, false, -Math.PI / 2, Math.PI), wallM, 0, h / 2, 0));
  g.add(mesh(new THREE.CylinderGeometry(r + 0.18, r + 0.05, 0.35, 14, 1, false, -Math.PI / 2, Math.PI), frameM, 0, h + 0.17, 0));
  g.add(mesh(new THREE.CylinderGeometry(r + 0.05, r * 0.55, 0.9, 14, 1, false, -Math.PI / 2, Math.PI), frameM, 0, -0.45, 0));
  g.add(mesh(new THREE.TorusGeometry(r + 0.06, 0.07, 6, 16, Math.PI), frameM, 0, h * 0.42, 0).rotateX(Math.PI / 2).rotateZ(0));
  for (let k = -1; k <= 1; k++) { const a = k * 0.85; const wn = mesh(new THREE.PlaneGeometry(r * 0.7, h * 0.55), winM, Math.sin(a) * (r + 0.01), h * 0.55, Math.cos(a) * (r + 0.01)); wn.rotation.y = a; g.add(wn);
    const fr = mesh(boxG(r * 0.8, 0.06, 0.04), frameM, Math.sin(a) * (r + 0.03), h * 0.55, Math.cos(a) * (r + 0.03)); fr.rotation.y = a; g.add(fr); }
  return g;
}
// balcon : dalle moulurée, balustres tournés, main courante
export function balcony(w, depth, m, balM) {
  const g = new THREE.Group();
  g.add(mesh(rboxG(w, 0.22, depth, 0.06, 2), m, 0, 0, depth / 2));
  g.add(mesh(new THREE.ExtrudeGeometry(mouldingProfile('cyma', 0.2, 0.16), { depth: w, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -w / 2).rotateY(-Math.PI / 2), m, 0, -0.3, depth - 0.1));
  const n = Math.max(3, Math.round(w / 0.4));
  for (let k = 0; k <= n; k++) { const x = -w / 2 + k * w / n; g.add(mesh(new THREE.LatheGeometry([new THREE.Vector2(0.05, 0), new THREE.Vector2(0.09, 0.15), new THREE.Vector2(0.045, 0.35), new THREE.Vector2(0.075, 0.6), new THREE.Vector2(0.04, 0.85), new THREE.Vector2(0.06, 0.95)], 8), balM, x, 0.11, depth - 0.12)); }
  g.add(mesh(rboxG(w + 0.1, 0.1, 0.16, 0.04, 2), balM, 0, 1.1, depth - 0.12));
  for (const sx of [-1, 1]) g.add(mesh(rboxG(0.16, 0.1, depth, 0.04, 2), balM, sx * (w / 2), 1.1, depth / 2));
  return g;
}

// =====================================================================
//  Personnages (membres articulés : épaule, bras, coude, avant-bras, main, doigts / hanche, cuisse, genou, tibia, pied)
// =====================================================================
// =====================================================================
//  Anatomie détaillée (v20) : yeux (globe, iris, pupille, reflet, paupières, cils, sourcils), tête (crâne, mâchoire, menton,
//  pommettes, nez avec arête/pointe/narines, lèvres, oreilles avec conque, cou), bras (deltoïde, biceps, coude, avant-bras,
//  poignet, paume, 4 doigts à 2 phalanges, pouce), jambes (cuisse, rotule, mollet, cheville, botte avec semelle/talon/bout),
//  torse (poitrine, taille, hanches, clavicules). Tous les personnages humains passent par ces briques.
// =====================================================================
// profil de révolution (rayon, hauteur) → géométrie (axe y)
export function latheG(points, seg = 12) { return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
export function eyes(parent, y, z, spacing, size, iris = 0x3a6a4a, lidColor = null, opts = {}) {
  const { brow = 0x4a2f1a, lash = true, browThick = 0.028 } = opts;
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * spacing, y, z); parent.add(e);
    const w = mesh(sphG(size, 14), mat(0xf6f5f0, { roughness: 0.25 }), 0, 0, 0); w.scale.set(1, 0.9, 0.62); e.add(w);
    e.add(mesh(new THREE.TorusGeometry(size * 0.52, size * 0.1, 6, 16), mat(iris, { roughness: 0.3 }), 0, 0, size * 0.5)); // anneau de l'iris
    const ir = mesh(sphG(size * 0.55, 14), mat(iris, { roughness: 0.25, emissive: iris, emissiveIntensity: 0.15 }), 0, 0, size * 0.44); ir.scale.set(1, 1, 0.42); e.add(ir);
    const pu = mesh(sphG(size * 0.27, 10), mat(0x08080a, { roughness: 0.15 }), 0, 0, size * 0.63); pu.scale.set(1, 1, 0.45); e.add(pu);
    e.add(mesh(sphG(size * 0.11, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), -sx * size * 0.22, size * 0.24, size * 0.7)); // reflet
    if (lidColor !== null) {
      const lid = mesh(sphG(size * 1.06, 14, 10, 0, TAU, 0, Math.PI * 0.3), mat(lidColor, { roughness: 0.8 }), 0, size * 0.1, -size * 0.08); lid.scale.set(1.0, 0.75, 0.68); e.add(lid);
      const low = mesh(sphG(size * 1.04, 14, 10, 0, TAU, Math.PI * 0.74, Math.PI * 0.26), mat(lidColor, { roughness: 0.8 }), 0, -size * 0.04, -size * 0.08); low.scale.set(1.0, 0.75, 0.68); e.add(low);
      if (lash) { const l = mesh(new THREE.TorusGeometry(size * 0.8, size * 0.035, 5, 12, Math.PI * 0.7), mat(0x1a1210), 0, size * 0.12, size * 0.55); l.rotation.z = Math.PI * 0.15; l.scale.set(1, 0.7, 0.4); e.add(l); }
    }
    if (brow !== null) { const b = mesh(capG(browThick * 0.65, size * 1.0, 6), mat(brow, { roughness: 0.9 }), 0, size * 1.45, size * 0.25); b.rotation.z = Math.PI / 2 - sx * 0.15; b.rotation.y = sx * 0.3; e.add(b); }
  }
}
// tête complète ; opts : skin, hair (couleur), style ('spiky'|'short'|'long'|'bun'|'bald'|'bonnet'), beard, moustache, iris, hat
export function makeHead(opts = {}) {
  const { skin = SKIN, skinDark = SKIN_DARK, hair = 0x4a2f1a, style = 'short', beard = null, moustache = null, iris = 0x3a6a4a, r = 0.38, lips = 0x9a5a50, female = false } = opts;
  const g = new THREE.Group(); const sk = mat(skin, { roughness: 0.65 }), hm = mat(hair, { roughness: 0.75 });
  const skull = mesh(sphG(r, 20), sk, 0, r * 0.12, -r * 0.04); skull.scale.set(0.96, 1.0, 0.98); g.add(skull);          // crâne
  const jaw = mesh(sphG(r * 0.86, 16), sk, 0, -r * 0.3, r * 0.05); jaw.scale.set(0.9, 0.8, 0.9); g.add(jaw);              // mâchoire
  const chin = mesh(sphG(r * 0.32, 10), sk, 0, -r * 0.82, r * 0.5); chin.scale.set(1.1, 0.7, 0.8); g.add(chin);            // menton
  const bridge = mesh(capG(r * 0.055, r * 0.26, 6), sk, 0, r * 0.0, r * 0.92); bridge.rotation.x = -0.3; g.add(bridge);   // arête du nez
  const tip = mesh(sphG(r * 0.1, 10), sk, 0, -r * 0.2, r * 0.98); tip.scale.set(1.1, 0.85, 1); g.add(tip);                  // pointe
  for (const sx of [-1, 1]) { g.add(mesh(sphG(r * 0.065, 8), sk, sx * r * 0.1, -r * 0.23, r * 0.93)); g.add(mesh(sphG(r * 0.022, 5), mat(skinDark), sx * r * 0.075, -r * 0.28, r * 0.99)); } // ailes et narines
  const loLip = mesh(new THREE.TorusGeometry(r * 0.15, r * 0.032, 6, 12, Math.PI), mat(lips, { roughness: 0.5 }), 0, -r * 0.5, r * 0.9); loLip.rotation.x = Math.PI; loLip.scale.set(1, 0.45, 0.6); g.add(loLip); // lèvre inférieure
  const line = mesh(new THREE.TorusGeometry(r * 0.16, r * 0.012, 4, 12, Math.PI), mat(0x6a3a36), 0, -r * 0.5, r * 0.94); line.rotation.x = Math.PI; line.scale.set(1, 0.35, 0.5); g.add(line); // bouche fermée, léger sourire
  for (const sx of [-1, 1]) { const ear = new THREE.Group(); ear.position.set(sx * r * 0.98, r * 0.02, -r * 0.05); g.add(ear);
    const o = mesh(sphG(r * 0.17, 10), sk, 0, 0, 0); o.scale.set(0.45, 1, 0.8); ear.add(o); const inn = mesh(sphG(r * 0.1, 8), mat(skinDark), sx * r * 0.02, 0, r * 0.02); inn.scale.set(0.35, 0.8, 0.6); ear.add(inn); }
  eyes(g, r * 0.1, r * 0.87, r * 0.34, r * 0.165, iris, skin, { brow: hair, lash: female });
  g.add(mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.34, r * 0.55, 12), sk, 0, -r * 1.05, -r * 0.05));                    // cou
  // cheveux
  if (style === 'spiky') { const cap = mesh(sphG(r * 1.02, 18, 12, 0, TAU, 0, Math.PI * 0.5), hm, 0, r * 0.4, -r * 0.08); g.add(cap); // calotte : le front reste dégagé
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, st = mesh(capG(r * 0.1, r * 0.4, 6), hm, Math.cos(a) * r * 0.55, r * 1.05 + rand(-0.02, 0.05), Math.sin(a) * r * 0.55 - r * 0.06); st.rotation.set(Math.sin(a) * 0.9 + rand(-0.15, 0.15), 0, -Math.cos(a) * 0.9 + rand(-0.15, 0.15)); g.add(st); }
    for (let i = -1; i <= 1; i++) { const fr = mesh(capG(r * 0.09, r * 0.3, 6), hm, i * r * 0.3, r * 0.92, r * 0.72); fr.rotation.x = 1.15; fr.rotation.z = -i * 0.3; g.add(fr); }
    for (const sx of [-1, 1]) g.add(mesh(capG(r * 0.09, r * 0.35, 6), hm, sx * r * 0.92, r * 0.35, -r * 0.1)); }
  else if (style === 'short') { const cap = mesh(sphG(r * 1.02, 18, 12, 0, TAU, 0, Math.PI * 0.5), hm, 0, r * 0.38, -r * 0.08); g.add(cap); for (let i = -2; i <= 2; i++) { const fr = mesh(capG(r * 0.09, r * 0.28, 6), hm, i * r * 0.28, r * 0.95, r * 0.7); fr.rotation.x = 1.15; g.add(fr); } for (const sx of [-1, 1]) g.add(mesh(capG(r * 0.12, r * 0.5, 6), hm, sx * r * 0.95, r * 0.15, -r * 0.1)); }
  else if (style === 'long') { const cap = mesh(sphG(r * 1.05, 18, 12, 0, TAU, 0, Math.PI * 0.5), hm, 0, r * 0.3, -r * 0.08); g.add(cap); for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.225, ln = mesh(capG(r * 0.14, r * 1.3, 6), hm, Math.sin(a) * r * 0.9, -r * 0.3, -Math.cos(a) * r * 0.75); ln.rotation.z = -Math.sin(a) * 0.2; g.add(ln); } for (let i = -2; i <= 2; i++) { const fr = mesh(capG(r * 0.12, r * 0.35, 6), hm, i * r * 0.3, r * 0.9, r * 0.7); fr.rotation.x = 1.0; g.add(fr); } }
  else if (style === 'bun') { g.add(mesh(sphG(r * 1.04, 18, 12, 0, TAU, 0, Math.PI * 0.5), hm, 0, r * 0.3, -r * 0.08)); g.add(mesh(sphG(r * 0.42, 12), hm, 0, r * 0.9, -r * 0.75)); g.add(mesh(new THREE.TorusGeometry(r * 0.42, r * 0.05, 6, 16), mat(0x8a3a4a), 0, r * 0.9, -r * 0.75)); }
  else if (style === 'bonnet') { g.add(mesh(sphG(r * 1.08, 18, 12, 0, TAU, 0, Math.PI * 0.5), mat(opts.bonnet || 0xf0e6d0, { roughness: 1 }), 0, r * 0.32, -r * 0.05)); g.add(mesh(new THREE.TorusGeometry(r * 1.0, r * 0.08, 6, 20), mat(opts.bonnet || 0xf0e6d0, { roughness: 1 }), 0, r * 0.3, -r * 0.05).rotateX(Math.PI / 2)); for (let i = -1; i <= 1; i++) { const fr = mesh(capG(r * 0.1, r * 0.3, 6), hm, i * r * 0.3, r * 0.8, r * 0.72); fr.rotation.x = 1.2; g.add(fr); } }
  else if (style === 'bald') { for (const sx of [-1, 1]) g.add(mesh(capG(r * 0.16, r * 0.5, 6), mat(0xb0b0b0), sx * r * 0.95, r * 0.05, -r * 0.15)); }
  if (beard) { const bd = mesh(sphG(r * 0.75, 14, 10, 0, TAU, Math.PI * 0.45, Math.PI * 0.4), mat(beard, { roughness: 0.9 }), 0, -r * 0.35, r * 0.15); bd.scale.set(1, 1.1, 1); g.add(bd); for (let i = -1; i <= 1; i++) { const t = mesh(capG(r * 0.12, r * 0.4, 6), mat(beard, { roughness: 0.9 }), i * r * 0.25, -r * 1.05, r * 0.55); g.add(t); } }
  if (moustache) for (const sx of [-1, 1]) { const m = mesh(capG(r * 0.06, r * 0.22, 6), mat(moustache, { roughness: 0.9 }), sx * r * 0.15, -r * 0.4, r * 0.93); m.rotation.z = Math.PI / 2 - sx * 0.35; g.add(m); }
  g.userData = { skull };
  return g;
}
// bras articulé : épaule (deltoïde) → biceps → coude → avant-bras → poignet → main (paume, 4 doigts à 2 phalanges, pouce)
export function makeArm(sx, opts) {
  const { skin, sleeve, glove = null, scale = 1, upperR = 0.11, upperL = 0.28, foreR = 0.095, foreL = 0.28, cuff = null } = opts;
  const S = scale, sh = new THREE.Group(); sh.rotation.order = 'YXZ';
  sh.add(mesh(sphG(upperR * 1.3 * S, 12), sleeve, 0, 0.01 * S, 0)); // deltoïde
  sh.add(mesh(latheG([[upperR * 1.05, 0], [upperR * 1.12, -upperL * 0.35], [upperR * 0.95, -upperL * 0.75], [upperR * 0.8, -upperL - 0.06]], 12), sleeve, 0, -0.06 * S, 0)); // biceps/triceps
  if (cuff) sh.add(mesh(new THREE.TorusGeometry(upperR * 0.85 * S, upperR * 0.18 * S, 6, 14), cuff, 0, -(upperL + 0.05) * S, 0).rotateX(Math.PI / 2));
  const elbow = new THREE.Group(); elbow.position.y = -(upperL + 0.14) * S; elbow.rotation.x = -0.35;
  elbow.add(mesh(sphG(upperR * 0.9 * S, 12), skin, 0, 0, 0)); // coude
  elbow.add(mesh(latheG([[foreR * 1.0, 0], [foreR * 1.08, -foreL * 0.3], [foreR * 0.8, -foreL * 0.8], [foreR * 0.62, -foreL - 0.04]], 12), skin, 0, -0.05 * S, 0)); // avant-bras → poignet
  const hand = new THREE.Group(); hand.position.y = -(foreL + 0.14) * S;
  const hm = glove || skin;
  hand.add(mesh(sphG(foreR * 0.62 * S, 8), hm, 0, 0.03 * S, 0)); // poignet
  const palm = mesh(rboxG(0.13 * S, 0.14 * S, 0.055 * S, 0.02 * S, 2), hm, 0, -0.05 * S, 0); hand.add(palm);
  for (let f = 0; f < 4; f++) { const fx = (f - 1.5) * 0.034 * S, len = [0.06, 0.07, 0.066, 0.052][f] * S;
    const p1 = new THREE.Group(); p1.position.set(fx, -0.12 * S, 0); p1.rotation.x = -0.2; hand.add(p1);
    p1.add(mesh(sphG(0.019 * S, 6), hm, 0, 0, 0)); p1.add(mesh(capG(0.017 * S, len * 0.55, 5), hm, 0, -len * 0.4, 0)); // articulation + 1re phalange
    const p2 = new THREE.Group(); p2.position.y = -len * 0.75; p2.rotation.x = -0.35; p1.add(p2);
    p2.add(mesh(sphG(0.016 * S, 6), hm, 0, 0, 0)); p2.add(mesh(capG(0.015 * S, len * 0.45, 5), hm, 0, -len * 0.35, 0)); }
  const th1 = new THREE.Group(); th1.position.set(sx * 0.07 * S, -0.04 * S, 0.02 * S); th1.rotation.z = -sx * 0.9; th1.rotation.x = -0.3; hand.add(th1);
  th1.add(mesh(sphG(0.021 * S, 6), hm, 0, 0, 0)); th1.add(mesh(capG(0.019 * S, 0.035 * S, 5), hm, 0, -0.03 * S, 0));
  const th2 = new THREE.Group(); th2.position.y = -0.055 * S; th2.rotation.x = -0.4; th1.add(th2); th2.add(mesh(capG(0.016 * S, 0.03 * S, 5), hm, 0, -0.02 * S, 0));
  elbow.add(hand); sh.add(elbow);
  sh.userData = { elbow, hand };
  return sh;
}
// jambe articulée : hanche → cuisse → rotule → tibia/mollet → cheville → botte (tige, semelle, talon, bout, lacets)
export function makeLeg(sx, opts) {
  const { cloth, boot, scale = 1, thighR = 0.14, thighL = 0.3, shinR = 0.12, shinL = 0.28, sole = null } = opts;
  const S = scale, hip = new THREE.Group();
  hip.add(mesh(sphG(thighR * 1.05 * S, 12), cloth, 0, -0.02 * S, 0)); // hanche
  hip.add(mesh(latheG([[thighR * 1.02, 0], [thighR * 1.05, -thighL * 0.3], [thighR * 0.92, -thighL * 0.7], [thighR * 0.8, -thighL - 0.08]], 12), cloth, 0, -0.05 * S, 0)); // cuisse
  const knee = new THREE.Group(); knee.position.y = -(thighL + 0.15) * S;
  knee.add(mesh(sphG(thighR * 0.85 * S, 12), cloth, 0, 0, 0)); knee.add(mesh(sphG(thighR * 0.4 * S, 8), cloth, 0, 0.01 * S, thighR * 0.62 * S)); // genou + rotule
  knee.add(mesh(latheG([[shinR * 0.95, 0], [shinR * 1.12, -shinL * 0.3], [shinR * 0.9, -shinL * 0.7], [shinR * 0.72, -shinL - 0.02]], 12), boot, 0, -0.04 * S, 0)); // mollet → cheville
  const soleM = sole || mat(0x2a1a10, { roughness: 0.9 });
  const foot = new THREE.Group(); foot.position.set(0, -(shinL + 0.12) * S, 0); knee.add(foot);
  foot.add(mesh(sphG(shinR * 0.8 * S, 10), boot, 0, 0.02 * S, 0)); // cheville
  foot.add(mesh(rboxG(0.24 * S, 0.12 * S, 0.38 * S, 0.04 * S, 2), boot, 0, -0.06 * S, 0.08 * S)); // empeigne
  foot.add(mesh(sphG(0.11 * S, 10), boot, 0, -0.07 * S, 0.26 * S)); // bout arrondi
  foot.add(mesh(rboxG(0.26 * S, 0.04 * S, 0.42 * S, 0.015 * S, 2), soleM, 0, -0.13 * S, 0.09 * S)); // semelle
  foot.add(mesh(boxG(0.22 * S, 0.05 * S, 0.12 * S), soleM, 0, -0.1 * S, -0.06 * S)); // talon
  for (let k = 0; k < 3; k++) foot.add(mesh(boxG(0.16 * S, 0.012 * S, 0.02 * S), mat(0x1a1210), 0, 0.02 * S - k * 0.03 * S, 0.14 * S + k * 0.03 * S)); // lacets
  hip.add(knee);
  hip.userData = { knee, foot };
  return hip;
}
// torse : bassin, taille, cage thoracique, épaules/clavicules ; renvoie un groupe (origine aux hanches)
export function makeTorso(opts = {}) {
  const { top, bottom, belt = null, skin = SKIN, width = 1, female = false } = opts;
  const g = new THREE.Group();
  g.add(mesh(latheG([[0.3 * width, 0], [0.34 * width, 0.12], [0.3 * width, 0.28], [0.27 * width, 0.36]], 14), bottom, 0, 0.9, 0));            // bassin
  g.add(mesh(latheG([[0.27 * width, 0], [0.26 * width, 0.15], [0.31 * width, 0.42], [0.36 * width, 0.62], [0.37 * width, 0.75], [0.3 * width, 0.86], [0.18 * width, 0.9]], 14), top, 0, 1.26, 0)); // taille → poitrine → épaules
  if (female) for (const sx of [-1, 1]) { const b = mesh(sphG(0.11 * width, 10), top, sx * 0.13 * width, 1.78, 0.24 * width); b.scale.set(1, 0.9, 0.7); g.add(b); }
  for (const sx of [-1, 1]) { const cl = mesh(capG(0.035, 0.22 * width, 6), top, sx * 0.17 * width, 2.05, 0.2 * width); cl.rotation.z = Math.PI / 2 - sx * 0.25; g.add(cl); } // clavicules
  if (belt) { g.add(mesh(new THREE.TorusGeometry(0.29 * width, 0.05, 6, 18), belt, 0, 1.26, 0).rotateX(Math.PI / 2)); g.add(mesh(boxG(0.1, 0.07, 0.04), GOLD(), 0, 1.26, 0.31 * width)); }
  return g;
}

export function makeCamille() {
  const root = new THREE.Group();
  const pivot = new THREE.Group(); pivot.position.y = 1.1; root.add(pivot);
  const body = new THREE.Group(); body.position.y = -1.1; pivot.add(body);
  const skin = mat(SKIN, { roughness: 0.7 }), tunic = mat(0x3f6f88, { roughness: 0.8 }), leather = mat(0x5a3a22, { roughness: 0.6 }), cloth = mat(0xb9a27c, { roughness: 0.9 });
  const hair = mat(0x4a2f1a, { roughness: 0.7 });
  // torse anatomique (bassin, taille, poitrine, clavicules) habillé d'une tunique, jupe-tunique, ceinture, baudrier, foulard
  const torso = makeTorso({ top: tunic, bottom: cloth, belt: leather, female: true, width: 1.0 }); torso.position.y = -0.02; body.add(torso);
  body.add(mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.42, 14, 1, true), mat(0x3f6f88, { side: THREE.DoubleSide, roughness: 0.8 }), 0, 1.05, 0));
  for (let k = 0; k < 6; k++) { const pl = mesh(boxG(0.03, 0.4, 0.02), mat(0x35607a), Math.cos(k * TAU / 6) * 0.4, 1.05, Math.sin(k * TAU / 6) * 0.4); pl.rotation.y = -k * TAU / 6; body.add(pl); } // plis de la tunique
  const pouch = mesh(rboxG(0.22, 0.18, 0.12, 0.03, 2), leather, 0.33, 1.2, 0.28); pouch.rotation.y = -0.5; body.add(pouch); body.add(mesh(boxG(0.2, 0.06, 0.13), leather, 0.33, 1.29, 0.28).rotateY(-0.5));
  const strap = mesh(boxG(0.12, 1.0, 0.04), leather, 0, 1.57, 0.37); strap.rotation.z = 0.6; body.add(strap); for (let k = 0; k < 4; k++) body.add(mesh(sphG(0.014, 5), GOLD(), -0.25 + k * 0.17, 1.28 + k * 0.2, 0.39)); // rivets
  const collar = mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 14), mat(0x8a3a2a, { roughness: 0.9 }), 0, 1.98, 0); collar.rotation.x = Math.PI / 2; body.add(collar);
  const scarfTail = mesh(boxG(0.16, 0.5, 0.03), mat(0x8a3a2a, { roughness: 0.9 }), -0.12, 1.7, -0.3); scarfTail.rotation.x = 0.35; body.add(scarfTail);
  // tête détaillée
  const headG = makeHead({ skin: SKIN, hair: 0x4a2f1a, style: 'spiky', iris: 0x3a6a4a, r: 0.38, female: true }); headG.position.set(0, 2.42, 0); body.add(headG);
  const head = headG;
  // jambes articulées
  const legs = [], knees = [];
  for (const sx of [-1, 1]) {
    const hip = makeLeg(sx, { cloth, boot: leather }); hip.position.set(sx * 0.17, 0.92, 0);
    body.add(hip); legs.push(hip); knees.push(hip.userData.knee);
  }
  // bras articulés avec gants
  const arms = [], elbows = [], hands = [];
  for (const sx of [-1, 1]) {
    const sh = makeArm(sx, { skin, sleeve: tunic, glove: leather }); sh.position.set(sx * 0.46, 1.82, 0);
    body.add(sh); arms.push(sh); elbows.push(sh.userData.elbow); hands.push(sh.userData.hand);
  }
  // épée dans la main droite : lame effilée, garde, poignée, pommeau
  const sword = new THREE.Group(); sword.position.y = -0.08;
  const blade = mesh(new THREE.CylinderGeometry(0.075, 0.015, 1.5, 4), STEEL(), 0, -0.85, 0); blade.scale.z = 0.35; sword.add(blade);
  sword.add(mesh(boxG(0.42, 0.06, 0.1), mat(0x8a7a3a, { metalness: 0.8, roughness: 0.3 }), 0, -0.08, 0));
  sword.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), leather, 0, 0.1, 0));
  sword.add(mesh(sphG(0.07, 8), mat(0x8a7a3a, { metalness: 0.8, roughness: 0.3 }), 0, 0.28, 0));
  hands[1].add(sword); sword.visible = false;
  // bouclier rond en bois cerclé de fer sur l'avant-bras gauche
  const shield = new THREE.Group(); shield.position.set(0, -0.2, 0.18); shield.rotation.x = -Math.PI / 2;
  shield.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 18), pbrRepeat(T.plank, 1, 1), 0, 0, 0));
  shield.add(mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 18), IRON(), 0, 0.02, 0).rotateX(Math.PI / 2));
  shield.add(mesh(sphG(0.1, 10), IRON(), 0, 0.04, 0));
  elbows[0].add(shield);
  const bowBack = makeBow(); bowBack.position.set(0, 1.5, -0.42); bowBack.rotation.set(0, 0, 0.5); bowBack.visible = false; body.add(bowBack);
  const bowHand = makeBow(); bowHand.position.set(0, -0.05, 0); bowHand.rotation.set(0, Math.PI / 2, 0); bowHand.visible = false; hands[0].add(bowHand);
  root.userData = { pivot, body, legs, knees, arms, elbows, hands, head, bowBack, bowHand, shield, sword };
  root.rotation.order = 'YXZ';
  root.userData.dynamic = true;
  return root;
}
export function makeGiant(colorBody, colorHelm, weapon) {
  const g = new THREE.Group();
  const ogre = weapon === 'club';
  // 13 m de créature : c'est la surface la plus visible du jeu. Cuir à pores et
  // plis pour Phinaert, peau humaine pour Lydéric — plus aucune sphère lisse.
  const skin = ogre ? creatureMat(CT.cuirOgre, 2.2, 2.2, { color: 0xb8462e })
                    : creatureMat(CT.peauLisse, 2, 2, { color: 0xd8a986, roughness: 0.72 });
  const belly = mesh(sphG(2.1, 18), ogre ? skin : mat(colorBody), 0, 4.2, 0); belly.scale.set(1, 1.15, 0.85); g.add(belly);
  for (const sx of [-1, 1]) g.add(mesh(sphG(0.9, 12), ogre ? skin : mat(colorBody), sx * 1.7, 5.9, 0)); // épaules
  if (ogre) {
    g.add(mesh(new THREE.TorusGeometry(2.05, 0.35, 8, 20), mat(0x3a2a1a, { roughness: 0.9 }), 0, 2.9, 0).rotateX(Math.PI / 2));
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; g.add(mesh(new THREE.ConeGeometry(0.3, 1.1, 5), mat(0x5a4a3a, { roughness: 1 }), Math.cos(a) * 1.9, 2.2, Math.sin(a) * 1.6).rotateX(Math.PI)); }
    const pad = mesh(sphG(1.1, 12, 8), IRON(), 2.0, 6.2, 0); pad.scale.set(1, 0.6, 1); g.add(pad);
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(0.15, 0.6, 5), STEEL(), 2.0 + (i - 1) * 0.6, 6.8, (i - 1) * 0.3));
  } else {
    g.add(mesh(new THREE.TorusGeometry(2.05, 0.3, 8, 20), mat(0x6b4a2b, { roughness: 0.8 }), 0, 2.9, 0).rotateX(Math.PI / 2));
    g.add(mesh(boxG(2.2, 3.2, 0.3), mat(0xd9b24a, { roughness: 0.6, metalness: 0.2 }), 0, 4.2, 1.7));
    for (const sx of [-1, 1]) { const pd = mesh(sphG(0.95, 12, 8), mat(0xb8bcc4, { metalness: 0.9, roughness: 0.35 }), sx * 2.0, 6.2, 0); pd.scale.set(1, 0.6, 1); g.add(pd); }
  }
  // jambes articulées
  const legs = [];
  for (const sx of [-1, 1]) { const hip = makeLeg(sx, { cloth: mat(ogre ? 0x3a2a24 : 0x3a3a4a), boot: mat(0x2a2220), scale: 3.2 }); hip.position.set(sx * 1.0, 2.9, 0); g.add(hip); legs.push(hip); }
  const head = mesh(sphG(1.25, 18), skin, 0, 7.1, 0); head.scale.set(1, 1.05, 0.95); g.add(head);
  if (ogre) {
    for (const sx of [-1, 1]) { const horn = mesh(new THREE.ConeGeometry(0.3, 1.6, 8), mat(0xe8dcc0, { roughness: 0.5 }), sx * 0.9, 8.1, 0); horn.rotation.z = -sx * 0.9; horn.rotation.x = -0.3; g.add(horn); }
    for (const sx of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.3, 1.0, 6), skin, sx * 1.3, 7.2, 0); ear.rotation.z = -sx * Math.PI / 2; g.add(ear); }
    for (const sx of [-1, 1]) { const tusk = mesh(new THREE.ConeGeometry(0.14, 0.7, 6), mat(0xf0ead8), sx * 0.45, 6.55, 1.0); tusk.rotation.x = -0.4; g.add(tusk); }
    g.add(mesh(boxG(1.4, 0.35, 0.5), mat(0x3a1a12), 0, 6.5, 0.95));
    for (const sx of [-1, 1]) { g.add(mesh(sphG(0.26, 10), mat(0xf0e0c0, { roughness: 0.3 }), sx * 0.48, 7.35, 0.98)); g.add(mesh(sphG(0.15, 8), mat(0xffd23a, { emissive: 0xffa010, emissiveIntensity: 1.2 }), sx * 0.48, 7.35, 1.16)); g.add(mesh(sphG(0.06, 6), mat(0x100800), sx * 0.48, 7.35, 1.28)); const lid = mesh(sphG(0.29, 10, 8, 0, TAU, 0, Math.PI * 0.4), mat(0x8a2e1e), sx * 0.48, 7.42, 0.98); lid.rotation.x = -0.3 ; g.add(lid); }
    for (const sx of [-1, 1]) { const br = mesh(capG(0.09, 0.6, 6), mat(0x2a0e0a), sx * 0.48, 7.72, 1.12); br.rotation.z = Math.PI / 2 + sx * 0.45; g.add(br); }
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.ConeGeometry(0.06, 0.22, 5), mat(0xf0ead8), -0.5 + k * 0.33, 6.62, 1.12).rotateX(Math.PI)); // dents
    for (let k = 0; k < 5; k++) g.add(mesh(sphG(0.08, 6), mat(0x5a1a10), rand(-0.9, 0.9), rand(7.3, 8.1), rand(0.4, 0.9))); // verrues
    const nose = mesh(sphG(0.42, 10), mat(0x6a1e14), 0, 6.95, 1.15); nose.scale.set(1.3, 0.8, 1); g.add(nose);
    const scar = mesh(boxG(0.08, 0.9, 0.05), mat(0xd08070), -0.8, 7.3, 1.05); scar.rotation.z = 0.3; g.add(scar);
    g.add(mesh(new THREE.SphereGeometry(1.32, 14, 10, 0, TAU, 0, Math.PI / 2.4), IRON(), 0, 7.35, 0));
  } else {
    const helm = mesh(new THREE.SphereGeometry(1.35, 16, 10, 0, TAU, 0, Math.PI / 2), mat(colorHelm, { metalness: 0.9, roughness: 0.3 }), 0, 7.3, 0); g.add(helm);
    helm.add(mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.4, 8), mat(colorHelm, { metalness: 0.9, roughness: 0.3 }), 0, 1.6, 0));
    for (let i = 0; i < 5; i++) { const pl = mesh(capG(0.12, 0.6, 6), mat(0xc22a2a, { roughness: 0.9 }), 0, 2.4, -0.3 - i * 0.35); pl.rotation.x = 0.5 + i * 0.25; helm.add(pl); }
    helm.add(mesh(boxG(0.3, 1.4, 0.2), mat(colorHelm, { metalness: 0.9 }), 0, -0.2, 1.3));
    // visage de Lydéric : yeux détaillés, sourcils épais, nez fort, joues, bouche, grande barbe tressée, moustache
    eyes(g, 7.12, 1.02, 0.45, 0.19, 0x2a4a7a, 0xd8a986, { brow: 0x4a2a1a, browThick: 0.05 });
    g.add(mesh(capG(0.14, 0.5, 8), skin, 0, 7.05, 1.12).rotateX(-0.35)); const nz = mesh(sphG(0.34, 12), skin, 0, 6.8, 1.22); nz.scale.set(1.15, 0.85, 1); g.add(nz);
    for (const sx of [-1, 1]) { const ck = mesh(sphG(0.3, 10), skin, sx * 0.72, 6.8, 0.85); ck.scale.set(1, 0.7, 0.5); g.add(ck); }
    g.add(mesh(new THREE.TorusGeometry(0.28, 0.06, 6, 12, Math.PI), mat(0x8a4a44), 0, 6.42, 1.05).rotateX(Math.PI)); // sourire
    const bd = mesh(sphG(0.95, 14, 10, 0, TAU, Math.PI * 0.42, Math.PI * 0.45), mat(0x4a2a1a, { roughness: 0.95 }), 0, 6.55, 0.35); bd.scale.set(1, 1.3, 1); g.add(bd);
    for (let i = -1; i <= 1; i++) { g.add(mesh(capG(0.16, 0.9, 6), mat(0x4a2a1a, { roughness: 0.95 }), i * 0.35, 5.4, 0.85)); if (i === 0) g.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 10), GOLD(), 0, 5.0, 0.85)); }
    for (const sx of [-1, 1]) { const mo = mesh(capG(0.09, 0.45, 6), mat(0x4a2a1a), sx * 0.3, 6.5, 1.15); mo.rotation.z = Math.PI / 2 - sx * 0.4; g.add(mo); }
    for (const sx of [-1, 1]) { const ear = mesh(sphG(0.22, 8), skin, sx * 1.22, 7.05, 0); ear.scale.set(0.5, 1, 0.8); g.add(ear); }
  }
  // bras articulés
  const arms = [], hands = [], elbows = [];
  for (const sx of [-1, 1]) {
    const sh = makeArm(sx, { skin, sleeve: ogre ? skin : creatureMat(CT.membrane, 2, 2, { color: colorBody, roughness: 0.9 }), glove: ogre ? creatureMat(CT.cuirOgre, 1.5, 1.5, { color: 0x6a4630 }) : mat(0xb8bcc4, { metalness: 0.9, roughness: 0.35 }), scale: 3.4, upperR: 0.17, upperL: 0.3, foreR: 0.15, foreL: 0.3 }); sh.position.set(sx * 2.7, 5.9, 0);
    g.add(sh); arms.push(sh); hands.push(sh.userData.hand); elbows.push(sh.userData.elbow);
    sh.userData.elbow.add(mesh(new THREE.CylinderGeometry(0.56, 0.5, 0.9, 10), ogre ? mat(0x4a3020, { roughness: 0.8 }) : mat(0xb8bcc4, { metalness: 0.9, roughness: 0.35 }), 0, -1.1, 0)); // brassard
    if (ogre) for (let k = 0; k < 4; k++) { const a = k * TAU / 4; const sp = mesh(new THREE.ConeGeometry(0.1, 0.4, 5), STEEL(), Math.cos(a) * 0.6, -1.1, Math.sin(a) * 0.6); sp.rotation.z = -Math.cos(a) * Math.PI / 2; sp.rotation.x = Math.sin(a) * Math.PI / 2; sh.userData.elbow.add(sp); }
  }
  if (ogre) {
    const club = new THREE.Group(); club.position.y = -0.2;
    club.add(mesh(new THREE.CylinderGeometry(0.4, 0.65, 5, 9), pbrRepeat(T.bark, 1, 2), 0, -2.2, 0));
    club.add(mesh(sphG(1.05, 12), IRON(), 0, -4.6, 0));
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10, e = (i % 2) * 0.5 - 0.25; const sp = mesh(new THREE.ConeGeometry(0.16, 0.7, 5), STEEL(), Math.cos(a) * 1.05, -4.6 + e, Math.sin(a) * 1.05); sp.lookAt(0, -4.6 + e, 0); sp.rotateX(-Math.PI / 2); club.add(sp); }
    hands[1].add(club);
  } else {
    const sw = new THREE.Group(); sw.position.y = -0.2;
    const bl = mesh(new THREE.CylinderGeometry(0.28, 0.05, 6, 4), STEEL(), 0, -3.2, 0); bl.scale.z = 0.35; sw.add(bl);
    sw.add(mesh(boxG(1.6, 0.25, 0.4), GOLD(), 0, -0.1, 0));
    hands[1].add(sw);
  }
  g.userData = { arms, hands, elbows, legs };
  g.userData.dynamic = true;
  return g;
}
export function makeRat() {
  const g = new THREE.Group();
  // Fourrure et peau nue en vraies cartes : c'est le relief des poils, pas le
  // maillage, qui fait qu'un rat bas-poly cesse de ressembler à un galet.
  const fur = creatureMat(CT.pelageRat, 3, 3);
  const furV = creatureMat(CT.pelageRat, 3, 3, { color: 0xb9ab9a });   // ventre plus clair
  const pink = creatureMat(CT.peauNue, 1, 4);
  const pinkL = creatureMat(CT.peauLisse, 2, 2);
  // corps en deux masses : arrière-train haut, épaules plus basses, cou marqué
  const croupe = mesh(sphG(0.42, 14), fur, 0, 0.44, -0.22); croupe.scale.set(0.86, 0.86, 1.05); g.add(croupe);
  const tronc  = mesh(sphG(0.38, 14), fur, 0, 0.40, 0.28);  tronc.scale.set(0.82, 0.78, 1.15); g.add(tronc);
  const ventre = mesh(sphG(0.34, 12), furV, 0, 0.26, 0.05); ventre.scale.set(0.78, 0.5, 1.5); g.add(ventre);
  // tête : crâne + museau effilé, l'axe pique légèrement vers le sol
  const tete = new THREE.Group(); tete.position.set(0, 0.46, 0.72); tete.rotation.x = 0.18; g.add(tete);
  const crane = mesh(sphG(0.26, 14), fur, 0, 0, 0); crane.scale.set(0.82, 0.8, 1.05); tete.add(crane);
  const museau = mesh(new THREE.ConeGeometry(0.19, 0.46, 12), fur, 0, -0.05, 0.3); museau.rotation.x = Math.PI / 2; museau.scale.set(1, 1, 0.8); tete.add(museau);
  tete.add(mesh(sphG(0.055, 8), pinkL, 0, -0.08, 0.52));                                   // truffe
  for (const sx of [-1, 1]) {                                                               // oreilles en coupe
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.128, 12, 8, 0, TAU, 0, Math.PI / 2), pinkL);
    ear.material = pinkL; ear.scale.set(1, 0.3, 1); ear.position.set(sx * 0.195, 0.185, -0.04);
    ear.rotation.z = -sx * 0.55; ear.rotation.x = -0.25; ear.castShadow = true; tete.add(ear);
  }
  for (const sx of [-1, 1]) {                                                               // œil + paupière
    tete.add(mesh(sphG(0.058, 10), mat(0x1a0a0a, { roughness: 0.18 }), sx * 0.15, 0.03, 0.22));
    tete.add(mesh(sphG(0.026, 8), mat(0xff3020, { emissive: 0xff2010, emissiveIntensity: 1.6, roughness: 0.2 }), sx * 0.155, 0.035, 0.265));
  }
  for (const sx of [-1, 1]) tete.add(mesh(new THREE.ConeGeometry(0.028, 0.13, 4), mat(0xf4efdc, { roughness: 0.35 }), sx * 0.05, -0.14, 0.44).rotateX(Math.PI));
  {                                                                                         // vibrisses
    const vib = mat(0xb8b0a0, { transparent: true, opacity: 0.55, roughness: 0.4 });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      const v = mesh(new THREE.CylinderGeometry(0.0022, 0.001, rand(0.20, 0.30), 3), vib, sx * 0.085, -0.055 + i * 0.032, 0.40);
      v.rotation.z = -sx * (1.05 + i * 0.14); v.rotation.x = rand(-0.25, 0.25); tete.add(v);
    }
  }
  // queue : chaîne de segments qui s'affine, articulée pour onduler
  const tail = new THREE.Group(); tail.position.set(0, 0.36, -0.62);
  let par = tail;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group(); seg.position.z = i ? -0.20 : -0.08;
    const r = 0.042 * Math.pow(0.82, i);                       // effilement géométrique
    const m = mesh(capG(r, 0.19, 7), pink, 0, 0, -0.10); m.rotation.x = Math.PI / 2; seg.add(m);
    par.add(seg); par = seg;
  }
  tail.rotation.x = -0.25;
  g.add(tail);
  // pattes : avant courtes et repliées, arrière hautes et coudées
  const pattes = [];
  for (const sx of [-1, 1]) {
    const av = new THREE.Group(); av.position.set(sx * 0.24, 0.3, 0.42);
    av.add(mesh(capG(0.055, 0.18, 7), fur, 0, -0.1, 0));
    av.add(mesh(capG(0.042, 0.13, 6), pinkL, 0, -0.24, 0.04));
    const main = mesh(sphG(0.055, 7), pinkL, 0, -0.33, 0.07); main.scale.set(1, 0.6, 1.3); av.add(main);
    g.add(av); pattes.push(av);
    const ar = new THREE.Group(); ar.position.set(sx * 0.3, 0.42, -0.3);
    const cuisse = mesh(sphG(0.17, 10), fur, 0, -0.04, 0.02); cuisse.scale.set(0.7, 1, 0.9); ar.add(cuisse);
    ar.add(mesh(capG(0.05, 0.16, 7), fur, 0, -0.2, -0.04));
    const pied = mesh(capG(0.045, 0.16, 7), pinkL, 0, -0.34, 0.06); pied.rotation.x = 1.25; ar.add(pied);
    g.add(ar); pattes.push(ar);
  }
  g.userData.tail = tail;
  g.userData.tailSegs = (() => { const l = []; let n = tail; while (n.children.length && n.children[n.children.length - 1].isGroup) { n = n.children[n.children.length - 1]; l.push(n); } return l; })();
  g.userData.tete = tete;
  g.userData.pattes = pattes;
  g.userData.dynamic = true;
  return g;
}
export function makeBat() {
  const g = new THREE.Group();
  const fur = creatureMat(CT.pelageChauve, 2, 2);
  const membrane = creatureMat(CT.membrane, 1, 1, { side: THREE.DoubleSide, transparent: true, opacity: 0.94 });
  g.add(mesh(capG(0.18, 0.2, 10), fur, 0, 0, 0));
  g.add(mesh(sphG(0.17, 10), fur, 0, 0.22, 0.08));
  for (const sx of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.07, 0.2, 5), fur, sx * 0.1, 0.4, 0.05); g.add(ear); }
  for (const sx of [-1, 1]) g.add(mesh(sphG(0.035, 6), mat(0xffd020, { emissive: 0xffc020, emissiveIntensity: 1.5 }), sx * 0.07, 0.25, 0.22));
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 0.15, 0.1, 0);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.9 * sx, 0.35); shape.lineTo(1.3 * sx, 0.1); shape.lineTo(1.05 * sx, -0.25); shape.lineTo(0.7 * sx, -0.45); shape.lineTo(0.3 * sx, -0.3); shape.lineTo(0, -0.1);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), membrane); m.castShadow = true; w.add(m);
    for (const p of [[0.9, 0.35], [1.05, -0.25], [0.7, -0.45]]) { const bone = mesh(new THREE.CylinderGeometry(0.012, 0.02, Math.hypot(p[0], p[1]), 4), fur, p[0] * sx / 2, p[1] / 2, 0); bone.rotation.z = Math.atan2(p[1], p[0] * sx) - Math.PI / 2; w.add(bone); }
    g.add(w); wings.push(w);
  }
  g.userData.wings = wings;
  g.userData.dynamic = true;
  return g;
}
export function makeKey() {
  const g = new THREE.Group(), gold = GOLD();
  g.add(mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16), gold, 0, 0.45, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), gold, 0, -0.1, 0));
  g.add(mesh(boxG(0.22, 0.12, 0.06), gold, 0.1, -0.35, 0));
  g.add(mesh(boxG(0.14, 0.1, 0.06), gold, 0.06, -0.2, 0));
  g.userData.dynamic = true;
  return g;
}
export function makeGrille(w, h, bars = 7) {
  const g = new THREE.Group(), iron = IRON();
  for (let i = 0; i < bars; i++) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 8), iron, -w / 2 + (i + 0.5) * w / bars, h / 2, 0));
  for (const y of [0.3, h / 2, h - 0.3]) g.add(mesh(boxG(w, 0.12, 0.12), iron, 0, y, 0));
  for (let i = 0; i < bars; i++) g.add(mesh(new THREE.ConeGeometry(0.09, 0.25, 6), iron, -w / 2 + (i + 0.5) * w / bars, h + 0.12, 0));
  g.userData.dynamic = true;
  return g;
}
export function makeTorch() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 6), mat(0x4a3220), 0, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.2, 6), IRON(), 0, 0.42, 0));
  const flame = mesh(sphG(0.14, 8), new THREE.MeshBasicMaterial({ color: 0xffa030 }), 0, 0.62, 0); flame.scale.set(1, 1.6, 1); g.add(flame);
  const light = new THREE.PointLight(0xff9a40, 6, 14, 1.6); light.position.y = 0.7; g.add(light);
  g.userData = { flame, light, seed: rand(0, 10) };
  g.userData.dynamic = true;
  return g;
}
export function makeLever() {
  const g = new THREE.Group();
  g.add(mesh(boxG(0.5, 0.5, 0.5), stoneMat, 0, 0.25, 0));
  const arm = new THREE.Group(); arm.position.y = 0.5;
  arm.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 6), IRON(), 0, 0.5, 0));
  arm.add(mesh(sphG(0.11, 8), mat(0xc22a2a, { roughness: 0.4 }), 0, 1.0, 0));
  arm.rotation.x = -0.9; g.add(arm);
  g.userData.arm = arm;
  g.userData.dynamic = true;
  return g;
}
export function makeHeartContainer() {
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(0, 0.3); s.bezierCurveTo(0, 0.55, -0.45, 0.55, -0.45, 0.15); s.bezierCurveTo(-0.45, -0.15, 0, -0.4, 0, -0.55); s.bezierCurveTo(0, -0.4, 0.45, -0.15, 0.45, 0.15); s.bezierCurveTo(0.45, 0.55, 0, 0.55, 0, 0.3);
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 }), mat(0xff3050, { roughness: 0.3, emissive: 0xa01020, emissiveIntensity: 0.5 }));
  m.position.set(0, 0.6, -0.12); g.add(m);
  const light = new THREE.PointLight(0xff4060, 3, 6); light.position.y = 0.6; g.add(light);
  g.userData.dynamic = true;
  return g;
}

export function makeCorbeau() {
  const g = new THREE.Group();
  // Le noir du corbeau n'est pas plat : la penne renvoie un bleu-vert selon l'angle.
  const feather = creatureMat(CT.plumes, 2, 2, { metalness: 0.32, envMapIntensity: 1.5, side: THREE.DoubleSide });
  const remige = creatureMat(CT.plumes, 1, 3, { metalness: 0.3, envMapIntensity: 1.4, side: THREE.DoubleSide });
  const corne = creatureMat(CT.peauLisse, 1, 1, { color: 0x3a3a40, roughness: 0.32, metalness: 0.1 });
  const bodyM = mesh(sphG(0.4), feather, 0, 0, 0); bodyM.scale.set(0.9, 0.8, 1.5); g.add(bodyM);
  {                                                     // queue : éventail de rectrices
    const tg = new THREE.Group(); tg.position.set(0, 0.06, -0.5);
    for (let i = -3; i <= 3; i++) {
      const l = 0.95 - Math.abs(i) * 0.07;
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.quadraticCurveTo(0.06, l * 0.5, 0.03, l);
      sh.quadraticCurveTo(-0.03, l * 0.5, -0.06, l * 0.45); sh.closePath();
      const gg = new THREE.ShapeGeometry(sh, 6); gg.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(gg, remige); m.rotation.y = i * 0.13; m.position.y = -Math.abs(i) * 0.008;
      m.castShadow = true; tg.add(m);
    }
    tg.rotation.x = -0.12; g.add(tg);
  }
  const neck = mesh(capG(0.2, 0.2, 8), feather, 0, 0.25, 0.45); neck.rotation.x = 0.8; g.add(neck);
  g.add(mesh(sphG(0.24), feather, 0, 0.42, 0.62));
  const beak = mesh(new THREE.ConeGeometry(0.09, 0.5, 8), corne, 0, 0.38, 0.98); beak.rotation.x = Math.PI / 2; g.add(beak);
  for (const sx of [-1, 1]) {
    g.add(mesh(sphG(0.045, 10), mat(0x0a0608, { roughness: 0.12 }), sx * 0.15, 0.48, 0.77));
    g.add(mesh(sphG(0.022, 8), mat(0xff3a2a, { emissive: 0xff2a1a, emissiveIntensity: 1.6, roughness: 0.2 }), sx * 0.155, 0.482, 0.805));
  }
  // Un corbeau en vol replie ses pattes contre le ventre : des échasses tendues
  // sous le corps, c'est une poule qui court.
  for (const sx of [-1, 1]) {
    const tarse = mesh(capG(0.028, 0.16, 6), corne, sx * 0.13, -0.24, 0.02);
    tarse.rotation.x = 0.9; g.add(tarse);
    const doigt = mesh(capG(0.02, 0.10, 5), corne, sx * 0.13, -0.30, -0.10);
    doigt.rotation.x = 1.5; g.add(doigt);
    for (let d = -1; d <= 1; d++) {
      const gr = mesh(new THREE.ConeGeometry(0.012, 0.06, 4), corne, sx * 0.13 + d * 0.025, -0.33, -0.15);
      gr.rotation.x = 2.1; g.add(gr);
    }
  }
  // Aile : un profil découpé (bord d'attaque droit, bord de fuite courbe) plutôt
  // qu'une planche. La main porte des rémiges séparées, écartées en doigts.
  // Le plan XY du Shape devient le plan XZ après rotateX(-PI/2), qui envoie +Y
  // sur -Z : le bord de fuite se dessine donc en +Y pour finir derrière l'oiseau.
  const aileGeo = (sx, corde, env, fleche) => {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.02 * env);
    sh.quadraticCurveTo(env * 0.5 * sx, -0.05 * corde, env * sx, fleche);            // bord d'attaque
    sh.quadraticCurveTo(env * 0.75 * sx, corde * 0.62, env * 0.45 * sx, corde * 0.78); // extrémité
    sh.quadraticCurveTo(env * 0.2 * sx, corde * 0.72, 0, corde * 0.45);              // bord de fuite
    sh.closePath();
    const gg = new THREE.ShapeGeometry(sh, 10);
    gg.rotateX(-Math.PI / 2);
    return gg;
  };
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 0.28, 0.16, 0.08);
    const bras = new THREE.Mesh(aileGeo(sx, 0.78, 0.92, 0.06), feather);
    bras.castShadow = true; bras.receiveShadow = true; w.add(bras);
    w.add(mesh(capG(0.05, 0.85, 7), feather, sx * 0.46, 0.015, 0.0).rotateZ(Math.PI / 2));  // humérus + couvertures
    const outer = new THREE.Group(); outer.position.set(sx * 0.9, 0, 0.02);
    const main = new THREE.Mesh(aileGeo(sx, 0.66, 0.5, 0.1), feather);
    main.castShadow = true; outer.add(main);
    for (let f = 0; f < 5; f++) {                                  // rémiges primaires écartées
      const l = 0.78 - f * 0.09, a = sx * (0.1 + f * 0.17);
      const pl = new THREE.Shape();
      pl.moveTo(0, 0); pl.quadraticCurveTo(0.035, l * 0.5, 0.012, l);
      pl.quadraticCurveTo(-0.012, l * 0.5, -0.035, l * 0.45); pl.closePath();
      const pg = new THREE.ShapeGeometry(pl, 6); pg.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(pg, remige);
      pm.position.set(sx * (0.44 - f * 0.02), -0.004 * f, -0.12 - f * 0.02);
      pm.rotation.y = -a; pm.castShadow = true; outer.add(pm);
    }
    w.add(outer); w.userData.outer = outer; g.add(w); wings.push(w);
  }
  g.userData.wings = wings;
  g.userData.dynamic = true;
  return g;
}
// texture de coquille de moule : bleu nuit nacré avec lignes de croissance concentriques
let shellTex = null;
function shellTexture() {
  if (shellTex) return shellTex;
  const [c, g] = makeCanvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256); grad.addColorStop(0, '#0f1630'); grad.addColorStop(0.6, '#1a2448'); grad.addColorStop(1, '#3a3a5a');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  for (let y = 8; y < 256; y += 6 + Math.random() * 5) { g.strokeStyle = `rgba(150,170,210,${0.12 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random(); g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + Math.random() * 3); g.stroke(); }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${120 + Math.random() * 80},${140 + Math.random() * 60},${200},${Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  shellTex = tex(c); shellTex.wrapS = shellTex.wrapT = THREE.ClampToEdgeWrapping; return shellTex;
}
export function makeMoule() {
  const g = new THREE.Group();
  const shellMat = creatureMat(CT.nacre, 1, 1, { color: 0xb8c4e8, metalness: 0.62, envMapIntensity: 1.6 });
  const flesh = creatureMat(CT.chairMoule, 2, 2, { color: 0xe8933f, roughness: 0.42 });
  const fleshDark = creatureMat(CT.chairMoule, 2, 2, { color: 0xb8632a, roughness: 0.55 });
  const slime = mat(0x8cff3a, { emissive: 0x4cff1a, emissiveIntensity: 0.9, roughness: 0.2 });
  // valve : profil de moule (pointue à la charnière, large vers l'avant) en géométrie de révolution, aplatie
  const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; const r = Math.sin(Math.PI * Math.pow(t, 0.75)) * 0.85 * (1 - 0.35 * t) + 0.02; prof.push(new THREE.Vector2(r, (t - 0.5) * 2.6)); }
  const valveGeo = new THREE.LatheGeometry(prof, 18); valveGeo.rotateX(Math.PI / 2); // axe le long de z (pointe à l'arrière)
  const lower = new THREE.Mesh(valveGeo, shellMat); lower.scale.set(1, 0.42, 1); lower.position.set(0, 0.36, 0); lower.castShadow = true; g.add(lower);
  const top = new THREE.Group(); top.position.set(0, 0.42, -1.25); // charnière à l'arrière
  const upper = new THREE.Mesh(valveGeo, shellMat); upper.scale.set(1, 0.42, 1); upper.position.set(0, 0.02, 1.25); upper.castShadow = true; top.add(upper);
  for (let i = -3; i <= 3; i++) top.add(mesh(new THREE.ConeGeometry(0.07, 0.3, 5), mat(0xf4ecd8), i * 0.19, -0.1, 2.35 - Math.abs(i) * 0.12).rotateX(Math.PI));
  top.rotation.x = -0.3; g.add(top);
  // chair : langue orange, gencives, dents du bas, œil unique jaune et gros
  const inner = mesh(sphG(0.62, 14), flesh, 0, 0.42, 0.15); inner.scale.set(0.95, 0.4, 1.3); g.add(inner);
  const tongue = mesh(capG(0.16, 0.5, 8), fleshDark, 0, 0.5, 0.9); tongue.rotation.x = Math.PI / 2 - 0.3; g.add(tongue);
  for (let i = -3; i <= 3; i++) g.add(mesh(new THREE.ConeGeometry(0.07, 0.32, 5), mat(0xf4ecd8), i * 0.19, 0.62, 1.15 - Math.abs(i) * 0.12));
  for (const sx of [-1, 1]) { const st = mesh(capG(0.06, 0.5, 6), flesh, sx * 0.32, 0.9, 0.55); st.rotation.z = -sx * 0.4; st.rotation.x = -0.3; g.add(st);
    const eye = mesh(sphG(0.17, 12), mat(0xffe27a, { roughness: 0.15 }), sx * 0.46, 1.2, 0.62); g.add(eye);
    const pu = mesh(sphG(0.08, 8), mat(0x101010), sx * 0.46, 1.2, 0.77); pu.scale.set(0.35, 1.3, 0.6); g.add(pu); }
  // byssus (barbe de filaments) à la charnière et tentacules autour
  for (let i = 0; i < 7; i++) { const th = mesh(new THREE.CylinderGeometry(0.012, 0.02, rand(0.5, 0.9), 4), mat(0x3a2a20, { roughness: 1 }), rand(-0.3, 0.3), 0.25, -1.3 - rand(0, 0.3)); th.rotation.x = rand(1.0, 1.5); th.rotation.z = rand(-0.5, 0.5); g.add(th); }
  for (let i = 0; i < 6; i++) { const a = -1.9 + i * 0.76; const dx = Math.sin(a), dz = Math.cos(a);
    const t1 = mesh(capG(0.06, 0.55, 6), flesh, dx * 1.0, 0.08, dz * 1.3); t1.rotation.order = 'YXZ'; t1.rotation.y = a; t1.rotation.x = Math.PI / 2 - 0.15; g.add(t1);
    const t2 = mesh(capG(0.04, 0.45, 6), fleshDark, dx * 1.45, 0.05, dz * 1.85); t2.rotation.order = 'YXZ'; t2.rotation.y = a + 0.3; t2.rotation.x = Math.PI / 2; g.add(t2); }
  for (let i = 0; i < 5; i++) g.add(mesh(sphG(rand(0.05, 0.11), 8), slime, rand(-0.5, 0.5), 0.3 + rand(0, 0.5), rand(0.3, 1.1)));
  // bernacles sur la coquille
  for (let i = 0; i < 6; i++) { const bn = mesh(new THREE.ConeGeometry(0.09, 0.09, 6, 1, true), mat(0xd8d0c0, { side: THREE.DoubleSide }), rand(-0.6, 0.6), 0.55 + rand(0, 0.1), rand(-0.9, 0.4)); bn.rotation.x = 0; g.add(bn); }
  g.userData.top = top;
  g.userData.dynamic = true;
  return g;
}
export function makeFantome() {
  const g = new THREE.Group();
  const ghost = new THREE.MeshStandardMaterial({ color: 0xcfd8e8, transparent: true, opacity: 0.55, roughness: 0.6, emissive: 0x5a78c8, emissiveIntensity: 0.35, depthWrite: false });
  ghost.userData.linceul = true;      // seul ce matériau respire (cf. animeCreature)
  const coat = creatureMat(CT.membrane, 3, 3, { color: 0x2a3a7a, transparent: true, opacity: 0.85, roughness: 0.85 });
  const robe = mesh(capG(0.42, 1.0, 14), ghost, 0, 1.3, 0); robe.scale.set(1, 1, 0.75); g.add(robe);
  for (let i = 0; i < 7; i++) { const a = i * TAU / 7; const rag = mesh(new THREE.ConeGeometry(0.18, rand(0.7, 1.2), 5), ghost, Math.cos(a) * 0.32, 0.45, Math.sin(a) * 0.26); rag.rotation.x = Math.PI; g.add(rag); }
  g.add(mesh(capG(0.4, 0.3, 14), coat, 0, 1.7, 0).rotateZ(Math.PI / 2)); // veste
  for (let i = 0; i < 4; i++) g.add(mesh(sphG(0.05, 6), mat(0xd9b24a, { metalness: 0.8, roughness: 0.3 }), 0, 1.9 - i * 0.2, 0.42));
  const os = creatureMat(CT.peauLisse, 1.5, 1.5, { color: 0xe8e2cc, roughness: 0.62 });
  const skull = mesh(sphG(0.33, 16), os, 0, 2.4, 0); skull.scale.set(0.95, 1.1, 0.95); g.add(skull);
  g.add(mesh(boxG(0.38, 0.22, 0.26), os, 0, 2.12, 0.1)); // mâchoire
  for (const sx of [-1, 1]) { const s = mesh(sphG(0.09, 10), mat(0x050508, { emissive: 0x2a5aff, emissiveIntensity: 1.2 }), sx * 0.13, 2.44, 0.27); s.scale.set(1, 1.1, 0.5); g.add(s); }
  const nose = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), mat(0x050508), 0, 2.32, 0.33); nose.rotation.x = -Math.PI / 2; g.add(nose);
  for (let i = -2; i <= 2; i++) g.add(mesh(boxG(0.04, 0.07, 0.04), mat(0xf0ead8), i * 0.06, 2.2, 0.24));
  const hat = mesh(new THREE.CylinderGeometry(0.58, 0.64, 0.24, 3), mat(0x1a1a24, { roughness: 0.9 }), 0, 2.74, 0); hat.rotation.y = Math.PI / 6; g.add(hat);
  hat.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12), mat(0x1a1a24), 0, 0.18, 0));
  hat.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 10), mat(0xd9b24a, { metalness: 0.8 }), 0.4, 0.05, -0.3));
  const musket = new THREE.Group(); musket.position.set(0.62, 1.55, 0.3); musket.rotation.x = Math.PI / 2 - 0.35;
  musket.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.0, 8), mat(0x555a60, { metalness: 0.85, roughness: 0.35 }), 0, 0.3, 0));
  musket.add(mesh(boxG(0.09, 1.1, 0.12), mat(0x5a3a1e), 0, -0.4, -0.04));
  musket.add(mesh(new THREE.ConeGeometry(0.02, 0.5, 5), mat(0xcfd6dd, { metalness: 0.9, roughness: 0.2 }), 0, 1.5, 0.05));
  g.add(musket);
  g.userData.dynamic = true;
  return g;
}
export function makeChest() {
  const g = new THREE.Group();
  const wood = mat(0x6b4322, { roughness: 0.8 }), iron = mat(0x3a3a40, { metalness: 0.85, roughness: 0.4 }), gold = mat(0xd9b24a, { metalness: 0.9, roughness: 0.3 });
  g.add(mesh(boxG(1.6, 0.8, 1.0), wood, 0, 0.4, 0));
  for (const x of [-0.6, 0.6]) g.add(mesh(boxG(0.12, 0.84, 1.04), iron, x, 0.4, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0.8, -0.5);
  const top = mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 12, 1, false, 0, Math.PI), wood, 0, 0, 0.5); top.rotation.z = Math.PI / 2; lid.add(top);
  for (const x of [-0.6, 0.6]) { const b = mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.12, 12, 1, false, 0, Math.PI), iron, x, 0, 0.5); b.rotation.z = Math.PI / 2; lid.add(b); }
  lid.add(mesh(boxG(0.3, 0.3, 0.12), gold, 0, -0.1, 1.0));
  g.add(lid);
  const glow = new THREE.PointLight(0xffd070, 0, 5); glow.position.set(0, 0.9, 0); g.add(glow);
  g.userData = { lid, glow };
  g.userData.dynamic = true;
  return g;
}
export function makeBow() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.TorusGeometry(0.75, 0.035, 6, 20, Math.PI * 1.1), mat(0x5a3a1e, { roughness: 0.6 }), 0, 0, 0).rotateZ(-Math.PI * 0.05));
  const str = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.45, 4), mat(0xe0e0d0), 0.05, 0, 0); str.rotation.z = 0.05; g.add(str);
  return g;
}
export const arrowGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5).rotateX(Math.PI / 2);
export const arrowMat = mat(0x8a6a3a, { roughness: 0.7 });
export function makeArrow() {
  const g = new THREE.Group();
  g.add(mesh(arrowGeo, arrowMat, 0, 0, 0));
  g.add(mesh(new THREE.ConeGeometry(0.06, 0.2, 5).rotateX(Math.PI / 2), mat(0xcfd6dd, { metalness: 0.9, roughness: 0.3 }), 0, 0, 0.6));
  for (const r of [0, Math.PI / 2]) { const f = mesh(boxG(0.16, 0.01, 0.2), mat(0xd0d0d0), 0, 0, -0.45); f.rotation.z = r; g.add(f); }
  g.userData.dynamic = true;
  return g;
}
export function makeGaufre() {
  const g = new THREE.Group();
  const dough = mat(0xd9962e, { roughness: 0.8 }), dark = mat(0x9a5f1c, { roughness: 0.9 });
  g.add(mesh(boxG(0.9, 0.18, 0.7), dough, 0, 0, 0));
  for (let i = -1; i <= 1; i++) { g.add(mesh(boxG(0.06, 0.22, 0.72), dark, i * 0.28, 0, 0)); g.add(mesh(boxG(0.92, 0.22, 0.06), dark, 0, 0, i * 0.22)); }
  g.add(mesh(boxG(0.35, 0.08, 0.3), mat(0xfff6e0, { roughness: 1 }), 0.1, 0.14, 0.05));
  g.userData.dynamic = true;
  return g;
}
export function makeHpBar() {
  const g = new THREE.Group();
  g.add(mesh(boxG(1.3, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: 0x222222 }), 0, 0, 0));
  const fg = mesh(boxG(1.2, 0.09, 0.03), new THREE.MeshBasicMaterial({ color: 0xff4040 }), 0, 0, 0.01);
  g.add(fg); g.userData.fg = fg; g.visible = false;
  g.userData.dynamic = true;
  return g;
}

// =====================================================================
//  Bestiaire (paramètres)
// =====================================================================
export const KINDS = {
  corbeau:  { hp: 2,  speed: 8.5, dmg: 1, range: 1.6, aggro: 17, windup: 0.3, cd: 1.5, fly: 1.9, r: 0.5, label: 'Corbeau de la citadelle', barY: 1.2 },
  moule:    { hp: 4,  speed: 2.9, dmg: 2, range: 1.9, aggro: 12, windup: 0.6, cd: 1.6, fly: 0,   r: 0.8, label: 'Moule mutante', barY: 1.9 },
  fantome:  { hp: 5,  speed: 4.3, dmg: 2, range: 2.1, aggro: 16, windup: 0.5, cd: 1.3, fly: 0.35, r: 0.6, label: 'Fantôme de la garnison', barY: 3.3 },
  rat:      { hp: 3,  speed: 6.5, dmg: 1, range: 1.5, aggro: 14, windup: 0.35, cd: 1.1, fly: 0,  r: 0.55, label: 'Rat des galeries', barY: 1.2 },
  ratroi:   { hp: 12, speed: 5.2, dmg: 2, range: 2.4, aggro: 16, windup: 0.5, cd: 1.2, fly: 0,  r: 1.1, label: 'Rat-Roi des galeries', barY: 2.8 },
  chauve:   { hp: 2,  speed: 7.5, dmg: 1, range: 1.4, aggro: 15, windup: 0.3, cd: 1.4, fly: 2.2, r: 0.4, label: 'Chauve-souris', barY: 0.9 },
  phinaert: { hp: 28, speed: 3.7, dmg: 3, range: 5.5, aggro: 90, windup: 0.9, cd: 1.9, fly: 0,   r: 2.4, label: 'Phinaert', boss: true, barY: 10 },
};
const MAKERS = { corbeau: makeCorbeau, moule: makeMoule, fantome: makeFantome, rat: makeRat, ratroi: () => { const g = makeRat(); g.scale.setScalar(2.3); g.add(mesh(new THREE.ConeGeometry(0.12, 0.3, 5), GOLD(), 0, 0.95, 0.62)); for (const sx of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.08, 0.25, 5), GOLD(), sx * 0.14, 0.9, 0.62)); return g; }, chauve: makeBat, phinaert: () => makeGiant(0x7a1f1f, 0x333333, 'club') };

/** Animation de Camille quand elle est riggée (posée par pnj.js). */
export let HOOK_CAMILLE = null;
export function setCamilleHook(fn) { HOOK_CAMILLE = fn; }
/** Remplace Camille par un autre maillage (riggé). Appelé avant bootLevel(). */
export function setPlayerMesh(m) {
  if (!m) return false;
  scene.remove(player.mesh);
  player.mesh = m; m.scale.setScalar(G.echelle); scene.add(m);
  return true;
}
/** Remplace le constructeur d'une créature (géants riggés, cf. geants.js).
 *  Le niveau l'appelle après préchargement ; sans lui, la version procédurale reste. */
export function setMaker(kind, fn) { MAKERS[kind] = fn; }
/** Crochet d'animation posé par le niveau : (e, dt, vitesse) -> true si pris en charge. */
export const ANIM_HOOKS = {};
export function setAnimHook(kind, fn) { ANIM_HOOKS[kind] = fn; }

// =====================================================================
//  État du jeu
// =====================================================================
export const keys = {};
const pressed = new Set(); // touches pressées depuis la dernière image (une pression = une action)
export const pressedOnce = (...codes) => { for (const c of codes) if (pressed.has(c)) { pressed.delete(c); return true; } return false; };
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; pressed.clear(); });
export const state = { running: false, over: false, won: false, paused: false, time: 0, kills: 0, saveT: 0,
  bow: false, key: false, bowChest: false, keyChest: false, gateOpen: false, bossDead: false, galleryOpen: false, caveLever: false, caveHeart: false, caveDone: false,
  // histoire (v14) : épée reçue de Lydéric, intro vue, prince libéré, clé de la cage ; quêtes secondaires q_* : 0 inconnue, 1 acceptée, 2 condition remplie, 3 terminée
  sword: false, introSeen: false, metLyderic: false, cageKey: false, princeFreed: false, ending: false, q_cat: 0, q_crows: 0, q_ghosts: 0, catFound: false,
  // v28 : carte a reveler (decouverts = { idDuLieu: true }), maison du vieux mage
  decouverts: {}, mageIndice: false, mageHeart: false, mageParle: false };
const RUNTIME_KEYS = new Set(['running', 'over', 'won', 'paused', 'time', 'kills', 'saveT']);
export const player = {
  pos: new THREE.Vector3(0, 0, 0), yaw: Math.PI, hp: 12, maxHp: 12, speed: 7.2, vy: 0, onGround: true, fallFrom: 0,
  attackT: -1, attackCd: 0, rollT: -1, rollCd: 0, rollDir: new THREE.Vector3(0, 0, 1),
  invuln: 0, hitSet: new Set(), kb: new THREE.Vector3(), mesh: null, walkT: 0, bowT: -1, bowCd: 0, jumpT: 0, sleeping: 0,
  helix: null, helixA: undefined,                 // escalier en colimacon sous les pieds et angle parcouru
};
export const enemies = [], pickups = [], arrows = [], shockwaves = [], interactables = [];
let activeInteract = null;
player.mesh = makeCamille(); scene.add(player.mesh);

export function spawnEnemy(kind, x, z, zone, y = null) {
  const k = KINDS[kind];
  const m = MAKERS[kind]();
  scene.add(m);
  const bar = makeHpBar(); scene.add(bar);
  const e = { kind, k, mesh: m, bar, pos: new THREE.Vector3(x, y ?? getH(x, z), z), home: new THREE.Vector3(x, 0, z), yaw: rand(0, TAU),
    hp: k.hp, state: 'idle', t: rand(0, 2), target: null, kb: new THREE.Vector3(), flash: 0, zone, dead: false, deadT: 0, anim: rand(0, 10), caged: false };
  e.home.y = e.pos.y;
  enemies.push(e);
  return e;
}
export function spawnPickup(kind, x, z) {
  const m = kind === 'heart' ? makeHeartContainer() : makeGaufre(); m.position.set(x, getH(x, z) + 0.8, z); scene.add(m);
  pickups.push({ kind, mesh: m, pos: new THREE.Vector3(x, 0, z), t: rand(0, TAU) });
}
export const spawnGaufre = (x, z) => spawnPickup('gaufre', x, z);
// objet interactif : { pos:Vector3, r, prompt(), fn(), enabled() }
export function addInteract(it) { interactables.push(it); return it; }

// =====================================================================
//  Lieux : la carte se revele a mesure qu'on explore
// =====================================================================
// Un niveau declare ses points d'interet avec addLieu ; la boucle marque un lieu
// « decouvert » des que Camille passe a portee, et la minimap ne dessine que ceux-la.
// L'etat vit dans state.decouverts : il part donc dans les drapeaux de la sauvegarde,
// sans rien ajouter au format (une vieille sauvegarde repart d'une carte vierge).
export const lieux = [];
export function addLieu(l) { lieux.push(l); return l; }
export function estDecouvert(id) { return !!(state.decouverts && state.decouverts[id]); }
export function decouvrir(id, nom) {
  if (!state.decouverts) state.decouverts = {};
  if (state.decouverts[id]) return false;
  state.decouverts[id] = true;
  if (nom) showMessage('Nouveau lieu sur la carte : ' + nom, 3.5);
  SFX.pickup(); saveGame(true);
  return true;
}
function lieuxTick() {
  for (const l of lieux) {
    if (estDecouvert(l.id)) continue;
    if (Math.hypot(player.pos.x - l.x, player.pos.z - l.z) < (l.r || 22)) decouvrir(l.id, l.nom);
  }
}

// =====================================================================
//  HUD
// =====================================================================
const heartsC = document.getElementById('hearts').getContext('2d');
const mmC = document.getElementById('minimap').getContext('2d');
const zoneEl = document.getElementById('zone'), msgEl = document.getElementById('msg'), countsEl = document.getElementById('counts'), promptEl = document.getElementById('prompt');
let msgT = 0, zoneT = 0, curZone = '';
export function showMessage(text, dur = 3.5) { msgEl.textContent = text; msgEl.style.opacity = 1; msgT = dur; }
function heart(g, x, y, s, color) {
  g.fillStyle = color; g.beginPath();
  g.moveTo(x + s / 2, y + s * 0.95);
  g.bezierCurveTo(x - s * 0.15, y + s * 0.5, x + s * 0.05, y - s * 0.05, x + s / 2, y + s * 0.3);
  g.bezierCurveTo(x + s * 0.95, y - s * 0.05, x + s * 1.15, y + s * 0.5, x + s / 2, y + s * 0.95);
  g.fill();
}
function drawHearts() {
  const g = heartsC; g.clearRect(0, 0, 400, 40);
  const n = player.maxHp / 2;
  for (let i = 0; i < n; i++) {
    const x = 6 + i * 34, y = 6, full = player.hp >= (i + 1) * 2, half = !full && player.hp >= i * 2 + 1;
    heart(g, x, y, 26, '#3a1010');
    if (full) heart(g, x, y, 26, '#ff3b4a');
    else if (half) { g.save(); g.beginPath(); g.rect(x, y - 2, 13, 34); g.clip(); heart(g, x, y, 26, '#ff3b4a'); g.restore(); }
  }
}
function drawMinimap() {
  const g = mmC, W = 170;
  g.clearRect(0, 0, W, W);
  if (G.level && G.level.minimap) G.level.minimap(g, W);
}
export function minimapDots(g, P) {
  for (const e of enemies) { if (e.dead) continue; const [px, pz] = P(e.pos.x, e.pos.z); g.fillStyle = e.k.boss ? '#c020ff' : '#ff3030'; g.beginPath(); g.arc(px, pz, e.k.boss ? 5 : 2.5, 0, TAU); g.fill(); }
  for (const p of pickups) { const [px, pz] = P(p.pos.x, p.pos.z); g.fillStyle = p.kind === 'heart' ? '#ff5070' : '#ffd24a'; g.fillRect(px - 1.5, pz - 1.5, 3, 3); }
  const [px, pz] = P(player.pos.x, player.pos.z);
  g.save(); g.translate(px, pz); g.rotate(-player.yaw + Math.PI);
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill(); g.restore();
}
function updateCounts() {
  countsEl.innerHTML = G.level && G.level.counts ? G.level.counts() : '';
  const boss = enemies.find(e => e.k.boss);
  if (boss && !boss.dead && !boss.caged) { document.getElementById('bossbar').style.display = 'block'; document.getElementById('bossfill').style.width = (100 * boss.hp / boss.k.hp) + '%'; }
  else document.getElementById('bossbar').style.display = 'none';
}

// =====================================================================
//  Menus et clavier
// =====================================================================
export const menu = { items: [], sel: 0, active: false };
const ov = document.getElementById('overlay');
export function showMenu(title, subtitle, text, items) {
  ov.classList.remove('hidden');
  ov.querySelector('h1').textContent = title; ov.querySelector('h2').textContent = subtitle;
  document.getElementById('ovtext').textContent = text;
  { const k = document.getElementById('ovkeys'); if (k) k.style.display = 'none'; }   // l'ancienne grille des touches, s'il en reste une
  menu.items = items; menu.sel = 0; menu.active = true; renderMenu();
}
function renderMenu() {
  document.getElementById('ovgo').innerHTML = menu.items.map((it, i) => `<div class="mitem${i === menu.sel ? ' sel' : ''}">${i === menu.sel ? '▶ ' : ''}${it.label}</div>`).join('');
}
export function hideMenu() { ov.classList.add('hidden'); menu.active = false; }
export const down = (...codes) => codes.some(c => keys[c]);
let enterPressed = false;
// Les touches des autres modules (B boire, I poche, G gaufre…) : ils s'inscrivent ici au lieu
// de poser chacun leur guetteur de clavier. Elles ne jouent qu'en jeu, hors menu et hors
// cinématique — le filtre est ici, une fois pour toutes.
export const TOUCHES = {};
// Les crochets : ce que le moteur demande aux autres modules sans les importer.
//   gaufre() -> vrai si la gaufre ramassée a été rangée (la poche), faux s'il faut la manger
export const CROCHETS = { gaufre: null };

// ---------------------------------------------------------------------
//  L'aide des touches, sur le côté droit
// ---------------------------------------------------------------------
// Elle était en pied d'écran, sur une ligne, et disait tout — y compris ce qu'on ne pouvait
// pas encore faire (l'arc avant de l'avoir) et deux fois la même chose (ZQSD et les flèches).
// Elle ne dit plus que ce qui sert MAINTENANT : l'arc une fois trouvé, la poche une fois la
// bourse en main, G quand il y a une gaufre dans la poche, B quand une gourde est pleine,
// M quand on a la carte. « Entrée » n'y est pas : l'invite au centre de l'écran la montre
// au moment où elle sert. Les autres modules ajoutent leurs touches par AIDE.extra
// (tloc-multi.js : T pour écrire) et peuvent retirer le journal (AIDE.sansJournal).
export const AIDE = { extra: [], sansJournal: false };
let aideSig = '';
function majAide() {
  const el = document.getElementById('legend');
  if (!el) return;
  const P = state.poche && Array.isArray(state.poche.objets) ? state.poche.objets : [];
  const gaufres = P.some((o) => o && o.id === 'gaufre' && o.n > 0);
  // à cheval (G.monte, tloc-multi.js) : ni saut ni roulade — l'aide ne promet que ce qui marche
  const l = [['Z Q S D', G.monte ? 'mener le cheval' : 'se déplacer'], ['Souris', 'regarder'], ['Z + S', G.monte ? 'galoper' : 'courir']];
  if (!G.monte) l.push(['Espace', 'sauter']);
  if (state.sword || (state.bow && G.bowOut)) l.push(['Clic G · F', state.bow && G.bowOut ? 'tirer' : 'frapper, faucher']);
  if (G.bouclier) l.push(['Clic D', 'lever le bouclier']);
  if (G.monte) l.push(['Entrée', 'descendre de cheval']);
  else l.push([G.bouclier ? 'Maj' : 'Clic D · Maj', 'roulade']);
  if (state.bow) l.push(['C', G.bowOut ? 'ranger l’arc' : 'sortir l’arc']);
  if (state.bourse || P.length) l.push(['I', 'poche']);
  if (gaufres) l.push(['G', 'manger une gaufre']);
  if (Array.isArray(state.fioles) && state.fioles.length) l.push(['B', 'boire']);
  if (state.carteBeffroi) l.push(['M', 'carte']);
  if (!AIDE.sansJournal) l.push(['J', 'journal']);
  for (const x of AIDE.extra) l.push(x);
  l.push(['Échap', 'pause']);
  const sig = l.map((x) => x.join(':')).join('|');
  if (sig === aideSig) return;
  aideSig = sig;
  el.innerHTML = l.map(([k, t]) => `<kbd>${k}</kbd><span>${t}</span>`).join('');
}
window.addEventListener('keydown', (e) => {
  if (!e.repeat) pressed.add(e.code);
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
  SFX.unlock();
  if (G.journal) { if (e.code === 'KeyJ' || e.code === 'Escape' || e.code === 'Enter') closeJournal(); return; }
  if (cut.active) { if (e.code === 'Enter' || e.code === 'Space') cutAdvance(); return; }
  if (e.code === 'KeyJ' && state.running && !state.paused && !state.over) { openJournal(); return; }
  if (menu.active) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') menu.sel = (menu.sel + menu.items.length - 1) % menu.items.length;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') menu.sel = (menu.sel + 1) % menu.items.length;
    if (e.code === 'Enter' || e.code === 'Space') { const it = menu.items[menu.sel]; if (it) it.fn(); return; }
    if (e.code === 'Escape' && state.running && state.paused && !state.over) { resumeGame(); return; }
    renderMenu();
    return;
  }
  { const t = TOUCHES[e.code];
    if (t && state.running && !state.paused && !state.over && !e.repeat) { t(e); return; } }
  if (e.code === 'KeyP') G.postFX = !G.postFX;
  if (e.code === 'KeyM') showMessage(SFX.toggleMute() ? 'Musique coupée' : 'Musique', 1.5);
  if (state.running) SFX.music(G.level && G.level.name === 'cave' ? 'cave' : 'day');
  if (e.code === 'KeyO') { sun.castShadow = !sun.castShadow; showMessage(sun.castShadow ? 'Ombres activées' : 'Ombres désactivées (plus fluide)', 2); }
  if (e.code === 'Enter') enterPressed = true;
  if (e.code === 'Escape' && state.running && !state.over) pauseGame();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
// souris : clic dans le jeu = capture du pointeur (la souris oriente la caméra) ; clic gauche = épée / flèche ; clic droit = roulade
export const mouse = { attack: false, roll: false, garde: false };
const canvasEl = document.getElementById('game');
canvasEl.addEventListener('click', () => { if (state.running && !menu.active && !G.journal && !state.over && document.pointerLockElement !== canvasEl) { try { canvasEl.requestPointerLock(); } catch (e) {} } });
document.addEventListener('pointerlockchange', () => { G.mouseLook = document.pointerLockElement === canvasEl; });
window.addEventListener('mousemove', (e) => { if (!G.mouseLook || cut.active || menu.active || G.journal) return; if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) G.mouseT = state.time; G.camYaw -= e.movementX * 0.0022; G.camPitch = clamp(G.camPitch + e.movementY * 0.0016, -0.3, 0.75); });
// Le clic droit roule ; avec un bouclier ramassé en multi (G.bouclier, tloc-multi.js), il
// le lève tant qu'on le tient — la roulade reste sur Maj.
window.addEventListener('mousedown', (e) => { if (!G.mouseLook) return; if (e.button === 0) mouse.attack = true; if (e.button === 2) { if (G.bouclier) mouse.garde = true; else mouse.roll = true; } e.preventDefault(); });
window.addEventListener('mouseup', (e) => { if (e.button === 2) mouse.garde = false; });
window.addEventListener('contextmenu', (e) => { if (G.mouseLook || state.running) e.preventDefault(); });
export function releaseMouse() { if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} } }

// =====================================================================
//  Sauvegarde (localStorage, partagée entre la citadelle et la galerie)
// =====================================================================
export const SAVE_KEY = 'tloc_save_v2';
export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function readSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return d && d.v === 2 ? d : null; } catch (e) { return null; } }
function levelSnapshot() {
  return {
    enemies: enemies.map(e => ({ kind: e.kind, hp: e.hp, dead: e.dead, pos: [e.pos.x, e.pos.z], zone: e.zone })),
    pickups: pickups.map(p => [p.kind, p.pos.x, p.pos.z]),
  };
}
// override : { level, pos } pour sauvegarder en visant un autre niveau (changement de zone)
// Estampille de la carte. La citadelle est passée au 1:1, le fossé a doublé de largeur,
// le bourg a déménagé de 400 m : une position enregistrée avant ces changements tombe
// aujourd'hui dans un mur ou au milieu d'une caserne. On la réutilise donc seulement si
// elle a été prise sur LA MÊME carte ; la progression, elle, est toujours conservée.
export const CARTE_V = 5;

export function saveGame(silent = false, override = null) {
  // le prologue rejoué depuis l'accueil ne touche pas à la partie du personnage
  if (G.sansSauvegarde) return false;
  const prev = readSave() || { levels: {} };
  const levelName = G.level.name;
  const data = {
    v: 2, carte: CARTE_V, level: override ? override.level : levelName,
    pos: override ? override.pos : [player.pos.x, player.pos.y, player.pos.z], yaw: override ? (override.yaw ?? player.yaw) : player.yaw, camYaw: G.camYaw,
    hp: player.hp, maxHp: player.maxHp, time: state.time, kills: state.kills,
    flags: Object.fromEntries(Object.keys(state).filter(k => !RUNTIME_KEYS.has(k)).map(k => [k, state[k]])),
    levels: { ...(prev.levels || {}), [levelName]: levelSnapshot() },
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); if (!silent) showMessage('Partie sauvegardée.', 2); return true; }
  catch (e) { if (!silent) showMessage('Sauvegarde impossible (stockage du navigateur bloqué).', 3); return false; }
}
// applique la sauvegarde ; renvoie le snapshot du niveau courant (ou null si première visite)
export function loadGame() {
  const data = readSave(); if (!data) return null;
  if (data.carte !== CARTE_V) {
    // carte refaite depuis cette sauvegarde : on garde tout sauf l'endroit où on était
    data.pos = null;
    console.warn('sauvegarde prise sur une carte plus ancienne (%s ≠ %s) : position réinitialisée', data.carte, CARTE_V);
  }
  if (data.pos) player.pos.set(...data.pos);
  player.yaw = data.yaw; player.hp = data.hp; player.maxHp = data.maxHp || 12; G.camYaw = data.camYaw ?? data.yaw;
  state.time = data.time; state.kills = data.kills; Object.assign(state, data.flags);
  if (data.flags.sword === undefined) { state.sword = true; state.introSeen = true; state.metLyderic = true; } // sauvegarde d'avant l'histoire v14
  if (!state.decouverts || typeof state.decouverts !== 'object') state.decouverts = {};                        // sauvegarde d'avant la carte a reveler (v28)
  const snap = data.levels[G.level.name] || null;
  if (snap) {
    snap.enemies.forEach((d, i) => { const e = enemies[i]; if (!e || e.kind !== d.kind) return; e.hp = d.hp; e.pos.x = d.pos[0]; e.pos.z = d.pos[1]; e.pos.y = getH(e.pos.x, e.pos.z); e.home.copy(e.pos);
      if (d.dead) { e.dead = true; e.deadT = 1; scene.remove(e.mesh); scene.remove(e.bar); } });
    for (const p of pickups) scene.remove(p.mesh); pickups.length = 0;
    for (const p of snap.pickups) spawnPickup(p[0], p[1], p[2]);
  }
  if (state.bow) player.mesh.userData.bowBack.visible = true;
  return snap || {};
}
export function newGame() {
  // pendant le prologue rejoué, « Nouvelle partie » le recommence : la partie du personnage n'y est pour rien
  if (G.sansSauvegarde) { sessionStorage.setItem('tloc_auto', 'prologue'); location.reload(); return; }
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {} sessionStorage.setItem('tloc_auto', 'new'); location.href = 'index.html'; }
export const PAGES = { citadel: 'index.html', cave: 'cave.html', house: 'house.html', tavern: 'tavern.html', mage: 'mage.html', chapelle: 'chapelle.html' };
export function resumeFromSave() { const d = readSave(); sessionStorage.setItem('tloc_auto', 'resume'); location.href = PAGES[d && d.level] || 'index.html'; }
// changement de niveau : fondu, sauvegarde en visant l'autre page, puis navigation
export function goToLevel(level, pos, yaw, label) {
  state.paused = true;
  fadeTo(1, () => {
    saveGame(true, { level, pos, yaw });
    sessionStorage.setItem('tloc_auto', 'resume'); sessionStorage.setItem('tloc_arrive', G.level.name);
    const ld = document.getElementById('loading');
    if (ld) { ld.classList.remove('hidden'); razCharge(); peindreCharge(label || 'Chargement…', 0); }
    setTimeout(() => { location.href = PAGES[level] || 'index.html'; }, 500);
  });
}
export function fadeTo(target, cb) { G.fadeTarget = target; G.fadeCb = cb; }
export function pauseGame() {
  state.paused = true; releaseMouse();
  showMenu('PAUSE', 'La citadelle attend', '', [
    { label: 'Reprendre', fn: resumeGame },
    { label: 'Sauvegarder', fn: () => { saveGame(); resumeGame(); } },
    { label: 'Sauvegarder et quitter', fn: () => { saveGame(true); sessionStorage.removeItem('tloc_auto'); location.href = 'index.html'; } },
    { label: 'Nouvelle partie', fn: newGame },
  ]);
}
export function resumeGame() { state.paused = false; hideMenu(); for (const k in keys) keys[k] = false; pressed.clear(); }
export function endGame(won) {
  state.over = true; state.won = won;
  const items = won
    ? [{ label: 'Nouvelle partie', fn: newGame }]
    : [{ label: 'Reprendre à la dernière sauvegarde', fn: resumeFromSave }, { label: 'Nouvelle partie', fn: newGame }];
  if (won) { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  showMenu(won ? 'FIN' : 'CAMILLE EST TOMBÉE…', won ? 'Eugène est sauvé' : 'Phinaert règne toujours sur la citadelle',
    won ? `Camille a ramené Eugène à la lumière : la citadelle de Vauban est libre et Lille fête ses héros. Monstres vaincus : ${state.kills}. Temps de jeu : ${Math.round(state.time / 60)} min.`
        : `Eugène attend toujours dans les galeries. Monstres vaincus : ${state.kills}. Temps : ${Math.round(state.time)} s.`, items);
  (won ? SFX.win : SFX.dead)();
}

// =====================================================================
//  Particules (étincelles, poussière, éclats)
// =====================================================================
const particles = [];
const partGeo = new THREE.SphereGeometry(0.09, 5, 4);
export function burst(x, y, z, color = 0xffd070, n = 8, speed = 5, life = 0.45, gravity = 12, size = 1) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  for (let i = 0; i < n; i++) {
    const p = new THREE.Mesh(partGeo, m); p.position.set(x, y, z); p.scale.setScalar(size * rand(0.6, 1.4));
    const a = rand(0, TAU), b = rand(-0.3, 1);
    particles.push({ mesh: p, vel: new THREE.Vector3(Math.cos(a) * speed * rand(0.4, 1), b * speed, Math.sin(a) * speed * rand(0.4, 1)), life, t: 0, g: gravity, mat: m });
    scene.add(p);
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.t += dt; p.vel.y -= p.g * dt; p.mesh.position.addScaledVector(p.vel, dt);
    p.mat.opacity = Math.max(0, 1 - p.t / p.life);
    if (p.t >= p.life) { scene.remove(p.mesh); particles.splice(i, 1); }
  }
}

// =====================================================================
//  Combat
// =====================================================================
export function damagePlayer(dmg, fromX, fromZ) {
  if (player.invuln > 0 || player.rollT >= 0 || state.over || player.sleeping > 0) return;
  player.hp = Math.max(0, player.hp - dmg);
  player.invuln = 0.9;
  const dx = player.pos.x - fromX, dz = player.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
  player.kb.set(dx / d * 9, 0, dz / d * 9);
  burst(player.pos.x, player.pos.y + 1.3, player.pos.z, 0xff4040, 10, 4, 0.5);
  SFX.hurt();
  if (player.hp <= 0) endGame(false);
}
export function hitEnemy(e, dmg, fromX, fromZ) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.18;
  const dx = e.pos.x - fromX, dz = e.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
  if (!e.k.boss) { e.kb.set(dx / d * 7, 0, dz / d * 7); if (e.state !== 'windup') { e.state = 'stagger'; e.t = 0.25; } }
  burst(e.pos.x, e.pos.y + e.k.barY * 0.5, e.pos.z, 0xfff0a0, 7, 5, 0.35);
  SFX.hit();
  if (e.hp <= 0) {
    e.dead = true; e.deadT = 0; e.bar.visible = false; state.kills++;
    burst(e.pos.x, e.pos.y + 0.8, e.pos.z, e.k.boss ? 0xff6030 : 0xb0a0ff, e.k.boss ? 40 : 14, 6, 0.8, 8, 1.4);
    SFX.kill();
    if (!e.k.boss && Math.random() < 0.35) spawnGaufre(e.pos.x, e.pos.z);
    if (G.level.onKill) G.level.onKill(e);
  }
}

// =====================================================================
//  Joueur
// =====================================================================
const GRAV = 22, JUMP_V = 8.2;
// ---------------------------------------------------------------------
//  Escalier en colimacon : repere de deplacement tournant
// ---------------------------------------------------------------------
// Dans une cage d'escalier, « tout droit » ne veut rien dire : la direction a suivre
// tourne en permanence. La base de deplacement (p.moveBasis) est figee au moment ou l'on
// pousse la touche ; sans rien faire, Camille file droit dans la colonne centrale et il
// faut relacher puis rappuyer a chaque quart de tour — c'est ce qui rendait le donjon
// penible. On fait donc tourner la base ET la camera du MEME angle que celui parcouru
// autour de l'axe de l'helice : une seule pression sur Z monte tout l'escalier, et la
// camera reste dans l'axe de la montee au lieu de tourner en rond derriere Camille.
export function helixSous(x, z, y) {
  for (const p of world.platforms) {
    if (!p.helix) continue;
    const r = Math.hypot(x - p.x, z - p.z);
    if (r < p.r0 - 0.35 || r > p.r1 + 0.5) continue;
    if (y < p.base - 0.8 || y > p.base + p.turns * p.hTurn + 1.2) continue;
    return p;
  }
  return null;
}
function suivreColimacon(dt) {
  const p = player;
  const h = helixSous(p.pos.x, p.pos.z, p.pos.y);
  if (!h) { p.helix = null; return; }
  // SUR LES MARCHES SEULEMENT. Au pied de l'escalier, sur le sol de la tour, le recentrage
  // ramenait Camille vers le milieu des marches et la caméra tournait avec elle : pour
  // gagner la porte du beffroi, à 3,4 m de l'axe, il fallait lutter contre le rappel dans
  // une caméra qui pivote — on restait coincé. Même chose sur le plancher du sommet. Le
  // guidage ne vaut qu'entre 30 cm au-dessus du pied et 30 cm sous le palier.
  if (p.pos.y < h.base + 0.3 || p.pos.y > h.base + h.turns * h.hTurn - 0.3) { p.helix = null; return; }
  const a = Math.atan2(p.pos.z - h.z, p.pos.x - h.x);
  if (p.helix === h && p.helixA !== undefined) {
    let d = a - p.helixA; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    // SIGNE : une direction (dx, dz) a pour lacet atan2(dx, dz), et un point a l'angle
    // a = atan2(dz, dx) autour de l'axe a pour tangente le lacet -a. Le lacet DECROIT
    // donc quand l'angle parcouru croit : c'est -d, jamais +d. (Mesure avec +d : Camille
    // part vers l'exterieur et se colle au garde-corps au tiers du premier tour.)
    if (Math.abs(d) < 0.6) {                 // au-dela c'est un saut de position, pas une marche
      if (p.moveBasis !== undefined) p.moveBasis -= d;
      G.camYaw -= d;
    }
    // Recentrage doux dans la volee. Le repere tourne APRES le pas : chaque pas part donc
    // un poil vers l'exterieur, et l'erreur s'accumule (mesure : colle au garde-corps au
    // bout de deux tiers de tour). On ne corrige que hors de la bande centrale des
    // marches, a 1,2 m/s au plus : on peut toujours longer la colonne ou la rambarde.
    const demi = (h.r1 - h.r0) / 2, rMid = h.r0 + demi;
    const ecart = Math.hypot(p.pos.x - h.x, p.pos.z - h.z) - rMid, mar = demi * 0.45;
    if (Math.abs(ecart) > mar) {
      const corr = -Math.sign(ecart) * Math.min(1.2 * (dt || 0.016), Math.abs(ecart) - mar);
      p.pos.x += Math.cos(a) * corr; p.pos.z += Math.sin(a) * corr;
    }
  }
  p.helix = h; p.helixA = a;
}
export function updatePlayer(dt) {
  const p = player;
  p.invuln = Math.max(0, p.invuln - dt); p.attackCd = Math.max(0, p.attackCd - dt); p.rollCd = Math.max(0, p.rollCd - dt);
  if (p.sleeping > 0) { p.sleeping -= dt; }
  const locked = cut.active; // cinématique ou dialogue : plus de commandes, seulement les déplacements scriptés
  if (!locked && down('KeyQ', 'ArrowLeft')) G.camYaw += 2.6 * dt;
  if (!locked && down('KeyE', 'ArrowRight')) G.camYaw -= 2.6 * dt;
  if (!locked && pressedOnce('KeyC') && state.bow) { G.bowOut = !G.bowOut; showMessage(G.bowOut ? 'Arc en main : clic gauche (ou F) pour tirer.' : 'Arc rangé : clic gauche (ou F) pour l\'épée.', 2); }
  // MARCHE AVANT, MARCHE ARRIÈRE ET COURSE.
  // S garde son rôle de marche arrière quand on ne pousse pas vers l'avant ; mais pressé
  // EN AVANÇANT il devient la course (« speed »). Les deux touches ne s'annulent donc
  // plus : la combinaison avant + S est une intention distincte, pas une contradiction.
  const enAvant = !locked && down('KeyW', 'ArrowUp');
  const enArriere = !locked && down('KeyS', 'ArrowDown');
  const veutCourir = enAvant && enArriere;
  const fwd = enAvant ? 1 : (enArriere ? -1 : 0);
  const sx = locked ? 0 : (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0);
  // la garde : bouclier levé, on avance au pas, face au regard, et on ne frappe pas
  p.garde = !locked && !!G.bouclier && !!mouse.garde && p.rollT < 0 && p.attackT < 0 && p.sleeping <= 0;
  const wantAttack = !locked && !p.garde && (mouse.attack || pressedOnce('KeyF')); const wantRoll = !locked && (mouse.roll || pressedOnce('ShiftLeft', 'ShiftRight')); mouse.attack = mouse.roll = false;
  const aimYaw = G.mouseLook ? G.camYaw : p.yaw; // à la souris, on frappe et on vise dans la direction du regard
  // base de déplacement figée au moment où l'on commence à pousser (ou change de combinaison de touches) : la caméra peut
  // se replacer derrière Camille pendant un demi-tour sans inverser la direction de marche
  const combo = fwd * 3 + sx; if (combo !== 0 && combo !== p.moveCombo) p.moveBasis = G.camYaw; p.moveCombo = combo;
  if (down('KeyQ', 'KeyE', 'ArrowLeft', 'ArrowRight') || (G.mouseLook && state.time - G.mouseT < 0.7)) p.moveBasis = G.camYaw; // pilotage explicite de la caméra : la direction suit
  const basis = combo !== 0 && p.moveBasis !== undefined ? p.moveBasis : G.camYaw;
  const cf = new THREE.Vector3(Math.sin(basis), 0, Math.cos(basis));
  const cr = new THREE.Vector3(-cf.z, 0, cf.x);
  const move = new THREE.Vector3().addScaledVector(cf, fwd).addScaledVector(cr, sx);
  if (p.walkTo) { const wx = p.walkTo.x - p.pos.x, wz = p.walkTo.z - p.pos.z, wd = Math.hypot(wx, wz); if (wd > 0.35) move.set(wx / wd, 0, wz / wd); else { p.walkTo = null; } }
  if (locked) { pressed.clear(); }
  const moving = move.lengthSq() > 0 && p.sleeping <= 0 && !p.pose;
  if (moving) move.normalize();
  const ground = getH(p.pos.x, p.pos.z, p.pos.y);
  p.onGround = p.pos.y <= ground + 0.05;

  // roulade
  // à cheval (G.monte, tloc-multi.js) : ni roulade ni saut, le cheval ne sait pas faire
  if (wantRoll && !G.monte && p.rollT < 0 && p.rollCd <= 0 && p.attackT < 0 && p.onGround) {
    p.rollT = 0; p.rollCd = 0.75;
    p.rollDir.copy(moving ? move : new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)));
    p.yaw = Math.atan2(p.rollDir.x, p.rollDir.z);
    SFX.roll();
  }
  // saut (X)
  if (!locked && !G.monte && pressedOnce('KeyX', 'Space') && p.onGround && p.rollT < 0 && p.sleeping <= 0) { p.vy = JUMP_V; p.onGround = false; p.jumpT = 0; p.fallFrom = p.pos.y; SFX.roll(); }
  // arc (C)
  p.bowCd = Math.max(0, p.bowCd - dt);
  // LE CARQUOIS. Les flèches étaient infinies ; elles se comptent (state.fleches, jusqu'à
  // state.carquois), se rachètent chez le colporteur, et les corbeaux en rendent. Une vieille
  // sauvegarde qui n'en sait rien part carquois plein.
  if (state.bow && G.bowOut && wantAttack && p.bowCd <= 0 && p.attackT < 0 && p.rollT < 0 && (state.fleches ?? 20) <= 0) {
    p.bowCd = 0.7; showMessage('Le carquois est vide. Le colporteur du bourg en vend, et les corbeaux en laissent.', 2.5);
  }
  if (state.bow && G.bowOut && wantAttack && p.bowCd <= 0 && p.attackT < 0 && p.rollT < 0) {
    state.fleches = (state.fleches ?? 20) - 1;
    p.bowCd = 0.7; p.bowT = 0; p.yaw = aimYaw;
    let best = null, bestD = 34;
    for (const e of enemies) { if (e.dead) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      let da = ((Math.atan2(dx, dz) - aimYaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
      if (d < bestD && Math.abs(da) < 0.6) { best = e; bestD = d; } }
    const dir = new THREE.Vector3(Math.sin(aimYaw), 0, Math.cos(aimYaw));
    if (!best && G.mouseLook) dir.y = Math.sin(-G.camPitch * 0.6);
    if (best) { dir.set(best.pos.x - p.pos.x, (best.pos.y + 0.8) - (p.pos.y + 1.4), best.pos.z - p.pos.z).normalize(); p.yaw = Math.atan2(dir.x, dir.z); }
    const m = makeArrow(); m.position.set(p.pos.x + dir.x * 0.8, p.pos.y + 1.4, p.pos.z + dir.z * 0.8); m.lookAt(m.position.clone().add(dir)); scene.add(m);
    arrows.push({ mesh: m, vel: dir.multiplyScalar(40), life: 1.5 });
    SFX.swing();
  }
  if (p.bowT >= 0) { p.bowT += dt; if (p.bowT > 0.35) p.bowT = -1; }
  // épée (Espace)
  if (state.sword && !G.bowOut && wantAttack && p.attackT < 0 && p.attackCd <= 0 && p.rollT < 0 && p.sleeping <= 0) {
    p.attackT = 0; p.hitSet.clear(); SFX.swing();
    if (moving) p.yaw = Math.atan2(move.x, move.z); else if (G.mouseLook) p.yaw = aimYaw;
  }

  // ---------- endurance ----------
  // Une jauge qui se vide en courant et se refait au repos. Le seuil de reprise (0,25)
  // évite le bégaiement : une fois à sec, il faut avoir soufflé un peu avant de repartir,
  // sinon on accélère et on retombe une fois par image.
  if (p.energie === undefined) { p.energie = 1; p.sansCourse = 9; p.essouffle = false; }
  const court = veutCourir && !locked && p.rollT < 0 && p.attackT < 0 && p.sleeping <= 0
    && (p.energie > (p.essouffle ? ENDURANCE.reprise : 0.001));
  if (court) {
    p.energie = Math.max(0, p.energie - ENDURANCE.conso * dt);
    p.sansCourse = 0;
    if (p.energie <= 0) p.essouffle = true;
  } else {
    p.sansCourse += dt;
    // Tant que la touche reste enfoncée à vide, la jauge ne repart PAS. Sans cette
    // condition on regagne 0,25 en 0,7 s, on repart pour une demi-seconde, on retombe à
    // sec — et la course devient un hoquet. Il faut relâcher pour souffler.
    if (!veutCourir && p.sansCourse > ENDURANCE.repos) {
      p.energie = Math.min(1, p.energie + ENDURANCE.regen * dt);
      if (p.energie >= ENDURANCE.reprise) p.essouffle = false;
    }
  }
  p.court = court;
  majEndurance(p.energie, court);

  let speed = p.walkTo ? (p.walkSpeed || 4.5) : p.speed;
  if (court) speed *= ENDURANCE.gain;
  if (p.garde) speed *= 0.4;
  if (p.rollT >= 0) {
    p.rollT += dt;
    tryMove(p.pos, p.rollDir.x * 15 * dt, p.rollDir.z * 15 * dt, 0.5, false);
    if (p.rollT > 0.45) p.rollT = -1;
    speed = 0;
  } else if (p.attackT >= 0) {
    p.attackT += dt;
    speed *= 0.25;
    if (p.attackT > 0.08 && p.attackT < 0.3) {
      for (const e of enemies) {
        if (e.dead || p.hitSet.has(e) || e.caged) continue;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 2.6 + e.k.r && Math.abs(e.pos.y - p.pos.y) < 3) {
          let da = ((Math.atan2(dx, dz) - p.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
          if (Math.abs(da) < 1.25 || d < 1.2) { p.hitSet.add(e); hitEnemy(e, 1, p.pos.x, p.pos.z); }
        }
      }
    }
    if (p.attackT > 0.38) { p.attackT = -1; p.attackCd = 0.08; }
  }
  if (p.garde) p.yaw = lerpAngle(p.yaw, aimYaw, 1 - Math.exp(-14 * dt));   // le bouclier face à ce qu'on regarde
  if (moving && speed > 0) {
    if (!p.garde) p.yaw = lerpAngle(p.yaw, Math.atan2(move.x, move.z), 1 - Math.exp(-14 * dt));
    tryMove(p.pos, move.x * speed * dt, move.z * speed * dt, 0.5, false, p.onGround ? 0.5 : 0.35);
    if (p.onGround) p.walkT += dt * 11;
  } else if (!moving) p.walkT = lerp(p.walkT, Math.round(p.walkT / Math.PI) * Math.PI, 0.2);
  suivreColimacon(dt);
  if (p.kb.lengthSq() > 0.01) { tryMove(p.pos, p.kb.x * dt, p.kb.z * dt, 0.5, false); p.kb.multiplyScalar(Math.exp(-8 * dt)); }

  // verticale : gravité, atterrissage, dégâts de chute
  const g2 = getH(p.pos.x, p.pos.z, p.pos.y);
  if (p.pos.y > g2 + 0.02 || p.vy > 0) {
    if (p.onGround && p.vy <= 0) p.fallFrom = p.pos.y;
    p.vy -= GRAV * dt; p.pos.y += p.vy * dt; p.jumpT += dt;
    if (p.pos.y <= g2) { p.pos.y = g2; const fall = p.fallFrom - g2; p.vy = 0; p.onGround = true; if (fall > 1.2) burst(p.pos.x, p.pos.y + 0.1, p.pos.z, 0xc8b898, 8, 2.5, 0.5, 4, 1.2); if (fall > 7) { damagePlayer(2, p.pos.x + 0.01, p.pos.z); showMessage('Aïe ! La chute était haute.', 2); } }
  } else { p.pos.y = g2; p.vy = 0; p.onGround = true; }
  if (G.level.onFall && p.pos.y < -4) G.level.onFall();

  // animation
  const m = p.mesh, ud = m.userData;
  m.position.copy(p.pos); m.rotation.y = p.yaw;
  // La roulade en primitives faisait tourner tout le personnage d'un tour sur
  // lui-même. Camille riggée a un vrai clip de roulade : on laisse le pivot
  // tranquille, sinon elle fait la culbute EN PLUS de la roulade.
  ud.pivot.rotation.x = (p.rollT >= 0 && !(ud.ctrl && HOOK_CAMILLE)) ? (p.rollT / 0.45) * TAU : 0;
  const walking = moving && speed > 0 && p.onGround;
  if (walking) { const st = Math.floor(p.walkT / Math.PI); if (st !== p.lastStep) { p.lastStep = st; SFX.step(); } }
  // Camille riggée : tout le mouvement passe par le mixer. Le crochet est posé
  // par le niveau (pnj.js) ; sans lui, on retombe sur l'animation en primitives.
  const rigge = !!(ud.ctrl && HOOK_CAMILLE);
  if (rigge) {
    const drawingR = p.bowT >= 0, bowOutR = state.bow && G.bowOut;
    m.visible = !(p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) && p.sleeping <= 0;
    m.rotation.x = 0;
    if (p.pose) {
      const ps = p.pose;
      if (ps.pos) m.position.set(ps.pos[0], ps.pos[1], ps.pos[2]);
      if (ps.yaw !== undefined) m.rotation.y = ps.yaw;
      if (ps.kind === 'lie') m.rotation.x = -Math.PI / 2;
      else if (ps.kind === 'kneel') m.position.y -= 0.35;
    }
    HOOK_CAMILLE(m, p, dt, {
      walking, running: walking && speed > 6.4, drawing: drawingR, bowOut: bowOutR,
      pose: p.pose && p.pose.kind, epeeSortie: state.sword, arcTrouve: state.bow,
      garde: p.garde, armure: G.armure || 0, bouclier: G.bouclier || 0,     // l'équipement du multi
      monte: !!G.monte, selle: G.selle || 0,
    });
  }
  // ATTENTION : surtout pas de `return` ici. Le ramassage des objets et TOUTES
  // les interactions (parler, coffres, portes, leviers, dormir) sont plus bas
  // dans cette fonction — en sortir plus tôt les désactive silencieusement.
  if (!rigge) {
  const sw = Math.sin(p.walkT) * (walking ? 0.7 : 0);
  if (p.onGround) {
    ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw;
    ud.knees[0].rotation.x = Math.max(0, sw) * 1.1; ud.knees[1].rotation.x = Math.max(0, -sw) * 1.1;
  } else { ud.legs[0].rotation.x = -0.5; ud.legs[1].rotation.x = 0.3; ud.knees[0].rotation.x = 1.2; ud.knees[1].rotation.x = 0.6; }
  ud.arms[0].rotation.x = -sw * 0.6; ud.arms[0].rotation.y = 0; ud.elbows[0].rotation.x = -0.6;
  if (p.attackT >= 0) {
    const t = p.attackT / 0.38;
    ud.arms[1].rotation.x = -Math.PI / 2 + Math.sin(t * Math.PI) * 0.2;
    ud.arms[1].rotation.y = lerp(1.3, -1.4, Math.min(1, t * 1.6));
    ud.elbows[1].rotation.x = -0.15;
    ud.body.rotation.y = lerp(0.4, -0.4, Math.min(1, t * 1.6));
  } else { ud.arms[1].rotation.x = sw * 0.6; ud.arms[1].rotation.y = 0; ud.elbows[1].rotation.x = -0.35; ud.body.rotation.y = lerp(ud.body.rotation.y, 0, 0.3); }
  const drawing = p.bowT >= 0, bowOut = state.bow && G.bowOut;
  ud.bowHand.visible = state.bow && (drawing || bowOut); ud.bowBack.visible = state.bow && !drawing && !bowOut;
  if (bowOut && !drawing && p.attackT < 0) { ud.arms[0].rotation.x = -1.1; ud.elbows[0].rotation.x = -0.4; }
  if (drawing) { ud.arms[0].rotation.x = -Math.PI / 2; ud.elbows[0].rotation.x = 0; ud.arms[1].rotation.x = -Math.PI / 2 + 0.3; ud.arms[1].rotation.y = 0.2; ud.elbows[1].rotation.x = -1.6; }
  m.visible = !(p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) && p.sleeping <= 0;
  // respiration au repos
  ud.body.position.y = -1.1 + (walking ? 0 : Math.sin(state.time * 2.2) * 0.015); ud.head.rotation.y = walking ? 0 : Math.sin(state.time * 0.7) * 0.15;
  ud.sword.visible = state.sword; ud.shield.visible = state.sword;
  // poses scriptées (cinématiques) : allongée sur le lit, à genoux, assise
  m.rotation.x = 0;
  if (p.pose) {
    const ps = p.pose; if (ps.pos) m.position.set(ps.pos[0], ps.pos[1], ps.pos[2]); if (ps.yaw !== undefined) m.rotation.y = ps.yaw;
    if (ps.kind === 'lie') { m.rotation.x = -Math.PI / 2; ud.legs[0].rotation.x = ud.legs[1].rotation.x = 0; ud.knees[0].rotation.x = ud.knees[1].rotation.x = 0; ud.arms[0].rotation.x = ud.arms[1].rotation.x = 0.15; ud.elbows[0].rotation.x = -0.9; ud.elbows[1].rotation.x = -0.9; ud.head.rotation.y = 0; }
    else if (ps.kind === 'kneel') { ud.legs[0].rotation.x = -1.5; ud.knees[0].rotation.x = 1.6; ud.legs[1].rotation.x = 0.2; ud.knees[1].rotation.x = 1.9; m.position.y -= 0.55; }
    else if (ps.kind === 'sit') { ud.legs[0].rotation.x = ud.legs[1].rotation.x = -1.5; ud.knees[0].rotation.x = ud.knees[1].rotation.x = 1.5; }
    else if (ps.kind === 'cheer') { ud.arms[0].rotation.x = ud.arms[1].rotation.x = -2.8 + Math.sin(state.time * 8) * 0.2; ud.elbows[0].rotation.x = ud.elbows[1].rotation.x = -0.3; m.position.y += Math.abs(Math.sin(state.time * 6)) * 0.25; }
  }
  }   // fin du bloc d'animation en primitives

  // ramassage
  for (let i = pickups.length - 1; i >= 0; i--) {
    const g = pickups[i];
    if (Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 1.2 && Math.abs(g.mesh.position.y - p.pos.y) < 2.5) {
      scene.remove(g.mesh); pickups.splice(i, 1);
      if (g.kind === 'heart') { p.maxHp += 2; p.hp = p.maxHp; state.caveHeart = true; SFX.win(); showMessage('Un RÉCEPTACLE DE CŒUR ! Camille gagne un cœur de plus et retrouve toute sa vie.', 5); }
      // en pleine santé, la gaufre va dans la poche s'il y a de la place (bourse.js) :
      // la manger quand on n'en a pas besoin, c'était la perdre
      else if (p.hp >= p.maxHp && CROCHETS.gaufre && CROCHETS.gaufre()) { SFX.pickup(); }
      else { p.hp = Math.min(p.maxHp, p.hp + 4); SFX.pickup(); showMessage('Une gaufre de chez Méert ! +2 cœurs', 2); }
    }
  }
  // interactions (Entrée)
  // LA MEILLEURE, pas la première. On gardait la première interaction à portée dans
  // l'ordre où elles avaient été déclarées : la porte de la chapelle, posée avant les
  // villageois, gagnait sur Désiré qui passait devant, et Entrée faisait entrer dans la
  // chapelle au lieu de lui parler. On compare la distance RAPPORTÉE à la portée (une porte
  // de 3,45 m de rayon n'écrase plus un villageois à un pas) et ce que Camille regarde.
  activeInteract = null;
  { let mieux = Infinity;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    for (const it of interactables) {
      if (it.enabled && !it.enabled()) continue;
      const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d >= it.r || Math.abs(it.pos.y - p.pos.y) >= 3) continue;
      const face = d > 0.4 ? (dx * fx + dz * fz) / d : 1;          // 1 devant, −1 dans le dos
      const note = d / it.r + 0.5 * (1 - face);
      if (note < mieux) { mieux = note; activeInteract = it; }
    } }
  if (activeInteract) { promptEl.textContent = 'Entrée : ' + activeInteract.prompt(); promptEl.style.opacity = 1; }
  else promptEl.style.opacity = 0;
  if (enterPressed && activeInteract && p.sleeping <= 0 && !locked) activeInteract.fn();
  if (locked) promptEl.style.opacity = 0;
  enterPressed = false;
  pressed.clear();
}

// =====================================================================
//  Ennemis
// =====================================================================
/**
 * Pose la créature d'après son état et sa vitesse. Sortie du corps de updateEnemy()
 * pour que demo-bestiaire.html rejoue exactement la même animation que le jeu —
 * un banc d'essai qui ment ne sert à rien.
 */
export function animeCreature(e, m, dt, speed) {
  const ud = m.userData;
  if (ud.anim && ANIM_HOOKS[e.kind] && ANIM_HOOKS[e.kind](e, dt, speed)) return;
  if (e.kind === 'corbeau') {
    // Un battement d'aile n'est pas un sinus : la descente (propulsion) est
    // rapide et ample, la remontée lente et repliée. On déforme donc la phase,
    // et la main de l'aile retarde sur l'épaule — c'est ce décalage qui fait
    // lire le mouvement comme vivant.
    const ph = e.anim * 15;
    const bat = Math.sin(ph) >= 0 ? Math.pow(Math.sin(ph), 0.55) : -Math.pow(-Math.sin(ph), 1.5);
    const retard = Math.sin(ph - 0.7);
    const f = bat * 0.85, o = retard * 0.55;
    ud.wings[0].rotation.z = f;  ud.wings[1].rotation.z = -f;
    ud.wings[0].rotation.x = o * 0.25; ud.wings[1].rotation.x = o * 0.25;
    ud.wings[0].userData.outer.rotation.z = o;  ud.wings[1].userData.outer.rotation.z = -o;
    m.rotation.x = -0.12 - bat * 0.10;                       // le corps encaisse le battement
    m.position.y += bat * 0.10;
  }
  else if (e.kind === 'chauve') {
    // La chauve-souris bat plus vite et plus court, en repliant le poignet.
    const ph = e.anim * 19;
    const bat = Math.sin(ph) >= 0 ? Math.pow(Math.sin(ph), 0.6) : -Math.pow(-Math.sin(ph), 1.4);
    ud.wings[0].rotation.y = -bat * 0.95; ud.wings[1].rotation.y = bat * 0.95;
    ud.wings[0].rotation.z = -bat * 0.35; ud.wings[1].rotation.z = bat * 0.35;
    m.rotation.z = Math.sin(ph * 0.5) * 0.12;
    m.position.y += bat * 0.06;
  }
  else if (e.kind === 'moule') {
    // La valve s'ouvre d'un coup et se referme lentement : une moule qui respire,
    // pas un couvercle sur ressort. En déplacement elle sautille par à-coups.
    const b = e.anim * 2.4, ouv = Math.pow(Math.max(0, Math.sin(b)), 0.4);
    ud.top.rotation.x = e.state === 'windup' ? -1.15 : -0.12 - ouv * 0.45;
    if (speed > 0) {
      const saut = Math.max(0, Math.sin(e.anim * 5.5));
      m.position.y += Math.pow(saut, 0.7) * 0.42;
      m.rotation.x = -saut * 0.22;                           // elle pique du nez en retombant
    } else m.rotation.x = lerp(m.rotation.x, 0, 1 - Math.exp(-6 * dt));
  }
  else if (e.kind === 'fantome') {
    // Dérive lente, sans appui au sol : roulis, lacet et respiration désynchronisés.
    m.rotation.z = Math.sin(e.anim * 1.3) * 0.10 + Math.sin(e.anim * 0.41) * 0.05;
    m.rotation.x = Math.sin(e.anim * 0.9 + 1.1) * 0.06;
    m.position.y += Math.sin(e.anim * 0.7) * 0.22;
    const halo = 0.42 + Math.sin(e.anim * 1.7) * 0.10;
    m.traverse(o => { if (o.isMesh && o.material && o.material.userData.linceul) o.material.opacity = halo; });
  }
  else if (e.kind === 'rat' || e.kind === 'ratroi') {
    // Galop bondissant : le corps se voûte et s'étire, la queue suit en fouet
    // retardé segment par segment, la tête fouille devant.
    const g = e.anim * 11;
    const bond = speed > 0 ? Math.max(0, Math.sin(g)) : 0;
    m.position.y += Math.pow(bond, 0.8) * 0.16;
    m.rotation.x = -bond * 0.28 + (e.state === 'windup' ? -0.45 : 0);
    const segs = ud.tailSegs || [];
    for (let i = 0; i < segs.length; i++) {
      segs[i].rotation.y = Math.sin(e.anim * 5 - i * 0.55) * (0.16 + i * 0.05);
      segs[i].rotation.x = Math.sin(e.anim * 3.3 - i * 0.4) * 0.07;
    }
    if (ud.tete) {
      ud.tete.rotation.y = Math.sin(e.anim * 2.1) * 0.28;
      ud.tete.rotation.x = 0.18 + Math.sin(e.anim * 4.2) * 0.12;   // reniflements
    }
    const p = ud.pattes;
    if (p) for (let i = 0; i < p.length; i++) p[i].rotation.x = Math.sin(g + i * Math.PI / 2) * (speed > 0 ? 0.5 : 0.04);
  }
  else if (e.kind === 'phinaert') {
    const a = ud.arms, sw = Math.sin(e.anim * 3) * (speed > 0 ? 0.35 : 0.08);
    if (e.state === 'windup') { a[1].rotation.x = lerp(a[1].rotation.x, -2.6, 1 - Math.exp(-8 * dt)); ud.elbows[1].rotation.x = lerp(ud.elbows[1].rotation.x, -0.9, 1 - Math.exp(-8 * dt)); }
    else if (e.state === 'cool') { a[1].rotation.x = lerp(a[1].rotation.x, 0.8, 1 - Math.exp(-14 * dt)); ud.elbows[1].rotation.x = lerp(ud.elbows[1].rotation.x, -0.2, 1 - Math.exp(-14 * dt)); }
    else { a[1].rotation.x = sw; ud.elbows[1].rotation.x = -0.4; }
    a[0].rotation.x = -sw;
    ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw; ud.legs[0].userData.knee.rotation.x = Math.max(0, sw); ud.legs[1].userData.knee.rotation.x = Math.max(0, -sw);
  }
}

export function updateEnemy(e, dt) {
  const k = e.k, m = e.mesh;
  e.anim += dt;
  if (e.dead) {
    e.deadT += dt;
    const s = Math.max(0.001, 1 - e.deadT / 0.6);
    m.scale.set(s, s, s); m.rotation.y += dt * 12; m.position.y += dt * 2;
    if (e.deadT > 0.6) { scene.remove(m); scene.remove(e.bar); }
    return;
  }
  e.flash = Math.max(0, e.flash - dt);
  if (cut.active && !e.k.boss) { e.mesh.position.copy(e.pos); return; }
  const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z, dist = Math.hypot(dx, dz);
  const dy = Math.abs(player.pos.y - e.pos.y);
  const toP = Math.atan2(dx, dz);
  let vx = 0, vz = 0, speed = 0;
  const canSee = !e.caged && dy < (k.fly > 1 ? 8 : 3.5) && player.sleeping <= 0 && !cut.active;

  if (e.state === 'idle') {
    e.t -= dt;
    if (e.t <= 0) { e.t = rand(1.5, 3.5); const a = rand(0, TAU), r = rand(0, 6); e.target = new THREE.Vector3(e.home.x + Math.cos(a) * r, 0, e.home.z + Math.sin(a) * r); }
    if (e.target) {
      const tx = e.target.x - e.pos.x, tz = e.target.z - e.pos.z, td = Math.hypot(tx, tz);
      if (td > 0.5) { vx = tx / td; vz = tz / td; speed = k.speed * 0.4; e.yaw = lerpAngle(e.yaw, Math.atan2(vx, vz), 1 - Math.exp(-5 * dt)); }
    }
    if (dist < k.aggro && canSee && !state.over) e.state = 'chase';
  } else if (e.state === 'chase') {
    e.yaw = lerpAngle(e.yaw, toP, 1 - Math.exp(-8 * dt));
    if (!canSee) { e.state = 'idle'; e.t = 0; }
    else if (dist < k.range && dy < 2.5) { e.state = 'windup'; e.t = k.windup; }
    else if (dist > k.aggro * 1.6 && !k.boss) { e.state = 'idle'; e.t = 0; }
    else { vx = dx / dist; vz = dz / dist; speed = k.speed; }
  } else if (e.state === 'windup') {
    e.t -= dt; e.yaw = lerpAngle(e.yaw, toP, 1 - Math.exp(-6 * dt));
    if (e.t <= 0) {
      e.state = 'cool'; e.t = k.cd;
      if (k.boss) {
        SFX.stomp();
        const rm = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
        rm.rotation.x = -Math.PI / 2; rm.position.set(e.pos.x, getH(e.pos.x, e.pos.z) + 0.15, e.pos.z); scene.add(rm);
        shockwaves.push({ x: e.pos.x, z: e.pos.z, y: e.pos.y, r: 2, t: 0, hit: false, mesh: rm });
        if (dist < k.range + 1 && dy < 2.5) damagePlayer(k.dmg, e.pos.x, e.pos.z);
      } else if (dist < k.range + 0.7 && dy < 2.5) damagePlayer(k.dmg, e.pos.x, e.pos.z);
    }
  } else if (e.state === 'cool') {
    e.t -= dt;
    if (dist > k.range * 0.8) { vx = dx / dist; vz = dz / dist; speed = k.speed * 0.5; }
    if (e.t <= 0) e.state = 'chase';
  } else if (e.state === 'stagger') {
    e.t -= dt; if (e.t <= 0) e.state = 'chase';
  }
  for (const o of enemies) {
    if (o === e || o.dead) continue;
    const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = Math.hypot(ox, oz), minD = k.r + o.k.r + 0.3;
    if (od < minD && od > 0.001) { vx += ox / od * 1.5; vz += oz / od * 1.5; if (speed === 0) speed = 2; }
  }
  if (speed > 0) { const l = Math.hypot(vx, vz) || 1; tryMove(e.pos, vx / l * speed * dt, vz / l * speed * dt, k.r, k.fly > 1, 0.6, true); }
  if (e.kb.lengthSq() > 0.01) { tryMove(e.pos, e.kb.x * dt, e.kb.z * dt, k.r, k.fly > 1, 0.5, true); e.kb.multiplyScalar(Math.exp(-8 * dt)); }
  const pd = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z), minPD = k.r + 0.6;
  if (pd < minPD && pd > 0.001 && dy < 2) { const px = (e.pos.x - player.pos.x) / pd, pz = (e.pos.z - player.pos.z) / pd; tryMove(e.pos, px * (minPD - pd), pz * (minPD - pd), k.r, k.fly > 1); }

  const gh0 = getH(e.pos.x, e.pos.z, e.pos.y), gh = k.fly > 1 ? Math.max(gh0, 0) : gh0;
  e.pos.y = lerp(e.pos.y, gh + k.fly + (k.fly ? Math.sin(e.anim * 4) * 0.25 : 0), 1 - Math.exp(-10 * dt));
  m.position.copy(e.pos); m.rotation.y = e.yaw;
  animeCreature(e, m, dt, speed);
  m.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { if (o.material.userData.em === undefined) o.material.userData.em = o.material.emissive.getHex(); o.material.emissive.setHex(e.flash > 0 ? 0xff2020 : o.material.userData.em); } });
  e.bar.visible = e.hp < k.hp && !k.boss;
  if (e.bar.visible) {
    const ratio = Math.max(0, e.hp / k.hp);
    e.bar.userData.fg.scale.x = ratio; e.bar.userData.fg.position.x = -(1 - ratio) * 0.6;
    e.bar.position.set(e.pos.x, e.pos.y + k.barY, e.pos.z);
    e.bar.quaternion.copy(camera.quaternion);
  }
}
export function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i]; a.life -= dt;
    a.vel.y -= 2.5 * dt;
    a.mesh.position.addScaledVector(a.vel, dt);
    a.mesh.lookAt(a.mesh.position.clone().add(a.vel));
    let hit = false;
    for (const e of enemies) {
      if (e.dead || e.caged) continue;
      const d = Math.hypot(e.pos.x - a.mesh.position.x, e.pos.z - a.mesh.position.z);
      const dy = a.mesh.position.y - e.pos.y;
      if (d < e.k.r + 0.5 && dy > -0.5 && dy < (e.k.boss ? 9 : 3)) { hitEnemy(e, 2, a.mesh.position.x, a.mesh.position.z); hit = true; break; }
    }
    const p = a.mesh.position;
    if (hit || a.life <= 0 || p.y < getH(p.x, p.z, p.y) - 0.2 || (G.level.arrowBlocked && G.level.arrowBlocked(p)) || blocked(p.x, p.z, 0.05, true, p.y)) { scene.remove(a.mesh); arrows.splice(i, 1); }
  }
}
export function updateShockwaves(dt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.t += dt; s.r = 2 + s.t * 14;
    s.mesh.scale.set(s.r, s.r, 1); s.mesh.material.opacity = Math.max(0, 0.85 - s.t * 0.6);
    const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z);
    if (!s.hit && Math.abs(d - s.r) < 1.3 && player.pos.y - s.y < 1.2) { s.hit = true; damagePlayer(2, s.x, s.z); }
    if (s.t > 1.4) { scene.remove(s.mesh); shockwaves.splice(i, 1); }
  }
}
export function updateCamera(dt) {
  const p = player;
  const moving = p.kb.lengthSq() < 0.01 && (down('KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyD', 'ArrowRight', 'KeyA', 'ArrowLeft'));
  // la caméra se replace derrière Camille quand elle marche (demi-tour compris) ; la souris garde la main pendant 0,7 s après chaque mouvement
  const mouseRecent = G.mouseLook && state.time - G.mouseT < 0.7;
  if (moving && !mouseRecent && !down('KeyQ', 'KeyE', 'ArrowLeft', 'ArrowRight')) G.camYaw = lerpAngle(G.camYaw, p.yaw, 1 - Math.exp(-3.2 * dt));
  // dans une cage d'escalier la camera se resserre : 10 m de recul dans un puits de 3,6 m
  // de rayon, c'est une camera qui passe son temps coincee dans la colonne ou dans le mur
  // ÉCHELLE DU PERSONNAGE. Tout ce qui se mesure sur Camille — recul de la caméra,
  // hauteur des yeux, point visé — se multiplie par G.echelle. Sans ça, rapetisser le
  // personnage le réduit à un point au fond d'un plan large.
  const EP = G.echelle;
  const camB = (p.helix ? Math.min(G.camBack, 4.6) : G.camBack) * EP;
  const camU = (p.helix ? Math.min(G.camUp, 3.2) : G.camUp) * EP;
  const pitch = G.mouseLook ? G.camPitch : 0, back = camB * Math.cos(pitch), up = camU + camB * Math.sin(pitch) * 0.9;
  const head = new THREE.Vector3(p.pos.x, p.pos.y + 1.6 * EP, p.pos.z);
  // pour un angle donné : jusqu'où peut-on reculer sans traverser un obstacle ? (fraction 0..1)
  // LA SONDE À L'ÉCHELLE DE CAMILLE. Sonder dès la tête avec 0,62 m de rayon, c'était, dès
  // qu'elle frôlait un étal ou un mur, heurter l'obstacle au tout premier pas : la caméra ne
  // reculait plus du tout et partait se percher à la verticale (78° mesurés contre un étal
  // du marché). Le rayon suit l'échelle du personnage, et il S'ÉVASE en s'éloignant de la
  // tête : un étal À CÔTÉ de Camille n'arrête plus la sonde, un mur DERRIÈRE elle la coupe
  // toujours (la ligne le traverse, quel que soit le rayon). Ne pas sonder du tout le
  // premier mètre faisait passer la caméra à travers la porte de la maison, dos au mur.
  const rSonde = 0.62 * Math.min(1, EP);
  const reach = (yaw) => {
    const ix = p.pos.x - Math.sin(yaw) * back, iy = Math.min(p.pos.y + up, G.camMaxY), iz = p.pos.z - Math.cos(yaw) * back;
    const N = 20, L = Math.hypot(ix - head.x, iy - head.y, iz - head.z) || 1;
    for (let i = 1; i <= N; i++) {
      const f = i / N, x = head.x + (ix - head.x) * f, y = head.y + (iy - head.y) * f, z = head.z + (iz - head.z) * f;
      const r = rSonde * Math.min(1, 0.15 + f * L / (1.5 * EP));
      if (blocked(x, z, r, false, y) || y < getH(x, z, y) + 0.6) return Math.max(0, (i - 1) / N - 0.04);
    }
    return 1;
  };
  // on essaie l'angle courant puis des angles voisins : la caméra contourne les murs au lieu de s'y coller
  let bestOff = 0, bestT = reach(G.camYaw);
  if (bestT < 0.6) for (const off of [0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0]) { const t = reach(G.camYaw + off); if (t > bestT + 0.08) { bestT = t; bestOff = off; } if (bestT >= 0.95) break; }
  if (bestOff) G.camYaw = lerpAngle(G.camYaw, G.camYaw + bestOff, 1 - Math.exp(-3 * dt));
  const t = Math.max(bestT, reach(G.camYaw)) ;
  const yaw = G.camYaw;
  const ideal = new THREE.Vector3(p.pos.x - Math.sin(yaw) * back, Math.min(p.pos.y + up, G.camMaxY), p.pos.z - Math.cos(yaw) * back);
  const best = head.clone().lerp(ideal, Math.min(t, reach(yaw)));
  // vraiment coincée : on s'élève au-dessus de Camille (dans la limite du plafond)
  const dist = best.distanceTo(head);
  // Repli de dernier recours : une CAMÉRA D'ÉPAULE, 1,3 m derrière et juste au-dessus de
  // l'épaule — et non plus perchée à la verticale. Monter était la mauvaise réponse : dehors
  // on ne voyait plus où l'on allait (78° contre un étal), et à l'estaminet la caméra passait
  // au-dessus d'une poutre de 2,70 m qui cachait tout. Si l'épaule frôle le mur, ses faces
  // vues de l'intérieur ne sont pas dessinées : Camille reste visible.
  if (dist < 1.4 * EP) { best.set(p.pos.x - Math.sin(yaw) * 1.3 * EP, head.y + 0.45 * EP, p.pos.z - Math.cos(yaw) * 1.3 * EP); }
  best.y = Math.min(Math.max(best.y, getH(best.x, best.z, best.y) + 1.0), G.camMaxY);
  if (G.snapCam) camera.position.copy(best); else camera.position.lerp(best, 1 - Math.exp(-10 * dt));
  camera.lookAt(p.pos.x, p.pos.y + 1.5 * EP, p.pos.z);
  bokeh.uniforms.focus.value = camera.position.distanceTo(p.pos) + 2;
  sun.position.copy(p.pos).addScaledVector(SUN_DIR, 130); sun.target.position.copy(p.pos);
}

// =====================================================================
//  Histoire : cinématiques, dialogues, journal de quêtes (v14)
// =====================================================================
// éléments d'interface créés ici pour ne pas toucher aux pages HTML
const cineUI = (() => {
  const mk = (id, css) => { const d = document.createElement('div'); d.id = id; d.style.cssText = css; document.body.appendChild(d); return d; };
  const barCss = 'position:fixed;left:0;right:0;height:0;background:#000;z-index:4;transition:height .6s ease;pointer-events:none;';
  const top = mk('cineTop', barCss + 'top:0;'), bot = mk('cineBot', barCss + 'bottom:0;');
  const sub = mk('cineSub', 'position:fixed;left:50%;bottom:11%;transform:translateX(-50%);max-width:820px;width:80%;padding:14px 26px;border-radius:12px;background:rgba(8,10,22,.82);border:2px solid rgba(255,231,163,.75);color:#fff;font:19px/1.45 "Trebuchet MS","Segoe UI",sans-serif;text-align:center;text-shadow:0 2px 3px rgba(0,0,0,.7);opacity:0;transition:opacity .25s;z-index:5;pointer-events:none;');
  const who = document.createElement('div'); who.style.cssText = 'font-weight:bold;color:#ffe7a3;letter-spacing:1px;margin-bottom:4px;font-size:16px;'; sub.appendChild(who);
  const txt = document.createElement('div'); sub.appendChild(txt);
  const hint = document.createElement('div'); hint.style.cssText = 'font-size:12px;opacity:.7;margin-top:6px;'; hint.textContent = 'Entrée ▸'; sub.appendChild(hint);
  const title = mk('cineTitle', 'position:fixed;left:50%;top:38%;transform:translateX(-50%);color:#ffe7a3;font:bold 46px/1.2 "Trebuchet MS","Segoe UI",sans-serif;letter-spacing:3px;text-align:center;text-shadow:0 4px 0 #5a3a12,0 8px 24px rgba(0,0,0,.9);opacity:0;transition:opacity .8s;z-index:5;pointer-events:none;white-space:nowrap;');
  const tmain = document.createElement('div'); title.appendChild(tmain);
  const tsub = document.createElement('div'); tsub.style.cssText = 'font-size:20px;font-weight:normal;letter-spacing:2px;color:#fff;opacity:.9;margin-top:6px;'; title.appendChild(tsub);
  const journal = mk('journal', 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,8,20,.8);z-index:6;color:#fff;font-family:"Trebuchet MS","Segoe UI",sans-serif;');
  return { top, bot, sub, who, txt, hint, title, tmain, tsub, journal };
})();
export const cut = { active: false, steps: [], i: -1, t: 0, onEnd: null, cur: null, typed: 0 };
const hudEl = document.getElementById('hud');
function bars(on) { cineUI.top.style.height = cineUI.bot.style.height = on ? '11vh' : '0'; if (hudEl) hudEl.style.opacity = on ? 0 : 1; }
export function cutscene(steps, onEnd) {
  if (cut.active) { cut.steps = cut.steps.slice(0, cut.i + 1).concat(steps); return; }
  cut.active = true; cut.steps = steps; cut.i = -1; cut.t = 0; cut.onEnd = onEnd || null; bars(true);
  for (const k in keys) keys[k] = false; pressed.clear(); player.walkTo = null;
  cutNext();
}
function showSub(text, who) {
  if (!text) { cineUI.sub.style.opacity = 0; return; }
  cineUI.who.textContent = who || ''; cineUI.who.style.display = who ? '' : 'none'; cineUI.txt.textContent = text; cineUI.sub.style.opacity = 1; cut.typed = 0;
}
function cutNext() {
  cut.i++; cut.t = 0; cut.cur = cut.steps[cut.i] || null;
  if (!cut.cur) { cutEnd(); return; }
  const c = cut.cur;
  if (c.fn) c.fn();
  const instant = c.dur === undefined && c.say === undefined && !c.walk && !(c.actor && c.to);
  if (c.cam) G.freeCam = { pos: { x: c.cam[0], y: c.cam[1], z: c.cam[2] }, at: { x: c.at[0], y: c.at[1], z: c.at[2] } };
  if (c.follow) G.freeCam = null;
  if (c.say !== undefined) { showSub(c.say, c.who); cineUI.hint.style.display = ''; }
  else if (c.text) { showSub(c.text, c.who); cineUI.hint.style.display = 'none'; }
  else showSub(null);
  if (!c.title) cineUI.title.style.opacity = 0;
  if (c.title) { cineUI.tmain.textContent = c.title; cineUI.tsub.textContent = c.sub || ''; cineUI.title.style.opacity = 1; }
  if (c.walk) { player.walkTo = { x: c.walk[0], z: c.walk[1] }; player.walkSpeed = c.speed || 4.5; player.pose = null; }
  if (c.pose !== undefined) player.pose = c.pose ? { kind: c.pose, pos: c.pos, yaw: c.yaw } : null;
  if (c.fade !== undefined) fadeTo(c.fade, null);
  if (c.shake) G.shake = c.shake;
  if (c.actor && c.to) { c.actor.userData.walkTo = { x: c.to[0], z: c.to[1], speed: c.speed || 3 }; }
  if (instant) cutNext();
}
// Entrée pendant une cinématique : ferme la réplique en cours ou saute l'étape chronométrée
export function cutAdvance(force = false) { if (!cut.active || !cut.cur) return; const c = cut.cur; if (force || c.say !== undefined || c.skippable !== false && c.dur !== undefined) cutNext(); }
function cutEnd() {
  cut.active = false; cut.cur = null; G.freeCam = null; showSub(null); cineUI.title.style.opacity = 0; bars(false); player.walkTo = null;
  if (G.fadeTarget === 1 && !G.fadeCb) fadeTo(0, null);
  const f = cut.onEnd; cut.onEnd = null; if (f) f();
}
function cutTick(dt) {
  if (!cut.active || !cut.cur) return;
  const c = cut.cur; cut.t += dt * (G.cutSpeed || 1);
  if (c.cam && c.cam2) { const k = smooth(clamp(cut.t / (c.dur || 3), 0, 1)); const at2 = c.at2 || c.at;
    G.freeCam = { pos: { x: lerp(c.cam[0], c.cam2[0], k), y: lerp(c.cam[1], c.cam2[1], k), z: lerp(c.cam[2], c.cam2[2], k) }, at: { x: lerp(c.at[0], at2[0], k), y: lerp(c.at[1], at2[1], k), z: lerp(c.at[2], at2[2], k) } }; }
  if (c.actor && c.actor.userData.walkTo) actorWalk(c.actor, dt);
  let done = false;
  if (c.say !== undefined) done = false;
  else if (c.walk) done = !player.walkTo || cut.t > (c.timeout || 8);
  else if (c.actor && c.to) done = !c.actor.userData.walkTo || cut.t > (c.timeout || 8);
  else if (c.dur !== undefined) done = cut.t >= c.dur;
  else done = true;
  if (done) cutNext();
}
const smooth = (t) => t * t * (3 - 2 * t);
// déplacement d'un PNJ scripté (jambes animées si le modèle en a)
export function actorWalk(a, dt) {
  const w = a.userData.walkTo; if (!w) return;
  const dx = w.x - a.position.x, dz = w.z - a.position.z, d = Math.hypot(dx, dz);
  if (d < 0.3) { a.userData.walkTo = null; const ud = a.userData; if (ud.legs) { ud.legs[0].rotation.x = ud.legs[1].rotation.x = 0; } return; }
  a.position.x += dx / d * w.speed * dt; a.position.z += dz / d * w.speed * dt; a.rotation.y = lerpAngle(a.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
  a.userData.walkAnim = (a.userData.walkAnim || 0) + dt * (w.speed > 3.5 ? 5 : 7);
  const ud = a.userData, sw = Math.sin(ud.walkAnim) * 0.55;
  if (ud.legs) { ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw; if (ud.legs[0].userData.knee) { ud.legs[0].userData.knee.rotation.x = Math.max(0, sw); ud.legs[1].userData.knee.rotation.x = Math.max(0, -sw); } }
  if (ud.arms) { ud.arms[0].rotation.x = -sw * 0.5; ud.arms[1].rotation.x = sw * 0.5; }
}
// un PNJ suit une cible (le prince derrière Camille) : s'arrête à `dist`, marche à `speed`
export function followActor(a, dt, target, dist = 2.5, speed = 5) {
  const dx = target.x - a.position.x, dz = target.z - a.position.z, d = Math.hypot(dx, dz);
  if (d > 30) { a.position.set(target.x - dx / d * 2, target.y, target.z - dz / d * 2); }
  if (d > dist) a.userData.walkTo = { x: target.x - dx / d * (dist - 0.6), z: target.z - dz / d * (dist - 0.6), speed: d > dist + 6 ? speed * 1.6 : speed };
  if (a.userData.walkTo) actorWalk(a, dt); else a.rotation.y = lerpAngle(a.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-4 * dt));
  a.position.y = getH(a.position.x, a.position.z, a.position.y + 0.5);
}
// dialogue simple : suite de répliques (Entrée pour avancer), puis rappel
export function dialogue(lines, onEnd) { cutscene(lines.map(l => (typeof l === 'string' ? { say: l } : { say: l.text, who: l.who, fn: l.fn })), onEnd); }

// ---------- quêtes ----------
export const QUESTS = {
  cat: { title: 'Le chat de Cornélie', steps: ['Cornélie, au village, a perdu son chat Pralin. Il adore grimper sur les toits et les remparts…', 'Pralin est retrouvé ! Va rassurer Cornélie au village.', 'Terminée — Cornélie t\'a offert un réceptacle de cœur.'] },
  crows: { title: 'Le champ d\'Émile', steps: ['Émile, le meunier, veut que tu chasses les 4 corbeaux qui pillent son champ, près du moulin (à l\'ouest du pont).', 'Les corbeaux sont partis. Retourne voir Émile au village.', 'Terminée — Émile t\'a donné une gaufre de force (un cœur de plus).'] },
  ghosts: { title: 'La ronde de Désiré', steps: ['Désiré, l\'ancien guetteur, n\'ose plus monter au beffroi tant que les 5 fantômes des remparts rôdent. Chasse-les.', 'Les remparts sont calmes. Va le dire à Désiré.', 'Terminée — Désiré t\'a confié le cœur de la garnison.'] },
};
export function questStep(id) { return state['q_' + id] || 0; }
export function setQuest(id, step, silent = false) {
  if ((state['q_' + id] || 0) >= step) return;
  state['q_' + id] = step; if (!silent) { showMessage((step >= 3 ? 'Quête terminée : ' : step === 1 ? 'Nouvelle quête : ' : 'Journal mis à jour : ') + QUESTS[id].title + '  (J : journal)', 4); SFX.pickup(); }
  saveGame(true);
}
export function openJournal() {
  G.journal = true; state.paused = true; releaseMouse();
  const main = G.level && G.level.objective ? G.level.objective() : '';
  const side = Object.keys(QUESTS).filter(id => questStep(id) > 0).map(id => { const q = QUESTS[id], st = questStep(id); return `<div style="margin:10px 0;padding:10px 14px;border-left:4px solid ${st >= 3 ? '#7ad27a' : '#ffe7a3'};background:rgba(255,255,255,.06);border-radius:6px"><b style="color:${st >= 3 ? '#7ad27a' : '#ffe7a3'}">${q.title}</b>${st >= 3 ? ' ✓' : ''}<br><span style="opacity:.9">${q.steps[Math.min(st, 3) - 1]}</span></div>`; }).join('') || '<div style="opacity:.7;margin:10px 0">Aucune quête secondaire pour l\'instant. Parle aux habitants du village !</div>';
  const hearts = `${player.maxHp / 2} cœurs`, items = [state.sword ? 'Épée' : null, state.bow ? 'Arc' : null, state.key ? 'Clé du donjon' : null, state.cageKey ? 'Clé de la cage' : null].filter(Boolean).join(', ') || 'rien';
  cineUI.journal.innerHTML = `<div style="max-width:760px;width:88%;max-height:84vh;overflow:auto;background:radial-gradient(ellipse at top,rgba(30,40,80,.95),rgba(8,10,22,.97));border:2px solid rgba(255,231,163,.6);border-radius:16px;padding:26px 34px;box-shadow:0 20px 60px rgba(0,0,0,.7)">
    <h2 style="margin:0 0 4px;color:#ffe7a3;letter-spacing:2px">JOURNAL DE CAMILLE</h2><div style="opacity:.75;font-size:14px;margin-bottom:14px">Vie : ${hearts} &nbsp;·&nbsp; Équipement : ${items} &nbsp;·&nbsp; Monstres vaincus : ${state.kills}</div>
    <h3 style="margin:14px 0 6px;color:#ff9fb0;font-size:16px;letter-spacing:1px">QUÊTE PRINCIPALE — Sauver Eugène</h3><div style="padding:10px 14px;border-left:4px solid #ff9fb0;background:rgba(255,255,255,.06);border-radius:6px">${main}</div>
    <h3 style="margin:18px 0 6px;color:#ffe7a3;font-size:16px;letter-spacing:1px">QUÊTES SECONDAIRES</h3>${side}
    <div style="margin-top:16px;font-size:13px;opacity:.7;text-align:center"><kbd style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);border-radius:5px;padding:2px 8px">J</kbd> ou <kbd style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);border-radius:5px;padding:2px 8px">Échap</kbd> pour fermer</div></div>`;
  cineUI.journal.style.display = 'flex';
}
export function closeJournal() { G.journal = false; state.paused = false; cineUI.journal.style.display = 'none'; for (const k in keys) keys[k] = false; pressed.clear(); }

// ---------- personnages de l'histoire ----------
// le prince Eugène : tunique pourpre, cape, couronne
export function makePrince() {
  const g = new THREE.Group();
  const skin = mat(SKIN, { roughness: 0.65 }), tunic = mat(0x5a2a7a, { roughness: 0.8 }), pants = mat(0xe8e0d0, { roughness: 0.9 }), cape = mat(0xb02030, { roughness: 0.9, side: THREE.DoubleSide });
  g.add(makeTorso({ top: tunic, bottom: pants, belt: GOLD(), width: 1.0 }));
  for (let k = 0; k < 5; k++) g.add(mesh(sphG(0.022, 6), GOLD(), 0, 1.4 + k * 0.13, 0.36)); // boutons dorés
  g.add(mesh(boxG(0.3, 0.5, 0.02), mat(0xd9b24a, { metalness: 0.6, roughness: 0.4 }), 0, 1.75, 0.37)); // plastron brodé
  const cp = mesh(new THREE.CylinderGeometry(0.42, 0.66, 1.4, 14, 1, true, Math.PI * 0.55, Math.PI * 0.9), cape, 0, 1.35, 0); g.add(cp);
  g.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), GOLD(), 0, 2.0, 0).rotateX(Math.PI / 2)); g.add(mesh(sphG(0.05, 8), mat(0xd02040, { emissive: 0x400010 }), 0, 2.0, 0.22)); // broche
  const headG = makeHead({ skin: SKIN, hair: 0xc8a050, style: 'short', iris: 0x4a5a8a, r: 0.38 }); headG.position.set(0, 2.4, 0); g.add(headG); const head = headG;
  const crown = new THREE.Group(); crown.position.y = 2.82; crown.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 14, 1, true), GOLD(), 0, 0, 0)); crown.add(mesh(new THREE.TorusGeometry(0.31, 0.02, 6, 20), GOLD(), 0, -0.06, 0).rotateX(Math.PI / 2));
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; crown.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), GOLD(), Math.cos(a) * 0.3, 0.13, Math.sin(a) * 0.3)); crown.add(mesh(sphG(0.035, 6), mat([0xd02040, 0x2060d0, 0x20b060][i % 3], { emissive: 0x201010 }), Math.cos(a) * 0.3, 0.22, Math.sin(a) * 0.3)); }
  g.add(crown);
  const legs = []; for (const sx of [-1, 1]) { const hip = makeLeg(sx, { cloth: pants, boot: mat(0x2a1a10) }); hip.position.set(sx * 0.17, 0.95, 0); g.add(hip); legs.push(hip); }
  const arms = []; for (const sx of [-1, 1]) { const sh = makeArm(sx, { skin, sleeve: tunic, cuff: GOLD() }); sh.position.set(sx * 0.46, 1.95, 0); g.add(sh); arms.push(sh); }
  g.userData = { legs, arms, head, dynamic: true, name: 'Eugène' };
  return g;
}
// le chat Pralin (quête de Cornélie)
export function makeCat(color = 0xe0a050) {
  const cat = new THREE.Group(); cat.userData.dynamic = true;
  const fur = mat(color, { roughness: 1 }); const body = mesh(capG(0.24, 0.35, 10), fur, 0, 0.3, 0); body.rotation.x = Math.PI / 2; cat.add(body);
  cat.add(mesh(sphG(0.2, 10), fur, 0, 0.42, 0.42)); for (const sx of [-1, 1]) cat.add(mesh(new THREE.ConeGeometry(0.07, 0.16, 4), fur, sx * 0.1, 0.62, 0.4));
  for (const sx of [-1, 1]) cat.add(mesh(sphG(0.03, 6), mat(0x40ff80, { emissive: 0x20a050, emissiveIntensity: 0.8 }), sx * 0.07, 0.45, 0.6));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cat.add(mesh(capG(0.05, 0.16, 6), fur, sx * 0.14, 0.13, sz * 0.25));
  const tail = mesh(capG(0.04, 0.6, 6), fur, 0.2, 0.4, -0.4); tail.rotation.z = -0.8; tail.rotation.x = 0.5; cat.add(tail); cat.userData.tail = tail;
  return cat;
}
// cage de fer du prince
export function makeCage(r = 1.4, h = 3.2) {
  const g = new THREE.Group(); const m = IRON();
  for (let i = 0; i < 14; i++) { const a = i * TAU / 14; g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 6), m, Math.cos(a) * r, h / 2, Math.sin(a) * r)); }
  for (const y of [0.15, h / 2, h - 0.15]) g.add(mesh(new THREE.TorusGeometry(r, 0.06, 6, 24), m, 0, y, 0).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.12, 24), m, 0, 0.06, 0)); g.add(mesh(sphG(0.2, 8), m, 0, h + 0.25, 0));
  const door = new THREE.Group(); door.position.set(Math.cos(-0.35) * r, 0, Math.sin(-0.35) * r);
  for (let i = 1; i <= 2; i++) { const a = -0.35 + i * 0.45; door.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 6), m, Math.cos(a) * r - door.position.x, h / 2, Math.sin(a) * r - door.position.z)); }
  g.add(door); g.userData = { door, dynamic: true };
  return g;
}

// =====================================================================
//  Boucle principale (le niveau fournit update/animate)
// =====================================================================
const fadeEl = document.getElementById('fade');
// ---------------------------------------------------------------------
//  Le compteur de rendu (F3)
// ---------------------------------------------------------------------
// Ce que coûte l'image, sur la machine du joueur : sans lui, on optimise à l'aveugle.
// Les appels et triangles sont ceux de l'IMAGE ENTIÈRE — ombre et post-traitement compris :
// le compteur de three.js n'est remis à zéro qu'une fois par image (et non à chaque passe,
// où il ne gardait que la dernière, la sortie plein écran : deux triangles).
renderer.info.autoReset = false;
const perfUI = (() => { const d = document.createElement('div'); d.id = 'hudPerf';
  d.style.cssText = 'position:fixed;right:14px;top:200px;z-index:6;display:none;padding:8px 11px;border-radius:8px;background:rgba(8,10,22,.78);color:#e8f0ff;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre;pointer-events:none;';
  document.body.appendChild(d); return d; })();
const perfMes = { t: 0, images: 0, js: 0 };
window.addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); perfUI.style.display = perfUI.style.display === 'none' ? 'block' : 'none'; } });
function majPerfUI(dt, js) {
  perfMes.t += dt; perfMes.images++; perfMes.js += js;
  if (perfMes.t < 0.5 || perfUI.style.display === 'none') { if (perfMes.t >= 0.5) { perfMes.t = 0; perfMes.images = 0; perfMes.js = 0; } return; }
  const i = renderer.info;
  perfUI.textContent = `${(perfMes.images / perfMes.t).toFixed(0)} img/s   JS ${(perfMes.js / perfMes.images).toFixed(1)} ms\n`
    + `appels    ${i.render.calls}\ntriangles ${(i.render.triangles / 1e6).toFixed(2)} M\n`
    + `géométries ${i.memory.geometries}  textures ${i.memory.textures}\n`
    + `qualité ${Q.level + 1}  ombre ${sun.castShadow ? 'oui' : 'non'}  post ${G.postFX ? 'oui' : 'non'}\n`
    + `lumières ${POOL.lampes.length ? POOL.lampes.length + ' / ' + POOL.sources.length : 'directes'}`;
  perfMes.t = 0; perfMes.images = 0; perfMes.js = 0;
}

let last = performance.now();
function loop(now) {
  const debutJS = performance.now();
  renderer.info.reset();
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (sky && sky.material.uniforms && sky.material.uniforms.time) sky.material.uniforms.time.value = now * 0.001;
  const L = G.level;
  if (state.running && !state.over && !state.paused) {
    state.time += dt; Q.tick(dt);
    updatePlayer(dt); lieuxTick();
    for (const e of enemies) updateEnemy(e, dt);
    updateArrows(dt); updateShockwaves(dt); updateParticles(dt);
    if (L.update) L.update(dt);
    cutTick(dt);
    state.saveT += dt; if (state.saveT > 20) { state.saveT = 0; saveGame(true); }
    const z = world.zoneName(player.pos.x, player.pos.z);
    if (z !== curZone) { curZone = z; zoneEl.textContent = z; zoneEl.style.opacity = 1; zoneT = 2.5; }
    if (zoneT > 0) { zoneT -= dt; if (zoneT <= 0) zoneEl.style.opacity = 0; }
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) msgEl.style.opacity = 0; }
    drawHearts(); drawMinimap(); updateCounts(); majAide();
  } else if (!state.running && L.titleCamera) {
    L.titleCamera(now); updatePlayer(0); drawHearts();
  }
  for (const g of pickups) { g.t += dt * 2; g.mesh.rotation.y = g.t; g.mesh.position.y = getH(g.pos.x, g.pos.z) + 0.8 + Math.sin(g.t * 2) * 0.15; }
  if (L.animate) L.animate(now, dt);
  if (state.running && !state.paused) updateCamera(dt);
  if (G.freeCam) { const f = G.freeCam; camera.position.set(f.pos.x, f.pos.y, f.pos.z); camera.lookAt(f.at.x, f.at.y, f.at.z); }
  if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt * 1.2); const a = G.shake * 0.35; camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; }
  if (sky) sky.position.copy(camera.position);
  // fondu au noir
  if (G.fade !== G.fadeTarget) { G.fade = clamp(G.fade + Math.sign(G.fadeTarget - G.fade) * dt * 2.5, 0, 1); if (Math.abs(G.fade - G.fadeTarget) < 0.03) { G.fade = G.fadeTarget; if (G.fadeCb) { const cb = G.fadeCb; G.fadeCb = null; cb(); } } fadeEl.style.opacity = clamp(G.fade, 0, 1); }
  majPool();
  if (G.postFX) composer.render(); else renderer.render(scene, camera);
  majPerfUI(dt, performance.now() - debutJS);
}
export function startLoop() { requestAnimationFrame(loop); }

// =====================================================================
//  Fusion des meshes statiques par matériau (réduit fortement le nombre de draw calls)
// =====================================================================
function matKey(m) {
  return [m.type, m.color ? m.color.getHex() : '', m.map ? m.map.uuid : '', m.normalMap ? m.normalMap.uuid : '', m.roughness, m.metalness, m.transparent ? m.opacity : 1, m.side,
    m.emissive ? m.emissive.getHex() + ':' + m.emissiveIntensity : '', m.alphaTest, m.vertexColors ? 'vc' : '', m.envMapIntensity ?? '', m.depthWrite,
    m.roughnessMap ? m.roughnessMap.uuid : '', m.userData.patineOpts || ''].join('|');
}

// ---------------------------------------------------------------------
//  L'unification des matériaux
// ---------------------------------------------------------------------
// La fusion réunit ce qui partage un matériau — mais presque chaque mur avait le sien.
// phMat(), pbrRepeat() et brickScaled() CLONENT la texture pour lui donner la répétition
// qui colle à la taille du mur : deux façades de brique identiques, l'une de 6 m et l'autre
// de 8 m, portaient deux textures, donc deux matériaux, donc deux appels de dessin.
// La répétition passe donc de la texture aux coordonnées du maillage : on multiplie ses UV
// par la répétition (et on ajoute le décalage), la texture retombe à 1 × 1 et devient la
// même pour tous — l'image est rigoureusement identique, le motif étant répété par le
// bouclage (RepeatWrapping) au lieu de la matrice de texture. Les matériaux devenus égaux
// en tout sont ensuite fondus en un seul, que mergeStatics et regrouperLots réunissent.
//
// Prudence, parce que la fusion est irréversible :
//   - on ne modifie JAMAIS un matériau ni une texture existants : T.stone.map, stoneMat,
//     brickMat sont partagés par tout le jeu, y compris par ce qui naîtra après le
//     chargement avec des UV non réécrites. Les décors immobiles reçoivent des COPIES ;
//   - seuls les décors immobiles (même filtre que mergeStatics) sont traités ;
//   - une géométrie partagée avec un maillage qui ne reçoit pas la même transformation
//     (autre répétition, ou maillage non traité) est copiée avant qu'on ne réécrive ses UV ;
//   - toutes les cartes du matériau doivent avoir la même transformation, sans rotation ;
//   - un matériau à shader modifié autre que la patine (nature.js) n'est pas touché, ni
//     un matériau transparent ;
//   - un décor dont le code ANIME le matériau doit porter userData.dynamic — c'est déjà la
//     règle de mergeStatics, et c'est elle qui le protège ici aussi.
const CARTES = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap'];
function statique(o) {
  if (!o.isMesh || o.isInstancedMesh || o.isBatchedMesh || o.isSkinnedMesh || o.isSprite || o.userData.flag || o.userData.cloud || o.userData.smoke !== undefined) return false;
  if (Array.isArray(o.material) || o.morphTargetInfluences) return false;
  let a = o; while (a) { if (a.userData.dynamic || a.userData.morcele) return false; a = a.parent; }
  return true;
}
// tout matériau a un onBeforeCompile — vide, hérité de la classe : seul un crochet posé
// par le jeu (patine, nature.js) compte
const shaderModifie = (m) => m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile;
function cleTexture(t) {
  return [t.source.uuid, t.wrapS, t.wrapT, t.colorSpace, t.anisotropy, t.magFilter, t.minFilter, t.generateMipmaps,
    t.flipY, t.premultiplyAlpha, t.format, t.type, t.channel].join(':');
}
function cleMateriau(m) {
  const v = (x) => (x && x.isColor ? x.getHex() : x && x.isVector2 ? x.x + ',' + x.y : x);
  const champs = ['type', 'color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'opacity', 'transparent',
    'side', 'alphaTest', 'vertexColors', 'envMapIntensity', 'depthWrite', 'depthTest', 'normalScale', 'bumpScale',
    'aoMapIntensity', 'displacementScale', 'flatShading', 'fog', 'polygonOffset', 'polygonOffsetFactor',
    'polygonOffsetUnits', 'blending', 'toneMapped', 'wireframe', 'visible', 'alphaToCoverage', 'dithering'];
  return champs.map((k) => v(m[k])).join('|') + '|' + CARTES.map((k) => (m[k] ? m[k].uuid : '')).join('|')
    + '|' + (m.userData.patineOpts || '');
}
export function unifierMateriaux() {
  // qui porte quoi : un matériau ou une géométrie partagés avec un maillage non traité
  // décident de la prudence
  const usagesMat = new Map(), usagesGeo = new Map();
  scene.traverse((o) => {
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) if (m) { if (!usagesMat.has(m)) usagesMat.set(m, []); usagesMat.get(m).push(o); }
    if (o.geometry) { if (!usagesGeo.has(o.geometry)) usagesGeo.set(o.geometry, []); usagesGeo.get(o.geometry).push(o); }
  });
  const transfo = new Map();            // matériau -> [sx, sy, tx, ty], ou null s'il est écarté
  const porteurUtile = (o) => statique(o) && o.geometry && o.geometry.attributes.uv && o.geometry.attributes.uv.itemSize === 2;
  const ecartes = {};                   // pourquoi un matériau n'est pas traité : le bilan le dit
  const ecarter = (m, r) => { ecartes[r] = (ecartes[r] || 0) + 1; transfo.set(m, null); };
  for (const [m, porteurs] of usagesMat) {
    const cartes = CARTES.map((k) => m[k]).filter(Boolean);
    if (!cartes.length) { ecarter(m, 'sans texture'); continue; }
    if (!porteurs.some(porteurUtile)) { ecarter(m, 'aucun décor immobile'); continue; }
    if (shaderModifie(m) && !m.userData.patine) { ecarter(m, 'shader modifié'); continue; }
    if (m.transparent) { ecarter(m, 'transparent'); continue; }
    const c0 = cartes[0];
    if (!cartes.every((c) => c.repeat.equals(c0.repeat) && c.offset.equals(c0.offset) && c.center.equals(c0.center))) { ecarter(m, 'cartes dépareillées'); continue; }
    if (!cartes.every((c) => c.rotation === 0 && c.matrixAutoUpdate && c.channel === 0 && !c.isCubeTexture && !c.isVideoTexture)) { ecarter(m, 'rotation ou canal'); continue; }
    const identite = c0.repeat.x === 1 && c0.repeat.y === 1 && c0.offset.x === 0 && c0.offset.y === 0;
    // hors bouclage, reporter la répétition sur les UV changerait l'image aux bords
    const boucle = cartes.every((c) => c.wrapS === THREE.RepeatWrapping && c.wrapT === THREE.RepeatWrapping);
    if (!identite && !boucle) { ecarter(m, 'sans bouclage'); continue; }
    // u' = sx·u + (cx − sx·cx + tx) : la matrice de three.js, sans rotation
    const { x: sx, y: sy } = c0.repeat, { x: cx, y: cy } = c0.center;
    transfo.set(m, [sx, sy, cx - sx * cx + c0.offset.x, cy - sy * cy + c0.offset.y]);
  }

  // la transformation que recevra un maillage, ou null s'il n'est pas traité
  const cleDe = (o) => { const t = porteurUtile(o) && transfo.get(o.material); return t ? t.join(',') : null; };

  // 1. les UV : chaque géométrie reçoit la répétition de son matériau
  const faite = new Map();              // géométrie -> clé de transformation appliquée
  let copies = 0, reecrites = 0;
  for (const [m, t] of transfo) {
    if (!t) continue;
    const cle = t.join(',');
    for (const o of usagesMat.get(m)) {
      if (!porteurUtile(o)) continue;
      let g = o.geometry;
      // partagée avec un maillage qui ne recevra pas la même transformation : copie
      const partage = usagesGeo.get(g).some((u) => cleDe(u) !== cle);
      if (partage || (faite.has(g) && faite.get(g) !== cle)) { g = g.clone(); o.geometry = g; copies++; }
      if (faite.get(g) === cle) continue;
      if (t[0] !== 1 || t[1] !== 1 || t[2] !== 0 || t[3] !== 0) {
        const uv = g.attributes.uv;
        let u0 = Infinity, v0 = Infinity;
        for (let i = 0; i < uv.count; i++) {
          const u = uv.getX(i) * t[0] + t[2], v = uv.getY(i) * t[1] + t[3];
          uv.setXY(i, u, v); if (u < u0) u0 = u; if (v < v0) v0 = v;
        }
        // Une grande dalle répétée cent fois porte des UV de l'ordre de la centaine, et la
        // carte graphique perd en précision à les échantillonner : les pavés scintillaient.
        // Le bouclage rend un décalage ENTIER invisible — on ramène donc chaque maillage
        // près de zéro.
        const du = Math.floor(u0), dv = Math.floor(v0);
        if (du || dv) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) - du, uv.getY(i) - dv);
        uv.needsUpdate = true; reecrites++;
      }
      faite.set(g, cle);
    }
  }

  // 2. les textures : une par image, à 1 × 1 — des clones, qui partagent l'image (three.js
  // n'envoie qu'une fois à la carte graphique une même source aux mêmes réglages)
  const canon = new Map();
  const texCanon = (c) => {
    const ct = cleTexture(c);
    if (!canon.has(ct)) {
      const n = c.clone(); n.repeat.set(1, 1); n.offset.set(0, 0); n.center.set(0, 0); n.updateMatrix(); n.needsUpdate = true;
      canon.set(ct, n);
    }
    return canon.get(ct);
  };

  // 3. une copie de chaque matériau, sur ces textures ; les copies égales en tout n'en font
  // plus qu'une
  const uniques = new Map();
  let copiesMat = 0;
  for (const [m, t] of transfo) {
    if (!t) continue;
    // Material.clone() recopie userData en JSON : l'objet shader que la patine y range à la
    // compilation est circulaire. On l'écarte le temps de la copie ; la patine elle-même
    // (onBeforeCompile) ne se copie pas, on la repose avec les mêmes réglages.
    const ud = m.userData, { shaderPatine, ...reste } = ud;
    m.userData = reste;
    let n;
    try { n = m.clone(); } finally { m.userData = ud; }
    for (const k of CARTES) if (m[k]) n[k] = texCanon(m[k]);
    if (ud.patine) { n.userData.patine = false; patiner(n, JSON.parse(ud.patineOpts)); }
    const k = cleMateriau(n);
    if (!uniques.has(k)) { uniques.set(k, n); copiesMat++; }
    for (const o of usagesMat.get(m)) if (porteurUtile(o)) o.material = uniques.get(k);
  }
  const traites = [...transfo.values()].filter(Boolean).length;

  // 4. LES MATÉRIAUX UNIS. Les deux tiers des matériaux n'ont pas de texture : ce sont les
  // décors bâtis en primitives, un mat(0x…) par pièce, qui ne diffèrent que par la
  // couleur — et chaque couleur coûtait son appel de dessin. La couleur passe dans les
  // sommets (attribut « color », multiplié par un matériau blanc) : le calcul d'éclairage
  // est le même, la couleur arrive seulement par un autre chemin, et toutes les pièces
  // d'une même matière (même rugosité, même métal, même émissif…) n'en font plus qu'une.
  const teinte = new Map();             // matériau -> couleur (espace linéaire, celui du rendu)
  for (const [m, porteurs] of usagesMat) {
    if (transfo.get(m) || CARTES.some((k) => m[k]) || !m.color || m.vertexColors) continue;
    if (shaderModifie(m) && !m.userData.patine) continue;
    // transparents à part : du code en anime l'opacité par `maillage.material` (les rais de
    // la chapelle) — partagée, l'animation de l'un s'appliquerait à tous
    if (m.transparent) continue;
    if (!(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial)) continue;
    if (!porteurs.some(statique)) continue;
    teinte.set(m, m.color.clone());
  }
  const cleTeinte = (o) => (statique(o) && teinte.has(o.material) ? teinte.get(o.material).getHexString(THREE.LinearSRGBColorSpace) : null);
  const peinte = new Map();             // géométrie -> teinte posée
  let copiesTeinte = 0;
  for (const [m, c] of teinte) {
    const cle = c.getHexString(THREE.LinearSRGBColorSpace);
    for (const o of usagesMat.get(m)) {
      if (!statique(o)) continue;
      let g = o.geometry;
      if (usagesGeo.get(g).some((u) => cleTeinte(u) !== cle) || (peinte.has(g) && peinte.get(g) !== cle)) {
        g = g.clone(); o.geometry = g; copiesTeinte++;
      }
      if (peinte.get(g) === cle) continue;
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3));
      peinte.set(g, cle);
    }
  }
  const unis = new Map();
  for (const m of teinte.keys()) {
    const ud = m.userData, { shaderPatine, ...reste } = ud;
    m.userData = reste;
    let n;
    try { n = m.clone(); } finally { m.userData = ud; }
    n.color.setRGB(1, 1, 1); n.vertexColors = true;
    if (ud.patine) { n.userData.patine = false; patiner(n, JSON.parse(ud.patineOpts)); }
    const k = cleMateriau(n);
    if (!unis.has(k)) unis.set(k, n);
    for (const o of usagesMat.get(m)) if (statique(o)) o.material = unis.get(k);
  }

  return { materiaux: usagesMat.size, traites, apres: copiesMat, textures: canon.size, uvReecrites: reecrites, copies, ecartes,
    unis: teinte.size, unisApres: unis.size, copiesTeinte };
}
// FUSION PAR TUILES. On fusionnait par matériau sur le monde entier : chaque maillage fusionné
// couvrait deux kilomètres, sa sphère englobante contenait toujours la caméra, et ni le
// frustum culling ni la carte d'ombre (un carré de 190 m) ne rejetaient rien. Mesuré sur la
// vue du bourg : 4,13 M triangles dessinés pour 4,36 M dans la scène. On fusionne désormais
// par matériau ET par tuile de TUILE m : peu d'appels de dessin, et ce qui est hors champ
// ou hors de l'ombre n'est plus envoyé à la carte graphique.
export const TUILE = 150;
export const cleTuile = (x, z) => Math.floor(x / TUILE) + ',' + Math.floor(z / TUILE);
const _bbFusion = new THREE.Box3(), _cFusion = new THREE.Vector3(), _tFusion = new THREE.Vector3();
export function mergeStatics() {
  scene.updateMatrixWorld(true);
  const groups = new Map(), toRemove = [], parMat = new Map();
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSprite || o.userData.flag || o.userData.cloud || o.userData.smoke !== undefined) return;
    if (Array.isArray(o.material) || o.morphTargetInfluences || o.geometry.index === null && !o.geometry.attributes.position) return;
    // userData.morcele : déjà découpé en morceaux qui partagent leurs sommets (le terrain) ;
    // le refusionner dupliquerait 380 000 triangles pour rien
    let a = o, dyn = false; while (a) { if (a.userData.dynamic || a.userData.morcele) { dyn = true; break; } a = a.parent; }
    if (dyn) return;
    if (o.geometry.attributes.color && !o.material.vertexColors) return;
    _bbFusion.setFromObject(o).getCenter(_cFusion);
    // PAS D'OMBRE SOUS LE MÈTRE. Un anneau, un clou, une bougie coûtaient un passage dans la
    // carte d'ombre pour une tache de quelques pixels. Le choix fait partie de la clé : on ne
    // fusionne pas ensemble ce qui porte ombre et ce qui n'en porte pas.
    _bbFusion.getSize(_tFusion);
    const porte = o.castShadow && Math.max(_tFusion.x, _tFusion.y, _tFusion.z) >= 1.0;
    const k = matKey(o.material) + '|' + cleTuile(_cFusion.x, _cFusion.z) + (porte ? '|o' : '|-');
    if (!groups.has(k)) groups.set(k, { mat: o.material, cle: matKey(o.material), items: [], cast: porte, recv: false });
    const g = groups.get(k); g.items.push(o); g.recv = g.recv || o.receiveShadow;
    parMat.set(g.cle, (parMat.get(g.cle) || 0) + 1);
  });
  let merged = 0, removed = 0;
  for (const g of groups.values()) {
    // SEUL DE SON MATÉRIAU DANS SA TUILE : il n'est pas fusionné, mais il est aussi immobile
    // que les autres — l'ancienne fusion, sur toute la carte, l'aurait absorbé. Il rejoint
    // les lots (regrouperLots). Ce qui est unique dans le MONDE entier reste intouché : il a
    // pu échapper à la fusion parce que du code l'anime.
    if (g.items.length < 2) {
      for (const o of g.items) if (parMat.get(g.cle) >= 2) { o.userData.fusionnable = true; o.castShadow = g.cast; }
      continue;
    }
    const geos = [];
    for (const o of g.items) {
      let ge = o.geometry.clone(); ge.applyMatrix4(o.matrixWorld);
      // uniformiser les attributs pour la fusion. « color » n'est gardé que si le matériau
      // l'utilise : le supprimer en laissant vertexColors = true rendrait la surface noire.
      const keep = g.mat.vertexColors ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
      for (const name of Object.keys(ge.attributes)) if (!keep.includes(name)) ge.deleteAttribute(name);
      if (!ge.attributes.normal) ge.computeVertexNormals();
      if (!ge.attributes.uv) { const n = ge.attributes.position.count; ge.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); }
      if (g.mat.vertexColors && !ge.attributes.color) {
        const n = ge.attributes.position.count;
        ge.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      }
      // déjà à plat, toNonIndexed() ne fait que râler : 1 281 avertissements à chaque chargement
      if (ge.index) ge = ge.toNonIndexed();
      geos.push(ge);
    }
    const mg = mergeGeometries(geos, false);
    if (!mg) continue;
    const m = new THREE.Mesh(mg, g.mat); m.castShadow = g.cast; m.receiveShadow = g.recv; m.frustumCulled = true; m.userData.fusionne = true; scene.add(m); merged++;
    for (const o of g.items) { toRemove.push(o); removed++; }
  }
  for (const o of toRemove) { if (o.parent) o.parent.remove(o); }
  return { merged, removed };
}

// ---------------------------------------------------------------------
//  Les lots (BatchedMesh)
// ---------------------------------------------------------------------
// Les tuiles ont rendu le hors-champ gratuit pour la carte graphique, mais chaque tuile
// visible reste un appel de dessin, et le processeur est devenu le goulot : 97 % du temps
// JavaScript de la boucle passait à préparer ~1 800 appels. Un BatchedMesh réunit tous les
// morceaux d'un même matériau en UN appel (multi-dessin) tout en gardant, morceau par
// morceau, la mise à l'écart hors champ et hors ombre.
// On ne regroupe que ce qui est garanti immobile — les produits de mergeStatics et les sacs
// du quartier (userData.fusionne). Un maillage resté seul de son matériau a pu échapper à
// la fusion parce que du code l'anime : on n'y touche pas. Le terrain (userData.morcele)
// non plus : ses morceaux partagent leurs sommets, un lot les copierait 72 fois.
export function regrouperLots() {
  const groupes = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || !(o.userData.fusionne || o.userData.fusionnable) || o.isBatchedMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.parent) return;
    const g = o.geometry, sig = Object.keys(g.attributes).sort().map((n) => n + g.attributes[n].itemSize).join() + (g.index ? '|i' : '');
    // par CLÉ de matériau, comme mergeStatics : deux tuiles du même matériau logique portent
    // souvent deux objets matériau distincts (le premier de chaque tuile)
    const k = matKey(o.material) + '|' + o.castShadow + o.receiveShadow + '|' + o.renderOrder + '|' + sig;
    if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(o);
  });
  let lots = 0, maillages = 0;
  for (const liste of groupes.values()) {
    if (liste.length < 2) continue;
    let nv = 0, ni = 0;
    for (const o of liste) { nv += o.geometry.attributes.position.count; ni += o.geometry.index ? o.geometry.index.count : 0; }
    const b = new THREE.BatchedMesh(liste.length, nv, Math.max(ni, 1), liste[0].material);
    b.castShadow = liste[0].castShadow; b.receiveShadow = liste[0].receiveShadow; b.renderOrder = liste[0].renderOrder;
    b.userData.lot = true;
    for (const o of liste) {
      o.updateWorldMatrix(true, false);
      const id = b.addGeometry(o.geometry); b.setMatrixAt(id, o.matrixWorld);
      o.parent.remove(o); o.geometry.dispose();
    }
    scene.add(b); lots++; maillages += liste.length;
  }
  return { lots, maillages };
}

// ---------------------------------------------------------------------
//  Les instances en tuiles
// ---------------------------------------------------------------------
// Les arbres de la forêt, les roseaux, les silhouettes du lointain : une InstancedMesh par
// essence sur toute la carte, 1,3 km de rayon, donc toujours dessinée — mesuré sur la vue du
// bourg, 1,0 M de triangles à l'image et 0,86 M dans l'ombre pour des arbres hors champ.
// Chaque instancié STATIQUE est découpé en tuiles de 2 × TUILE m (plus grandes que pour la
// fusion : un appel de dessin par tuile et par essence, il ne faut pas les multiplier).
// Ceux qui suivent Camille (userData.dynamic, le semis de nature.js) ne sont pas touchés.
// L'objet d'origine sort de la scène mais reste la poignée des réglages de qualité
// (game.js règle `castShadow` et `visible` sur lui) : les deux se propagent à ses tuiles.
export const INSTANCES_TUILEES = [];       // les originaux, hors scène : de quoi comparer
export function tuilerInstances() {
  const liste = [], m = new THREE.Matrix4(), p = new THREE.Vector3(), c = new THREE.Color(), T2 = 2 * TUILE;
  scene.traverse((o) => { if (o.isInstancedMesh && !o.userData.dynamic && o.count > 32 && o.parent) liste.push(o); });
  let decoupes = 0, tuiles = 0;
  for (const im of liste) {
    im.updateMatrixWorld(true);
    im.computeBoundingSphere();
    if (im.boundingSphere.radius * im.matrixWorld.getMaxScaleOnAxis() < T2) continue;
    const groupes = new Map();
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m); p.setFromMatrixPosition(m).applyMatrix4(im.matrixWorld);
      const k = Math.floor(p.x / T2) + ',' + Math.floor(p.z / T2);
      if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(i);
    }
    if (groupes.size < 2) continue;
    const enfants = [];
    for (const idx of groupes.values()) {
      const t = new THREE.InstancedMesh(im.geometry, im.material, idx.length);
      idx.forEach((i, j) => { im.getMatrixAt(i, m); t.setMatrixAt(j, m); if (im.instanceColor) { im.getColorAt(i, c); t.setColorAt(j, c); } });
      t.position.copy(im.position); t.quaternion.copy(im.quaternion); t.scale.copy(im.scale);
      t.castShadow = im.castShadow; t.receiveShadow = im.receiveShadow; t.renderOrder = im.renderOrder;
      t.frustumCulled = im.frustumCulled; t.visible = im.visible; t.layers.mask = im.layers.mask;
      t.computeBoundingSphere();
      im.parent.add(t); enfants.push(t);
    }
    im.parent.remove(im);
    for (const prop of ['castShadow', 'visible']) {
      let v = im[prop];
      Object.defineProperty(im, prop, { configurable: true, get: () => v, set: (x) => { v = x; for (const t of enfants) t[prop] = x; } });
    }
    im.userData.tuiles = enfants; INSTANCES_TUILEES.push(im);
    decoupes++; tuiles += enfants.length;
  }
  return { decoupes, tuiles };
}

// ---------------------------------------------------------------------
//  Le réservoir de lumières
// ---------------------------------------------------------------------
// En rendu forward, CHAQUE lumière ponctuelle entre dans le shader de chaque matériau, et
// chaque pixel de l'image la calcule — que la torche soit à 2 m ou à 700 m, sa portée n'y
// change rien. La citadelle en compte 14 (torches du donjon, beffroi…) : mesuré sur la vue
// du bourg, la passe principale coûtait 90 ms, presque tout en remplissage de pixels.
// Les sources restent dans la scène (invisibles, leur flamme continue de scintiller) et
// POOL_K vraies lumières, toujours allumées, prennent à chaque image la place des sources
// les plus proches de la caméra. Leur nombre ne change jamais : aucun shader n'est
// recompilé en cours de jeu. Un niveau qui a POOL_K lumières ou moins n'est pas touché.
export const POOL_K = 6;
const POOL = { sources: [], lampes: [], tri: [] };
const _vPool = new THREE.Vector3();
const allume = (o) => { for (let a = o.parent; a; a = a.parent) if (!a.visible) return false; return true; };
export function poolLumieres() {
  for (const l of POOL.lampes) scene.remove(l);
  POOL.sources = []; POOL.lampes = [];
  scene.traverse((o) => { if (o.isPointLight && o.visible && !o.castShadow) POOL.sources.push(o); });
  if (POOL.sources.length <= POOL_K) { const n = POOL.sources.length; POOL.sources = []; return { sources: n, reservoir: 0 }; }
  for (const s2 of POOL.sources) s2.visible = false;
  for (let i = 0; i < POOL_K; i++) { const l = new THREE.PointLight(0xffffff, 0, 1, 2); l.userData.reservoir = true; scene.add(l); POOL.lampes.push(l); }
  POOL.tri = POOL.sources.map((s2) => ({ s: s2, d: 0 }));
  majPool();
  return { sources: POOL.sources.length, reservoir: POOL_K };
}
export function majPool() {
  if (!POOL.lampes.length) return;
  const c = camera.position;
  for (const t of POOL.tri) { t.s.getWorldPosition(_vPool); t.d = allume(t.s) ? _vPool.distanceToSquared(c) : Infinity; }
  POOL.tri.sort((a, b) => a.d - b.d);
  for (let i = 0; i < POOL_K; i++) {
    const l = POOL.lampes[i], t = POOL.tri[i];
    if (!t || t.d === Infinity) { l.intensity = 0; continue; }
    t.s.getWorldPosition(l.position);
    l.color.copy(t.s.color); l.intensity = t.s.intensity; l.distance = t.s.distance; l.decay = t.s.decay;
  }
}

// =====================================================================
//  Démarrage d'un niveau
// =====================================================================
// =====================================================================
//  Endurance
// =====================================================================
// La jauge est mise à jour depuis la boucle, mais on n'écrit dans le DOM que si la valeur
// a bougé : sinon on force un recalcul de style à chaque image pour rien.

// Réglages tenus en un seul endroit, et choisis sur des distances, pas au jugé : à
// 11,5 m/s de marche, une jauge pleine donne dix secondes de course à 25,3 m/s, soit
// 253 m — de quoi traverser le glacis d'une traite. Elle se refait en sept secondes. Des
// valeurs plus serrées (2,5 s de course) faisaient d'une carte de 2 km une marche forcée.
export const ENDURANCE = {
  gain: 2.2,        // multiplicateur de vitesse en course  → 25,3 m/s, 253 m par jauge
  conso: 0.10,      // fraction de jauge dépensée par seconde  → 10 s de course
  regen: 0.14,      // fraction regagnée par seconde           → 7 s pour refaire le plein
  repos: 0.7,       // délai avant que la jauge reparte, en secondes
  reprise: 0.25,    // il faut être remonté à ce niveau pour repartir après être tombé à sec
};

let endVue = -1, endCourseVue = null;

export function majEndurance(v, court) {
  if (Math.abs(v - endVue) < 0.004 && court === endCourseVue) return;
  endVue = v; endCourseVue = court;
  const f = document.getElementById('endfill'), j = document.getElementById('endurance');
  if (!f || !j) return;
  f.style.width = (v * 100).toFixed(1) + '%';
  j.style.opacity = v >= 0.999 && !court ? '0.25' : '1';
  f.style.background = v < 0.25 ? 'linear-gradient(90deg,#8c2f22,#d6613a)' : 'linear-gradient(90deg,#3f7f4a,#8fd46a)';
}

// =====================================================================
//  Barre de chargement
// =====================================================================
// Le décor se construit en un seul bloc de code synchrone. Tant qu'on ne rend pas la main
// au navigateur, AUCUNE barre ne peut se redessiner — c'est pour ça qu'il n'y avait qu'un
// rouet qui tourne, animé par le compositeur CSS et non par la page. Chaque étape cède
// donc une image avant de continuer. Les poids viennent d'une mesure du chargement réel :
// ils n'ont pas besoin d'être exacts, seulement de ne pas mentir sur l'ordre de grandeur.

// Proportions MESURÉES sur un chargement complet (25 septembre, banc headless) : elles
// servent à la première visite, avant que la machine du joueur n'ait les siennes. La
// préparation du rendu (textures envoyées à la carte graphique, shaders) en fait près
// de la moitié.
export const ETAPES = {
  relief: 0.122, sols: 0.071, remparts: 0.001, "porte et pont": 0.032, casernes: 0.001,
  "place d'Armes": 0.001, nature: 0.002, végétation: 0.044, galeries: 0.002,
  "donjon et poterne": 0.001, maisons: 0.001, détails: 0.003, village: 0.02, campagne: 0.009,
  horizon: 0.004, "ouvrages et eaux": 0.012, quartier: 0.098, personnages: 0.036,
  collisions: 0.001, "fusion des décors": 0.075, réglages: 0.001, "préparation du rendu": 0.465,
};

// Les poids ci-dessus sont une estimation ; la machine d'Eugène n'est pas la mienne et
// la mienne n'a pas les textures. On mesure donc la durée réelle de chaque étape et on
// la range pour la fois d'après : dès le deuxième chargement, la barre dit la vérité de
// CETTE machine. La normalisation par la somme la fait toujours finir à 100 %.
const CLE_POIDS = 'tloc_poids_charge';

let chargeP = 0, poids = null, tEtape = 0, etapeEnCours = null, mesures = {};

function poidsCharge() {
  if (poids) return poids;
  poids = Object.assign({}, ETAPES);
  try {
    const v = JSON.parse(localStorage.getItem(CLE_POIDS) || 'null');
    if (v && typeof v === 'object') {
      const tot = Object.keys(v).reduce((t, k) => t + (v[k] > 0 ? v[k] : 0), 0);
      if (tot > 0 && Object.keys(v).length >= 8) {
        poids = {};
        for (const k in v) poids[k] = Math.max(0, v[k]) / tot;
      }
    }
  } catch (e) {}
  return poids;
}

export function peindreCharge(nom, force) {
  const e = document.getElementById('loading');
  if (!e || e.classList.contains('hidden')) return;
  const f = e.querySelector('#loadfill'), l = e.querySelector('#loadlabel'), p = e.querySelector('#loadpct');
  const pct = Math.max(0, Math.min(100, Math.round((force !== undefined ? force : chargeP) * 100)));
  if (f) f.style.width = pct + '%';
  if (p) p.textContent = pct + ' %';
  if (l && nom) l.textContent = nom;
}

// Annonce l'étape qui commence, peint ce qui est DÉJÀ fait, puis rend la main deux images
// (une seule ne suffit pas : la première sert à appliquer le style, la seconde à peindre).
export async function etape(nom) {
  if (etapeEnCours) mesures[etapeEnCours] = Math.max(1, performance.now() - tEtape);
  peindreCharge(nom);
  chargeP = Math.min(0.99, chargeP + (poidsCharge()[nom] || 0.02));
  etapeEnCours = nom;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  tEtape = performance.now();
}

export function finCharge() {
  if (etapeEnCours) mesures[etapeEnCours] = Math.max(1, performance.now() - tEtape);
  try { if (Object.keys(mesures).length >= 8) localStorage.setItem(CLE_POIDS, JSON.stringify(mesures)); } catch (e) {}
  chargeP = 1; peindreCharge('Prêt', 1);
}

// LA PRÉPARATION DU RENDU. Tout ce que la carte graphique doit recevoir avant la première
// image — les textures (46 Mo de webp décodés) et les programmes de shaders — l'était
// pendant les deux images qui suivaient « Prêt » : l'écran restait figé à 100 % pendant
// HUIT SECONDES (mesuré au profileur : texSubImage2D 4,8 s, compilation 1,8 s). On le fait
// donc ici, en étape de chargement : les textures par paquets, une image entre deux
// paquets pour que la barre avance, puis la compilation asynchrone de three.js, qui laisse
// le pilote compiler en parallèle quand il sait le faire (KHR_parallel_shader_compile).
const CARTES_TEX = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap'];
async function prechaufferRendu() {
  const t0 = performance.now(), textures = new Set();
  // les images décodées en tâche de fond (assets.js) : on les attend, sinon celles qui
  // arrivent après partiraient à la première image du jeu — un à-coup juste après « Prêt »
  { const att = texturesEnAttente(); if (att.length) { peindreCharge(`préparation du rendu — ${att.length} images à décoder`, chargeP); await Promise.all(att); } }
  scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) for (const k of CARTES_TEX) if (m && m[k] && m[k].isTexture && m[k].image) textures.add(m[k]);
  });
  const liste = [...textures], base = chargeP, part = (poidsCharge()['préparation du rendu'] || 0.1) * 0.8;
  let fait = 0, tPaquet = performance.now();
  for (const t of liste) {
    try { renderer.initTexture(t); } catch (e) { /* une texture pas prête : elle partira à la première image */ }
    fait++;
    // un paquet dure au plus 120 ms : la barre avance, la page ne passe pas pour gelée
    if (performance.now() - tPaquet > 120) {
      peindreCharge(`préparation du rendu — textures ${fait}/${liste.length}`, base + part * fait / liste.length);
      await new Promise((r) => requestAnimationFrame(r));
      tPaquet = performance.now();
    }
  }
  peindreCharge('préparation du rendu — lumières et matières', base + part);
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* la première image compilera */ }
  console.log('rendu préparé : %d textures, %d ms', liste.length, Math.round(performance.now() - t0));
}

export function razCharge() { chargeP = 0; etapeEnCours = null; mesures = {}; peindreCharge('Chargement…', 0); }

export async function bootLevel(level, titleMenuFn) {
  G.level = level;
  // Les intérieurs (estaminet, chapelle, maison, cave) ont été dessinés autour d'un
  // personnage de trois mètres ; la carte, elle, est au 1:1 relevé. Chaque niveau donne
  // donc son échelle de personnage, et 1 reste la valeur par défaut.
  G.echelle = level.echelle || 1;
  if (player.mesh) player.mesh.scale.setScalar(G.echelle);
  world.levelH = level.getH; world.levelBlocked = level.blocked || null; world.zoneName = level.zoneName || (() => ''); world.bounds = level.bounds || null;
  await level.build();
  await etape('personnages');
  level.populate();
  await etape('collisions');
  console.log('collisions indexées :', indexCapsules());
  await etape('fusion des décors');
  try { const t0 = performance.now(), r = unifierMateriaux(); r.ms = Math.round(performance.now() - t0); console.log('matériaux unifiés :', r); } catch (e) { console.warn('unification impossible', e); }
  try { const r = mergeStatics(); console.log('statiques fusionnés :', r); } catch (e) { console.warn('fusion impossible', e); }
  console.log('lots :', regrouperLots());
  console.log('instances en tuiles :', tuilerInstances());
  console.log('lumières :', poolLumieres());
  // Q.apply repasse sur toute la scène (ombres, densités) : sans cette étape la barre
  // restait affichée à 100 % pendant cinq secondes, ce qui est pire que pas de barre.
  await etape('réglages');
  { let ql = 0; try { ql = parseInt(localStorage.getItem('tloc_quality') || '0') || 0; } catch (e) {} Q.apply(ql, true); }
  await etape('préparation du rendu');
  await prechaufferRendu();
  finCharge();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const auto = sessionStorage.getItem('tloc_auto'); sessionStorage.removeItem('tloc_auto');
  const ld = document.getElementById('loading'); if (ld) ld.classList.add('hidden');
  if (auto === 'new') { hideMenu(); startGame(false); }
  else if (auto === 'resume') { hideMenu(); startGame(true); }
  else if (auto === 'prologue') { hideMenu(); G.sansSauvegarde = true; startGame(false); }
  else if (titleMenuFn) titleMenuFn();
  else { hideMenu(); startGame(hasSave()); }
  startLoop();
}
// si la position chargée est dans un obstacle (ex. table), on cherche la case libre la plus proche
export function unstick() {
  const p = player.pos; if (!blocked(p.x, p.z, 0.5, false, p.y)) return;
  for (let r = 0.4; r <= 4; r += 0.4) for (let k = 0; k < 16; k++) { const a = k * TAU / 16, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    if (!blocked(x, z, 0.5, false, p.y) && Math.abs(getH(x, z, p.y) - p.y) < 0.6) { p.x = x; p.z = z; return; } }
}
export function startGame(resume) {
  state.running = true;
  const L = G.level;
  if (resume) {
    const snap = loadGame();
    if (snap) { if (L.onLoad) L.onLoad(snap); unstick(); G.fade = 1; G.fadeTarget = 0; fadeEl.style.opacity = 1;
      const arrived = sessionStorage.getItem('tloc_arrive'); sessionStorage.removeItem('tloc_arrive');
      const e = arrived && L.entry ? L.entry() : null;
      if (e) { const msg = L.arriveMessage ? L.arriveMessage() : ''; cutscene([{ cam: e.cam, at: e.at, cam2: e.cam2 || e.cam, at2: e.at2 || e.at, dur: e.dur || 4, title: e.title, sub: e.sub, text: e.text }], () => { if (msg) showMessage(msg, 4); }); }
      else if (L.arriveMessage) showMessage(L.arriveMessage(), 4);
      return; }
  }
  if (L.start) L.start();
}
window.TLOC = { G, keys, state, player, enemies, pickups, arrows, hitEnemy, saveGame, loadGame, getH, blocked, tryMove, world, showMessage, interactables, THREE, scene, camera, cut, cutscene, cutAdvance, setQuest, QUESTS,
  // poignées de mise au point : lancer une partie, peupler, inspecter le bestiaire
  menu, newGame, resumeGame, spawnEnemy, KINDS, MAKERS, animeCreature, setMaker, setAnimHook,
  lieux, estDecouvert, decouvrir, helixSous };
