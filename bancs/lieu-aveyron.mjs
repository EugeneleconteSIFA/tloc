// Banc du LIEU « Aveyron » (le lac de Saint-Gervais et Saint-Symphorien) : est-il juste et
// praticable ? Consigne de précision d'Eugène, 2 octobre : on mesure d'abord, on corrige ensuite.
//
//   bancs/tour.sh node bancs/lieu-aveyron.mjs [http://127.0.0.1:8000]
//
// a. PRATICABILITÉ — chaque rue et chemin d'OSM tous les 2 m : part des points libres
//    (level.blocked), pente entre deux points (> 35° : « trop raide ») ; le départ, les portes et
//    les PNJ atteints en MARCHANT : un chemin cherché sur une grille de 2 m avec le blocked du jeu,
//    puis suivi pas à pas par tryMove (la fonction qui déplace Camille), jamais par téléportation.
// b. BÂTI — pour chaque bâtiment : le toit déborde-t-il de plus de 60 cm de ses murs, ou au-dessus
//    d'un voisin ? Le soubassement côté aval (> 1,5 m) ; les murs qui se chevauchent.
// c. SOLS — l'écart entre les rubans de rue et le relief (flotte > 5 cm, enfoncé > 2 cm), et les
//    surfaces posées à moins de 3 cm l'une de l'autre sans décalage de profondeur (z-fighting).
//
// Ce que le lieu bâtit lui-même, il le déclare dans window.__lieu (toits, murs, rubans,
// nappes) ; sinon le banc reprend les règles de monde.js (toit sur le rectangle englobant,
// débord de 40 cm ; rubans à 18 cm au-dessus du relief).
// Sortie : bancs/resultats/lieu-aveyron-<date>.json, -carte.png (les défauts sur le plan) et
// -vues.png (la planche fixe de 8 vues).
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
// `… lieu-aveyron.mjs <origine> regard <étiquette>` : la planche du REGARD (consigne de nuit, 5 octobre)
// — les endroits que le joueur traverse, à hauteur d'yeux (1,6 m) et en plongée, pour comparer
// au vrai lieu ; sortie lieu-aveyron-<date>-regard-<étiquette>.*
const REGARD = process.argv[3] === 'regard', ETIQUETTE = REGARD ? '-regard' + (process.argv[4] ? '-' + process.argv[4] : '') : '';
const VUES_REGARD = [
  { nom: 'yeux : Beauregard, depuis le chemin', cam: [365, 1.6, 140], at: [400, 4, 152], sol: true },
  { nom: 'yeux : le Batut, depuis le départ', cam: [-116.7, 1.6, 143.8], at: [-135, 5, 170], sol: true },
  { nom: 'yeux : le Pouget, depuis la grille', cam: [169, 1.6, -287], at: [185, 6, -315], sol: true },
  { nom: 'plongée : la grève, la barque, le pré du Batut', cam: [-30, 30, 130], at: [-110, 0, 160] },
  { nom: 'yeux : le barrage, le duel', cam: [-205, 1.6, -40], at: [-235, 1.2, -110], sol: true, rue: true },
  { nom: 'dedans : le Batut, le grand salon', cam: [-135.0, 1.6, 165.9], at: [-136.0, 1.2, 173.7], sol: true },
  { nom: 'dedans : le Pouget, le salon', cam: [180.4, 1.6, -313.5], at: [180.1, 1.2, -321.4], sol: true },
  { nom: 'dedans : Beauregard, de la tour au hall', cam: [393.6, 1.6, 148.2], at: [403.3, 1.2, 151.2], sol: true },
];
const VUES = REGARD ? VUES_REGARD : [   // la planche fixe : une aérienne, une de dessus (emprises OSM en surimpression), trois dans
  // les rues à hauteur de Camille, deux gros plans (façade, sol), une depuis le départ
  { nom: 'aérienne', cam: [700, 380, 900], at: [100, 0, 50] },
  // depuis le resserrement du 5 octobre, le lac seul : Saint-Symphorien et Saint-Gervais sont à l'horizon
  { nom: 'dessus de Perpignou', cam: [455, 160, -240], at: [456, 0, -241], emprises: true },
  { nom: 'rue : la route de la rive ouest', cam: [-250, 1.7, 250], at: [-230, 1.7, 330], sol: true, rue: true },
  { nom: 'lisière : la barrière du sud', cam: [-112, 1.7, 445], at: [-104, 1.0, 470], sol: true, rue: true },
  { nom: 'lisière : le muret du nord', cam: [60, 1.7, -320], at: [60, 1.0, -360], sol: true },
  { nom: 'façade : le Batut', cam: [-117, 2.2, 143], at: [-131, 3, 163], sol: true },
  { nom: 'sol : la grève', cam: [70, 1.7, 160], at: [55, 0, 140], sol: true },
  { nom: 'depuis le départ', cam: [-123, 2.2, 139], at: [-90, 1.5, 100], sol: true },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  // une matière inconnue ou une texture absente retombe sur un aplat : c'est un défaut, on le dit
  page.on('console', (m) => { if (/Poly Haven|inconnu|absente/.test(m.text())) erreurs.push(m.text()); });
  await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const t0 = Date.now();
  await page.goto(ORIGINE + '/aveyron.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 200 });
  const charge = (Date.now() - t0) / 1000;
  await page.waitForTimeout(3000);

  const res = await page.evaluate(async () => {
    const E = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/engine.js?v=')));
    const T = window.TLOC, H = (x, z) => T.getH(x, z), B = (x, z, r = 0.4) => E.blocked(x, z, r, false, H(x, z));
    const PLAN = await (await fetch('carte/mondes/aveyron-jeu.json')).json();
    const L = window.__lieu || {};
    const dansP = (x, z, P) => { let d = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; } return d; };
    const aire = (P) => { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return Math.abs(s) / 2; };
    const cad = E.G.level && E.G.level.cadre ? E.G.level.cadre : null;
    const dedans = (x, z) => !(E.world.bounds && E.world.bounds(x, z)) && !B(x, z, 0) || true;
    // l'emprise jouable : là où blocked n'est pas vrai d'office (le cadre de monde.js)
    let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
    for (const b of PLAN.batiments || []) for (const [x, z] of b.pts) { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Z0 = Math.min(Z0, z); Z1 = Math.max(Z1, z); }
    const R = await (await fetch('carte/mondes/relief-aveyron-jeu.json')).json();
    const CX0 = R.x0 + 8, CX1 = R.x0 + R.pas * (R.nx - 1) - 8, CZ0 = R.z0 + 8, CZ1 = R.z0 + R.pas * (R.nz - 1) - 8;
    // la zone où l'on marche (le resserrement du 5 octobre) ; à défaut, le cadre de monde.js
    const Zn = PLAN.zone, dansCadre = Zn ? (x, z) => x > Zn.x0 + 1 && x < Zn.x1 - 1 && z > Zn.z0 + 1 && z < Zn.z1 - 1 : (x, z) => x > CX0 && x < CX1 && z > CZ0 && z < CZ1;

    // ---------------- a. praticabilité des rues ----------------
    const lignes = (L.rues || [...(PLAN.routes || []), ...(PLAN.chemins || [])]).filter((c) => !c.surface && c.pts.some(([x, z]) => dansCadre(x, z)));
    let n = 0, libres = 0, raides = 0; const bloques = [], tropRaides = [];
    for (const c of lignes) { let prec = null;
      for (let k = 0; k < c.pts.length - 1; k++) { const [ax, az] = c.pts[k], [bx, bz] = c.pts[k + 1], m = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2));
        for (let t = 0; t < m; t++) { const x = ax + (bx - ax) * t / m, z = az + (bz - az) * t / m; if (!dansCadre(x, z)) { prec = null; continue; }
          n++; const h = H(x, z); if (!B(x, z)) libres++; else bloques.push([x, z, c.nom || '']);
          if (prec) { const d = Math.hypot(x - prec[0], z - prec[1]); if (d > 0.5 && Math.atan2(Math.abs(h - prec[2]), d) > 35 * Math.PI / 180) { raides++; tropRaides.push([x, z]); } }
          prec = [x, z, h]; } } }

    // ---------------- a. atteignables en marchant ----------------
    const P0 = T.player.pos.clone();
    const cibles = [{ nom: 'départ', x: P0.x, z: P0.z }, ...T.interactables.map((i) => ({ nom: typeof i.prompt === 'function' ? i.prompt() : String(i.prompt), x: i.pos.x, z: i.pos.z, r: i.r }))];
    // la grille de 2 m, parcourue en largeur depuis le départ avec le blocked du jeu
    const S = 2, nx = Math.ceil((CX1 - CX0) / S), nz = Math.ceil((CZ1 - CZ0) / S), vu = new Int32Array(nx * nz).fill(-1);
    const id = (x, z) => { const i = Math.floor((x - CX0) / S), j = Math.floor((z - CZ0) / S); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
    const centre = (k) => [CX0 + (k % nx + 0.5) * S, CZ0 + (Math.floor(k / nx) + 0.5) * S];
    const libre = new Uint8Array(nx * nz); for (let k = 0; k < nx * nz; k++) { const [x, z] = centre(k); libre[k] = B(x, z) ? 0 : 1; }
    let file = [id(P0.x, P0.z)]; if (file[0] >= 0) vu[file[0]] = file[0];
    while (file.length) { const nf = []; for (const k of file) { const i = k % nx, j = Math.floor(k / nx);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const q = b * nx + a;
        if (vu[q] >= 0 || !libre[q]) continue; const [x1, z1] = centre(k), [x2, z2] = centre(q); if ([0.25, 0.5, 0.75].some((t) => B(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t))) continue; /* trois points, pas le seul milieu : un muret de 70 cm vu en biais passait entre deux cases (5 octobre) */ vu[q] = k; nf.push(q); } } file = nf; }
    const chemin = (k) => { const c = []; while (k >= 0 && vu[k] !== k) { c.push(centre(k)); k = vu[k]; } return c.reverse(); };
    // marcher pour de vrai : tryMove, pas de 15 cm, le long du chemin trouvé
    const marcher = (pts, cible) => { const p = P0.clone(); p.y = H(p.x, p.z); let bloque = 0;
      for (const [x, z] of [...pts, [cible.x, cible.z]]) { for (let g = 0; g < 400; g++) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d < 0.3) break;
          const s = Math.min(0.15, d), ok = E.tryMove(p, dx / d * s, dz / d * s, 0.4, false); p.y = H(p.x, p.z); if (!ok) { bloque++; break; } } }
      return { fin: Math.hypot(p.x - cible.x, p.z - cible.z), bloque, ou: [+p.x.toFixed(1), +p.z.toFixed(1)] }; };
    const atteintes = cibles.map((c) => {
      let best = -1, bd = 1e9; const rr = (c.r || 2) + 1; for (let dx = -rr; dx <= rr; dx += 1) for (let dz = -rr; dz <= rr; dz += 1) { const k = id(c.x + dx, c.z + dz); if (k >= 0 && vu[k] >= 0) { const d = Math.hypot(dx, dz); if (d < bd) { bd = d; best = k; } } }
      if (best < 0) return { ...c, atteinte: false, pourquoi: 'aucun chemin libre sur la grille de 2 m' };
      const m = marcher(chemin(best), { x: centre(best)[0], z: centre(best)[1] });
      return { ...c, atteinte: m.fin < 1.5 + (c.r || 0), resteA: +m.fin.toFixed(2), arrets: m.bloque, arreteeA: m.ou };     // où la marche s'est arrêtée
    });

    // ---------------- b. le bâti ----------------
    const bats = L.murs || (PLAN.batiments || []).filter((b) => b.pts.some(([x, z]) => dansCadre(x, z))).map((b) => ({ pts: b.pts }));
    const toits = L.toits || bats.map((b) => {               // la règle de monde.js : le rectangle englobant orienté, + 40 cm
      const P = b.pts, cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
      let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
      const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang); let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const [x, z] of P) { const a = (x - cx) * ux + (z - cz) * uz, c = -(x - cx) * uz + (z - cz) * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, c); b1 = Math.max(b1, c); }
      const o = 0.4; return { pts: [[a0 - o, b0 - o], [a1 + o, b0 - o], [a1 + o, b1 + o], [a0 - o, b1 + o]].map(([a, c]) => [cx + a * ux - c * uz, cz + a * uz + c * ux]) }; });
    const debords = [], surVoisin = [], soubassements = [], chevauchements = [];
    const grilleB = new Map(); bats.forEach((b, i) => { for (const [x, z] of b.pts) { const k = Math.floor(x / 20) + ',' + Math.floor(z / 20); if (!grilleB.has(k)) grilleB.set(k, new Set()); grilleB.get(k).add(i); } });
    const voisins = (x, z) => { const s = new Set(); for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (const i of grilleB.get((Math.floor(x / 20) + a) + ',' + (Math.floor(z / 20) + c)) || []) s.add(i); return s; };
    const dBord = (x, z, P) => { let m = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)); m = Math.min(m, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return m; };
    toits.forEach((t, i) => { const b = bats[t.bat ?? i]; if (!b) return; const P = t.pts;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      let trop = 0, chez = 0, n2 = 0; const vs = voisins((x0 + x1) / 2, (z0 + z1) / 2);
      for (let x = x0; x <= x1; x += 0.5) for (let z = z0; z <= z1; z += 0.5) { if (!dansP(x, z, P)) continue; n2++;
        if (!dansP(x, z, b.pts)) { if (dBord(x, z, b.pts) > 0.6) trop++; for (const v of vs) if (v !== (t.bat ?? i) && dansP(x, z, bats[v].pts)) { chez++; break; } } }
      if (trop * 0.25 > 1) debords.push({ i: t.bat ?? i, m2: trop * 0.25, x: (x0 + x1) / 2, z: (z0 + z1) / 2 });
      if (chez * 0.25 > 0.5) surVoisin.push({ i: t.bat ?? i, m2: chez * 0.25, x: (x0 + x1) / 2, z: (z0 + z1) / 2 }); });
    bats.forEach((b, i) => { let lo = 1e9, hi = -1e9; for (const [x, z] of b.pts) { const h = H(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      const sb = b.sol != null ? b.sol - lo : hi - lo;      // ce que le mur montre sous le plancher, côté aval
      if (sb > 1.5) { const c = b.pts.reduce((s, p) => [s[0] + p[0] / b.pts.length, s[1] + p[1] / b.pts.length], [0, 0]); soubassements.push({ i, m: +sb.toFixed(2), x: c[0], z: c[1] }); }
      for (const v of voisins(b.pts[0][0], b.pts[0][1])) { if (v <= i) continue; let n3 = 0; const Q = bats[v].pts;
        for (const [x, z] of b.pts) if (dansP(x, z, Q) && dBord(x, z, Q) > 0.3) n3++;
        if (n3) chevauchements.push({ a: i, b: v }); } });

    // ---------------- c. les sols ----------------
    const rubans = L.rubans || lignes.map((c) => ({ pts: c.pts.map(([x, z]) => [x, H(x, z) + 0.18, z]) }));
    let ech = 0, flotte = 0, enfonce = 0; const flottants = [];
    for (const r of rubans) for (let k = 0; k < r.pts.length - 1; k++) { const [ax, ay, az] = r.pts[k], [bx, by, bz] = r.pts[k + 1];
      for (let t = 0; t <= 1; t += 0.25) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t, d = y - H(x, z); if (!dansCadre(x, z)) continue; ech++;
        if (d > 0.05) { flotte++; if (flottants.length < 4000) flottants.push([x, z]); } else if (d < -0.02) enfonce++; } }
    const nappes = L.nappes || [];        // [{ nom, ecart (m), decale (polygonOffset ?) }]
    const zfight = nappes.filter((s) => s.ecart < 0.03 && !s.decale).map((s) => s.nom);

    // ---------------- la carte des défauts ----------------
    const carte = (x0, z0, x1, z1, W) => { const s = W / (x1 - x0), Hh = Math.round((z1 - z0) * s), cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
      const g = cv.getContext('2d'), P = (x, z) => [(x - x0) * s, (z - z0) * s]; g.fillStyle = '#efe9da'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#8c7a66'; for (const b of bats) { g.beginPath(); b.pts.forEach(([x, z], k) => { const [a, c] = P(x, z); k ? g.lineTo(a, c) : g.moveTo(a, c); }); g.fill(); }
      g.strokeStyle = 'rgba(180,40,160,.9)'; g.lineWidth = 1; for (const t of toits) { g.beginPath(); t.pts.forEach(([x, z], k) => { const [a, c] = P(x, z); k ? g.lineTo(a, c) : g.moveTo(a, c); }); g.closePath(); g.stroke(); }
      g.strokeStyle = '#b8a888'; g.lineWidth = 2; for (const c of lignes) { g.beginPath(); c.pts.forEach(([x, z], k) => { const [a, cc] = P(x, z); k ? g.lineTo(a, cc) : g.moveTo(a, cc); }); g.stroke(); }
      const pt = (x, z, col, r = 3) => { const [a, c] = P(x, z); g.fillStyle = col; g.beginPath(); g.arc(a, c, r, 0, 6.3); g.fill(); };
      for (const [x, z] of flottants) pt(x, z, 'rgba(40,120,220,.35)', 1.5);
      for (const [x, z] of bloques) pt(x, z, '#d02020', 3); for (const [x, z] of tropRaides) pt(x, z, '#f08020', 3);
      for (const d of debords) pt(d.x, d.z, '#c020c0', 5); for (const d of surVoisin) pt(d.x, d.z, '#700070', 7); for (const d of soubassements) pt(d.x, d.z, '#2040c0', 5);
      for (const c of atteintes) { const [a, cc] = P(c.x, c.z); g.strokeStyle = c.atteinte ? '#108010' : '#d00000'; g.lineWidth = 2; g.beginPath(); g.arc(a, cc, 8, 0, 6.3); g.stroke(); }
      g.fillStyle = '#222'; g.font = '13px sans-serif'; return cv; };
    const c1 = carte(-540, -620, 600, 640, 900), c2 = carte(3480, -740, 4120, -120, 640);
    const cv = document.createElement('canvas'); cv.width = 900 + 640 + 30; cv.height = Math.max(c1.height, c2.height) + 60; const g = cv.getContext('2d');
    g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(c1, 10, 50); g.drawImage(c2, 920, 50); g.fillStyle = '#222'; g.font = 'bold 16px sans-serif';
    g.fillText('Le lac de Saint-Gervais', 10, 20); g.fillText('Saint-Symphorien', 920, 20); g.font = '12px sans-serif';
    g.fillText('rouge : rue bloquée ; orange : > 35° ; bleu clair : ruban qui flotte ; violet : toit qui déborde (foncé : sur un voisin) ; bleu : soubassement > 1,5 m ; cercles : cibles (vert atteinte, rouge non)', 10, 38);

    return { carte: cv.toDataURL('image/png'),
      praticabilite: { points: n, libres, part: +(libres / Math.max(1, n) * 100).toFixed(2), tropRaides: raides, bloques: bloques.slice(0, 60) },
      cibles: atteintes,
      bati: { batiments: bats.length, toitsQuiDebordent: debords.length, toitsSurVoisin: surVoisin.length, soubassementsPlus15: soubassements.length, chevauchements: chevauchements.length,
        pires: { debords: debords.sort((a, b) => b.m2 - a.m2).slice(0, 10), soubassements: soubassements.sort((a, b) => b.m - a.m).slice(0, 10) } },
      sols: { echantillons: ech, flottePlus5cm: flotte, part: +(flotte / Math.max(1, ech) * 100).toFixed(1), enfoncePlus2cm: enfonce, zFighting: zfight },
      source: window.__lieu ? 'déclaré par le lieu (window.__lieu)' : 'règles de monde.js (le lieu ne déclare rien)', durees: (window.__lieu && window.__lieu.durees) || null,
      // ce que le lieu a posé : ses dépendances, ses essences, ses gens
      pose: window.__lieu ? { domaines: window.__lieu.domaines || null, essences: window.__lieu.essences || null, affleurements: window.__lieu.affleurements ?? null, brebis: window.__lieu.brebis ?? null, gens: window.__lieu.gens || null } : null };
  });

  // ---------------- la planche fixe de 8 vues ----------------
  await page.evaluate(() => { for (const id of ['hud', 'overlay', 'msg', 'prompt', 'zone']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } });
  const images = [];
  for (const v of VUES) {
    await page.evaluate(async (v) => {
      const E = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/engine.js?v=')));
      const H = (x, z) => TLOC.getH(x, z);
      // une vue de rue : la caméra sur le point de rue LIBRE le plus proche de celui demandé — posée
      // à la main, elle tombait dans un mur (planche du 2 octobre, vue 3)
      if (v.rue && window.__lieu) { let b = null; for (const r of window.__lieu.rues) for (const [x, z] of r.pts) { const d = Math.hypot(x - v.cam[0], z - v.cam[2]); if ((!b || d < b[2]) && !E.blocked(x, z, 1.2, false, H(x, z))) b = [x, z, d]; } if (b) v.cam = [b[0], v.cam[1], b[1]]; }
      const cam = v.sol ? [v.cam[0], H(v.cam[0], v.cam[2]) + v.cam[1], v.cam[2]] : v.cam, at = v.sol ? [v.at[0], H(v.at[0], v.at[2]) + v.at[1], v.at[2]] : v.at;
      if (window.__empr) { E.scene.remove(window.__empr); window.__empr = null; }
      if (v.emprises) { const PLAN = await (await fetch('carte/mondes/aveyron-jeu.json')).json(), pos = [];
        for (const b of (window.__lieu && window.__lieu.murs) || PLAN.batiments) { const P = b.pts; for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length]; pos.push(ax, H(ax, az) + 7, az, bx, H(bx, bz) + 7, bz); } }
        const g = new E.THREE.BufferGeometry(); g.setAttribute('position', new E.THREE.Float32BufferAttribute(pos, 3));
        window.__empr = new E.THREE.LineSegments(g, new E.THREE.LineBasicMaterial({ color: 0xff2020, depthTest: false })); window.__empr.renderOrder = 999; E.scene.add(window.__empr); }
      const actif = window.__vueActive; TLOC.cutscene([{ cam, at, cam2: cam, at2: at, dur: 600 }], () => {}); if (actif) TLOC.cutAdvance(true); window.__vueActive = true;
      document.querySelectorAll('[id^=cine], .cine').forEach((e) => { e.style.display = 'none'; });
    }, v);
    await page.waitForTimeout(2200);
    images.push({ nom: v.nom, png: (await page.screenshot({ type: 'png' })).toString('base64') });
  }
  const planche = await page.evaluate(async (images) => {
    const W = 640, Hh = 360, cv = document.createElement('canvas'); cv.width = W * 4; cv.height = (Hh + 24) * 2; const g = cv.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
    for (let k = 0; k < images.length; k++) { const im = new Image(); im.src = 'data:image/png;base64,' + images[k].png; await im.decode();
      const x = (k % 4) * W, y = Math.floor(k / 4) * (Hh + 24); g.drawImage(im, x, y + 24, W, Hh); g.fillStyle = '#fff'; g.font = '15px sans-serif'; g.fillText((k + 1) + '. ' + images[k].nom, x + 8, y + 17); }
    return cv.toDataURL('image/png');
  }, images);

  // la minicarte (planche du regard) : Camille posée devant chaque repère, pour qu'il soit découvert,
  // puis à Perpignou ; on garde le carré de la minicarte tel qu'il est dessiné
  let minicarte = null;
  if (REGARD) minicarte = await page.evaluate(async () => {
    try { TLOC.cutAdvance(true); } catch (e) {}
    const T = TLOC, poser = (x, z) => { T.player.pos.set(x, T.getH(x, z), z); };
    for (const [x, z] of [[-135, 170], [-66, 97], [-230, -95], [-269, -339], [-175, -325], [185, -315], [283, 12], [400, 150], [470, 440], [462, -232]]) { poser(x, z); await new Promise((r) => setTimeout(r, 400)); }
    poser(420, -190); await new Promise((r) => setTimeout(r, 1200));
    const c = document.getElementById('minimap'); return c ? c.toDataURL('image/png') : null; });
  const nom = DIR + 'lieu-aveyron-' + JOUR + ETIQUETTE;
  fs.writeFileSync(nom + '-carte.png', Buffer.from(res.carte.split(',')[1], 'base64'));
  fs.writeFileSync(nom + '-vues.png', Buffer.from(planche.split(',')[1], 'base64'));
  if (minicarte) fs.writeFileSync(nom + '-minicarte.png', Buffer.from(minicarte.split(',')[1], 'base64'));
  delete res.carte;
  const sortie = { date: new Date().toISOString(), chargement_s: charge, erreurs: erreurs.slice(0, 20), ...res };
  fs.writeFileSync(nom + '.json', JSON.stringify(sortie, null, 1));
  const p = res.praticabilite, b = res.bati, s = res.sols, ok = res.cibles.filter((c) => c.atteinte).length;
  console.log(`chargé en ${charge.toFixed(1)} s ; ${res.source}${res.durees ? ' ; étapes du lieu (ms) ' + JSON.stringify(res.durees) : ''}`);
  console.log(`a. rues praticables ${p.part} % (${p.libres}/${p.points}), trop raides ${p.tropRaides} ; cibles atteintes en marchant ${ok}/${res.cibles.length}`);
  for (const c of res.cibles.filter((c) => !c.atteinte)) console.log(`   ✗ ${c.nom} (${c.x.toFixed(0)}, ${c.z.toFixed(0)}) : ${c.pourquoi || 'arrêtée à ' + c.resteA + ' m, en ' + c.arreteeA}`);
  console.log(`b. ${b.batiments} bâtiments : toits qui débordent ${b.toitsQuiDebordent}, sur un voisin ${b.toitsSurVoisin}, soubassements > 1,5 m ${b.soubassementsPlus15}, murs qui se chevauchent ${b.chevauchements}`);
  console.log(`c. rubans : ${s.part} % des points flottent (> 5 cm), ${s.enfoncePlus2cm} enfoncés ; z-fighting : ${s.zFighting.length ? s.zFighting.join(', ') : 'aucun'}`);
  console.log('→ ' + nom + '.json, -carte.png, -vues.png');
  if (erreurs.length) console.log('erreurs :', erreurs.slice(0, 5).join(' | '));
} finally { await browser.close(); }
