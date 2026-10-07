// Banc de l'acte V, lot B (docs/DECOUPAGE-ACTE5.md, étapes 4 et 5) : les trois témoins qu'on ne voit
// qu'à deux coups de sonnaille (le chevalier au péage de la Garde-Guérin, l'ouvrier de 1870 sur la voie
// de Villefort, la bergère de 1765 au bois du Pouget), par les vieux chemins ; puis la tour de la
// Garde-Guérin : la porte d'autrefois, trois salles qu'on traverse au passé, les loups de 1765 qui
// fuient la sonnaille, la chambre du loup. Une seule partie, posée à « sonnaille ».
//
//   bancs/tour.sh node bancs/acte5-tour.mjs [étiquette]
import { navigateur, parler, filmer, filmerSujet, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'b';
const nom = (n) => `acte5-tour-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text())) { if (/favicon/.test(m.location().url)) favicons++; else console.log('    absent :', m.location().url); } });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const ind = (k) => dans((k) => !!(TLOC.state.ind5 && TLOC.state.ind5[k]), k);
const finir = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };
const charger = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte5, null, { timeout: 300000, polling: 300 });
const menu = (re) => dans((re) => { const M = TLOC.menu; if (!M.active) return null; const it = M.items.find((i) => new RegExp(re, 'i').test(i.label)); if (it) { it.fn(); return it.label; } return null; }, re);
async function aller(lieu, re) { await parler(page, 'vieux chemin'); await pause(300); await menu(re); await page.waitForURL(new RegExp(lieu), { timeout: 120000 }).catch(() => {}); await charger(); await pause(4500); await finir(); }
async function deuxCoups() { await page.keyboard.press('KeyN'); await pause(150); await page.keyboard.press('KeyN'); await pause(900); }
// se poser à 2 m d'un témoin, sonner deux coups, lui parler
async function temoin(qui) {
  const p = await dans((q) => window.__acte5.temoins && window.__acte5.temoins[q], qui); if (!p) return { p: null, t: '' };
  await dans(([x, y, z]) => { const T = TLOC; T.player.pos.set(x + 1.5, T.getH(x + 1.5, z), z); }, p); await pause(300);
  const avant = await dans(() => !!document.querySelector('canvas').style.filter);
  await deuxCoups();
  const r = await dans(([x, z]) => { const T = TLOC, it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && i.prompt() === 'parler').sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))[0]; if (!it || Math.hypot(it.pos.x - x, it.pos.z - z) > 1) return false; it.fn(); return true; }, [p[0], p[2]]);
  const rep = []; for (let k = 0; r && k < 30; k++) { await pause(120); const s = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say || ''; T.cutAdvance(true); return s; }); if (s === null) break; if (s) rep.push(s); }
  return { p, t: rep.join(' | '), avant };
}

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/garde-guerin.html'); await charger(); await pause(4000); await finir();
await dans(() => { Object.assign(TLOC.state, { acte5: 'sonnaille', sonnaille: true, sword: true, chienSuit: true, chienRendu: true, ind5: { boulangere: true, pont: true, enfants: true, sifflet: true, sonnaille: true } }); TLOC.player.maxHp = TLOC.player.hp = 40; TLOC.saveGame(true); });

// 1. le chevalier, au péage
{ const r = await temoin('chevalier'); console.log('   ', r.t.slice(0, 160));
  verifier('le chevalier : qui (un loup grand comme une grange)', /grange/.test(r.t) && await ind('qui'));
  if (r.p) await filmerSujet(page, nom('chevalier'), [...r.p, 0]); }
// 2. Villefort : l'ouvrier de 1870
await aller('villefort', 'Villefort');
{ const r = await temoin('ouvrier'); console.log('   ', r.t.slice(0, 160));
  verifier('l’ouvrier de 1870 : comment (la porte d’autrefois)', /une porte/.test(r.t) && await ind('comment'));
  if (r.p) { await deuxCoups(); await filmer(page, nom('ouvrier'), [r.p[0] + 7, r.p[1] + 3, r.p[2] + 6], [r.p[0], r.p[1] + 1, r.p[2]], { attente: 600 }); } }
// 3. le Pouget : la bergère de 1765
await aller('pouget', 'Pouget');
{ const r = await temoin('bergere'); console.log('   ', r.t.slice(0, 160));
  verifier('la bergère de 1765 : où (la tour)', /tour de la Garde-Guérin/.test(r.t) && await ind('ou'));
  verifier('les trois témoins entendus : « temoins »', await dans(() => TLOC.state.acte5 === 'temoins'));
  if (r.p) { await deuxCoups(); await filmer(page, nom('bergere'), [r.p[0] + 7, r.p[1] + 3, r.p[2] + 6], [r.p[0], r.p[1] + 1, r.p[2]], { attente: 600 }); } }
// 4. la tour de la Garde-Guérin
await aller('garde', 'Garde');
{ const r0 = await parler(page, 'la porte de la tour'); await finir();
  verifier('au présent, la porte est murée', !(await dans(() => !!window.__acte5.salle)));
  await deuxCoups();
  const pt = await dans(() => window.__acte5.porteTour);
  await filmer(page, nom('porte'), [pt[0] + 3, await dans(([x, z]) => TLOC.getH(x, z), pt) + 2, pt[1] + 6], [pt[0], await dans(([x, z]) => TLOC.getH(x, z), pt) + 1.3, pt[1] - 2], { attente: 500 });
  await parler(page, 'entrer dans la tour'); await pause(600);
  verifier('au passé, on entre dans la tour', await dans(() => !!window.__acte5.salle && window.__acte5.salle.i === 0 && TLOC.player.pos.y > 690));
  // monter : au présent l'escalier est effondré
  await pause(8500);   // le passé s'efface
  await parler(page, 'l’escalier effondré'); await pause(300);
  verifier('au présent, l’escalier est coupé', await dans(() => window.__acte5.salle.i === 0));
  const S = await dans(() => { const S = window.__acte5.salle; return [S.x, S.y, S.z]; });
  await filmer(page, nom('salle-present'), [S[0] - 3, S[1] + 2.5, S[2] + 3], [S[0] + 2, S[1] + 1, S[2] - 2], { camille: true, attente: 500 });
  await deuxCoups();
  await filmer(page, nom('salle-passe'), [S[0] - 3, S[1] + 2.5, S[2] + 3], [S[0] + 2, S[1] + 1, S[2] - 2], { camille: true, attente: 300 });
  await parler(page, 'monter l’escalier'); await pause(800);
  const l = await dans(() => ({ i: window.__acte5.salle.i, n: (window.__acte5.loups1765 || []).filter((e) => !e.dead).length }));
  verifier('deuxième salle : les loups de 1765', l.i === 1 && l.n === 3, JSON.stringify(l));
  await pause(8500); await deuxCoups();
  verifier('ils fuient la sonnaille', await dans(() => (window.__acte5.loups1765 || []).every((e) => e.dead)));
  // (parler lit et passe les répliques : on prend celles qu'il rend)
  const rf = await parler(page, 'monter l’escalier'); await pause(800);
  const fin = rf ? rf.repliques.join(' | ') : '';
  verifier('en haut, la chambre du loup, vide', /litière/.test(fin || ''));
  await finir(); await pause(500);
  verifier('l’étape « tour »', await dans(() => TLOC.state.acte5 === 'tour'));
  await parler(page, 'redescendre et sortir'); await pause(800);
  verifier('on ressort au pied de la tour', await dans(() => !window.__acte5.salle && TLOC.player.pos.y < 300)); }

verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
