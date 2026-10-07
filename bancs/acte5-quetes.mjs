// Banc des quêtes secondaires de la Lozère, lot 3 (docs/DECOUPAGE-ACTE5.md, « Les restes », Q1, Q3, Q4,
// Q5) : au Pouget, les châtaignes, la clède et la farine (H) ; au plateau de la Garde-Guérin, les onze
// menhirs à deux coups de sonnaille et leur cœur ; au lac, la pêche (la truite d'avant, au passé) et le
// train de 1870 (trois poutres à la force, puis le train vers Villefort). Le banc échoue à la première
// étape manquée.
//
//   bancs/tour.sh node bancs/acte5-quetes.mjs [étiquette]
import { navigateur, JOUR, ORIGINE, filmer } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte5-quetes-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text()) && !/favicon/.test(m.location().url)) console.log('    absent :', m.location().url); });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const finir = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };
const charger = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte5, null, { timeout: 300000, polling: 300 });
const ouvrir = async (pg) => { await page.goto(ORIGINE + '/' + pg); await charger(); await pause(4500); await finir(); };
// actionner l'interaction la plus proche de (x, z) dont l'invite répond à `re` (en s'y posant)
const agir = (re, x, z) => dans(([re, x, z]) => { const T = TLOC;
  const it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && new RegExp(re).test(typeof i.prompt === 'function' ? i.prompt() : i.prompt))
    .sort((a, b) => (x == null ? 0 : Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z)))[0];
  if (!it) return null; T.player.pos.set(it.pos.x + 0.6, it.pos.y, it.pos.z); it.fn(); return document.getElementById('msg')?.textContent || ''; }, [re, x, z]);
// (un appui se perd parfois en headless : on recommence tant que le passé n'est pas venu, comme un joueur)
async function deuxCoups() { for (let k = 0; k < 3; k++) { await page.keyboard.press('KeyN'); await pause(150); await page.keyboard.press('KeyN'); await pause(900); if (await dans(() => window.__acte5.sonne === 'passe')) return; } }
const ETAT = { acte5: 'course', sonnaille: true, sword: true, chienSuit: true, chienRendu: true, course: true, lasso: true, poulie: true, force: true, canne: true };

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;

// Q1. les châtaignes, la clède, la farine
await ouvrir('pouget.html');
await dans((E) => { Object.assign(TLOC.state, E); TLOC.saveGame(true); }, ETAT);
await ouvrir('pouget.html');
for (let k = 0; k < 5; k++) await agir('ramasser des châtaignes');
verifier('vingt châtaignes', (await dans(() => TLOC.state.chataignes)) === 20);
await agir('mettre les châtaignes à la clède');
verifier('la clède : trois parts de farine', (await dans(() => TLOC.state.farine)) === 3);
await dans(() => { TLOC.player.hp = 2; });
await page.keyboard.press('KeyH'); await pause(400);
verifier('H : une galette, trois cœurs', (await dans(() => [TLOC.player.hp, TLOC.state.farine])).join() === '8,2');
{ const c = await dans(() => window.__acte5.clede); if (c) await filmer(page, nom('clede'), [c[0] + 8, (await dans(([x, z]) => TLOC.getH(x, z), c)) + 4, c[1] + 10], [c[0], (await dans(([x, z]) => TLOC.getH(x, z), c)) + 1.5, c[1]]); }

// Q3. les onze menhirs du plateau
await ouvrir('garde-guerin.html');
const M = await dans(() => window.__acte5.menhirs || []);
verifier('onze menhirs sur le plateau', M.length === 11, String(M.length));
verifier('au présent, un menhir se tait', /Deux coups/.test(await agir('le menhir', ...M[0]) || ''));
const m0 = await dans(() => TLOC.player.maxHp);
for (const [x, z] of M) { await dans(([x, z]) => TLOC.player.pos.set(x + 1, TLOC.getH(x + 1, z), z), [x, z]); await deuxCoups(); const r = await agir('le menhir', x, z); console.log('    menhir', Math.round(x), Math.round(z), (r || 'null').slice(0, 50), await dans(() => window.__acte5.sonne)); await pause(200); }
verifier('les onze vus, un cœur de plus', (await dans(() => TLOC.player.maxHp)) === m0 + 2 && await dans(() => TLOC.state.coeurMenhirs === true), JSON.stringify(await dans(() => Object.keys(TLOC.state.menhirsVus || {}))));
await filmer(page, nom('menhirs'), [M[0][0] + 14, (await dans(([x, z]) => TLOC.getH(x, z), M[0])) + 6, M[0][1] + 14], [M[0][0], (await dans(([x, z]) => TLOC.getH(x, z), M[0])) + 1.5, M[0][1]]);

// Q4 et Q5. au lac : la pêche, le train de 1870
await ouvrir('lac.html');
await agir('pêcher dans le lac'); await pause(3500);
verifier('une truite du lac', (await dans(() => TLOC.state.truites)) >= 1);
await deuxCoups(); await agir('pêcher dans le lac'); await pause(3500);
verifier('au passé, la truite d’avant', await dans(() => TLOC.state.truiteAvant === true));
await page.keyboard.press('KeyN'); await pause(800);
await deuxCoups();
for (let k = 0; k < 3; k++) { await agir('pousser la poutre'); await pause(300); }
const fin = []; for (let k = 0; k < 10; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say || ''; T.cutAdvance(true); return s; }); if (r === null) break; if (r) fin.push(r); await pause(120); }
verifier('trois poutres : la travée est posée', await dans(() => TLOC.state.viaducFini === true), fin.join(' | ').slice(0, 100));
await page.keyboard.press('KeyN'); await pause(800);
await agir('attendre le train');
await page.waitForURL(/villefort/, { timeout: 60000 }).catch(() => {});
verifier('le train mène à Villefort', /villefort/.test(page.url()), page.url());

const vraies = erreurs.filter((e) => !/favicon|Failed to load resource/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
