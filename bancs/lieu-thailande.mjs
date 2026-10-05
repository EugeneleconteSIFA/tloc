// Banc « LA BAIE EST-ELLE PRATICABLE ? » — la Thaïlande (thailande.html)
//
// La consigne de précision (docs/PROMPTS-LIEUX.md, 2 octobre) : mesurer d'abord. On prend
// chaque chemin, rue, escalier et ponton d'OSM (carte/mondes/thailande.json), un point tous
// les 2 m, et on demande au jeu lui-même (level.blocked, level.getH) :
//   BLOQUÉ  le point est dans un mur, dans la mer, hors du cadre ;
//   RAIDE   la pente depuis le point précédent dépasse 35° — Camille n'y monte pas ;
//   EN MER  le point est sous la mer : un bout de route qui filait vers une côte disparue quand le
//           morceau a été déplacé dans la baie — monde.js ne le dessine plus, il n'est pas compté ;
// par morceau de la baie (panyi, tapu, suea, railay, phiphi), avec les pires tronçons.
//
// Il mesure aussi le CHARGEMENT de thailande.html (cache vidé : durée, étapes, triangles) et tire
// une planche fixe de 8 vues, les mêmes avant et après une retouche (4 octobre : les îles resserrées).
//
//   TLOC_ETIQUETTE=avant bancs/tour.sh node bancs/lieu-thailande.mjs [http://127.0.0.1:8000]
//   TLOC_VUES=realisme : la planche à hauteur d’yeux ; TLOC_PARCOURS=1 : le parcours d’un joueur
//
// Sortie : bancs/resultats/lieu-thailande-<date>[-<étiquette>].json et -vues.png
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
// le Playwright du Mac (Projet-Padel) ou celui du PC (GitHub/tloc/outils), comme bancs/charge.mjs
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
// fileURLToPath et non `.pathname`, qui donne « /C:/… » sous Windows
const DIR = fileURLToPath(new URL('resultats/', import.meta.url)), JOUR = new Date().toISOString().slice(0, 10);
const NOM = DIR + 'lieu-thailande-' + JOUR + (process.env.TLOC_VUES ? '-' + process.env.TLOC_VUES : '') + (process.env.TLOC_ETIQUETTE ? '-' + process.env.TLOC_ETIQUETTE : '');
// la planche : la baie d'en haut, les quatre cœurs vus du ciel, puis trois vues à hauteur de
// Camille sur les bords des cœurs (là où une rue coupée finirait dans le vide)
// TLOC_VUES=realisme : cinq endroits que le joueur traverse, chacun à hauteur d'yeux (1,6 m, la
// caméra posée sur le chemin le plus proche, `rue`) et en plongée — la planche de la consigne de nuit
const VUES_REALISME = [
  { nom: 'Ko Panyi, le départ, face au marché (1,6 m)', cam: [104, 1.6, 10.4], at: [96, 1.0, 40], sol: true },
  { nom: 'Ko Panyi, plongée', cam: [130, 22, 45], at: [85, 1, 0] },
  { nom: 'Railay, l’allée du village (1,6 m)', cam: [-600, 1.6, 1640], at: [-470, 1.4, 1660], sol: true, rue: true },
  { nom: 'Railay, plongée', cam: [-470, 28, 1700], at: [-540, 0, 1650] },
  { nom: 'Railay, le sentier du câble (1,6 m)', cam: [-545, 1.6, 1860], at: [-587, 3, 1920], sol: true, rue: true },
  { nom: 'Ton Sai, la ruelle (1,6 m)', cam: [2290, 1.6, 1830], at: [2400, 1.4, 1805], sol: true, rue: true },
  { nom: 'Ton Sai, plongée', cam: [2380, 30, 1870], at: [2330, 0, 1820] },
  { nom: 'le grand piton, devant les moines (1,6 m)', cam: [935, 1.6, 300], at: [985, 3, 340], sol: true, rue: true },
  { nom: 'le grand piton, plongée', cam: [1010, 130, 380], at: [960, 100, 320] },
  { nom: 'l’escalier des moines (1,6 m)', cam: [2528, 1.6, 1845], at: [2560, 12, 1700], sol: true, rue: true },
  { nom: 'le marché flottant (1,6 m)', cam: [96, 2.1, 22], at: [96, 1.2, 60] },
  { nom: 'Ton Sai, le ponton (1,6 m)', cam: [2187, 1.6, 1927], at: [2160, 1.2, 2040], sol: true },
  // le 5 octobre (consigne T) : les ruelles et les maisons de Ko Panyi, son platelage sur pieux, le
  // plateau du grand piton où arrive le câble — ajoutées APRÈS les douze premières, qui restent comparables
  { nom: 'Ko Panyi, une ruelle de béton (1,6 m)', cam: [-20, 1.6, 60], at: [-60, 1.4, 20], sol: true },
  { nom: 'Ko Panyi, vu d’une barque', cam: [150, 1.5, 120], at: [60, 2, 60] },
  { nom: 'le grand piton, le plateau (1,6 m)', cam: [930, 115.6, 322], at: [912, 114.5, 360] },     // à 114 m (le sol du plateau), vers la cour du puits
];
const VUES_BAIE = [
  { nom: 'la baie', cam: [900, 900, 2100], at: [800, 0, 900] },
  { nom: 'Ko Panyi', cam: [260, 70, 170], at: [0, 5, -10] },
  { nom: 'le grand piton', cam: [1170, 150, 620], at: [975, 40, 330] },
  { nom: 'Railay, l’isthme', cam: [-250, 140, 1330], at: [-520, 10, 1720] },
  { nom: 'Phi Phi, Ton Sai', cam: [2380, 160, 2330], at: [2370, 10, 1810] },
  // au bout d'une rue coupée (PLAN.bouts, le plus proche du point donné) : 30 m avant, dans son axe
  { nom: 'Railay : une rue coupée au nord', bout: [-512, 1480] },
  { nom: 'Railay : une rue coupée au sud', bout: [-447, 1930] },
  { nom: 'Ton Sai : une rue coupée au nord', bout: [2409, 1640] },
  { nom: 'Ton Sai : la rue de l’ouest', bout: [2120, 1887] },
  { nom: 'le belvédère des moines', cam: [2596, 2.2, 1790], at: [976, 60, 322], sol: 'cam' },
  { nom: 'Ko Panyi : le bout sud', cam: [-20, 1.7, 150], at: [-20, 1.5, 260], sol: true },
  { nom: 'Ko Panyi : le rocher', cam: [-40, 1.7, -100], at: [-80, 40, -250], sol: 'cam' },
];
const VUES = process.env.TLOC_VUES === 'realisme' ? VUES_REALISME : VUES_BAIE;

