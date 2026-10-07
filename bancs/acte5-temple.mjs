// Banc du retour de l'acte V au Temple (passe D2, demande de C4) : la partie posée à « course », on
// arrive sur l'île — la scène une fois (la Cloche des Troupeaux au quatrième étage, les cloches qui se
// balancent, les sonnailles, le cinquième vers, le mage pâle), la plaque qui grave le vers.
//
//   bancs/tour.sh node bancs/acte5-temple.mjs [étiquette]
import { navigateur, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 't';
const nom = (n) => `acte5-temple-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text())) { if (/favicon/.test(m.location().url)) favicons++; } });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/temple.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
await pause(3000);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); T.state.acte5 = 'course'; });
await pause(1500);

const dits = [];
for (let k = 0; k < 30; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say; T.cutAdvance(true); return s || ''; });
  if (r === null) break; if (r) dits.push(r); await pause(400); }
console.log('   ', dits.join(' | ').slice(0, 400));
verifier('la scène : la Cloche des Troupeaux, les sonnailles, le vers, le mage', dits.length >= 5 && /Cloche des Troupeaux/.test(dits[0]) && /sonnailles/.test(dits.join()) && /dernière sera la sienne/.test(dits.join()) && /Grande Cloche de Lille/.test(dits.join()));
await pause(500);
verifier('vue une fois (state.troupeauxVu)', await dans(() => TLOC.state.troupeauxVu === true));
// les cloches se balancent
const r1 = await dans(() => TLOC.scene.children.filter((o) => o.isGroup && Math.abs(o.rotation.z) > 0.001).length); await pause(700);
verifier('les cloches se balancent seules', r1 > 0, `${r1} cloches en mouvement`);
await filmer(page, nom('cloches'), [6, 30, 7], [0, 46, 0]);
{ const a = 0.55, px = Math.sin(a) * 10.75, pz = Math.cos(a) * 10.75; await filmer(page, nom('plaque'), [px + Math.sin(a) * 3.5, 2.0, pz + Math.cos(a) * 3.5], [px, 1.9, pz]); }

// LA COURSE (engine.js, state.course) : courir deux secondes sur la cour, sans puis avec le don du loup
async function courir() {
  await dans(() => { const T = TLOC; T.player.pos.set(0, T.getH(0, 22), 22); T.player.yaw = Math.PI / 2; T.G.camYaw = Math.PI / 2; T.player.energie = 1; });
  await pause(300); const a = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyS'); await pause(2000); await page.keyboard.up('KeyW'); await page.keyboard.up('KeyS');
  const b2 = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]); return Math.hypot(b2[0] - a[0], b2[1] - a[1]);
}
{ await dans(() => { TLOC.state.course = false; }); const d0 = await courir();
  await dans(() => { TLOC.state.course = true; }); const d1 = await courir();
  verifier('la course du loup : Camille court plus vite', d0 > 1 && d1 > d0 * 1.25, `${d0.toFixed(1)} m → ${d1.toFixed(1)} m en 2 s`); }

verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
