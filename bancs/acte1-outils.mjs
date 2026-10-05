// Outils communs aux bancs de l'acte I (bancs/acte1-*.mjs) : ouvrir une partie dont le
// prologue est joué, poser l'état de départ, parler à quelqu'un, filmer un endroit.
//
// Pourquoi un module à part : chaque morceau de l'acte (le bourg, la pêche, la nuit…) se teste
// seul, sans rejouer les autres (PLAN-2026-10-05-ACTE1.md, début commun) ; les trois sessions
// de l'acte I ont besoin des mêmes gestes, écrits une fois.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
// sur le PC, Playwright est dans GitHub/tloc/outils (5 octobre) ; sur le Mac, dans Projet-Padel
const PW = process.env.TLOC_PLAYWRIGHT || [`${os.homedir()}/Documents/Projet-Padel/package.json`, `${os.homedir()}/Documents/GitHub/tloc/outils/package.json`].find((f) => fs.existsSync(f));
const { chromium } = createRequire(PW)('playwright');
export const DIR = fileURLToPath(new URL('resultats/', import.meta.url));
export const ORIGINE = process.env.ORIGINE || 'http://127.0.0.1:8000';
export const JOUR = new Date().toISOString().slice(0, 10);

// Chrome sans tête, une page, les erreurs relevées (le banc échoue s'il y en a)
export async function navigateur() {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: [`--use-angle=${process.platform === 'darwin' ? 'metal' : 'd3d11'}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push('PAGEERROR ' + String(e).split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console.error ' + m.text().slice(0, 200)); });
  return { b, page, erreurs };
}
const charge = (page) => page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden') && window.TLOC, null, { timeout: 300000, polling: 300 });

// Une partie neuve, le prologue passé (« Passer » : la grille tombe, l'épée en main), puis
// l'état qu'on veut tester posé par-dessus — et sauvegardé, pour qu'un intérieur le relise.
export async function partieActe1(page, etat = {}) {
  await page.goto(ORIGINE + '/connexion.html'); await page.evaluate(() => localStorage.clear());
  await page.goto(ORIGINE + '/index.html'); await charge(page); await page.waitForTimeout(1500);
  const choisir = (re) => page.evaluate((re) => { const M = TLOC.menu; if (!M.active) return null;
    const it = M.items.find((i) => new RegExp(re, 'i').test(i.label)); if (it) { it.fn(); return it.label; } return null; }, re);
  await choisir('nouvelle'); await page.waitForTimeout(1500); await choisir('passer');
  // la cinématique du rappel, sautée plan par plan
  for (let k = 0; k < 60; k++) {
    const fini = await page.evaluate(() => { const T = TLOC; if (!T.cut.active) return T.state.prologueFait === true; T.cutAdvance(true); return false; });
    if (fini) break; await page.waitForTimeout(250);
  }
  await page.evaluate((etat) => { Object.assign(TLOC.state, etat); TLOC.saveGame(true); }, etat);
  // les habitants de l'acte naissent un par image, après le chargement
  await page.waitForTimeout(2500);
}

// Se poser devant une interaction (son invite correspond à `re`), l'actionner, et lire tout
// ce qui se dit jusqu'à la fin du dialogue. Rend { invite, repliques[] }, ou null.
export async function parler(page, re, { avant = null } = {}) {
  const ok = await page.evaluate(([re, avant]) => { const T = TLOC;
    const it = T.interactables.find((i) => { try { return (!i.enabled || i.enabled()) && new RegExp(re, 'i').test(typeof i.prompt === 'function' ? i.prompt() : i.prompt || ''); } catch (e) { return false; } });
    if (!it) return null;
    // à un mètre, du côté de `avant` s'il est donné (sinon on tombe dans un mur)
    const p = it.pos, a = avant || [T.player.pos.x, T.player.pos.z], d = Math.hypot(a[0] - p.x, a[1] - p.z) || 1;
    const x = p.x + (a[0] - p.x) / d * 1.0, z = p.z + (a[1] - p.z) / d * 1.0;
    T.player.pos.set(x, Math.max(T.getH(x, z), p.y || 0), z);
    const inv = typeof it.prompt === 'function' ? it.prompt() : it.prompt; it.fn(); return inv; }, [re, avant]);
  if (ok === null) return null;
  const repliques = [];
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => { const T = TLOC; if (!T.cut.active) return null; const c = T.cut.cur; const s = c && c.say !== undefined ? `${c.who || ''} : ${c.say}` : ''; T.cutAdvance(true); return s; });
    if (r === null) break; if (r) repliques.push(r);
  }
  return { invite: ok, repliques };
}

// Filmer : la caméra libre en `cam`, regardant `at` ; Camille 25 m derrière (son corps bouchait l'image)
export async function filmer(page, fichier, cam, at, { camille = false, attente = 1800, hud = false } = {}) {
  await page.evaluate(([cam, at, camille, hud]) => { const T = TLOC;
    for (const id of ['hud']) { const e = document.getElementById(id); if (e) e.style.display = hud ? '' : 'none'; }
    if (!camille) { const dx = at[0] - cam[0], dz = at[2] - cam[2], d = Math.hypot(dx, dz) || 1, x = cam[0] - dx / d * 25, z = cam[2] - dz / d * 25; T.player.pos.set(x, T.getH(x, z), z); }
    T.G.freeCam = { pos: { x: cam[0], y: cam[1], z: cam[2] }, at: { x: at[0], y: at[1], z: at[2] } }; }, [cam, at, camille, hud]);
  await page.waitForTimeout(attente);
  await page.screenshot({ path: DIR + fichier, quality: 80 });
  await page.evaluate(() => { TLOC.G.freeCam = null; });
}

// Filmer quelqu'un sans qu'un mur s'interpose : on tourne autour de lui (en partant de l'angle
// voulu, `yaw` : 0 = de face) à 5–8 m et 2 m de haut, et l'on prend la première place d'où un
// rayon atteint sa poitrine sans rien toucher. Rend la place retenue, ou null (prise de face).
export async function filmerSujet(page, fichier, sujet, { yaw = 0, attente = 1800, camille = false } = {}) {
  const cam = await page.evaluate(async ([x, y, z, ry, dy]) => {
    const T = TLOC, THREE = T.THREE, objs = [];
    T.scene.traverse((o) => { if (o.isMesh && o.visible && !o.isSkinnedMesh && o.geometry) objs.push(o); });
    const rc = new THREE.Raycaster(), cible = new THREE.Vector3(x, y + 1.3, z);
    for (const d of [6, 8, 5]) for (let k = 0; k < 16; k++) {
      const a = ry + dy + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
      const c = new THREE.Vector3(x + Math.sin(a) * d, y + 2.0, z + Math.cos(a) * d), dir = cible.clone().sub(c), L = dir.length();
      rc.set(c, dir.normalize()); rc.far = L - 0.8;
      if (!rc.intersectObjects(objs, false).length) return [c.x, c.y, c.z];
    }
    return null;
  }, [...sujet, yaw]);
  const [x, y, z, ry] = sujet;
  const c = cam || [x + Math.sin(ry) * 6, y + 2, z + Math.cos(ry) * 6];
  await filmer(page, fichier, c, [x, y + 1.1, z], { attente, camille });
  return cam;
}
