// Banc « MURS INVISIBLES » : peut-on marcher partout où la rue est dessinée ?
//
// Eugène (26 septembre) : « des routes libres d'accès mais impossible d'avancer, comme
// s'il y avait un mur ». Deux causes possibles, qu'on mesure toutes les deux :
//   MUR     une collision (capsule, boîte) là où rien n'est dessiné au-dessus du sol ;
//   MARCHE  deux cases voisines libres dont le sol marchable diffère d'un demi-mètre ou
//           plus : on ne monte pas (tryMove refuse ≥ 0,5 m), c'est un mur pour le joueur.
// Puis on inonde depuis la place du bourg avec les règles de Camille (rayon 0,5, marche
// 0,5 m) et l'on compte les cases de RUE qu'on n'atteint pas.
// Chaque capsule porte sa ligne d'origine (engine.js intercepté) : un mur se corrige à
// la source, pas à l'œil.
//
//   node bancs/murs.mjs [http://127.0.0.1:8000] [demi-côté en m, défaut 170] [--photos]
//
// Sortie : bancs/murs-<date>.json, et bancs/murs-<date>.png avec --photos.
import { createRequire } from 'module';
import fs from 'fs';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const DEMI = +(process.argv[3] || 170);
const PHOTOS = process.argv.includes('--photos');
const PW = process.env.TLOC_PLAYWRIGHT || `${process.env.HOME}/Documents/Projet-Padel/package.json`;
const { chromium } = createRequire(PW)('playwright');
const DIR = new URL('.', import.meta.url).pathname, JOUR = new Date().toISOString().slice(0, 10);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// chaque capsule garde les trois premiers appelants hors du moteur : c'est son adresse
await page.route(/\/engine\.js(\?.*)?$/, async (route) => {
  const r = await route.fetch(); let src = await r.text();
  src = src.replace('export function addCap(ax, az, bx, bz, r, top = Infinity) { cdirty = true; world.capsules.push({ ax, az, bx, bz, r, top });',
    'export function addCap(ax, az, bx, bz, r, top = Infinity) { cdirty = true; world.capsules.push({ ax, az, bx, bz, r, top, src: new Error().stack.split("\\n").slice(2, 5).map((l) => l.replace(/^.*\\/([^/]+\\.js)[^:]*:(\\d+):\\d+\\)?$/, "$1:$2")).join(" < ") });');
  src = src.replace('export function addBox(x0, x1, z0, z1, top) { const b = { x0, x1, z0, z1, top };',
    'export function addBox(x0, x1, z0, z1, top) { const b = { x0, x1, z0, z1, top, src: new Error().stack.split("\\n").slice(2, 4).map((l) => l.replace(/^.*\\/([^/]+\\.js)[^:]*:(\\d+):\\d+\\)?$/, "$1:$2")).join(" < ") };');
  await route.fulfill({ response: r, body: src });
});
await page.goto(ORIGINE + '/index.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 200 });
await page.evaluate(() => { TLOC.state.introSeen = true; TLOC.menu.items[0].fn(); });
await page.waitForTimeout(3000);

const t0 = Date.now();
const res = await page.evaluate(async (DEMI) => {
  const E = await import('./engine.js?v=28'), C = await import('./carte.js'), THREE = E.THREE, { world, scene, renderer } = E;
  const PAS = 0.5, [cx0, cz0] = C.townWorld(0, -4);
  const x0 = Math.round(cx0 - DEMI), z0 = Math.round(cz0 - DEMI), N = Math.round(2 * DEMI / PAS);
  const HAUT = 140, BAS = -20;
  // 1. le dessiné : une vue de dessus en profondeur (cf. crawl.mjs), une case par pixel
  const caches = [];
  scene.traverse((o) => { if (!o.visible) return;
    const m = o.material, transp = m && !Array.isArray(m) && m.transparent;
    // les instanciés restent (tonneaux, caisses, marches), sauf la végétation semée, qui suit le joueur
    if ((o.isInstancedMesh && o.count > 3000) || o.isSprite || o.isPoints || o.isLine || transp || (o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius > 3000)) { caches.push(o); o.visible = false; } });
  const cam = new THREE.OrthographicCamera(x0, x0 + N * PAS, -z0, -(z0 + N * PAS), 0, HAUT - BAS);
  cam.position.set(0, HAUT, 0); cam.up.set(0, 0, -1); cam.lookAt(0, BAS, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const rt = new THREE.WebGLRenderTarget(N, N);
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  const avant = { o: scene.overrideMaterial, bg: scene.background, fog: scene.fog };
  scene.overrideMaterial = dm; scene.background = null; scene.fog = null;
  renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
  scene.overrideMaterial = avant.o; scene.background = avant.bg; scene.fog = avant.fog;
  for (const o of caches) o.visible = true;
  const px = new Uint8Array(N * N * 4); renderer.readRenderTargetPixels(rt, 0, 0, N, N, px); rt.dispose();
  const dessine = (i, j) => {
    const k = ((N - 1 - j) * N + i) * 4;
    if (px[k] === 255 && px[k + 1] === 255 && px[k + 2] === 255 && px[k + 3] === 255) return -Infinity;
    const d = (255 / 256) * (px[k] / 255 / 16777216 + px[k + 1] / 255 / 65536 + px[k + 2] / 255 / 256 + px[k + 3] / 255);
    return HAUT - d * (HAUT - BAS);
  };
  // 2. la rue : chaussées relevées, chemins, et les pavés du bourg
  const rue = new Uint8Array(N * N);
  const tamponne = (a, b, demi) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / PAS) + 1;
    for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      for (let dx = -demi; dx <= demi; dx += PAS) for (let dz = -demi; dz <= demi; dz += PAS) {
        if (dx * dx + dz * dz > demi * demi) continue;
        const i = Math.floor((x + dx - x0) / PAS), j = Math.floor((z + dz - z0) / PAS);
        if (i >= 0 && j >= 0 && i < N && j < N) rue[j * N + i] = 1; } }
  };
  for (const o of C.LILLE.routes) for (let k = 0; k < o.pts.length - 1; k++) tamponne(o.pts[k], o.pts[k + 1], Math.max(1, C.LARGEUR_ROUTE[Math.min(3, o.r)] / 2 - 0.6));
  for (const o of C.LILLE.chemins) for (let k = 0; k < o.pts.length - 1; k++) tamponne(o.pts[k], o.pts[k + 1], 0.8);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const [lx, lz] = C.townLocal(x0 + (i + 0.5) * PAS, z0 + (j + 0.5) * PAS);
    // les pavés de village.js : grand-rue (46 × 8,8), rue nord-sud (7,9 × 36), place (18 × 18)
    if ((Math.abs(lx) < 23 && Math.abs(lz) < 4.4) || (Math.abs(lx) < 3.9 && Math.abs(lz) < 18) || (Math.abs(lx) < 9 && Math.abs(lz) < 9)) rue[j * N + i] = 2;
  }
  // sous un toit, ce n'est plus la rue : les voies relevées passent sous les maisons du bourg
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (rue[j * N + i] && dessine(i, j) - E.getH(x0 + (i + 0.5) * PAS, z0 + (j + 0.5) * PAS) > 3) rue[j * N + i] = 0;
  // 3. case par case : sol marchable, occupation, et ce qui l'occupe
  const H = new Float32Array(N * N), OCC = new Uint8Array(N * N), murs = [];
  const coupables = (x, z, y) => {
    const out = [];
    for (const c of E.capsulesNear(x, z, 0.05)) if (c.r > 0 && y < c.top && y > (c.bottom ?? -Infinity) && E.distSeg(x, z, c.ax, c.az, c.bx, c.bz) < c.r + 0.05) out.push(c.src || '?');
    for (const b of world.boxes) if (y < b.top - 0.4 && x > b.x0 - 0.05 && x < b.x1 + 0.05 && z > b.z0 - 0.05 && z < b.z1 + 0.05) out.push('boîte ' + (b.src || '?'));
    if (!out.length && world.levelBlocked && world.levelBlocked(x, z, 0.05, false, y)) out.push('levelBlocked');
    if (!out.length && world.bounds && world.bounds(x, z)) out.push('bounds');
    return out;
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) * PAS, z = z0 + (j + 0.5) * PAS, k = j * N + i;
    const h = E.getH(x, z); H[k] = h;
    if (!E.blocked(x, z, 0.05, false, h + 0.05)) continue;
    OCC[k] = 1;
    // un poteau, une rame, un paravent ne font qu'un trait vu d'en haut : on prend le plus
    // haut dessiné à une case près, sinon toute capsule autour d'un objet mince est un « mur »
    let hd = -Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (i + di >= 0 && j + dj >= 0 && i + di < N && j + dj < N) hd = Math.max(hd, dessine(i + di, j + dj));
    if (hd - h < 0.4) { OCC[k] = 2; murs.push({ x, z, k, qui: coupables(x, z, h + 0.05), rue: rue[k] }); }
  }
  // 4. les marches : deux cases libres voisines, un demi-mètre d'écart ou plus
  const marches = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i; if (OCC[k]) continue;
    for (const [di, dj] of [[1, 0], [0, 1]]) { const i2 = i + di, j2 = j + dj; if (i2 >= N || j2 >= N) continue;
      const k2 = j2 * N + i2; if (OCC[k2]) continue;
      const d = Math.abs(H[k2] - H[k]);
      if (d >= 0.5 && d < 6 && (rue[k] || rue[k2]) && !E.surObstacle(x0 + (i + 0.5) * PAS, z0 + (j + 0.5) * PAS) && !E.surObstacle(x0 + (i2 + 0.5) * PAS, z0 + (j2 + 0.5) * PAS)) marches.push({ x: x0 + (i + 0.5 + di / 2) * PAS, z: z0 + (j + 0.5 + dj / 2) * PAS, d: +d.toFixed(2), bas: +Math.min(H[k], H[k2]).toFixed(2) }); }
  }
  // 5. l'inondation, aux règles de Camille : rayon 0,5, on monte de moins de 0,5 m
  const LIBRE = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; LIBRE[k] = E.blocked(x0 + (i + 0.5) * PAS, z0 + (j + 0.5) * PAS, 0.5, false, H[k] + 0.05) ? 0 : 1; }
  const VU = new Uint8Array(N * N); const [sx, sz] = C.townWorld(0, -6);
  let pile = [Math.floor((sz - z0) / PAS) * N + Math.floor((sx - x0) / PAS)]; VU[pile[0]] = 1;
  while (pile.length) { const k = pile.pop(), i = k % N, j = (k / N) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i2 = i + di, j2 = j + dj; if (i2 < 0 || j2 < 0 || i2 >= N || j2 >= N) continue;
      const k2 = j2 * N + i2; if (VU[k2] || !LIBRE[k2] || H[k2] - H[k] >= 0.5) continue; VU[k2] = 1; pile.push(k2); } }
  let rueTot = 0, rueLibre = 0, rueAtteinte = 0; const perdues = [];
  for (let k = 0; k < N * N; k++) if (rue[k]) { rueTot++; if (LIBRE[k]) { rueLibre++; if (VU[k]) rueAtteinte++; else perdues.push(k); } }
  // 6. regroupement : cases de 4 m voisines
  const grouper = (pts, cleT) => {
    const cases = new Map(); for (const p of pts) { const kk = cleT(p) + ':' + Math.floor(p.x / 4) + ',' + Math.floor(p.z / 4); if (!cases.has(kk)) cases.set(kk, []); cases.get(kk).push(p); }
    const vu = new Set(), zones = [];
    for (const [kk] of cases) { if (vu.has(kk)) continue;
      const t = kk.split(':')[0], pl = [kk], zz = { type: t, pts: [] }; vu.add(kk);
      while (pl.length) { const c = pl.pop(); zz.pts.push(...cases.get(c)); const [a, b] = c.split(':')[1].split(',').map(Number);
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const n = t + ':' + (a + da) + ',' + (b + db); if (cases.has(n) && !vu.has(n)) { vu.add(n); pl.push(n); } } }
      const mx = zz.pts.reduce((s, p) => s + p.x, 0) / zz.pts.length, mz = zz.pts.reduce((s, p) => s + p.z, 0) / zz.pts.length;
      const pr = zz.pts.reduce((m, p) => (Math.hypot(p.x - mx, p.z - mz) < Math.hypot(m.x - mx, m.z - mz) ? p : m));
      const [lx, lz] = C.townLocal(pr.x, pr.z);
      zones.push({ type: t, n: zz.pts.length, x: +pr.x.toFixed(1), z: +pr.z.toFixed(1), local: [+lx.toFixed(1), +lz.toFixed(1)], y: +E.getH(pr.x, pr.z).toFixed(2), lieu: world.zoneName(pr.x, pr.z), pts: zz.pts }); }
    return zones.sort((a, b) => b.n - a.n);
  };
  const zMurs = grouper(murs.filter((m) => m.rue), (p) => 'MUR').map((z) => {
    const qui = new Map(); for (const p of z.pts) for (const q of p.qui) qui.set(q, (qui.get(q) || 0) + 1);
    return { ...z, pts: undefined, m2: z.n * PAS * PAS, qui: [...qui].sort((a, b) => b[1] - a[1]).slice(0, 4) }; });
  const zMarches = grouper(marches, () => 'MARCHE').map((z) => ({ ...z, pts: undefined, dMax: Math.max(...z.pts.map((p) => p.d)) }));
  const zPerdues = grouper(perdues.map((k) => ({ x: x0 + (k % N + 0.5) * PAS, z: z0 + (((k / N) | 0) + 0.5) * PAS })), () => 'COUPÉE').map((z) => ({ ...z, pts: undefined, m2: z.n * PAS * PAS }));
  // l'image : de quoi voir d'un coup d'œil (rue atteinte gris, rue coupée orange, murs rouges, marches bleues)
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const cx = cv.getContext('2d'), img = cx.createImageData(N, N);
  for (let k = 0; k < N * N; k++) { const o = k * 4; let c = [20, 24, 32];
    if (OCC[k]) c = [70, 70, 80]; if (rue[k]) c = VU[k] ? [150, 150, 150] : LIBRE[k] ? [255, 150, 30] : c;
    if (rue[k] === 2 && VU[k]) c = [190, 180, 150];
    if (OCC[k] === 2) c = rue[k] ? [255, 30, 30] : [120, 40, 40];
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; }
  for (const m of marches) { const k = Math.floor((m.z - z0) / PAS) * N + Math.floor((m.x - x0) / PAS), o = k * 4; img.data[o] = 60; img.data[o + 1] = 140; img.data[o + 2] = 255; }
  cx.putImageData(img, 0, 0);
  return { x0, z0, N, PAS, rueTot, rueLibre, rueAtteinte, murs: murs.length, mursRue: murs.filter((m) => m.rue).length, marches: marches.length,
    zMurs, zMarches, zPerdues, png: cv.toDataURL('image/png') };
}, DEMI);
console.log(`murs : ${((Date.now() - t0) / 1000).toFixed(1)} s — ${res.N}² cases de ${res.PAS} m autour du bourg`);
console.log(`rue : ${(res.rueTot * 0.25).toFixed(0)} m², libre ${(res.rueLibre / res.rueTot * 100).toFixed(1)} %, atteinte depuis la place ${(res.rueAtteinte / res.rueTot * 100).toFixed(1)} %`);
console.log(`murs invisibles : ${res.murs * 0.25} m² (dont ${res.mursRue * 0.25} m² sur la rue) ; marches ≥ 0,5 m sur la rue : ${res.marches} arêtes`);
console.log('— murs invisibles sur la rue (les plus grands) :');
for (const z of res.zMurs.slice(0, 30)) console.log(`  ${String(z.m2).padStart(6)} m²  ${z.lieu}  (${z.x}, ${z.z}) local ${z.local}  ←  ${z.qui.map(([q, n]) => q + ' ×' + n).join(' | ')}`);
console.log('— marches infranchissables sur la rue :');
for (const z of res.zMarches.slice(0, 20)) console.log(`  ${String(z.n).padStart(5)} arêtes  jusqu'à ${z.dMax} m  ${z.lieu}  (${z.x}, ${z.z}) local ${z.local}`);
console.log('— rues libres mais coupées de la place :');
for (const z of res.zPerdues.slice(0, 20)) console.log(`  ${String(z.m2).padStart(6)} m²  ${z.lieu}  (${z.x}, ${z.z}) local ${z.local}`);
fs.writeFileSync(DIR + `murs-${JOUR}.png`, Buffer.from(res.png.split(',')[1], 'base64'));
const { png, ...sans } = res; fs.writeFileSync(DIR + `murs-${JOUR}.json`, JSON.stringify(sans, null, 1));
console.log(`carte : bancs/murs-${JOUR}.png`);

