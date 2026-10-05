// Banc de l'acte I, morceau B1 (PLAN-2026-10-05-ACTE1.md) : de Gustave à la lanterne, joué de
// bout en bout dans une seule partie — Gustave à l'estaminet, la porte basse fermée, Émile, le
// pêcheur, les vers, la canne, la pêche au canal de la Tortue, le lit « jusqu'au soir », la nuit
// sur le bourg, la porte basse ouverte, Désiré au sommet, l'énigme, la lanterne, le matin.
// Une capture par moment clé ; le banc échoue à la première étape manquée ou sur une erreur.
//
//   bancs/tour.sh node bancs/acte1-b1.mjs [étiquette]
import { navigateur, partieActe1, parler, filmer, filmerSujet, JOUR, DIR } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'b1';
const nom = (n) => `acte1-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const st = (k) => page.evaluate((k) => TLOC.state[k], k);
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
// entrer dans un intérieur (il s'ouvre dans un cadre au-dessus de la ville) et rendre son cadre
async function entrer(re, page_html) {
  const r = await parler(page, re); if (!r) return null;
  for (let k = 0; k < 60; k++) { await pause(500); const f = page.frames().find((f) => f.url().includes(page_html));
    if (f && await f.evaluate(() => !!(window.TLOC && document.getElementById('loading')?.classList.contains('hidden'))).catch(() => false)) { await pause(2500); return f; } }
  return null;
}
async function sortir(f, re) {
  await f.evaluate(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); });
  await parler(f, re);
  for (let k = 0; k < 40; k++) { await pause(500); if (!page.frames().some((x) => x !== page.mainFrame() && x.url().includes('.html') && !x.isDetached())) break; }
  await pause(1500);
}

await partieActe1(page, { metLyderic: true, ind: { crypte: true, crypteNoire: true, lanterne: true, cornelie: true, gustave: true, nuit: true } });

// 1. Gustave, à l'estaminet
{ const f = await entrer('estaminet', 'tavern.html');
  verifier('l’estaminet s’ouvre', !!f);
  if (f) { const r = await parler(f, 'Gustave'); console.log('   ', r && r.repliques.join(' | '));
    verifier('Gustave : le petit escalier, Émile a la clé', !!r && r.repliques.some((t) => /petit escalier derrière le beffroi/.test(t)) && r.repliques.some((t) => /sirop/.test(t)));
    await sortir(f, "sortir de l'estaminet"); }
  verifier('l’indice « escalier » est au carnet de la ville', !!(await dans(() => TLOC.state.ind.escalier))); }

// 2. la porte basse, de jour et sans clé
{ const pb = await dans(async () => { const { PARTAGE } = await import('./etat.js'); return [PARTAGE.porteBeffroi.x, PARTAGE.porteBeffroi.z, PARTAGE.porteBeffroi.verrou.r]; });
  verifier('la porte basse est fermée (verrou)', pb[2] > 0);
  const r = await parler(page, 'petite porte'); verifier('« Fermé à clé. »', !!r && /Fermé à clé/.test(r.repliques.join()));
  // depuis le parvis de la chapelle, devant le portail : la porte basse est au fond, à droite
  const v = await dans(async () => { const C = await import('./carte.js'), T = TLOC; return [...C.townWorld(-1.5, -10.5), ...C.townWorld(5.5, -12), T.getH(...C.townWorld(-1.5, -10.5))]; });
  await filmer(page, nom('porte-fermee'), [v[0], v[4] + 1.8, v[1]], [v[2], v[4] + 1.2, v[3]]); }

// 3. Émile, puis le pêcheur
{ const r = await parler(page, 'Émile'); verifier('Émile : le canal de la Tortue, le pêcheur', !!r && /canal de la Tortue/.test(r.repliques.join()));
  const p = await parler(page, 'pêcheur'); verifier('le pêcheur : des vers au champ d’Émile', !!p && /champ d’Émile/.test(p.repliques.join())); }

// 4. les vers : un coup d'épée dans une motte du champ du nord
{ const m = await dans(async () => { const { PARTAGE } = await import('./etat.js'); for (let k = 0; k < 20 && !(PARTAGE.vers.mottes && PARTAGE.vers.mottes.length); k++) await new Promise((r) => setTimeout(r, 100));
    const o = PARTAGE.vers.mottes[0]; return o ? [o.position.x, o.position.y, o.position.z, (PARTAGE.vers.mottes || []).length] : null; });
  verifier('les mottes de terre retournée sont posées', !!m, m ? `${m[3]} mottes` : '');
  if (m) {
    await filmerSujet(page, nom('mottes'), [m[0], m[1], m[2], 0]);
    await filmer(page, nom('mottes-haut'), [m[0] + 4, m[1] + 12, m[2] + 4], [m[0], m[1], m[2]]);
    await dans(([x, y, z]) => { const T = TLOC; T.player.pos.set(x - 1.2, T.getH(x - 1.2, z), z); T.player.yaw = Math.PI / 2; T.player.attackT = 0.1; }, m);
    await pause(400);
    verifier('des vers dans la motte', await st('vers'));
    const p = await parler(page, 'pêcheur'); verifier('le pêcheur donne la canne', await st('canne') && (await st('acte1')) === 'canne', p && p.repliques.join(' | ').slice(0, 60)); } }

// 5. la pêche au canal de la Tortue : lancer, attendre le bouchon, ferrer, ramener sans casser
{ const ou = await dans(async () => { const T = TLOC, C = await import('./carte.js');
    for (let r = 2; r < 30; r += 1) for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283, x = 436 + Math.cos(a) * r, z = 12 + Math.sin(a) * r;
      if (C.eauVisible(x, z) || C.sdEau(x, z) < 0.5 || T.blocked(x, z, 0.6, false, T.getH(x, z) + 0.5)) continue;
      for (let j = 0; j < 24; j++) { const yaw = j / 24 * 6.283, ex = x + Math.sin(yaw) * 4, ez = z + Math.cos(yaw) * 4;
        if (C.eauVisible(ex, ez) && C.sdEau(ex, ez) < -0.5) { T.player.pos.set(x, T.getH(x, z), z); T.player.yaw = yaw; T.G.camYaw = yaw; return [x, z, yaw]; } } }
    return null; });
  verifier('une berge face à l’eau, près du canal', !!ou);
  await pause(600);
  const r = await parler(page, 'pêcher'); verifier('« pêcher » s’offre face à l’eau', !!r);
  let vu = false, etapes = [];
  for (let k = 0; k < 250; k++) {
    const e = await dans(async () => { const { PARTAGE } = await import('./etat.js'); const P = PARTAGE.peche; return [P.phase, +P.tension.toFixed(2), +P.dist.toFixed(2)]; });
    if (etapes[etapes.length - 1] !== e[0]) etapes.push(e[0]);
    if (e[0] === 'touche') { await page.keyboard.down('Enter'); await pause(60); await page.keyboard.up('Enter'); }
    else if (e[0] === 'ramene') {
      if (e[1] > 0.7) await page.keyboard.up('Enter'); else if (e[1] < 0.35) await page.keyboard.down('Enter');
      if (!vu) { vu = true; await page.keyboard.down('Enter'); await pause(700); await page.screenshot({ path: DIR + nom('peche-ramene'), quality: 80 }); }
    } else if (e[0] === 'attente' && k % 20 === 5) await page.screenshot({ path: DIR + nom('peche-bouchon'), quality: 80 });
    else if (e[0] === null && k > 3) break;
    await pause(100);
  }
  await page.keyboard.up('Enter');
  console.log('    phases', etapes.join(' → '));
  verifier('la clé de l’escalier est repêchée', await st('cleBeffroi') && (await st('acte1')) === 'cle'); }
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); });

// 6. le lit de Camille : « jusqu'au soir »
{ await dans(async () => { const T = TLOC, C = await import('./carte.js'); const it = T.interactables.find((i) => /entrer dans la maison/.test(i.prompt()));
    T.player.pos.set(it.pos.x, T.getH(it.pos.x, it.pos.z), it.pos.z); });
  await pause(500);
  const f = await entrer('entrer dans la maison', 'house.html');
  verifier('la maison s’ouvre', !!f);
  if (f) {
    await parler(f, 'se coucher');
    const lab = await f.evaluate(() => { const M = TLOC.menu, it = M.items.find((i) => /jusqu.au soir/.test(i.label)); if (it) it.fn(); return it ? it.label : M.items.map((i) => i.label).join(' / '); });
    verifier('« Dormir jusqu’au soir » au lit', /soir/.test(lab), lab);
    for (let k = 0; k < 40; k++) { await pause(400); if (await f.evaluate(() => !TLOC.cut.active)) break; await f.evaluate(() => TLOC.cutAdvance(true)); }
    await f.screenshot?.({ path: DIR + nom('maison-nuit'), quality: 80 }).catch(() => {});
    await sortir(f, 'sortir de la maison');
  }
  verifier('la nuit est tombée sur Lille', await st('nuit')); }
await pause(1500);
// la nuit, vue du bourg : la place et le beffroi, une rue, le ciel
{ const v = await dans(async () => { const C = await import('./carte.js'); return [C.townWorld(-12, 6), C.townWorld(8, -12), C.townWorld(-20, -2), C.townWorld(10, 4)]; });
  await filmer(page, nom('nuit-place'), [v[0][0], 3, v[0][1]], [v[1][0], 12, v[1][1]], { attente: 3500 });
  await filmer(page, nom('nuit-rue'), [v[2][0], 2.5, v[2][1]], [v[3][0], 2, v[3][1]], { attente: 2500 });
  await filmer(page, nom('nuit-loin'), [120, 30, 560], [v[1][0], 20, v[1][1]], { attente: 2500 }); }

// 7. la porte basse s'ouvre, Désiré au sommet, l'énigme, la lanterne
{ const r = await parler(page, 'petite porte'); verifier('la porte basse s’ouvre avec la clé, la nuit', await st('porteBeffroi'));
  const d = await dans(async () => { const { PARTAGE } = await import('./etat.js'); const v = PARTAGE.desire; return [v.position.x, v.position.y, v.position.z, v.rotation.y, v.visible]; });
  verifier('Désiré veille au sommet', d[4] && d[1] > 20, d.map((n) => typeof n === 'number' ? +n.toFixed(1) : n).join(' '));
  await dans((d) => { const T = TLOC; T.player.pos.set(d[0] + Math.sin(d[3]) * 1.6, d[1], d[2] + Math.cos(d[3]) * 1.6); T.player.vy = 0; }, d);
  await pause(800);
  await filmerSujet(page, nom('desire-sommet'), [d[0], d[1], d[2], d[3]], { camille: true });
  const p = await parler(page, 'Désiré'); console.log('   ', p && p.repliques.join(' | ').slice(0, 200));
  await pause(600);
  // l'énigme : on répond mal une fois, puis bien
  const BONNES = ['La citadelle de Vauban', 'La cloche du beffroi', 'La Deûle'];
  const m1 = await dans((B) => { const M = TLOC.menu; if (!M.active) return null; const it = M.items.find((i) => !B.includes(i.label) && !/répondre/.test(i.label)); it.fn(); return M.items.map((i) => i.label); }, BONNES);
  verifier('Désiré pose l’énigme du guetteur', !!m1, m1 && m1.join(' / '));
  await pause(300); const mal = await dans(() => { const T = TLOC, s = T.cut.active && T.cut.cur ? T.cut.cur.say : ''; while (T.cut.active) T.cutAdvance(true); return s; });
  verifier('mauvaise réponse : « Regarde encore »', /Regarde encore/.test(mal || ''));
  await parler(page, 'Désiré'); await pause(600);
  await dans((B) => { const M = TLOC.menu; const it = M.items.find((i) => B.includes(i.label)); it.fn(); }, BONNES);
  await pause(300); await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); });
  verifier('la lanterne est donnée', await st('lanterne') && (await st('acte1')) === 'lanterne');
  verifier('la carte du guetteur avec', await st('carteBeffroi')); }

// 8. le matin
{ await dans(() => { TLOC.state.nuit = false; }); await pause(1500);
  const v = await dans(async () => { const C = await import('./carte.js'); return [C.townWorld(-12, 6), C.townWorld(8, -12)]; });
  await filmer(page, nom('matin-place'), [v[0][0], 3, v[0][1]], [v[1][0], 12, v[1][1]], { attente: 2500 });
  const dv = await dans(async () => { const { PARTAGE } = await import('./etat.js'); return [PARTAGE.desire.visible, PARTAGE.desire.position.y]; });
  verifier('Désiré est redescendu dans les rues', dv[0] && dv[1] < 5, dv.join(' ')); }

console.log(erreurs.length ? erreurs.join('\n') : 'aucune erreur');
await b.close();
process.exit(ok && !erreurs.length ? 0 : 1);
