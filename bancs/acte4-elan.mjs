// Banc de l'élan du Colosse (engine.js : sauter EN COURANT, l'élan acquis, donne le grand saut) et
// de l'oliveraie replacée (alberobello.js). Le même saut en courant, sans puis avec `state.elan` :
// la distance et la hauteur mesurées sur la trajectoire de Camille. Aucune pageerror.
//
//   bancs/tour.sh node bancs/acte4-elan.mjs
import { navigateur, partieActe1, filmer, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
const charge = () => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC && TLOC.state.running, null, { timeout: 300000, polling: 300 });
const passerCut = async () => { for (let k = 0; k < 30; k++) { const r = await page.evaluate(() => { if (!TLOC.cut.active) return null; TLOC.cutAdvance(true); return 1; }); if (r === null) break; await page.waitForTimeout(120); } };

// Un saut en courant sur un terrain libre : on court une seconde (avant + arrière ensemble), on
// saute, et l'on relève la trajectoire image par image jusqu'à l'atterrissage.
async function sauter(elan, depart) {
  await page.evaluate(([elan, [x, z, yaw]]) => { const T = TLOC; T.state.elan = elan; T.player.pos.set(x, T.getH(x, z), z); T.player.yaw = yaw; T.G.camYaw = yaw; T.player.walkTo = null; }, [elan, depart]);
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyS'); await page.waitForTimeout(1200);
  const r = await page.evaluate(() => new Promise((fin) => { const p = TLOC.player, x0 = p.pos.x, z0 = p.pos.z, y0 = p.pos.y; let haut = 0, parti = false;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    const suivre = () => { haut = Math.max(haut, p.pos.y - y0); if (!p.onGround) parti = true;
      if (parti && p.onGround) { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })); fin({ d: Math.hypot(p.pos.x - x0, p.pos.z - z0), h: haut }); } else requestAnimationFrame(suivre); };
    requestAnimationFrame(suivre); setTimeout(() => fin({ d: -1, h: haut }), 4000); }));
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyS');
  return r;
}

try {
  await partieActe1(page, { acte1: 'temple', templeVu: true, acte4: 'temple', tambourin: true, elan: false });
  await page.goto(ORIGINE + '/alberobello.html'); await charge(); await page.waitForTimeout(3000); await passerCut();
  // une longue ligne libre : la place de l'oliveraie, une fois cherchée (après le chargement)
  await page.waitForFunction(() => window.__alberobello && __alberobello.OLIVES.grappes.length, null, { timeout: 40000 }).catch(() => {});
  const ligne = await page.evaluate(() => { const L = TLOC.G.level;
    // une droite de 16 m sans obstacle et presque plate, cherchée autour de l'arrivée
    for (let r = 0; r < 60; r += 3) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = 6.8 + Math.cos(a) * r, z = 1.4 + Math.sin(a) * r;
      for (let j = 0; j < 8; j++) { const yaw = j / 8 * Math.PI * 2; let libre = true;
        for (let s = 0; s <= 16 && libre; s += 0.5) { const px = x + Math.sin(yaw) * s, pz = z + Math.cos(yaw) * s; if (L.blocked(px, pz, 0.7) || Math.abs(TLOC.getH(px, pz) - TLOC.getH(x, z)) > 0.4) libre = false; }
        if (libre) return [x, z, yaw]; } }
    return null; });
  ok('une ligne libre de 16 m pour sauter', ligne);
  const sans = await sauter(false, ligne), avec = await sauter(true, ligne);
  ok('sans l’élan : un saut ordinaire', sans.d > 0, `${sans.d.toFixed(2)} m, ${sans.h.toFixed(2)} m de haut`);
  ok('avec l’élan : le grand saut, nettement plus loin et plus haut', avec.d > sans.d * 1.4 && avec.h > sans.h * 1.3, `${avec.d.toFixed(2)} m, ${avec.h.toFixed(2)} m de haut`);
  ok('l’aide le dit', await page.evaluate(() => /grand saut/.test(document.getElementById('legend')?.textContent || '')));
  // l'oliveraie : trois oliviers, aucun dans un mur
  const ol = await page.evaluate(() => { const A = __alberobello.OLIVES, L = TLOC.G.level; return { n: A.grappes.length, place: A.place }; });
  ok('l’oliveraie : trois oliviers (six grappes)', ol.n === 6, ol.n + ' grappes');
  const ar = await page.evaluate(() => __alberobello.OLIVES.arbres.map(([x, z]) => [x, z, TLOC.G.level.blocked(x, z, 1.5)]));
  ok('l’oliveraie : aucun olivier dans un mur', ar.length === 3 && ar.every((a) => !a[2]), JSON.stringify(ar.map((a) => a.map((v) => (typeof v === 'number' ? +v.toFixed(1) : v)))));
  // à la verticale du milieu des trois arbres : de biais, la caméra tombait sur les toits voisins
  const cx = ar.reduce((s, a) => s + a[0], 0) / ar.length, cz = ar.reduce((s, a) => s + a[1], 0) / ar.length, cy = await page.evaluate(([x, z]) => TLOC.getH(x, z), [cx, cz]);
  await filmer(page, `acte4-elan-${JOUR}-oliveraie.jpg`, [cx + 0.5, cy + 22, cz + 4], [cx, cy, cz]);
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `acte4-elan-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
