// Banc de l'acte III, étape 7 (docs/DECOUPAGE-ACTE3.md, « la pluie tombe ») : le Yak battu au gong,
// la cinématique de la fin (le souffle, « Tu sonnes pour lui. », l'écume, la pluie, Nok, la Cloche
// des Îles et le troisième vers, la fête des barques), puis le temps rendu à toute la baie (la pluie
// tombe, un habitant figé finit sa phrase sans gong), Nok, et l'état gardé au rechargement (la cloche
// devant la porte, la fête au large). Le banc échoue à la première étape manquée.
//
//   bancs/tour.sh node bancs/acte3-fin.mjs [étiquette]
import { navigateur, filmer, JOUR, ORIGINE, DIR } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'a';
const nom = (n) => `acte3-fin-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const charger = async () => { await page.goto(ORIGINE + '/thailande.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte3, null, { timeout: 300000, polling: 300 });
  await pause(3000); await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); }); };

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await charger();
await dans(() => { Object.assign(TLOC.state, { gongThai: true, acte3: 'yak', poulie: true, masqueBois: true, masqueHanuman: true, barqueMali: true, statueKpk: true, lanterne: true, force: true, murFendu: true, ind3: { muet: true } }); TLOC.saveGame(true);
  setInterval(() => { TLOC.player.hp = TLOC.player.maxHp; }, 100); });
await pause(6000);

// 1. le Yak, battu au gong
await dans(() => { const T = TLOC; T.player.pos.set(904, T.getH(904, 306), 306); });
await pause(1500);
await dans(() => { const T = TLOC, e = window.__acte3.YAK.e; T.player.pos.set(e.pos.x, e.pos.y, e.pos.z - 4); });
await dans(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k', bubbles: true })));
await pause(300);
for (let k = 0; k < 3; k++) { await dans(() => { const e = window.__acte3.YAK.e; TLOC.hitEnemy(e, 2, e.pos.x, e.pos.z - 2); }); await pause(400); }
verifier('le Yak est battu', (await dans(() => TLOC.state.acte3)) === 'fete');

// 2. la cinématique : chaque plan lu, une capture aux moments clés
await page.waitForFunction(() => TLOC.cut.active, null, { timeout: 10000 }).catch(() => {});
const lignes = [];
for (let k = 0; k < 60; k++) {
  const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur || {}; return { say: c.say, text: c.text, who: c.who, i: T.cut.i }; });
  if (!r) break;
  const l = `${r.who ? r.who + ' : ' : ''}${r.say || r.text || ''}`; if (l && lignes[lignes.length - 1] !== l) lignes.push(l);
  if (/écume/.test(l) && !lignes.ecume) { lignes.ecume = 1; await pause(1000); await page.screenshot({ path: DIR + nom('ecume'), quality: 80 }); }
  if (/Cloche des Îles descend/.test(l) && !lignes.cl) { lignes.cl = 1; await pause(3300); await page.screenshot({ path: DIR + nom('cloche'), quality: 80 }); }
  if (/fête/.test(l) && !lignes.fe) { lignes.fe = 1; await pause(2500); await page.screenshot({ path: DIR + nom('fete'), quality: 80 }); }
  // une réplique attend qu'on la passe ; un plan minuté s'achève seul (on ne le saute pas : on lirait mal le suivant)
  if (r.say !== undefined) await dans(() => TLOC.cutAdvance(true));
  await pause(250);
}
for (const l of lignes) console.log('    ' + l.slice(0, 140));
verifier('« Tu sonnes pour lui. »', lignes.some((l) => /Tu sonnes pour lui/.test(l)));
verifier('le troisième vers', lignes.some((l) => /Chaque géant donnera ce qu’il est/.test(l)));
verifier('le souffle et la cloche', await dans(() => TLOC.state.souffle === true && TLOC.state.clocheIles === true));

// 3. le temps rendu : la pluie tombe, un figé loin de tout gong finit sa phrase
{ const c0 = await dans(() => TLOC.scene && window.__acte3 && performance.now()); await pause(200);
  const r = await dans(() => { const T = TLOC, it = T.interactables.find((i) => /regarder l’homme figé/.test(typeof i.prompt === 'function' ? i.prompt() : i.prompt)); if (!it) return null; T.player.pos.set(it.pos.x + 1, T.getH(it.pos.x + 1, it.pos.z), it.pos.z); it.fn(); return document.getElementById('msg')?.textContent || ''; });
  verifier('sans gong, un habitant finit sa phrase', /finit sa phrase/.test(r || ''), (r || '').slice(0, 80)); }
verifier('la fête des barques tourne', await dans(() => { const F = window.__acte3.FETE; return !!(F.c && F.barques.length === 5); }));

// 3 bis. le souffle : du ponton de Somsak, on entre dans la mer et l'on nage
// (les maisons sur pilotis sont posées au hasard à chaque chargement : on essaie plusieurs caps vers le large)
{ const r = await dans(() => { const T = TLOC, p = T.player.pos; let best = null;
    for (const a of [0, -0.4, 0.4, -0.8, 0.8]) { p.set(118, T.getH(118, 7.5), 7.5);
      for (let k = 0; k < 60; k++) T.tryMove(p, Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.5, false);
      p.y = T.getH(p.x, p.z); if (!best || p.x > best[0]) best = [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)]; }
    return best; });
  verifier('avec le souffle, on nage en eau profonde', Math.hypot(r[0] - 118, r[2] - 7.5) > 15 && r[1] < -0.5, JSON.stringify(r)); }
await filmer(page, nom('nage'), [126, 4, 18], [140, 0, 8], { camille: true });

// 4. rechargée : la cloche devant la porte, la fête au large
await charger();
await pause(2000);
verifier('rechargée, la cloche est devant la porte', await dans(() => !!(window.__acte3.YAK.cloche && window.__acte3.YAK.cloche.visible)));
verifier('rechargée, la fête tourne', await dans(() => window.__acte3.FETE.barques.length === 5));
await filmer(page, nom('cloche-porte'), [912, 120, 318], [904, 116, 327]);

const vraies = erreurs.filter((e) => !/favicon/.test(e));
verifier('aucune erreur', !vraies.length, vraies.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
