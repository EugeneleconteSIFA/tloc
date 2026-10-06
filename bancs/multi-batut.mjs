// Le Batut est-il toujours praticable pour les bots ? (C8, 6 octobre : après les meubles composés, les
// portes.) Le graphe des bots (GRAPHE, batut.js) est posé à la main : chaque point doit rester libre, et
// chaque arête se parcourir sans heurter un obstacle — au rayon de Camille (0,5 m), à la hauteur du
// point (l'étage a ses capsules à plancher). Une capture de chaque pièce meublée.
//
//   bancs/tour.sh node bancs/multi-batut.mjs
import { navigateur, filmer, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
try {
  await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
  await page.goto(ORIGINE + '/batut.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.__batut && __batut.GRAPHE.n.length, null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const { n, a } = __batut.GRAPHE, B = TLOC.blocked, mauvais = [], aretes = [];
    n.forEach(([x, z, y = 0], i) => { if (B(x, z, 0.5, false, y + 0.1)) mauvais.push([i, +x.toFixed(1), +z.toFixed(1), +y.toFixed(1)]); });
    for (const [i, j] of a) { const [ax, az, ay = 0] = n[i], [bx, bz, by = 0] = n[j], L = Math.hypot(bx - ax, bz - az), k = Math.max(2, Math.ceil(L / 0.25));
      for (let t = 1; t < k; t++) { const f = t / k, x = ax + (bx - ax) * f, z = az + (bz - az) * f, y = ay + (by - ay) * f;
        if (B(x, z, 0.45, false, y + 0.1)) { aretes.push([i, j, +x.toFixed(1), +z.toFixed(1)]); break; } } }
    return { points: n.length, aretes: a.length, mauvais, coupees: aretes };
  });
  ok('les points du graphe des bots sont libres', !r.mauvais.length, `${r.points} points ; bloqués : ${JSON.stringify(r.mauvais.slice(0, 6))}`);
  ok('les arêtes se parcourent sans heurter un meuble', !r.coupees.length, `${r.aretes} arêtes ; coupées : ${JSON.stringify(r.coupees.slice(0, 8))}`);
  // les pièces meublées, au Batut (x < 0) : la salle à manger, la cuisine, la grande chambre
  for (const [nom, cam, at] of [['salle-a-manger', [-38, 3.2, -6.5], [-42, 0.6, -12]], ['cuisine', [-55, 3.2, 5], [-58, 0.6, 1.5]], ['chambre', [-39, 4.5 + 2.6, -10], [-42, 4.5 + 0.6, -16]]])
    await filmer(page, `multi-batut-${JOUR}-${nom}.jpg`, cam, at, { camille: true });
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `multi-batut-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
