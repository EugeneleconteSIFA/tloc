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
//   bancs/tour.sh node bancs/lieu-thailande.mjs [http://127.0.0.1:8000]
//
// Sortie : bancs/resultats/lieu-thailande-<date>.json
import { createRequire } from 'module';
import fs from 'fs';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const { chromium } = createRequire(`${process.env.HOME}/Documents/Projet-Padel/package.json`)('playwright');
const DIR = new URL('resultats/', import.meta.url).pathname, JOUR = new Date().toISOString().slice(0, 10);

const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`${ORIGINE}/thailande.html`);
  await p.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000 });
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
  const pc = (P) => `${(100 * (1 - (P.bloques + P.raides) / Math.max(1, P.points))).toFixed(1)} % praticable (${P.points} points sur terre : ${P.bloques} bloqués, ${P.raides} trop raides${P.enMer != null ? ` ; ${P.enMer} en mer, non comptés` : ''})`;
  console.log('baie :', pc(res.tot));
  for (const [m, P] of Object.entries(res.par)) console.log('  ' + m.padEnd(7), pc(P));
  console.log('pires tronçons :'); for (const t of res.pires.slice(0, 10)) console.log('  ', JSON.stringify(t));
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(`${DIR}lieu-thailande-${JOUR}.json`, JSON.stringify({ date: new Date().toISOString(), ...res }, null, 1));
} finally { await b.close(); }
