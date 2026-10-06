// Les portes du Batut qu'on ouvre et qu'on ferme (C8, 6 octobre) : leur nombre, une porte fermée
// arrête Camille qui marche vers elle (walkTo), rouverte elle passe ; une capture fermée, une ouverte.
// En solo (le salon et les bots : bancs/rencontres.mjs, TLOC_ARENE=batut).
//
//   bancs/tour.sh node bancs/multi-portes.mjs
import { navigateur, filmer, DIR, ORIGINE, JOUR } from './acte1-outils.mjs';
import fs from 'fs';

const { b, page, erreurs } = await navigateur();
const pas = [];
const ok = (nom, vrai, detail = '') => { pas.push({ nom, ok: !!vrai, detail }); console.log((vrai ? '✓ ' : '✗ ') + nom + (detail ? ' — ' + detail : '')); };
try {
  await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
  await page.goto(ORIGINE + '/batut.html');
  await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.__batut, null, { timeout: 300000 });
  await page.waitForTimeout(2500);
  const n = await page.evaluate(() => __batut.PORTES.length);
  ok('des vantaux sur les portes des cloisons, dans les deux maisons', n >= 20, n + ' portes');
  // la porte du vestibule vers le salon, au Batut (la première du rez-de-chaussée au plus près du vestibule)
  const d = await page.evaluate(() => { const p = __batut.PORTES.filter((p) => p.y < 1).sort((a, b) => Math.hypot(a.x + 42, a.z - 5) - Math.hypot(b.x + 42, b.z - 5))[0];
    // la normale au mur, en ce point : de part et d'autre de la porte, à 2,5 m
    const c = p.c, ux = c.bx - c.ax, uz = c.bz - c.az, l = Math.hypot(ux, uz);
    return { id: p.id, x: p.x, z: p.z, nx: -uz / l, nz: ux / l }; });
  const marcher = async (de, vers) => { await page.evaluate(([de, vers]) => { const p = TLOC.player; p.pos.set(de[0], 0, de[1]); p.walkTo = { x: vers[0], z: vers[1] }; p.walkSpeed = 4; }, [de, vers]); await page.waitForTimeout(2500);
    return page.evaluate(([vers]) => Math.hypot(TLOC.player.pos.x - vers[0], TLOC.player.pos.z - vers[1]), [vers]); };
  const A = [d.x + d.nx * 2.5, d.z + d.nz * 2.5], B = [d.x - d.nx * 2.5, d.z - d.nz * 2.5];
  ok('ouverte, on passe la porte', (await marcher(A, B)) < 1);
  // fermer, par l'invite (comme un joueur)
  await page.evaluate(([x, z]) => TLOC.player.pos.set(x, 0, z), A);
  const inv = await page.evaluate((id) => { const it = TLOC.interactables.find((i) => /fermer la porte/.test(typeof i.prompt === 'function' ? i.prompt() : '') && Math.hypot(i.pos.x - __batut.PORTES.find((p) => p.id === id).x, i.pos.z - __batut.PORTES.find((p) => p.id === id).z) < 0.1);
    if (!it) return null; it.fn(); return __batut.PORTES.find((p) => p.id === id).ouverte; }, d.id);
  ok('l’invite ferme la porte', inv === false);
  // en face de la porte, à 5 m, à hauteur d'homme ; et où est le vantail (le milieu de sa boîte)
  const cam = [d.x + d.nx * 5, 1.7, d.z + d.nz * 5];
  const ouOuverte = (id) => page.evaluate((id) => { const p = __batut.PORTES.find((p) => p.id === id), bb = new TLOC.THREE.Box3().setFromObject(p.pivot.children[0]), c = bb.getCenter(new TLOC.THREE.Vector3());
    return { ecart: +Math.hypot(c.x - p.x, c.z - p.z).toFixed(2), ouverte: p.ouverte }; }, id);
  const vf = await ouOuverte(d.id);
  ok('fermée, le vantail bouche l’ouverture (son milieu au milieu de la porte)', vf.ecart < 0.3, JSON.stringify(vf));
  await filmer(page, `multi-portes-${JOUR}-fermee.jpg`, cam, [d.x, 1.4, d.z], { camille: true });
  ok('fermée, elle arrête Camille', (await marcher(A, B)) > 3);
  await page.evaluate((id) => TLOC.G.level.porte(id, true), d.id);
  const vo = await ouOuverte(d.id);
  ok('ouverte, le vantail est rabattu (son milieu à plus d’un mètre)', vo.ecart > 1, JSON.stringify(vo));
  await filmer(page, `multi-portes-${JOUR}-ouverte.jpg`, cam, [d.x, 1.4, d.z], { camille: true });
  ok('rouverte, on repasse', (await marcher(A, B)) < 1);
} catch (e) { ok('le banc a planté', false, String(e).split('\n')[0]); }
const vraies = erreurs.filter((e) => !/status of 404/.test(e));
ok('aucune erreur de page', !vraies.length, vraies.slice(0, 5).join(' | '));
fs.writeFileSync(DIR + `multi-portes-${JOUR}.json`, JSON.stringify({ pas, erreurs }, null, 1));
console.log(pas.every((p) => p.ok) ? 'TOUT EST PASSÉ' : `${pas.filter((p) => !p.ok).length} échec(s)`);
await b.close();
