// Banc de l'acte IV, lot 2 (docs/DECOUPAGE-ACTE4.md, étapes 5 à 8) : le château fermé et le vieux
// des Sassi, Nunzia à soixante ans, Assunta la joueuse, la grotte sous le château de Gallipoli à
// marée basse (le banc de rochers praticable, les tarentules, la corde, la mer qui remonte), puis
// le tambourin et son ralenti. Une seule partie, le train pris comme un joueur ; une capture par
// moment clé ; le banc échoue à la moindre pageerror.
//
//   bancs/tour.sh node bancs/acte4-tambourin.mjs
import { navigateur, partieActe1, parler, filmer, filmerSujet, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
const charge = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000, polling: 300 });
const passerCut = async () => { for (let k = 0; k < 30; k++) { const r = await page.evaluate(() => { if (!TLOC.cut.active) return null; TLOC.cutAdvance(true); return 1; }); if (r === null) break; await page.waitForTimeout(120); } };
async function train(vers) {
  await parler(page, 'petit train');
  const l = await page.evaluate((vers) => { const M = TLOC.menu; const it = M.active && M.items.find((i) => i.label.includes(vers)); if (it) { it.fn(); return it.label; } return null; }, vers);
  ok('le train pour ' + vers, l);
  await page.waitForTimeout(1500); await charge(); await page.waitForTimeout(3000); await passerCut();
}
const etape = () => page.evaluate(() => TLOC.state.acte4);
const pos = (re) => page.evaluate((re) => { const it = TLOC.interactables.find((i) => { try { return (!i.enabled || i.enabled()) && new RegExp(re, 'i').test(typeof i.prompt === 'function' ? i.prompt() : ''); } catch (e) { return false; } }); return it ? [it.pos.x, it.pos.y, it.pos.z, 0] : null; }, re);
const repl = (r) => (r ? r.repliques.join(' | ') : 'personne');
const pouilles = (f) => page.evaluate(`import('./pouilles.js').then((P) => (${f})(P))`);

