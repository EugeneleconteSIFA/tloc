// Banc des grandes quêtes secondaires de l'acte II (docs/DECOUPAGE-ACTE2.md, seconde partie) :
// les sources (la source des Vergnes à la bombe, la fontaine à la force, le puits de Perpignou),
// l'arbre des Roquette (huit rentrés chez eux, le cœur, l'arbre au mur du Pouget), le train (la paie
// en trois caches, rapportée au colporteur) — dans une seule partie posée à « pluie ».
//
//   bancs/tour.sh node bancs/acte2-quetes.mjs [étiquette]
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'q';
const nom = (n) => `acte2-quetes-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text())) { if (/favicon\.ico/.test(m.location().url)) favicons++; else console.log('    absent :', m.location().url); } });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const q2 = () => dans(() => JSON.parse(JSON.stringify(TLOC.state.q2 || {})));
const texte = (r) => (r ? r.repliques.join(' | ') : '');
const finirDialogues = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };
// parler à l'habitant du lac le plus proche d'un point (leurs invites disent toutes « parler »)
async function parlerPres(x, z) {
  await dans(([x, z]) => { const T = TLOC, it = T.interactables.filter((i) => (!i.enabled || i.enabled()) && i.prompt() === 'parler').sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))[0];
    T.player.pos.set(it.pos.x + 1, it.pos.y, it.pos.z); it.fn(); }, [x, z]);
  const rep = [];
  for (let k = 0; k < 40; k++) { await pause(120); const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? c.say : ''; T.cutAdvance(true); return s; }); if (r === null) break; if (r) rep.push(r); }
  return rep.join(' | ');
}
// poser une bombe, s'écarter, attendre qu'elle saute
async function bombe(re) { const r = await parler(page, re); await dans(() => { const p = TLOC.player.pos; p.set(p.x + 4, TLOC.getH(p.x + 4, p.z), p.z); }); await pause(2300); return r; }

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/aveyron.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte2, null, { timeout: 300000, polling: 300 });
await pause(4000); await finirDialogues();
await dans(() => { const T = TLOC; Object.assign(T.state, { acte2: 'pluie', force: true, bombes: true, nbBombes: 10, sword: true, bourse: true, ecus: 0, ind2: { coeur: true, faille: true } }); T.player.maxHp = T.player.hp = 24; T.saveGame(true); });
await pause(800);
const G = await dans(() => (window.__lieu.gens || []).map((g) => [g.qui, g.x, g.z]));
const ou = (re) => G.find((g) => re.test(g[0]));

// 1. les sources
{ const f = ou(/fontaine/); const t = await parlerPres(f[1], f[2]); console.log('   ', t.slice(0, 160));
  verifier('la femme de la fontaine donne les trois sources', /trois/.test(t) && (await q2()).sourcesDonne);
  await bombe('bouche murée'); verifier('la source des Vergnes, rouverte à la bombe', !!(await q2()).sources.vergnes);
  const v = await dans(() => window.__acte2.q2.vergnes); await filmer(page, nom('vergnes'), [v[0] + 5, await dans(([x, z]) => TLOC.getH(x, z), v) + 3, v[1] + 5], [v[0], await dans(([x, z]) => TLOC.getH(x, z), v), v[1]]);
  await dans(() => { TLOC.player.hp = 3; }); await parler(page, 'boire à la source'); verifier('on y boit (vie pleine)', await dans(() => TLOC.player.hp === TLOC.player.maxHp));
  await parler(page, 'le bloc dans le bassin'); verifier('la fontaine, rouverte à la force', !!(await q2()).sources.fontaine);
  await bombe('bombe dans le puits'); const r = await parler(page, 'remonter le seau'); verifier('le puits de Perpignou, rouvert', !!r && !!(await q2()).sources.puits && await dans(() => !window.__acte2.q2.comble.visible));
  // ce qui se voit dans la margelle, une fois le seau remonté (une capture montrait encore des pierres)
  console.log('    dans le puits :', await dans(() => { const [x, z] = window.__acte2.q2.puits, V = TLOC.THREE.Vector3, out = [];
    TLOC.scene.traverse((o) => { if (!o.isMesh) return; let v = true; for (let q = o; q; q = q.parent) v = v && q.visible; if (!v) return;
      const b = new TLOC.THREE.Box3().setFromObject(o), c = b.getCenter(new V()); if (Math.hypot(c.x - x, c.z - z) < 1.2 && b.max.x - b.min.x < 4) out.push(o.geometry.type + '@' + (o.parent && o.parent.parent === TLOC.scene ? 'groupe' : o.parent === TLOC.scene ? 'scène' : 'sous-groupe')); });
    return out.join(', '); }));
  const p = await dans(() => window.__acte2.q2.puits); const py = await dans(([x, z]) => TLOC.getH(x, z), p);
  await filmer(page, nom('puits'), [p[0] + 3, py + 2.5, p[1] + 3], [p[0], py + 0.4, p[1]]);
  const t2 = await parlerPres(f[1], f[2]); verifier('la femme remercie', /Merci/.test(t2)); }

// 2. l'arbre des Roquette
{ const r = await parler(page, 'parler à l’aïeule'); console.log('   ', texte(r).slice(-140));
  verifier('l’aïeule donne l’arbre des Roquette', (await q2()).arbreDonne);
  const ids = await dans(() => Object.values(window.__acte2.arbre).map((R) => R.it.prompt()));
  verifier('les huit Roquette sont posés', ids.length === 8, `${ids.length}`);
  for (const inv of ids) await parler(page, inv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  await finirDialogues();
  const n = Object.keys((await q2()).arbre || {}).length; verifier('les huit sont rentrés', n === 8, `${n} / 8`);
  const av = await dans(() => TLOC.player.maxHp);
  const r2 = await parler(page, 'parler à l’aïeule'); await finirDialogues(); console.log('   ', texte(r2).slice(0, 140));
  verifier('l’aïeule donne un cœur, l’arbre est au mur', (await q2()).arbreFini && await dans(() => TLOC.player.maxHp) === av + 2 && await dans(() => !!window.__acte2.tableau));
  const t = await dans(() => { const m = window.__acte2.tableau; return [m.position.x, m.position.y, m.position.z, m.rotation.y]; });
  await filmer(page, nom('arbre'), [t[0] + Math.sin(t[3]) * 2.6, t[1], t[2] + Math.cos(t[3]) * 2.6], [t[0], t[1], t[2]], { camille: true });
  const c = await dans(() => { const R = window.__acte2.arbre.cadet_batut; return R.o ? [R.o.position.x, R.o.position.y, R.o.position.z] : null; });
  if (c) await filmer(page, nom('batut-cour'), [c[0] + 6, c[1] + 3, c[2] + 6], [c[0], c[1] + 1, c[2]]); }

// 3. le train
{ const co = ou(/colporteur/); const t = await parlerPres(co[1], co[2]); console.log('   ', t.slice(0, 160));
  verifier('le colporteur raconte la paie volée', /en trois/.test(t) && (await q2()).trainDonne);
  await parler(page, 'fouiller la paille'); await parler(page, 'soulever la barque'); await parler(page, 'derrière la maisonnette'); await finirDialogues();
  const n = Object.keys((await q2()).train || {}).length; verifier('les trois parts de la paie', n === 3, `${n} / 3`);
  const e0 = await dans(() => TLOC.state.ecus || 0); const t2 = await parlerPres(co[1], co[2]);
  verifier('rapportées au colporteur : des écus', (await q2()).trainFini && await dans(() => TLOC.state.ecus || 0) > e0, t2.slice(0, 80)); }

verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
