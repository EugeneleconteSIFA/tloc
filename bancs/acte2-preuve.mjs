// Banc de l'acte II, lot B (docs/DECOUPAGE-ACTE2.md, étapes 3 à 5) : la piste de l'étoile, l'enclos
// caché, ses brigands, les colliers des deux maisons, la preuve montrée, le duel du barrage et la
// fuite de Jacques — joués de bout en bout dans une seule partie, partie posée à « traces » (les
// trois témoins entendus). Une capture par moment clé ; le banc échoue à la première étape manquée.
//
//   bancs/tour.sh node bancs/acte2-preuve.mjs [étiquette]
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'b';
const nom = (n) => `acte2-preuve-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text())) { if (/favicon\.ico/.test(m.location().url)) favicons++; else console.log('    absent :', m.location().url); } });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const etape = () => dans(() => TLOC.state.acte2);
const texte = (r) => (r ? r.repliques.join(' | ') : '');
const finirDialogues = () => dans(() => { const T = TLOC; let n = 0; while (T.cut.active && n++ < 50) T.cutAdvance(true); });

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/aveyron.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte2, null, { timeout: 300000, polling: 300 });
await pause(4000); await finirDialogues();
// l'état de départ : les trois témoins entendus ; Camille solide (le banc ne joue pas l'esquive)
await dans(() => { const T = TLOC; Object.assign(T.state, { acte2: 'traces', ind2: { maitre: true, cave: true, etoile: true, jacques: true, piste: true } }); T.state.sword = true; T.player.maxHp = T.player.hp = 40; T.saveGame(true); });

// se battre : coller la créature, la regarder, frapper, jusqu'à ce qu'elle tombe
async function abattre(e) {
  for (let k = 0; k < 80; k++) {
    const fini = await dans((i) => { const T = TLOC, E = window.__acte2, en = i === 'brasdroit' ? E.brasdroit : E.brigands[i]; if (!en || en.dead) return true;
      const p = T.player.pos, d = Math.hypot(p.x - en.pos.x, p.z - en.pos.z) || 1; if (d > 1.6) { const x = en.pos.x + (p.x - en.pos.x) / d * 1.3, z = en.pos.z + (p.z - en.pos.z) / d * 1.3; p.set(x, T.getH(x, z), z); }
      T.player.yaw = Math.atan2(en.pos.x - p.x, en.pos.z - p.z); T.player.hp = T.player.maxHp; T.player.attackCd = 0; T.player.attackT = 0; T.player.hitSet.clear(); return false; }, e);
    if (fini) return true; await pause(350);
  }
  return false;
}

// 1. la piste : des empreintes de l'abreuvoir à l'enclos, cachées de loin
const P = await dans(() => { const A = window.__acte2; return { n: (A.traces || []).length, depart: A.depart, enclos: A.enclos, pts: (A.traces || []).map((g) => [g.position.x, g.position.y, g.position.z]) }; });
verifier('la piste est posée', P.n > 10 && !!P.enclos, `${P.n} groupes d’empreintes, enclos ${P.enclos ? P.enclos.x.toFixed(0) + ' ; ' + P.enclos.z.toFixed(0) : '—'}`);
{ const libres = await dans((pts) => pts.filter(([x, , z]) => !TLOC.blocked(x, z, 0.5, false, TLOC.getH(x, z))).length, P.pts);
  verifier('la piste se marche (empreintes hors des obstacles)', libres >= P.n * 0.95, `${libres} / ${P.n}`); }
{ const [x, y, z] = P.pts[0];
  await dans(([x, z]) => { const T = TLOC; T.player.pos.set(x + 1, T.getH(x + 1, z), z + 1); }, [x, z]); await pause(500);
  const v = await dans(() => { const A = window.__acte2; return { pres: A.traces.filter((g) => g.visible).length, vue: !!A.etoileVue }; });
  verifier('de près, les empreintes se voient ; Camille dit « Une étoile »', v.pres > 0 && v.vue, `${v.pres} visibles`);
  await filmer(page, nom('empreintes'), [x + 1.6, y + 1.6, z + 1.6], [x, y, z], { camille: false });
  // de loin, on ne les voit pas (l'aérienne au-dessus de la piste)
  const m = P.pts[Math.floor(P.n / 2)];
  await filmer(page, nom('piste-haut'), [m[0] + 30, m[1] + 60, m[2] + 30], [m[0], m[1], m[2]]); }

// 2. l'enclos et ses brigands
{ const E = P.enclos;
  await dans(([x, z]) => { const T = TLOC; T.player.pos.set(x, T.getH(x, z), z); }, P.pts[P.n - 1].filter((_, i) => i !== 1)); await pause(800);
  const nb = await dans(() => (window.__acte2.brigands || []).length);
  verifier('trois brigands se lèvent autour de l’enclos', nb === 3);
  await filmer(page, nom('enclos'), [E.x + 12, E.y + 6, E.z + 12], [E.x, E.y + 0.5, E.z]);
  const r0 = await parler(page, 'les colliers'); await pause(300); await finirDialogues();
  verifier('les colliers ne se prennent pas sous la garde des brigands', (await etape()) === 'traces');
  for (const i of [0, 1, 2]) verifier(`brigand ${i + 1} abattu`, await abattre(i));
  const bt = await dans(() => window.__acte2.betes || 0); verifier('les bêtes des deux maisons sont dans l’enclos', bt >= 10, `${bt} brebis`);
  const r = await parler(page, 'les colliers'); console.log('   ', texte(r));
  verifier('les colliers : la preuve', (await etape()) === 'preuve' && await dans(() => !!TLOC.state.colliers)); }

// 3. la preuve montrée aux deux maisons
{ const a = await parler(page, 'parler au cavalier', { avant: [-120, 135] }); console.log('   ', texte(a).slice(0, 140));
  const bb = await dans(() => { const T = TLOC, it = T.interactables.filter((i) => /cavalier/.test(i.prompt())).sort((p, q) => q.pos.x - p.pos.x)[0]; T.player.pos.set(it.pos.x - 1, it.pos.y, it.pos.z - 1); it.fn(); return true; });
  await pause(300); await finirDialogues();
  verifier('les deux maisons ont vu la preuve : en route pour le duel', (await etape()) === 'duel'); }

// 4. les gardes s'écartent : on peut aller au bord de l'eau
{ const r = await dans(async () => { const T = TLOC, A = window.__acte2, P = A.eaux[0], cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
    const [x, z] = P[0], d = Math.hypot(cx - x, cz - z), ix = x + (cx - x) / d * 3, iz = z + (cz - z) / d * 3;
    T.player.pos.set(ix, T.getH(ix, iz), iz); await new Promise((r) => setTimeout(r, 400)); return Math.hypot(T.player.pos.x - ix, T.player.pos.z - iz) < 0.5; });
  verifier('après la preuve, les gardes laissent approcher l’eau', r); }

// 5. le duel, sur la crête du barrage
{ const c = await dans(() => { const P = window.__acte2.barrage; return [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length]; });
  await dans(([x, z]) => { const T = TLOC; T.player.pos.set(x + 12, T.getH(x + 12, z), z); }, c); await pause(800);
  const parle = await dans(() => TLOC.cut.active ? (TLOC.cut.cur && TLOC.cut.cur.say) : null);
  verifier('le bras droit de Jacques parle', !!parle && /petite de l’île/.test(parle));
  await finirDialogues(); await pause(500);
  const e = await dans(() => { const e = window.__acte2.brasdroit; return e ? [e.pos.x, e.pos.y, e.pos.z] : null; });
  verifier('le duel commence', !!e);
  if (e) await filmer(page, nom('duel'), [e[0] + 6, e[1] + 2.5, e[2] + 4], [e[0], e[1] + 1, e[2]], { camille: true });
  verifier('le bras droit à terre', await abattre('brasdroit'));
  await pause(800);
  const fin = await dans(() => TLOC.cut.active ? (TLOC.cut.cur && TLOC.cut.cur.say) : null);
  verifier('vaincu, il dit où est parti Jacques', !!fin && /Dormeur/.test(fin));
  await finirDialogues(); await pause(1500);
  verifier('la guerre est finie : « familles »', (await etape()) === 'familles');
  const f = await dans(() => { const F = window.__acte2.fuite; return F && F.r ? [F.r.position.x, F.r.position.y, F.r.position.z] : null; });
  verifier('Jacques file vers l’ouest à cheval', !!f);
  if (f) await filmer(page, nom('fuite'), [f[0] + 25, f[1] + 6, f[2] + 15], [f[0], f[1] + 1, f[2]]); }

// (le favicon.ico manque au site entier : ce n'est pas du lac — on le dit, on ne le compte pas)
verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
