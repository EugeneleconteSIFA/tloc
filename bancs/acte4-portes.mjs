// Les trois portes du château Tramontano, ouvertes (acte IV, étape 9) : une capture par porte, prise
// d'un endroit d'où un rayon atteint le seuil sans rien toucher (filmerSujet), et une de l'intérieur
// d'une salle vers la porte. Posées à la main (lot 3), les vues tombaient dans la courtine.
//
//   bancs/tour.sh node bancs/acte4-portes.mjs
import { navigateur, partieActe1, filmer, filmerSujet, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
try {
  await partieActe1(page, { acte1: 'temple', templeVu: true, acte4: 'chateau', tambourin: true, portes4: { 0: true, 1: true, 2: true }, levier4: { 0: true, 2: true } });
  await page.goto(ORIGINE + '/matera.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000 });
  await page.waitForFunction(() => window.__matera && __matera.portes && __matera.TOURS[0].salle, null, { timeout: 40000 }).catch(() => {});
  await page.evaluate(async () => { (await import('./pouilles.js')).TEMPS.phase = 0.25; });      // en plein jour
  const portes = await page.evaluate(() => __matera.portes.map((d) => { const p = d.g.position; return [p.x, p.y, p.z, d.yaw, d.vantail.visible, d.noir.visible]; }));
  ok('les trois portes sont ouvertes (vantail ôté, l’entrée noire)', portes.length === 3 && portes.every((p) => !p[4] && p[5]));
  const noms = ['sud', 'donjon', 'nord'];
  for (const [i, p] of portes.entries()) {
    const cam = await filmerSujet(page, `acte4-portes-${JOUR}-${noms[i]}.jpg`, [p[0], p[1] + 0.4, p[2], p[3]], { attente: 2200 });
    ok(`la porte ${noms[i]} filmée sans obstacle`, cam, cam ? cam.map((v) => v.toFixed(1)).join(', ') : 'de face, à défaut');
  }
  // du dedans de la tour sud, vers sa porte : le jour dans l'embrasure
  const v = await page.evaluate(() => { const T = __matera.TOURS[0]; return [[T.x - T.ux * (T.rin - 1.2), T.yf + 2.2, T.z - T.uz * (T.rin - 1.2)], [T.x + T.ux * T.rin, T.yf + 1.6, T.z + T.uz * T.rin]]; });
  await filmer(page, `acte4-portes-${JOUR}-sud-dedans.jpg`, v[0], v[1], { attente: 2200 });
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `acte4-portes-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
