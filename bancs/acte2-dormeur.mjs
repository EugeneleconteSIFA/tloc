// Banc de l'acte II, lot C (docs/DECOUPAGE-ACTE2.md, étapes 6 à 8) : l'aïeule et les deux maîtres
// à sa table, la faille murée qu'une bombe ouvre, la cave du Dormeur, Jacques et ses hommes, les
// trois veines et les trois coups au cœur, Phinaert qui regarde, la force, la Cloche du Midi, le
// bloc poussé, la pluie dehors, le repas au Pouget — dans une seule partie posée à « familles ».
//
//   bancs/tour.sh node bancs/acte2-dormeur.mjs [étiquette]
import { navigateur, parler, filmer, JOUR, ORIGINE } from './acte1-outils.mjs';
const ETIQ = process.argv[2] || 'c';
const nom = (n) => `acte2-dormeur-${ETIQ}-${JOUR}-${n}.jpg`;
const { b, page, erreurs } = await navigateur();
let favicons = 0;
page.on('console', (m) => { if (m.type() === 'error' && /Failed to load/.test(m.text())) { if (/favicon\.ico/.test(m.location().url)) favicons++; else console.log('    absent :', m.location().url); } });
let ok = true;
const verifier = (quoi, c, info = '') => { console.log(c ? 'ok  ' : 'RATÉ', quoi, info); if (!c) ok = false; };
const dans = (fn, ...a) => page.evaluate(fn, ...a);
const pause = (ms) => page.waitForTimeout(ms);
const etape = () => dans(() => TLOC.state.acte2);
const texte = (r) => (r ? r.repliques.join(' | ') : '');
const finirDialogues = async () => { for (let k = 0; k < 60; k++) { const a = await dans(() => { const T = TLOC; if (!T.cut.active) return false; T.cutAdvance(true); return true; }); if (!a) return; await pause(80); } };

