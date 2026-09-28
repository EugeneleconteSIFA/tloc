// Banc « OBJETS FLOTTANTS OU ENTERRÉS » : chaque décor posé repose-t-il sur le sol ?
//
// Un tonneau à vingt centimètres du pavé, une meule à moitié dans la terre : le banc
// arpenteur ne les voit pas (il compare des SOLS). Celui-ci prend les décors UN PAR UN,
// juste avant la fusion des statiques (après, un tonneau n'est plus qu'une poignée de
// triangles dans un grand maillage), et compare le bas de chaque objet au sol sous lui :
//   FLOTTE   le bas est entre 15 cm et 1,2 m au-dessus du sol le plus haut sous l'objet
//            (plus haut, c'est un objet accroché à un mur : enseigne, lanterne, jardinière) ;
//   ENTERRÉ  le bas est de 30 cm à 2 m sous le sol le plus bas, et plus d'un quart de la
//            hauteur de l'objet disparaît (au-delà de 2 m, c'est un étage au-dessus de lui).
// Un « objet » est le plus grand nœud de la scène qui tienne dans 5 × 6 × 5 m ; de 5 à 60 m
// c'est un bâtiment (ses pièces ne sont pas posées au sol), au-delà un conteneur qu'on parcourt. Ce qui bouge (userData.dynamic : personnages, monstres,
// drapeaux, objets à ramasser), les instances (végétation, rues) et les plans posés à plat
// (taches, flaques : moins de 5 cm) sont écartés.
//
//   node bancs/objets.mjs [http://127.0.0.1:8000]
//
// Sortie : bancs/objets-<date>.json et bancs/objets-<date>.png (planche, repère rouge).
import { createRequire } from 'module';
import fs from 'fs';
const ORIGINE = process.argv[2] || 'http://127.0.0.1:8000';
const PW = process.env.TLOC_PLAYWRIGHT || `${process.env.HOME}/Documents/Projet-Padel/package.json`;
const { chromium } = createRequire(PW)('playwright');
const DIR = new URL('.', import.meta.url).pathname, JOUR = new Date().toISOString().slice(0, 10);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => {
  window.__avantFusion = async () => {
    const E = await import('./engine.js?v=27'), THREE = E.THREE, { scene, world } = E;
    const B = new THREE.Box3(), S = new THREE.Vector3(), res = [];
    const nom = (o) => { const l = []; for (let p = o; p && p !== scene && l.length < 3; p = p.parent) l.push(p.name || (p.isMesh ? (p.material && (p.material.userData.ph || p.material.type)) : p.type)); return l.join(' < '); };
    const tester = (o) => {
      B.setFromObject(o); if (B.isEmpty()) return; B.getSize(S);
      if (S.y < 0.05) return;
      // une pièce élancée (lisse de clôture, barreau, tringle) est portée par autre chose : elle
      // « flotte » par construction
      if ([S.x, S.y, S.z].filter((v) => v <= 0.15).length >= 2) return;
      const cx = (B.min.x + B.max.x) / 2, cz = (B.min.z + B.max.z) / 2, y = B.min.y + 0.3;
      let gMax = -Infinity, gMin = Infinity;
      for (const [fx, fz] of [[0, 0], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        const g = E.getH(cx + fx * S.x, cz + fz * S.z, y); gMax = Math.max(gMax, g); gMin = Math.min(gMin, g); }
      const haut = B.min.y - gMax, bas = gMin - B.min.y;
      if (haut > 0.15 && haut < 1.2) res.push({ type: 'FLOTTE', bas: B.min.y, ecart: +haut.toFixed(2), x: +cx.toFixed(1), z: +cz.toFixed(1), y: +gMax.toFixed(2), taille: [S.x, S.y, S.z].map((v) => +v.toFixed(1)), quoi: nom(o), lieu: world.zoneName(cx, cz) });
      // plus de deux mètres « sous le sol » : un étage au-dessus de l'objet (terrasse du donjon,
      // toit des galeries) que le relief rend pour sol — ce n'est pas le sol de l'objet
      // (et pas au-delà de 3 m de haut : piles de pont, culées, soubassements sont FONDÉS sous le sol)
      else if (bas > 0.3 && bas < 2 && bas > S.y * 0.25 && S.y <= 3) res.push({ type: 'ENTERRÉ', bas: B.min.y, ecart: +bas.toFixed(2), x: +cx.toFixed(1), z: +cz.toFixed(1), y: +gMin.toFixed(2), taille: [S.x, S.y, S.z].map((v) => +v.toFixed(1)), quoi: nom(o), lieu: world.zoneName(cx, cz) });
    };
    const visiter = (o) => {
      if (!o.visible || o.userData.dynamic || o.isLight || o.isCamera || o.isSprite || o.isPoints || o.isLine || o.isInstancedMesh || o.isLOD) return;
      if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.transparent) return;
      if (o !== scene) {
        B.setFromObject(o); if (B.isEmpty()) return; B.getSize(S);
        if (S.x <= 5 && S.z <= 5 && S.y <= 6) { tester(o); return; }
        // de 5 à 60 m, c'est un BÂTIMENT (maison, beffroi, pont) : ses pièces sont posées sur
        // lui, pas sur le sol — on ne les teste pas. Au-delà, un conteneur (le bourg, la ville).
        if (Math.max(S.x, S.z) < 60) return;
      }
      for (const c of o.children) visiter(c);
    };
    visiter(scene);
    // L'APPUI. Beaucoup de décors sont posés pièce par pièce dans la scène, sans groupe : le
    // cercle d'un seau, le seau d'un puits, la meule sur son bâti sont testés seuls et
    // « flottent » alors qu'ils reposent sur une autre pièce. Un flottant dont le bas touche
    // (à 15 cm près) le dessus d'un autre maillage placé sous lui est posé : on l'écarte.
    const boites = [], grille = new Map(), cle = (i, j) => i * 100003 + j;
    scene.traverse((o) => { if (!o.isMesh || !o.visible || o.isInstancedMesh) return; const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return;
      const k = boites.push(b) - 1;
      for (let i = Math.floor(b.min.x / 5); i <= Math.floor(b.max.x / 5) && i - Math.floor(b.min.x / 5) < 40; i++)
        for (let j = Math.floor(b.min.z / 5); j <= Math.floor(b.max.z / 5) && j - Math.floor(b.min.z / 5) < 40; j++) { const c = cle(i, j); if (!grille.has(c)) grille.set(c, []); grille.get(c).push(k); } });
    const pose = (r) => { const x0 = r.x - r.taille[0] / 2, x1 = r.x + r.taille[0] / 2, z0 = r.z - r.taille[2] / 2, z1 = r.z + r.taille[2] / 2, bas = r.bas;
      for (const k of grille.get(cle(Math.floor(r.x / 5), Math.floor(r.z / 5))) || []) { const b = boites[k];
        if (b.max.y < bas - 0.15 || b.max.y > bas + 0.3 || b.min.y > bas - 0.02) continue;          // son dessus à hauteur de notre bas
        if (b.max.x < x0 || b.min.x > x1 || b.max.z < z0 || b.min.z > z1) continue;                  // et sous nous
        return true; }
      return false; };
    // une pièce CONTENUE dans la boîte d'un maillage plus gros en fait partie (le cercle de fer
    // d'un tonneau, le pied d'une table) ; et rien de ce qui est sous un tablier de pont
    const C = await import('./carte.js');
    const dedans = (r) => { const x0 = r.x - r.taille[0] / 2, x1 = r.x + r.taille[0] / 2, z0 = r.z - r.taille[2] / 2, z1 = r.z + r.taille[2] / 2, v = r.taille[0] * r.taille[1] * r.taille[2];
      for (const k of grille.get(cle(Math.floor(r.x / 5), Math.floor(r.z / 5))) || []) { const b = boites[k], t = 0.1;
        if ((b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z) <= v * 1.2) continue;
        if (b.min.x - t <= x0 && b.max.x + t >= x1 && b.min.z - t <= z0 && b.max.z + t >= z1 && b.min.y - t <= r.bas && b.max.y + t >= r.bas + r.taille[1]) return true; }
      return false; };
    window.__objets = res.filter((r) => C.surPont(r.x, r.z) === null && !(r.type === 'FLOTTE' && (pose(r) || dedans(r))));
  };
});
await page.goto(ORIGINE + '/index.html');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 300000, polling: 200 });
await page.evaluate(() => { TLOC.state.introSeen = true; TLOC.menu.items[0].fn(); });
await page.waitForTimeout(2500);
const objets = await page.evaluate(() => window.__objets || []);
objets.sort((a, b) => b.ecart - a.ecart);
const par = (t) => objets.filter((o) => o.type === t);
console.log(`objets : ${par('FLOTTE').length} flottent, ${par('ENTERRÉ').length} sont enterrés`);
for (const o of objets.slice(0, 40)) console.log(`  ${o.type.padEnd(8)} ${String(o.ecart).padStart(5)} m  ${o.lieu}  (${o.x}, ${o.z})  ${o.taille.join('×')}  ${o.quoi}`);
fs.writeFileSync(DIR + `objets-${JOUR}.json`, JSON.stringify(objets, null, 1));

