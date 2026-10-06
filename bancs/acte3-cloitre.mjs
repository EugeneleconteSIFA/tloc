// Banc de l'acte III, étape 2 (docs/DECOUPAGE-ACTE3.md, « la clé du cloître ») : à Ton Sai, le câble
// sans poulie, la porte fermée, les trois moines qui finissent leur phrase au gong (le carnet), le
// balayeur à la manche gauche et la clé, la porte qui s'ouvre (et ne bloque plus), le moine
// cuisinier et la poulie, le masque de bois, l'acte qui passe à « mali », le câble qui se prend,
// Somsak qui ouvre le trajet de Khao Phing Kan. Le banc échoue à la première étape manquée.
//
//   bancs/tour.sh node bancs/acte3-cloitre.mjs [étiquette]
import { navigateur, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte3-cloitre-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const msg = () => dans(() => document.getElementById('msg')?.textContent || '');

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/thailande.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte3, null, { timeout: 300000, polling: 300 });
await pause(3000);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); Object.assign(T.state, { gongThai: true, acte3: 'cloitre', somsakPaye: true }); });

// se poser en (x, z), et actionner l'interaction la plus proche dont l'invite répond à `re`
const agir = (re, x, z) => dans(([re, x, z]) => { const T = TLOC;
  T.player.pos.set(x, T.getH(x, z), z);
  const it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && new RegExp(re).test(typeof i.prompt === 'function' ? i.prompt() : i.prompt))
    .sort((p, q) => Math.hypot(p.pos.x - x, p.pos.z - z) - Math.hypot(q.pos.x - x, q.pos.z - z))[0];
  if (!it) return null; it.fn(); return document.getElementById('msg')?.textContent || ''; }, [re, x, z]);
// frapper le gong ici (en attendant que le précédent se soit tu)
const gong = async () => { for (let k = 0; k < 40; k++) { if (!(await dans(() => window.__acte3 && false))) break; } await pause(6300);
  await dans(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', bubbles: true }))); await pause(250); };
const finirDialogue = async () => { const l = []; for (let k = 0; k < 30; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? `${c.who || ''} : ${c.say}` : ''; T.cutAdvance(true); return s; }); if (r === null) break; if (r) l.push(r); await pause(120); } return l; };
const bloque = (x, z) => dans(([x, z]) => TLOC.blocked(x, z, 0.5, false, TLOC.getH(x, z) + 0.1), [x, z]);
const C = await dans(() => { const C = window.__acte3.CLOITRE; return { porte: C.porte, z1: C.z1 }; });
const px = (C.porte[0] + C.porte[1]) / 2;

// (le message d'arrivée du lieu passe après la cinématique : on le laisse passer)
await pause(7000);
// 1. le câble sans poulie
verifier('sans poulie, le câble refuse', /poulie/.test(await agir('accrocher au câble — vers le grand piton', 2605, 1792)));
await filmer(page, nom('cour'), [2590, 140, 1765], [2609, 133, 1725]);

// 2. la porte fermée, qui bloque
verifier('la porte est fermée à clé', /fermée à clé/.test(await agir('la porte du cloître', px, C.z1 + 1.5)));
verifier('la porte fermée barre le passage', await bloque(px, C.z1));

// 3. les trois moines, un par un, au gong
for (const ind of ['balayeur', 'somchai', 'manche']) {
  const p = await dans((ind) => { const F = window.__acte3.FIGES.find((f) => f.indice === ind); return [F.x, F.z]; }, ind);
  await dans(([x, z]) => TLOC.player.pos.set(x + 1.2, TLOC.getH(x + 1.2, z), z), p);
  await gong();
  await agir('écouter le moine|regarder le moine', p[0] + 1.2, p[1]);
  verifier(`le moine « ${ind} » finit sa phrase`, await dans((k) => !!(TLOC.state.ind3 && TLOC.state.ind3[k]), ind), (await msg()).slice(0, 90));
}

// 4. le balayeur à la manche gauche : la clé tombe
{ const p = await dans(() => { const F = window.__acte3.FIGES.find((f) => f.bon); return [F.x, F.z]; });
  await dans(([x, z]) => TLOC.player.pos.set(x + 1.2, TLOC.getH(x + 1.2, z), z), p);
  await pause(6500);          // que le gong du dernier moine se taise
  await agir('regarder le balayeur', p[0] + 1.2, p[1]);
  verifier('figé, le balayeur garde sa clé', !(await dans(() => TLOC.state.cleCloitre)));
  await gong();
  await agir('regarder le balayeur', p[0] + 1.2, p[1]);
  verifier('au gong, la clé tombe', await dans(() => TLOC.state.cleCloitre === true)); }

// 5. la porte s'ouvre et ne bloque plus
await agir('la porte du cloître', px, C.z1 + 1.5);
verifier('la porte s’ouvre', await dans(() => TLOC.state.porteCloitre === true));
verifier('le seuil est libre', !(await bloque(px, C.z1)));
console.log('    vantaux :', JSON.stringify(await dans(() => window.__acte3.CLOITRE.vantaux.map((g) => [+g.rotation.y.toFixed(2), +g.position.x.toFixed(1), g.parent ? 'en scène' : 'hors scène']))));
await filmer(page, nom('porte'), [px - 7, 135, C.z1 + 13], [px, 134, C.z1 - 4]);

// 6. le moine cuisinier : la poulie
await dans(() => TLOC.player.pos.set(2616.5, TLOC.getH(2616.5, 1711.5), 1711.5));
await gong();
await agir('regarder le moine figé', 2616.5, 1711.5);
const repl = await finirDialogue(); console.log('   ', repl.join(' | ').slice(0, 200));
verifier('le cuisinier donne la poulie', await dans(() => TLOC.state.poulie === true));
await filmer(page, nom('cuisine'), [2612, 136, 1720], [2619, 133, 1709]);

// 7. le masque de bois : l'acte passe à « mali »
await agir('prendre le masque de bois', 2597.8, 1718);
verifier('le masque de bois', await dans(() => TLOC.state.masqueBois === true));
verifier('l’acte passe à « mali »', (await dans(() => TLOC.state.acte3)) === 'mali');

// 8. le câble se prend
{ const p0 = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  await agir('accrocher au câble — vers le grand piton', 2605, 1792);
  await pause(4000);
  const p1 = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  verifier('avec la poulie, on glisse', Math.hypot(p1[0] - 2605, p1[1] - 1792) > 20, JSON.stringify(p1.map(Math.round))); }

// 9. Somsak : Mali, et le trajet de Khao Phing Kan
{ await pause(30000);      // la glisse jusqu'au grand piton
  const l = await dans(() => { const T = TLOC, a = [112, 4];
    T.player.pos.set(a[0], T.getH(a[0], a[1]), a[1]);
    const it = T.interactables.filter((i) => /parler au passeur/.test(typeof i.prompt === 'function' ? i.prompt() : i.prompt)).sort((p, q) => Math.hypot(p.pos.x - a[0], p.pos.z - a[1]) - Math.hypot(q.pos.x - a[0], q.pos.z - a[1]))[0];
    it.fn(); return { items: T.menu.items.map((i) => i.label), texte: document.getElementById('overlay')?.textContent || '' }; });
  console.log('    Somsak :', JSON.stringify(l.items));
  verifier('Somsak parle de Mali', /Mali/.test(l.texte));
  verifier('Somsak va à Khao Phing Kan', l.items.some((x) => /Khao Phing Kan/.test(x)));
  verifier('le carnet note Mali', await dans(() => !!(TLOC.state.ind3 && TLOC.state.ind3.mali))); }

const vraies = erreurs.filter((e) => !/favicon/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