await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
erreurs.length = 0;
await page.goto(ORIGINE + '/aveyron.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && window.__acte2, null, { timeout: 300000, polling: 300 });
await pause(4000); await finirDialogues();
await dans(() => { const T = TLOC; Object.assign(T.state, { acte2: 'familles', bombes: true, nbBombes: 10, lanterne: true, colliers: true,
  ind2: { maitre: true, cave: true, etoile: true, jacques: true, piste: true, vu_batut: true, vu_beauregard: true } }); T.state.sword = true; T.player.maxHp = T.player.hp = 60; T.saveGame(true); });
await pause(600);

async function abattre(get) {
  for (let k = 0; k < 90; k++) {
    const fini = await dans((get) => { const T = TLOC, en = eval(get); if (!en || en.dead) return true;
      const p = T.player.pos, d = Math.hypot(p.x - en.pos.x, p.z - en.pos.z) || 1; if (d > 1.6) { const x = en.pos.x + (p.x - en.pos.x) / d * 1.3, z = en.pos.z + (p.z - en.pos.z) / d * 1.3; p.set(x, en.pos.y, z); }
      T.player.yaw = Math.atan2(en.pos.x - p.x, en.pos.z - p.z); T.player.hp = T.player.maxHp; T.player.attackCd = 0; T.player.attackT = 0; T.player.hitSet.clear(); return false; }, get);
    if (fini) return true; await pause(350); await finirDialogues();
  }
  return false;
}

// 1. chez l'aïeule : le Dormeur, la faille ; les deux maîtres à sa table
{ const r = await parler(page, 'parler à l’aïeule'); console.log('   ', texte(r).slice(0, 200));
  verifier('l’aïeule parle du Dormeur et de la faille', /Dormeur/.test(texte(r)) && /faille au bout du barrage/.test(texte(r)));
  const n = await dans(() => (window.__acte2.convives || []).filter(Boolean).length); verifier('les deux maîtres à la table du Pouget', n === 2, `${n} convives`);
  const a = await dans(() => window.__acte2.aieule); if (a) await filmer(page, nom('table'), [a[0] + 3, a[1] + 2, a[2] + 3], [a[0], a[1] + 1, a[2]], { camille: true }); }

// 2. la faille, murée ; une bombe l'ouvre
{ const F = await dans(() => { const F = window.__acte2.faille; return F ? [F.x, F.y, F.z] : null; }); verifier('la faille est posée', !!F, F ? F.map((v) => v.toFixed(0)).join(' ; ') : '');
  await filmer(page, nom('faille'), [F[0] + 4, F[1] + 2.2, F[2] + 9], [F[0], F[1] + 2, F[2] - 1]);
  await parler(page, 'la faille', { avant: [F[0], F[2] + 5] });
  await dans(([x, z]) => { const T = TLOC; T.player.pos.set(x, T.getH(x, z + 5), z + 5); }, [F[0], F[2]]); await pause(2400);
  verifier('la bombe a ouvert la faille', await dans(() => !!TLOC.state.ind2.faille && !window.__acte2.faille.mur.visible)); }

// 3. la cave du Dormeur ; Jacques et ses hommes
{ await parler(page, 'entrer dans la faille'); await pause(800);
  const c = await dans(() => ({ ou: window.__acte2.salle && window.__acte2.salle.cle, y: TLOC.player.pos.y, e: TLOC.state.acte2, n: (window.__acte2.bande || []).length }));
  verifier('dans la cave du Dormeur', c.ou === 'dormeur' && c.y > 590 && c.e === 'dormeur', JSON.stringify(c));
  const S = await dans(() => { const S = window.__acte2.caveDormeur; return [S.x, S.y, S.z]; });
  await filmer(page, nom('galerie'), [S[0] + 3, S[1] + 2, S[2] + 15], [S[0], S[1] + 1.5, S[2] + 3], { camille: true });
  await dans(([x, y, z]) => TLOC.player.pos.set(x, y, z + 8), S); await pause(500);
  const dit = await dans(() => TLOC.cut.active ? TLOC.cut.cur && TLOC.cut.cur.say : '');
  verifier('Jacques parle au seuil de la grande salle', /imbéciles/.test(dit || ''));
  await finirDialogues();
  for (const i of [0, 1, 2]) verifier(`la bande, ${i === 2 ? 'Jacques' : 'un brigand'} à terre`, await abattre(`window.__acte2.bande[${i}]`)); }

// 4. les trois veines et les trois coups
{ const S = await dans(() => { const S = window.__acte2.caveDormeur; return [S.x, S.y, S.z]; });
  await filmer(page, nom('coeur'), [S[0] + 4, S[1] + 3, S[2] - 5], [S[0], S[1] + 2, S[2] - 12.5], { camille: true });
  for (let v = 0; v < 3; v++) {
    const r = await parler(page, 'poser une bombe contre la veine');
    await dans(([x, y, z]) => { const T = TLOC; T.player.pos.set(x + 2.6, y, z - 9.5); }, S); await pause(2200); await finirDialogues();
    const ouvert = await dans(() => window.__acte2.coeurOuvert); verifier(`veine ${v + 1} : le cœur à nu`, !!r && ouvert);
    await dans(([x, y, z]) => { const T = TLOC; T.player.pos.set(x, y, z - 10.2); T.player.yaw = Math.PI; T.player.attackCd = 0; T.player.attackT = 0.01; }, S); await pause(500);
    const coups = await dans(() => window.__acte2.coups || 0); verifier(`coup ${v + 1} au cœur`, coups === v + 1);
    await dans(() => { TLOC.player.attackT = -1; }); await pause(300);
  }
  await pause(800);
  verifier('Phinaert regarde, Camille figée', await dans(() => window.__acte2.ombre.visible && TLOC.player.speed === 0));
  await filmer(page, nom('phinaert'), [S[0] - 3, S[1] + 2.5, S[2] - 7], [S[0] + 2.5, S[1] + 2, S[2] - 16], { camille: true, attente: 600 });
  await pause(2000);
  const r = await dans(() => TLOC.cut.active ? TLOC.cut.cur && TLOC.cut.cur.say : ''); verifier('Jacques à terre : « t’avais du travail »', /du travail/.test(r || ''));
  await finirDialogues(); await pause(2500);
  const f = await dans(() => ({ e: TLOC.state.acte2, force: TLOC.state.force, cloche: window.__acte2.cloche.visible, vers: window.__acte2.vers.visible }));
  verifier('la force, la Cloche du Midi, le deuxième vers', f.e === 'pluie' && f.force && f.cloche && f.vers, JSON.stringify(f));
  await filmer(page, nom('cloche'), [S[0] - 2, S[1] + 2.5, S[2] - 9], [S[0], S[1] + 1.8, S[2] - 15.5], { camille: true }); }

// 5. le bloc devant la sortie, poussé avec la force ; dehors, la pluie
{ const S = await dans(() => { const S = window.__acte2.caveDormeur; return [S.x, S.y, S.z]; });
  const r = await parler(page, 'pousser le bloc'); await pause(2500);
  verifier('le bloc glisse : la sortie est libre', !!r && await dans(() => !window.__acte2.blocLa));
  await parler(page, 'remonter vers la faille'); await pause(1500);
  const d = await dans(() => ({ dehors: !window.__acte2.salle, pluie: !!window.__acte2.gouttes, y: TLOC.player.pos.y }));
  verifier('dehors, il pleut', d.dehors && d.pluie && d.y < 300, JSON.stringify(d));
  await filmer(page, nom('pluie-lac'), [-180, 30, -40], [0, 0, 60], { attente: 2500 });
  await filmer(page, nom('pluie-camille'), [d.y, 0, 0].length && (await dans(() => [TLOC.player.pos.x + 4, TLOC.player.pos.y + 2.5, TLOC.player.pos.z + 5])), await dans(() => [TLOC.player.pos.x, TLOC.player.pos.y + 1, TLOC.player.pos.z]), { camille: true, attente: 1500 }); }

// 6. le repas au Pouget
{ await pause(300);
  const n = await dans(() => (window.__acte2.convives || []).filter(Boolean).length); verifier('le repas : tous les Roquette à la table', n === 5, `${n} convives`);
  const r = await parler(page, 'parler à l’aïeule'); verifier('l’aïeule : « finis-le »', /finis-le/.test(texte(r)));
  const a = await dans(() => window.__acte2.aieule); if (a) await filmer(page, nom('repas'), [a[0] + 3.5, a[1] + 2.2, a[2] + 3.5], [a[0], a[1] + 1, a[2]], { camille: true }); }

// (le favicon.ico manque au site entier : ce n'est pas du lac — on le dit, on ne le compte pas)
verifier('aucune erreur de page', erreurs.length === favicons, erreurs.slice(0, 5).join(' / '));
await b.close();
console.log(ok ? 'BANC RÉUSSI' : 'BANC RATÉ');
process.exit(ok ? 0 : 1);
