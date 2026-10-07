// Banc de l'acte VI, lot 1 (E1) : la traversée de la Blessure. La partie posée à la fin de l'acte V
// (`acte5: 'course'`), les dons posés (la force, le souffle — et le lasso, qu'E4 fait : le banc le pose
// lui-même). On passe la fêlure au Temple (le mage, maître Cornil), on descend au lasso, on traverse la
// rivière à la nage, on pousse les trois blocs de l'escalier des géants, on abaisse le pont.
//
//   bancs/tour.sh node bancs/acte6-traversee.mjs
import { navigateur, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const nom = (n) => `acte6-traversee-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text()) && /favicon/.test(m.location().url)) favicons++; });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const pret = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
// la scène en cours, lue jusqu'au bout
async function lire() { const dits = [];
  for (let k = 0; k < 40; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say; T.cutAdvance(true); return s || ''; });
    if (r === null) break; if (r) dits.push(r); await pause(300); }
  return dits; }
// l'interaction la plus proche dont l'invite répond à `re` ; Camille posée à côté, puis le geste
const agir = (re) => dans((re) => { const T = TLOC, p0 = T.player.pos;
  const l = T.interactables.filter((i) => { try { return (!i.enabled || i.enabled()) && new RegExp(re, 'i').test(typeof i.prompt === 'function' ? i.prompt() : i.prompt || ''); } catch (e) { return false; } });
  if (!l.length) return null;
  l.sort((a, c) => a.pos.distanceTo(p0) - c.pos.distanceTo(p0)); const it = l[0];
  T.player.pos.set(it.pos.x, it.pos.y, it.pos.z); const inv = typeof it.prompt === 'function' ? it.prompt() : it.prompt; it.fn(); return inv; }, re);
const ou = () => dans(() => [TLOC.player.pos.x, TLOC.player.pos.y, TLOC.player.pos.z].map((v) => +v.toFixed(2)));
const etape = () => dans(() => TLOC.state.acte6);
const message = () => dans(() => document.getElementById('msg')?.textContent || '');
// marcher tout droit : yaw posé, la touche tenue
async function marcher(yaw, ms) {
  await dans((y) => { TLOC.player.yaw = y; TLOC.G.camYaw = y; }, yaw);
  await page.keyboard.down('KeyW'); await pause(ms); await page.keyboard.up('KeyW'); await pause(200);
}

// ---------- l'île : la fêlure ----------
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/temple.html'); await pret(); await pause(3000);
await dans(() => { const T = TLOC; while (T.cut.active) T.cutAdvance(true); Object.assign(T.state, { acte5: 'course', troupeauxVu: true, force: true, souffle: true, elan: true, course: true, lasso: true }); });
await pause(800);
await dans(() => { while (TLOC.cut.active) TLOC.cutAdvance(true); });
const inv = await agir('fêlure');
verifier('la porte de la fêlure s’ouvre à la fin de l’acte V', inv === 'passer la fêlure', inv);
const dits = await lire();
console.log('   ', dits.join(' | ').slice(0, 300));
verifier('le mage nomme maître Cornil', /maître Cornil/.test(dits.join()) && /Blessure/.test(dits.join()));
await page.waitForURL(/rive\.html/, { timeout: 60000 }).catch(() => {});
const t0 = Date.now(); await pret(); console.log('    chargement de rive.html :', ((Date.now() - t0) / 1000).toFixed(1), 's'); await pause(4000);
await dans(() => { while (TLOC.cut.active) TLOC.cutAdvance(true); });
await pause(1500);
verifier('arrivée sur le bord de la Blessure', /rive\.html/.test(page.url()) && (await etape()) === 'bord', `${await etape()} ${await ou()}`);
await filmer(page, nom('bord'), [-6, 4, 60], [0, -14, 10], { camille: true });
await filmer(page, nom('blessure'), [70, 14, 50], [0, -18, 0]);

// ---------- la descente au lasso ----------
await dans(() => { TLOC.state.lasso = false; });
await agir('descendre au lasso'); await pause(400);
verifier('sans lasso : « une corde »', /corde/.test(await message()));
await dans(() => { TLOC.state.lasso = true; });
for (let k = 0; k < 3; k++) { await agir('descendre au lasso'); await pause(1600); console.log('    lasso', k + 1, await ou()); }
const pf = await ou();
verifier('au fond de la Blessure, en trois lancers', pf[1] < -23 && (await etape()) === 'descente', `${pf} ${await etape()}`);
await filmer(page, nom('fond'), [-26, -21, 24], [-12, -18, -6], { camille: true });

// ---------- la rivière : sans le souffle, puis avec ----------
await dans(() => { TLOC.state.souffle = false; });
await marcher(Math.PI, 3500);
const ps = await ou();
verifier('sans le souffle, la rivière renvoie à la berge', ps[2] > 8, `${ps}`);
await dans(() => { TLOC.state.souffle = true; });
await marcher(Math.PI, 7000);
const pr = await ou();
verifier('avec le souffle, la rivière traversée à la nage', (await etape()) === 'riviere' && pr[2] < -8, `${pr} ${await etape()}`);
await filmer(page, nom('riviere'), [-14, -20, 14], [0, -24, -4]);

// ---------- l'escalier des géants ----------
await dans(() => { TLOC.state.force = false; });
await agir('pousser le bloc'); await pause(400);
verifier('sans la force, le bloc ne bouge pas', /ne bouge pas/.test(await message()));
await dans(() => { TLOC.state.force = true; });
await filmer(page, nom('escalier-avant'), [6, 4, -68], [0, -18, -18]);
for (let k = 0; k < 3; k++) { await agir('pousser le bloc'); await pause(600); }
verifier('trois marches refaites', (await etape()) === 'escalier' && (await dans(() => TLOC.state.marches6)) === 3);
// on remonte à pied
await dans(() => { const T = TLOC; T.player.pos.set(0, T.getH(0, -15), -15); });
await marcher(Math.PI, 16000);
const pe = await ou();
verifier('l’escalier remonté à pied jusqu’à l’autre rive', pe[2] < -60 && pe[1] > -1, `${pe}`);
await filmer(page, nom('escalier'), [0.5, -21, -10], [0, -9, -40]);

// ---------- le pont des géants ----------
await filmer(page, nom('pont-releve'), [20, 8, -40], [40, 10, -10]);
await agir('treuil'); await pause(800);
verifier('le pont des géants abaissé', (await etape()) === 'rive' && (await dans(() => TLOC.state.pont6)) === true, await message());
await filmer(page, nom('pont'), [70, 12, 20], [40, 0, 10]);
// on revient à pied par le pont, jusqu'au bord côté Lille
await dans(() => { const T = TLOC; T.player.pos.set(40, T.getH(40, -16), -16); });
await marcher(0, 14000);
const pp = await ou();
verifier('retour à pied par le pont', pp[2] > 40 && pp[1] > -1, `${pp}`);

// le retour vers l'île
await agir('repasser la fêlure');
await page.waitForURL(/temple\.html/, { timeout: 60000 }).catch(() => {});
verifier('la fêlure ramène à l’île', /temple\.html/.test(page.url()));
await pret(); await pause(2000);

verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
