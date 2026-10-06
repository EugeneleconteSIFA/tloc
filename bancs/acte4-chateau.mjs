// Banc de l'acte IV, lot 3 (docs/DECOUPAGE-ACTE4.md, étape 9) : le château Tramontano de Matera.
// Les portes à rythme (un raté, puis la pizzica dans le silence), la tour sud (le plancher qui tombe
// en ruine : on le traverse à pied sans tambourin et l'on est rejetée, puis figé neuf au tambourin),
// la tour nord (la porte murée : figée en ruine), les deux leviers, le donjon, son sommet, la dalle
// de la cour — Camille marche (walkTo), elle n'est pas posée de l'autre côté. Captures par moment clé.
//
//   bancs/tour.sh node bancs/acte4-chateau.mjs
import { navigateur, partieActe1, parler, filmer, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
const charge = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000, polling: 300 });
const passerCut = async () => { const lu = []; for (let k = 0; k < 30; k++) { const r = await page.evaluate(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? c.say : ''; T.cutAdvance(true); return s; }); if (r === null) break; if (r) lu.push(r); await page.waitForTimeout(120); } return lu; };
const K = () => page.keyboard.press('KeyK');
// une place dans une tour, à `s` mètres de son centre le long de l'axe de la porte (+ vers la porte)
const dansTour = (i, s) => page.evaluate(([i, s]) => { const T = __matera.TOURS[i]; return [T.x + T.ux * s, T.z + T.uz * s, T.yf]; }, [i, s]);
const poser = ([x, z, y]) => page.evaluate(([x, z, y]) => { TLOC.player.pos.set(x, y, z); TLOC.player.walkTo = null; }, [x, z, y]);
const marcher = async ([x, z], ms = 2600) => { await page.evaluate(([x, z]) => { TLOC.player.walkTo = { x, z }; TLOC.player.walkSpeed = 4.5; }, [x, z]); await page.waitForTimeout(ms); };
const axe = (i) => page.evaluate((i) => { const T = __matera.TOURS[i], p = TLOC.player.pos; return (p.x - T.x) * T.ux + (p.z - T.z) * T.uz; }, i);
const attendre = (f, arg) => page.waitForFunction(f, arg, { timeout: 15000, polling: 30 }).catch(() => {});
// devant une porte, la pizzica : un coup, puis un coup dans le silence (2,1 à 3,0 s après)
async function pizzica(i, ecart = 2500) {
  await page.evaluate((i) => { const d = __matera.portes[i]; TLOC.player.pos.set(d.x, d.y, d.z); }, i);
  await page.waitForTimeout(300); await K(); await page.waitForTimeout(ecart); await K(); await page.waitForTimeout(500);
  return page.evaluate((i) => !!(TLOC.state.portes4 && TLOC.state.portes4[i]), i);
}

