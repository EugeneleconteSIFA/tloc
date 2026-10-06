// Banc de l'acte III, étape 4 (docs/DECOUPAGE-ACTE3.md, « le passeur muet et les masques ») : à la
// grève du grand piton, le muet qui refuse, puis voit le masque de bois ; la traversée vers Railay ; la
// bouche de la grotte ; le mur fendu (la bombe) ; les danseurs figés qu'aucun coup ne touche, puis au
// gong ; le masque de Hanuman ; l'acte qui passe à « corniche » ; la sortie. Le banc échoue à la
// première étape manquée.
//
//   bancs/tour.sh node bancs/acte3-masques.mjs [étiquette]
import { navigateur, filmer, JOUR, ORIGINE, DIR } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte3-masques-${ETIQ}-${JOUR}-${n}.jpg`;
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
  Object.assign(T.state, { gongThai: true, acte3: 'masques', somsakPaye: true, poulie: true, masqueBois: true, porteCloitre: true, cleCloitre: true, barqueMali: true, statueKpk: true, lanterne: true, bombes: true, nbBombes: 3, force: true }); });
await pause(7000);

const agir = (re, x, z, y = null) => dans(([re, x, z, y]) => { const T = TLOC;
  T.player.pos.set(x, y ?? T.getH(x, z), z);
  const it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && new RegExp(re).test(typeof i.prompt === 'function' ? i.prompt() : i.prompt))
    .sort((p, q) => Math.hypot(p.pos.x - x, p.pos.z - z) - Math.hypot(q.pos.x - x, q.pos.z - z))[0];
  if (!it) return null; it.fn(); return document.getElementById('msg')?.textContent || ''; }, [re, x, z, y]);
const menuPasseur = (a) => dans((a) => { const T = TLOC; T.player.pos.set(a[0], T.getH(a[0], a[1]), a[1]);
  const it = T.interactables.filter((i) => /parler au passeur/.test(typeof i.prompt === 'function' ? i.prompt() : i.prompt)).sort((p, q) => Math.hypot(p.pos.x - a[0], p.pos.z - a[1]) - Math.hypot(q.pos.x - a[0], q.pos.z - a[1]))[0];
  it.fn(); return T.menu.items.map((i) => i.label); }, a);
const choisir = (re) => dans((re) => { const it = TLOC.menu.items.find((i) => new RegExp(re).test(i.label)); if (!it) return false; it.fn(); return true; }, re);
const finirDialogue = async () => { const l = []; for (let k = 0; k < 30; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? `${c.who || ''} : ${c.say}` : ''; T.cutAdvance(true); return s; }); if (r === null) break; if (r) l.push(r); await pause(120); } return l; };
const gong = () => dans(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', bubbles: true })));

// 1. le muet : pas de Railay avant le masque ; le masque montré, Railay
{ const l = await menuPasseur([980, 486]); console.log('    muet :', JSON.stringify(l));
  verifier('le muet ne va pas encore à Railay', !l.some((x) => /Railay/.test(x)) && l.some((x) => /masque de bois/.test(x)));
  await choisir('masque de bois'); await pause(500);
  const l2 = await menuPasseur([980, 486]); console.log('    muet :', JSON.stringify(l2));
  verifier('le masque montré, le muet va à Railay', l2.some((x) => /Railay/.test(x)));
  await choisir('Railay'); await pause(3500);
  const p = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  verifier('débarquée à Railay', Math.hypot(p[0] + 656.6, p[1] - 1529.5) < 10, JSON.stringify(p.map(Math.round))); }

// 2. la bouche de la grotte
const G0 = await dans(() => { const G = window.__acte3.GROTTE; return { x: G.x, z: G.z, y: G.y, bouche: G.bouche }; });
await filmer(page, nom('bouche'), [G0.bouche[0] + 6, 12, G0.bouche[1] - 16], [G0.bouche[0], 9, G0.bouche[1]]);
await agir('entrer dans la grotte', G0.bouche[0], G0.bouche[1] - 2.5);
await pause(2500);
verifier('dans la grotte', await dans(() => window.__acte3.GROTTE.dedans === true && TLOC.player.pos.y > 590));
await page.screenshot({ path: DIR + nom('entree'), quality: 80 });

// 3. le mur fendu : il barre, la bombe le fait céder
const bloque = (lx, lz) => dans(([x, z, y]) => { const T = TLOC; let b = false; const p = T.player.pos.clone(); T.player.pos.set(x, y + 0.02, z - 1.2); const q = T.player.pos.clone();
  for (let k = 0; k < 12; k++) T.tryMove(T.player.pos, 0, 0.2, 0.5, false);
  b = T.player.pos.z < q.z + 2.1; T.player.pos.copy(p); return b; }, [G0.x + lx, G0.z + lz, G0.y]);
const bloqueX = (lx, lz) => dans(([x, z, y]) => { const T = TLOC, p = T.player.pos.clone(); T.player.pos.set(x - 1.2, y + 0.02, z); const q = T.player.pos.clone();
  for (let k = 0; k < 12; k++) T.tryMove(T.player.pos, 0.2, 0, 0.5, false); const b = T.player.pos.x < q.x + 2.1; T.player.pos.copy(p); return b; }, [G0.x + lx, G0.z + lz, G0.y]);
console.log('    mur latéral (témoin) :', await bloqueX(4, 5));
verifier('le mur fendu barre le passage', await bloque(0, 10));
await agir('le mur fendu', G0.x, G0.z + 8.6, G0.y + 0.02);
await pause(2200);
verifier('le mur a cédé', await dans(() => TLOC.state.murFendu === true));
verifier('le passage est libre', !(await bloque(0, 10)));

// 4. les danseurs : figés, rien ne les touche ; au gong, on les abat
await dans(([x, z, y]) => TLOC.player.pos.set(x, y + 0.02, z + 13), [G0.x, G0.z, G0.y]);
await pause(800);
await page.screenshot({ path: DIR + nom('salle'), quality: 80 });
{ const avant = await dans(() => { const D = window.__acte3.GROTTE.danseurs; D.forEach((e) => { if (e.caged) return; TLOC.hitEnemy(e, 99, e.pos.x, e.pos.z - 1); }); return D.map((e) => [e.caged, e.dead]); });
  verifier('figés, les danseurs sont intouchables', avant.length === 3 && avant.every(([c, d]) => c && !d), JSON.stringify(avant));
  verifier('le masque est gardé', /barrent/.test(await agir('prendre le masque de Hanuman', G0.x, G0.z + 21, G0.y + 0.02) || ''));
  await dans(([x, z, y]) => TLOC.player.pos.set(x, y + 0.02, z + 14), [G0.x, G0.z, G0.y]);
  await gong(); await pause(400);
  const apres = await dans(() => { const D = window.__acte3.GROTTE.danseurs; D.forEach((e) => { if (!e.caged) TLOC.hitEnemy(e, 99, e.pos.x, e.pos.z - 1); }); return D.map((e) => e.dead); });
  verifier('au gong, on les abat', apres.every(Boolean), JSON.stringify(apres)); }

// 5. le masque de Hanuman
await agir('prendre le masque de Hanuman', G0.x, G0.z + 21, G0.y + 0.02);
console.log('   ', (await finirDialogue()).join(' | ').slice(0, 200));
verifier('le masque de Hanuman', await dans(() => TLOC.state.masqueHanuman === true));
verifier('l’acte passe à « corniche »', (await dans(() => TLOC.state.acte3)) === 'corniche');

// 6. la sortie
await agir('sortir de la grotte', G0.x, G0.z + 1.5, G0.y + 0.02);
await pause(2500);
const p = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.y, TLOC.player.pos.z]);
verifier('ressortie à Railay', p[1] < 100 && Math.hypot(p[0] - G0.bouche[0], p[2] - G0.bouche[1]) < 8, JSON.stringify(p.map(Math.round)));

const vraies = erreurs.filter((e) => !/favicon/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
