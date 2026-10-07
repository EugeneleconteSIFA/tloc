// Banc des restes de la Lozère, lot 1 (docs/DECOUPAGE-ACTE5.md, « Les restes ») : après l'acte V, le
// berger confie le troupeau ; il suit Camille par les vieux chemins jusqu'à la Garde-Guérin ; à l'enclos
// d'estive, il reste ; au Pouget, le berger donne le lasso et la sonnaille plus forte ; à la tour, sans
// puis avec le lasso, le sommet ; le câble refuse sans poulie, puis mène à Villefort. Le banc échoue à la
// première étape manquée.
//
//   bancs/tour.sh node bancs/acte5-lasso.mjs [étiquette]
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte5-lasso-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text()) && !/favicon/.test(m.location().url)) console.log('    absent :', m.location().url); });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const finir = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };
const charger = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte5, null, { timeout: 300000, polling: 300 });
const menu = (re) => dans((re) => { const M = TLOC.menu; if (!M.active) return null; const it = M.items.find((i) => new RegExp(re, 'i').test(i.label)); if (it) { it.fn(); return it.label; } return null; }, re);
async function aller(lieu, re) { await parler(page, 'vieux chemin'); await pause(300); await menu(re); await page.waitForURL(new RegExp(lieu), { timeout: 120000 }).catch(() => {}); await charger(); await pause(4500); await finir(); }
const agir = (re) => dans((re) => { const T = TLOC, p = T.player.pos;
  const it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && new RegExp(re).test(typeof i.prompt === 'function' ? i.prompt() : i.prompt)).sort((a, b) => a.pos.distanceTo(p) - b.pos.distanceTo(p))[0];
  if (!it) return null; it.fn(); return document.getElementById('msg')?.textContent || ''; }, re);
const lireDialogue = async () => { const l = []; for (let k = 0; k < 30; k++) { const s = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say || ''; T.cutAdvance(true); return s; }); if (s === null) break; if (s) l.push(s); await pause(120); } return l; };
const troupeau = () => dans(() => (window.__acte5.troupeau ? window.__acte5.troupeau.betes.length : -1));

// une partie après l'acte V, au Pouget
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/pouget.html'); await charger(); await pause(4000); await finir();
await dans(() => { Object.assign(TLOC.state, { acte5: 'course', sonnaille: true, sword: true, chienSuit: true, chienRendu: true, course: true, poulie: false }); TLOC.saveGame(true); });
await pause(1500);

// 1. le berger confie le troupeau
await dans(() => { const T = TLOC, [x, y, z] = window.__acte5.berger; T.player.pos.set(x + 1.5, T.getH(x + 1.5, z), z); });
await agir('parler au berger'); console.log('   ', (await lireDialogue()).join(' | ').slice(0, 200));
verifier('le berger confie le troupeau', await dans(() => TLOC.state.transh === 1));
await pause(2500);
verifier('six brebis suivent', (await troupeau()) === 6);

// 2. par le vieux chemin, à la Garde-Guérin : le troupeau suit
await aller('garde', 'Garde');
for (let k = 0; k < 20 && (await troupeau()) < 6; k++) await pause(500);
verifier('à la Garde-Guérin, le troupeau est là', (await troupeau()) === 6);

// 3. jusqu'à l'enclos d'estive (Camille marche, les brebis suivent ; le banc la pose par étapes)
const E = await dans(() => window.__acte5.troupeau.estive);
for (let k = 0; k <= 10 && (await dans(() => TLOC.state.transh)) === 1; k++) {
  await dans(([x, z, k]) => { const T = TLOC, p = T.player.pos, t = Math.min(1, k / 8), ax = p.x + (x - p.x) * t, az = p.z + (z - p.z) * t; p.set(ax, T.getH(ax, az), az); }, [E[0] + 3, E[1] + 3, k]);
  await pause(1500);
}
verifier('le troupeau est à l’estive', await dans(() => TLOC.state.transh === 2));
await filmer(page, nom('estive'), [E[0] + 14, (await dans(([x, z]) => TLOC.getH(x, z), E)) + 7, E[1] + 14], [E[0], (await dans(([x, z]) => TLOC.getH(x, z), E)) + 0.5, E[1]]);

// 4. sans le lasso, l'anneau de la tour
const T0 = await dans(() => ({ porte: window.__acte5.porteTour, sommet: window.__acte5.sommet }));
verifier('la tour a son sommet et son anneau', !!(T0.porte && T0.sommet), JSON.stringify(T0));
await dans(([x, z]) => { const T = TLOC; T.player.pos.set(x, T.getH(x, z), z); }, T0.porte);
verifier('sans le lasso, rien', /corde/.test(await agir('anneau du sommet') || ''));

// 5. au Pouget : le berger donne le lasso et la sonnaille plus forte
await aller('pouget', 'Pouget');
await dans(() => { const T = TLOC, [x, y, z] = window.__acte5.berger; T.player.pos.set(x + 1.5, T.getH(x + 1.5, z), z); });
await agir('parler au berger'); console.log('   ', (await lireDialogue()).join(' | ').slice(0, 200));
verifier('le lasso et la sonnaille plus forte', await dans(() => TLOC.state.lasso === true && TLOC.state.sonnailleForte === true && TLOC.state.transh === 3));

// 6. à la tour : le lasso mène au sommet ; le câble, sans puis avec la poulie
await aller('garde', 'Garde');
await dans(([x, z]) => { const T = TLOC; T.player.pos.set(x, T.getH(x, z), z); }, T0.porte);
await agir('lancer le lasso au sommet'); await pause(800);
await filmer(page, nom('corde'), [T0.porte[0] + 12, T0.sommet[1] - 6, T0.porte[1] + 14], [T0.porte[0], T0.sommet[1] - 8, T0.porte[1]], { camille: true, attente: 300 });
await pause(2500);
const y = await dans(() => TLOC.player.pos.y);
verifier('au sommet de la tour, au lasso', Math.abs(y - T0.sommet[1]) < 1, `${y.toFixed(1)} / ${T0.sommet[1].toFixed(1)}`);
verifier('sans poulie, le câble refuse', /rien pour s’y accrocher/.test(await agir('glisser vers Villefort') || ''));
await dans(() => { TLOC.state.poulie = true; });
await agir('glisser vers Villefort'); await pause(2500);
await filmer(page, nom('cable'), [T0.sommet[0] + 30, T0.sommet[1] + 10, T0.sommet[2] + 40], [T0.sommet[0], T0.sommet[1] - 10, T0.sommet[2] + 60], { camille: true, attente: 200 });
await page.waitForURL(/villefort/, { timeout: 120000 }).catch(() => {});
await charger(); await pause(2000);
verifier('le câble mène à Villefort', /villefort/.test(page.url()), page.url());

const vraies = erreurs.filter((e) => !/favicon|Failed to load resource/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