try {
  await partieActe1(page, { acte1: 'temple', templeVu: true, bow: true, lanterne: true, acte4: 'tambourin', lettre4: 'lettre', tambourin: true, corde4: true, portes4: undefined, levier4: undefined,
    ind4: { soleil: true, grandpere: true, ticket: true, mot: true, apprenti: true, chateau: true, rythme: true, joueuse: true, tarentules: true } });
  await page.goto(ORIGINE + '/matera.html'); await charge(); await page.waitForTimeout(3000); await passerCut();
  await page.waitForFunction(() => window.__matera && __matera.portes && __matera.TOURS[0].salle, null, { timeout: 30000 }).catch(() => {});
  // les portes à rythme
  ok('9. trop tôt dans la mesure : la porte reste fermée', !(await pizzica(0, 1500)));
  await page.waitForTimeout(3000);
  ok('9. la pizzica dans le silence : la porte sud s’ouvre', await pizzica(0));
  const d0 = await page.evaluate(() => { const d = __matera.portes[0]; return [d.x, d.y, d.z, d.yaw]; });
  await filmer(page, `acte4-chateau-${JOUR}-porte-ouverte.jpg`, [d0[0] + Math.sin(d0[3]) * 13, d0[1] + 4, d0[2] + Math.cos(d0[3]) * 13], [d0[0], d0[1] + 1.5, d0[2]], { camille: true });
  ok('9. le donjon n’écoute pas sans les leviers', !(await pizzica(1)));
  // tour sud : sans tambourin, le plancher en ruine rejette Camille à la porte
  await page.waitForTimeout(3000);
  const T0 = await page.evaluate(() => __matera.TOURS[0].rin);
  await poser(await dansTour(0, 3.4)); await page.waitForTimeout(400);
  ok('9. dans la salle : le sol de la salle', await page.evaluate(() => { const T = __matera.TOURS[0]; return Math.abs(TLOC.getH(TLOC.player.pos.x, TLOC.player.pos.z) - T.yf) < 0.05; }));
  await filmer(page, `acte4-chateau-${JOUR}-salle-sud.jpg`, ...(await page.evaluate(() => { const T = __matera.TOURS[0]; return [[T.x + T.ux * (T.rin - 0.8), T.yf + 3.2, T.z + T.uz * (T.rin - 0.8)], [T.x - T.ux * 3, T.yf, T.z - T.uz * 3]]; })), { camille: true });
  // on attend que le plancher soit en ruine, puis on traverse
  await attendre(() => !__matera.neuve(0));
  const loin = await dansTour(0, -(T0 - 1.2)); await marcher(loin, 2400);
  ok('9. sans tambourin, le plancher en ruine rejette Camille à la porte', (await axe(0)) > T0 - 2, 'axe ' + (await axe(0)).toFixed(1));
  // au tambourin, figé neuf : on traverse
  await poser(await dansTour(0, 3.4)); await page.waitForTimeout(3000);
  await attendre(() => __matera.neuve(0)); await K();
  await marcher(loin, 2600);
  ok('9. au tambourin, le plancher figé neuf : on traverse', (await axe(0)) < -2, 'axe ' + (await axe(0)).toFixed(1));
  await filmer(page, `acte4-chateau-${JOUR}-plancher.jpg`, ...(await page.evaluate(() => { const T = __matera.TOURS[0]; return [[T.x - T.ux * (T.rin - 1), T.yf + 3, T.z - T.uz * (T.rin - 1)], [T.x + T.ux * 2, T.yf, T.z + T.uz * 2]]; })), { camille: true });
  await parler(page, 'baisser le levier');
  ok('9. le levier de la tour sud', await page.evaluate(() => TLOC.state.levier4 && TLOC.state.levier4[0]));
  // tour nord : la porte murée, figée en ruine
  await page.waitForTimeout(3000);
  ok('9. la porte nord s’ouvre au rythme', await pizzica(2));
  const T2 = await page.evaluate(() => __matera.TOURS[2].rin), loin2 = await dansTour(2, -(T2 - 1.2));
  await poser(await dansTour(2, 2.5)); await page.waitForTimeout(400);
  await attendre(() => __matera.neuve(2)); await marcher(loin2, 1500);
  ok('9. murée, la salle ne laisse pas passer', (await axe(2)) > 0.5, 'axe ' + (await axe(2)).toFixed(1));
  await page.waitForTimeout(3000);
  await attendre(() => !__matera.neuve(2)); await K();
  // filmée tout de suite : la salle est figée en ruine huit secondes, la brèche ouverte
  await filmer(page, `acte4-chateau-${JOUR}-breche.jpg`, ...(await page.evaluate(() => { const T = __matera.TOURS[2]; return [[T.x + T.ux * (T.rin - 1), T.yf + 2.6, T.z + T.uz * (T.rin - 1)], [T.x - T.ux * 3, T.yf + 1, T.z - T.uz * 3]]; })), { camille: true, attente: 500 });
  await marcher(loin2, 2600);
  ok('9. au tambourin, figée en ruine : la brèche', (await axe(2)) < -2, 'axe ' + (await axe(2)).toFixed(1));
  await parler(page, 'baisser le levier');
  ok('9. les deux leviers', await page.evaluate(() => TLOC.state.levier4[0] && TLOC.state.levier4[2]));
  await page.waitForTimeout(3000);
  ok('9. le donjon s’ouvre au rythme', await pizzica(1));
  const so = await parler(page, 'sommet du donjon');
  ok('9. le sommet : le Colosse', so && so.repliques.some((r) => /Colosse/.test(r)) && await page.evaluate(() => TLOC.state.acte4 === 'chateau'), so && so.repliques.join(' | '));
  // la dalle de la cour : atteinte à pied depuis l'arrivée, puis lue
  const cour = await page.evaluate(() => { const L = TLOC.G.level, C = __matera.COUR, k = (x, z) => x + ',' + z, vu = new Set(['-40,20']), f = [[-40, 20]];
    while (f.length && vu.size < 200000) { const [x, z] = f.shift(); if (Math.hypot(x - C.x, z - C.z) < 2.5) return true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (vu.has(k(nx, nz)) || L.blocked(nx, nz, 0.5) || Math.abs(TLOC.getH(nx, nz) - TLOC.getH(x, z)) > 0.5) continue; vu.add(k(nx, nz)); f.push([nx, nz]); } }
    return false; });
  ok('9. la cour du château s’atteint à pied depuis l’arrivée', cour);
  const da = await parler(page, 'dalle gravée');
  ok('9. la dalle : le vers de l’acte IV', da && da.repliques.some((r) => /Chaque heure sauvée/.test(r)), da && da.repliques.join(' | '));
  const C = await page.evaluate(() => [__matera.COUR.x, TLOC.getH(__matera.COUR.x, __matera.COUR.z), __matera.COUR.z]);
  await filmer(page, `acte4-chateau-${JOUR}-cour.jpg`, [C[0] + 14, C[1] + 9, C[2] + 10], [C[0], C[1], C[2]]);
  await filmer(page, `acte4-chateau-${JOUR}-vue.jpg`, [-380, 60, 300], [-455, 10, 318]);
  ok('l’objectif : le Colosse', /Colosse|dalle/.test(await page.evaluate(() => TLOC.G.level.objective())));
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `acte4-chateau-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