const b = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('response', (r) => { if (r.status() >= 400) erreurs.push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+\//, '')); });
  p.on('console', (m) => { if (m.type() === 'error' || /Poly Haven|inconnu|absente|refusée/.test(m.text())) erreurs.push(m.text()); });
  // les étapes : engine.js ne range leurs durées (tloc_poids_charge) qu'à partir de huit, et un
  // monde n'en a que six — on lit donc l'étiquette de la barre à chaque changement
  await p.addInitScript(() => { window.__etapes = []; const t = () => { const l = document.getElementById('loadlabel'); if (!l) return requestAnimationFrame(t);
    new MutationObserver(() => window.__etapes.push([l.textContent, performance.now()])).observe(l, { childList: true, characterData: true, subtree: true }); window.__etapes.push([l.textContent, performance.now()]); }; t(); });
  await p.goto(`${ORIGINE}/connexion.html`); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const t0 = Date.now();
  await p.goto(`${ORIGINE}/thailande.html`);
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 100 });
  const charge = (Date.now() - t0) / 1000;
  const etapes = await p.evaluate(() => { const E = window.__etapes, o = {}; for (let k = 0; k < E.length - 1; k++) o[E[k][0]] = Math.round((o[E[k][0]] || 0) + E[k + 1][1] - E[k][1]); return o; });
  const rendu = await p.evaluate(() => { let tri = 0, maillages = 0, inst = 0;
    window.TLOC.scene.traverse((o) => { if (!o.isMesh || !o.geometry) return; maillages++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
      tri += o.isInstancedMesh ? n * o.count : n; if (o.isInstancedMesh) inst += o.count; });
    return { maillages, triangles: Math.round(tri), instances: inst }; });
  await p.waitForTimeout(2000);
  const res = await p.evaluate(async () => {
    const E = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/engine.js?v=')));
    const L = E.G.level, B = await (await fetch('carte/mondes/thailande.json')).json();
    const par = {}, pires = [];
    for (const [cle, liste] of [['chemins', B.chemins], ['routes', B.routes], ['ponts', B.ponts]]) for (const c of liste) {
      if (c.surface || !c.pts || c.pts.length < 2) continue;
      const m = c.m || '?', P = (par[m] ||= { points: 0, bloques: 0, raides: 0, enMer: 0 });
      let prec = null, bl = 0, ra = 0, n = 0;
      for (let k = 0; k < c.pts.length - 1; k++) {
        const [a, d] = [c.pts[k], c.pts[k + 1]], l = Math.hypot(d[0] - a[0], d[1] - a[1]), pas = Math.max(1, Math.ceil(l / 2));
        for (let s = 0; s < pas; s++) {
          const x = a[0] + (d[0] - a[0]) * s / pas, z = a[1] + (d[1] - a[1]) * s / pas, h = L.getH(x, z);
          if (h < 0.1) { P.enMer++; prec = null; continue; }
          n++; P.points++;
          if (L.blocked(x, z, 0.4)) { bl++; P.bloques++; }
          if (prec) { const dist = Math.hypot(x - prec[0], z - prec[1]); if (dist > 0.5 && Math.atan2(Math.abs(h - prec[2]), dist) > 35 * Math.PI / 180) { ra++; P.raides++; } }
          prec = [x, z, h];
        }
      }
      if (bl + ra > 0) pires.push({ m, type: cle, nom: c.nom || '', k: c.k || '', points: n, bloques: bl, raides: ra, x: Math.round(c.pts[0][0]), z: Math.round(c.pts[0][1]) });
    }
    pires.sort((a, b) => (b.bloques + b.raides) - (a.bloques + a.raides));
    const tot = Object.values(par).reduce((s, P) => ({ points: s.points + P.points, bloques: s.bloques + P.bloques, raides: s.raides + P.raides, enMer: s.enMer + P.enMer }), { points: 0, bloques: 0, raides: 0, enMer: 0 });
    return { tot, par, pires: pires.slice(0, 25) };
  });
  // ---------------- le parcours d'un joueur (TLOC_PARCOURS=1) ----------------
  // La consigne T (5 octobre) : « parcours chaque île comme un joueur, du départ à chaque repère ».
  // Une recherche de chemin sur une grille de 1 m, depuis le départ, avec les règles du jeu
  // (level.blocked au rayon de Camille, 0,5 m) et la pente de confort du banc (35°) ; un passeur
  // relie tous les quais, un câble descend de son départ à son arrivée (window.__lieu). Rend chaque
  // repère (découvrable ou non) et chaque interaction (atteinte à sa portée ET à moins de 3 m de
  // hauteur, comme engine.js). Une vingtaine de secondes.
  let parcours = null;
  if (process.env.TLOC_PARCOURS) parcours = await p.evaluate(async () => {
    const E = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/engine.js?v=')));
    const L = E.G.level, H = (x, z) => L.getH(x, z), D = window.__lieu || {}, vus = new Set(), file = [], cle = (i, j) => i + ',' + j;
    const ok = (x, z) => !L.blocked(x, z, 0.5), marche = Math.tan(35 * Math.PI / 180) + 0.05;
    const semer = (x0, z0) => { const i = Math.round(x0), j = Math.round(z0);
      for (let r = 0; r < 6; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const k = cle(i + a, j + b); if (vus.has(k)) return; if (ok(i + a, j + b)) { vus.add(k); file.push([i + a, j + b]); return; } } };
    const fouiller = () => { while (file.length) { const [i, j] = file.pop(), h = H(i, j);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = cle(i + a, j + b); if (vus.has(k) || !ok(i + a, j + b) || Math.abs(H(i + a, j + b) - h) > marche) continue; vus.add(k); file.push([i + a, j + b]); } } };
    const pres = (x, z, r, y = null) => { let m = null; const R = Math.ceil(r);
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { if (a * a + b * b > r * r) continue; const X = Math.round(x) + a, Z = Math.round(z) + b;
        if (vus.has(cle(X, Z)) && (y == null || Math.abs(H(X, Z) - y) < 3)) m = Math.min(m ?? 1e9, Math.hypot(a, b)); } return m; };
    semer(E.player.pos.x, E.player.pos.z);
    for (let tour = 0; tour < 6; tour++) { fouiller();
      if ((D.quais || []).some(([x, z]) => pres(x, z, 9) != null)) for (const [x, z] of D.quais) semer(x, z);
      for (const [d, a] of D.cables || []) if (pres(d[0], d[1], 4) != null) semer(a[0], a[1]); }
    fouiller();
    const reperes = E.lieux.filter((l) => l.id.startsWith('thailande:')).map((l) => ({ id: l.id.slice(10), nom: l.nom, a: pres(l.x, l.z, l.r) }));
    const inter = E.interactables.map((it) => { let nom = '?'; try { nom = typeof it.prompt === 'function' ? it.prompt() : it.prompt; } catch (e) { /* une invite qui lit l'état */ }
      return { nom, x: Math.round(it.pos.x), z: Math.round(it.pos.z), a: pres(it.pos.x, it.pos.z, Math.max(1, it.r || 2), it.pos.y) }; });
    return { cases: vus.size, reperes, inter };
  });
  if (parcours) {
    const r = parcours.reperes.filter((x) => x.a == null), i = parcours.inter.filter((x) => x.a == null);
    console.log(`parcours : ${parcours.cases} m² atteints ; repères ${parcours.reperes.length - r.length}/${parcours.reperes.length} découvrables, interactions ${parcours.inter.length - i.length}/${parcours.inter.length} atteintes`);
    for (const x of r) console.log('   repère hors d’atteinte :', x.id, '—', x.nom);
    for (const x of i) console.log('   interaction hors d’atteinte :', x.nom, `(${x.x}, ${x.z})`);
  }
  // ---------------- la planche fixe de 8 vues ----------------
  await p.evaluate(() => { for (const id of ['hud', 'overlay', 'msg', 'prompt', 'zone']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } });
  const images = [];
  for (const v of VUES) {
    await p.evaluate(async (v) => { const T = window.TLOC, H = (x, z) => T.getH(x, z);
      // une vue de rue : la caméra sur le point de chemin le plus proche de celui demandé
      if (v.rue) { const P = await (await fetch('carte/mondes/thailande.json')).json(); let b = null;
        for (const c of [...P.chemins, ...P.routes]) for (const [x, z] of c.pts) { const d = Math.hypot(x - v.cam[0], z - v.cam[2]); if (!b || d < b[2]) b = [x, z, d]; }
        if (b) v.cam = [b[0], v.cam[1], b[1]]; }
      if (v.bout) { const P = await (await fetch('carte/mondes/thailande.json')).json(); let b = null;
        for (const q of P.bouts || []) if (!b || Math.hypot(q[0] - v.bout[0], q[1] - v.bout[1]) < Math.hypot(b[0] - v.bout[0], b[1] - v.bout[1])) b = q;
        if (b) { const L = Math.hypot(b[2], b[3]), ux = b[2] / L, uz = b[3] / L; v.cam = [b[0] - ux * 30, 1.7, b[1] - uz * 30]; v.at = [b[0] + ux * 25, 6, b[1] + uz * 25]; v.sol = true; } }
      const cam = v.sol ? [v.cam[0], H(v.cam[0], v.cam[2]) + v.cam[1], v.cam[2]] : v.cam, at = v.sol === true ? [v.at[0], Math.max(0, H(v.at[0], v.at[2])) + v.at[1], v.at[2]] : v.at;
      const actif = window.__vueActive; T.cutscene([{ cam, at, cam2: cam, at2: at, dur: 600 }], () => {}); if (actif) T.cutAdvance(true); window.__vueActive = true;
      document.querySelectorAll('[id^=cine], .cine').forEach((e) => { e.style.display = 'none'; }); }, v);
    await p.waitForTimeout(2200);
    images.push({ nom: v.nom, png: (await p.screenshot({ type: 'png' })).toString('base64') });
  }
  const planche = await p.evaluate(async (images) => {
    const W = 640, Hh = 360, cv = document.createElement('canvas'); cv.width = W * 4; cv.height = (Hh + 24) * Math.ceil(images.length / 4); const g = cv.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
    for (let k = 0; k < images.length; k++) { const im = new Image(); im.src = 'data:image/png;base64,' + images[k].png; await im.decode();
      const x = (k % 4) * W, y = Math.floor(k / 4) * (Hh + 24); g.drawImage(im, x, y + 24, W, Hh); g.fillStyle = '#fff'; g.font = '15px sans-serif'; g.fillText((k + 1) + '. ' + images[k].nom, x + 8, y + 17); }
    return cv.toDataURL('image/png');
  }, images);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(NOM + '-vues.png', Buffer.from(planche.split(',')[1], 'base64'));

  console.log(`chargé en ${charge.toFixed(1)} s ; somme des étapes ${Math.round(Object.values(etapes || {}).reduce((a, b) => a + b, 0))} ms ; ${rendu.maillages} maillages, ${(rendu.triangles / 1e6).toFixed(2)} M triangles, ${rendu.instances} instances`);
  // la minicarte (les repères du lieu, f.reperes), à trois endroits : le HUD revient, Camille y est posée
  const cartes = [];
  for (const [nom, x, z] of [['Ko Panyi, le départ', 104, 10.4], ['Railay', -560, 1650], ['Ton Sai', 2300, 1830]]) {
    await p.evaluate(([x, z]) => { const T = window.TLOC; if (T.cut && T.cut.active) T.cutAdvance(true); for (const id of ['hud']) { const e = document.getElementById(id); if (e) e.style.display = ''; }
      T.player.pos.set(x, T.getH(x, z), z); }, [x, z]);
    await p.waitForTimeout(1500);
    const el = await p.$('#minimap'); if (el) cartes.push({ nom, png: (await el.screenshot({ type: 'png' })).toString('base64') });
  }
  if (cartes.length) { const pl = await p.evaluate(async (cs) => { const W = 340, cv = document.createElement('canvas'); cv.width = W * cs.length; cv.height = W + 24; const g = cv.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
      for (let k = 0; k < cs.length; k++) { const im = new Image(); im.src = 'data:image/png;base64,' + cs[k].png; await im.decode(); g.drawImage(im, k * W, 24, W, W); g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.fillText(cs[k].nom, k * W + 6, 17); }
      return cv.toDataURL('image/png'); }, cartes);
    fs.writeFileSync(NOM + '-minicarte.png', Buffer.from(pl.split(',')[1], 'base64')); }
  const durees = await p.evaluate(() => (window.__lieu && window.__lieu.durees) || null);
  if (durees) console.log('le lieu (ms) : ' + Object.entries(durees).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' | '));
  console.log('étapes (ms) : ' + Object.entries(etapes || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(' | '));
  if (erreurs.length) console.log('erreurs :', erreurs.slice(0, 10));
  const pc = (P) => `${(100 * (1 - (P.bloques + P.raides) / Math.max(1, P.points))).toFixed(1)} % praticable (${P.points} points sur terre : ${P.bloques} bloqués, ${P.raides} trop raides${P.enMer != null ? ` ; ${P.enMer} en mer, non comptés` : ''})`;
  console.log('baie :', pc(res.tot));
  for (const [m, P] of Object.entries(res.par)) console.log('  ' + m.padEnd(7), pc(P));
  console.log('pires tronçons :'); for (const t of res.pires.slice(0, 10)) console.log('  ', JSON.stringify(t));
  fs.writeFileSync(NOM + '.json', JSON.stringify({ date: new Date().toISOString(), chargement_s: charge, etapes, rendu, durees, erreurs: erreurs.slice(0, 20), ...res, parcours }, null, 1));
  console.log('→ ' + NOM + '.json, -vues.png');
} finally { await b.close(); }
