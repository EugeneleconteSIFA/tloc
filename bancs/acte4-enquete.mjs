// Banc de l'acte IV, lot 1 (docs/DECOUPAGE-ACTE4.md, étapes 1 à 4) : l'arrivée à Alberobello, le
// temps qui court, Cosimo, le train, Nunzia à quinze ans, le voisin et le chef de dépôt à Matera,
// Nunzia à trente ans — joués de bout en bout dans une seule partie, en prenant le train comme un
// joueur (la gare, le menu). Une capture par moment clé ; le banc échoue à la moindre pageerror.
//
//   bancs/tour.sh node bancs/acte4-enquete.mjs
import { navigateur, partieActe1, parler, filmerSujet, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [], introuvables = new Set();
// les 404 : nommés (une texture absente n'est pas une erreur de l'acte, mais elle se dit)
page.on('response', (r) => { if (r.status() === 404) introuvables.add(r.url().replace(ORIGINE, '')); });
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
const charge = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000, polling: 300 });
// passer les dialogues qui s'ouvrent seuls (la réplique de Camille à l'arrivée)
const passerCut = async () => { const lu = [];
  for (let k = 0; k < 30; k++) { const r = await page.evaluate(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? `${c.who || ''} : ${c.say}` : ''; T.cutAdvance(true); return s; });
    if (r === null) break; if (r) lu.push(r); await page.waitForTimeout(120); } return lu; };
// le petit train, comme un joueur : l'invite de la gare, puis la ligne voulue
async function train(vers) {
  await parler(page, 'petit train');
  const l = await page.evaluate((vers) => { const M = TLOC.menu; const it = M.active && M.items.find((i) => i.label.includes(vers)); if (it) { it.fn(); return it.label; } return null; }, vers);
  ok('le train pour ' + vers, l);
  await page.waitForTimeout(1500); await charge(); await page.waitForTimeout(2500); await passerCut();
}
const etape = () => page.evaluate(() => TLOC.state.acte4);
const nunzia = () => page.evaluate(() => { const it = TLOC.interactables.find((i) => /Nunzia/.test(typeof i.prompt === 'function' ? i.prompt() : '')); return it ? [it.pos.x, it.pos.y, it.pos.z, 0] : null; });

