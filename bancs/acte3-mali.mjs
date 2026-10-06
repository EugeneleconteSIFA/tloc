// Banc de l'acte III, étape 3 (docs/DECOUPAGE-ACTE3.md, « Mali ») : à Khao Phing Kan, Mali à terre,
// la statue (sans puis avec la force), la cascade figée et sa barque, le gong qui la fait tomber, la
// course autour de Ko Tapu (menée par le pilote du banc, COURSE.auto), la victoire, l'acte qui passe
// à « masques » et les trajets de Mali ouverts. Le banc échoue à la première étape manquée.
//
//   bancs/tour.sh node bancs/acte3-mali.mjs [étiquette]
import { navigateur, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte3-mali-${ETIQ}-${JOUR}-${n}.jpg`;
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
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); Object.assign(T.state, { gongThai: true, acte3: 'mali', somsakPaye: true, poulie: true, masqueBois: true, porteCloitre: true, cleCloitre: true }); });
await pause(7000);     // le message d'arrivée du lieu

const agir = (re, x, z) => dans(([re, x, z]) => { const T = TLOC;
  T.player.pos.set(x, T.getH(x, z), z);
  const it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && new RegExp(re).test(typeof i.prompt === 'function' ? i.prompt() : i.prompt))
    .sort((p, q) => Math.hypot(p.pos.x - x, p.pos.z - z) - Math.hypot(q.pos.x - x, q.pos.z - z))[0];
  if (!it) return null; it.fn(); return document.getElementById('msg')?.textContent || ''; }, [re, x, z]);
const finirDialogue = async () => { const l = []; for (let k = 0; k < 30; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? `${c.who || ''} : ${c.say}` : ''; T.cutAdvance(true); return s; }); if (r === null) break; if (r) l.push(r); await pause(120); } return l; };
const K = await dans(() => { const K = window.__acte3.KPK; return { pied: K.pied, levre: K.levre, mali: K.mali }; });

// 1. Mali, à terre : la barque est dans la cascade
await agir('parler à Mali', K.mali[0] + 1.5, K.mali[1]);
console.log('   ', (await finirDialogue()).join(' | ').slice(0, 220));
verifier('Mali parle de la cascade', await dans(() => !!(TLOC.state.ind3 && TLOC.state.ind3.cascade)));
await filmer(page, nom('cascade'), [K.pied[0] + 14, 30, K.pied[1] - 26], [K.pied[0], 30, K.pied[1] + 4]);

// 2. la statue : sans la force, elle ne bouge pas ; avec, elle tombe à la mer
verifier('sans la force, la statue tient', /ne bouge pas/.test(await agir('pousser la statue', K.levre[0], K.levre[1] + 2.5) || ''));
await dans(() => { TLOC.state.force = true; });
await agir('pousser la statue', K.levre[0], K.levre[1] + 2.5);
verifier('avec la force, la statue tombe', await dans(() => TLOC.state.statueKpk === true));
verifier('le bord de la corniche est libre', !(await dans(([x, z]) => TLOC.blocked(x, z, 0.5, false, TLOC.getH(x, z) + 0.1), K.levre)));

// 3. le gong au pied de la cascade : la barque tombe et file à la mer
await dans(([x, z]) => TLOC.player.pos.set(x, TLOC.getH(x, z), z - 3), K.pied);
await dans(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', bubbles: true })));
await pause(1200);
await filmer(page, nom('chute'), [K.pied[0] + 14, 30, K.pied[1] - 26], [K.pied[0], 25, K.pied[1] + 4], { attente: 600, camille: true });
await pause(5000);
verifier('la barque de Mali est tombée', await dans(() => TLOC.state.barqueMali === true));

// 4. Mali : la course, menée par le pilote du banc
await agir('parler à Mali', K.mali[0] + 1.5, K.mali[1]);
console.log('   ', (await finirDialogue()).join(' | ').slice(0, 220));
await pause(1500);
verifier('la course commence', await dans(() => window.__acte3.COURSE.actif === true));
await dans(() => { window.__acte3.COURSE.auto = true; });
const t0 = Date.now();
await pause(12000);
await page.screenshot({ path: (await import('./acte1-outils.mjs')).DIR + nom('course'), quality: 80 });
let fin = null;
for (let k = 0; k < 120 && !fin; k++) { await pause(500); fin = await dans(() => { const C = window.__acte3.COURSE; return C.fini ? { moi: C.moi.k, mali: C.mali.k } : null; }); }
console.log('    course :', JSON.stringify(fin), Math.round((Date.now() - t0) / 1000), 's');
verifier('la course finit', !!fin);
verifier('Camille gagne (au pilote du banc)', fin && fin.moi >= 6);
await pause(3000);
console.log('   ', (await finirDialogue()).join(' | ').slice(0, 260));
verifier('l’acte passe à « masques »', (await dans(() => TLOC.state.acte3)) === 'masques');

// 5. Mali navigue : son quai va au grand piton
{ const l = await dans(() => { const T = TLOC, a = [-701, 553];
    T.player.pos.set(a[0], T.getH(a[0], a[1]), a[1]);
    const it = T.interactables.filter((i) => /parler au passeur/.test(typeof i.prompt === 'function' ? i.prompt() : i.prompt)).sort((p, q) => Math.hypot(p.pos.x - a[0], p.pos.z - a[1]) - Math.hypot(q.pos.x - a[0], q.pos.z - a[1]))[0];
    it.fn(); return T.menu.items.map((i) => i.label); });
  console.log('    Mali :', JSON.stringify(l));
  verifier('Mali va au grand piton', l.some((x) => /grand piton/.test(x))); }

const vraies = erreurs.filter((e) => !/favicon/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
