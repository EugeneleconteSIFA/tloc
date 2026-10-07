// Banc de l'acte V, lot C (docs/DECOUPAGE-ACTE5.md, étapes 6 et 7) : la nuit sur le plateau de la
// Garde-Guérin, le berger et son chien à la lisière, le loup grand comme une grange qui passe d'une
// époque à l'autre (intouchable une seconde sur deux), la sonnaille qui le tient au présent, les coups
// au morceau de cloche, la fin : la course, le loup endormi, la Cloche des Troupeaux et le vers, le
// jour revenu. Partie posée à « tour ».
//
//   bancs/tour.sh node bancs/acte5-loup.mjs [étiquette]
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'c';
const nom = (n) => `acte5-loup-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text())) { if (/favicon/.test(m.location().url)) favicons++; else console.log('    absent :', m.location().url); } });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const finir = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/garde-guerin.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte5, null, { timeout: 300000, polling: 300 });
await pause(4000); await finir();
const expo0 = await dans(() => TLOC.renderer ? TLOC.renderer.toneMappingExposure : null);
await dans(() => { Object.assign(TLOC.state, { acte5: 'tour', sonnaille: true, sword: true, chienSuit: true, chienRendu: true }); TLOC.player.maxHp = TLOC.player.hp = 60; TLOC.saveGame(true); });
await pause(2500);

// 1. la nuit, le berger à la lisière
const P = await dans(() => ({ plateau: window.__acte5.plateau, berger: window.__acte5.bergerPlateau, nuit: !!window.__acte5.nuit, bergerPose: !!window.__acte5.gens.bergerPlateau }));
verifier('la nuit tombe sur le plateau ; le berger est à la lisière', P.nuit && P.bergerPose, JSON.stringify(P));
{ const r = await parler(page, 'parler au berger'); verifier('le berger : « Je ne peux pas regarder »', !!r && /regarder/.test(r.repliques.join())); }

// 2. le loup sort quand Camille arrive sur le plateau
await dans(([x, z]) => { const T = TLOC; T.player.pos.set(x - 10, T.getH(x - 10, z), z); }, P.plateau);
for (let k = 0; k < 40 && !(await dans(() => !!window.__acte5.loup)); k++) await pause(500);
const L = await dans(() => { const e = window.__acte5.loup; if (!e) return null; const bb = new TLOC.THREE.Box3().setFromObject(e.mesh); return { h: +(bb.max.y - bb.min.y).toFixed(1), e: TLOC.state.acte5 }; });
verifier('le loup sort, grand comme une grange (étape « loup »)', !!L && L.h > 3 && L.e === 'loup', JSON.stringify(L));
await pause(2600);
const cages = []; for (let k = 0; k < 8; k++) { cages.push(await dans(() => window.__acte5.loup.caged)); await pause(260); }
verifier('il passe d’une époque à l’autre (intouchable une seconde sur deux)', cages.includes(true) && cages.includes(false), cages.map((c) => (c ? 'x' : 'o')).join(''));
{ const e = await dans(() => { const e = window.__acte5.loup; return [e.pos.x, e.pos.y, e.pos.z]; }); await filmer(page, nom('loup'), [e[0] - 14, e[1] + 6, e[2] + 10], [e[0], e[1] + 3, e[2]], { camille: true, attente: 800 }); }

// 3. un coup de sonnaille le tient au présent ; on frappe
await page.keyboard.press('KeyN'); await pause(800);
verifier('un coup : tenu au présent', await dans(() => window.__acte5.loup.caged === false));
for (let k = 0; k < 120 && !(await dans(() => window.__acte5.loup.dead)); k++) {
  await dans(() => { const T = TLOC, e = window.__acte5.loup, p = T.player.pos, d = Math.hypot(p.x - e.pos.x, p.z - e.pos.z) || 1;
    if (d > 4) { const x = e.pos.x + (p.x - e.pos.x) / d * 3.6, z = e.pos.z + (p.z - e.pos.z) / d * 3.6; p.set(x, T.getH(x, z), z); }
    T.player.yaw = Math.atan2(e.pos.x - p.x, e.pos.z - p.z); T.player.hp = T.player.maxHp; T.player.attackCd = 0; T.player.attackT = 0; T.player.hitSet.clear(); });
  await pause(300);
  if (k % 12 === 11) { await page.keyboard.press('KeyN'); await pause(600); }
}
verifier('le morceau sort de l’épaule', await dans(() => window.__acte5.loup.dead));
await pause(1200);
const fin = []; for (let k = 0; k < 20; k++) { const s = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say || ''; T.cutAdvance(true); return s; }); if (s === null) break; if (s) fin.push(s); await pause(300); }
console.log('   ', fin.join(' | ').slice(0, 260));
verifier('la fin : sa course, il s’endort, le berger', /course/.test(fin.join()) && /Garde les tiennes/.test(fin.join()));
await pause(1500);
const F = await dans(() => ({ e: TLOC.state.acte5, course: TLOC.state.course, cloche: !!window.__acte5.cloche, nuit: !!window.__acte5.nuit, dort: !!window.__acte5.dort }));
verifier('la course, la Cloche des Troupeaux, le jour revenu', F.e === 'course' && F.course && F.cloche && !F.nuit, JSON.stringify(F));
{ const b2 = P.berger; const y = await dans(([x, z]) => TLOC.getH(x, z), b2); await filmer(page, nom('endormi'), [b2[0] - 6, y + 4, b2[1] + 12], [b2[0] + 4, y + 1, b2[1]]); }
{ const c = await dans(() => { const g = window.__acte5.cloche; return [g.position.x, g.position.y, g.position.z]; }); await filmer(page, nom('cloche'), [c[0] + 6, c[1] + 3, c[2] + 8], [c[0], c[1] + 0.5, c[2]]); }

verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
