// Banc de l'acte VII, lots 3 et 4 : le pont de Fin (quetes.js, acte7Tick) — Lille figée, Eugène, le dernier combat ;
// la porte dans la Porte Royale, Eugène qui la tient, trois coups de l'épée de Lydéric, la porte fermée ; l'épilogue
// (le temps qui repart, Lydéric, la botte, « Ce que la garde commence, la garde l'achève. », la dernière cloche, le
// générique) ; puis l'accueil, et la partie qui reprend au pont (`fin`).
//
//   bancs/tour.sh node bancs/acte7-pont.mjs
import { navigateur, partieActe1, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const nom = (n) => `acte7-pont-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
async function lire(attente = 200) { const dits = [];
  // (la page peut partir pour l'accueil au bout du générique : la lecture s'arrête là)
  for (let k = 0; k < 60; k++) { const r = await dans(() => { const T = window.TLOC; if (!T || !T.cut.active) return null; const c = T.cut.cur; const s = c && (c.say || c.title); T.cutAdvance(true); return s || ''; }).catch(() => null);
    if (r === null) break; if (r) dits.push(r); await pause(attente);
    // le générique, en rendu : le titre sur le noir
    if (r === 'The Legend of Camille') { await dans(() => { const T = window.TLOC; T.cut.steps.splice(T.cut.i, 0, T.cut.cur); T.cut.i--; T.cutAdvance(true); }).catch(() => {}); await pause(1600); await page.screenshot({ path: new URL('resultats/' + nom('generique'), import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), quality: 80 }); } }
  return dits; }
const etape = () => dans(() => TLOC.state.acte7);
const phin = () => dans(() => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead && e.horsTemps); return e ? { hp: e.hp, max: e.k.hp, z: e.pos.z } : null; });
const frapper = (d = 3) => dans((d) => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead && e.horsTemps); if (e) TLOC.hitEnemy(e, d, e.pos.x + 1, e.pos.z); }, d);

await partieActe1(page, { acte1: 'temple', templeVu: true, introSeen: true, bossDead: true, sword: true, force: true, lasso: true, gongThai: true, tambourin: true, sonnaille: true,
  acte6: 'cloche', grandeCloche: true, acte7: 'pont', monde7: 4, epeeLyderic: true });
await page.goto(ORIGINE + '/index.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
await dans(() => { const M = TLOC.menu; if (M.active) { const it = M.items.find((i) => /reprendre|continuer/i.test(i.label)); if (it) it.fn(); } });
await pause(4000);
erreurs.length = 0;
{ let dits = []; for (let k = 0; k < 20 && !dits.some((d) => /Cette fois, je suis là/.test(d)); k++) { dits = dits.concat(await lire()); await pause(400); }
  console.log('   ', dits.join(' | ').slice(0, 300));
  verifier('le pont : Lille figée, Phinaert, Eugène', dits.some((d) => /Cette fois, je suis là/.test(d)) && await dans(() => TLOC.G.tempsArrete === true) && !!(await phin())); }
await dans(() => { TLOC.player.maxHp = TLOC.player.hp = 40; });
await filmer(page, nom('pont'), await dans(() => { const P = TLOC.player.pos; return [P.x + 8, P.y + 5, P.z + 10]; }), await dans(() => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead && e.horsTemps); return [e.pos.x, e.pos.y + 4, e.pos.z]; }), { camille: true, attente: 1200 });

// le dernier combat : jusqu'au tiers de sa vie, puis la porte
for (let k = 0; k < 12 && (await etape()) === 'pont'; k++) { await frapper(); await pause(300); }
await pause(800);
{ const dits = await lire(); console.log('   ', dits.join(' | ').slice(0, 300));
  verifier('la porte s’ouvre ; Eugène la tient', (await etape()) === 'porte' && dits.some((d) => /Je la tiens/.test(d))); }
await filmer(page, nom('porte'), [7, 4, (await dans(() => TLOC.player.pos.z)) + 6], await dans(() => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead && e.horsTemps); return [0, 3, e.pos.z - 10]; }), { camille: true, attente: 1200 });
const z0 = (await phin()).z;
verifier('à la porte, le temps toujours arrêté (le voile gris)', await dans(() => TLOC.G.tempsArrete === true && [...document.querySelectorAll('canvas')].some((c) => /saturate/.test(c.style.filter))), await dans(() => [...document.querySelectorAll('canvas')].map((c) => c.id + ':' + c.style.filter).join(' ; ')));
for (let k = 0; k < 3; k++) { await frapper(); await pause(500); }
// la porte fermée, puis l'épilogue et le générique s'enchaînent : on lit tout, jusqu'à l'accueil
{ let dits = []; for (let k = 0; k < 8 && !/accueil\.html|connexion\.html/.test(page.url()); k++) { dits = dits.concat(await lire(500)); await pause(700); }
  const t = dits.join(' | '); console.log('   ', t.slice(0, 900));
  verifier('trois coups, la porte fermée : Phinaert de l’autre côté', /Je sais/.test(t) && /La porte se ferme/.test(t), `recul depuis ${z0.toFixed(1)}`);
  verifier('l’épilogue : le temps repart, Lydéric, la botte, la phrase, la dernière cloche', /Le temps repart/.test(t) && /long rêve/.test(t) && /la garde l’achève/.test(t) && /dernière cloche/.test(t));
  verifier('le générique', dits.some((d) => /The Legend of Camille/.test(d)) && dits.some((d) => /^Fin$/.test(d))); }
await page.waitForURL(/accueil\.html|connexion\.html/, { timeout: 30000 }).catch(() => {});
verifier('puis l’accueil (ou la connexion, pour un visiteur sans compte)', /accueil\.html|connexion\.html/.test(page.url()), page.url());
const sauve = await dans(() => { try { const k = Object.keys(localStorage).find((k) => /save|sauve|tloc/i.test(k) && /acte7/.test(localStorage.getItem(k))); return k ? JSON.parse(localStorage.getItem(k)) : null; } catch (e) { return String(e); } });
verifier('la sauvegarde reprend : acte7 « fin », le temps reparti', !!sauve && JSON.stringify(sauve).includes('"acte7":"fin"'));

verifier('aucune erreur de page', erreurs.length === 0, erreurs.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