if (PHOTOS) {
  const lst = [...res.zMurs.slice(0, 6), ...res.zMarches.slice(0, 3), ...res.zPerdues.slice(0, 3)];
  for (const [k, z] of lst.entries()) {
    await page.evaluate(async (z) => { const E = await import('./engine.js?v=28');
      if (!window.__repere) { window.__repere = new E.THREE.Mesh(new E.THREE.SphereGeometry(0.3, 12, 8), new E.THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false })); window.__repere.renderOrder = 999; E.scene.add(window.__repere); }
      window.__repere.position.set(z.x, z.y + 0.5, z.z);
      E.G.freeCam = { pos: { x: z.x + 6, y: z.y + 4, z: z.z + 5 }, at: { x: z.x, y: z.y + 0.5, z: z.z } };
      for (const id of ['overlay', 'hud']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }, z);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: DIR + `.murs-${k}.png` });
  }
  fs.writeFileSync(DIR + '.murs-legendes.json', JSON.stringify(lst.map((z, k) => `${k + 1}. ${z.type} ${z.m2 ?? z.n} — ${z.lieu} (${z.x}, ${z.z})`)));
  const { execSync } = await import('child_process');
  execSync(`python3 - <<'PY'
from PIL import Image, ImageDraw, ImageFont
import json, os
L = json.load(open('${DIR}.murs-legendes.json'))
ims = [Image.open('${DIR}.murs-%d.png' % k).resize((427, 240)) for k in range(len(L))]
p = Image.new('RGB', (427 * 3, 262 * ((len(ims) + 2) // 3)), (10, 14, 23)); d = ImageDraw.Draw(p)
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
except Exception: F = ImageFont.load_default()
for k, im in enumerate(ims):
    x, y = (k % 3) * 427, (k // 3) * 262; p.paste(im, (x, y)); d.text((x + 6, y + 243), L[k], fill=(255, 231, 163), font=F)
    os.remove('${DIR}.murs-%d.png' % k)
p.save('${DIR}murs-${JOUR}-photos.png')
os.remove('${DIR}.murs-legendes.json')
PY`);
  console.log(`photos : bancs/murs-${JOUR}-photos.png`);
}
await browser.close();
