// Les vignettes des arènes pour l'accueil (C8, 7 octobre) : une vue par arène, prise en solo (sans
// instance), 640 × 360 en JPEG, rangée dans vignettes/arene-<id>.jpg — l'étape « Arène » de l'accueil
// les montre en cartes (accueil.js, C.ARENES de tloc-compte.js). La vue : au-dessus du centre de
// l'arène, de biais, sauf pour les intérieurs (l'estaminet) et les maisons (le Batut), cadrés à la main.
//
//   bancs/tour.sh node bancs/multi-vignettes.mjs [id,id…]
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
const ORIGINE = 'http://127.0.0.1:8000', SORTIE = fileURLToPath(new URL('../vignettes/', import.meta.url));
fs.mkdirSync(SORTIE, { recursive: true });
// la page, et la vue : [caméra, cible] ; sans vue donnée, au-dessus du centre de l'arène
const ARENES = {
  lille: ['index.html', [[230, 150, 260], [0, 0, -10]]], gardeguerin: ['garde-guerin.html'], pouget: ['pouget.html'],
  batut: ['batut.html', [[0, 34, 70], [0, 0, 0]]], panyi: ['thailande.html'], gallipoli: ['gallipoli.html'],
  alberobello: ['alberobello.html'], matera: ['matera.html'], estaminet: ['tavern.html', [[4.6, 2.9, 3.6], [-2.2, 1.0, -1.6]]],
};
const voulues = (process.argv[2] || Object.keys(ARENES).join(',')).split(',');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
for (const id of voulues) {
  const [p, vue] = ARENES[id];
  await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
  await page.goto(ORIGINE + '/' + p);
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.G.level, null, { timeout: 300000 });
  await page.waitForTimeout(3000);
  // un dialogue ouvert tout seul (l'acte IV à Alberobello) : on le passe, il couvrait la vue
  for (let k = 0; k < 20; k++) { const r = await page.evaluate(() => { if (!TLOC.cut.active) return null; TLOC.cutAdvance(true); return 1; }); if (r === null) break; await page.waitForTimeout(150); }
  await page.evaluate((vue) => {
    document.querySelectorAll('button, a, div').forEach((e) => { if (e.children.length === 0 && /Accueil/.test(e.textContent || '')) e.style.display = 'none'; });
    const T = TLOC; for (const s of ['#hud', '#overlay', '#legend', '#msg', '#counts', '.cine', '#tactile', '#minimap']) document.querySelectorAll(s).forEach((e) => { e.style.display = 'none'; });
    if (T.menu && T.menu.active) document.getElementById('overlay')?.remove();
    let cam, at;
    if (vue) [cam, at] = vue;
    else { const A = (T.G.level.arenes || [])[0], [cx, cz] = A ? A.centre : [0, 0], y = T.getH(cx, cz), r = A && A.aires[0].r ? A.aires[0].r : 80;
      cam = [cx + r * 0.55, y + r * 0.42, cz + r * 0.55]; at = [cx, y, cz]; }
    // Camille loin derrière la caméra : son corps ne bouche pas la vue
    T.player.pos.set(cam[0] + (cam[0] - at[0]) * 2, T.getH(cam[0], cam[2]), cam[2] + (cam[2] - at[2]) * 2);
    T.G.freeCam = { pos: { x: cam[0], y: cam[1], z: cam[2] }, at: { x: at[0], y: at[1], z: at[2] } };
  }, vue || null);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SORTIE + `arene-${id}.jpg`, type: 'jpeg', quality: 72 });
  console.log(`vignettes/arene-${id}.jpg — ${Math.round(fs.statSync(SORTIE + `arene-${id}.jpg`).size / 1024)} Ko`);
}
await b.close();
