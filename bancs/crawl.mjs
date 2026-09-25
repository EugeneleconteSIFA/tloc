// Banc « ARPENTEUR » : ce qu'on dessine et ce sur quoi on marche sont-ils la même chose ?
//
// Tous les défauts visuels du 25 septembre avaient cette cause : un sol marchable sans rien
// de dessiné (galeries, paliers des rampes), ou un sol dessiné au-dessus du sol marchable
// (Camille qui s'enfonce). On compare donc, mètre par mètre :
//   - la hauteur marchable : getH(x, z) du moteur (terrain, plateformes, rampes, boîtes) ;
//   - la hauteur dessinée : UNE vue de dessus orthographique de toute la zone, rendue en
//     profondeur (MeshDepthMaterial) — un rendu, pas des millions de rayons.
// et on signale :
//   INVISIBLE  on marche au-dessus de tout ce qui est dessiné (> 0,5 m) ;
//   ENFONCÉ    un sol dessiné 0,35 à 1,6 m au-dessus du sol marchable, là où l'on peut se
//              tenir (un toit, lui, est à plus de deux mètres ; un meuble a sa collision).
// Les points sont groupés en zones ; chaque zone reçoit son nom de lieu et une photo.
//
//   node bancs/crawl.mjs [http://127.0.0.1:8000] [xmin,zmin,xmax,zmax]
//
// Sortie : bancs/crawl-<date>.json et bancs/crawl-<date>.png (planche des zones).
import { createRequire } from 'module';
import fs from 'fs';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const BOITE = (process.argv[3] || '-450,-450,650,800').split(',').map(Number);
const PW = process.env.TLOC_PLAYWRIGHT || `${process.env.HOME}/Documents/Projet-Padel/package.json`;
const { chromium } = createRequire(PW)('playwright');
const DIR = new URL('.', import.meta.url).pathname, JOUR = new Date().toISOString().slice(0, 10);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
await page.goto(ORIGINE + '/index.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 200 });
await page.evaluate(() => { TLOC.state.introSeen = true; TLOC.menu.items[0].fn(); });
await page.waitForTimeout(3000);

const t0 = Date.now();
const res = await page.evaluate(async ([x0, z0, x1, z1]) => {
  const E = await import('./engine.js?v=27'), C = await import('./carte.js'), THREE = E.THREE, { world, scene, renderer } = E;
  const W = Math.ceil(x1 - x0), H = Math.ceil(z1 - z0), HAUT = 120, BAS = -20;
  // 1. le dessiné : vue de dessus en profondeur, 1 m par pixel. Hors du rendu : ce qui n'est
  //    pas un sol — la végétation semée (instances), les sprites, les transparents, le ciel.
  const caches = [];
  scene.traverse((o) => { if (!o.visible) return;
    const m = o.material, transp = m && !Array.isArray(m) && m.transparent;
    if (o.isInstancedMesh || o.isSprite || o.isPoints || o.isLine || transp || o.userData.dynamic || (o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius > 3000)) { caches.push(o); o.visible = false; } });
  const cam = new THREE.OrthographicCamera(x0, x1, -z0, -z1, 0, HAUT - BAS);   // regard vers le bas
  cam.position.set(0, HAUT, 0); cam.up.set(0, 0, -1); cam.lookAt(0, BAS, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const rt = new THREE.WebGLRenderTarget(W, H);
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  const avant = { o: scene.overrideMaterial, bg: scene.background, fog: scene.fog };
  scene.overrideMaterial = dm; scene.background = null; scene.fog = null;
  renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
  scene.overrideMaterial = avant.o; scene.background = avant.bg; scene.fog = avant.fog;
  for (const o of caches) o.visible = true;
  const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  const dessine = (i, j) => {                 // hauteur du premier sol dessiné vu d'en haut
    const k = ((H - 1 - j) * W + i) * 4;       // lecture de bas en haut
    const r = px[k] / 255, g = px[k + 1] / 255, b = px[k + 2] / 255, a = px[k + 3] / 255;
    if (px[k] === 255 && px[k + 1] === 255 && px[k + 2] === 255 && px[k + 3] === 255) return -Infinity;
    // unpackRGBAToDepth de three r160 : r porte les bits faibles, a les forts, et le tout
    // est ramené par 255/256 (oublier ce facteur décalait tout de 55 cm)
    const d = (255 / 256) * (r / (256 * 256 * 256) + g / (256 * 256) + b / 256 + a);
    return HAUT - d * (HAUT - BAS);
  };
  // 2. le marchable, et la comparaison
  const pts = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + i + 0.5, z = z0 + j + 0.5;
    if (world.bounds && world.bounds(x, z)) continue;
    const hm = E.getH(x, z);
    if (world.levelBlocked && world.levelBlocked(x, z, 0.4, false, hm)) continue;   // l'eau, le hors-carte
    if (E.blocked(x, z, 0.45, false, hm + 0.05)) continue;                          // on ne peut pas s'y tenir
    if (C.sdEau(x, z) < 3) continue;                   // la berge et le gué : on marche SOUS l'eau dessinée, c'est voulu
    const hd = dessine(i, j);
    if (hm - hd > 0.5) pts.push([x, z, 'INVISIBLE', +(hm - hd).toFixed(2), +hm.toFixed(2)]);
    else if (hd - hm > 0.35 && hd - hm < 1.6) pts.push([x, z, 'ENFONCÉ', +(hd - hm).toFixed(2), +hm.toFixed(2)]);
  }
  // 3. regroupement : cases de 6 m voisines de même type
  const cle = (x, z, t) => t + ':' + Math.floor(x / 6) + ',' + Math.floor(z / 6);
  const cases = new Map(); for (const p of pts) { const k = cle(p[0], p[1], p[2]); if (!cases.has(k)) cases.set(k, []); cases.get(k).push(p); }
  const vu = new Set(), zones = [];
  for (const [k, l] of cases) {
    if (vu.has(k)) continue;
    const [t, ij] = k.split(':'), pile = [k], z = { type: t, pts: [] }; vu.add(k);
    while (pile.length) { const c = pile.pop(); z.pts.push(...cases.get(c)); const [a, b] = c.split(':')[1].split(',').map(Number);
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const n = t + ':' + (a + da) + ',' + (b + db); if (cases.has(n) && !vu.has(n)) { vu.add(n); pile.push(n); } } }
    if (z.pts.length < 4) continue;                          // un bord de dalle, pas une zone
    const cx = z.pts.reduce((s, p) => s + p[0], 0) / z.pts.length, cz = z.pts.reduce((s, p) => s + p[1], 0) / z.pts.length;
    const proche = z.pts.reduce((m, p) => (Math.hypot(p[0] - cx, p[1] - cz) < Math.hypot(m[0] - cx, m[1] - cz) ? p : m));
    zones.push({ type: t, m2: z.pts.length, ecartMax: Math.max(...z.pts.map((p) => p[3])), x: proche[0], z: proche[1], y: proche[4], lieu: world.zoneName(proche[0], proche[1]) });
  }
  zones.sort((a, b) => b.m2 - a.m2);
  return { m2: W * H, suspects: pts.length, zones };
}, BOITE);
console.log(`arpentage : ${res.m2} m² en ${((Date.now() - t0) / 1000).toFixed(1)} s — ${res.suspects} m² suspects, ${res.zones.length} zones`);
for (const z of res.zones.slice(0, 40)) console.log(`  ${z.type.padEnd(9)} ${String(z.m2).padStart(5)} m²  écart ≤ ${z.ecartMax} m  ${z.lieu}  (${z.x.toFixed(0)}, ${z.z.toFixed(0)})`);

