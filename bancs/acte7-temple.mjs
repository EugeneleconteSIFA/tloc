// Banc de l'acte VII, lot 1 : la cloche volée à la forge de Cornil (rive.js), le Temple de la fin (temple.js) —
// Phinaert, Eugène, toutes les cloches, le temps arrêté (engine.js, arreterTemps) ; les blessures effacées ; le
// gong de Nok près du mage, l'épée de Lydéric ; Phinaert blessé pour de bon, enfui par la porte du Midi.
// La partie est posée à la fin de l'acte VI (`acte6: 'cloche'`, la Grande Cloche fondue).
//
//   bancs/tour.sh node bancs/acte7-temple.mjs
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const nom = (n) => `acte7-temple-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const pret = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });
async function lire() { const dits = [];
  for (let k = 0; k < 40; k++) { const r = await dans(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say; T.cutAdvance(true); return s || ''; });
    if (r === null) break; if (r) dits.push(r); await pause(250); }
  return dits; }
const etape = () => dans(() => TLOC.state.acte7);
const message = () => dans(() => document.getElementById('msg')?.textContent || '');
const DONS = { acte5: 'course', troupeauxVu: true, force: true, souffle: true, elan: true, course: true, lasso: true, sword: true, gongThai: true,
  pont6: true, marches6: 3, bande6: true, vers6: true, grandeCloche: true, acte6: 'cloche', acte2: 'pluie', clocheIles: true, acte4: 'temple', templeVu: true, midiVu: true, ilesVu: true };

// ---------- la forge vide ----------
await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/temple.html'); await pret(); await pause(3000); await lire();
await dans((d) => { Object.assign(TLOC.state, d); TLOC.player.maxHp = TLOC.player.hp = 24; TLOC.saveGame(true); }, DONS);
await parler(page, 'fêlure'); await lire();
await page.waitForURL(/rive\.html/, { timeout: 60000 }).catch(() => {}); await pret(); await pause(3000); await lire();
const L = await dans(() => window.__rive);
{ const r = await parler(page, 'parler', { avant: [L.FORGE.x + 1.5, L.FORGE.z + 8] }); await pause(2500); const dits = await lire(); console.log('   ', dits.join(' | ').slice(0, 260));
  verifier('la cloche volée : Cornil, le garçon, le Temple', (await etape()) === 'volee' && /garçon/.test(dits.join()) && /Temple/.test(dits.join()));
  verifier('la forge sans sa cloche', await dans(() => !window.__rive.R.cloche.visible)); }
await filmer(page, nom('forge-vide'), [L.FORGE.x + 11, 2.5, L.FORGE.z + 11], [L.FORGE.x + 7, 1.2, L.FORGE.z + 6]);

// ---------- le Temple, le temps arrêté ----------
await parler(page, 'repasser la fêlure'); await pause(500);
await page.waitForURL(/temple\.html/, { timeout: 60000 }).catch(() => {});
const t0 = Date.now(); await pret(); console.log('    chargement de temple.html :', ((Date.now() - t0) / 1000).toFixed(1), 's'); await pause(3500);
{ const dits = await lire(); console.log('   ', dits.join(' | ').slice(0, 400));
  verifier('la scène : Eugène, la main sur la cloche, « Tu bouges encore ? »', /Il ne fallait pas venir/.test(dits.join()) && /Tu bouges encore/.test(dits.join()));
  verifier('le temps arrêté, l’étape « arret »', (await etape()) === 'arret' && await dans(() => TLOC.G.tempsArrete === true)); }
await pause(1500);
verifier('Phinaert, dans la cour, hors du temps', await dans(() => TLOC.enemies.some((e) => e.kind === 'phinaert' && !e.dead && e.horsTemps)));
// rien ne bouge sauf Camille : la pose du mage, à une seconde d'écart
{ const pose = () => dans(() => { let s = 0; const cam = []; TLOC.player.mesh.traverse((o) => cam.push(o));   // (Camille bouge, elle : on la laisse de côté)
    TLOC.scene.traverse((o) => { if (o.isBone && o.name === 'hand_r' && !cam.includes(o)) s += o.getWorldPosition(new TLOC.THREE.Vector3()).y; }); return s; });
  const a = await pose(); await pause(1000); const c = await pose(); verifier('le mage et Eugène figés', Math.abs(a - c) < 1e-4, `${a.toFixed(4)} ${c.toFixed(4)}`); }
await filmer(page, nom('arret'), [-7, 4, 29], [0, 3, 17], { attente: 1000 });

// ---------- les blessures effacées ----------
const frapper = () => dans(() => { const e = TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead); TLOC.hitEnemy(e, 3, e.pos.x + 1, e.pos.z); return e.hp; });
const vie = () => dans(() => TLOC.enemies.find((e) => e.kind === 'phinaert' && !e.dead)?.hp);
const v0 = await vie();
for (let k = 0; k < 3; k++) { await frapper(); await pause(1300); }
await lire();
verifier('trois coups effacés : la vie revient', (await vie()) === v0, `${v0} → ${await vie()}`);
verifier('l’indice du gong', /gong/i.test(await dans(() => document.getElementById('counts')?.textContent || '')));

// ---------- le gong, l'épée de Lydéric ----------
{ const r = await parler(page, 'frapper le gong'); const dits = (r ? r.repliques : []).join(' | ') + (await lire()).join(' | '); console.log('   ', dits.slice(0, 260));
  verifier('le mage : « Elle était à lui. Elle est à toi. »', /Elle était à lui/.test(dits) && (await etape()) === 'epee' && await dans(() => TLOC.state.epeeLyderic === true)); }
await pause(800);
verifier('la lame de Lydéric, teinte', await dans(() => { let n = 0; TLOC.scene.traverse((o) => { if (o.isMesh && o.userData.lame && o.material.emissive && o.material.emissive.getHex() === 0x3a5aa8) n++; }); return n > 0; }));
const v1 = await vie(); await frapper(); await pause(1300);
verifier('l’épée de Lydéric : le coup reste', (await vie()) < v1, `${v1} → ${await vie()}`);
for (let k = 0; k < 6 && (await etape()) !== 'mondes'; k++) { await frapper(); await pause(400); }
await pause(800); await lire();
verifier('Phinaert enfui par la porte du Midi', (await etape()) === 'mondes' && await dans(() => !TLOC.enemies.some((e) => e.kind === 'phinaert' && !e.dead)));

verifier('aucune erreur de page', erreurs.length === 0, erreurs.slice(0, 3).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
