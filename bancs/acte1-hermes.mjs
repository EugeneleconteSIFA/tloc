// Banc d'E3, Hermès et le voyage rapide (DIALOGUES-ACTE1.md, l'étape `citadelle`) : le cocher au relais
// de poste, au bout du pont de Fin, n'y est qu'à partir de la citadelle ; il ouvre le menu des lieux de
// Lille déjà découverts ; on descend devant le lieu choisi, sur une place libre ; le crieur le nomme.
//
//   bancs/tour.sh node bancs/acte1-hermes.mjs [étiquette]
import { navigateur, partieActe1, parler, filmer, filmerSujet, JOUR } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'e3';
const nom = (n) => `acte1-hermes-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const menu = (re) => dans((re) => { const M = TLOC.menu; if (!M.active) return null; const it = M.items.find((i) => new RegExp(re, 'i').test(i.label)); if (it) { it.fn(); return it.label; } return null; }, re);

// avant la citadelle : le relais est fermé
await partieActe1(page, { metLyderic: true, acte1: 'grille' });
await pause(3000);
verifier('avant la citadelle, Hermès n’est pas là', await dans(async () => { const { PARTAGE } = await import('./etat.js'); const h = PARTAGE.gensActe1.hermes; return !!h && !h.visible; }));

// à la citadelle : il est là, il parle, il mène
await dans(() => { const T = TLOC; Object.assign(T.state, { acte1: 'citadelle', decouverts: { ...(T.state.decouverts || {}), moulin: true, maison: true, estaminet: true } }); T.saveGame(true); });
await pause(800);
const h = await dans(async () => { const { PARTAGE } = await import('./etat.js'); const v = PARTAGE.gensActe1.hermes; return v ? [v.position.x, v.position.y, v.position.z, v.rotation.y, v.visible] : null; });
verifier('à la citadelle, Hermès attend au relais, près du pont de Fin', !!h && h[4] && Math.hypot(h[0] + 1, h[2] - 252) < 40, JSON.stringify(h && h.map((v) => +(+v).toFixed?.(1) || v)));
if (h) await filmerSujet(page, nom('hermes'), [h[0], h[1], h[2], h[3]]);
{ const r = await parler(page, 'Hermès'); console.log('   ', r && r.repliques.join(' | '));
  verifier('Hermès : « tout endroit de Lille que tu as déjà vu »', !!r && /déjà vu/.test(r.repliques.join()));
  await pause(600);
  const items = await dans(() => TLOC.menu.active ? TLOC.menu.items.map((i) => i.label) : null);
  verifier('le menu des lieux découverts', !!items && items.some((l) => /moulin/i.test(l)) && items.some((l) => /Rester/.test(l)), JSON.stringify(items));
  const cible = await dans(() => { const l = TLOC.lieux.find((l) => l.id === 'moulin'); return [l.x, l.z]; });
  await menu('moulin'); await pause(2200);
  const p = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  const d = Math.hypot(p[0] - cible[0], p[1] - cible[1]);
  verifier('on descend devant le moulin d’Émile', d < 30 && !(await dans(() => TLOC.blocked(TLOC.player.pos.x, TLOC.player.pos.z, 0.5, false, TLOC.player.pos.y + 0.5))), `${d.toFixed(1)} m du moulin`); }
// le crieur le nomme
{ const r = await parler(page, 'crieur'); verifier('le crieur nomme Hermès', !!r && /Hermès/.test(r.repliques.join()), r && r.repliques.join().slice(0, 120)); }

// la marchande de cartes, rue du Cygne : les plans de Vauban, contre trente écus
{ await dans(() => { const T = TLOC; Object.assign(T.state, { bourse: true, ecus: 50 }); T.saveGame(true); });
  const r = await parler(page, 'marchande de cartes'); verifier('la marchande : les plans de Vauban', !!r && /plans de Vauban/.test(r.repliques.join()), r && r.repliques.join().slice(0, 100));
  await pause(600); await menu('Acheter'); await pause(1500);
  const m = await dans(async () => { const { PARTAGE } = await import('./etat.js'); return { plans: !!TLOC.state.plansVauban, ecus: TLOC.state.ecus, marques: (PARTAGE.marques || []).length }; });
  verifier('les plans achetés : les coffres sur la carte', m.plans && m.ecus === 20 && m.marques > 0, JSON.stringify(m)); }

// la chambrée de la caserne des soldats (citadelle.js) : on entre, on la filme de l'intérieur
{ const entre = await dans(() => { const it = TLOC.interactables.find((i) => /entrer dans la caserne/.test(i.prompt())); if (!it) return false; TLOC.player.pos.set(it.pos.x, it.pos.y, it.pos.z); it.fn(); return true; });
  await pause(1200);
  const S = await dans(async () => { const { PARTAGE } = await import('./etat.js'); const S = PARTAGE.chambree && PARTAGE.chambree.S; return S ? [S.x, S.y, S.z] : null; });
  verifier('la chambrée de la caserne', entre && !!S && await dans(() => TLOC.player.pos.y > 400));
  if (S) await filmer(page, nom('chambree'), [S[0] + 5, S[1] + 2.4, S[2] + 2.8], [S[0] - 1, S[1] + 0.9, S[2] - 1], { camille: true }); }

verifier('aucune erreur de page', erreurs.filter((e) => !/favicon|404/.test(e)).length === 0, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
