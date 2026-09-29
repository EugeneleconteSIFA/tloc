// Banc de FLUIDITÉ — ce que coûte une image en jeu, lieu par lieu, à qualité fixée.
//
// charge.mjs mesure le chargement ; celui-ci mesure le jeu une fois lancé. Chrome tourne
// sans synchronisation verticale (--disable-gpu-vsync, --disable-frame-rate-limit) : les
// images/s ne plafonnent plus à 60 et un gain se voit même sur une vue déjà fluide.
// Pour chaque lieu : Camille posée, caméra tournée sur quatre caps, puis
//   - img/s réelles (moyenne) et la pire image (p95) ;
//   - JS : la mise à jour du jeu (tout ce qui précède le rendu) ;
//   - rendu : le temps processeur de renderer.render / composer.render (préparation des
//     appels de dessin) ;
//   - GPU : le chronomètre de la carte (EXT_disjoint_timer_query_webgl2, présent sous
//     ANGLE Metal) autour de la même passe.
// La fenêtre imite le Mac d'Eugène : 1440 × 900 points sur un écran Retina (×2). À ×1, le
// banc dessinait trois fois moins de pixels que le joueur et ne voyait pas la carte peiner.
//
//   node bancs/fluidite.mjs [qualité 1-4 ou auto, défaut 1] [étiquette] [http://127.0.0.1:8000]
//   TLOC_ECHELLE=0.7 fixe la part de l'écran calculée (qualité figée seulement) ; « ratio »
//   dans le tableau = pixels calculés par point d'écran. TLOC_DPR=1 pour un écran ordinaire ; TLOC_ENGINE=fichier.js sert ce fichier à la place
//   d'engine.js (A/B contre `git show HEAD:engine.js > …`, sans toucher au dossier)
//
// Écrit bancs/fluidite-<date>-<étiquette>.json. Comparer avant / après sur la même machine,
// à froid (la machine chauffe : une série de deux passes, garder la meilleure).
import { createRequire } from 'module';
import fs from 'fs';
const AUTO = process.argv[2] === 'auto';          // l'automate de qualité règle tout, comme chez un joueur
const QUAL = AUTO ? 0 : parseInt(process.argv[2] || '1') - 1;
const ETIQ = process.argv[3] || (AUTO ? 'auto' : 'q' + (QUAL + 1));
const ORIGINE = process.argv[4] || 'http://127.0.0.1:8000';
const PW = process.env.TLOC_PLAYWRIGHT || `${process.env.HOME}/Documents/Projet-Padel/package.json`;
const { chromium } = createRequire(PW)('playwright');
const DIR = new URL('.', import.meta.url).pathname;

const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: +(process.env.TLOC_DPR || 2) });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
if (process.env.TLOC_ENGINE) { const src = fs.readFileSync(process.env.TLOC_ENGINE, 'utf8');
  await page.route(/\/engine\.js(\?.*)?$/, (route) => route.fulfill({ contentType: 'text/javascript', body: src })); }
await page.goto(ORIGINE + '/index.html' + (process.env.TLOC_PARAMS || ''));
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 200 });
await page.evaluate(() => { TLOC.state.introSeen = true; TLOC.menu.items[0].fn(); });
await page.waitForTimeout(3000);

