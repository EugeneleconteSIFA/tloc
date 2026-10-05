// Banc « SAUTS » : ce qui a l'air franchissable d'un saut l'est-il ?
//
// Eugène (28 septembre) : « vérifie que je puisse sauter au-dessus de tous les composants au-
// dessus desquels je suis censé pouvoir sauter ». Le saut de Camille culmine à v²/2g
// (JUMP_V 8,2, GRAV 22 : 1,53 m) ; un obstacle se franchit si le HAUT de sa capsule reste sous
// ses pieds le temps de la traverser — en pratique jusqu'à ~1,35 m au-dessus du sol d'où elle
// saute. Pour chaque capsule, on compare :
//   - ce qui est DESSINÉ à son emplacement (vue de dessus rendue en profondeur, comme
//     l'arpenteur — les instances comprises, sauf la végétation semée) ;
//   - le HAUT de sa collision (c.top, cote absolue), rapporté au sol pris juste de part et
//     d'autre de la capsule (le côté le plus haut : celui d'où l'on a le plus de chances de
//     sauter).
// et on signale TROP HAUT : l'objet dessiné tient sous 1,1 m, mais sa collision dépasse
// 1,4 m (ou n'a pas de haut du tout) — on bute sur un tonneau comme sur un mur.
// Chaque capsule porte sa ligne d'origine (engine.js intercepté, comme murs.mjs).
//
//   node bancs/sauts.mjs [http://127.0.0.1:8000] [xmin,zmin,xmax,zmax]
import { createRequire } from 'module';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const BOITE = (process.argv[3] || '-450,-450,650,800').split(',').map(Number);
// sur le PC, Playwright est dans GitHub/tloc/outils (5 octobre)
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const DIR = fileURLToPath(new URL('resultats/', import.meta.url)), JOUR = new Date().toISOString().slice(0, 10);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route(/\/engine\.js(\?.*)?$/, async (route) => {
  const r = await route.fetch(); let src = await r.text();
  src = src.replace('world.capsules.push({ ax, az, bx, bz, r, top });',
    'world.capsules.push({ ax, az, bx, bz, r, top, src: new Error().stack.split("\\n").slice(2, 5).map((l) => l.replace(/^.*\\/([^/]+\\.js)[^:]*:(\\d+):\\d+\\)?$/, "$1:$2")).join(" < ") });');
  await route.fulfill({ response: r, body: src });
});
await page.goto(ORIGINE + '/index.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 200 });
await page.evaluate(() => { TLOC.state.introSeen = true; TLOC.menu.items[0].fn(); });
await page.waitForTimeout(3000);

const res = await page.evaluate(async ([x0, z0, x1, z1]) => {
  const E = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/engine.js?v='))), { PARTAGE } = await import('./etat.js'), THREE = E.THREE, { world, scene, renderer } = E;
  const PAS = 0.5, W = Math.ceil((x1 - x0) / PAS), H = Math.ceil((z1 - z0) / PAS), HAUT = 120, BAS = -20;
  // 1. le dessiné, vu d'en haut (les personnages et la végétation semée écartés)
  const caches = [];
  scene.traverse((o) => { if (!o.visible) return;
    const m = o.material, transp = m && !Array.isArray(m) && m.transparent;
    if (o.isSkinnedMesh || (o.isInstancedMesh && o.count > 3000) || o.isSprite || o.isPoints || o.isLine || transp || (o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius > 3000)) { caches.push(o); o.visible = false; } });
  const cam = new THREE.OrthographicCamera(x0, x0 + W * PAS, -z0, -(z0 + H * PAS), 0, HAUT - BAS);
  cam.position.set(0, HAUT, 0); cam.up.set(0, 0, -1); cam.lookAt(0, BAS, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const rt = new THREE.WebGLRenderTarget(W, H);
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  const avant = { o: scene.overrideMaterial, bg: scene.background, fog: scene.fog };
  scene.overrideMaterial = dm; scene.background = null; scene.fog = null;
  renderer.setRenderTarget(rt); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
  scene.overrideMaterial = avant.o; scene.background = avant.bg; scene.fog = avant.fog;
  for (const o of caches) o.visible = true;
  const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
  const dessine = (x, z) => { const i = Math.floor((x - x0) / PAS), j = Math.floor((z - z0) / PAS); if (i < 0 || j < 0 || i >= W || j >= H) return -Infinity;
    const k = ((H - 1 - j) * W + i) * 4; if (px[k] === 255 && px[k + 1] === 255 && px[k + 2] === 255 && px[k + 3] === 255) return -Infinity;
    return HAUT - (255 / 256) * (px[k] / 255 / 16777216 + px[k + 1] / 255 / 65536 + px[k + 2] / 255 / 256 + px[k + 3] / 255) * (HAUT - BAS); };
  const gens = [...(PARTAGE.villagers || []), ...E.enemies.map((e) => e.mesh)].filter(Boolean).map((m) => [m.position.x, m.position.z]);
  const out = [];
  for (const c of world.capsules) {
    if (!(c.r > 0) || c.r > 3) continue;
    const mx = (c.ax + c.bx) / 2, mz = (c.az + c.bz) / 2;
    if (mx < x0 || mx > x1 || mz < z0 || mz > z1) continue;
    if (gens.some(([gx, gz]) => Math.hypot(gx - mx, gz - mz) < 0.6)) continue;          // un personnage, pas un décor
    const dx = c.bx - c.ax, dz = c.bz - c.az, L = Math.hypot(dx, dz), nx = L ? -dz / L : 1, nz = L ? dx / L : 0;
    // le plus haut dessiné le long de la capsule (au rayon près), et le sol de part et d'autre
    let haut = -Infinity; const n = Math.max(1, Math.ceil(L / 0.5));
    for (let k = 0; k <= n; k++) { const x = c.ax + dx * k / n, z = c.az + dz * k / n;
      for (const o of [0, 0.5, -0.5]) haut = Math.max(haut, dessine(x + nx * c.r * o, z + nz * c.r * o)); }
    const cote = (s) => { const x = mx + nx * s * (c.r + 0.8), z = mz + nz * s * (c.r + 0.8); return E.blocked(x, z, 0.3, false, E.getH(x, z) + 0.05) ? -Infinity : E.getH(x, z); };
    const sol = Math.max(cote(1), cote(-1), L < 0.1 ? Math.max(cote(0.7), cote(-0.7)) : -Infinity);
    if (!Number.isFinite(sol) || !Number.isFinite(haut)) continue;
    const vu = haut - sol, coll = c.top - sol;
    if (vu > 0.15 && vu <= 1.1 && coll > 1.4) out.push({ vu: +vu.toFixed(2), coll: Number.isFinite(coll) ? +coll.toFixed(2) : 'infini', x: +mx.toFixed(1), z: +mz.toFixed(1), y: +sol.toFixed(2), r: +c.r.toFixed(2), L: +L.toFixed(1), src: (c.src || '?').split(' < ')[0], pile: c.src, lieu: world.zoneName(mx, mz) });
  }
  return out;
}, BOITE);
const par = new Map(); for (const o of res) { const k = o.src; if (!par.has(k)) par.set(k, []); par.get(k).push(o); }
console.log(`sauts : ${res.length} capsules trop hautes pour ce qu'on voit`);
for (const [k, l] of [...par].sort((a, b) => b[1].length - a[1].length)) {
  const e = l[0];
  console.log(`  ${String(l.length).padStart(4)} × ${k.padEnd(18)} vu ${e.vu} m, collision ${e.coll} m  — ${e.lieu} (${e.x}, ${e.z}) r ${e.r} L ${e.L}`);
}
fs.writeFileSync(DIR + `sauts-${JOUR}.json`, JSON.stringify(res, null, 1));
await browser.close();
