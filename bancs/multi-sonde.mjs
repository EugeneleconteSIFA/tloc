// La sonde de terrain d'une arène (docs/NOTE-MULTI.md : « relevée en marchant aux règles du moteur
// avant d'en tailler les aires ») : depuis un point de départ, ce qu'on atteint À PIED, case par case
// (1 m), comme Camille marche — `blocked` au rayon 0,5 m, une marche de 0,6 m au plus. Rend
// l'étendue, la surface, les hauteurs, le barycentre, la distance à pied du barycentre aux bords, et
// deux points éloignés l'un de l'autre (les départs des camps), avec la distance à pied qui les sépare.
//
//   bancs/tour.sh node bancs/multi-sonde.mjs page.html x z [rayon] [x1,z1;x2,z2;…]
// (les points donnés en dernier sont recalés sur la case atteinte la plus proche : où poser départs et objets)
import { navigateur, ORIGINE } from './acte1-outils.mjs';

const [page_, sx, sz, rmax = '140', cand = ''] = process.argv.slice(2);
// TLOC_PAS : la taille d'une case (1 m dehors ; 0,5 m dans un intérieur encombré, l'estaminet)
const PAS = Number(process.env.TLOC_PAS || 1);
const CAND = cand ? cand.split(';').map((c) => c.split(',').map(Number)) : [];
const { b, page, erreurs } = await navigateur();
// en instance, pour voir le lieu comme le multi le voit (l'acte IV ne doit rien y faire)
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
await page.goto(ORIGINE + '/' + page_);
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000 });
await page.waitForTimeout(2000);
const r = await page.evaluate(([sx, sz, R, CAND, PAS]) => {
  // (les intérieurs, l'estaminet, n'ont pas de blocked à eux : celui du moteur)
  const q = (v) => Math.round(v / PAS) * PAS;
  const L = { blocked: TLOC.G.level.blocked || TLOC.blocked }, H = (x, z) => TLOC.getH(x, z), k = (x, z) => q(x).toFixed(2) + ',' + q(z).toFixed(2);
  const dist = new Map([[k(sx, sz), 0]]), file = [[sx, sz]]; let hmin = 1e9, hmax = -1e9;
  // une marche en largeur, huit voisines (la diagonale vaut 1,41 m)
  while (file.length) { const [x, z] = file.shift(), d = dist.get(k(x, z)), h = H(x, z); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = q(x + dx * PAS), nz = q(z + dz * PAS); if (dist.has(k(nx, nz)) || Math.hypot(nx - sx, nz - sz) > R) continue;
      if (L.blocked(nx, nz, 0.5) || Math.abs(H(nx, nz) - h) > 0.6) continue;
      dist.set(k(nx, nz), d + Math.hypot(dx, dz) * PAS); file.push([nx, nz]); } }
  const pts = [...dist.keys()].map((s) => s.split(',').map(Number));
  const aire = pts.length * PAS * PAS;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, cx = 0, cz = 0;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); cx += x; cz += z; }
  cx /= pts.length; cz /= pts.length;
  // le point atteint le plus proche du barycentre (le centre de l'arène doit être marchable)
  let c = pts[0]; for (const p of pts) if (Math.hypot(p[0] - cx, p[1] - cz) < Math.hypot(c[0] - cx, c[1] - cz)) c = p;
  // les deux départs : le plus loin du centre à vol d'oiseau, puis le plus loin de lui
  const loin = (o) => pts.reduce((m, p) => (Math.hypot(p[0] - o[0], p[1] - o[1]) > Math.hypot(m[0] - o[0], m[1] - o[1]) ? p : m), pts[0]);
  const A = loin(c), B = loin(A);
  const rayons = [0.5, 0.8, 0.95].map((q) => { const ds = pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])).sort((a, b) => a - b); return Math.round(ds[Math.floor(ds.length * q) - 1]); });
  const recales = CAND.map(([x, z]) => { let m = pts[0]; for (const p of pts) if (Math.hypot(p[0] - x, p[1] - z) < Math.hypot(m[0] - x, m[1] - z)) m = p; return [m[0], m[1], Math.round(dist.get(k(m[0], m[1])))]; });
  return { recales, surface: aire, etendue: [x0, z0, x1, z1], hauteurs: [+hmin.toFixed(1), +hmax.toFixed(1)], centre: c, rayonsDuCentre_50_80_95: rayons, departA: A, departB: B, ecartAB: Math.round(Math.hypot(A[0] - B[0], A[1] - B[1])) };
}, [Number(sx), Number(sz), Number(rmax), CAND, PAS]);
console.log(page_, JSON.stringify(r));
console.log('erreurs', erreurs.filter((e) => /PAGEERROR/.test(e)).length);
await b.close();
