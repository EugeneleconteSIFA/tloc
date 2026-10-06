// Banc de l'acte II, lot A (docs/DECOUPAGE-ACTE2.md, étapes 1 et 2) : la guerre de l'eau et les
// trois témoins, joués de bout en bout dans une seule partie — les cavaliers, les gardes du lac
// qui repoussent, la cave fermée, le maître de Beauregard, la cave et le prisonnier, la forge de
// Fariboules et le forgeron, le carnet du journal. Une capture par moment clé ; le banc échoue à
// la première étape manquée ou sur une erreur.
//
//   bancs/tour.sh node bancs/acte2-temoins.mjs [étiquette]
import { navigateur, parler, filmer, filmerSujet, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte2-temoins-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
// une ressource absente : on dit laquelle (la console ne donne que « 404 »)
page.on('response', (r) => { if (r.status() >= 400) console.log('   ', r.status(), r.url()); });
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text())) { if (/favicon\.ico/.test(m.location().url)) favicons++; else console.log('    absent :', m.location().url); } });
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const etape = () => dans(() => TLOC.state.acte2);
const ind = (k) => dans((k) => !!(TLOC.state.ind2 && TLOC.state.ind2[k]), k);
const texte = (r) => (r ? r.repliques.join(' | ') : '');

// une partie neuve, ouverte droit sur le lac (les portes de l'île sont ouvertes : l'acte commence en arrivant)
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
// (les 404 de la page de connexion ne sont pas du lac : on ne compte qu'à partir d'ici)
erreurs.length = 0;
const t0 = Date.now();
await page.goto(ORIGINE + '/aveyron.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte2, null, { timeout: 300000, polling: 300 });
console.log('chargement', ((Date.now() - t0) / 1000).toFixed(1), 's');
// les gens de l'acte naissent un par image, après le chargement
await pause(4000);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); });
verifier('l’acte commence à « guerre »', (await etape()) === 'guerre');
const gens = await dans(() => { const G = window.__acte2.gens; return { maitre: !!G.maitre, prisonnier: !!G.prisonnier, forgeron: !!G.forgeron, gardes: (G.gardes || []).filter(Boolean).length }; });
verifier('les gens de l’acte sont nés', gens.maitre && gens.prisonnier && gens.forgeron && gens.gardes === 2, JSON.stringify(gens));

// 1. le cavalier du Batut : Beauregard a pris un des leurs
{ const r = await parler(page, 'parler au cavalier', { avant: [-120, 135] }); console.log('   ', texte(r).slice(0, 160));
  verifier('le cavalier du Batut renvoie au maître de Beauregard', /maître de Beauregard/.test(texte(r)) && await ind('maitre')); }

// 2. les gardes du lac : un pas dans l'eau, et Camille recule
{ const r = await dans(async () => { const T = TLOC, A = window.__acte2, P = A.eaux[0];
    // un point du lac à 3 m du bord, et le bord lui-même, hors de l'eau
    let dehors = null, dedansP = null;
    for (const [x, z] of P) { const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length, d = Math.hypot(cx - x, cz - z);
      const ex = x - (cx - x) / d * 3, ez = z - (cz - z) / d * 3, ix = x + (cx - x) / d * 3, iz = z + (cz - z) / d * 3;
      const inside = (px, pz) => A.eaux.some((Q) => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const [xi, zi] = Q[i], [xj, zj] = Q[j]; if ((zi > pz) !== (zj > pz) && px < (xj - xi) * (pz - zi) / (zj - zi) + xi) c = !c; } return c; });
      if (!inside(ex, ez) && inside(ix, iz) && !T.blocked(ex, ez, 0.5, false, T.getH(ex, ez))) { dehors = [ex, ez]; dedansP = [ix, iz]; break; } }
    if (!dehors) return null;
    T.player.pos.set(dehors[0], T.getH(...dehors), dehors[1]); await new Promise((r) => setTimeout(r, 400));
    T.player.pos.set(dedansP[0], T.getH(...dedansP), dedansP[1]); await new Promise((r) => setTimeout(r, 400));
    return { repousse: Math.hypot(T.player.pos.x - dedansP[0], T.player.pos.z - dedansP[1]) > 2, msg: document.getElementById('msg')?.textContent || '' }; });
  verifier('un pas dans le lac : Camille est repoussée', !!r && r.repousse, r ? r.msg.slice(0, 80) : 'pas de bord trouvé');
  const gp = await dans(() => { const o = (window.__acte2.gens.gardes || [])[0]; return o ? [o.position.x, o.position.y, o.position.z, o.rotation.y] : null; });
  if (gp) await filmerSujet(page, nom('garde-barrage'), gp); }

