// Banc « REGARD » de la ville de Lille : ce que voit le joueur, là où il passe vraiment.
//
// Eugène (4 octobre, consigne de nuit) : avant de toucher aux routes, aux trottoirs et aux
// façades, regarder — à hauteur d'yeux (1,6 m) et en plongée — cinq endroits que l'on traverse,
// et noter ce que disent les relevés (classe de voie, nom, largeur) sous chacun. Les captures
// vont dans bancs/resultats/, nommées par étiquette : on compare un avant et un après.
//
//   bancs/tour.sh node bancs/regard-ville.mjs <étiquette> [http://127.0.0.1:8000]
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
const ETIQ = process.argv[2] || 'regard';
const ORIGINE = process.argv[3] || 'http://127.0.0.1:8000';
// sur le PC, Playwright est dans GitHub/tloc/outils (5 octobre)
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const DIR = fileURLToPath(new URL('resultats/', import.meta.url));
// [nom, d'où, vers où] — les cinq endroits : la rue de la salle de la garde (le prologue part
// de là), la place du bourg, le chemin du pont au bourg, une rue au cœur de la ville, le quai du Wault
const LIEUX = [
  // (5 octobre) dans la grand-rue, face à la salle de la garde : en (222 ; 640), la caméra
  // était debout sur le soubassement d'une maison, et filmait son dessus
  ['garde', [206, 660], [213, 648]],
  ['place', [186, 650], [212, 672]],
  ['chemin', [40, 430], [150, 560]],
  // (5 octobre) sur l'axe de la rue du Gros Gérard : en (40 ; 760), la caméra était dans une cour
  ['rue', [-5, 767], [-60, 781]],
  // un carrefour : la rue Léonard Danel débouche sur la rue du Gros Gérard
  ['carrefour', [60, 728], [72, 752]],
  ['wault', [-130, 700], [-160, 800]],
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).split('\n')[0]));
await page.goto(ORIGINE + '/index.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
await page.waitForTimeout(2500);
await page.evaluate(() => { for (const id of ['hud', 'overlay']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  const T = window.TLOC; if (T.menu && T.menu.active) document.getElementById('overlay')?.classList.add('hidden'); });
for (const [nom, [x, z], [ax, az]] of LIEUX) {
  // ce que disent les relevés sous les pieds : la voie la plus proche, sa classe, son nom
  const r = await page.evaluate(async ([x, z]) => {
    const C = await import('./carte.js'); let best = null;
    for (const o of C.LILLE.routes.concat(C.LILLE.chemins)) for (let i = 0; i < o.pts.length - 1; i++) {
      const a = o.pts[i], q = o.pts[i + 1], dx = q[0] - a[0], dz = q[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
      const d = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); if (!best || d < best.d) best = { d: +d.toFixed(1), nom: o.nom || '', r: o.r ?? 'chemin', hw: o.hw || '' }; }
    return { voie: best, sol: +window.TLOC.getH(x, z).toFixed(2), ville: C.dansVille(x, z) };
  }, [x, z]);
  console.log(nom, JSON.stringify(r));
  // le sol DESSINÉ, pris par un rayon : dans le bourg, le dallage de village.js est un mètre
  // au-dessus du relief que donne getH, et la caméra filmait au ras des dalles
  const y = await page.evaluate(async ([x, z]) => { const T = window.TLOC, THREE = await import('three'), h = T.getH(x, z);
    const objs = []; T.scene.traverse((o) => { if (o.isMesh && o.visible) objs.push(o); });
    const rc = new THREE.Raycaster(new THREE.Vector3(x, h + 2.2, z), new THREE.Vector3(0, -1, 0), 0, 4);
    const i = rc.intersectObjects(objs, false)[0]; return i ? Math.max(h, i.point.y) : h; }, [x, z]);
  for (const [vue, cam] of [['yeux', { pos: { x, y: y + 1.6, z }, at: { x: ax, y: y + 1.4, z: az } }],
    ['plongee', { pos: { x: x - (ax - x) * 0.3, y: y + 28, z: z - (az - z) * 0.3 }, at: { x: (x + ax) / 2, y, z: (z + az) / 2 } }]]) {
    // Camille se tient 25 m DERRIÈRE la caméra : à sa place, son corps bouchait l'image
    await page.evaluate((cam) => { const T = window.TLOC, dx = cam.at.x - cam.pos.x, dz = cam.at.z - cam.pos.z, d = Math.hypot(dx, dz) || 1;
      const x = cam.pos.x - dx / d * 25, z = cam.pos.z - dz / d * 25; T.player.pos.set(x, T.getH(x, z), z); T.G.freeCam = cam; }, cam);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${DIR}ville-${ETIQ}-${nom}-${vue}.jpg`, quality: 82 });
  }
}
await b.close();