try {
  // le prologue et l'acte I passés, l'arc en poche : on arrive par la porte des Heures
  await partieActe1(page, { acte1: 'temple', templeVu: true, bow: true, lanterne: true, acte4: undefined, ind4: undefined, lettre4: undefined });
  await page.goto(ORIGINE + '/alberobello.html'); await charge(); await page.waitForTimeout(2500);
  const dit = await passerCut();
  ok('1. l’arrivée : acte4 = arrivee', (await etape()) === 'arrivee');
  ok('1. Camille : « Le soleil… il court. »', dit.some((r) => /soleil/.test(r)), dit.join(' | '));
  // le soleil bouge : la direction à trois secondes d'écart
  const s1 = await page.evaluate(async () => { const E = await import('./engine.js?v=41'); return E.SUN_DIR.toArray(); });
  await page.waitForTimeout(3000);
  const s2 = await page.evaluate(async () => { const E = await import('./engine.js?v=41'); return E.SUN_DIR.toArray(); });
  ok('le soleil court', Math.hypot(s1[0] - s2[0], s1[1] - s2[1], s1[2] - s2[2]) > 0.05, JSON.stringify([s1, s2].map((v) => v.map((x) => +x.toFixed(2)))));
  const co = await parler(page, 'Cosimo');
  ok('1. Cosimo jeune : Gallipoli, le géant', co && co.repliques.some((r) => /\*\*Gallipoli\*\*/.test(r)), co && co.repliques.join(' | '));
  const pc = await page.evaluate(() => { const it = TLOC.interactables.find((i) => /Cosimo/.test(typeof i.prompt === 'function' ? i.prompt() : '')); return [it.pos.x, it.pos.y, it.pos.z, 0]; });
  await filmerSujet(page, `acte4-enquete-${JOUR}-cosimo.jpg`, pc);

  await train('Gallipoli');
  ok('Gallipoli chargée', await page.evaluate(() => TLOC.G.level.name === 'gallipoli'));
  ok('l’objectif mène à la jetée', /jetée/.test(await page.evaluate(() => TLOC.G.level.objective())));
  // la marée : le plan d'eau bouge
  const m1 = await page.evaluate(async () => (await import('./pouilles.js')).TEMPS.maree);
  await page.waitForTimeout(4000);
  const m2 = await page.evaluate(async () => (await import('./pouilles.js')).TEMPS.maree);
  ok('la marée bouge', Math.abs(m1 - m2) > 0.01, `${m1.toFixed(3)} → ${m2.toFixed(3)}`);
  const n15 = await nunzia(); ok('2. Nunzia est sur la jetée', n15);
  if (n15) await filmerSujet(page, `acte4-enquete-${JOUR}-nunzia15.jpg`, n15);
  const r15 = await parler(page, 'Nunzia');
  ok('2. Nunzia, 15 ans : le grand-père, les Sassi', r15 && r15.repliques.some((r) => /Sassi de Matera/.test(r)), r15 && r15.repliques.join(' | '));
  ok('2. acte4 = quinze, indices grandpere et ticket', (await etape()) === 'quinze' && await page.evaluate(() => TLOC.state.ind4.grandpere && TLOC.state.ind4.ticket));

  await train('Matera');
  // le voisin et le chef naissent après le chargement
  await page.waitForFunction(() => window.__matera && __matera.voisin && __matera.chef, null, { timeout: 30000 }).catch(() => {});
  const ch = await parler(page, 'chef de dépôt');
  ok('3. le chef de dépôt : au bout de la ligne', ch && ch.repliques.some((r) => /Alberobello/.test(r)) && await page.evaluate(() => TLOC.state.ind4.apprenti), ch && ch.repliques.join(' | '));
  const pv = await page.evaluate(() => __matera.places.voisin);
  await filmerSujet(page, `acte4-enquete-${JOUR}-voisin.jpg`, pv);
  const vo = await parler(page, 'voisin');
  ok('3. le voisin : Donato est mort, le mot', vo && vo.repliques.some((r) => /Donato/.test(r)) && (await etape()) === 'grandpere', vo && vo.repliques.join(' | '));
  // le voisin est-il atteignable à pied depuis l'arrivée ? (une recherche sur la grille de blocked)
  const atteint = await page.evaluate(([vx, , vz]) => { const L = TLOC.G.level, p = TLOC.player.pos, pas = 1, vu = new Set(), f = [[Math.round(-40), Math.round(20)]];
    const k = (x, z) => x + ',' + z; vu.add(k(...f[0]));
    while (f.length && vu.size < 60000) { const [x, z] = f.shift(); if (Math.hypot(x - vx, z - vz) < 2.5) return true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx * pas, nz = z + dz * pas; if (vu.has(k(nx, nz)) || L.blocked(nx, nz, 0.5)) continue;
        if (Math.abs(TLOC.getH(nx, nz) - TLOC.getH(x, z)) > 0.5) continue; vu.add(k(nx, nz)); f.push([nx, nz]); } }
    return false; }, pv);
  ok('3. le voisin s’atteint à pied depuis l’arrivée', atteint);

  await train('Gallipoli');
  const n30 = await nunzia(); if (n30) await filmerSujet(page, `acte4-enquete-${JOUR}-nunzia30.jpg`, n30);
  const r30 = await parler(page, 'Nunzia');
  ok('4. Nunzia, 30 ans : le Tramontano', r30 && r30.repliques.some((r) => /Tramontano/.test(r)), r30 && r30.repliques.join(' | '));
  ok('4. acte4 = trente, la lettre confiée', (await etape()) === 'trente' && await page.evaluate(() => TLOC.state.lettre4 === 'lettre'));
  ok('le carnet du journal', /Tramontano/.test(await page.evaluate(() => TLOC.G.level.indices())));
  // la nuit, pour voir : la phase poussée au soir
  await page.evaluate(async () => { (await import('./pouilles.js')).TEMPS.phase = 0.52; });
  await filmerSujet(page, `acte4-enquete-${JOUR}-soir.jpg`, n30 || [272, 0, 40, 0], { yaw: 2 });
  await page.evaluate(async () => { (await import('./pouilles.js')).TEMPS.phase = 0.8; });
  await filmerSujet(page, `acte4-enquete-${JOUR}-nuit.jpg`, n30 || [272, 0, 40, 0], { yaw: 2 });
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
if (introuvables.size) console.log('404 :', [...introuvables].join(', '));
fs.writeFileSync(DIR + `acte4-enquete-${JOUR}.json`, JSON.stringify({ pas, erreurs, introuvables: [...introuvables] }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