// 3. la cave est fermée tant que le maître n'a pas parlé
{ await parler(page, 'descendre à la cave'); await pause(300);
  verifier('la cave est fermée avant le maître', !(await dans(() => !!window.__acte2.salle))); }

// 4. le maître de Beauregard, dans le salon
{ const m = await dans(() => window.__acte2.maitrePos);
  const r = await parler(page, 'maître de Beauregard'); console.log('   ', texte(r).slice(0, 160));
  verifier('le maître : le prisonnier est dans la cave', /dans la cave/.test(texte(r)) && (await etape()) === 'temoins' && await ind('cave'));
  if (m) await filmerSujet(page, nom('maitre'), [...m, 0], { camille: true }); }

// 5. la cave, le prisonnier derrière la grille
{ await parler(page, 'descendre à la cave'); await pause(600);
  const c = await dans(() => ({ salle: !!window.__acte2.salle, y: TLOC.player.pos.y }));
  verifier('on descend à la cave', c.salle && c.y > 590, `y = ${c.y.toFixed(1)}`);
  // marcher un peu (la touche d'avance) : le sol tient, la grille arrête
  await page.keyboard.down('KeyW'); await pause(1500); await page.keyboard.up('KeyW');
  const apres = await dans(() => ({ y: TLOC.player.pos.y, z: TLOC.player.pos.z, S: window.__acte2.salle && [window.__acte2.salle.z] }));
  verifier('le sol de la cave porte, la grille arrête', apres.y > 599 && apres.S && apres.z > apres.S[0] - 0.4, `y = ${apres.y.toFixed(2)} z = ${apres.z.toFixed(2)}`);
  const S = await dans(() => { const S = window.__acte2.salle; return [S.x, S.y, S.z]; });
  await filmer(page, nom('cave'), [S[0] + 2.8, S[1] + 1.9, S[2] + 2.3], [S[0] - 0.6, S[1] + 1.0, S[2] - 1.6], { camille: true });
  const r = await parler(page, 'prisonnier'); console.log('   ', texte(r).slice(0, 200));
  verifier('le prisonnier : les fers à étoile, le forgeron de Fariboules', /étoile/.test(texte(r)) && await ind('etoile'));
  await parler(page, 'remonter au hall'); await pause(600);
  const h = await dans(() => ({ salle: !!window.__acte2.salle, y: TLOC.player.pos.y }));
  verifier('on remonte au hall', !h.salle && h.y < 300, `y = ${h.y.toFixed(1)}`); }

// 6. le forgeron de Fariboules
{ const f = await dans(() => window.__acte2.forgeronPos);
  verifier('la forge est posée', !!f);
  const r = await parler(page, 'forgeron'); console.log('   ', texte(r).slice(0, 200));
  verifier('le forgeron : Jacques, l’abreuvoir de Beauregard', /Jacques/.test(texte(r)) && /abreuvoir/.test(texte(r)) && (await etape()) === 'traces');
  if (f) { await filmerSujet(page, nom('forgeron'), [...f, Math.PI]); await filmer(page, nom('forge'), [f[0] + 6, f[1] + 3, f[2] + 6], [f[0] + 0.4, f[1] + 1, f[2] - 1]); } }

// 7. le carnet du journal
{ const j = await dans(() => TLOC.G && TLOC.G.level && TLOC.G.level.indices ? TLOC.G.level.indices() : (window.__acte2 && ''));
  const j2 = j || await dans(async () => { const E = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/engine.js?v='))); return E.G.level.indices(); });
  verifier('le carnet porte les cinq indices', ['grande salle', 'cave', 'étoile', 'Jacques', 'abreuvoir'].every((k) => j2.includes(k)), `${(j2.match(/<div style="margin/g) || []).length} lignes`); }

// (le favicon.ico manque au site entier : ce n'est pas du lac — on le dit, on ne le compte pas)
verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
