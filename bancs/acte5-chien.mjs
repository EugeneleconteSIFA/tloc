// Banc de l'acte V, lot A (docs/DECOUPAGE-ACTE5.md, étapes 1 à 3) : Villefort, la porte de l'île,
// le chemin du Pouget dans le brouillard, l'enquête du chien (le vieux de la place, la boulangère, le
// chef de gare, les enfants du lavoir), le sifflet au pont Saint-Jean, le chien qui suit, le vieux
// chemin jusqu'au Pouget, le berger, la sonnaille (touche N, deux coups). Une seule partie.
//
//   bancs/tour.sh node bancs/acte5-chien.mjs [étiquette]
import { navigateur, parler, filmer, filmerSujet, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte5-chien-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text())) { if (/favicon/.test(m.location().url)) favicons++; else console.log('    absent :', m.location().url); } });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const etape = () => dans(() => TLOC.state.acte5);
const ind = (k) => dans((k) => !!(TLOC.state.ind5 && TLOC.state.ind5[k]), k);
const finir = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };
const charger = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte5, null, { timeout: 300000, polling: 300 });
// parler au passant (invite « parler ») le plus proche d'un point
async function parlerPres(x, z) {
  const ok = await dans(([x, z]) => { const T = TLOC, it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && i.prompt() === 'parler').sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))[0];
    if (!it) return false; T.player.pos.set(it.pos.x + 1, it.pos.y, it.pos.z); it.fn(); return true; }, [x, z]);
  const rep = [];
  for (let k = 0; ok && k < 40; k++) { await pause(120); const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? c.say : ''; T.cutAdvance(true); return s; }); if (r === null) break; if (r) rep.push(r); }
  return rep.join(' | ');
}
// choisir une ligne du menu ouvert (le poteau)
const menu = (re) => dans((re) => { const M = TLOC.menu; if (!M.active) return null; const it = M.items.find((i) => new RegExp(re, 'i').test(i.label)); if (it) { it.fn(); return it.label; } return null; }, re);

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/villefort.html'); await charger(); await pause(4000); await finir();
await dans(() => { TLOC.state.sword = true; TLOC.saveGame(true); });
verifier('l’acte commence à « arrivee »', (await etape()) === 'arrivee');

// 1. la porte de l'île, place du Bosquet
{ const p = await dans(() => { const it = TLOC.interactables.find((i) => /porte de l’île/.test(i.prompt())); return it ? [it.pos.x, it.pos.y, it.pos.z, TLOC.blocked(it.pos.x, it.pos.z + 3, 0.5, false, it.pos.y)] : null; });
  verifier('la porte de l’île est à Villefort, devant une place libre', !!p && !p[3], JSON.stringify(p));
  if (p) await filmer(page, nom('porte'), [p[0] + 5, p[1] + 2.5, p[2] + 8], [p[0], p[1] + 1.6, p[2]]); }

// 2. le vieux de la place ; le chemin du Pouget dans le brouillard
{ const t = await parlerPres(1578, -1136); console.log('   ', t.slice(0, 160));
  verifier('le vieux de la place : le chien, la boulangère', /boulangère/.test(t) && await ind('boulangere'));
  await parler(page, 'vieux chemin'); await pause(300); await menu('Pouget'); await pause(600);
  verifier('sans le chien, le chemin du Pouget ramène au poteau', await dans(() => location.pathname.includes('villefort'))); }

// 3. la boulangère, le chef de gare, les enfants du lavoir
{ const B = await dans(() => window.__acte5.boulangere); verifier('la boulangère est posée, devant sa boutique', !!B);
  if (B) { const t = await parlerPres(B[0], B[1]); verifier('la boulangère : le pont Saint-Jean', /pont Saint-Jean/.test(t) && await ind('pont'), t.slice(0, 100));
    const y = await dans(([x, z]) => TLOC.getH(x, z), B); await filmerSujet(page, nom('boulangere'), [B[0], y, B[1], 0]); }
  const t2 = await parlerPres(1458, -1272); verifier('le chef de gare : les enfants du lavoir', /enfants du lavoir/.test(t2) && await ind('enfants'), t2.slice(0, 100));
  const E = await dans(() => window.__acte5.enfants); const t3 = E ? await parlerPres(E[0], E[1]) : '';
  verifier('les enfants : le sifflet', /Deux notes/.test(t3) && await ind('sifflet'), t3.slice(0, 100)); }

// 4. le sifflet, au pont : le chien sort et suit
{ await parler(page, 'siffler'); await finir(); await pause(2500);
  const c = await dans(() => ({ e: TLOC.state.acte5, suit: TLOC.state.chienSuit, chien: !!(window.__acte5.chien && window.__acte5.chien.c) }));
  verifier('le chien sort de sous le pont et suit Camille', c.e === 'chien' && c.suit && c.chien, JSON.stringify(c));
  // Camille s'éloigne de 15 m : le chien suit
  await dans(() => { const p = TLOC.player.pos; p.set(p.x + 12, TLOC.getH(p.x + 12, p.z + 8), p.z + 8); }); await pause(3000);
  const d = await dans(() => { const o = window.__acte5.chien.c.position, p = TLOC.player.pos; return Math.hypot(o.x - p.x, o.z - p.z); });
  verifier('le chien la rejoint', d < 5, d.toFixed(1) + ' m');
  // sa taille, mesurée dans la scène : un chien de berger, de 50 à 90 cm à la tête (un réglage à 0,62 en faisait un chiot)
  const hc = await dans(() => { const b = new TLOC.THREE.Box3().setFromObject(window.__acte5.chien.c); return b.max.y - b.min.y; });
  verifier('le chien a la taille d’un chien de berger', hc > 0.5 && hc < 0.9, hc.toFixed(2) + ' m');
  const o = await dans(() => { const o = window.__acte5.chien.c.position; return [o.x, o.y, o.z]; }); await filmerSujet(page, nom('chien'), [...o, 0], { camille: true }); }

// 5. le vieux chemin jusqu'au Pouget, le berger, la sonnaille
{ await parler(page, 'vieux chemin'); await pause(300); await menu('Pouget');
  await page.waitForURL(/pouget/, { timeout: 120000 }).catch(() => {}); await charger(); await pause(4500); await finir();
  verifier('au Pouget, guidée par le chien', await dans(() => location.pathname.includes('pouget')));
  const r = await parler(page, 'parler au berger'); await finir(); console.log('   ', (r ? r.repliques.join(' | ') : '').slice(0, 200));
  const s = await dans(() => ({ e: TLOC.state.acte5, s: TLOC.state.sonnaille, rendu: TLOC.state.chienRendu }));
  verifier('le berger donne la sonnaille', s.e === 'sonnaille' && s.s && s.rendu, JSON.stringify(s));
  const bp = await dans(() => window.__acte5.berger); if (bp) await filmerSujet(page, nom('berger'), [...bp, 0]);
  // deux coups de sonnaille (N, N)
  await page.keyboard.press('KeyN'); await pause(150); await page.keyboard.press('KeyN'); await pause(900);
  verifier('deux coups : le passé (l’image passe au sépia)', await dans(() => window.__acte5.sonne === 'passe' && /sepia/.test(document.querySelector('canvas').style.filter)));
  await page.keyboard.press('KeyN'); await pause(900);
  verifier('un coup : le présent', await dans(() => window.__acte5.sonne === 'present')); }

verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