try {
  await partieActe1(page, { acte1: 'temple', templeVu: true, bow: true, lanterne: true, acte4: 'trente', lettre4: 'lettre', tambourin: undefined, corde4: undefined,
    ind4: { soleil: true, grandpere: true, ticket: true, mot: true, apprenti: true, chateau: true } });
  await page.goto(ORIGINE + '/matera.html'); await charge(); await page.waitForTimeout(3000); await passerCut();
  await page.waitForFunction(() => window.__matera && __matera.vieux, null, { timeout: 30000 }).catch(() => {});
  // 5. le château fermé
  const porte = await parler(page, 'pousser la porte');
  ok('5. une porte du château : pas de serrure', porte, '');
  const pp = await page.evaluate(() => __matera.portes && __matera.portes.map((p) => [p.x, p.y, p.z, p.yaw]));
  if (pp) await filmerSujet(page, `acte4-tambourin-${JOUR}-porte.jpg`, pp[1], { yaw: 0 });
  // les portes s'atteignent-elles à pied depuis l'arrivée ? (grille de 1 m, marche de 0,5 m)
  const atteintes = await page.evaluate((pp) => { const L = TLOC.G.level, k = (x, z) => x + ',' + z, vu = new Set(['-40,20']), f = [[-40, 20]], buts = pp.map(() => false);
    while (f.length && vu.size < 150000) { const [x, z] = f.shift(); pp.forEach(([px, , pz], i) => { if (Math.hypot(x - px, z - pz) < 2.5) buts[i] = true; });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (vu.has(k(nx, nz)) || L.blocked(nx, nz, 0.5) || Math.abs(TLOC.getH(nx, nz) - TLOC.getH(x, z)) > 0.5) continue; vu.add(k(nx, nz)); f.push([nx, nz]); } }
    return buts; }, pp);
  ok('5. les trois portes s’atteignent à pied depuis l’arrivée', atteintes && atteintes.every(Boolean), JSON.stringify(atteintes));
  const pv = await pos('vieux'); if (pv) await filmerSujet(page, `acte4-tambourin-${JOUR}-vieux.jpg`, pv);
  const vi = await parler(page, 'parler au vieux');
  ok('5. le vieux des Sassi : un rythme', vi && /rythme/.test(repl(vi)) && (await etape()) === 'rythme', repl(vi));

  await train('Gallipoli');
  const n60 = await pos('Nunzia'); if (n60) await filmerSujet(page, `acte4-tambourin-${JOUR}-nunzia60.jpg`, n60);
  const r60 = await parler(page, 'Nunzia');
  ok('6. Nunzia, 60 ans : la pizzica, la joueuse', r60 && /pizzica/.test(repl(r60)) && (await etape()) === 'soixante', repl(r60));

  await train('Alberobello');
  await page.waitForFunction(() => TLOC.interactables.some((i) => /joueuse/.test(typeof i.prompt === 'function' ? i.prompt() : '')), null, { timeout: 30000 }).catch(() => {});
  const pj = await pos('joueuse'); ok('7. Assunta est là', pj); if (pj) await filmerSujet(page, `acte4-tambourin-${JOUR}-assunta.jpg`, pj);
  const as = await parler(page, 'joueuse');
  ok('7. Assunta : les tarentules, les grottes', as && /tarentules/.test(repl(as)) && (await etape()) === 'corde', repl(as));

  await train('Gallipoli');
  // 8. la marée basse, poussée pour le banc : le temps de la marée au creux
  await pouilles('(P) => { P.TEMPS.tMaree = 135; }'); await page.waitForTimeout(1500);
  ok('8. marée basse : le banc découvert', await page.evaluate(() => __gallipoli.decouvert()));
  const nT = await page.evaluate(() => TLOC.enemies.filter((e) => e.kind === 'tarentule' && !e.dead).length);
  ok('8. les tarentules gardent le banc', nT >= 4, nT + ' tarentules');
  // du bout de la jetée à la bouche de la grotte, à pied (grille de 0,5 m, marche de 0,5 m)
  const chemin = await page.evaluate(() => { const L = TLOC.G.level, [bx, bz] = __gallipoli.bouche(), [sx, sz] = __gallipoli.BANC[0], q = 0.5;
    const k = (x, z) => Math.round(x / q) + ',' + Math.round(z / q), vu = new Set([k(sx, sz)]), f = [[sx, sz]];
    while (f.length && vu.size < 40000) { const [x, z] = f.shift(); if (Math.hypot(x - bx, z - bz) < 2) return true;
      for (const [dx, dz] of [[q, 0], [-q, 0], [0, q], [0, -q]]) { const nx = x + dx, nz = z + dz; if (vu.has(k(nx, nz)) || L.blocked(nx, nz, 0.5) || Math.abs(TLOC.getH(nx, nz) - TLOC.getH(x, z)) > 0.5) continue; vu.add(k(nx, nz)); f.push([nx, nz]); } }
    return false; });
  ok('8. de la jetée à la grotte à pied, à marée basse', chemin);
  const [bx, bz, by] = await page.evaluate(() => __gallipoli.bouche());
  const pt = await page.evaluate(() => { const e = TLOC.enemies.find((e) => e.kind === 'tarentule' && !e.dead); return e ? [e.pos.x, e.pos.y, e.pos.z, 0] : null; });
  if (pt) await filmer(page, `acte4-tambourin-${JOUR}-tarentule.jpg`, [pt[0] + 2.2, pt[1] + 1.2, pt[2] + 2.2], [pt[0], pt[1] + 0.3, pt[2]]);
  // les tarentules vaincues (le banc ne se bat pas : il les frappe), puis la corde
  await page.evaluate(() => { for (const e of TLOC.enemies) if (e.kind === 'tarentule') for (let k = 0; k < 5 && !e.dead; k++) TLOC.hitEnemy(e, 5, e.pos.x + 1, e.pos.z); });
  await parler(page, 'corde du tambourin', { avant: [bx + 3, bz + 3] });
  ok('8. la corde ramassée', await page.evaluate(() => TLOC.state.corde4 === true));
  // la mer remonte, Camille sur le banc : repoussée sur la jetée
  // (au milieu du dernier tronçon : à côté de la bouche, on tombait dans l'eau, pas sur le banc)
  await page.evaluate(() => { const B = __gallipoli.BANC, [ax, az, ay, bx, bz] = B[B.length - 1]; TLOC.player.pos.set((ax + bx) / 2, ay, (az + bz) / 2); });
  await pouilles('(P) => { P.TEMPS.tMaree = 45; }'); await page.waitForTimeout(1500);
  const d0 = await page.evaluate(() => { const [x, z] = __gallipoli.BANC[0], p = TLOC.player.pos; return Math.hypot(p.x - x, p.z - z); });
  ok('8. la mer remonte : Camille repoussée sur la jetée', d0 < 1, d0.toFixed(1) + ' m');

  await train('Alberobello');
  const as2 = await parler(page, 'joueuse');
  ok('8. Assunta : la pizzica, le tambourin', as2 && /pizzica/.test(repl(as2)) && await page.evaluate(() => TLOC.state.tambourin === true) && (await etape()) === 'tambourin', repl(as2));
  // K : le ralenti
  await page.keyboard.press('KeyK'); await page.waitForTimeout(600);
  const lent = await pouilles('(P) => P.TEMPS.lent');
  ok('8. K : le temps ralentit autour de Camille', lent < 1, 'lent ' + lent);
  const pc = await page.evaluate(() => [TLOC.player.pos.x, TLOC.player.pos.y, TLOC.player.pos.z, TLOC.player.yaw]);
  await filmerSujet(page, `acte4-tambourin-${JOUR}-ralenti.jpg`, pc, { camille: true, attente: 600 });
  ok('le carnet : la joueuse, les tarentules', /tarentules/.test(await page.evaluate(() => TLOC.G.level.indices())));
  ok('l’objectif : les portes au tambourin', /tambourin/.test(await page.evaluate(() => TLOC.G.level.objective())));
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `acte4-tambourin-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
