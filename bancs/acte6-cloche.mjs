// Banc de l'acte VI, lots 2 à 4 : l'autre rive (la fontaine, les trois traces, la forêt du Buc), maître
// Cornil à la forge, la galerie noyée de la mine de l'Aveyron (le métal du cœur du Dormeur), les bandits
// des ruines du Buc et la tombe de Salvaert (le sixième vers), la fonte de la Grande Cloche.
// La partie est posée au pont abaissé (`acte6: 'rive'`), les dons posés.
//
//   bancs/tour.sh node bancs/acte6-cloche.mjs
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const nom = (n) => `acte6-cloche-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const pret = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
const finir = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };
const etape = () => dans(() => TLOC.state.acte6);
const message = () => dans(() => document.getElementById('msg')?.textContent || '');
const texte = (r) => (r ? r.repliques.join(' | ') : '');
const DONS = { acte5: 'course', troupeauxVu: true, force: true, souffle: true, elan: true, course: true, lasso: true, sword: true, pont6: true, marches6: 3 };

// ---------- l'autre rive ----------
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/temple.html'); await pret(); await pause(3000); await finir();
await dans((d) => { Object.assign(TLOC.state, d, { acte6: 'rive' }); TLOC.saveGame(true); }, DONS);
await parler(page, 'fêlure'); await finir();
await page.waitForURL(/rive\.html/, { timeout: 60000 }).catch(() => {});
const t0 = Date.now(); await pret(); console.log('    chargement de rive.html :', ((Date.now() - t0) / 1000).toFixed(1), 's'); await pause(4000); await finir();
const L = await dans(() => window.__rive);
verifier('sur l’autre rive, le pont abaissé', (await etape()) === 'rive');

for (const [re, k, mot] of [['regarder dans l’eau', 'fontaine', /biche/], ['^regarder$', 'epee', /épée de bois/], ['lire la pierre', 'pierre', /LIDERIC/], ['regarder en l’air', 'cabane', /cabane/]]) {
  await parler(page, re); await pause(300);
  verifier(`la trace : ${k}`, await dans((k) => !!(TLOC.state.traces6 || {})[k], k) && mot.test(await message()), await message());
}
await filmer(page, nom('fontaine'), [L.FONTAINE[0] + 7, 3, L.FONTAINE[1] + 8], [L.FONTAINE[0], 0.6, L.FONTAINE[1]]);
await filmer(page, nom('foret'), [-20, 30, -150], [L.FORGE.x, 4, L.FORGE.z]);
// on n'entre pas dans la forêt sans y buter : un tronc arrête Camille
verifier('la forêt arrête Camille', await dans(() => { let n = 0; for (let k = 0; k < 400; k++) { const x = -110 + Math.random() * 130, z = -310 + Math.random() * 140; if (TLOC.blocked(x, z, 0.4)) n++; } return n; }) > 20);

// ---------- maître Cornil ----------
await filmer(page, nom('forge'), [L.FORGE.x + 12, 4, L.FORGE.z + 14], [L.FORGE.x + 2, 2, L.FORGE.z]);
{ const r = await parler(page, 'parler', { avant: [L.FORGE.x + 1.5, L.FORGE.z + 8] }); console.log('   ', texte(r).slice(0, 220));
  verifier('Cornil : le moule et le métal du Dormeur', /moule de la Grande Cloche/.test(texte(r)) && /Dormeur/.test(texte(r))); }
await pause(400);
verifier('l’étape passe à la forge', (await etape()) === 'forge');

// ---------- la galerie noyée (Aveyron) ----------
await page.goto(ORIGINE + '/aveyron.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte2, null, { timeout: 300000, polling: 300 });
await pause(4000); await finir();
await dans(() => { const T = TLOC; Object.assign(T.state, { acte2: 'pluie', ind2: { ...(T.state.ind2 || {}), coeur: true, faille: true } }); T.saveGame(true); });
await parler(page, 'entrer dans la faille'); await pause(800); await finir();
await dans(() => { TLOC.state.souffle = false; });
await parler(page, 'plonger dans l’eau noire'); await pause(300);
verifier('sans le souffle : l’eau noire refuse', /retenir son souffle/.test(await message()), await message());
await dans(() => { TLOC.state.souffle = true; TLOC.state.force = false; });
await parler(page, 'plonger dans l’eau noire'); await pause(800);
verifier('avec le souffle : dans la galerie noyée', await dans(() => TLOC.player.pos.y > 590 && Math.abs(TLOC.player.pos.x - 100) < 5));
await page.screenshot({ path: new URL('resultats/' + nom('galerie'), import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), quality: 80 });
// (le message peut être remplacé par celui de la qualité automatique : on vérifie que la porte barre le passage)
{ await parler(page, 'pousser la porte de pierre'); const m = await message();
  await dans(() => { TLOC.player.yaw = Math.PI; TLOC.G.camYaw = Math.PI; });
  await page.keyboard.down('KeyW'); await pause(1500); await page.keyboard.up('KeyW');
  const z = await dans(() => TLOC.player.pos.z);
  verifier('sans la force : la porte ne bouge pas', z > -160 && (/ne bouge pas/.test(m) || /Qualité/.test(m)), `${m} ; z ${z.toFixed(1)}`); }
await dans(() => { TLOC.state.force = true; });
await parler(page, 'pousser la porte de pierre'); await pause(300);
// on marche jusqu'à l'éclat, derrière la porte : la porte ne bloque plus
await dans(() => { TLOC.player.yaw = Math.PI; TLOC.G.camYaw = Math.PI; });
await page.keyboard.down('KeyW'); await pause(2200); await page.keyboard.up('KeyW');
verifier('derrière la porte, à pied', await dans(() => TLOC.player.pos.z < -160 - 1), await dans(() => TLOC.player.pos.z.toFixed(1)));
await page.screenshot({ path: new URL('resultats/' + nom('eclat'), import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), quality: 80 });
{ const r = await parler(page, 'prendre l’éclat'); verifier('le métal du cœur du Dormeur', /métal du cœur du Dormeur/.test(texte(r)) && (await etape()) === 'metal'); }
await parler(page, 'remonter vers la cave'); await pause(400);

// ---------- les ruines, la tombe ----------
await page.goto(ORIGINE + '/temple.html'); await pret(); await pause(3000); await finir();
await parler(page, 'fêlure'); await finir();
await page.waitForURL(/rive\.html/, { timeout: 60000 }).catch(() => {}); await pret(); await pause(3000); await finir();
await dans((R) => { TLOC.player.pos.set(R.x, TLOC.getH(R.x, R.z + 40), R.z + 40); }, L.RUINES); await pause(1500);
const nb = await dans(() => TLOC.enemies.filter((e) => !e.dead && /bandit6|chef6/.test(e.kind)).length);
verifier('les bandits du Buc dans les ruines', nb === 6, nb);
await finir();
await filmer(page, nom('ruines'), [L.RUINES.x + 18, 12, L.RUINES.z + 30], [L.RUINES.x, 6, L.RUINES.z]);
{ const r = await parler(page, '^la tombe$'); await pause(200); verifier('la tombe attend la fin du combat', /bandits/.test(await message())); }
await dans(() => { for (const e of TLOC.enemies) if (!e.dead && /bandit6|chef6/.test(e.kind)) TLOC.hitEnemy(e, 99, e.pos.x + 1, e.pos.z); });
await pause(2500);
verifier('la bande vaincue', await dans(() => TLOC.state.bande6 === true));
{ const r = await parler(page, 'lire la tombe'); console.log('   ', texte(r));
  verifier('le sixième vers, et la phrase de la garde', /fermera la porte/.test(texte(r)) && /la garde l’achève/.test(texte(r)) && (await etape()) === 'tombe'); }
await filmer(page, nom('tombe'), [L.RUINES.x + 2, L.RUINES.h + 3, L.RUINES.z + 8], [L.RUINES.x, L.RUINES.h + 0.8, L.RUINES.z + 2], { attente: 2500 });

// ---------- la fonte ----------
await parler(page, 'parler', { avant: [L.FORGE.x + 1.5, L.FORGE.z + 8] });
await pause(3000);
await page.screenshot({ path: new URL('resultats/' + nom('fonte'), import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), quality: 80 });
await pause(7000);
{ const r = []; for (let k = 0; k < 20; k++) { const s = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const s = T.cut.cur && T.cut.cur.say; T.cutAdvance(true); return s; }); if (s === null) break; r.push(s); await pause(100); }
  console.log('   ', r.join(' | '));
  verifier('la Grande Cloche est neuve', (await etape()) === 'cloche' && await dans(() => TLOC.state.grandeCloche === true) && /pas encore sonné/.test(r.join())); }
await filmer(page, nom('cloche'), [L.FORGE.x + 11, 2.5, L.FORGE.z + 11], [L.FORGE.x + 7, 1.2, L.FORGE.z + 6]);

// ---------- le sixième vers au Temple ----------
await page.goto(ORIGINE + '/temple.html'); await pret(); await pause(3000); await finir();
verifier('le Temple charge avec le sixième vers', await dans(() => TLOC.state.vers6 === true));

verifier('aucune erreur de page', erreurs.length === 0, erreurs.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
