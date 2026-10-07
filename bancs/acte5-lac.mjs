// Banc des restes de la Lozère, lot 2 (docs/DECOUPAGE-ACTE5.md, « Les restes », R1, R3, R4, R6) : le
// lieu neuf du lac de Villefort, atteint par le poteau de Villefort ; la vallée d'avant à deux coups de
// sonnaille (le lac disparaît, son eau ne bloque plus, le pont de pierre et les murets) ; le viaduc en
// construction au passé ; la via ferrata au lasso et à la poulie, et son cœur. Une capture par moment
// clé ; le chargement du lieu. Le banc échoue à la première étape manquée.
//
//   bancs/tour.sh node bancs/acte5-lac.mjs [étiquette]
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte5-lac-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text()) && !/favicon/.test(m.location().url)) console.log('    absent :', m.location().url); });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const finir = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };
const charger = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte5, null, { timeout: 300000, polling: 300 });
const menu = (re) => dans((re) => { const M = TLOC.menu; if (!M.active) return null; const it = M.items.find((i) => new RegExp(re, 'i').test(i.label)); if (it) { it.fn(); return it.label; } return null; }, re);
const agir = (re, x, z) => dans(([re, x, z]) => { const T = TLOC; if (x != null) T.player.pos.set(x, T.getH(x, z), z); const p = T.player.pos;
  const it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && new RegExp(re).test(typeof i.prompt === 'function' ? i.prompt() : i.prompt)).sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p))[0];
  if (!it) return null; it.fn(); return document.getElementById('msg')?.textContent || ''; }, [re, x, z]);
async function deuxCoups() { await page.keyboard.press('KeyN'); await pause(150); await page.keyboard.press('KeyN'); await pause(900); }

// 1. de Villefort, le poteau mène au lac
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/villefort.html'); await charger(); await pause(4000); await finir();
await dans(() => { Object.assign(TLOC.state, { acte5: 'course', sonnaille: true, sword: true, chienSuit: true, chienRendu: true, course: true, lasso: true, poulie: true }); TLOC.saveGame(true); });
await parler(page, 'vieux chemin'); await pause(300);
verifier('le poteau de Villefort propose le lac', !!(await menu('lac')));
const t0 = Date.now();
await page.waitForURL(/lac/, { timeout: 120000 }).catch(() => {});
await charger(); console.log('    chargement du lac', ((Date.now() - t0) / 1000).toFixed(1), 's'); await pause(4500); await finir();
verifier('au lac', /lac\.html/.test(page.url()) && (await dans(() => window.__acte5.lieu)) === 'lac', page.url());
const L = await dans(() => (TLOC.G.level.lacs || []).map((l) => ({ y: +l.mesh.position.y.toFixed(1), vis: l.mesh.visible })));
verifier('le lac est posé', L.length >= 1, JSON.stringify(L));
await filmer(page, nom('lac'), [200, 170, -2160], [-60, 10, -1960]);      // (à 80 m, la caméra était dans la colline)

// 2. la vallée d'avant : deux coups au bord, le lac disparaît, on traverse à pied
// un point d'eau profonde (bloqué au présent), le plus près de la rive sud
const Y = await dans(() => TLOC.G.level.lacs[0].mesh.position.y + 0.5);       // à hauteur de l'eau
const Q = await dans((Y) => { const T = TLOC; for (let z = -2020; z < -1760; z += 4) for (let x = -100; x < 300; x += 8) if (T.blocked(x, z, 0.5, false, Y)) return [x, z]; return null; }, Y);
verifier('le lac a de l’eau profonde', !!Q, JSON.stringify(Q));
await dans(([x, z]) => { const T = TLOC; T.player.pos.set(x, T.getH(x, z + 30), z + 30); }, Q);
const bloqueAvant = await dans(([x, z, Y]) => TLOC.blocked(x, z, 0.5, false, Y), [...Q, Y]);
await deuxCoups();
const V = await dans(([x, z, Y]) => ({ vis: (TLOC.G.level.lacs || []).some((l) => l.mesh.visible), bloque: TLOC.blocked(x, z, 0.5, false, Y) }), [...Q, Y]);
verifier('deux coups : le lac disparaît, son fond ne bloque plus', bloqueAvant && !V.vis && !V.bloque, JSON.stringify({ bloqueAvant, ...V }));
await filmer(page, nom('vallee'), [Q[0] + 50, 60, Q[1] - 40], [40, 30, -1985], { attente: 600 });
await page.keyboard.press('KeyN'); await pause(900);
verifier('un coup : le lac revient', await dans(() => (TLOC.G.level.lacs || []).some((l) => l.mesh.visible)));

// 3. le viaduc en 1870
const vi = await dans(() => window.__acte5.viaduc);
verifier('le viaduc est dans le lieu', !!vi, JSON.stringify(vi));
if (vi) { await dans(([a]) => { const T = TLOC; T.player.pos.set(a[0] - 20, T.getH(a[0] - 20, a[1] + 10), a[1] + 10); }, vi); await deuxCoups();
  await filmer(page, nom('viaduc-1870'), [vi[0][0] - 90, 60, vi[0][1] + 60], [(vi[0][0] + vi[1][0]) / 2, 10, (vi[0][1] + vi[1][1]) / 2 ], { attente: 600 });
  await page.keyboard.press('KeyN'); await pause(900); }

// 4. la via ferrata : le lasso d'un bord à l'autre, la tyrolienne, le cœur
{ const r = await agir('lancer le lasso de l’autre côté', -283, -1992); await pause(2600);
  const p = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  verifier('le lasso fait passer la gorge', Math.hypot(p[0] + 278, p[1] + 1974) < 2, JSON.stringify(p.map(Math.round))); }
{ await agir('la tyrolienne de la via ferrata', -316, -1968); await pause(3800);
  const p = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  verifier('la tyrolienne de la via ferrata', Math.hypot(p[0] + 367, p[1] + 1969) < 3, JSON.stringify(p.map(Math.round))); }
{ const m0 = await dans(() => TLOC.player.maxHp); await agir('le haut de la via ferrata', -403, -1951);
  verifier('le cœur du haut de la via ferrata', (await dans(() => TLOC.player.maxHp)) === m0 + 2 && await dans(() => TLOC.state.coeurFerrata === true)); }
await filmer(page, nom('ferrata'), [-250, 70, -1925], [-320, 40, -1975]);

const vraies = erreurs.filter((e) => !/favicon|Failed to load resource/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