const res = await page.evaluate(async ([QUAL, AUTO, ECH]) => {
  const E = await import('./engine.js?v=29'), { renderer, composer, Q, G, player, state } = E;
  if (!AUTO) { Q.locked = true; Q.apply(QUAL, true); if (ECH) Q.mettreEchelle(ECH); }
  const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  // chronométrer le rendu SANS toucher au moteur : on enveloppe les deux points d'entrée
  const m = { rendu: 0, gpu: 0, nGpu: 0 }, attente = [];
  let dedans = false;
  const relever = () => { while (attente.length && gl.getQueryParameter(attente[0], gl.QUERY_RESULT_AVAILABLE)) {
    const q = attente.shift(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { m.gpu += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; m.nGpu++; } gl.deleteQuery(q); } };
  const envelopper = (o) => { const f = o.render.bind(o); o.render = function (...a) {
    if (dedans) return f(...a);
    dedans = true; const q = ext && attente.length < 4 ? gl.createQuery() : null; if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    const t = performance.now(); f(...a); m.rendu += performance.now() - t;
    if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); attente.push(q); } relever();
    dedans = false; }; };
  envelopper(renderer); envelopper(composer);
  const images = (n) => new Promise((ok) => { const d = []; let p = performance.now();
    const f = (t) => { d.push(t - p); p = t; if (d.length < n) requestAnimationFrame(f); else ok(d); }; requestAnimationFrame(f); });
  const lieux = ['maison', 'village', 'place', 'donjon', 'moulin', 'poterne'].map((id) => E.lieux.find((l) => l.id === id)).filter(Boolean);
  const out = [];
  for (const l of lieux) {
    player.pos.x = l.x + 6; player.pos.z = l.z + 6; player.pos.y = E.getH(player.pos.x, player.pos.z); player.vy = 0;
    if (AUTO) await new Promise((ok) => setTimeout(ok, 9000));   // que l'automate se pose
    const r = { lieu: l.id, ips: 0, p95: 0, js: 0, rendu: 0, gpu: 0, appels: 0, triangles: 0 };
    for (let cap = 0; cap < 4; cap++) {
      G.camYaw = cap * Math.PI / 2;
      await images(40);                                      // chauffe : tuiles de végétation, shaders
      m.rendu = 0; m.gpu = 0; m.nGpu = 0;
      const t0 = performance.now(); const d = await images(90); const T = performance.now() - t0;
      const tri = d.slice().sort((a, b) => a - b);
      r.ips += 90 / (T / 1000) / 4; r.p95 += tri[Math.floor(tri.length * 0.95)] / 4; r.rendu += m.rendu / 90 / 4;
      r.gpu += (m.nGpu ? m.gpu / m.nGpu : 0) / 4;
      r.js += Math.max(0, T / 90 - m.rendu / 90) / 4;        // le reste de l'image : jeu, navigateur, attente
      r.appels += renderer.info.render.calls / 4; r.triangles += renderer.info.render.triangles / 4;
    }
    for (const k of ['ips', 'p95', 'js', 'rendu', 'gpu']) r[k] = +r[k].toFixed(1);
    r.appels = Math.round(r.appels); r.triangles = +(r.triangles / 1e6).toFixed(2);
    r.ratio = +(renderer.getPixelRatio() * (Q.echelle || 1)).toFixed(2); r.niveau = Q.level + 1;
    out.push(r);
  }
  return { qualite: QUAL + 1, pixelRatio: renderer.getPixelRatio(), taille: [innerWidth, innerHeight], ombres: E.sun.castShadow, post: G.postFX, lieux: out };
}, [QUAL, AUTO, +(process.env.TLOC_ECHELLE || 0)]);

res.date = new Date().toISOString();
console.log(`qualité ${res.qualite}, ratio ${res.pixelRatio}, ombres ${res.ombres}, post ${res.post}`);
console.log('lieu        img/s   p95ms  reste  rendu  GPU   appels  triangles(M)  ratio niveau');
for (const r of res.lieux) console.log(`${r.lieu.padEnd(10)} ${String(r.ips).padStart(6)} ${String(r.p95).padStart(7)} ${String(r.js).padStart(5)} ${String(r.rendu).padStart(6)} ${String(r.gpu).padStart(5)} ${String(r.appels).padStart(7)} ${String(r.triangles).padStart(8)}   ${r.ratio}  q${r.niveau}`);
const moy = res.lieux.reduce((t, r) => t + r.ips, 0) / res.lieux.length;
console.log(`moyenne : ${moy.toFixed(1)} img/s`); res.moyenne = +moy.toFixed(1);
fs.writeFileSync(DIR + `fluidite-${res.date.slice(0, 10)}-${ETIQ}.json`, JSON.stringify(res, null, 1));
await browser.close();
