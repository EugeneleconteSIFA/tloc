// Banc de l'acte III, étapes 5 et 6 (docs/DECOUPAGE-ACTE3.md, « la corniche des vents », « le Yak ») :
// au belvédère de Ton Sai, la mousson qui pousse vers le vide et le câble qui refuse, sans le masque
// de Hanuman ; avec lui, le vent qui glisse et le câble jusqu'au grand piton (l'acte passe à « yak ») ;
// le Yak qui paraît, les coups qui le traversent hors du gong, les trois touches au gong, le morceau
// qui tombe (l'acte passe à « fete »). Camille est tenue en vie (les coups du Yak ne sont pas l'objet
// du banc). Le banc échoue à la première étape manquée.
//
//   bancs/tour.sh node bancs/acte3-yak.mjs [étiquette]
import { navigateur, filmer, JOUR, ORIGINE, DIR } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte3-yak-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/thailande.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte3, null, { timeout: 300000, polling: 300 });
await pause(3000);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true);
  Object.assign(T.state, { gongThai: true, acte3: 'corniche', somsakPaye: true, poulie: true, masqueBois: true, barqueMali: true, statueKpk: true, lanterne: true, force: true, murFendu: true, ind3: { muet: true } }); });
await pause(7000);
const agir = (re, x, z) => dans(([re, x, z]) => { const T = TLOC;
  T.player.pos.set(x, T.getH(x, z), z);
  const it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && new RegExp(re).test(typeof i.prompt === 'function' ? i.prompt() : i.prompt))
    .sort((p, q) => Math.hypot(p.pos.x - x, p.pos.z - z) - Math.hypot(q.pos.x - x, q.pos.z - z))[0];
  if (!it) return null; it.fn(); return document.getElementById('msg')?.textContent || ''; }, [re, x, z]);
// Camille tenue en vie pendant tout le banc
await dans(() => { setInterval(() => { TLOC.player.hp = TLOC.player.maxHp; }, 100); });

// 1. la corniche, sans le masque : le vent pousse, le câble refuse
{ const p0 = await dans(() => { const T = TLOC; T.player.pos.set(2604, T.getH(2604, 1786), 1786); return [2604, 1786]; });
  await pause(3000);
  const p1 = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  verifier('la mousson pousse vers le bord', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 3, JSON.stringify(p1.map(Math.round)));
  verifier('sans le masque, le câble refuse', /mousson/.test(await agir('accrocher au câble — vers le grand piton', 2605, 1792) || '')); }

// 2. le masque de Hanuman : le vent glisse, le câble mène au grand piton
await pause(2500);          // si la mousson l'a jetée dans le vide, le retour au palier vient après le fondu
await dans(() => { TLOC.state.masqueHanuman = true; });
{ await dans(() => { const T = TLOC; T.player.pos.set(2604, T.getH(2604, 1786), 1786); });
  await pause(2500);
  const p1 = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  verifier('avec le masque, le vent ne pousse plus', Math.hypot(p1[0] - 2604, p1[1] - 1786) < 1.5, JSON.stringify(p1.map((v) => +v.toFixed(2)))); }
await agir('accrocher au câble — vers le grand piton', 2605, 1792);
for (let k = 0; k < 60 && (await dans(() => TLOC.state.acte3)) !== 'yak'; k++) await pause(1000);
verifier('arrivée au grand piton, l’acte passe à « yak »', (await dans(() => TLOC.state.acte3)) === 'yak');

// 3. le Yak paraît
await dans(() => { const T = TLOC; T.player.pos.set(904, T.getH(904, 306), 306); });
await pause(1500);
const yak = () => dans(() => { const Y = window.__acte3.YAK; return Y.e ? { hp: Y.e.hp, touches: Y.touches, dead: Y.e.dead, x: Y.e.pos.x, z: Y.e.pos.z } : null; });
verifier('le Yak paraît', !!(await yak()));
await filmer(page, nom('yak'), [918, 120, 300], [904, 118, 321], { camille: true });

// 4. hors du gong, les coups le traversent
await dans(() => { const e = window.__acte3.YAK.e; for (let k = 0; k < 4; k++) TLOC.hitEnemy(e, 2, e.pos.x, e.pos.z - 2); });
await pause(300);
{ const y = await yak(); verifier('hors du gong, rien ne le touche', y.touches === 0 && y.hp === 30, JSON.stringify(y)); }

// 5. au gong : trois touches, le morceau tombe
await dans(() => { const T = TLOC, e = window.__acte3.YAK.e; T.player.pos.set(e.pos.x, e.pos.y, e.pos.z - 4); });
await dans(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', bubbles: true })));
await pause(300);
await page.screenshot({ path: DIR + nom('gong'), quality: 80 });
for (let k = 0; k < 3; k++) { await dans(() => { const e = window.__acte3.YAK.e; TLOC.hitEnemy(e, 2, e.pos.x, e.pos.z - 2); }); await pause(400); }
{ const y = await yak(); verifier('au gong, trois touches au morceau', y.touches === 3, JSON.stringify(y)); }
verifier('l’acte passe à « fete »', (await dans(() => TLOC.state.acte3)) === 'fete');

const vraies = erreurs.filter((e) => !/favicon/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
