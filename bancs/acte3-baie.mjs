// Banc de l'acte III, étape 1 (docs/DECOUPAGE-ACTE3.md, « la baie figée ») : la porte des Îles, Nok
// et le gong, le gong sur un figé, Somsak et son seul trajet (Ton Sai, contre des écus), les autres
// barques qui refusent, l'arrivée à Ton Sai qui passe l'acte à « cloître ». Une partie neuve, jouée
// de bout en bout ; une capture par moment clé ; le banc échoue à la première étape manquée ou sur
// une erreur.
//
//   bancs/tour.sh node bancs/acte3-baie.mjs [étiquette]
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte3-baie-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const texte = (r) => (r ? r.repliques.join(' | ') : '');

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
const t0 = Date.now();
await page.goto(ORIGINE + '/thailande.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte3, null, { timeout: 300000, polling: 300 });
console.log('chargement', ((Date.now() - t0) / 1000).toFixed(1), 's');
await pause(3000);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); });
verifier('l’acte commence à « gong »', (await dans(() => TLOC.state.acte3)) === 'gong');

// le menu d'un passeur : ses destinations (sans « Rester ici »)
const menuPasseur = async (avant) => {
  // le passeur le plus proche de `avant` (parler() prendrait le premier de la liste : Somsak)
  const l = await dans((a) => { const T = TLOC;
    const it = T.interactables.filter((i) => /parler au passeur/.test(typeof i.prompt === 'function' ? i.prompt() : i.prompt))
      .sort((p, q) => Math.hypot(p.pos.x - a[0], p.pos.z - a[1]) - Math.hypot(q.pos.x - a[0], q.pos.z - a[1]))[0];
    T.player.pos.set(a[0], T.getH(a[0], a[1]), a[1]); it.fn();
    return T.menu.active ? T.menu.items.map((i) => i.label) : null; }, avant);
  return l;
};
const fermerMenu = () => dans(() => { const it = TLOC.menu.items.find((i) => /Rester/.test(i.label)); if (it) it.fn(); });

// 1. sans le gong, Somsak ne va qu'à Ton Sai, déjà (son trajet ne dépend que de lui)
{ const l = await menuPasseur([112, 4]);
  console.log('    Somsak :', JSON.stringify(l));
  verifier('Somsak ne va qu’à Ton Sai', l && l.filter((x) => /^Vers/.test(x)).length === 1 && /Ton Sai/.test(l[0]) && /écus/.test(l[0]));
  await fermerMenu(); }

// 2. Nok donne le gong et parle de Somsak
{ const r = await parler(page, 'parler à Nok', { avant: [75, -55] }); console.log('   ', texte(r).slice(0, 200));
  verifier('Nok donne le gong', await dans(() => TLOC.state.gongThai === true));
  verifier('le carnet note Somsak', await dans(() => !!(TLOC.state.ind3 && TLOC.state.ind3.somsak)));
  await filmer(page, nom('nok'), [80, 6, -50], [70, 2, -62]); }

// 3. le gong sur un habitant figé de Ko Panyi : il finit sa phrase
{ const r = await dans(async () => { const T = TLOC;
    const it = T.interactables.find((i) => /regarder l’homme figé|regarder l’enfant figé/.test(typeof i.prompt === 'function' ? i.prompt() : i.prompt) && Math.hypot(i.pos.x - 66, i.pos.z - 44) < 30);
    if (!it) return null;
    T.player.pos.set(it.pos.x + 1, T.getH(it.pos.x + 1, it.pos.z), it.pos.z);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    it.fn(); return document.getElementById('msg')?.textContent || '';
  });
  console.log('    figé :', String(r).slice(0, 140));
  verifier('au gong, le figé finit sa phrase', /finit sa phrase/.test(String(r))); }

// 4. Somsak : Ton Sai, payé ; l'arrivée passe l'acte à « cloitre »
{ await menuPasseur([112, 4]);
  await dans(() => { const it = TLOC.menu.items.find((i) => /Ton Sai/.test(i.label)); it.fn(); });
  await pause(3500);
  const p = await dans(() => [TLOC.player.pos.x, TLOC.player.pos.z]);
  verifier('débarquée à Ton Sai', Math.hypot(p[0] - 2187, p[1] - 1927) < 10, JSON.stringify(p.map(Math.round)));
  verifier('l’acte passe à « cloitre »', (await dans(() => TLOC.state.acte3)) === 'cloitre');
  await filmer(page, nom('tonsai'), [2170, 12, 1950], [2230, 8, 1880]); }

// 5. à Ton Sai, le passeur ne ramène qu'à Ko Panyi, et sans payer
{ const l = await menuPasseur([2180, 1915]);
  console.log('    Ton Sai :', JSON.stringify(l));
  verifier('de Ton Sai, seulement Ko Panyi, sans prix', l && l.filter((x) => /^Vers/.test(x)).length === 1 && /Ko Panyi/.test(l[0]) && !/écus/.test(l[0]));
  await fermerMenu(); }

// 6. le journal porte l'indice (barré : il a servi)
{ const h = await dans(() => (TLOC.G.level.indices ? TLOC.G.level.indices() : ''));
  verifier('le carnet de l’acte III', /Somsak/.test(h) && /line-through/.test(h)); }

const vraies = erreurs.filter((e) => !/favicon/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
