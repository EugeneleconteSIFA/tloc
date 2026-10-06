// Banc du retour de l'acte II au Temple (passe D, demande de C1) : la partie posée à « pluie », on
// arrive sur l'île — la scène une fois (la Cloche du Midi, l'escalier, le rai de soleil, le deuxième
// vers, la porte des Îles), la plaque qui grave les vers trouvés, l'escalier où l'on monte vraiment.
//
//   bancs/tour.sh node bancs/acte2-temple.mjs [étiquette]
import { navigateur, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 't';
const nom = (n) => `acte2-temple-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/temple.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
await pause(3000);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); T.state.acte2 = 'pluie'; });
await pause(1500);

// la scène : quatre plans, dans l'ordre
const dits = [];
for (let k = 0; k < 30; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say; T.cutAdvance(true); return s || ''; });
  if (r === null) break; if (r) dits.push(r); await pause(400); }
console.log('   ', dits.join(' | ').slice(0, 300));
verifier('la scène du retour : la cloche, le rai, le vers, la porte', dits.length >= 4 && /Cloche du Midi/.test(dits[0]) && /gardienne/.test(dits.join()) && /pluie qui ne tombe pas/.test(dits.join()));
await pause(500);
verifier('vue une fois (state.midiVu)', await dans(() => TLOC.state.midiVu === true));
// l'escalier : un sol en spirale, jusqu'au palier
const e = await dans(() => { const T = TLOC, r = 7.3, pts = []; for (const a of [0.3, 2.0, 4.0, 6.0]) { const x = Math.cos(a) * r, z = Math.sin(a) * r; pts.push(+T.getH(x, z, 40).toFixed(2)); } return pts; });
verifier('l’escalier porte (des sols qui montent, sous les 15 m du palier)', e.some((h) => h > 1) && e.every((h) => h <= 15.5), JSON.stringify(e));
// filmer : la cloche au premier étage, le rai sur la cour, la plaque
await filmer(page, nom('cloche'), [5, 9, 6], [0, 14, 0]);
await filmer(page, nom('cour'), [14, 8, 30], [0, 6, 0]);
{ const a = 0.55, px = Math.sin(a) * 10.75, pz = Math.cos(a) * 10.75; await filmer(page, nom('plaque'), [px + Math.sin(a) * 3.5, 2.0, pz + Math.cos(a) * 3.5], [px, 1.9, pz]); }

verifier('aucune erreur de page', erreurs.length === 0, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