// photos des 12 plus grandes zones : de biais, à 9 m, à hauteur d'homme et demi
const photos = [];
for (const [k, z] of res.zones.slice(0, 12).entries()) {
  await page.evaluate(async (z) => { const E = await import('./engine.js?v=27');
    // un repère rouge sur le point suspect : sur la photo, on sait où regarder
    if (!window.__repere) { window.__repere = new E.THREE.Mesh(new E.THREE.SphereGeometry(0.35, 12, 8), new E.THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false })); window.__repere.renderOrder = 999; E.scene.add(window.__repere); }
    window.__repere.position.set(z.x, z.y + 0.35, z.z);
    E.G.freeCam = { pos: { x: z.x + 7, y: z.y + 4.5, z: z.z + 6 }, at: { x: z.x, y: z.y, z: z.z } };
    for (const id of ['overlay', 'hud']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }, z);
  await page.waitForTimeout(1300);
  const f = DIR + `.crawl-${k}.png`; await page.screenshot({ path: f }); photos.push(f);
}
fs.writeFileSync(DIR + `crawl-${JOUR}.json`, JSON.stringify(res, null, 1));
await browser.close();
// la planche : 3 × 4 vignettes légendées (Python/PIL, présent sur la machine)
if (photos.length) {
  const legendes = res.zones.slice(0, 12).map((z, k) => `${k + 1}. ${z.type} ${z.m2} m² — ${z.lieu}`);
  fs.writeFileSync(DIR + '.crawl-legendes.json', JSON.stringify(legendes));
  const { execSync } = await import('child_process');
  execSync(`python3 - <<'PY'
from PIL import Image, ImageDraw
import json
L = json.load(open('${DIR}.crawl-legendes.json'))
ims = [Image.open('${DIR}.crawl-%d.png' % k).resize((427, 240)) for k in range(len(L))]
p = Image.new('RGB', (427 * 3, 262 * ((len(ims) + 2) // 3)), (10, 14, 23))
d = ImageDraw.Draw(p)
from PIL import ImageFont
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
except Exception: F = ImageFont.load_default()
for k, im in enumerate(ims):
    x, y = (k % 3) * 427, (k // 3) * 262
    p.paste(im, (x, y)); d.text((x + 6, y + 243), L[k], fill=(255, 231, 163), font=F)
p.save('${DIR}crawl-${JOUR}.png')
PY`);
  for (const f of photos) fs.unlinkSync(f);
  fs.unlinkSync(DIR + '.crawl-legendes.json');
  console.log(`planche : bancs/crawl-${JOUR}.png`);
}
