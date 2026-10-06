// Banc du retour de l'acte III au Temple (temple.js, demande de C2) : la Cloche des Îles rapportée
// (state.clocheIles), la scène jouée une fois (la cloche au deuxième étage, les rigoles dont l'eau
// monte, la porte des Heures qui s'entrouvre, Camille qui hésite), puis plus jamais (state.ilesVu).
//
//   bancs/tour.sh node bancs/acte3-temple.mjs [étiquette]
import { navigateur, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte3-temple-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
// un 404 sans réponse vue par la page, c'est le favicon.ico que Chrome demande seul (demande n° 4 de la passe D)
let absents = 0; page.on('response', (r) => { if (r.status() >= 400) { absents++; console.log('    absent :', r.url()); } });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/temple.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
await pause(2500);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); });
await pause(1500);
const cloches0 = await dans(() => TLOC.scene.children.length);
await dans(() => { Object.assign(TLOC.state, { clocheIles: true, acte3: 'fete' }); });
await page.waitForFunction(() => TLOC.cut.active, null, { timeout: 10000 }).catch(() => {});
const lignes = [];
for (let k = 0; k < 20; k++) {
  const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur || {}; return c.say; });
  if (r === null) break;
  if (r && lignes[lignes.length - 1] !== r) { lignes.push(r); if (lignes.length === 1 || lignes.length === 2) { await pause(1200); await page.screenshot({ path: (await import('./acte1-outils.mjs')).DIR + nom(lignes.length === 1 ? 'cloche' : 'rigoles'), quality: 80 }); } }
  await dans(() => TLOC.cutAdvance(true)); await pause(300);
}
for (const l of lignes) console.log('    ' + l);
verifier('la scène du retour est jouée', lignes.length === 4 && /Cloche des Îles/.test(lignes[0]) && /hésite/.test(lignes[3]));
verifier('vue une fois', await dans(() => TLOC.state.ilesVu === true));
verifier('la cloche et les rigoles sont posées', (await dans(() => TLOC.scene.children.length)) > cloches0 + 6);
await filmer(page, nom('tour'), [7, 3, 15], [0, 4, 10]);
const vraies = erreurs.filter((e) => !/favicon/.test(e) && !(absents === 0 && /Failed to load resource/.test(e)));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