// la planche : un exemple par famille (lieu × ce que c'est), les familles les plus nombreuses
// d'abord — c'est à l'œil qu'on juge si toute une famille est fautive ou voulue
const familles = new Map();
for (const o of objets) { const k = o.type + '|' + o.lieu + '|' + o.quoi; if (!familles.has(k)) familles.set(k, { o, n: 0 }); familles.get(k).n++; }
const exemples = [...familles.values()].sort((a, b) => b.n - a.n).slice(0, 12).map((f) => ({ ...f.o, n: f.n }));
console.log('— familles :'); for (const e of exemples) console.log(`  ${String(e.n).padStart(4)} × ${e.type} ${e.lieu} — ${e.quoi} (${e.x}, ${e.z})`);
const photos = [];
for (const [k, o] of exemples.entries()) {
  await page.evaluate(async (o) => { const E = await import('./engine.js?v=27');
    if (!window.__repere) { window.__repere = new E.THREE.Mesh(new E.THREE.SphereGeometry(0.12, 12, 8), new E.THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false })); window.__repere.renderOrder = 999; E.scene.add(window.__repere); }
    window.__repere.position.set(o.x, o.y, o.z);
    const d = Math.max(2.5, Math.max(...o.taille) * 1.8);
    E.G.freeCam = { pos: { x: o.x + d * 0.8, y: o.y + d * 0.45, z: o.z + d * 0.6 }, at: { x: o.x, y: o.y + o.taille[1] / 3, z: o.z } };
    for (const id of ['overlay', 'hud']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } }, o);
  await page.waitForTimeout(1200);
  const f = DIR + `.objets-${k}.png`; await page.screenshot({ path: f }); photos.push(f);
}
await browser.close();
if (photos.length) {
  fs.writeFileSync(DIR + '.objets-legendes.json', JSON.stringify(exemples.map((o, k) => `${k + 1}. ${o.n} × ${o.type} ${o.ecart} m — ${o.lieu}`)));
  const { execSync } = await import('child_process');
  execSync(`python3 - <<'PY'
from PIL import Image, ImageDraw, ImageFont
import json, os
L = json.load(open('${DIR}.objets-legendes.json'))
ims = [Image.open('${DIR}.objets-%d.png' % k).resize((427, 240)) for k in range(len(L))]
p = Image.new('RGB', (427 * 3, 262 * ((len(ims) + 2) // 3)), (10, 14, 23)); d = ImageDraw.Draw(p)
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
except Exception: F = ImageFont.load_default()
for k, im in enumerate(ims):
    x, y = (k % 3) * 427, (k // 3) * 262; p.paste(im, (x, y)); d.text((x + 6, y + 243), L[k], fill=(255, 231, 163), font=F)
    os.remove('${DIR}.objets-%d.png' % k)
p.save('${DIR}objets-${JOUR}.png')
os.remove('${DIR}.objets-legendes.json')
PY`);
  console.log(`planche : bancs/objets-${JOUR}.png`);
}
